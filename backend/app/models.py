from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class User(Base):
    """User model - linked to Clerk user ID"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    clerk_id = Column(String(255), unique=True, index=True, nullable=False)
    email = Column(String(255), nullable=True)
    username = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    chats = relationship("Chat", back_populates="user", cascade="all, delete-orphan")
    lorebooks = relationship("Lorebook", back_populates="user", cascade="all, delete-orphan")


class Lorebook(Base):
    """Collection of world info entries"""
    __tablename__ = "lorebooks"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="lorebooks")
    entries = relationship("LorebookEntry", back_populates="lorebook", cascade="all, delete-orphan")
    characters = relationship("Character", back_populates="lorebook")


class LorebookEntry(Base):
    """Individual world info entry triggered by keywords"""
    __tablename__ = "lorebook_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    lorebook_id = Column(Integer, ForeignKey("lorebooks.id"), nullable=False)
    keys = Column(String(500), nullable=False)  # Comma-separated keywords
    content = Column(Text, nullable=False)      # The lore to inject
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    lorebook = relationship("Lorebook", back_populates="entries")


class Character(Base):
    """Character/Persona for AI to roleplay"""
    __tablename__ = "characters"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)  # Character prompt/personality
    avatar_url = Column(String(500), nullable=True)
    greeting = Column(Text, nullable=True)  # Initial message from character
    is_default = Column(Boolean, default=False)  # Built-in character
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    lorebook_id = Column(Integer, ForeignKey("lorebooks.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    created_by = relationship("User")
    lorebook = relationship("Lorebook", back_populates="characters")
    chats = relationship("Chat", back_populates="character")


class Chat(Base):
    """Chat session between user and character"""
    __tablename__ = "chats"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    character_id = Column(Integer, ForeignKey("characters.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Chat-specific settings
    notes = Column(Text, nullable=True)  # Summary/notes about the chat
    
    # Relationships
    user = relationship("User", back_populates="chats")
    character = relationship("Character", back_populates="chats")
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan", order_by="Message.created_at")


class Message(Base):
    """Individual message in a chat"""
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id"), nullable=False)
    content = Column(Text, nullable=False)
    role = Column(String(20), nullable=False)  # 'user' or 'assistant'
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    chat = relationship("Chat", back_populates="messages")
