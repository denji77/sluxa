from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


# ===== User Schemas =====
class UserBase(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None


class UserCreate(UserBase):
    clerk_id: str


class User(UserBase):
    id: int
    clerk_id: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# ===== Character Schemas =====
class CharacterBase(BaseModel):
    name: str
    description: str
    avatar_url: Optional[str] = None
    greeting: Optional[str] = None


class CharacterCreate(CharacterBase):
    pass


class Character(CharacterBase):
    id: int
    is_default: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# ===== Message Schemas =====
class MessageBase(BaseModel):
    content: str
    role: str


class MessageCreate(BaseModel):
    content: str
    mode: Optional[str] = "descriptive"  # 'descriptive' or 'normal'


class Message(MessageBase):
    id: int
    chat_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# ===== Chat Schemas =====
class ChatBase(BaseModel):
    title: Optional[str] = None
    character_id: int


class ChatCreate(ChatBase):
    pass


class ChatSummary(BaseModel):
    id: int
    title: Optional[str]
    character_id: int
    character_name: str
    character_avatar: Optional[str]
    created_at: datetime
    updated_at: datetime
    last_message: Optional[str] = None
    
    class Config:
        from_attributes = True


class Chat(ChatBase):
    id: int
    user_id: int
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    character: Character
    messages: List[Message] = []
    
    class Config:
        from_attributes = True


# ===== AI Response Schema =====
class AIResponse(BaseModel):
    message: Message
    

class ChatMessage(BaseModel):
    """Message format for AI context"""
    role: str  # 'user' or 'assistant'
    content: str
