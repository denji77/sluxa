"""
Group Chat Router — Conversation Intelligence System.

7 features:
  1. Fuzzy name matching (Levenshtein + prefix, no AI cost)
  2. Dynamics briefing (computed from GroupMessage rows)
  3. Enhanced Pinecone metadata (turn_number, addressed_to, responding_to)
  4. Typing hesitation (action: hesitate → frontend shows/hides indicator)
  5. Emoji reactions (action: react → sentiment-mapped emoji, no Gemini call)
  6. Character-to-character memory (inter-char sentiment in Pinecone)
  7. Interruptions (interrupt: true → frontend overlaps typing indicators)
"""

import json
import random
import traceback
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..ai.embeddings import generate_embedding, generate_query_embedding
from ..ai.prompts import build_system_prompt, extract_dialogue, replace_placeholders
from ..auth import get_current_user
from ..config import get_settings
from ..database import get_db
from ..models import (
    Character,
    GroupChat,
    GroupChatParticipant,
    GroupMessage,
    User,
)
from ..rag.vector_store import get_vector_store

settings = get_settings()
router = APIRouter(prefix="/group-chats", tags=["group-chats"])


# ═══════════════════════════════════════════════════════════════════════════
# Pydantic Schemas
# ═══════════════════════════════════════════════════════════════════════════


class ParticipantSchema(BaseModel):
    id: int
    character_id: int
    character_name: str
    character_avatar: Optional[str]
    order: int

    class Config:
        from_attributes = True


class GroupMessageSchema(BaseModel):
    id: Optional[int] = None
    group_chat_id: int
    character_id: Optional[int]
    character_name: Optional[str]
    character_avatar: Optional[str]
    content: str
    role: str  # "user" | "assistant" | "hesitation" | "reaction"
    created_at: Optional[datetime] = None
    # Staggered reveal
    delay_ms: int = 0
    # Reply threading
    responding_to_char_id: Optional[int] = None
    responding_to_char_name: Optional[str] = None
    responding_to_preview: Optional[str] = None
    # Hesitation
    hesitation_ms: int = 0
    # Reaction
    reacting_to_message_id: Optional[int] = None
    reacting_to_char_name: Optional[str] = None
    # Interruption
    interrupt: bool = False
    # User message ID (for syncing temp IDs in frontend)
    user_message_id: Optional[int] = None

    class Config:
        from_attributes = True


class GroupChatSummary(BaseModel):
    id: int
    title: Optional[str]
    participants: List[ParticipantSchema]
    last_message: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GroupChatDetail(BaseModel):
    id: int
    title: Optional[str]
    user_id: int
    participants: List[ParticipantSchema]
    messages: List[GroupMessageSchema]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CreateGroupChatRequest(BaseModel):
    character_ids: List[int]
    title: Optional[str] = None


class SendGroupMessageRequest(BaseModel):
    content: str
    mode: Optional[str] = "descriptive"
    timezone: Optional[str] = None
    formatted_time: Optional[str] = None
    formatted_date: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════
# Serialization
# ═══════════════════════════════════════════════════════════════════════════


def _serialize_participant(p: GroupChatParticipant) -> dict:
    return {
        "id": p.id,
        "character_id": p.character_id,
        "character_name": p.character.name,
        "character_avatar": p.character.avatar_url,
        "order": p.order,
    }


def _serialize_message(msg: GroupMessage, **extra) -> dict:
    base = {
        "id": msg.id,
        "group_chat_id": msg.group_chat_id,
        "character_id": msg.character_id,
        "character_name": msg.character.name if msg.character else None,
        "character_avatar": msg.character.avatar_url if msg.character else None,
        "content": msg.content,
        "role": msg.role,
        "created_at": msg.created_at,
        "delay_ms": 0,
        "responding_to_char_id": None,
        "responding_to_char_name": None,
        "responding_to_preview": None,
        "hesitation_ms": 0,
        "reacting_to_message_id": None,
        "reacting_to_char_name": None,
        "interrupt": False,
        "user_message_id": None,
    }
    base.update(extra)
    return base


def _virtual_message(**fields) -> dict:
    """Create a non-persisted message dict (hesitations, reactions)."""
    base = {
        "id": None,
        "group_chat_id": 0,
        "character_id": None,
        "character_name": None,
        "character_avatar": None,
        "content": "",
        "role": "assistant",
        "created_at": datetime.utcnow(),
        "delay_ms": 0,
        "responding_to_char_id": None,
        "responding_to_char_name": None,
        "responding_to_preview": None,
        "hesitation_ms": 0,
        "reacting_to_message_id": None,
        "reacting_to_char_name": None,
        "interrupt": False,
        "user_message_id": None,
    }
    base.update(fields)
    return base


# ═══════════════════════════════════════════════════════════════════════════
# Feature 1: Fuzzy Name Matching
# ═══════════════════════════════════════════════════════════════════════════


def _levenshtein(a: str, b: str) -> int:
    """Hand-rolled Levenshtein distance. No dependencies."""
    if len(a) < len(b):
        return _levenshtein(b, a)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a):
        curr = [i + 1]
        for j, cb in enumerate(b):
            curr.append(min(prev[j] + (ca != cb), prev[j + 1] + 1, curr[j] + 1))
        prev = curr
    return prev[-1]


