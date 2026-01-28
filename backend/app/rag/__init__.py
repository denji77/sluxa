"""
RAG (Retrieval-Augmented Generation) module for semantic memory.
Uses FAISS for vector similarity search.
"""

from .vector_store import FAISSVectorStore
from .memory import MemoryManager
from .retriever import ContextRetriever

__all__ = ['FAISSVectorStore', 'MemoryManager', 'ContextRetriever']
