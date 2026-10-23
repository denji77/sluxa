"""
Notifications Router.

The mobile app registers a long-lived opaque device token (while Clerk-authed),
then its background task polls /poll with that token — no Clerk JWT needed,
because Clerk tokens are short-lived and unavailable in headless background JS.
"""

import secrets
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import AppNotification, DeviceToken, User

router = APIRouter(prefix="/notifications", tags=["notifications"])


class RegisterDeviceRequest(BaseModel):
    platform: Optional[str] = "android"
    # Token the app already holds, if any — reused when still valid
    existing_token: Optional[str] = None


@router.post("/register-device")
async def register_device(
    body: RegisterDeviceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Issue (or refresh) a device token for the authed user."""
    if body.existing_token:
        row = (
            db.query(DeviceToken)
            .filter(
                DeviceToken.token == body.existing_token,
                DeviceToken.user_id == current_user.id,
            )
            .first()
        )
        if row:
            row.last_seen_at = datetime.utcnow()
            db.commit()
            return {"token": row.token}

    token = secrets.token_urlsafe(32)
    db.add(DeviceToken(
        user_id=current_user.id,
        token=token,
        platform=body.platform or "android",
    ))
    db.commit()
    return {"token": token}


class PollRequest(BaseModel):
    token: str


@router.post("/poll")
async def poll_notifications(
    body: PollRequest,
    db: Session = Depends(get_db),
):
    """
    Return undelivered notifications for the device's user and mark them
    delivered. Authenticated by device token only (background-task friendly).
    """
    device = db.query(DeviceToken).filter(DeviceToken.token == body.token).first()
    if not device:
        raise HTTPException(status_code=401, detail="Invalid device token.")

    device.last_seen_at = datetime.utcnow()
    notifs = (
        db.query(AppNotification)
        .filter(
            AppNotification.user_id == device.user_id,
            AppNotification.delivered == False,  # noqa: E712
        )
        .order_by(AppNotification.created_at)
        .limit(25)
        .all()
    )
    out = []
    for n in notifs:
        n.delivered = True
        out.append({
            "id": n.id,
            "kind": n.kind,
            "chat_id": n.chat_id,
            "title": n.title,
            "body": n.body,
            "created_at": n.created_at.isoformat(),
        })
    db.commit()
    return {"notifications": out}
