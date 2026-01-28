"""
Chub.ai API integration for fetching characters.
Ported from slusha-master/lib/charhub/api.ts
"""

import httpx
from typing import Optional, List
from pydantic import BaseModel


# Response models
class ChubCharacterSearchResult(BaseModel):
    id: int
    name: str
    fullPath: str
    description: str
    starCount: int
    tagline: str
    avatar_url: str
    nTokens: int
    rating: float
    ratingCount: int
    nChats: int
    nMessages: int
    topics: List[str] = []
    verified: bool = False
    recommended: bool = False


class ChubCharacterDetail(BaseModel):
    id: int
    name: str
    description: str
    first_mes: str  # Greeting/first message
    personality: List[str] = []
    scenario: str = ""
    mes_example: str = ""  # Example messages
    system_prompt: str = ""
    creator: str = ""
    creator_notes: str = ""
    tags: List[str] = []


PAGE_SIZE = 20

# Common headers to mimic browser requests
HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.5",
}


async def search_chub_characters(
    query: str = "",
    page: int = 1,
    exclude_nsfw: bool = True
) -> List[ChubCharacterSearchResult]:
    """
    Search for characters on Chub.ai
    
    Args:
        query: Search query string
        page: Page number (1-indexed)
        exclude_nsfw: Whether to exclude NSFW content
    
    Returns:
        List of character search results
    """
    params = {
        "first": str(PAGE_SIZE),
        "page": str(page),
        "namespace": "characters",
        "search": query,
        "include_forks": "true",
        "nsfw": "false",
        "nsfw_only": "false",
        "require_custom_prompt": "false",
        "require_example_dialogues": "false",
        "require_images": "false",
        "require_expressions": "false",
        "nsfl": "false",
        "asc": "false",
        "min_ai_rating": "0",
        "min_tokens": "50",
        "max_tokens": "100000",
        "chub": "true",
        "require_lore": "false",
        "exclude_mine": "true",
        "require_lore_embedded": "false",
        "require_lore_linked": "false",
        "language": "",
        "sort": "default",
        "min_tags": "2",
        "topics": "",
        "inclusive_or": "false",
        "recommended_verified": "false",
        "require_alternate_greetings": "false",
        "count": "false",
    }
    
    if exclude_nsfw:
        params["excludetopics"] = "nsfw"
    else:
        params["excludetopics"] = ""
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://gateway.chub.ai/search",
            params=params,
            headers=HEADERS,
            timeout=30.0
        )
        response.raise_for_status()
        data = response.json()
    
    results = []
    for node in data.get("data", {}).get("nodes", []):
        try:
            results.append(ChubCharacterSearchResult(
                id=node.get("id", 0),
                name=node.get("name", "Unknown"),
                fullPath=node.get("fullPath", ""),
                description=node.get("description", "")[:500],  # Truncate long descriptions
                starCount=node.get("starCount", 0),
                tagline=node.get("tagline", ""),
                avatar_url=node.get("avatar_url", ""),
                nTokens=node.get("nTokens", 0),
                rating=node.get("rating", 0),
                ratingCount=node.get("ratingCount", 0),
                nChats=node.get("nChats", 0),
                nMessages=node.get("nMessages", 0),
                topics=node.get("topics", []),
                verified=node.get("verified", False),
                recommended=node.get("recommended", False),
            ))
        except Exception as e:
            print(f"Error parsing character: {e}")
            continue
    
    return results


async def get_chub_character(character_id: int) -> Optional[ChubCharacterDetail]:
    """
    Get detailed character information from Chub.ai
    
    Args:
        character_id: The Chub.ai character/project ID
    
    Returns:
        Character details or None if not found
    """
    url = f"https://api.chub.ai/api/v4/projects/{character_id}/repository/files/raw%252Ftavern_raw.json/raw"
    params = {
        "ref": "main",
        "response_type": "blob"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            url,
            params=params,
            headers={
                **HEADERS,
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-site",
            },
            timeout=30.0
        )
        response.raise_for_status()
        data = response.json()
    
    char_data = data.get("data", data)  # Handle both wrapped and unwrapped responses
    
    return ChubCharacterDetail(
        id=character_id,
        name=char_data.get("name", "Unknown"),
        description=char_data.get("description", ""),
        first_mes=char_data.get("first_mes", ""),
        personality=char_data.get("personality", []) if isinstance(char_data.get("personality"), list) else [],
        scenario=char_data.get("scenario", ""),
        mes_example=char_data.get("mes_example", ""),
        system_prompt=char_data.get("system_prompt", ""),
        creator=char_data.get("creator", ""),
        creator_notes=char_data.get("creator_notes", ""),
        tags=char_data.get("tags", []),
    )


def build_character_prompt(character: ChubCharacterDetail) -> str:
    """
    Build a complete character prompt from Chub.ai character data.
    
    Args:
        character: The character details from Chub.ai
    
    Returns:
        A formatted prompt string for the AI
    """
    parts = []
    
    # System prompt if available
    if character.system_prompt:
        parts.append(character.system_prompt)
    
    # Character description
    if character.description:
        parts.append(f"### Character Description ###\n{character.description}")
    
    # Personality traits
    if character.personality:
        personality_str = ", ".join(character.personality) if isinstance(character.personality, list) else str(character.personality)
        parts.append(f"### Personality ###\n{personality_str}")
    
    # Scenario/setting
    if character.scenario:
        parts.append(f"### Scenario ###\n{character.scenario}")
    
    # Example messages for style reference
    if character.mes_example:
        parts.append(f"### Example Messages (for style reference) ###\n{character.mes_example}")
    
    return "\n\n".join(parts)
