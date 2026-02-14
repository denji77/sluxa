"""
AI Chat logic using Google Gemini (google.genai SDK).
Ported and adapted from sluxa-master/lib/telegram/handlers/ai.ts
Enhanced with RAG (Retrieval-Augmented Generation) for semantic memory.
"""

from google import genai
from google.genai import types
from typing import List, Optional
from datetime import datetime

from ..config import get_settings
from ..schemas import ChatMessage
from .prompts import build_system_prompt, build_final_prompt, replace_placeholders, extract_dialogue

settings = get_settings()

# Initialize Gemini client (instance-based)
_client = genai.Client(api_key=settings.google_api_key)


def format_history_for_gemini(messages: List[ChatMessage]) -> List[types.Content]:
    """
    Convert chat messages to Gemini's expected Content format.
    
    Args:
        messages: List of ChatMessage objects
    
    Returns:
        List of Content objects in Gemini format
    """
    history = []
    for msg in messages:
        role = "user" if msg.role == "user" else "model"
        history.append(types.Content(
            role=role,
            parts=[types.Part(text=msg.content)]
        ))
    return history


async def generate_response(
    user_message: str,
    character_description: str,
    chat_history: List[ChatMessage],
    user_name: Optional[str] = None,
    character_name: Optional[str] = None,
    mode: str = "descriptive",
    rag_context: Optional[str] = None,
    time_context: Optional[dict] = None,
) -> str:
    """
    Generate an AI response using Google Gemini.
    
    Args:
        user_message: The user's message
        character_description: The character's personality/prompt
        chat_history: Previous messages in the conversation (recent messages)
        user_name: Optional user's name
        character_name: Optional character's name
        mode: Chat mode - 'descriptive' for roleplay or 'normal' for casual chat
        rag_context: Optional RAG-retrieved context to include
        time_context: Optional dict with user's local time info
    
    Returns:
        The AI-generated response string
    """
    # Build system prompt
    system_prompt = build_system_prompt(
        character_description=character_description,
        user_name=user_name,
        char_name=character_name,
        is_private=True,
        mode=mode,
        time_context=time_context,
    )
    
    # Add RAG context to system prompt if available
    if rag_context:
        system_prompt = f"{system_prompt}\n\n{rag_context}"
    
    # Format chat history for Gemini
    recent_history = chat_history[-settings.max_messages_history:]
    gemini_history = format_history_for_gemini(recent_history)

    # Create async chat with system instruction and history
    chat = _client.aio.chats.create(
        model=settings.ai_model,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=settings.ai_temperature,
            top_p=settings.ai_top_p,
            max_output_tokens=settings.ai_max_tokens,
        ),
        history=gemini_history,
    )
    
    # Generate response
    try:
        response = await chat.send_message(user_message)
        
        # Extract text from response
        response_text = response.text.strip()
        
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
        
        error_str = str(e).lower()
        # Handle Gemini safety filter blocks
        if any(keyword in error_str for keyword in [
            "blocked", "safety", "finish_reason", "prompt_feedback",
            "harm_category", "block_reason"
        ]):
            return "*I cannot respond to that.* (Safety Filter Triggered)"
             
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
        response = await _client.aio.models.generate_content(
            model=settings.ai_model,
            contents=prompt,
        )
        title = response.text.strip().strip('"').strip("'")
        return title[:100]  # Limit length
    except Exception:
        # Fallback to truncated message
        return first_message[:50] + "..." if len(first_message) > 50 else first_message
