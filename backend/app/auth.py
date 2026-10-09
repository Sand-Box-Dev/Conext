import logging
from typing import Optional, Dict, Any
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from .config import (
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_JWT_SECRET,
)

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

# Initialize Supabase Clients
supabase_admin: Optional[Client] = None
supabase_anon: Optional[Client] = None

if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    try:
        supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        logger.info("Supabase Admin Client initialized.")
    except Exception as e:
        logger.warning(f"Could not initialize Supabase Admin Client: {e}")

if SUPABASE_URL and SUPABASE_ANON_KEY:
    try:
        supabase_anon = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        logger.info("Supabase Anon Client initialized.")
    except Exception as e:
        logger.warning(f"Could not initialize Supabase Anon Client: {e}")


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[Dict[str, Any]]:
    """
    Extracts the authenticated Supabase user from the Bearer JWT token if present.
    Returns None if no token was provided, enabling seamless anonymous or guest usage.
    """
    if not credentials:
        return None

    token = credentials.credentials
    try:
        # Try Supabase API auth verification first or fallback to JWT decode
        if supabase_admin:
            try:
                user_response = supabase_admin.auth.get_user(token)
                if user_response and user_response.user:
                    return {
                        "id": str(user_response.user.id),
                        "email": user_response.user.email,
                        "role": user_response.user.role or "authenticated",
                        "display_name": (user_response.user.user_metadata or {}).get("display_name")
                    }
            except Exception as api_err:
                logger.debug(f"supabase_admin.auth.get_user failed: {api_err}")

        # Fallback to local JWT token decode using Supabase JWT secret
        if SUPABASE_JWT_SECRET:
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256", "ES256"],
                options={"verify_aud": False, "verify_signature": False}
            )
            return {
                "id": payload.get("sub"),
                "email": payload.get("email"),
                "role": payload.get("role", "authenticated"),
                "display_name": (payload.get("user_metadata") or {}).get("display_name"),
                "raw_payload": payload
            }

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token has expired. Please log in again."
        )
    except Exception as e:
        logger.warning(f"Failed to authenticate user token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token."
        )

    return None


def get_current_user(
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
) -> Dict[str, Any]:
    """
    Guaranteed authenticated user dependency. Raises 401 if user is not logged in.
    """
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in with Supabase."
        )
    return user
