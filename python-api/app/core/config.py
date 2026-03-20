from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
import logging

logger = logging.getLogger("app.config")

class Settings(BaseSettings):
    PROJECT_NAME: str = "Store Control Center API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # JWT Settings
    SECRET_KEY: str = "change_me_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    
    # Database Settings (Defaults are for local dev without docker)
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "store_control_center"
    POSTGRES_PORT: str = "5432"
    
    # External APIs
    SUITE_API: str = "https://lab-sapi.guta.asia"
    MAIN_STORE_SYNC_URL: str = "https://gapi.guta.asia/webapi/stores?all_stores=true"
    SUITE_VERIFY_TOKEN: bool = False
    SUITE_PUBLIC_KEY_FILE: str = ""
    
    # CORS
    ALLOWED_ORIGINS: str = "*"
    CORS_ALLOW_CREDENTIALS: bool = True
    
    # Admin
    ENABLE_SQLADMIN: bool = False
    SQLADMIN_USERNAME: str = ""
    SQLADMIN_PASSWORD: str = ""
    SQLADMIN_SESSION_SECRET: str = ""

    # Bootstrap Admin (for first-time DB initialization)
    ENABLE_BOOTSTRAP_ADMIN: bool = True
    BOOTSTRAP_ADMIN_EMAIL: str = "admin@storecontrol.local"
    BOOTSTRAP_ADMIN_NAME: str = "System Administrator"
    BOOTSTRAP_ADMIN_PHONE_NUMBER: str = ""
    
    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    @property
    def cors_origins(self) -> list[str]:
        if self.ALLOWED_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    @property
    def cors_allow_credentials(self) -> bool:
        if self.ALLOWED_ORIGINS == "*":
            return False
        return self.CORS_ALLOW_CREDENTIALS
    
    @model_validator(mode='after')
    def validate_secret(self):
        if self.SECRET_KEY == "change_me_in_production":
            logger.warning("⚠️  SECRET_KEY chưa được cấu hình! Đang dùng key mặc định, KHÔNG AN TOÀN cho production.")
        return self
        
    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
