from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Chat, Message, Character, User
from ..schemas import (
    Chat as ChatSchema,
    ChatCreate,
    ChatSummary,
    Message as MessageSchema,
    MessageCreate,
    ChatMessage
)
from ..auth import get_current_user
from ..ai.chat import generate_response, generate_chat_title
from ..ai.prompts import replace_placeholders
from ..config import get_settings
from ..rag.memory import MemoryManager, ensure_chat_indexed
from ..rag.retriever import ContextRetriever, format_context_for_prompt

settings = get_settings()
router = APIRouter(prefix="/chats", tags=["chats"])


@router.get("", response_model=List[ChatSummary])
async def list_chats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all chats for the current user"""
    chats = db.query(Chat).filter(Chat.user_id == current_user.id).order_by(Chat.updated_at.desc()).all()
    
    result = []
    for chat in chats:
        last_message = chat.messages[-1].content if chat.messages else None
        result.append(ChatSummary(
            id=chat.id,
            title=chat.title,
            character_id=chat.character_id,
            character_name=chat.character.name,
            character_avatar=chat.character.avatar_url,
            created_at=chat.created_at,
            updated_at=chat.updated_at,
            last_message=last_message[:100] if last_message else None
        ))
    
    return result


@router.post("", response_model=ChatSchema)
async def create_chat(
    chat_data: ChatCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new chat with a character"""
    # Verify character exists
    character = db.query(Character).filter(Character.id == chat_data.character_id).first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    # Create chat
    chat = Chat(
        title=chat_data.title or f"Chat with {character.name}",
        user_id=current_user.id,
        character_id=chat_data.character_id
    )
    db.add(chat)
    db.commit()
    db.refresh(chat)
    
    # Add greeting message if character has one
    if character.greeting:
        # Replace {{user}} and {{char}} placeholders in greeting
        user_name = current_user.username or current_user.email
        greeting_content = replace_placeholders(
            character.greeting,
            user_name=user_name,
            char_name=character.name
        )
        greeting_msg = Message(
            chat_id=chat.id,
            content=greeting_content,
            role="assistant"
        )
        db.add(greeting_msg)
        db.commit()
        db.refresh(chat)
    
    return chat


@router.get("/{chat_id}", response_model=ChatSchema)
async def get_chat(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific chat with all messages"""
    try:
        chat = db.query(Chat).filter(
            Chat.id == chat_id,
            Chat.user_id == current_user.id
        ).first()
        
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Process messages to replace {{user}} and {{char}} placeholders
        user_name = current_user.username or current_user.email
        char_name = chat.character.name
        
        # Create response data without modifying ORM objects
        chat_dict = {
            "id": chat.id,
            "title": chat.title,
            "character_id": chat.character_id,
            "user_id": chat.user_id,
            "notes": chat.notes,
            "created_at": chat.created_at,
            "updated_at": chat.updated_at,
            "character": chat.character,
            "messages": [
                {
                    "id": msg.id,
                    "chat_id": msg.chat_id,
                    "content": replace_placeholders(msg.content, user_name, char_name),
                    "role": msg.role,
                    "created_at": msg.created_at
                }
                for msg in chat.messages
            ]
        }
        
        return chat_dict
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{chat_id}")
async def delete_chat(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a chat and all its messages (including Pinecone vectors)"""
    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        Chat.user_id == current_user.id
    ).first()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Clean up Pinecone vectors for this chat
    if settings.rag_enabled:
        try:
            memory_manager = MemoryManager(db)
            await memory_manager.delete_chat_memory(chat_id)
        except Exception as e:
            print(f"Error deleting Pinecone vectors for chat {chat_id}: {e}")
    
    db.delete(chat)
    db.commit()
    
    return {"message": "Chat deleted"}


