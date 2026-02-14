"""
Embedding generation using Google Gemini (google.genai SDK).
Used for semantic search in the RAG system.
"""

from google import genai
from google.genai import types
from typing import List, Optional
import numpy as np
import hashlib

from ..config import get_settings

settings = get_settings()

# Initialize Gemini client
_client = genai.Client(api_key=settings.google_api_key)

# Cache for embeddings to avoid re-computing
_embedding_cache: dict = {}


def _get_cache_key(text: str) -> str:
    """Generate a cache key for text."""
    return hashlib.md5(text.encode()).hexdigest()


async def generate_embedding(text: str, use_cache: bool = True) -> np.ndarray:
    """
    Generate an embedding for a single text using Gemini.
    
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
        # Generate embedding using new google.genai SDK
        result = await _client.aio.models.embed_content(
            model=settings.embedding_model,
            contents=text,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_DOCUMENT",
                output_dimensionality=settings.embedding_dimensions,
            ),
        )
        
        vector = np.array(result.embeddings[0].values, dtype=np.float32)
        
        # Cache result
        if use_cache:
            _embedding_cache[cache_key] = vector
            
        return vector
        
    except Exception as e:
        print(f"Embedding generation error: {e}")
        # Return zero vector on failure to not crash app
        return np.zeros(settings.embedding_dimensions, dtype=np.float32)


async def generate_query_embedding(text: str) -> np.ndarray:
    """
    Generate embedding specifically for search queries.
    Google distinguishes between document and query embeddings.
    """
    if not text or not text.strip():
        return np.zeros(settings.embedding_dimensions, dtype=np.float32)

    try:
        result = await _client.aio.models.embed_content(
            model=settings.embedding_model,
            contents=text,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_QUERY",
                output_dimensionality=settings.embedding_dimensions,
            ),
        )
        return np.array(result.embeddings[0].values, dtype=np.float32)
    except Exception as e:
        print(f"Query embedding error: {e}")
        return np.zeros(settings.embedding_dimensions, dtype=np.float32)


async def generate_embeddings_batch(texts: List[str], use_cache: bool = True) -> List[np.ndarray]:
    """
    Generate embeddings for multiple texts.
    
    Args:
        texts: List of texts to embed
    
    Returns:
        List of embedding vectors
    """
    embeddings = []
    for text in texts:
        emb = await generate_embedding(text, use_cache=use_cache)
        embeddings.append(emb)
    
    return embeddings
