"""
RAG (Retrieval-Augmented Generation) module for semantic memory.
Uses Pinecone for vector similarity search.
"""

from .vector_store import PineconeVectorStore
from .memory import MemoryManager
from .retriever import ContextRetriever

__all__ = ['PineconeVectorStore', 'MemoryManager', 'ContextRetriever']
