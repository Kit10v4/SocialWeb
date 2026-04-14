import io
import logging
import threading

import requests as http_requests
from django.conf import settings
from django.core.files.uploadedfile import InMemoryUploadedFile
from PIL import Image

from .models import AuditLog, EmailVerificationToken

logger = logging.getLogger(__name__)


def resize_image(image_file, size=(400, 400)):
    """
    Resize an uploaded image to *size* (width, height), preserving aspect
    ratio via thumbnail().  Returns a new InMemoryUploadedFile ready for
    saving on the model field (works with Cloudinary storage).
    """
    img = Image.open(image_file)

    # Convert palette / RGBA images so JPEG save won't fail
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    img.thumbnail(size, Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    buf.seek(0)

    return InMemoryUploadedFile(
        file=buf,
        field_name=image_file.name,
        name=image_file.name.rsplit(".", 1)[0] + ".jpg",
        content_type="image/jpeg",
        size=buf.getbuffer().nbytes,
        charset=None,
    )


def _send_mail_async(subject, message, from_email, recipient_list):
    """Gửi email qua Resend HTTP API trong background thread."""
    def _send():
        api_key = getattr(settings, "RESEND_API_KEY", "")
        if not api_key:
            logger.warning("RESEND_API_KEY not configured, skipping email to %s", recipient_list)
            return

        try:
            resp = http_requests.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": from_email,
                    "to": recipient_list,
                    "subject": subject,
                    "text": message,
                },
                timeout=10,
            )
            if resp.status_code in (200, 201):
                logger.info("Email sent to %s via Resend", recipient_list)
            else:
                logger.error(
                    "Resend API error %s for %s: %s",
                    resp.status_code, recipient_list, resp.text,
                )
        except Exception as e:
            logger.error("Failed to send email to %s: %s", recipient_list, e)

    thread = threading.Thread(target=_send, daemon=True)
    thread.start()


def send_verification_email(user):
    """Gửi email xác minh tài khoản (non-blocking)."""
    token_obj = EmailVerificationToken.create_for_user(user)
    verify_url = (
        f"{settings.FRONTEND_URL}/verify-email"
        f"?token={token_obj.token}"
    )

    _send_mail_async(
        subject="[SocialWeb] Xác minh địa chỉ email",
        message=(
            f"Chào {user.username},\n\n"
            f"Cảm ơn bạn đã đăng ký SocialWeb!\n"
            f"Nhấn vào link sau để xác minh email (hiệu lực 24 giờ):\n\n"
            f"{verify_url}\n\n"
            f"Nếu bạn không đăng ký tài khoản này, hãy bỏ qua email này.\n\n"
            f"— Đội SocialWeb"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )


def get_client_ip(request) -> str:
    """Lấy IP thực của client, xử lý proxy."""
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def log_audit_event(
    request,
    event_type: str,
    email: str = "",
    user=None,
    detail: dict | None = None,
) -> None:
    """Ghi audit log. Không raise exception nếu thất bại."""
    try:
        AuditLog.objects.create(
            event_type=event_type,
            email=email[:254] if email else "",
            user=user,
            ip_address=get_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
            detail=detail or {},
        )
    except Exception as exc:
        logging.getLogger(__name__).error("Không thể ghi audit log: %s", exc)
