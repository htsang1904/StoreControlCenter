from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.schemas.user import StoreResponse, UserMinimalResponse

# --- Base QC Form Schemas ---
class QCFormBase(BaseModel):
    code: str
    name: str

class QCFormResponse(QCFormBase):
    id: int
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

class QCFormVersionResponse(BaseModel):
    id: int
    version_no: str
    status: str
    pass_rule: Optional[dict[str, object]] = None
    form: Optional[QCFormResponse] = None

    model_config = ConfigDict(from_attributes=True)

# --- QC Session Schemas ---
class QCSessionBase(BaseModel):
    code: str
    status: str = "draft"
    result: str = "pending"
    total_score: Decimal = Decimal(0)
    max_score: Decimal = Decimal(0)
    note: Optional[str] = None
    
    store_id: int
    form_version_id: int
    auditor_id: Optional[int] = None
    audited_at: datetime

class QCSessionCreate(QCSessionBase):
    pass


class QCSessionCriterionInput(BaseModel):
    id: Optional[int] = None
    name: Optional[str] = None
    mode: str = "point"
    max_score: Decimal = Field(
        default=Decimal(0),
        validation_alias=AliasChoices("max_score", "maxScore"),
    )
    min_pass_score: Optional[Decimal] = Field(
        default=None,
        validation_alias=AliasChoices("min_pass_score", "minPassScore", "passScore"),
    )
    deduction_percent: Decimal = Field(
        default=Decimal(0),
        validation_alias=AliasChoices("deduction_percent", "deductionPercent"),
    )
    status: str = "pending"
    score: Optional[Decimal] = None
    applicable: Optional[bool] = None
    requires_fix: Optional[bool] = Field(
        default=None,
        validation_alias=AliasChoices("requires_fix", "requiresFix"),
    )
    note: Optional[str] = None
    attachments: Optional[list[dict[str, object]]] = None

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class QCSessionCreateRequest(BaseModel):
    store_id: int = Field(validation_alias=AliasChoices("store_id", "storeId"))
    form_version_id: int = Field(
        validation_alias=AliasChoices("form_version_id", "formVersionId")
    )
    audited_at: datetime = Field(
        validation_alias=AliasChoices("audited_at", "auditedAt")
    )
    note: Optional[str] = None
    status: str = "draft"
    result: str = "pending"
    criteria: list[QCSessionCriterionInput] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class QCSessionResponse(QCSessionBase):
    id: int
    submitted_at: Optional[datetime] = None
    auditor: Optional[UserMinimalResponse] = None
    store: Optional[StoreResponse] = None
    form_version: Optional[QCFormVersionResponse] = None
    created_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class QCSessionItemResponse(BaseModel):
    id: int
    session_id: int
    criterion_id: Optional[int] = None
    criterion_code: Optional[str] = None
    criterion_name: str
    mode_snapshot: str
    max_score_snapshot: Decimal
    min_pass_score_snapshot: Optional[Decimal] = None
    severity_snapshot: str = "normal"
    result: str
    score: Optional[Decimal] = None
    applicable: bool
    requires_fix: bool
    note: Optional[str] = None
    attachments: Optional[list[dict[str, object]]] = None
    
    model_config = ConfigDict(from_attributes=True)
    
class QCFindingResponse(BaseModel):
    id: int
    finding_code: str
    criterion_name: Optional[str] = None
    severity: str
    status: str
    due_date: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class QCSessionDetailResponse(QCSessionResponse):
    items: list[QCSessionItemResponse] = Field(default_factory=list)
    findings: list[QCFindingResponse] = Field(default_factory=list)


class PaginationMeta(BaseModel):
    page: int
    pageSize: int
    total: int
    pageCount: int


class QCDraftCreateRequest(BaseModel):
    store_id: int = Field(validation_alias=AliasChoices("store_id", "storeId"))
    template_id: str = Field(validation_alias=AliasChoices("template_id", "templateId"))
    form_version_id: Optional[int] = Field(
        default=None,
        validation_alias=AliasChoices("form_version_id", "formVersionId"),
    )
    audited_at: Optional[datetime] = Field(
        default=None,
        validation_alias=AliasChoices("audited_at", "auditedAt"),
    )
    note: str = ""
    criteria_states: dict[str, object] = Field(
        default_factory=dict,
        validation_alias=AliasChoices("criteria_states", "criteriaStates"),
    )

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class QCDraftUpdateRequest(BaseModel):
    store_id: Optional[int] = Field(
        default=None,
        validation_alias=AliasChoices("store_id", "storeId"),
    )
    template_id: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("template_id", "templateId"),
    )
    form_version_id: Optional[int] = Field(
        default=None,
        validation_alias=AliasChoices("form_version_id", "formVersionId"),
    )
    audited_at: Optional[datetime] = Field(
        default=None,
        validation_alias=AliasChoices("audited_at", "auditedAt"),
    )
    note: Optional[str] = None
    criteria_states: Optional[dict[str, object]] = Field(
        default=None,
        validation_alias=AliasChoices("criteria_states", "criteriaStates"),
    )

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class QCDraftData(BaseModel):
    id: int
    store_id: int
    storeId: int
    auditor_id: Optional[int] = None
    auditorId: Optional[int] = None
    template_id: str
    templateId: str
    form_version_id: Optional[int] = None
    formVersionId: Optional[int] = None
    audited_at: Optional[datetime] = None
    auditedAt: Optional[datetime] = None
    note: Optional[str] = None
    criteria_states: dict[str, object] = Field(default_factory=dict)
    criteriaStates: dict[str, object] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    createdAt: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    updatedAt: Optional[datetime] = None


class QCDraftSingleResponse(BaseModel):
    success: bool
    data: QCDraftData


class QCDraftListResponse(BaseModel):
    success: bool
    data: list[QCDraftData]
    pagination: PaginationMeta


class SuccessMessageResponse(BaseModel):
    success: bool
    message: str
