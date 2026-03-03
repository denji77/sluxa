from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, UniqueConstraint
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


# =============================================================================
# Group Chat Models
# =============================================================================

class GroupChat(Base):
    """A chat room with multiple AI characters."""
    __tablename__ = "group_chats"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User")
    participants = relationship(
        "GroupChatParticipant",
        back_populates="group_chat",
        cascade="all, delete-orphan",
        order_by="GroupChatParticipant.order",
    )
    messages = relationship(
        "GroupMessage",
        back_populates="group_chat",
        cascade="all, delete-orphan",
        order_by="GroupMessage.created_at",
    )


class GroupChatParticipant(Base):
    """Links a Character to a GroupChat with a turn-order index."""
    __tablename__ = "group_chat_participants"
    __table_args__ = (UniqueConstraint("group_chat_id", "character_id"),)

    id = Column(Integer, primary_key=True, index=True)
    group_chat_id = Column(Integer, ForeignKey("group_chats.id"), nullable=False)
    character_id = Column(Integer, ForeignKey("characters.id"), nullable=False)
    order = Column(Integer, default=0, nullable=False)  # Turn order within the room

    # Relationships
    group_chat = relationship("GroupChat", back_populates="participants")
    character = relationship("Character")


class GroupMessage(Base):
    """A message in a GroupChat — either from the user or from a specific character."""
    __tablename__ = "group_messages"

    id = Column(Integer, primary_key=True, index=True)
    group_chat_id = Column(Integer, ForeignKey("group_chats.id"), nullable=False)
    # NULL character_id = user message; non-NULL = AI response from that character
    character_id = Column(Integer, ForeignKey("characters.id"), nullable=True)
    content = Column(Text, nullable=False)
    role = Column(String(20), nullable=False)  # 'user' or 'assistant'
    # Which prior message this is a reply to (NULL = stand-alone or reply to user)
    responding_to_message_id = Column(Integer, ForeignKey("group_messages.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    group_chat = relationship("GroupChat", back_populates="messages")
    character = relationship("Character")
