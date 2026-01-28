from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite:///./slusha.db"
    
    # OpenAI API
    openai_api_key: str
    ai_model: str = "gpt-4.1-nano"  # Cheapest working model
    ai_temperature: float = 0.9
    ai_top_p: float = 0.95
    ai_max_tokens: int = 2048
    
    # Clerk Authentication
    clerk_secret_key: str
    clerk_publishable_key: str
    
    # App settings
    max_messages_history: int = 20
    message_max_length: int = 4096
    
    # RAG / Vector Search Settings
    rag_enabled: bool = True
    rag_top_k: int = 5  # Number of similar messages to retrieve
    rag_similarity_threshold: float = 0.5  # Minimum similarity score (0-1)
    rag_recent_messages: int = 5  # Always include last N messages for recency
    embedding_model: str = "text-embedding-3-small"  # OpenAI's embedding model
    embedding_dimensions: int = 1536  # Dimension of OpenAI embeddings
    faiss_index_path: str = "./data/faiss_indexes"  # Where to store FAISS indexes
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    # Ensure FAISS index directory exists
    os.makedirs(settings.faiss_index_path, exist_ok=True)
    return settings
