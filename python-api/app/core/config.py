from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
import logging

logger = logging.getLogger("app.config")

class Settings(BaseSettings):
    PROJECT_NAME: str = "Store Control Center API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # JWT Settings
    SECRET_KEY: str = "change_this_to_a_secure_random_string_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    
    # Database Settings
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "store_control_center"
    POSTGRES_PORT: str = "5432"
    
    # External APIs
    SUITE_API: str = "https://lab-sapi.guta.asia"
    MAIN_STORE_SYNC_URL: str = "https://gapi.guta.asia/webapi/stores?all_stores=true"
    
    # CORS
    ALLOWED_ORIGINS: str = "*"  # Comma-separated, e.g. "http://localhost:3000,https://prod.example.com"
    
    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    @property
    def cors_origins(self) -> list[str]:
        if self.ALLOWED_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]
    
    @model_validator(mode='after')
    def validate_secret(self):
        if self.SECRET_KEY == "change_this_to_a_secure_random_string_in_production":
            logger.warning("⚠️  SECRET_KEY chưa được cấu hình! Đang dùng key mặc định, KHÔNG AN TOÀN cho production.")
        return self
        
    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
