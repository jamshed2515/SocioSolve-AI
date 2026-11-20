"""
Cloudinary media storage helper (backend only).

Uploads images and documents to Cloudinary when credentials are configured in `.env`.
Never disables SSL verification; secrets stay strictly on the backend.
"""
import io
import logging
from typing import Optional

from fastapi import HTTPException, status
from fastapi.concurrency import run_in_threadpool

from app.config.settings import settings

logger = logging.getLogger(__name__)
_configured = False


def is_cloudinary_configured() -> bool:
    """Return True if Cloudinary credentials are configured."""
    if settings.CLOUDINARY_URL:
        return True
    return bool(
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    )


def _ensure_configured() -> None:
    global _configured
    if _configured:
        return
    import cloudinary

    if settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET:
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )
    elif settings.CLOUDINARY_URL:
        cloudinary.config(cloudinary_url=settings.CLOUDINARY_URL, secure=True)
    else:
        raise RuntimeError("Cloudinary credentials are not configured.")
    _configured = True


def _sync_upload(
    contents: bytes,
    folder: str,
    public_id: str,
    resource_type: str,
    filename: Optional[str],
) -> str:
    _ensure_configured()
    import cloudinary.uploader

    kwargs = {
        "folder": folder,
        "public_id": public_id,
        "resource_type": resource_type,
        "overwrite": True,
        "unique_filename": False,
    }
    if filename:
        kwargs["filename_override"] = filename

    result = cloudinary.uploader.upload(io.BytesIO(contents), **kwargs)
    secure_url = result.get("secure_url")
    if not secure_url:
        raise RuntimeError("Cloudinary did not return a secure_url.")
    return secure_url


async def upload_bytes_to_cloudinary(
    contents: bytes,
    *,
    folder: str,
    public_id: str,
    resource_type: str = "auto",
    filename: Optional[str] = None,
) -> str:
    """Upload raw bytes to Cloudinary in a worker thread and return the HTTPS secure_url."""
    try:
        return await run_in_threadpool(
            _sync_upload,
            contents,
            folder,
            public_id,
            resource_type,
            filename,
        )
    except Exception as exc:
        logger.error("Cloudinary upload failed (folder=%s, public_id=%s): %s", folder, public_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to upload file to cloud storage. Please try again.",
        )
