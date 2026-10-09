import logging
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status
from ..schemas import SignUpRequest, LoginRequest, AuthTokenResponse, UserProfileResponse, UpdateProfileRequest
from ..auth import supabase_anon, supabase_admin, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/signup", response_model=AuthTokenResponse)
def sign_up(request: SignUpRequest):
    """
    Registers a new user in Supabase Auth.
    Uses Supabase Admin with email_confirm=True to bypass external SMTP rate limits
    and immediately provisions a verified account and session token.
    """
    if not supabase_admin and not supabase_anon:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase Auth is not configured on the server."
        )

    try:
        user_id = None
        user_email = request.email

        # 1. Prefer Admin API to create user with email_confirm=True (prevents rate limits / email bounce)
        if supabase_admin:
            try:
                admin_res = supabase_admin.auth.admin.create_user({
                    "email": request.email,
                    "password": request.password,
                    "email_confirm": True
                })
                if admin_res and admin_res.user:
                    user_id = str(admin_res.user.id)
                    user_email = admin_res.user.email
            except Exception as admin_err:
                err_str = str(admin_err).lower()
                if "already registered" in err_str or "already exists" in err_str:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="An account with this email already exists. Please sign in instead."
                    )
                logger.warning(f"Admin create_user fallback to standard sign_up: {admin_err}")

        # 2. If admin API wasn't available or didn't provision, fallback to standard anon sign_up
        if not user_id and supabase_anon:
            res = supabase_anon.auth.sign_up({
                "email": request.email,
                "password": request.password
            })
            if not res.user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Sign up failed. Please verify your email or password."
                )
            user_id = str(res.user.id)
            user_email = res.user.email

        # 3. Automatically authenticate the newly created user to return an active session token
        access_token = ""
        if supabase_anon:
            try:
                login_res = supabase_anon.auth.sign_in_with_password({
                    "email": request.email,
                    "password": request.password
                })
                if login_res.session:
                    access_token = login_res.session.access_token
            except Exception as login_err:
                logger.info(f"Auto-login after signup deferred: {login_err}")

        return AuthTokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserProfileResponse(
                id=user_id or "user",
                email=user_email,
                role="authenticated"
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Sign up error: {e}")
        err_msg = str(e)
        if "rate limit" in err_msg.lower():
            err_msg = "Email rate limit exceeded by Supabase mailer. Please try again or use direct login."
        elif "already registered" in err_msg.lower():
            err_msg = "An account with this email already exists. Please sign in."
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg
        )


@router.post("/login", response_model=AuthTokenResponse)
def login(request: LoginRequest):
    """
    Authenticates a user via Supabase Auth and returns an access token.
    """
    if not supabase_anon:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase Auth is not configured on the server."
        )

    try:
        res = supabase_anon.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password
        })

        if not res.session or not res.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password."
            )

        return AuthTokenResponse(
            access_token=res.session.access_token,
            token_type="bearer",
            user=UserProfileResponse(
                id=str(res.user.id),
                email=res.user.email,
                role=res.user.role or "authenticated"
            )
        )
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )


@router.get("/me", response_model=UserProfileResponse)
def get_current_user_profile(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Retrieves the currently authenticated user's profile.
    """
    return UserProfileResponse(
        id=user["id"],
        email=user.get("email"),
        role=user.get("role", "authenticated"),
        display_name=user.get("display_name"),
    )


@router.patch("/me", response_model=UserProfileResponse)
def update_current_user_profile(
    request: UpdateProfileRequest,
    user: Dict[str, Any] = Depends(get_current_user),
):
    if not supabase_admin:
        raise HTTPException(status_code=503, detail="Profile updates are unavailable because Supabase Admin is not configured.")
    if request.display_name is None and request.password is None:
        raise HTTPException(status_code=400, detail="Provide a display name or new password.")
    attributes: Dict[str, Any] = {}
    if request.display_name is not None:
        name = request.display_name.strip()
        if not name:
            raise HTTPException(status_code=422, detail="Name cannot be blank.")
        attributes["user_metadata"] = {"display_name": name}
    if request.password is not None:
        attributes["password"] = request.password
    try:
        result = supabase_admin.auth.admin.update_user_by_id(user["id"], attributes)
        updated = result.user
        metadata = updated.user_metadata or {}
        return UserProfileResponse(
            id=str(updated.id), email=updated.email, role=updated.role or "authenticated",
            display_name=metadata.get("display_name"),
        )
    except Exception as error:
        logger.error("Profile update failed: %s", error)
        raise HTTPException(status_code=400, detail="Could not update the account settings.")
