from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Character, Chat, GroupChatParticipant, GroupMessage, Lorebook
from ..schemas import Character as CharacterSchema, CharacterCreate
from ..auth import get_current_user
from ..models import User
from ..ai.prompts import DEFAULT_CHARACTERS
from ..config import get_settings
from ..rag.memory import MemoryManager

settings = get_settings()
router = APIRouter(prefix="/characters", tags=["characters"])


def seed_default_characters(db: Session):
    """Seed default characters if they don't exist"""
    existing = db.query(Character).filter(Character.is_default == True).first()
    if existing:
        return

    for char_data in DEFAULT_CHARACTERS:
        character = Character(
            name=char_data["name"],
            description=char_data["description"],
            greeting=char_data.get("greeting"),
            avatar_url=char_data.get("avatar_url"),
            is_default=True
        )
        db.add(character)
    db.commit()


def _validate_lorebook(db: Session, lorebook_id: int, user: User):
    """Ensure the lorebook exists and belongs to the user."""
    lorebook = db.query(Lorebook).filter(
        Lorebook.id == lorebook_id,
        Lorebook.user_id == user.id
    ).first()
    if not lorebook:
        raise HTTPException(status_code=404, detail="Lorebook not found")


@router.get("", response_model=List[CharacterSchema])
async def list_characters(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all available characters.
    Returns default characters and user's custom characters.
    """
    # Seed default characters if needed
    seed_default_characters(db)

    # Get default characters + user's custom characters
    characters = db.query(Character).filter(
        (Character.is_default == True) |
        (Character.created_by_id == current_user.id)
    ).all()

    return characters


@router.get("/{character_id}", response_model=CharacterSchema)
async def get_character(
    character_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific character by ID"""
    character = db.query(Character).filter(Character.id == character_id).first()

    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    # Check access - default characters are public, custom ones are private
    if not character.is_default and character.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return character


@router.post("", response_model=CharacterSchema)
async def create_character(
    character_data: CharacterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a custom character"""
    if character_data.lorebook_id is not None:
        _validate_lorebook(db, character_data.lorebook_id, current_user)

    character = Character(
        name=character_data.name,
        description=character_data.description,
        greeting=character_data.greeting,
        avatar_url=character_data.avatar_url,
        lorebook_id=character_data.lorebook_id,
        is_default=False,
        created_by_id=current_user.id
    )

    db.add(character)
    db.commit()
    db.refresh(character)

    return character


@router.put("/{character_id}", response_model=CharacterSchema)
async def update_character(
    character_id: int,
    character_data: CharacterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a custom character (e.g. to attach a lorebook)"""
    character = db.query(Character).filter(Character.id == character_id).first()

    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    if character.is_default:
        raise HTTPException(status_code=403, detail="Cannot edit default characters")
    if character.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if character_data.lorebook_id is not None:
        _validate_lorebook(db, character_data.lorebook_id, current_user)

    character.name = character_data.name
    character.description = character_data.description
    character.greeting = character_data.greeting
    character.avatar_url = character_data.avatar_url
    character.lorebook_id = character_data.lorebook_id

    db.commit()
    db.refresh(character)
    return character


@router.delete("/{character_id}")
async def delete_character(
    character_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a custom character (not default ones)"""
    character = db.query(Character).filter(Character.id == character_id).first()

    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    if character.is_default:
        raise HTTPException(status_code=403, detail="Cannot delete default characters")

    if character.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Clean up dependent rows first. SQLite doesn't enforce FKs by default,
    # so without this, chats keep a dangling character_id and GET /chats
    # crashes with a 500 when it dereferences chat.character.
    dependent_chats = db.query(Chat).filter(Chat.character_id == character_id).all()
    for chat in dependent_chats:
        if settings.rag_enabled:
            try:
                await MemoryManager(db).delete_chat_memory(chat.id)
            except Exception as e:
                print(f"Error deleting Pinecone vectors for chat {chat.id}: {e}")
        db.delete(chat)  # cascades to messages

    # Remove from group chats; keep their past messages but detach the author
    db.query(GroupChatParticipant).filter(
        GroupChatParticipant.character_id == character_id
    ).delete(synchronize_session=False)
    db.query(GroupMessage).filter(
        GroupMessage.character_id == character_id
    ).update({GroupMessage.character_id: None}, synchronize_session=False)

    db.delete(character)
    db.commit()

    return {"message": "Character deleted"}