def _fuzzy_match_character(user_message: str, participants: list):
    """
    Match character names in user message with tolerance for misspellings.
    Checks ALL parts of multiword names (e.g., 'Shikuzaki' matches 'Fuka Shikuzaki').
    Returns the matched participant, or None.
    """
    words = user_message.lower().split()
    if not words:
        return None

    best_match = None
    best_score = 999

    for p in participants:
        cname = p.character.name.lower()
        name_parts = cname.split()  # ["fuka", "shikuzaki"]

        for word in words:
            # Skip very short or common words
            if len(word) < 3:
                continue
            # Strip punctuation
            clean_word = word.strip(",.!?;:'\"")
            if len(clean_word) < 3:
                continue

            # Exact full-name match
            if clean_word == cname:
                return p

            # Check against EACH part of the name
            for part in name_parts:
                # Exact part match
                if clean_word == part:
                    return p

                # Prefix match (3+ chars)
                if len(clean_word) >= 3 and part.startswith(clean_word):
                    return p

                # Levenshtein (for typos) — only for longer names
                if len(part) > 3:
                    dist = _levenshtein(clean_word, part)
                    if dist <= 2 and dist < best_score:
                        best_score = dist
                        best_match = p

    return best_match


# Group-address words that mean "talking to everyone"
_GROUP_ADDRESS_WORDS = {
    "guys", "everyone", "everybody", "y'all", "yall", "peeps",
    "folks", "people", "gang", "squad", "team", "friends",
    "homies", "bros", "girls", "boys", "all",
}
_GROUP_ADDRESS_PHRASES = {
    "all of you", "you all", "you guys", "what do you all",
    "how are you all", "how you all",
}


def _is_group_address(user_message: str) -> bool:
    """Detect if the user is addressing the entire group."""
    msg_lower = user_message.lower()
    # Check phrases first
    for phrase in _GROUP_ADDRESS_PHRASES:
        if phrase in msg_lower:
            return True
    # Check individual words
    words = set(msg_lower.split())
    return bool(words & _GROUP_ADDRESS_WORDS)


# ═══════════════════════════════════════════════════════════════════════════
# Feature 2: Dynamics Briefing (personality-weighted)
# ═══════════════════════════════════════════════════════════════════════════


# Keywords to classify character personality type from description
_EXTROVERT_KEYWORDS = {
    "extrovert", "outgoing", "loud", "bold", "confident", "energetic",
    "talkative", "enthusiastic", "charismatic", "social", "assertive",
    "brash", "aggressive", "boisterous", "lively", "cheerful",
    "impulsive", "excitable", "dramatic", "fearless",
}
_INTROVERT_KEYWORDS = {
    "introvert", "shy", "quiet", "reserved", "timid", "withdrawn",
    "reclusive", "stoic", "aloof", "cold", "distant", "loner",
    "anxious", "nervous", "reluctant", "solitary", "brooding",
    "mysterious", "soft-spoken", "awkward",
}


def _classify_personality(description: str) -> tuple:
    """
    Classify character as extrovert/introvert/ambivert from their description.
    Returns (label, expected_rate) where expected_rate is their natural
    participation frequency (0.0 to 1.0).
    """
    desc_lower = (description or "").lower()
    words = set(desc_lower.split())

    ext_score = len(words & _EXTROVERT_KEYWORDS)
    int_score = len(words & _INTROVERT_KEYWORDS)

    if ext_score > int_score:
        return "extrovert", 0.65  # expects to speak ~65% of turns
    elif int_score > ext_score:
        return "introvert", 0.20  # expects to speak ~20% of turns
    else:
        return "ambivert", 0.40  # expects to speak ~40% of turns


def _build_dynamics_briefing(
    db: Session, group_chat_id: int, participants: list
) -> str:
    """
    Compute personality-weighted per-character activity stats.
    Returns a compact text block for the orchestrator.
    """
    # Last 30 messages (mix of user + assistant)
    recent = (
        db.query(GroupMessage)
        .filter(GroupMessage.group_chat_id == group_chat_id)
        .order_by(GroupMessage.created_at.desc())
        .limit(30)
        .all()
    )
    recent.reverse()  # chronological

    if not recent:
        return ""

    # Count user messages (turns)
    user_msgs = [m for m in recent if m.role == "user"]
    total_turns = len(user_msgs)
    if total_turns == 0:
        return ""

    name_map = {p.character_id: p.character.name for p in participants}
    lines = ["[Conversation Dynamics (last {} turns):]".format(total_turns)]

    for p in participants:
        cid = p.character_id
        cname = p.character.name
        desc = p.character.description or ""

        # Personality classification
        ptype, expected_rate = _classify_personality(desc)
        expected_count = max(1, round(total_turns * expected_rate))

        # How many times this char spoke in the window
        spoke_count = sum(1 for m in recent if m.character_id == cid and m.role == "assistant")

        # Turns since they last spoke
        last_spoke_idx = None
        for i, m in enumerate(recent):
            if m.character_id == cid and m.role == "assistant":
                last_spoke_idx = i
        if last_spoke_idx is not None:
            msgs_since = len(recent) - 1 - last_spoke_idx
        else:
            msgs_since = len(recent)

        # Activity label RELATIVE to their personality
        ratio = spoke_count / max(expected_count, 1)
        if ratio >= 1.8:
            label = "OVER-PARTICIPATING — must cool down"
        elif ratio >= 1.2:
            label = "SLIGHTLY ABOVE expected"
        elif ratio >= 0.7:
            label = "ON TRACK for their personality"
        elif ratio >= 0.3:
            label = "BELOW expected — should speak more"
        elif spoke_count > 0:
            label = "VERY QUIET — include them"
        else:
            label = "SILENT — consider including"

        lines.append(
            f"- {cname} ({ptype}, expects ~{expected_count}/{total_turns}): "
            f"spoke {spoke_count}/{total_turns} turns, "
            f"last spoke {msgs_since} msgs ago ({label})"
        )

    # Detect 1-on-1 pattern (but NOT if current message is a group address)
    if total_turns >= 2:
        recent_user = [m for m in recent if m.role == "user"][-3:]
        addressed_chars = set()
        for um in recent_user:
            # Skip group-addressed messages from detection
            if _is_group_address(um.content):
                continue
            match = _fuzzy_match_character(um.content, participants)
            if match:
                addressed_chars.add(match.character_id)
        if len(addressed_chars) == 1:
            solo_name = name_map.get(addressed_chars.pop(), "someone")
            lines.append(f"- User seems to be in a 1-on-1 with {solo_name} (don't interrupt)")

    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════════
