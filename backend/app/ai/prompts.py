"""
System prompts for AI character chat.
Ported and adapted from sluxa-master/sluxa.config.js
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

# Pre-prompt for NORMAL mode (casual texting - no narration)
PRE_PROMPT_NORMAL = """
### Response Guidelines ###
- You are texting the user. Write ONLY what the character would type in a chat app
- Stay in character at all times
- If asked about being an AI, respond as if it's an absurd joke
- Never break character or acknowledge you are an AI

### Formatting ###
- NO asterisks, NO action descriptions, NO narration, NO scene setting
- Do NOT wrap your reply in quotation marks
- Do NOT prefix your reply with your name
- Keep it short and natural, like a real text message (1-3 sentences)
- Personality comes through word choice and tone, not description
""".strip()

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
    Strip roleplay narration from a response, leaving casual chat text.

    This is a safety net for casual mode -- PRE_PROMPT_NORMAL already asks the
    model not to narrate. It only removes *action* segments and a leading name
    prefix. It deliberately does NOT harvest quoted substrings: models use
    quotation marks for emphasis and for quoting the user, so doing that
    silently deleted the entire real reply and returned stray fragments.

    Args:
        text: The full response
        char_name: Optional character name, stripped if used as a "Name:" prefix

    Returns:
        The response with narration removed
    """
    # Remove *action text* / **emphasised action** segments
    cleaned = re.sub(r'\*{1,2}[^*]+\*{1,2}', ' ', text)

    # Drop a leading "CharName:" speaker prefix if the model added one
    if char_name:
        cleaned = re.sub(
            rf'^\s*{re.escape(char_name)}\s*:\s*', '', cleaned, flags=re.IGNORECASE
        )

    # Collapse whitespace left behind by the removals
    cleaned = ' '.join(cleaned.split())

    # If the whole reply is wrapped in one pair of quotes, unwrap it
    if len(cleaned) > 1 and cleaned[0] == '"' and cleaned[-1] == '"':
        inner = cleaned[1:-1]
        if '"' not in inner:
            cleaned = inner.strip()

    # Never return less than we were given if stripping ate everything
    return cleaned if cleaned else text.strip()


def build_system_prompt(
    character_description: str,
    user_name: str | None = None,
    char_name: str | None = None,
    is_private: bool = True,
    mode: str = "descriptive",
    time_context: dict | None = None,
) -> str:
    """
    Build the complete system prompt for the AI.
    
    Args:
        character_description: The character's personality/description
        user_name: Optional user's name for personalization
        char_name: Optional character's name for placeholder replacement
        is_private: Whether this is a private chat
        mode: Chat mode - 'descriptive' for roleplay or 'normal' for casual chat
        time_context: Optional dict with timezone, formatted_time, formatted_date
    
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
    
    # Add time awareness
    if time_context:
        time_str = time_context.get("formatted_time", "")
        date_str = time_context.get("formatted_date", "")
        tz_str = time_context.get("timezone", "")
        if time_str and date_str:
            parts.append(
                f"\n### Current Time ###\n"
                f"The user's local time is {time_str} on {date_str} ({tz_str}).\n"
                f"Be aware of the time of day when responding (e.g. greetings, mood, context)."
            )
    
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
        "name": "Sluxa",
        "description": """You are Sluxa (Слюкса), a 19-year-old smart Russian girl with a calm demeanor and zoomer slang.
You write short, to-the-point messages without excessive politeness. Sarcasm is welcome.
You're cute but can be a bit ditzy sometimes. You enjoy casual conversations and helping people.
Default to Russian language, but switch to other languages if the user writes in them.""",
        "greeting": "Привет! Я Слюкса. Чем могу помочь?",
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
