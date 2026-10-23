"""
Proactive Messaging Scheduler.

Characters text FIRST after a period of user inactivity — like real people do.
Runs as an asyncio background loop inside the FastAPI process:

  - DMs: the character sends an unprompted, context-based message.
  - Group chats: one character breaks the silence, then other participants
    may "intercept" and reply to each other in a chain. More participants
    means longer chains.

Every proactive burst also creates AppNotification rows, which the mobile
app's background task polls to fire local phone notifications.

Anti-spam rules:
  - A chat only qualifies after `proactive_min_idle_minutes` of silence,
    escalating each time a proactive text goes unanswered.
  - Hard cap on consecutive unanswered proactive messages per chat.
  - Chats idle for more than `proactive_max_idle_days` are left alone.
  - A probability roll per cycle keeps timing unpredictable.
"""

import asyncio
import random
import traceback
from datetime import datetime, timedelta

from .config import get_settings
from .database import SessionLocal
from .models import (
    AppNotification,
    Chat,
    GroupChat,
    GroupMessage,
    Message,
)

settings = get_settings()


def _idle_phrase(delta: timedelta) -> str:
    """Human phrase for how long the chat has been quiet."""
    minutes = int(delta.total_seconds() // 60)
    if minutes < 90:
        return f"about {minutes} minutes"
    hours = minutes // 60
    if hours < 36:
        return f"about {hours} hours"
    return f"about {hours // 24} days"


def _trailing_proactive_count(messages: list) -> int:
    """
    Count unprompted (proactive/ambient) messages since the user's LAST
    message. Normal in-reply assistant messages don't reset the count —
    only the user speaking does. This is what makes characters go quiet
    after one unanswered burst until the user texts again.
    """
    count = 0
    for m in reversed(messages):
        if m.role == "user":
            break
        if m.role == "assistant" and getattr(m, "is_proactive", False):
            count += 1
    return count


def _notify(db, user_id: int, kind: str, chat_id: int, title: str, body: str):
    db.add(AppNotification(
        user_id=user_id,
        kind=kind,
        chat_id=chat_id,
        title=title[:200],
        body=body[:500],
    ))


# ═══════════════════════════════════════════════════════════════════════════
# DM proactive messages
# ═══════════════════════════════════════════════════════════════════════════


async def _generate_dm_proactive(db, chat: Chat, idle: timedelta) -> bool:
    """Generate and save an unprompted DM from the character. Returns True on success."""
    from google.genai import types

    from .ai.chat import _client
    from .ai.prompts import build_system_prompt, replace_placeholders

    char = chat.character
    user = chat.user
    user_name = user.username or user.email or "User"

    recent = chat.messages[-12:]
    hist_lines = []
    for m in recent:
        label = user_name if m.role == "user" else char.name
        hist_lines.append(f"{label}: {m.content[:150]}")
    hist_block = "\n".join(hist_lines) if hist_lines else "(no messages yet)"

    prompt = (
        f"You are {char.name}, texting {user_name} in a private chat.\n"
        f"{user_name} has been quiet for {_idle_phrase(idle)} — they haven't replied "
        "or have been away. YOU are texting FIRST, unprompted, like a real person would.\n\n"
        f"Recent conversation:\n{hist_block}\n\n"
        "Write the message(s) you'd send. Based on the context, you might:\n"
        "- Follow up on something from the conversation\n"
        "- Share a random thought, or something that just 'happened' to you\n"
        "- Check in on them / miss them / tease them for disappearing\n"
        "- Continue an earlier topic you never finished\n\n"
        "GUIDELINES:\n"
        "- Keep it SHORT and casual, like real texting (1-3 short sentences total)\n"
        "- Stay fully in character — match your usual tone in this chat\n"
        "- Do NOT mention being an AI or that time has passed 'in the system'\n"
        "- To send two separate texts in a row, put a blank line between them"
    )

    system_prompt = build_system_prompt(
        character_description=char.description,
        user_name=user_name,
        char_name=char.name,
        is_private=True,
        mode="descriptive",
    )

    try:
        gemini_chat = _client.aio.chats.create(
            model=settings.ai_model,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.9,
                max_output_tokens=250,
            ),
            history=[],
        )
        response = await gemini_chat.send_message(prompt)
        text = (response.text or "").strip()
        text = replace_placeholders(text, user_name, char.name)
        if not text:
            return False
    except Exception as e:
        print(f"[Proactive DM] Generation failed for {char.name}: {e}")
        return False

    # Models sometimes emit the literal two-character sequence "\n" instead
    # of a real newline — normalize before splitting into double texts.
    text = text.replace("\\n", "\n")
    parts = [p.strip() for p in text.split("\n\n") if p.strip()][:2]
    if not parts:
        return False
    saved = []
    for part in parts:
        msg = Message(chat_id=chat.id, content=part, role="assistant", is_proactive=True)
        db.add(msg)
        db.commit()
        db.refresh(msg)
        saved.append(msg)

    # Best-effort RAG indexing so the character remembers what it said
    if settings.rag_enabled:
        try:
            from .rag.memory import MemoryManager
            manager = MemoryManager(db)
            for msg in saved:
                await manager.store_message(
                    chat_id=chat.id, content=msg.content,
                    role="assistant", message_id=msg.id,
                )
        except Exception as e:
            print(f"[Proactive DM] RAG indexing failed: {e}")

    chat.updated_at = datetime.utcnow()
    _notify(db, chat.user_id, "dm", chat.id, char.name, parts[0])
    db.commit()
    print(f"[Proactive DM] {char.name} -> {user_name}: \"{parts[0][:60]}\"")
    return True