# Feature 5: Reaction Emoji Mapping
# ═══════════════════════════════════════════════════════════════════════════


REACTION_MAP = {
    "amused": ["😂", "💀", "😆"],
    "agree": ["👍", "💯", "👏"],
    "surprised": ["👀", "😳", "😮"],
    "annoyed": ["😒", "🙄", "😤"],
    "love": ["❤️", "🥺", "💕"],
    "neutral": ["👀", "🤔", "😶"],
}


def _pick_reaction(sentiment: str) -> str:
    """Pick a random emoji for a sentiment category."""
    emojis = REACTION_MAP.get(sentiment, REACTION_MAP["neutral"])
    return random.choice(emojis)


# ═══════════════════════════════════════════════════════════════════════════
# Feature 6: Character-to-Character Memory
# ═══════════════════════════════════════════════════════════════════════════


def _relationship_namespace(group_chat_id: int) -> str:
    return f"grp_{group_chat_id}_relationships"


async def _get_relationships(group_chat_id: int, char_id: int, participants: list) -> str:
    """
    Retrieve this character's sentiment toward other characters from Pinecone.
    Returns a compact context block.
    """
    if not settings.rag_enabled:
        return ""
    try:
        vector_store = get_vector_store()
        ns = _relationship_namespace(group_chat_id)

        # Pinecone doesn't support metadata-only queries well,
        # so we use a dummy vector query with filter
        # Instead, we'll use list + fetch for the relationship namespace
        all_ids = []
        for page in vector_store._index.list(namespace=ns):
            all_ids.extend(page)

        if not all_ids:
            return ""

        # Fetch metadata for all relationship vectors
        fetched = vector_store._index.fetch(ids=all_ids[:50], namespace=ns)
        name_map = {p.character_id: p.character.name for p in participants}

        lines = ["[Your relationships with others:]"]
        found = False
        for _vid, vec_data in fetched.get("vectors", {}).items():
            m = vec_data.get("metadata", {})
            from_c = int(m.get("from_char", 0))
            to_c = int(m.get("to_char", 0))
            if from_c == char_id:
                sentiment = m.get("sentiment", "neutral")
                last_int = m.get("last_interaction", "")
                to_name = name_map.get(to_c, "someone")
                lines.append(f"- You feel {sentiment} toward {to_name}: \"{last_int[:80]}\"")
                found = True

        if not found:
            return ""
        return "\n".join(lines)

    except Exception as e:
        print(f"[Relationships] Error retrieving for char {char_id}: {e}")
        return ""


async def _update_relationships(
    group_chat_id: int,
    this_turn_chars: dict,  # char_id -> response text
    participants: list,
):
    """
    After a turn, update inter-character sentiment in Pinecone.
    Uses a quick Gemini call to rate sentiments between characters who interacted.
    """
    if not settings.rag_enabled:
        return
    if len(this_turn_chars) < 2:
        return  # Need at least 2 chars to have a relationship

    from ..ai.chat import _client
    from google.genai import types

    name_map = {p.character_id: p.character.name for p in participants}

    # Build exchange summary
    exchange_lines = []
    char_ids = list(this_turn_chars.keys())
    for cid in char_ids:
        cname = name_map.get(cid, "?")
        text = this_turn_chars[cid][:150]
        exchange_lines.append(f"  {cname} (ID {cid}): \"{text}\"")

    prompt = (
        "Rate the sentiment between each pair of characters based on this exchange.\n\n"
        "Exchange:\n" + "\n".join(exchange_lines) + "\n\n"
        "Sentiment options: friendly, tense, playful, annoyed, neutral\n"
        "Return ONLY a JSON array:\n"
        '[{"from": 3, "to": 5, "sentiment": "friendly"}]'
    )

    try:
        response = await _client.aio.models.generate_content(
            model=settings.ai_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=150,
            ),
        )
        raw = response.text.strip().strip("```json").strip("```").strip()
        pairs = json.loads(raw)

        vector_store = get_vector_store()
        ns = _relationship_namespace(group_chat_id)
        # Use a dummy embedding (Pinecone requires vectors, but we only use metadata)
        dummy_vec = [0.01] * settings.embedding_dimensions

        for pair in pairs:
            from_c = pair.get("from")
            to_c = pair.get("to")
            sentiment = pair.get("sentiment", "neutral")
            if from_c is None or to_c is None:
                continue

            vec_id = f"rel_{from_c}_{to_c}"
            from_name = name_map.get(from_c, "?")
            to_name = name_map.get(to_c, "?")
            # Pick a snippet of the interaction
            snippet = this_turn_chars.get(from_c, "")[:80]

            metadata = {
                "pair": f"{from_c}_{to_c}",
                "from_char": from_c,
                "to_char": to_c,
                "from_name": from_name,
                "to_name": to_name,
                "sentiment": sentiment,
                "last_interaction": snippet,
                "updated_at": datetime.utcnow().isoformat(),
            }
            vector_store._index.upsert(
                vectors=[(vec_id, dummy_vec, metadata)],
                namespace=ns,
            )
        print(f"[Relationships] Updated {len(pairs)} pairs for group {group_chat_id}")

    except Exception as e:
        print(f"[Relationships] Update failed: {e}")


