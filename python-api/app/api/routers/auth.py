from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import or_

from app.core import security
from app.core.config import settings
from app.api.deps import SessionDep, CurrentUser
from app.models.user import User, Role
from app.schemas.user import LoginRequest, Token, UserResponse, UserCreate

router = APIRouter()

@router.post("/local", response_model=dict)
async def login_access_token(
    session: SessionDep, request: LoginRequest
) -> Any:
    """
    OAuth2 compatible token login matching Strapi's POST /api/auth/local
    Accepts `identifier` (email or username) and `password`.
    """
    query = select(User).options(selectinload(User.role)).where(
        or_(
            User.email == request.identifier,
            User.username == request.identifier
        )
    )
    result = await session.execute(query)
    user = result.scalar_one_or_none()

    if not user or not security.verify_password(request.password, user.password):
        raise HTTPException(
            status_code=400, detail="Invalid identifier or password"
        )
    if user.blocked:
        raise HTTPException(status_code=400, detail="Your account has been blocked by an administrator")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = security.create_access_token(
        user.id, expires_delta=access_token_expires
    )
    
    # Return formatted payload similar to Strapi, but flatter.
    return {
        "jwt": token,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "provider": user.provider,
            "confirmed": user.confirmed,
            "blocked": user.blocked,
            "role": {
                "id": user.role.id if user.role else None,
                "name": user.role.name if user.role else None,
                "type": user.role.type if user.role else None,
            } if user.role else None
        }
    }

@router.get("/users/me", response_model=UserResponse)
async def read_users_me(current_user: CurrentUser) -> Any:
    """
    Get current user. Matches Strapi's GET /api/users/me
    """
    return current_user
