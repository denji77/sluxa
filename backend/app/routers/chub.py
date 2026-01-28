from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from ..models import Character, User
from ..schemas import Character as CharacterSchema
from ..auth import get_current_user
from ..chub import (
    search_chub_characters,
    get_chub_character,
    build_character_prompt,
    ChubCharacterSearchResult,
    ChubCharacterDetail
)

router = APIRouter(prefix="/chub", tags=["chub"])


@router.get("/search", response_model=List[ChubCharacterSearchResult])
async def search_characters(
    query: str = Query(default="", description="Search query"),
    page: int = Query(default=1, ge=1, description="Page number"),
    exclude_nsfw: bool = Query(default=True, description="Exclude NSFW content"),
    current_user: User = Depends(get_current_user)
):
    """
    Search for characters on Chub.ai
    """
    try:
        results = await search_chub_characters(
            query=query,
            page=page,
            exclude_nsfw=exclude_nsfw
        )
        return results
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to search Chub.ai: {str(e)}"
        )


@router.get("/character/{chub_id}", response_model=ChubCharacterDetail)
async def get_character_details(
    chub_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed character information from Chub.ai
    """
    try:
        character = await get_chub_character(chub_id)
        if not character:
            raise HTTPException(status_code=404, detail="Character not found")
        return character
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch character: {str(e)}"
        )


@router.post("/import/{chub_id}", response_model=CharacterSchema)
async def import_character(
    chub_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Import a character from Chub.ai into the local database
    """
    try:
        # Fetch character from Chub.ai
        chub_char = await get_chub_character(chub_id)
        if not chub_char:
            raise HTTPException(status_code=404, detail="Character not found on Chub.ai")
        
        # Build the full prompt from character data
        full_prompt = build_character_prompt(chub_char)
        
        # Get avatar URL from search (the detail endpoint doesn't include it)
        avatar_url = None
        try:
            search_results = await search_chub_characters(query=chub_char.name, page=1)
            for result in search_results:
                if result.id == chub_id:
                    avatar_url = result.avatar_url
                    break
        except Exception:
            pass  # Avatar is optional
        
        # Create local character
        character = Character(
            name=chub_char.name,
            description=full_prompt,
            greeting=chub_char.first_mes if chub_char.first_mes else None,
            avatar_url=avatar_url,
            is_default=False,
            created_by_id=current_user.id
        )
        
        db.add(character)
        db.commit()
        db.refresh(character)
        
        return character
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to import character: {str(e)}"
        )
