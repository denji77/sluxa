"""
Friends Router.

Friend requests are sent by email. Clerk session JWTs don't carry an email
claim, so local User rows may have email=NULL; this router backfills emails
from the Clerk Backend API (secret key) — both for the current user and when
resolving a request target that isn't in the local DB yet.
"""

from datetime import datetime
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, or_, and_
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import get_settings
from ..database import get_db
from ..models import AppNotification, FriendMessage, Friendship, User

router = APIRouter(prefix="/friends", tags=["friends"])

settings = get_settings()
CLERK_API = "https://api.clerk.com/v1"


# ── Clerk Backend API helpers ────────────────────────────────────────────────

def _clerk_headers() -> dict:
    return {"Authorization": f"Bearer {settings.clerk_secret_key}"}


def _primary_email(clerk_user: dict) -> Optional[str]:
    emails = clerk_user.get("email_addresses") or []
    primary_id = clerk_user.get("primary_email_address_id")
    for e in emails:
        if e.get("id") == primary_id:
            return e.get("email_address")
    return emails[0].get("email_address") if emails else None


async def _clerk_get_user(clerk_id: str) -> Optional[dict]:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{CLERK_API}/users/{clerk_id}", headers=_clerk_headers())
            if r.status_code == 200:
                return r.json()
    except httpx.HTTPError:
        pass
    return None


async def _clerk_find_by_email(email: str) -> Optional[dict]:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{CLERK_API}/users",
                params={"email_address": [email]},
                headers=_clerk_headers(),
            )
            if r.status_code == 200:
                users = r.json()
                if isinstance(users, list) and users:
                    return users[0]
    except httpx.HTTPError:
        pass
    return None


async def _ensure_email(user: User, db: Session) -> None:
    """Backfill email/username from Clerk if this row predates email syncing."""
    if user.email:
        return
    clerk_user = await _clerk_get_user(user.clerk_id)
    if not clerk_user:
        return
    user.email = _primary_email(clerk_user)
    if not user.username:
        user.username = clerk_user.get("username")
    db.commit()


# ── Serialization ────────────────────────────────────────────────────────────

def _display_name(u: User) -> str:
    if u.username:
        return u.username
    if u.email:
        return u.email.split("@")[0]
    return f"User {u.id}"


def _user_dict(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "username": u.username,
        "display_name": _display_name(u),
    }


def _other_side(f: Friendship, me: User) -> User:
    return f.addressee if f.requester_id == me.id else f.requester


def _message_dict(m: FriendMessage, me: User) -> dict:
    return {
        "id": m.id,
        "friendship_id": m.friendship_id,
        "sender_id": m.sender_id,
        "content": m.content,
        "mine": m.sender_id == me.id,
        "created_at": m.created_at.isoformat(),
    }


def _request_dict(f: Friendship, me: User) -> dict:
    return {
        "id": f.id,
        "status": f.status,
        "direction": "outgoing" if f.requester_id == me.id else "incoming",
        "user": _user_dict(_other_side(f, me)),
        "created_at": f.created_at.isoformat(),
    }


def _my_read_cursor(f: Friendship, me: User) -> int:
    return f.requester_last_read_id if f.requester_id == me.id else f.addressee_last_read_id


def _set_my_read_cursor(f: Friendship, me: User, message_id: int) -> None:
    if f.requester_id == me.id:
        f.requester_last_read_id = max(f.requester_last_read_id or 0, message_id)
    else:
        f.addressee_last_read_id = max(f.addressee_last_read_id or 0, message_id)


def _notify(db: Session, user_id: int, kind: str, chat_id: int, title: str, body: str) -> None:
    db.add(AppNotification(
        user_id=user_id, kind=kind, chat_id=chat_id,
        title=title[:200], body=body[:500],
    ))


def _pair_query(db: Session, a_id: int, b_id: int):
    return db.query(Friendship).filter(
        or_(
            and_(Friendship.requester_id == a_id, Friendship.addressee_id == b_id),
            and_(Friendship.requester_id == b_id, Friendship.addressee_id == a_id),
        )
    )


def _get_friendship(db: Session, friendship_id: int, me: User) -> Friendship:
    f = db.query(Friendship).filter(Friendship.id == friendship_id).first()
    if not f or me.id not in (f.requester_id, f.addressee_id):
        raise HTTPException(status_code=404, detail="Friendship not found.")
    return f


# ── Friend requests ──────────────────────────────────────────────────────────

class SendRequestBody(BaseModel):
    email: str


