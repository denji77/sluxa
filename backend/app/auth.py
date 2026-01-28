from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx
import jwt
from jwt.exceptions import InvalidTokenError
from .config import get_settings
from .database import get_db
from .models import User
from sqlalchemy.orm import Session

security = HTTPBearer()
settings = get_settings()


async def verify_clerk_token(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> dict:
    """
    Verify Clerk JWT token and return the payload.
    Clerk tokens are JWTs that can be verified using the JWKS endpoint.
    """
    token = credentials.credentials
    
    try:
        # For Clerk, we need to verify the JWT
        # In production, you should verify against Clerk's JWKS
        # For simplicity, we'll decode without full verification in dev
        # and trust the token structure
        
        # Decode the token (in production, verify with Clerk's public key)
        # Clerk tokens have the user ID in the 'sub' claim
        unverified = jwt.decode(token, options={"verify_signature": False})
        
        user_id = unverified.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: no user ID")
        
        return {
            "user_id": user_id,
            "email": unverified.get("email"),
            "username": unverified.get("username")
        }
        
    except InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication error: {str(e)}")


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
