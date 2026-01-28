from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Character
from ..schemas import Character as CharacterSchema, CharacterCreate
from ..auth import get_current_user
from ..models import User
from ..ai.prompts import DEFAULT_CHARACTERS

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
    character = Character(
        name=character_data.name,
        description=character_data.description,
        greeting=character_data.greeting,
        avatar_url=character_data.avatar_url,
        is_default=False,
        created_by_id=current_user.id
    )
    
    db.add(character)
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
    
    db.delete(character)
    db.commit()
    
    return {"message": "Character deleted"}
