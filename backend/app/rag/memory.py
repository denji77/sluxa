"""
Memory Manager - Coordinates between SQLite and Pinecone for message storage.
Handles embedding generation and vector store updates.
"""

from typing import List, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Message, Chat
from ..ai.embeddings import generate_embedding, generate_embeddings_batch
from .vector_store import get_vector_store, PineconeVectorStore

settings = get_settings()


class MemoryManager:
    """
    Manages the memory layer for chat messages.
    Coordinates SQLite storage with Pinecone vector indexing.
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.vector_store = get_vector_store()
    
    async def store_message(
        self,
        chat_id: int,
        content: str,
        role: str,
        message_id: Optional[int] = None
    ) -> Optional[int]:
        """
        Store a message and its embedding.
        If message_id is provided, assumes message already exists in SQLite.
        
        Args:
            chat_id: The chat this message belongs to
            content: Message content
            role: 'user' or 'assistant'
            message_id: Existing message ID (if already in DB)
        
        Returns:
            The message ID if successful, None otherwise
        """
        if not settings.rag_enabled:
            return message_id
        
        try:
            # Generate embedding
            embedding = await generate_embedding(content)
            
            # Store in vector store
            self.vector_store.add_message(
                chat_id=chat_id,
                message_id=message_id,
                content=content,
                role=role,
                embedding=embedding,
                created_at=datetime.utcnow()
            )
            
            return message_id
            
        except Exception as e:
            print(f"Error storing message in memory: {e}")
            # Don't fail the whole operation if RAG fails
            return message_id
    
    async def index_existing_messages(self, chat_id: int) -> int:
        """
        Index all existing messages for a chat that don't have embeddings.
        Useful for migration or rebuilding indexes.
        
        Args:
            chat_id: The chat to index
        
        Returns:
            Number of messages indexed
        """
        if not settings.rag_enabled:
            return 0
        
        try:
            # Get all messages for the chat
            messages = self.db.query(Message).filter(
                Message.chat_id == chat_id
            ).order_by(Message.created_at).all()
            
            if not messages:
                return 0
            
            # Check what's already indexed
            stats = self.vector_store.get_index_stats(chat_id)
            indexed_count = stats.get('total_vectors', 0)
            
            if indexed_count >= len(messages):
                return 0  # Already fully indexed
            
            # Generate embeddings for messages not yet indexed
            # For simplicity, we'll rebuild the entire index
            contents = [msg.content for msg in messages]
            embeddings = await generate_embeddings_batch(contents)
            
            # Rebuild index
            message_data = [
                (msg.id, msg.content, msg.role, emb, msg.created_at)
                for msg, emb in zip(messages, embeddings)
            ]
            
            self.vector_store.rebuild_index_from_embeddings(chat_id, message_data)
            
            return len(messages)
            
        except Exception as e:
            print(f"Error indexing existing messages: {e}")
            return 0
    
    async def delete_chat_memory(self, chat_id: int) -> bool:
        """
        Delete all memory (vectors) for a chat.
        
        Args:
            chat_id: The chat to delete memory for
        
        Returns:
            True if successful
        """
        return self.vector_store.delete_chat_index(chat_id)
    
    def get_memory_stats(self, chat_id: int) -> dict:
        """
        Get memory statistics for a chat.
        
        Args:
            chat_id: The chat to get stats for
        
        Returns:
            Dictionary with memory statistics
        """
        return self.vector_store.get_index_stats(chat_id)


async def ensure_chat_indexed(db: Session, chat_id: int) -> bool:
    """
    Ensure a chat has its messages indexed in Pinecone.
    Called lazily when RAG is needed.
    
    Args:
        db: Database session
        chat_id: The chat to ensure is indexed
    
    Returns:
        True if indexed (or RAG disabled), False on error
    """
    if not settings.rag_enabled:
        return True
    
    try:
        vector_store = get_vector_store()
        stats = vector_store.get_index_stats(chat_id)
        
        # Check if index exists and has vectors
        if stats.get('total_vectors', 0) > 0:
            return True
        
        # Need to index
        manager = MemoryManager(db)
        count = await manager.index_existing_messages(chat_id)
        print(f"Indexed {count} messages for chat {chat_id}")
        
        return True
        
    except Exception as e:
        print(f"Error ensuring chat indexed: {e}")
        return False
