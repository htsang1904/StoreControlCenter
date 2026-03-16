from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict

# --- Role Schemas ---
class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None
    type: str

class RoleResponse(RoleBase):
    id: int
    
    model_config = ConfigDict(from_attributes=True)

# --- User Schemas ---
class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str
    role_id: Optional[int] = None

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role_id: Optional[int] = None
    blocked: Optional[bool] = None

class UserResponse(UserBase):
    id: int
    provider: str
    confirmed: bool
    blocked: bool
    created_at: datetime
    role: Optional[RoleResponse] = None

    model_config = ConfigDict(from_attributes=True)

# --- Auth Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class LoginRequest(BaseModel):
    identifier: str # Email or Username just like Strapi
    password: str
