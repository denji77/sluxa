from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from ..database import get_db
from ..models import Lorebook, LorebookEntry, User
from ..auth import get_current_user

router = APIRouter(prefix="/lorebooks", tags=["lorebooks"])

# Pydantic Schemas
class LorebookEntryCreate(BaseModel):
    keys: str  # Comma separated
    content: str
    is_enabled: bool = True

class LorebookEntrySchema(LorebookEntryCreate):
    id: int
    lorebook_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class LorebookCreate(BaseModel):
    name: str
    description: Optional[str] = None

class LorebookSchema(LorebookCreate):
    id: int
    user_id: int
    created_at: datetime
    entries: List[LorebookEntrySchema] = []
    
    class Config:
        from_attributes = True

# Routes

@router.post("", response_model=LorebookSchema)
async def create_lorebook(
    lorebook: LorebookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new lorebook"""
    db_lorebook = Lorebook(
        name=lorebook.name,
        description=lorebook.description,
        user_id=current_user.id
    )
    db.add(db_lorebook)
    db.commit()
    db.refresh(db_lorebook)
    return db_lorebook

@router.get("", response_model=List[LorebookSchema])
async def list_lorebooks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all lorebooks created by the user"""
    return db.query(Lorebook).filter(Lorebook.user_id == current_user.id).all()

@router.get("/{lorebook_id}", response_model=LorebookSchema)
async def get_lorebook(
    lorebook_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific lorebook"""
    lorebook = db.query(Lorebook).filter(
        Lorebook.id == lorebook_id, 
        Lorebook.user_id == current_user.id
    ).first()
    if not lorebook:
        raise HTTPException(status_code=404, detail="Lorebook not found")
    return lorebook

@router.post("/{lorebook_id}/entries", response_model=LorebookEntrySchema)
async def add_entry(
    lorebook_id: int,
    entry: LorebookEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add an entry to a lorebook"""
    lorebook = db.query(Lorebook).filter(
        Lorebook.id == lorebook_id, 
        Lorebook.user_id == current_user.id
    ).first()
    if not lorebook:
        raise HTTPException(status_code=404, detail="Lorebook not found")
        
    db_entry = LorebookEntry(
        lorebook_id=lorebook_id,
        keys=entry.keys,
        content=entry.content,
        is_enabled=entry.is_enabled
    )
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry

@router.put("/entries/{entry_id}", response_model=LorebookEntrySchema)
async def update_entry(
    entry_id: int,
    entry_update: LorebookEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a lorebook entry"""
    # Join to check ownership
    entry = db.query(LorebookEntry).join(Lorebook).filter(
        LorebookEntry.id == entry_id,
        Lorebook.user_id == current_user.id
    ).first()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
        
    entry.keys = entry_update.keys
    entry.content = entry_update.content
    entry.is_enabled = entry_update.is_enabled
    db.commit()
    db.refresh(entry)
    return entry

@router.delete("/entries/{entry_id}")
async def delete_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a lorebook entry"""
    entry = db.query(LorebookEntry).join(Lorebook).filter(
        LorebookEntry.id == entry_id,
        Lorebook.user_id == current_user.id
    ).first()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
        
    db.delete(entry)
    db.commit()
    return {"message": "Entry deleted"}