@router.post("/{chat_id}/messages", response_model=MessageSchema)
async def send_message(
    chat_id: int,
    message_data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send a message and get AI response with RAG-enhanced context"""
    # Get chat
    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        Chat.user_id == current_user.id
    ).first()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Get user and character names for placeholder replacement
    user_name = current_user.username or current_user.email
    char_name = chat.character.name
    
    # Build time context from the user's browser
    time_context = None
    if message_data.timezone or message_data.formatted_time:
        time_context = {
            "timezone": message_data.timezone,
            "formatted_time": message_data.formatted_time,
            "formatted_date": message_data.formatted_date,
        }
    
    # === RAG: Retrieve relevant context ===
    rag_context = None
    if settings.rag_enabled:
        try:
            # Ensure chat is indexed
            await ensure_chat_indexed(db, chat_id)
            
            # Get relevant context using semantic search
            retriever = ContextRetriever(db)
            context = await retriever.get_context(
                chat_id=chat_id,
                user_message=message_data.content,
                user_name=user_name,
                char_name=char_name
            )
            
            # Format context for the prompt
            rag_context = format_context_for_prompt(context)
            
            # Use combined messages (RAG + recent) for chat history
            chat_history = context.combined_messages
        except Exception as e:
            print(f"RAG retrieval error (falling back to recent history): {e}")
            # Fallback to traditional recent history
            chat_history = [
                ChatMessage(
                    role=msg.role, 
                    content=replace_placeholders(msg.content, user_name, char_name)
                )
                for msg in chat.messages[-settings.max_messages_history:]
            ]
    else:
        # RAG disabled - use traditional recent history
        chat_history = [
            ChatMessage(
                role=msg.role, 
                content=replace_placeholders(msg.content, user_name, char_name)
            )
            for msg in chat.messages[-settings.max_messages_history:]
        ]
    
    # Save user message
    user_message = Message(
        chat_id=chat.id,
        content=message_data.content,
        role="user"
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)
    
    # === RAG: Index the user message ===
    if settings.rag_enabled:
        try:
            memory_manager = MemoryManager(db)
            await memory_manager.store_message(
                chat_id=chat_id,
                content=message_data.content,
                role="user",
                message_id=user_message.id
            )
        except Exception as e:
            print(f"RAG indexing error for user message: {e}")
    
    # Generate AI response with RAG context
    try:
        ai_response_text = await generate_response(
            user_message=message_data.content,
            character_description=chat.character.description,
            chat_history=chat_history,
            user_name=user_name,
            character_name=char_name,
            mode=message_data.mode or "descriptive",
            rag_context=rag_context,
            time_context=time_context,
        )
    except Exception as e:
        # Rollback user message if AI fails
        db.delete(user_message)
        db.commit()
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")
    
    # Save AI response
    ai_message = Message(
        chat_id=chat.id,
        content=ai_response_text,
        role="assistant"
    )
    db.add(ai_message)
    db.commit()
    db.refresh(ai_message)
    
    # === RAG: Index the AI response ===
    if settings.rag_enabled:
        try:
            memory_manager = MemoryManager(db)
            await memory_manager.store_message(
                chat_id=chat_id,
                content=ai_response_text,
                role="assistant",
                message_id=ai_message.id
            )
        except Exception as e:
            print(f"RAG indexing error for AI message: {e}")
    
    # Update chat title if it's the first real message
    if len(chat.messages) <= 2 and not chat.title.startswith("Chat with"):
        pass  # Title already set
    elif len(chat.messages) == 2:  # First user message + greeting
        try:
            new_title = await generate_chat_title(
                message_data.content,
                chat.character.name
            )
            chat.title = new_title
            db.commit()
        except Exception:
            pass  # Keep default title
    
    return ai_message


@router.get("/{chat_id}/messages", response_model=List[MessageSchema])
async def get_messages(
    chat_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get messages for a chat with pagination"""
    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        Chat.user_id == current_user.id
    ).first()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    messages = db.query(Message).filter(
        Message.chat_id == chat_id
    ).order_by(Message.created_at).offset(skip).limit(limit).all()
    
    return messages


@router.get("/{chat_id}/rag-stats")
async def get_rag_stats(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get RAG/memory statistics for a chat"""
    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        Chat.user_id == current_user.id
    ).first()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if not settings.rag_enabled:
        return {
            "rag_enabled": False,
            "message": "RAG is disabled"
        }
    
    try:
        memory_manager = MemoryManager(db)
        stats = memory_manager.get_memory_stats(chat_id)
        return {
            "rag_enabled": True,
            **stats
        }
    except Exception as e:
        return {
            "rag_enabled": True,
            "error": str(e)
        }


@router.post("/{chat_id}/reindex")
async def reindex_chat(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Force reindex all messages in a chat for RAG"""
    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        Chat.user_id == current_user.id
    ).first()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if not settings.rag_enabled:
        return {
            "success": False,
            "message": "RAG is disabled"
        }
    
    try:
        memory_manager = MemoryManager(db)
        # Delete existing index
        await memory_manager.delete_chat_memory(chat_id)
        # Reindex all messages
        count = await memory_manager.index_existing_messages(chat_id)
        return {
            "success": True,
            "messages_indexed": count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reindex failed: {str(e)}")
