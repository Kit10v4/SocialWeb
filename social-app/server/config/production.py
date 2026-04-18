import os

from .base import *  # noqa

# ── Core ─────────────────────────────────────────────────────
DEBUG = False
SECRET_KEY = os.environ["SECRET_KEY"]  # bắt buộc, fail nếu thiếu
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "").split(",")

# ── HTTPS / SSL ──────────────────────────────────────────────
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# ── HSTS ─────────────────────────────────────────────────────
SECURE_HSTS_SECONDS = 31536000  # 1 năm
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# ── Cookie security ──────────────────────────────────────────
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"

CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = "Lax"

# ── Security headers bổ sung ─────────────────────────────────
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = "DENY"

# ── Referrer Policy ──────────────────────────────────────────
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

# ── CORS ─────────────────────────────────────────────────────
_cors_origins = os.getenv("CORS_ALLOWED_ORIGINS", "")
CORS_ALLOWED_ORIGINS = [
    o.strip() for o in _cors_origins.split(",") if o.strip()
]

# ── CSRF Trusted Origins ─────────────────────────────────────
_csrf = os.getenv("CSRF_TRUSTED_ORIGINS", "")
CSRF_TRUSTED_ORIGINS = [o.strip() for o in _csrf.split(",") if o.strip()]
if not CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS = [
        "https://social-app-api-p54k.onrender.com",
        "https://social-app-api.onrender.com",
    ]

# ── Cache (Redis nếu có, fallback LocMem) ────────────────────
_redis_url = os.getenv("REDIS_URL")
if _redis_url:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": _redis_url,
        }
    }
else:
    # Fallback to LocMemCache when Redis is not available
    # Required for django-ratelimit to work
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "unique-snowflake",
        }
    }

# ── reCAPTCHA ────────────────────────────────────────────────
RECAPTCHA_ENABLED = True  # bắt buộc bật trên production

# ── Email ────────────────────────────────────────────────────
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER)

SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
# Tự động dùng SendGrid nếu có API key, ngược lại fallback SMTP
EMAIL_PROVIDER = "sendgrid" if SENDGRID_API_KEY else "smtp"