# ═══════════════════════════════════════════════════════════════════════════
# RAG Helpers (Feature 3: enhanced metadata)
# ═══════════════════════════════════════════════════════════════════════════


def _grp_namespace(group_chat_id: int, character_id: int) -> str:
    return f"grp_{group_chat_id}_char_{character_id}"


async def _index_message(
    group_chat_id: int,
    character_id: int,
    content: str,
    role: str,
    message_id: int,
    turn_number: int = 0,
    addressed_to: str = "none",
    responding_to: str = "user",
):
    """Index a message with enhanced metadata."""
    if not settings.rag_enabled:
        return
    try:
        embedding = await generate_embedding(content)
        vector_store = get_vector_store()
        ns = _grp_namespace(group_chat_id, character_id)
        vec = embedding.astype("float32").flatten().tolist()
        if all(v == 0.0 for v in vec):
            return
        metadata = {
            "message_id": message_id,
            "chat_id": group_chat_id,
            "role": role,
            "content_preview": content[:100],
            "created_at": datetime.utcnow().isoformat(),
            # Enhanced fields
            "turn_number": turn_number,
            "addressed_to": addressed_to,
            "responding_to": responding_to,
        }
        vector_store._index.upsert(
            vectors=[(f"msg_{message_id}", vec, metadata)],
            namespace=ns,
        )
    except Exception as e:
        print(f"[Group RAG] Error indexing message {message_id}: {e}")


async def _retrieve_rag_context(
    group_chat_id: int, character_id: int, query: str
) -> str:
    """Retrieve relevant past context from Pinecone for a character."""
    if not settings.rag_enabled:
        return ""
    try:
        query_embedding = await generate_query_embedding(query)
        vector_store = get_vector_store()
        ns = _grp_namespace(group_chat_id, character_id)
        vec = query_embedding.astype("float32").flatten().tolist()
        response = vector_store._index.query(
            vector=vec,
            top_k=settings.rag_top_k,
            namespace=ns,
            include_metadata=True,
        )
        matches = [
            m
            for m in response.get("matches", [])
            if m["score"] >= settings.rag_similarity_threshold
        ]
        if not matches:
            return ""
        lines = ["[Relevant past context:]"]
        for match in matches[:5]:
            m = match["metadata"]
            role_label = "User" if m["role"] == "user" else "Character"
            lines.append(f"{role_label}: {m.get('content_preview', '')}")
        lines.append("[End of past context.]")
        return "\n".join(lines)
    except Exception as e:
        print(f"[Group RAG] Retrieval error: {e}")
        return ""


# ═══════════════════════════════════════════════════════════════════════════
# AI Orchestrator (Features 4, 5, 7: hesitate, react, interrupt)
# ═══════════════════════════════════════════════════════════════════════════


async def _orchestrate_turn(
    user_message: str,
    participants: list,
    conversation_history: list,
    dynamics_briefing: str,
) -> list:
    """
    Returns conversation plan as a list of action entries.
    Each entry: {char_id, reply_to, eagerness, action, interrupt, reaction_sentiment}
    """
    from ..ai.chat import _client
    from google.genai import types

    if not participants:
        return []

    char_lines = []
    name_list = []
    for p in participants:
        desc = (p.character.description or "")[:250].replace("\n", " ")
        char_lines.append(f"  ID={p.character_id} | {p.character.name}: {desc}")
        name_list.append(p.character.name)

    name_map = {p.character_id: p.character.name for p in participants}
    hist_lines = []
    for msg in conversation_history[-5:]:
        label = "User" if msg.role == "user" else name_map.get(msg.character_id, "?")
        hist_lines.append(f"  {label}: {msg.content[:120]}")
    hist_block = "\n".join(hist_lines) if hist_lines else "  (empty)"
    names_csv = ", ".join(name_list)

    dynamics_block = f"\n\n{dynamics_briefing}" if dynamics_briefing else ""

    prompt = (
        "You are the orchestrator for a group chat roleplay.\n"
        "Your job is to decide WHO responds to the user's message and HOW.\n"
        "You must return ONLY a JSON array of characters who will participate in this turn.\n"
        "Max 4 characters per turn.\n\n"
        f'User message: "{user_message[:200]}"\n\n'
        f"Recent chat:\n{hist_block}\n\n"
        f"Characters ({names_csv}):\n" + "\n".join(char_lines) + "\n"
        + dynamics_block + "\n\n"
        "RULES:\n"
        "1. Character PERSONALITY determines if they speak.\n"
        "   Extroverts → likely respond. Introverts → stay silent or react.\n"
        "2. VARIETY IS MANDATORY:\n"
        "   - If dynamics show a character as VERY ACTIVE, DO NOT pick them.\n"
        "     Give other characters a turn.\n"
        "   - If a character is marked SILENT or QUIET, prefer including them.\n"
        "   - NEVER let the same character dominate. Rotate who speaks.\n"
        "3. Include AT LEAST 2 characters in a generic message.\n"
        "4. ACTIONS:\n"
        '   "respond"  = send a full message\n'
        '   "hesitate" = start typing then stop (shy chars)\n'
        '   "react"    = emoji reaction (introverts, small reactions)\n'
        "5. reply_to: \"user\" | \"char:X\" | \"none\"\n"
        "6. eagerness: 1-10 (10=instant, 1=slow)\n"
        "7. interrupt: true only for impatient characters\n"
        "8. reaction_sentiment: only if action=react. "
        "One of: amused, agree, surprised, annoyed, love, neutral\n\n"
        "Return ONLY a JSON array:\n"
        '[{"char_id": N, "reply_to": "user", "eagerness": 8, '
        '"action": "respond", "interrupt": false}]'
    )

    # Debug: log the prompt so we can diagnose issues
    print(f"[Orchestrator] Prompt length: {len(prompt)} chars")
    print(f"[Orchestrator] Characters: {names_csv}")
    if dynamics_briefing:
        print(f"[Orchestrator] Dynamics:\n{dynamics_briefing}")

    try:
        response = await _client.aio.models.generate_content(
            model=settings.ai_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.15,
                max_output_tokens=300,
            ),
        )
        raw = response.text.strip().strip("```json").strip("```").strip()
        plan = json.loads(raw)

        valid_ids = {p.character_id for p in participants}
        valid_actions = {"respond", "hesitate", "react"}
        validated = []
        seen_chars = set()

        for entry in plan:
            if not isinstance(entry, dict):
                continue
            cid = entry.get("char_id")
            if cid not in valid_ids or cid in seen_chars:
                continue
            seen_chars.add(cid)

            if entry.get("action", "respond") not in valid_actions:
                entry["action"] = "respond"
            if not isinstance(entry.get("eagerness", 5), (int, float)):
                entry["eagerness"] = 5
            entry.setdefault("reply_to", "user")
            entry.setdefault("action", "respond")
            entry.setdefault("interrupt", False)
            entry.setdefault("reaction_sentiment", "neutral")
            validated.append(entry)

        if not validated:
            # Fallback: pick a RANDOM participant, not always the first one
            fallback = random.choice(participants)
            validated = [{"char_id": fallback.character_id, "reply_to": "user",
                          "eagerness": 7, "action": "respond", "interrupt": False}]

        validated.sort(key=lambda x: -x.get("eagerness", 5))

        id_to_name = {p.character_id: p.character.name for p in participants}
        summary = " → ".join(
            f"{id_to_name.get(e['char_id'], '?')} ({e['action']})"
            for e in validated
        )
        print(f"[Group Chat] Plan: {summary}")
        return validated

    except Exception as e:
        print(f"[Group Chat] Orchestration failed ({e}), fallback.")
        fallback = random.choice(participants)
        return [{"char_id": fallback.character_id, "reply_to": "user",
                 "eagerness": 7, "action": "respond", "interrupt": False}]


