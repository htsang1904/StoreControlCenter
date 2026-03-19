from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

# --- Department Schemas ---
class DepartmentBase(BaseModel):
    name: str
    code: str
    is_active: bool = True

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentResponse(DepartmentBase):
    id: int
    created_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

# --- Store Schemas ---
class StoreBase(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    shortAddress: Optional[str] = None
    storeId: Optional[str] = None
    brandId: Optional[str] = None
    is_active: bool = True

class StoreCreate(StoreBase):
    pass

class StoreResponse(StoreBase):
    id: int
    created_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)
