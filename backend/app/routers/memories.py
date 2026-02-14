from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from ..database import get_db
from ..models import Message, Chat, User
from ..auth import get_current_user
from ..rag.vector_store import get_vector_store

router = APIRouter(prefix="/memories", tags=["memories"])

class MemoryItem(BaseModel):
    message_id: int
    content_preview: str
    role: str
    created_at: str

class ChatMemories(BaseModel):
    chat_id: int
    memories: List[MemoryItem]
    count: int

@router.get("/chat/{chat_id}", response_model=ChatMemories)
async def get_chat_memories(
    chat_id: int = Path(..., title="The ID of the chat"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all vector memories for a specific chat.
    Validates that the user owns the chat.
    """
    # Verify ownership
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == current_user.id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    vector_store = get_vector_store()
    memories = vector_store.get_memories(chat_id)
    
    return ChatMemories(
        chat_id=chat_id,
        memories=[
            MemoryItem(
                message_id=m.message_id,
                content_preview=m.content_preview,
                role=m.role,
                created_at=m.created_at
            ) for m in memories
        ],
        count=len(memories)
    )

@router.delete("/chat/{chat_id}/message/{message_id}")
async def delete_memory(
    chat_id: int = Path(..., title="The ID of the chat"),
    message_id: int = Path(..., title="The ID of the message to forget"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a specific memory vector.
    This removes it from the RAG context but keeps the actual message in the DB.
    Useful for removing 'bad memories' or hallucinations.
    """
    # Verify ownership
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == current_user.id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
        
    vector_store = get_vector_store()
    success = vector_store.delete_message(chat_id, message_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Memory not found")
        
    return {"status": "success", "message": "Memory deleted"}

@router.delete("/chat/{chat_id}/all")
async def clear_chat_memories(
    chat_id: int = Path(..., title="The ID of the chat"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Wipe all vector memories for a specific chat.
    """
    # Verify ownership
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == current_user.id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
        
    vector_store = get_vector_store()
    success = vector_store.delete_chat_index(chat_id)
    
    return {"status": "success", "message": "All memories cleared for this chat"}
