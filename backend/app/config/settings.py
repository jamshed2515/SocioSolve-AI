from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "SocioSolve-AI"
    DEBUG: bool = True

    # MongoDB (MONGODB_URI preferred; MONGODB_URL kept for backward compatibility)
    MONGODB_URI: str = ""
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "sociosolve"

    # Firebase Admin SDK (service account key stays on the backend only).
    # The project ID is public (it is also in the frontend web config).
    FIREBASE_PROJECT_ID: str = "sociosolve-ai"
    FIREBASE_SERVICE_ACCOUNT_PATH: str = ""
    # Alternative to the file: the key's JSON (raw or base64) in a single env var
    FIREBASE_SERVICE_ACCOUNT_JSON: str = ""

    # CORS (CORS_ORIGINS preferred; ALLOWED_ORIGINS kept for backward compatibility)
    CORS_ORIGINS: str = ""
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Re-authentication window (seconds) required for sensitive actions like password change
    RECENT_LOGIN_MAX_AGE: int = 300

    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"

    # Cloudinary (media uploads - secret stays on backend only)
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    CLOUDINARY_URL: str = ""

    @property
    def mongodb_uri(self) -> str:
        return self.MONGODB_URI or self.MONGODB_URL

    @property
    def allowed_origins_list(self) -> List[str]:
        raw = self.CORS_ORIGINS or self.ALLOWED_ORIGINS
        return [o.strip() for o in raw.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