# ═══════════════════════════════════════════════════════════════════════════
# Routes
# ═══════════════════════════════════════════════════════════════════════════


@router.get("", response_model=List[GroupChatSummary])
async def list_group_chats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chats = (
        db.query(GroupChat)
        .filter(GroupChat.user_id == current_user.id)
        .order_by(GroupChat.updated_at.desc())
        .all()
    )
    result = []
    for chat in chats:
        last_msg = chat.messages[-1].content[:100] if chat.messages else None
        result.append({
            "id": chat.id,
            "title": chat.title,
            "participants": [_serialize_participant(p) for p in chat.participants],
            "last_message": last_msg,
            "created_at": chat.created_at,
            "updated_at": chat.updated_at,
        })
    return result


@router.post("", response_model=GroupChatDetail)
async def create_group_chat(
    body: CreateGroupChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if len(body.character_ids) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 characters.")
    if len(body.character_ids) > 6:
        raise HTTPException(status_code=400, detail="Maximum 6 characters.")

    chars = []
    for cid in body.character_ids:
        c = db.query(Character).filter(Character.id == cid).first()
        if not c:
            raise HTTPException(status_code=404, detail=f"Character {cid} not found.")
        if not c.is_default and c.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail=f"Access denied for character {cid}.")
        chars.append(c)

    title = body.title or "Group Chat with " + ", ".join(c.name for c in chars)
    group_chat = GroupChat(title=title, user_id=current_user.id)
    db.add(group_chat)
    db.flush()

    for idx, char in enumerate(chars):
        db.add(GroupChatParticipant(
            group_chat_id=group_chat.id,
            character_id=char.id,
            order=idx,
        ))

    db.commit()
    db.refresh(group_chat)
    return {
        "id": group_chat.id,
        "title": group_chat.title,
        "user_id": group_chat.user_id,
        "participants": [_serialize_participant(p) for p in group_chat.participants],
        "messages": [],
        "created_at": group_chat.created_at,
        "updated_at": group_chat.updated_at,
    }


