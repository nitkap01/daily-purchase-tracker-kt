"""
In-memory Google service-account credentials store.

The value is a raw JSON string (same shape as GOOGLE_CREDENTIALS_JSON env var).
It is set at runtime via POST /api/credentials/upload and takes priority
over the environment variable.
"""
import os

_runtime_credentials: str | None = None


def set_credentials(json_str: str) -> None:
    global _runtime_credentials
    _runtime_credentials = json_str


def get_credentials() -> str | None:
    """Return uploaded creds, falling back to env var."""
    return _runtime_credentials or os.getenv("GOOGLE_CREDENTIALS_JSON")


def has_credentials() -> bool:
    return bool(get_credentials())
