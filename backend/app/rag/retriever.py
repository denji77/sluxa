"""
Context Retriever - Assembles relevant context for AI generation.
Combines RAG results with recent messages for optimal context.
"""

from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Message, Chat
from ..schemas import ChatMessage
from ..ai.embeddings import generate_query_embedding
from .vector_store import get_vector_store, MessageMetadata

settings = get_settings()


@dataclass
class RetrievedContext:
    """Context retrieved for AI generation."""
    relevant_messages: List[ChatMessage]  # Semantically similar past messages
    recent_messages: List[ChatMessage]    # Last N messages for recency
    combined_messages: List[ChatMessage]  # Deduplicated combination
    rag_enabled: bool
    retrieval_scores: Dict[int, float]    # message_id -> similarity score
    lorebook_context: List[str] = None    # World Info entries triggered by keywords


class ContextRetriever:
    """
    Retrieves relevant context for AI response generation.
    Combines semantic search (RAG) with recent message history.
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.vector_store = get_vector_store()
    
    async def get_context(
        self,
        chat_id: int,
        user_message: str,
        user_name: Optional[str] = None,
        char_name: Optional[str] = None
    ) -> RetrievedContext:
        """
        Get relevant context for generating an AI response.
        
        Args:
            chat_id: The chat to get context for
            user_message: The current user message (for semantic search)
            user_name: User's name for placeholder replacement
            char_name: Character's name for placeholder replacement
        
        Returns:
            RetrievedContext with relevant and recent messages
        """
        from ..ai.prompts import replace_placeholders
        
        # Get chat info for Lorebooks
        chat = self.db.query(Chat).filter(Chat.id == chat_id).first()
        
        # 0. Retrieve World Info (Lorebooks) - Injected as "System" context implicitly later
        # We need a way to return this string. For now, we will update the retrieved context model
        # or just append a special system message to relevant_messages
        lorebook_context = []
        if chat and chat.character and chat.character.lorebook:
            for entry in chat.character.lorebook.entries:
                if not entry.is_enabled:
                    continue
                # Check for keywords in user message (case-insensitive)
                keywords = [k.strip().lower() for k in entry.keys.split(",")]
                msg_lower = user_message.lower()
                
                # Check if ANY keyword is in the message
                for key in keywords:
                    if key and key in msg_lower:
                        lorebook_context.append(f"[World Info: {entry.content}]")
                        break
        
        # Get recent messages (always include for recency bias)
        recent_messages = self._get_recent_messages(
            chat_id,
            limit=settings.rag_recent_messages,
            user_name=user_name,
            char_name=char_name
        )
        
        # If RAG is disabled, just return recent messages
        if not settings.rag_enabled:
            return RetrievedContext(
                relevant_messages=[],
                recent_messages=recent_messages,
                combined_messages=recent_messages[:],
                rag_enabled=False,
                retrieval_scores={},
                lorebook_context=lorebook_context if lorebook_context else None
            )
        
        # Perform semantic search
        relevant_messages, scores = await self._semantic_search(
            chat_id,
            user_message,
            top_k=settings.rag_top_k,
            threshold=settings.rag_similarity_threshold,
            user_name=user_name,
            char_name=char_name
        )
        
        # Combine and deduplicate
        combined = self._combine_context(
            relevant_messages,
            recent_messages,
            scores
        )
        
        return RetrievedContext(
            relevant_messages=relevant_messages,
            recent_messages=recent_messages,
            combined_messages=combined,
            rag_enabled=True,
            retrieval_scores=scores,
            lorebook_context=lorebook_context if lorebook_context else None
        )
    
    def _get_recent_messages(
        self,
        chat_id: int,
        limit: int,
        user_name: Optional[str] = None,
        char_name: Optional[str] = None
    ) -> List[ChatMessage]:
        """Get the most recent messages from the chat."""
        from ..ai.prompts import replace_placeholders
        
        messages = self.db.query(Message).filter(
            Message.chat_id == chat_id
        ).order_by(Message.created_at.desc()).limit(limit).all()
        
        # Reverse to get chronological order
        messages = list(reversed(messages))
        
        return [
            ChatMessage(
                role=msg.role,
                content=replace_placeholders(msg.content, user_name, char_name)
            )
            for msg in messages
        ]
    
    async def _semantic_search(
        self,
        chat_id: int,
        query: str,
        top_k: int,
        threshold: float,
        user_name: Optional[str] = None,
        char_name: Optional[str] = None
    ) -> Tuple[List[ChatMessage], Dict[int, float]]:
        """
        Perform semantic search for relevant messages.
        
        Returns:
            Tuple of (messages, scores_dict)
        """
        from ..ai.prompts import replace_placeholders
        
        try:
            # Generate query embedding
            query_embedding = await generate_query_embedding(query)
            
            # Search vector store
            results = self.vector_store.search(
                chat_id=chat_id,
                query_embedding=query_embedding,
                top_k=top_k,
                threshold=threshold
            )
            
            if not results:
                return [], {}
            
            # Get full message content from database
            message_ids = [meta.message_id for meta, _ in results]
            messages_db = self.db.query(Message).filter(
                Message.id.in_(message_ids)
            ).all()
            
            # Create lookup
            message_lookup = {msg.id: msg for msg in messages_db}
            
            # Build results
            messages = []
            scores = {}
            
            for meta, score in results:
                if meta.message_id in message_lookup:
                    msg = message_lookup[meta.message_id]
                    messages.append(ChatMessage(
                        role=msg.role,
                        content=replace_placeholders(msg.content, user_name, char_name)
                    ))
                    scores[meta.message_id] = score
            
            return messages, scores
            
        except Exception as e:
            print(f"Semantic search error: {e}")
            return [], {}
    
    def _combine_context(
        self,
        relevant: List[ChatMessage],
        recent: List[ChatMessage],
        scores: Dict[int, float]
    ) -> List[ChatMessage]:
        """
        Combine relevant and recent messages, removing duplicates.
        Prioritizes recent messages for duplicates.
        
        Strategy:
        1. Start with relevant messages (sorted by score)
        2. Add recent messages that aren't duplicates
        3. Ensure chronological ordering for the final context
        """
        # Simple deduplication based on content
        seen_content = set()
        combined = []
        
        # Add relevant messages first (they're semantically important)
        for msg in relevant:
            content_key = msg.content[:100]  # Use first 100 chars as key
            if content_key not in seen_content:
                seen_content.add(content_key)
                combined.append(msg)
        
        # Add recent messages (for recency)
        for msg in recent:
            content_key = msg.content[:100]
            if content_key not in seen_content:
                seen_content.add(content_key)
                combined.append(msg)
        
        return combined


def format_context_for_prompt(context: RetrievedContext) -> str:
    """
    Format retrieved context for inclusion in the AI system prompt.
    Includes both RAG memories and Lorebook (World Info) entries.
    
    Args:
        context: The retrieved context
    
    Returns:
        Formatted string for the system prompt
    """
    sections = []
    
    # 1. Lorebook / World Info (always include if present)
    if context.lorebook_context:
        sections.append("[World Info / Lore:]")
        for entry in context.lorebook_context:
            # Strip the [World Info: ...] wrapper if present for cleaner injection
            clean = entry.replace("[World Info: ", "").rstrip("]")
            sections.append(f"- {clean}")
        sections.append("[End of World Info. Treat these facts as established canon.]")
    
    # 2. RAG memories
    if context.rag_enabled and context.relevant_messages:
        sections.append("[Relevant past conversation context:]")
        for msg in context.relevant_messages[:5]:  # Limit to 5 for prompt size
            role_label = "User" if msg.role == "user" else "Character"
            content = msg.content[:500] + "..." if len(msg.content) > 500 else msg.content
            sections.append(f"{role_label}: {content}")
        sections.append("[End of past context. Continue the conversation naturally.]")
    
    return "\n".join(sections) if sections else ""
