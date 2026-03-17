from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, ConfigDict
from app.schemas.org import DepartmentResponse, StoreResponse

# --- User Schemas ---
class UserBase(BaseModel):
    name: str
    email: EmailStr

class UserMinimalResponse(UserBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class UserResponse(UserBase):
    id: int
    is_active: bool
    role: str
    department: Optional[DepartmentResponse] = None
    department_id: Optional[int] = None
    stores: List[StoreResponse] = []
    store_id: Optional[str] = None # primary store
    store_name: Optional[str] = None # primary store shortAddress
    
    model_config = ConfigDict(from_attributes=True)

# --- Auth Schemas ---
class LoginRequest(BaseModel):
    token: str
    profile: dict
    
class RefreshRequest(BaseModel):
    refreshToken: str

class AuthTokensResponse(BaseModel):
    tokenType: str
    accessToken: str
    refreshToken: str
