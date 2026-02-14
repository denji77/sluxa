from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite:///./slusha.db"
    
    # Google Gemini API
    google_api_key: str
    ai_model: str = "gemini-2.5-flash-lite"
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
    embedding_model: str = "models/gemini-embedding-001"  # Google's embedding model
    embedding_dimensions: int = 768  # Dimension of Gemini embeddings

    # Pinecone
    pinecone_api_key: str = ""
    pinecone_index_name: str = "slusha"
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
