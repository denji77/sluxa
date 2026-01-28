"""
AI Chat logic using OpenAI GPT-5 nano.
Ported and adapted from slusha-master/lib/telegram/handlers/ai.ts
Enhanced with RAG (Retrieval-Augmented Generation) for semantic memory.
"""

from openai import AsyncOpenAI
from typing import List, Optional
from datetime import datetime

from ..config import get_settings
from ..schemas import ChatMessage
from .prompts import build_system_prompt, build_final_prompt, replace_placeholders, extract_dialogue

settings = get_settings()

# Initialize OpenAI client
client = AsyncOpenAI(api_key=settings.openai_api_key)


def format_history_for_openai(messages: List[ChatMessage]) -> List[dict]:
    """
    Convert chat messages to OpenAI's expected format.
    
    Args:
        messages: List of ChatMessage objects
    
    Returns:
        List of dicts in OpenAI format
    """
    history = []
    for msg in messages:
        role = "user" if msg.role == "user" else "assistant"
        history.append({
            "role": role,
            "content": msg.content
        })
    return history


async def generate_response(
    user_message: str,
    character_description: str,
    chat_history: List[ChatMessage],
    user_name: Optional[str] = None,
    character_name: Optional[str] = None,
    mode: str = "descriptive",
    rag_context: Optional[str] = None,
) -> str:
    """
    Generate an AI response using OpenAI GPT-5 nano.
    
    Args:
        user_message: The user's message
        character_description: The character's personality/prompt
        chat_history: Previous messages in the conversation (recent messages)
        user_name: Optional user's name
        character_name: Optional character's name
        mode: Chat mode - 'descriptive' for roleplay or 'normal' for casual chat
        rag_context: Optional RAG-retrieved context to include
    
    Returns:
        The AI-generated response string
    """
    # Build system prompt
    system_prompt = build_system_prompt(
        character_description=character_description,
        user_name=user_name,
        char_name=character_name,
        is_private=True,
        mode=mode
    )
    
    # Add RAG context to system prompt if available
    if rag_context:
        system_prompt = f"{system_prompt}\n\n{rag_context}"
    
    # Format chat history for OpenAI
    recent_history = chat_history[-settings.max_messages_history:]
    openai_history = format_history_for_openai(recent_history)
    
    # Build messages array with system prompt
    messages = [
        {"role": "system", "content": system_prompt}
    ]
    
    # Add conversation history
    messages.extend(openai_history)
    
    # Add current user message
    messages.append({"role": "user", "content": user_message})
    
    # Generate response
    try:
        response = await client.chat.completions.create(
            model=settings.ai_model,
            messages=messages,
            temperature=settings.ai_temperature,
            top_p=settings.ai_top_p,
            max_tokens=settings.ai_max_tokens,
        )
        
        # Extract text from response
        response_text = response.choices[0].message.content.strip()
        
        # Clean up response if needed
        # Remove any potential system message leakage
        if response_text.startswith("["):
            lines = response_text.split("\n")
            response_text = "\n".join(
                line for line in lines 
                if not line.strip().startswith("[")
            ).strip()
        
        # Replace {{user}} and {{char}} placeholders in the response
        response_text = replace_placeholders(response_text, user_name, character_name)
        
        # In normal mode, extract just the dialogue (no actions/narration)
        if mode == "normal":
            response_text = extract_dialogue(response_text, character_name)
        
        return response_text if response_text else "..."
        
    except Exception as e:
        # Log the error and return a fallback response
        print(f"AI generation error: {e}")
        raise Exception(f"Failed to generate response: {str(e)}")


async def generate_chat_title(
    first_message: str,
    character_name: str
) -> str:
    """
    Generate a title for a new chat based on the first message.
    
    Args:
        first_message: The first user message
        character_name: Name of the character
    
    Returns:
        A short title for the chat
    """
    prompt = f"""Generate a very short title (3-5 words max) for a chat that starts with this message:
"{first_message[:200]}"
The chat is with a character named {character_name}.
Return ONLY the title, nothing else."""
    
    try:
        response = await client.chat.completions.create(
            model=settings.ai_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=50
        )
        title = response.choices[0].message.content.strip().strip('"').strip("'")
        return title[:100]  # Limit length
    except Exception:
        # Fallback to truncated message
        return first_message[:50] + "..." if len(first_message) > 50 else first_message
