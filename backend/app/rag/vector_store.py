"""
FAISS Vector Store for efficient similarity search.
Manages per-chat FAISS indexes for message embeddings.
"""

import faiss
import numpy as np
import json
import os
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime

from ..config import get_settings

settings = get_settings()


@dataclass
class MessageMetadata:
    """Metadata for a stored message."""
    message_id: int
    chat_id: int
    role: str  # 'user' or 'assistant'
    content_preview: str  # First 100 chars for debugging
    created_at: str
    

class FAISSVectorStore:
    """
    Manages FAISS indexes for chat message embeddings.
    Each chat has its own index stored on disk.
    """
    
    def __init__(self):
        self.base_path = settings.faiss_index_path
        self._indexes: Dict[int, faiss.IndexFlatIP] = {}  # chat_id -> index
        self._metadata: Dict[int, List[MessageMetadata]] = {}  # chat_id -> metadata list
        os.makedirs(self.base_path, exist_ok=True)
    
    def _get_chat_dir(self, chat_id: int) -> str:
        """Get the directory path for a chat's index."""
        return os.path.join(self.base_path, f"chat_{chat_id}")
    
    def _get_index_path(self, chat_id: int) -> str:
        """Get the file path for a chat's FAISS index."""
        return os.path.join(self._get_chat_dir(chat_id), "index.faiss")
    
    def _get_metadata_path(self, chat_id: int) -> str:
        """Get the file path for a chat's metadata."""
        return os.path.join(self._get_chat_dir(chat_id), "metadata.json")
    
    def _ensure_index(self, chat_id: int) -> faiss.IndexFlatIP:
        """
        Ensure an index exists for the chat, loading from disk or creating new.
        Uses Inner Product (IP) similarity - cosine similarity for normalized vectors.
        """
        if chat_id in self._indexes:
            return self._indexes[chat_id]
        
        index_path = self._get_index_path(chat_id)
        metadata_path = self._get_metadata_path(chat_id)
        
        if os.path.exists(index_path) and os.path.exists(metadata_path):
            # Load existing index
            try:
                self._indexes[chat_id] = faiss.read_index(index_path)
                with open(metadata_path, 'r') as f:
                    metadata_list = json.load(f)
                    self._metadata[chat_id] = [
                        MessageMetadata(**m) for m in metadata_list
                    ]
                return self._indexes[chat_id]
            except Exception as e:
                print(f"Error loading index for chat {chat_id}: {e}")
        
        # Create new index
        # Using IndexFlatIP (Inner Product) - works as cosine similarity for normalized vectors
        index = faiss.IndexFlatIP(settings.embedding_dimensions)
        self._indexes[chat_id] = index
        self._metadata[chat_id] = []
        
        # Create directory
        os.makedirs(self._get_chat_dir(chat_id), exist_ok=True)
        
        return index
    
    def add_message(
        self,
        chat_id: int,
        message_id: int,
        content: str,
        role: str,
        embedding: np.ndarray,
        created_at: Optional[datetime] = None
    ) -> bool:
        """
        Add a message embedding to the index.
        
        Args:
            chat_id: The chat this message belongs to
            message_id: Unique message ID
            content: Message content (for metadata)
            role: 'user' or 'assistant'
            embedding: The embedding vector (must be normalized for cosine similarity)
            created_at: When the message was created
        
        Returns:
            True if successful
        """
        try:
            index = self._ensure_index(chat_id)
            
            # Normalize embedding for cosine similarity via inner product
            embedding = embedding.astype(np.float32)
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm
            
            # Add to index
            embedding = embedding.reshape(1, -1)
            index.add(embedding)
            
            # Store metadata
            metadata = MessageMetadata(
                message_id=message_id,
                chat_id=chat_id,
                role=role,
                content_preview=content[:100] if content else "",
                created_at=created_at.isoformat() if created_at else datetime.utcnow().isoformat()
            )
            self._metadata[chat_id].append(metadata)
            
            # Auto-save after adding
            self.save_index(chat_id)
            
            return True
            
        except Exception as e:
            print(f"Error adding message to FAISS: {e}")
            return False
    
    def search(
        self,
        chat_id: int,
        query_embedding: np.ndarray,
        top_k: int = 5,
        threshold: float = 0.0
    ) -> List[Tuple[MessageMetadata, float]]:
        """
        Search for similar messages in the chat.
        
        Args:
            chat_id: The chat to search in
            query_embedding: The query embedding vector
            top_k: Number of results to return
            threshold: Minimum similarity score (0-1 for normalized vectors)
        
        Returns:
            List of (metadata, similarity_score) tuples, sorted by similarity
        """
        if chat_id not in self._indexes and not os.path.exists(self._get_index_path(chat_id)):
            return []
        
        try:
            index = self._ensure_index(chat_id)
            
            if index.ntotal == 0:
                return []
            
            # Normalize query embedding
            query_embedding = query_embedding.astype(np.float32)
            norm = np.linalg.norm(query_embedding)
            if norm > 0:
                query_embedding = query_embedding / norm
            
            query_embedding = query_embedding.reshape(1, -1)
            
            # Search
            k = min(top_k, index.ntotal)
            similarities, indices = index.search(query_embedding, k)
            
            # Build results
            results = []
            for i, (sim, idx) in enumerate(zip(similarities[0], indices[0])):
                if idx < 0 or idx >= len(self._metadata[chat_id]):
                    continue
                if sim >= threshold:
                    results.append((self._metadata[chat_id][idx], float(sim)))
            
            return results
            
        except Exception as e:
            print(f"Error searching FAISS index: {e}")
            return []
    
    def delete_message(self, chat_id: int, message_id: int) -> bool:
        """
        Remove a message from the index.
        Note: FAISS doesn't support direct deletion, so we rebuild the index.
        
        Args:
            chat_id: The chat containing the message
            message_id: The message to remove
        
        Returns:
            True if successful
        """
        if chat_id not in self._metadata:
            self._ensure_index(chat_id)
        
        if chat_id not in self._metadata:
            return False
        
        # Find and remove the message
        original_count = len(self._metadata[chat_id])
        self._metadata[chat_id] = [
            m for m in self._metadata[chat_id] if m.message_id != message_id
        ]
        
        if len(self._metadata[chat_id]) == original_count:
            return False  # Message not found
        
        # Note: To properly remove from FAISS, we'd need to rebuild the index
        # For now, we just mark it in metadata - the vector remains but is orphaned
        # A periodic cleanup job can rebuild indexes if needed
        
        self.save_index(chat_id)
        return True
    
    def delete_chat_index(self, chat_id: int) -> bool:
        """
        Delete all data for a chat.
        
        Args:
            chat_id: The chat to delete
        
        Returns:
            True if successful
        """
        try:
            # Remove from memory
            if chat_id in self._indexes:
                del self._indexes[chat_id]
            if chat_id in self._metadata:
                del self._metadata[chat_id]
            
            # Remove from disk
            chat_dir = self._get_chat_dir(chat_id)
            if os.path.exists(chat_dir):
                import shutil
                shutil.rmtree(chat_dir)
            
            return True
            
        except Exception as e:
            print(f"Error deleting chat index: {e}")
            return False
    
    def save_index(self, chat_id: int) -> bool:
        """
        Persist the index to disk.
        
        Args:
            chat_id: The chat index to save
        
        Returns:
            True if successful
        """
        if chat_id not in self._indexes:
            return False
        
        try:
            chat_dir = self._get_chat_dir(chat_id)
            os.makedirs(chat_dir, exist_ok=True)
            
            # Save FAISS index
            faiss.write_index(self._indexes[chat_id], self._get_index_path(chat_id))
            
            # Save metadata
            with open(self._get_metadata_path(chat_id), 'w') as f:
                json.dump([asdict(m) for m in self._metadata[chat_id]], f)
            
            return True
            
        except Exception as e:
            print(f"Error saving index: {e}")
            return False
    
    def get_index_stats(self, chat_id: int) -> Dict:
        """
        Get statistics about a chat's index.
        
        Args:
            chat_id: The chat to get stats for
        
        Returns:
            Dictionary with index statistics
        """
        index = self._ensure_index(chat_id)
        metadata = self._metadata.get(chat_id, [])
        
        return {
            "chat_id": chat_id,
            "total_vectors": index.ntotal,
            "total_metadata": len(metadata),
            "dimensions": settings.embedding_dimensions,
            "user_messages": len([m for m in metadata if m.role == "user"]),
            "assistant_messages": len([m for m in metadata if m.role == "assistant"]),
        }
    
    def rebuild_index_from_embeddings(
        self,
        chat_id: int,
        messages: List[Tuple[int, str, str, np.ndarray, datetime]]  # (id, content, role, embedding, created_at)
    ) -> bool:
        """
        Rebuild the entire index from scratch.
        Useful for migration or cleanup.
        
        Args:
            chat_id: The chat to rebuild
            messages: List of (message_id, content, role, embedding, created_at) tuples
        
        Returns:
            True if successful
        """
        try:
            # Delete existing
            self.delete_chat_index(chat_id)
            
            # Add all messages
            for msg_id, content, role, embedding, created_at in messages:
                self.add_message(chat_id, msg_id, content, role, embedding, created_at)
            
            return True
            
        except Exception as e:
            print(f"Error rebuilding index: {e}")
            return False


# Global instance
_vector_store: Optional[FAISSVectorStore] = None


def get_vector_store() -> FAISSVectorStore:
    """Get the global vector store instance."""
    global _vector_store
    if _vector_store is None:
        _vector_store = FAISSVectorStore()
    return _vector_store
