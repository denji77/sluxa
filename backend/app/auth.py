import base64

from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError
from .config import get_settings
from .database import get_db
from .models import User
from sqlalchemy.orm import Session

security = HTTPBearer()
settings = get_settings()

_jwks_client: PyJWKClient | None = None


def _clerk_frontend_domain() -> str:
    """
    Derive the Clerk Frontend API domain from the publishable key.
    Publishable keys are 'pk_test_<base64>' / 'pk_live_<base64>' where the
    base64 part decodes to '<frontend-api-domain>$'.
    """
    key = settings.clerk_publishable_key
    encoded = key.split("_", 2)[2]
    # Re-pad base64 (Clerk strips padding)
    encoded += "=" * (-len(encoded) % 4)
    decoded = base64.b64decode(encoded).decode("utf-8")
    return decoded.rstrip("$")


def _get_jwks_client() -> PyJWKClient:
    """Lazily create a JWKS client for Clerk's public keys (keys are cached)."""
    global _jwks_client
    if _jwks_client is None:
        domain = _clerk_frontend_domain()
        _jwks_client = PyJWKClient(
            f"https://{domain}/.well-known/jwks.json",
            cache_keys=True,
        )
    return _jwks_client


async def verify_clerk_token(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> dict:
    """
    Verify a Clerk session JWT (RS256) against Clerk's JWKS endpoint
    and return the payload.
    """
    token = credentials.credentials

    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},  # Clerk session tokens carry no aud
            leeway=10,  # tolerate small clock skew
        )
    except InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication error: {str(e)}")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: no user ID")

    return {
        "user_id": user_id,
        "email": payload.get("email"),
        "username": payload.get("username")
    }


async def get_current_user(
    token_data: dict = Depends(verify_clerk_token),
    db: Session = Depends(get_db)
) -> User:
    """
    Get or create user from Clerk token data.
    """
    clerk_id = token_data["user_id"]

    # Find existing user
    user = db.query(User).filter(User.clerk_id == clerk_id).first()

    if not user:
        # Create new user
        user = User(
            clerk_id=clerk_id,
            email=token_data.get("email"),
            username=token_data.get("username")
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return user
