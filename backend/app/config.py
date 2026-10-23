from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite:///./slusha.db"
    
    # AI Model & Provider Configuration
    ai_provider: str = "groq"  # "groq" or "gemini"
    groq_api_key: str = ""
    google_api_key: str = ""
    ai_model: str = "qwen/qwen3.8-27b"
    ai_temperature: float = 0.9
    ai_top_p: float = 0.95
    ai_max_tokens: int = 2048
    
    # Clerk Authentication
    clerk_secret_key: str
    clerk_publishable_key: str
    
    # CORS settings (comma-separated origins)
    cors_origins: str = "http://localhost:5173,http://localhost:5174,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:3000"

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

    # Proactive messaging (characters text first after inactivity)
    proactive_enabled: bool = True
    proactive_check_interval_s: int = 300   # scheduler cycle
    proactive_min_idle_minutes: int = 45    # base quiet period before a chat qualifies
    proactive_max_idle_days: int = 7        # older chats are considered dormant
    proactive_probability: float = 0.3      # chance per cycle once a chat qualifies
    # Once there are >= N unprompted messages since the user's last message,
    # characters go silent until the user texts again. 1 = a single proactive
    # burst (a DM double-text or one group chain), then quiet.
    proactive_dm_max_unanswered: int = 1
    proactive_group_max_unanswered: int = 1
    # /ambient (screen-open chatter) stops after N unprompted messages too
    ambient_max_unanswered: int = 2
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
