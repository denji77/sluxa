"""
Embedding generation using OpenAI's text-embedding API.
Used for semantic search in the RAG system.
"""

from openai import AsyncOpenAI
from typing import List, Optional
import numpy as np
from functools import lru_cache
import hashlib

from ..config import get_settings

settings = get_settings()

# Initialize OpenAI client
client = AsyncOpenAI(api_key=settings.openai_api_key)

# Cache for embeddings to avoid re-computing
_embedding_cache: dict = {}


def _get_cache_key(text: str) -> str:
    """Generate a cache key for text."""
    return hashlib.md5(text.encode()).hexdigest()


async def generate_embedding(text: str, use_cache: bool = True) -> np.ndarray:
    """
    Generate an embedding for a single text using OpenAI's embedding model.
    
    Args:
        text: The text to embed
        use_cache: Whether to use cached embeddings
    
    Returns:
        numpy array of the embedding vector
    """
    if not text or not text.strip():
        # Return zero vector for empty text
        return np.zeros(settings.embedding_dimensions, dtype=np.float32)
    
    # Check cache
    cache_key = _get_cache_key(text)
    if use_cache and cache_key in _embedding_cache:
        return _embedding_cache[cache_key]
    
    try:
        # Generate embedding using OpenAI's API
        response = await client.embeddings.create(
            model=settings.embedding_model,
            input=text
        )
        
        embedding = np.array(response.data[0].embedding, dtype=np.float32)
        
        # Cache the result
        if use_cache:
            _embedding_cache[cache_key] = embedding
        
        return embedding
        
    except Exception as e:
        print(f"Embedding generation error: {e}")
        # Return zero vector on error
        return np.zeros(settings.embedding_dimensions, dtype=np.float32)


async def generate_query_embedding(text: str) -> np.ndarray:
    """
    Generate an embedding optimized for query/search.
    OpenAI uses the same model for both, but we keep the interface consistent.
    
    Args:
        text: The query text to embed
    
    Returns:
        numpy array of the embedding vector
    """
    if not text or not text.strip():
        return np.zeros(settings.embedding_dimensions, dtype=np.float32)
    
    try:
        response = await client.embeddings.create(
            model=settings.embedding_model,
            input=text
        )
        
        return np.array(response.data[0].embedding, dtype=np.float32)
        
    except Exception as e:
        print(f"Query embedding generation error: {e}")
        return np.zeros(settings.embedding_dimensions, dtype=np.float32)


async def generate_embeddings_batch(texts: List[str], use_cache: bool = True) -> List[np.ndarray]:
    """
    Generate embeddings for multiple texts.
    OpenAI supports batch embedding in a single API call.
    
    Args:
        texts: List of texts to embed
        use_cache: Whether to use cached embeddings
    
    Returns:
        List of numpy arrays (embedding vectors)
    """
    embeddings = [None] * len(texts)
    texts_to_embed = []
    indices_to_embed = []
    
    # Check cache first
    for i, text in enumerate(texts):
        if not text or not text.strip():
            embeddings[i] = np.zeros(settings.embedding_dimensions, dtype=np.float32)
        else:
            cache_key = _get_cache_key(text)
            if use_cache and cache_key in _embedding_cache:
                embeddings[i] = _embedding_cache[cache_key]
            else:
                texts_to_embed.append(text)
                indices_to_embed.append(i)
    
    # Generate embeddings for uncached texts in a single batch call
    if texts_to_embed:
        try:
            response = await client.embeddings.create(
                model=settings.embedding_model,
                input=texts_to_embed
            )
            
            for j, (idx, text) in enumerate(zip(indices_to_embed, texts_to_embed)):
                embedding = np.array(response.data[j].embedding, dtype=np.float32)
                embeddings[idx] = embedding
                
                # Cache
                if use_cache:
                    cache_key = _get_cache_key(text)
                    _embedding_cache[cache_key] = embedding
                    
        except Exception as e:
            print(f"Batch embedding error: {e}")
            # Fill remaining with zeros
            for idx in indices_to_embed:
                if embeddings[idx] is None:
                    embeddings[idx] = np.zeros(settings.embedding_dimensions, dtype=np.float32)
    
    return embeddings


def clear_embedding_cache():
    """Clear the embedding cache."""
    global _embedding_cache
    _embedding_cache = {}


def get_cache_size() -> int:
    """Get the number of cached embeddings."""
    return len(_embedding_cache)