@router.post("/requests")
async def send_friend_request(
    body: SendRequestBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a friend request to a user identified by email."""
    await _ensure_email(current_user, db)

    email = body.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    if current_user.email and current_user.email.lower() == email:
        raise HTTPException(status_code=400, detail="You can't friend yourself.")

    target = db.query(User).filter(func.lower(User.email) == email).first()
    if not target:
        # Not synced locally yet — resolve via Clerk (also matches users who
        # signed up before email syncing existed, via their clerk_id).
        clerk_user = await _clerk_find_by_email(email)
        if not clerk_user:
            raise HTTPException(status_code=404, detail="No account found with that email.")
        target = db.query(User).filter(User.clerk_id == clerk_user["id"]).first()
        if target:
            target.email = _primary_email(clerk_user) or email
            if not target.username:
                target.username = clerk_user.get("username")
        else:
            target = User(
                clerk_id=clerk_user["id"],
                email=_primary_email(clerk_user) or email,
                username=clerk_user.get("username"),
            )
            db.add(target)
        db.commit()
        db.refresh(target)

    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't friend yourself.")

    existing = _pair_query(db, current_user.id, target.id).first()
    if existing:
        if existing.status == "accepted":
            raise HTTPException(status_code=400, detail="You're already friends.")
        if existing.requester_id == current_user.id:
            raise HTTPException(status_code=400, detail="Friend request already sent.")
        # They already asked us — accept instead of creating a duplicate.
        existing.status = "accepted"
        existing.accepted_at = datetime.utcnow()
        _notify(
            db, target.id, "friend_request", existing.id,
            "Friend request accepted",
            f"{_display_name(current_user)} accepted your friend request.",
        )
        db.commit()
        db.refresh(existing)
        return _request_dict(existing, current_user)

    friendship = Friendship(requester_id=current_user.id, addressee_id=target.id)
    db.add(friendship)
    db.flush()
    _notify(
        db, target.id, "friend_request", friendship.id,
        "Friend request",
        f"{_display_name(current_user)} wants to be your friend.",
    )
    db.commit()
    db.refresh(friendship)
    return _request_dict(friendship, current_user)


@router.get("/requests")
async def list_friend_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pending requests involving me, split by direction."""
    pending = (
        db.query(Friendship)
        .filter(
            Friendship.status == "pending",
            or_(
                Friendship.requester_id == current_user.id,
                Friendship.addressee_id == current_user.id,
            ),
        )
        .order_by(Friendship.created_at.desc())
        .all()
    )
    return {
        "incoming": [_request_dict(f, current_user) for f in pending
                     if f.addressee_id == current_user.id],
        "outgoing": [_request_dict(f, current_user) for f in pending
                     if f.requester_id == current_user.id],
    }


@router.post("/requests/{request_id}/accept")
async def accept_friend_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _ensure_email(current_user, db)
    f = _get_friendship(db, request_id, current_user)
    if f.status != "pending" or f.addressee_id != current_user.id:
        raise HTTPException(status_code=400, detail="No pending request to accept.")
    f.status = "accepted"
    f.accepted_at = datetime.utcnow()
    _notify(
        db, f.requester_id, "friend_request", f.id,
        "Friend request accepted",
        f"{_display_name(current_user)} accepted your friend request.",
    )
    db.commit()
    db.refresh(f)
    return _request_dict(f, current_user)


@router.post("/requests/{request_id}/decline")
async def decline_friend_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Addressee declines — or requester cancels — a pending request."""
    f = _get_friendship(db, request_id, current_user)
    if f.status != "pending":
        raise HTTPException(status_code=400, detail="Request is no longer pending.")
    db.delete(f)
    db.commit()
    return {"ok": True}


# ── Friends list ─────────────────────────────────────────────────────────────

@router.get("")
async def list_friends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accepted friends with last message + unread count, most recent first."""
    friendships = (
        db.query(Friendship)
        .filter(
            Friendship.status == "accepted",
            or_(
                Friendship.requester_id == current_user.id,
                Friendship.addressee_id == current_user.id,
            ),
        )
        .all()
    )
    out = []
    for f in friendships:
        last = (
            db.query(FriendMessage)
            .filter(FriendMessage.friendship_id == f.id)
            .order_by(FriendMessage.id.desc())
            .first()
        )
        my_cursor = _my_read_cursor(f, current_user)
        unread = (
            db.query(func.count(FriendMessage.id))
            .filter(
                FriendMessage.friendship_id == f.id,
                FriendMessage.id > my_cursor,
                FriendMessage.sender_id != current_user.id,
            )
            .scalar()
        )
        out.append({
            "friendship_id": f.id,
            "friend": _user_dict(_other_side(f, current_user)),
            "since": (f.accepted_at or f.created_at).isoformat(),
            "last_message": _message_dict(last, current_user) if last else None,
            "unread_count": unread or 0,
        })
    out.sort(
        key=lambda x: (x["last_message"] or {}).get("created_at") or x["since"],
        reverse=True,
    )
    return out


@router.delete("/{friendship_id}")
async def unfriend(
    friendship_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a friend (deletes the DM history too)."""
    f = _get_friendship(db, friendship_id, current_user)
    db.delete(f)
    db.commit()
    return {"ok": True}


# ── Direct messages ──────────────────────────────────────────────────────────

class SendMessageBody(BaseModel):
    content: str


@router.get("/{friendship_id}/messages")
async def get_friend_messages(
    friendship_id: int,
    after_id: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Messages after `after_id` (poll with the last id you have)."""
    f = _get_friendship(db, friendship_id, current_user)
    if f.status != "accepted":
        raise HTTPException(status_code=400, detail="Not friends yet.")
    messages = (
        db.query(FriendMessage)
        .filter(
            FriendMessage.friendship_id == f.id,
            FriendMessage.id > after_id,
        )
        .order_by(FriendMessage.id)
        .limit(min(limit, 500))
        .all()
    )
    if messages:
        _set_my_read_cursor(f, current_user, messages[-1].id)
        db.commit()
    return {
        "friend": _user_dict(_other_side(f, current_user)),
        "messages": [_message_dict(m, current_user) for m in messages],
    }


@router.post("/{friendship_id}/messages")
async def send_friend_message(
    friendship_id: int,
    body: SendMessageBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message can't be empty.")
    if len(content) > settings.message_max_length:
        raise HTTPException(status_code=400, detail="Message too long.")

    f = _get_friendship(db, friendship_id, current_user)
    if f.status != "accepted":
        raise HTTPException(status_code=400, detail="Not friends yet.")

    msg = FriendMessage(
        friendship_id=f.id,
        sender_id=current_user.id,
        content=content,
    )
    db.add(msg)
    db.flush()
    _set_my_read_cursor(f, current_user, msg.id)
    other = _other_side(f, current_user)
    _notify(
        db, other.id, "friend", f.id,
        _display_name(current_user), content,
    )
    db.commit()
    db.refresh(msg)
    return _message_dict(msg, current_user)
