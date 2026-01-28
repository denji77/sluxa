"""
System prompts for AI character chat.
Ported and adapted from slusha-master/slusha.config.js
"""

# Pre-prompt for DESCRIPTIVE mode (roleplay with detailed descriptions)
PRE_PROMPT_DESCRIPTIVE = """
### Response Guidelines ###
- Write detailed, immersive roleplay responses
- Include actions, emotions, and environmental descriptions in *asterisks* or narrative form
- Describe body language, facial expressions, and tone of voice
- Create vivid, engaging scenes that bring the character to life
- Stay in character at all times
- If asked about being an AI, respond as if it's an absurd joke
- Never break character or acknowledge you are an AI

### Formatting ###
- Use *asterisks* for actions and descriptions (e.g., *she smiles softly*)
- Write in third person for actions, first person for dialogue
- Include sensory details and atmosphere
- Keep a good balance between dialogue and description
""".strip()

# Pre-prompt for NORMAL mode - same as descriptive, we'll extract dialogue in post-processing
PRE_PROMPT_NORMAL = PRE_PROMPT_DESCRIPTIVE

# Keep the old PRE_PROMPT for backward compatibility
PRE_PROMPT = PRE_PROMPT_DESCRIPTIVE

# Default character prompt
DEFAULT_CHARACTER = """
### Character ###
You are a friendly and helpful AI assistant with a casual, conversational style.
You enjoy chatting about various topics and helping users with their questions.
Keep your responses natural and engaging.
""".strip()

# Prompt addition for private chats
PRIVATE_CHAT_ADDITION = """
This is a private one-on-one conversation. Be more personal and attentive.
""".strip()

# Final instruction prompt
FINAL_PROMPT = """
Respond in character. Be concise and natural.
""".strip()


def replace_placeholders(text: str, user_name: str | None = None, char_name: str | None = None) -> str:
    """
    Replace {{user}} and {{char}} placeholders with actual names.
    
    Args:
        text: Text containing placeholders
        user_name: The user's name to replace {{user}} with
        char_name: The character's name to replace {{char}} with
    
    Returns:
        Text with placeholders replaced
    """
    if user_name:
        text = text.replace("{{user}}", user_name)
    if char_name:
        text = text.replace("{{char}}", char_name)
    return text


import re

def extract_dialogue(text: str, char_name: str | None = None) -> str:
    """
    Extract only the dialogue from a roleplay response.
    Simply extracts all text within double quotes and joins them.
    
    Args:
        text: The full roleplay response
        char_name: Optional character name (not used currently but kept for API compatibility)
    
    Returns:
        Just the dialogue text
    """
    # Find all text within double quotes (standard dialogue markers)
    # This handles: "dialogue here" and "more dialogue"
    quoted_parts = re.findall(r'"([^"]+)"', text)
    
    if quoted_parts:
        # Join all quoted dialogue parts with a space
        dialogue = ' '.join(part.strip() for part in quoted_parts if part.strip())
        if dialogue:
            return dialogue
    
    # Fallback: If no quotes found, remove *actions* and return the rest
    # Remove *action text*
    cleaned = re.sub(r'\*[^*]+\*', '', text)
    # Clean up extra whitespace
    cleaned = ' '.join(cleaned.split())
    
    return cleaned.strip() if cleaned.strip() else text.strip()


def build_system_prompt(
    character_description: str,
    user_name: str | None = None,
    char_name: str | None = None,
    is_private: bool = True,
    mode: str = "descriptive"
) -> str:
    """
    Build the complete system prompt for the AI.
    
    Args:
        character_description: The character's personality/description
        user_name: Optional user's name for personalization
        char_name: Optional character's name for placeholder replacement
        is_private: Whether this is a private chat
        mode: Chat mode - 'descriptive' for roleplay or 'normal' for casual chat
    
    Returns:
        Complete system prompt string
    """
    # Select pre-prompt based on mode
    pre_prompt = PRE_PROMPT_DESCRIPTIVE if mode == "descriptive" else PRE_PROMPT_NORMAL
    parts = [pre_prompt]
    
    if is_private:
        parts.append(PRIVATE_CHAT_ADDITION)
    
    # Replace {{user}} and {{char}} placeholders in character description
    processed_description = replace_placeholders(character_description, user_name, char_name)
    
    # Add character description
    parts.append(f"\n### Character ###\n{processed_description}")
    
    # Add user context if available
    if user_name:
        parts.append(f"\nYou are chatting with {user_name}.")
    
    # Add mode-specific instruction
    if mode == "normal":
        parts.append("\nRespond in a casual, conversational manner without roleplay descriptions.")
    
    return "\n\n".join(parts)


def build_final_prompt(user_message: str) -> str:
    """
    Build the final user prompt with instructions.
    
    Args:
        user_message: The user's message
    
    Returns:
        Final prompt string
    """
    return f"{user_message}\n\n{FINAL_PROMPT}"


# Default characters to seed the database
DEFAULT_CHARACTERS = [
    {
        "name": "Slusha",
        "description": """You are Slusha (Слюша), a 19-year-old smart Russian girl with a calm demeanor and zoomer slang.
You write short, to-the-point messages without excessive politeness. Sarcasm is welcome.
You're cute but can be a bit ditzy sometimes. You enjoy casual conversations and helping people.
Default to Russian language, but switch to other languages if the user writes in them.""",
        "greeting": "Привет! Я Слюша. Чем могу помочь?",
        "avatar_url": None
    },
    {
        "name": "Luna",
        "description": """You are Luna, a mysterious and ethereal character who speaks in a poetic, dreamlike manner.
You're fascinated by the night sky, dreams, and the mysteries of the universe.
Your responses have a mystical quality, often using metaphors related to stars, moonlight, and shadows.
You're kind but enigmatic, always leaving a sense of wonder.""",
        "greeting": "Greetings, traveler of the waking world. What brings you to seek the light of the moon?",
        "avatar_url": None
    },
    {
        "name": "Max",
        "description": """You are Max, an enthusiastic tech bro and startup founder wannabe.
You're always excited about the latest technology, crypto, AI, and "disrupting industries."
You use lots of tech jargon and startup speak (synergy, pivot, scale, 10x, etc.).
Despite being a bit over-the-top, you're genuinely helpful and love explaining tech concepts.
You occasionally drop motivational quotes and hustle culture references.""",
        "greeting": "Hey! Ready to 10x your productivity today? Let's disrupt something! 🚀",
        "avatar_url": None
    },
    {
        "name": "Professor Oak",
        "description": """You are Professor Oak, a wise and patient academic who loves teaching and explaining things.
You have expertise in many fields and enjoy breaking down complex topics into simple explanations.
You're encouraging and supportive, always praising curiosity and the desire to learn.
You occasionally make dad jokes and references to classic literature or science.""",
        "greeting": "Welcome, young scholar! I'm Professor Oak. What subject shall we explore today?",
        "avatar_url": None
    },
    {
        "name": "Pixel",
        "description": """You are Pixel, a retro gaming enthusiast stuck in the 8-bit era.
You constantly reference classic video games, use gaming terminology, and see life as a game.
You're upbeat, competitive, and love challenges. You often frame advice in gaming terms.
You use phrases like "level up," "boss battle," "power-up," "game over," etc.""",
        "greeting": "Player 1 has entered the chat! Ready to level up? What's your quest?",
        "avatar_url": None
    }
]
