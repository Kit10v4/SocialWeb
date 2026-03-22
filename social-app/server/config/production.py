import os

from .base import *  # noqa

# Force production-safe defaults
DEBUG = False
SECRET_KEY = os.environ["SECRET_KEY"]  # must be set in environment

ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost").split(",")

# Security headers
SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "True").lower() in (
    "true",
    "1",
    "yes",
)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# CSRF
CSRF_TRUSTED_ORIGINS = [
    origin
    for origin in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",")
    if origin
]
if not CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS = [
        "https://social-app-api-p54k.onrender.com",
        "https://social-app-api.onrender.com",
    ]
