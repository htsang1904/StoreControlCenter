from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Store Control Center API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # JWT Settings
    SECRET_KEY: str = Field(..., min_length=32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    
    # Database Settings
    POSTGRES_SERVER: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    POSTGRES_PORT: str
    
    # External APIs
    SUITE_API: str = "https://lab-sapi.guta.asia"
    SUITE_WEB_URL: str = "https://suite.guta.vn"
    SUITE_PLATFORM_TOKEN: str = ""
    MAIN_STORE_SYNC_URL: str = "https://gapi.guta.asia/webapi/stores?all_stores=true"
    SUITE_VERIFY_TOKEN: bool = False
    SUITE_PUBLIC_KEY_FILE: str = ""

    # OneSignal transactional web push
    ONESIGNAL_APP_ID: str = ""
    ONESIGNAL_REST_API_KEY: str = ""
    ONESIGNAL_API_URL: str = "https://api.onesignal.com/notifications"
    APP_PUBLIC_URL: str = ""

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
    
    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