@router.get("/{group_chat_id}", response_model=GroupChatDetail)
async def get_group_chat(
    group_chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chat = db.query(GroupChat).filter(
        GroupChat.id == group_chat_id,
        GroupChat.user_id == current_user.id,
    ).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Group chat not found.")

    msg_by_id = {m.id: m for m in chat.messages}
    messages_out = []
    for m in chat.messages:
        r_char_id = r_char_name = r_preview = None
        if m.responding_to_message_id and m.responding_to_message_id in msg_by_id:
            target = msg_by_id[m.responding_to_message_id]
            r_char_id = target.character_id
            r_char_name = target.character.name if target.character else None
            r_preview = target.content[:120]
        messages_out.append(_serialize_message(
            m,
            responding_to_char_id=r_char_id,
            responding_to_char_name=r_char_name,
            responding_to_preview=r_preview,
        ))

    return {
        "id": chat.id,
        "title": chat.title,
        "user_id": chat.user_id,
        "participants": [_serialize_participant(p) for p in chat.participants],
        "messages": messages_out,
        "created_at": chat.created_at,
        "updated_at": chat.updated_at,
    }


@router.delete("/{group_chat_id}")
async def delete_group_chat(
    group_chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chat = db.query(GroupChat).filter(
        GroupChat.id == group_chat_id,
        GroupChat.user_id == current_user.id,
    ).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Group chat not found.")

    if settings.rag_enabled:
        vector_store = get_vector_store()
        for p in chat.participants:
            ns = _grp_namespace(group_chat_id, p.character_id)
            try:
                vector_store._index.delete(delete_all=True, namespace=ns)
            except Exception:
                pass
        # Also clean relationship namespace
        try:
            vector_store._index.delete(
                delete_all=True,
                namespace=_relationship_namespace(group_chat_id),
            )
        except Exception:
            pass

    db.delete(chat)
    db.commit()
    return {"message": "Group chat deleted."}


# ═══════════════════════════════════════════════════════════════════════════
# Ambient Chat — Unprompted character messages
# ═══════════════════════════════════════════════════════════════════════════


@router.post("/{group_chat_id}/ambient", response_model=Optional[GroupMessageSchema])
async def ambient_message(
    group_chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate an unprompted ambient message from a random character.
    Called by the frontend after a period of silence.
    Returns a single message or null (silence is natural).
    """
    chat = db.query(GroupChat).filter(
        GroupChat.id == group_chat_id,
        GroupChat.user_id == current_user.id,
    ).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Group chat not found.")
    if not chat.participants:
        return None

    # 40% chance of silence — not every pause needs a message
    if random.random() < 0.4:
        return None

    # Pick a character, weighted toward those who haven't spoken recently
    recent_msgs = (
        db.query(GroupMessage)
        .filter(
            GroupMessage.group_chat_id == chat.id,
            GroupMessage.role == "assistant",
        )
        .order_by(GroupMessage.created_at.desc())
        .limit(10)
        .all()
    )

    recent_char_ids = [m.character_id for m in recent_msgs[:5]]
    name_map = {p.character_id: p.character.name for p in chat.participants}

    # Prefer characters who HAVEN'T spoken recently
    candidates = []
    for p in chat.participants:
        if p.character_id not in recent_char_ids:
            candidates.append(p)  # high priority
    if not candidates:
        # Everyone spoke recently — pick randomly
        candidates = list(chat.participants)

    chosen = random.choice(candidates)
    char = chosen.character
    user_name = current_user.username or current_user.email or "User"

    # Gather last few messages for context
    last_msgs = (
        db.query(GroupMessage)
        .filter(GroupMessage.group_chat_id == chat.id)
        .order_by(GroupMessage.created_at.desc())
        .limit(8)
        .all()
    )
    last_msgs.reverse()

    hist_lines = []
    for m in last_msgs:
        label = "User" if m.role == "user" else name_map.get(m.character_id, "?")
        hist_lines.append(f"{label}: {m.content[:100]}")
    hist_block = "\n".join(hist_lines) if hist_lines else "(empty chat)"

    # Generate the ambient message
    from ..ai.chat import _client
    from google.genai import types

    ambient_prompt = (
        f"You are {char.name} in a group chat. There has been a lull in conversation.\n\n"
        f"Your personality: {(char.description or '')[:300]}\n\n"
        f"Recent conversation:\n{hist_block}\n\n"
        "Write a SHORT, unprompted message that your character would naturally drop "
        "into the chat during a quiet moment. This is NOT a response to anyone — "
        "it's a random thought, observation, complaint, or musing.\n\n"
        "GUIDELINES:\n"
        "- Keep it under 2 sentences\n"
        "- It should feel natural, like something typed casually\n"
        "- It can be related to the previous conversation or completely random\n"
        "- Match your character's personality and speech patterns\n"
        "- Examples: sharing a random thought, commenting on something happening "
        "around them, asking a random question, making an observation\n"
        "- DO NOT start with a greeting or address anyone directly\n"
    )

    system_prompt = build_system_prompt(
        character_description=char.description,
        user_name=user_name,
        char_name=char.name,
        is_private=False,
        mode="descriptive",
    )

    try:
        gemini_chat = _client.aio.chats.create(
            model=settings.ai_model,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.9,  # High creativity for ambient thoughts
                max_output_tokens=150,
            ),
            history=[],
        )
        response = await gemini_chat.send_message(ambient_prompt)
        text = response.text.strip()
        text = replace_placeholders(text, user_name, char.name)
        if not text:
            return None
    except Exception as e:
        print(f"[Ambient] Generation failed for {char.name}: {e}")
        return None

    # Save to DB
    msg = GroupMessage(
        group_chat_id=chat.id,
        character_id=char.id,
        content=text,
        role="assistant",
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # Index in Pinecone
    turn_number = (
        db.query(GroupMessage)
        .filter(GroupMessage.group_chat_id == chat.id, GroupMessage.role == "user")
        .count()
    )
    if settings.rag_enabled:
        await _index_message(
            chat.id, char.id, text, "assistant", msg.id,
            turn_number=turn_number,
            responding_to="none",
        )

    chat.updated_at = datetime.utcnow()
    db.commit()

    print(f"[Ambient] {char.name}: \"{text[:60]}...\"")
    return _serialize_message(msg)


# ═══════════════════════════════════════════════════════════════════════════
# Main Send Endpoint — Orchestrates everything
# ═══════════════════════════════════════════════════════════════════════════


@router.post("/{group_chat_id}/messages", response_model=List[GroupMessageSchema])
async def send_group_message(
    group_chat_id: int,
    body: SendGroupMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chat = db.query(GroupChat).filter(
        GroupChat.id == group_chat_id,
        GroupChat.user_id == current_user.id,
    ).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Group chat not found.")
    if not chat.participants:
        raise HTTPException(status_code=400, detail="No participants.")

    user_name = current_user.username or current_user.email or "User"
    mode = body.mode or "descriptive"
    time_context = None
    if body.timezone or body.formatted_time:
        time_context = {
            "timezone": body.timezone,
            "formatted_time": body.formatted_time,
            "formatted_date": body.formatted_date,
        }

    # ── 1. Save user message ─────────────────────────────────────────────
    user_msg = GroupMessage(
        group_chat_id=chat.id,
        character_id=None,
        content=body.content,
        role="user",
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # Compute turn number
    turn_number = (
        db.query(GroupMessage)
        .filter(
            GroupMessage.group_chat_id == chat.id,
            GroupMessage.role == "user",
        )
        .count()
    )

    # ── 2. Detect addressing ───────────────────────────────────────────────
    is_group_addr = _is_group_address(body.content)
    addressed_participant = None if is_group_addr else _fuzzy_match_character(body.content, chat.participants)
    addressed_to = "all" if is_group_addr else (str(addressed_participant.character_id) if addressed_participant else "none")

    # Index user message
    if settings.rag_enabled:
        for p in chat.participants:
            await _index_message(
                chat.id, p.character_id, body.content, "user", user_msg.id,
                turn_number=turn_number,
                addressed_to=addressed_to,
            )

    db.refresh(chat)

    # History snapshot (everything before current user msg)
    history_snapshot = list(chat.messages[:-1])
    name_map = {p.character_id: p.character.name for p in chat.participants}
    id_to_p = {p.character_id: p for p in chat.participants}

    # ── 3. Determine the plan ─────────────────────────────────────────────
    # Build the address hint
    addressed_hint = ""
    if is_group_addr:
        addressed_hint = (
            "\n[IMPORTANT: User is addressing EVERYONE in the group. "
            "Plan MUST include ALL characters with action=respond. "
            "You MUST STILL RETURN ONLY A JSON ARRAY. Do not output plain text.]"
        )
        print(f"[Group Chat] Group address detected → ALL characters should respond")
    elif addressed_participant:
        aname = addressed_participant.character.name
        addressed_hint = (
            f"\n[IMPORTANT: User is addressing {aname} directly. "
            f"{aname} MUST be in the plan and MUST respond FIRST (highest eagerness). "
            f"Others may also respond AFTER {aname} based on their personality. "
            f"You MUST STILL RETURN ONLY A JSON ARRAY.]"
        )
        print(f"[Group Chat] Fuzzy match hint → {aname} (MUST respond first, others may follow)")

    dynamics = _build_dynamics_briefing(db, chat.id, chat.participants)
    if addressed_hint:
        dynamics = dynamics + addressed_hint if dynamics else addressed_hint

    plan = await _orchestrate_turn(
        user_message=body.content,
        participants=chat.participants,
        conversation_history=list(chat.messages),
        dynamics_briefing=dynamics,
        )

    # ── Anti-domination enforcement (code-level, can't be ignored by LLM) ──
    recent_ai = (
        db.query(GroupMessage)
        .filter(
            GroupMessage.group_chat_id == chat.id,
            GroupMessage.role == "assistant",
        )
        .order_by(GroupMessage.created_at.desc())
        .limit(3)
        .all()
    )
    if len(recent_ai) >= 3:
        recent_char_ids = {m.character_id for m in recent_ai}
        if len(recent_char_ids) == 1:
            dominant_id = recent_char_ids.pop()
            dominant_name = name_map.get(dominant_id, "?")
            # Remove the dominant character from respond actions
            # (allow them to react/hesitate still)
            plan_filtered = [
                e for e in plan
                if e["char_id"] != dominant_id or e.get("action") != "respond"
            ]
            # If nothing left, inject a random non-dominant participant
            if not plan_filtered:
                others = [p for p in chat.participants if p.character_id != dominant_id]
                if others:
                    alt = random.choice(others)
                    plan_filtered = [{"char_id": alt.character_id, "reply_to": "user",
                                      "eagerness": 7, "action": "respond", "interrupt": False}]
                    print(f"[Anti-Dom] Forced swap: {dominant_name} → {alt.character.name}")
            else:
                print(f"[Anti-Dom] Removed dominant {dominant_name} from respond list")
            plan = plan_filtered if plan_filtered else plan

    # ── 4. Process each entry in the plan ─────────────────────────────────
    from ..ai.chat import _client
    from google.genai import types

    result_messages: list = []       # final response list (all types)
    this_turn_orm: dict = {}         # char_id -> saved GroupMessage
    this_turn_texts: dict = {}       # char_id -> response text (for relationship update)
    MAX_MSG_LEN = 300

    def _snippet(text: str) -> str:
        return text[:MAX_MSG_LEN] + ("…" if len(text) > MAX_MSG_LEN else "")

    for entry in plan:
        char_id: int = entry["char_id"]
        reply_to: str = entry.get("reply_to", "user")
        eagerness: int = max(1, min(10, int(entry.get("eagerness", 5))))
        action: str = entry.get("action", "respond")
        is_interrupt: bool = entry.get("interrupt", False)
        delay_ms: int = max(0, (10 - eagerness) * 400)

        p = id_to_p.get(char_id)
        if not p:
            continue
        char = p.character
        char_name = char.name

        # ── ACTION: HESITATE ──────────────────────────────────────────────
        if action == "hesitate":
            hesitation_ms = random.randint(1200, 2200)
            result_messages.append(_virtual_message(
                group_chat_id=chat.id,
                character_id=char_id,
                character_name=char_name,
                character_avatar=char.avatar_url,
                role="hesitation",
                delay_ms=delay_ms,
                hesitation_ms=hesitation_ms,
                user_message_id=user_msg.id,
            ))
            print(f"  {char_name}: hesitates ({hesitation_ms}ms)")
            continue

        # ── ACTION: REACT ─────────────────────────────────────────────────
        if action == "react":
            sentiment = entry.get("reaction_sentiment", "neutral")
            emoji = _pick_reaction(sentiment)

            # Find the last non-user message to react to
            react_target_id = None
            react_target_name = None
            if this_turn_orm:
                last_char_id = list(this_turn_orm.keys())[-1]
                react_target_id = this_turn_orm[last_char_id].id
                react_target_name = name_map.get(last_char_id)
            elif chat.messages:
                # React to user's message
                react_target_id = user_msg.id
                react_target_name = user_name

            result_messages.append(_virtual_message(
                group_chat_id=chat.id,
                character_id=char_id,
                character_name=char_name,
                character_avatar=char.avatar_url,
                content=emoji,
                role="reaction",
                delay_ms=delay_ms,
                reacting_to_message_id=react_target_id,
                reacting_to_char_name=react_target_name,
                user_message_id=user_msg.id,
            ))
            print(f"  {char_name}: reacts {emoji}")
            continue

        # ── ACTION: RESPOND ───────────────────────────────────────────────

        # Resolve reply target
        target_orm = None
        r_char_id = r_char_name = r_preview = None

        if reply_to.startswith("char:"):
            try:
                target_id = int(reply_to.split(":")[1])
                target_orm = this_turn_orm.get(target_id)
                if target_orm:
                    r_char_id = target_id
                    r_char_name = name_map.get(target_id)
                    r_preview = target_orm.content[:120]
            except (ValueError, IndexError):
                pass

        # Build conversation history context
        lines = ["[Group Conversation History:]"]
        for m in history_snapshot[-20:]:
            label = "User" if m.role == "user" else name_map.get(m.character_id, "Character")
            lines.append(f"{label}: {_snippet(m.content)}")
        lines.append(f"{user_name}: {_snippet(body.content)}")

        # Add earlier responses from this turn
        for prev in result_messages:
            if prev.get("role") == "assistant":
                label = prev.get("character_name") or "Character"
                lines.append(f"{label}: {_snippet(prev['content'])}")

        # Role-specific context note
        if reply_to.startswith("char:") and r_preview:
            note = (
                f"\n[You are {char_name}. Address the user's message, "
                f"but also react to what {r_char_name} just added: \"{r_preview[:150]}\". "
                f"Stay natural and in character.]"
            )
        elif reply_to == "none":
            note = (
                f"\n[You are {char_name}. Share an unprompted thought natural "
                f"to your personality — not directly answering anyone.]"
            )
        else:
            note = f"\n[You are {char_name}. Respond to the user in character.]"

        lines.append(note)
        history_context = "\n".join(lines)

        # RAG context
        rag_context = await _retrieve_rag_context(chat.id, char.id, body.content)

        # Relationship context (feature 6)
        rel_context = await _get_relationships(chat.id, char.id, chat.participants)

        # System prompt
        system_prompt = build_system_prompt(
            character_description=char.description,
            user_name=user_name,
            char_name=char_name,
            is_private=False,
            mode=mode,
            time_context=time_context,
        )
        extras = [p for p in [rag_context, rel_context, history_context] if p]
        system_prompt = system_prompt + "\n\n" + "\n\n".join(extras)

        # Gemini call
        try:
            gemini_chat = _client.aio.chats.create(
                model=settings.ai_model,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=settings.ai_temperature,
                    top_p=settings.ai_top_p,
                    max_output_tokens=settings.ai_max_tokens,
                ),
                history=[],
            )
            response = await gemini_chat.send_message(f"[Respond as {char_name} now.]")
            response_text = response.text.strip()
            response_text = replace_placeholders(response_text, user_name, char_name)
            if mode == "normal":
                response_text = extract_dialogue(response_text, char_name)
            if not response_text:
                response_text = "..."
        except Exception as e:
            traceback.print_exc()
            err = str(e).lower()
            if any(k in err for k in ["blocked", "safety", "harm_category"]):
                response_text = f"*{char_name} stays silent.*"
            else:
                response_text = f"*{char_name} is lost in thought...*"

        # Save to DB
        ai_msg = GroupMessage(
            group_chat_id=chat.id,
            character_id=char.id,
            content=response_text,
            role="assistant",
            responding_to_message_id=target_orm.id if target_orm else None,
        )
        db.add(ai_msg)
        db.commit()
        db.refresh(ai_msg)

        # Index with enhanced metadata
        if settings.rag_enabled:
            await _index_message(
                chat.id, char.id, response_text, "assistant", ai_msg.id,
                turn_number=turn_number,
                addressed_to=addressed_to,
                responding_to=reply_to,
            )

        this_turn_orm[char_id] = ai_msg
        this_turn_texts[char_id] = response_text

        result_messages.append(_serialize_message(
            ai_msg,
            delay_ms=delay_ms,
            responding_to_char_id=r_char_id,
            responding_to_char_name=r_char_name,
            responding_to_preview=r_preview,
            interrupt=is_interrupt,
            user_message_id=user_msg.id,
        ))

    # ── 5. Update relationships (feature 6) ───────────────────────────────
    if len(this_turn_texts) >= 2:
        try:
            await _update_relationships(chat.id, this_turn_texts, chat.participants)
        except Exception as e:
            print(f"[Relationships] Post-turn update failed: {e}")

    chat.updated_at = datetime.utcnow()
    db.commit()
    return result_messages
