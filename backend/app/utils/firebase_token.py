"""
Firebase ID token verification.

`verify_id_token` checks the RS256 signature against Google's public certs,
`aud` == Firebase project ID, `iss` == https://securetoken.google.com/<project>,
`exp`/`iat`/`auth_time`, and a non-empty `sub`. With `check_revoked=True` it also
rejects tokens issued before the user's refresh tokens were revoked and tokens
belonging to disabled Firebase accounts.
"""
from fastapi import HTTPException, status
from firebase_admin import auth as fb_auth

from app.config.firebase import has_admin_credentials

CLOCK_SKEW_SECONDS = 5


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def verify_firebase_token(id_token: str) -> dict:
    """Return decoded claims or raise an HTTPException with a safe message."""
    if not id_token:
        raise _unauthorized("Missing authentication token.")
    try:
        # The revocation check calls Firebase's admin API, so it needs the service-account
        # key. In local limited mode (no key) the signature/claims checks still run.
        return fb_auth.verify_id_token(
            id_token,
            check_revoked=has_admin_credentials(),
            clock_skew_seconds=CLOCK_SKEW_SECONDS,
        )
    # Subclasses of InvalidIdTokenError must be caught first
    except fb_auth.ExpiredIdTokenError:
        raise _unauthorized("Authentication token expired.")
    except fb_auth.RevokedIdTokenError:
        raise _unauthorized("Authentication token revoked. Please sign in again.")
    except fb_auth.UserDisabledError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled.")
    except fb_auth.CertificateFetchError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Unable to verify token right now.")
    except (fb_auth.InvalidIdTokenError, ValueError):
        raise _unauthorized("Invalid authentication token.")
