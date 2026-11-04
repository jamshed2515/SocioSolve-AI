"""
Email service – sends password reset emails.
In MOCK_EMAIL mode, the reset link is printed to console instead.
"""
import logging
from app.config.settings import settings

logger = logging.getLogger(__name__)


async def send_password_reset_email(email: str, reset_token: str) -> None:
    """
    Send (or mock) a password reset email.
    The reset link points to the frontend reset-password page with the token.
    """
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"

    if settings.MOCK_EMAIL:
        # ── MOCK MODE: print to console ──────────────────────────────────
        logger.info("=" * 60)
        logger.info("📧  MOCK PASSWORD RESET EMAIL")
        logger.info(f"   To:   {email}")
        logger.info(f"   Link: {reset_link}")
        logger.info("   (This link expires in 1 hour)")
        logger.info("=" * 60)
        return

    # ── REAL EMAIL (configure SMTP in .env to enable) ────────────────────
    try:
        import emails  # type: ignore

        message = emails.html(
            subject="SocioSolve-AI – Password Reset",
            html=f"""
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
              <h2 style="color:#6C63FF;">SocioSolve-AI</h2>
              <p>Hi,</p>
              <p>We received a request to reset your password.
                 Click the button below to set a new password.
                 This link expires in <strong>1 hour</strong>.</p>
              <a href="{reset_link}"
                 style="display:inline-block;padding:12px 24px;background:#6C63FF;
                        color:#fff;border-radius:6px;text-decoration:none;
                        font-weight:bold;">
                Reset Password
              </a>
              <p>If you did not request this, ignore this email.</p>
              <hr/>
              <small>SocioSolve-AI Societal Challenges Platform</small>
            </div>
            """,
            mail_from=(settings.APP_NAME, settings.EMAIL_FROM),
        )
        response = message.send(
            to=email,
            smtp={
                "host": settings.SMTP_HOST,
                "port": settings.SMTP_PORT,
                "user": settings.SMTP_USER,
                "password": settings.SMTP_PASSWORD,
                "tls": True,
            },
        )
        if response.status_code not in (250,):
            logger.error(f"Email send failed: {response}")
    except Exception as exc:
        logger.error(f"Email error: {exc}")