# ═══════════════════════════════════════════════════════════════════════════
# Group proactive messages + interception chains
# ═══════════════════════════════════════════════════════════════════════════


def _personality_weight(description: str) -> int:
    from .routers.group_chat import _classify_personality
    label, _, _ = _classify_personality(description or "")
    return {"extrovert": 3, "ambivert": 2, "introvert": 1}[label]


async def _generate_group_line(
    char, participants, hist_lines: list, user_name: str,
    instruction: str,
) -> str:
    """One short in-character group-chat message. Returns '' on failure."""
    from google.genai import types

    from .ai.chat import _client
    from .ai.prompts import build_system_prompt, replace_placeholders

    prompt = (
        f"You are {char.name} in a group chat with: "
        + ", ".join(p.character.name for p in participants if p.character_id != char.id)
        + f" and {user_name} (a human, currently away/not responding).\n\n"
        f"Recent conversation:\n" + ("\n".join(hist_lines[-12:]) or "(quiet so far)") + "\n\n"
        + instruction + "\n\n"
        "GUIDELINES:\n"
        "- Keep it SHORT — 1-2 casual sentences, like real group-chat texting\n"
        "- Stay fully in character\n"
        "- Do NOT narrate or use asterisks unless that's your established style\n"
        "- Do NOT greet everyone formally; just drop the message naturally"
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
                temperature=0.9,
                max_output_tokens=300,
            ),
            history=[],
        )
        response = await gemini_chat.send_message(prompt)
        text = (response.text or "").strip().replace("\\n", "\n")
        # Group lines are single messages — collapse accidental double texts
        text = " ".join(p.strip() for p in text.split("\n\n") if p.strip())
        return replace_placeholders(text, user_name, char.name)
    except Exception as e:
        print(f"[Proactive Group] Generation failed for {char.name}: {e}")
        return ""


