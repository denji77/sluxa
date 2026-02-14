"""
Pinecone Vector Store for similarity search.
Uses a single Pinecone index with per-chat namespaces.
"""

import numpy as np
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime

from pinecone import Pinecone

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


class PineconeVectorStore:
    """
    Manages vector embeddings via Pinecone.
    Each chat uses its own namespace inside a single Pinecone index.
    """

    def __init__(self):
        pc = Pinecone(api_key=settings.pinecone_api_key)
        self._index = pc.Index(settings.pinecone_index_name)

    @staticmethod
    def _namespace(chat_id: int) -> str:
        """Namespace string for a chat."""
        return f"chat_{chat_id}"

    @staticmethod
    def _vector_id(message_id: int) -> str:
        """Pinecone vector ID for a message."""
        return f"msg_{message_id}"

    # ------------------------------------------------------------------ #
    #  Write
    # ------------------------------------------------------------------ #

    def add_message(
        self,
        chat_id: int,
        message_id: int,
        content: str,
        role: str,
        embedding: np.ndarray,
        created_at: Optional[datetime] = None,
    ) -> bool:
        """
        Upsert a message embedding into Pinecone.

        Args:
            chat_id: The chat this message belongs to
            message_id: Unique message ID
            content: Message content (for metadata)
            role: 'user' or 'assistant'
            embedding: The embedding vector
            created_at: When the message was created

        Returns:
            True if successful
        """
        try:
            vec = embedding.astype(np.float32).flatten().tolist()

            # Pinecone rejects all-zero vectors
            if all(v == 0.0 for v in vec):
                print(f"Skipping msg_{message_id}: zero vector (embedding failed)")
                return False

            metadata = {
                "message_id": message_id,
                "chat_id": chat_id,
                "role": role,
                "content_preview": (content[:100] if content else ""),
                "created_at": (
                    created_at.isoformat()
                    if created_at
                    else datetime.utcnow().isoformat()
                ),
            }

            self._index.upsert(
                vectors=[(self._vector_id(message_id), vec, metadata)],
                namespace=self._namespace(chat_id),
            )
            return True

        except Exception as e:
            print(f"Error adding message to Pinecone: {e}")
            return False

    # ------------------------------------------------------------------ #
    #  Read / Search
    # ------------------------------------------------------------------ #

    def search(
        self,
        chat_id: int,
        query_embedding: np.ndarray,
        top_k: int = 5,
        threshold: float = 0.0,
    ) -> List[Tuple[MessageMetadata, float]]:
        """
        Search for similar messages in a chat namespace.

        Args:
            chat_id: The chat to search in
            query_embedding: The query embedding vector
            top_k: Number of results to return
            threshold: Minimum similarity score

        Returns:
            List of (metadata, similarity_score) tuples
        """
        try:
            vec = query_embedding.astype(np.float32).flatten().tolist()

            response = self._index.query(
                vector=vec,
                top_k=top_k,
                namespace=self._namespace(chat_id),
                include_metadata=True,
            )

            results: List[Tuple[MessageMetadata, float]] = []
            for match in response.get("matches", []):
                score = match["score"]
                if score < threshold:
                    continue
                m = match["metadata"]
                meta = MessageMetadata(
                    message_id=int(m["message_id"]),
                    chat_id=int(m["chat_id"]),
                    role=m["role"],
                    content_preview=m.get("content_preview", ""),
                    created_at=m.get("created_at", ""),
                )
                results.append((meta, float(score)))

            return results

        except Exception as e:
            print(f"Error searching Pinecone: {e}")
            return []

    def get_memories(self, chat_id: int) -> List[MessageMetadata]:
        """
        Get all stored memories for a chat by listing vectors in the namespace.

        Returns:
            List of MessageMetadata objects
        """
        try:
            ns = self._namespace(chat_id)
            all_ids: List[str] = []

            # Paginate through list results
            for page in self._index.list(namespace=ns):
                all_ids.extend(page)

            if not all_ids:
                return []

            # Fetch metadata in batches of 100 (Pinecone limit)
            memories: List[MessageMetadata] = []
            for i in range(0, len(all_ids), 100):
                batch = all_ids[i : i + 100]
                fetched = self._index.fetch(ids=batch, namespace=ns)
                for _vid, vec_data in fetched.get("vectors", {}).items():
                    m = vec_data.get("metadata", {})
                    memories.append(
                        MessageMetadata(
                            message_id=int(m["message_id"]),
                            chat_id=int(m["chat_id"]),
                            role=m["role"],
                            content_preview=m.get("content_preview", ""),
                            created_at=m.get("created_at", ""),
                        )
                    )

            # Sort by created_at for consistent ordering
            memories.sort(key=lambda x: x.created_at)
            return memories

        except Exception as e:
            print(f"Error listing Pinecone memories: {e}")
            return []

    def get_index_stats(self, chat_id: int) -> Dict:
        """
        Get statistics about a chat's namespace.

        Returns:
            Dictionary with index statistics
        """
        try:
            stats = self._index.describe_index_stats()
            ns = self._namespace(chat_id)
            ns_stats = stats.get("namespaces", {}).get(ns, {})
            total_vectors = ns_stats.get("vector_count", 0)

            # For user/assistant breakdown we need metadata —
            # only fetch if count is small enough to be practical.
            user_msgs = 0
            assistant_msgs = 0
            if 0 < total_vectors <= 500:
                memories = self.get_memories(chat_id)
                user_msgs = sum(1 for m in memories if m.role == "user")
                assistant_msgs = sum(1 for m in memories if m.role == "assistant")

            return {
                "chat_id": chat_id,
                "total_vectors": total_vectors,
                "total_metadata": total_vectors,
                "dimensions": settings.embedding_dimensions,
                "user_messages": user_msgs,
                "assistant_messages": assistant_msgs,
            }

        except Exception as e:
            print(f"Error getting Pinecone stats: {e}")
            return {
                "chat_id": chat_id,
                "total_vectors": 0,
                "total_metadata": 0,
                "dimensions": settings.embedding_dimensions,
                "user_messages": 0,
                "assistant_messages": 0,
            }

    # ------------------------------------------------------------------ #
    #  Delete
    # ------------------------------------------------------------------ #

    def delete_message(self, chat_id: int, message_id: int) -> bool:
        """
        Delete a single message vector from Pinecone.

        Args:
            chat_id: The chat containing the message
            message_id: The message to remove

        Returns:
            True if successful
        """
        try:
            self._index.delete(
                ids=[self._vector_id(message_id)],
                namespace=self._namespace(chat_id),
            )
            return True
        except Exception as e:
            print(f"Error deleting message from Pinecone: {e}")
            return False

    def delete_chat_index(self, chat_id: int) -> bool:
        """
        Delete all vectors for a chat (wipe the namespace).

        Args:
            chat_id: The chat to delete

        Returns:
            True if successful
        """
        try:
            self._index.delete(
                delete_all=True,
                namespace=self._namespace(chat_id),
            )
            return True
        except Exception as e:
            # "Namespace not found" is fine — nothing to delete
            if "Namespace not found" in str(e):
                return True
            print(f"Error deleting Pinecone namespace: {e}")
            return False

    # ------------------------------------------------------------------ #
    #  No-ops (kept for interface compatibility)
    # ------------------------------------------------------------------ #

    def save_index(self, chat_id: int) -> bool:
        """No-op — Pinecone persists automatically."""
        return True

    def rebuild_index_from_embeddings(
        self,
        chat_id: int,
        messages: List[Tuple[int, str, str, np.ndarray, datetime]],
    ) -> bool:
        """
        Rebuild by wiping the namespace and re-upserting all messages.

        Args:
            chat_id: The chat to rebuild
            messages: List of (message_id, content, role, embedding, created_at)

        Returns:
            True if successful
        """
        try:
            self.delete_chat_index(chat_id)
            for msg_id, content, role, embedding, created_at in messages:
                self.add_message(chat_id, msg_id, content, role, embedding, created_at)
            return True
        except Exception as e:
            print(f"Error rebuilding Pinecone index: {e}")
            return False


# ------------------------------------------------------------------ #
#  Global singleton
# ------------------------------------------------------------------ #

_vector_store: Optional[PineconeVectorStore] = None


def get_vector_store() -> PineconeVectorStore:
    """Get the global Pinecone vector store instance."""
    global _vector_store
    if _vector_store is None:
        _vector_store = PineconeVectorStore()
    return _vector_store