async def _generate_group_proactive(db, chat: GroupChat, idle: timedelta) -> bool:
    """
    One character breaks the silence; others may intercept and reply in a
    chain. Chain length scales with participant count. Returns True on success.
    """
    from .routers.group_chat import (
        _classify_personality,
        _fuzzy_match_character,
        _index_message,
    )

    participants = list(chat.participants)
    if not participants:
        return False

    user = chat.user
    user_name = user.username or user.email or "User"
    name_map = {p.character_id: p.character.name for p in participants}

    # History block from the last few real messages
    recent = chat.messages[-10:]
    hist_lines = []
    for m in recent:
        label = user_name if m.role == "user" else name_map.get(m.character_id, "?")
        hist_lines.append(f"{label}: {m.content[:120]}")

    # ── Pick the initiator: weight extroverts, prefer the recently quiet ──
    recent_speaker_ids = {m.character_id for m in recent if m.role == "assistant"}
    weights = []
    for p in participants:
        w = _personality_weight(p.character.description)
        if p.character_id not in recent_speaker_ids:
            w += 2
        weights.append(w)
    initiator = random.choices(participants, weights=weights, k=1)[0]

    idle_txt = _idle_phrase(idle)
    init_instruction = (
        f"The chat has been silent for {idle_txt}. YOU are breaking the silence, "
        "unprompted. Based on context you might: revive an earlier topic, share a "
        "random thought or something that 'just happened' to you, tease someone, "
        f"or wonder where {user_name} went."
    )

    text = await _generate_group_line(
        initiator.character, participants, hist_lines, user_name, init_instruction
    )
    if not text:
        return False

    turn_number = (
        db.query(GroupMessage)
        .filter(GroupMessage.group_chat_id == chat.id, GroupMessage.role == "user")
        .count()
    )

    async def _save(char_id: int, content: str, reply_to_id=None) -> GroupMessage:
        msg = GroupMessage(
            group_chat_id=chat.id,
            character_id=char_id,
            content=content,
            role="assistant",
            responding_to_message_id=reply_to_id,
            is_proactive=True,
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        if settings.rag_enabled:
            try:
                await _index_message(
                    chat.id, char_id, content, "assistant", msg.id,
                    turn_number=turn_number,
                    responding_to="none" if reply_to_id is None else "char",
                )
            except Exception as e:
                print(f"[Proactive Group] Index failed: {e}")
        return msg

    first_msg = await _save(initiator.character_id, text)
    hist_lines.append(f"{initiator.character.name}: {text[:120]}")
    total_saved = 1
    last_msg = first_msg
    last_speaker_id = initiator.character_id

    # ── Interception chain: others jump in and reply to each other ────────
    # More participants → bigger reply budget.
    others = [p for p in participants if p.character_id != initiator.character_id]
    max_chain = min(len(participants) + random.randint(0, 2), 7)
    chain_budget = random.randint(min(1, len(others)), max_chain) if others else 0

    for _ in range(chain_budget):
        # Someone directly mentioned in the last message is compelled to answer
        mentioned = _fuzzy_match_character(last_msg.content, participants)
        if mentioned and mentioned.character_id != last_speaker_id:
            replier = mentioned
        else:
            pool = [p for p in participants if p.character_id != last_speaker_id]
            if not pool:
                break
            pool_weights = [_personality_weight(p.character.description) for p in pool]
            replier = random.choices(pool, weights=pool_weights, k=1)[0]

        last_name = name_map.get(last_speaker_id, "someone")
        reply_instruction = (
            f"{last_name} just said: \"{last_msg.content[:150]}\"\n"
            f"Reply to {last_name} in character — react, banter, agree, argue, or "
            "take the topic somewhere new. The human is away, so this is just you "
            "all talking among yourselves."
        )
        reply_text = await _generate_group_line(
            replier.character, participants, hist_lines, user_name, reply_instruction
        )
        if not reply_text:
            continue  # generation hiccup — let another character try

        last_msg = await _save(replier.character_id, reply_text, reply_to_id=last_msg.id)
        hist_lines.append(f"{replier.character.name}: {reply_text[:120]}")
        last_speaker_id = replier.character_id
        total_saved += 1

        # Natural fade-out: each extra message is less likely
        if random.random() > 0.65:
            break

    chat.updated_at = datetime.utcnow()
    extra = f" (+{total_saved - 1} more)" if total_saved > 1 else ""
    _notify(
        db, chat.user_id, "group", chat.id,
        chat.title or "Group chat",
        f"{initiator.character.name}: {text[:120]}{extra}",
    )
    db.commit()
    print(
        f"[Proactive Group] '{chat.title}': {initiator.character.name} started, "
        f"{total_saved} message(s) total"
    )
    return True


# ═══════════════════════════════════════════════════════════════════════════
# Scheduler loop
# ═══════════════════════════════════════════════════════════════════════════


def _qualifies(messages: list, max_unanswered: int) -> "timedelta | None":
    """
    Shared gating: returns the idle timedelta if this chat should get a
    proactive message this cycle, else None.
    """
    if not messages:
        return None
    # Require an actual back-and-forth history (not just a greeting)
    user_msg_count = sum(1 for m in messages if m.role == "user")
    if user_msg_count < 2:
        return None

    now = datetime.utcnow()
    last = messages[-1]
    idle = now - last.created_at

    if idle > timedelta(days=settings.proactive_max_idle_days):
        return None  # dormant chat — let it rest

    trailing = _trailing_proactive_count(messages)
    if trailing >= max_unanswered:
        return None  # they're leaving us on read; stop double-texting

    # Escalating quiet period: each unanswered proactive text raises the bar
    threshold = timedelta(
        minutes=settings.proactive_min_idle_minutes * (1 + trailing)
    )
    if idle < threshold:
        return None

    if random.random() > settings.proactive_probability:
        return None  # not this cycle — keeps timing organic

    return idle


async def run_proactive_cycle():
    """One scan over all chats. Opens its own DB session."""
    db = SessionLocal()
    try:
        # ── DMs ───────────────────────────────────────────────────────────
        for chat in db.query(Chat).all():
            try:
                idle = _qualifies(list(chat.messages), settings.proactive_dm_max_unanswered)
                if idle:
                    await _generate_dm_proactive(db, chat, idle)
            except Exception:
                traceback.print_exc()
                db.rollback()

        # ── Group chats ───────────────────────────────────────────────────
        for gchat in db.query(GroupChat).all():
            try:
                idle = _qualifies(list(gchat.messages), settings.proactive_group_max_unanswered)
                if idle:
                    await _generate_group_proactive(db, gchat, idle)
            except Exception:
                traceback.print_exc()
                db.rollback()
    finally:
        db.close()


async def proactive_loop():
    """Forever loop started from FastAPI startup."""
    print(
        f"[Proactive] Scheduler started (every {settings.proactive_check_interval_s}s, "
        f"idle >= {settings.proactive_min_idle_minutes}min, "
        f"p={settings.proactive_probability})"
    )
    while True:
        await asyncio.sleep(settings.proactive_check_interval_s)
        try:
            await run_proactive_cycle()
        except Exception:
            traceback.print_exc()
