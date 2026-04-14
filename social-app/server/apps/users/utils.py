import io
import logging

from django.conf import settings
from django.core.mail import send_mail
from django.core.files.uploadedfile import InMemoryUploadedFile
from PIL import Image

from .models import AuditLog, EmailVerificationToken


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


def send_verification_email(user):
    """Gửi email xác minh tài khoản."""
    logger = logging.getLogger(__name__)
    
    token_obj = EmailVerificationToken.create_for_user(user)
    verify_url = (
        f"{settings.FRONTEND_URL}/verify-email"
        f"?token={token_obj.token}"
    )

    try:
        send_mail(
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
            fail_silently=False,
        )
        logger.info(f"Verification email sent to {user.email}")
    except Exception as e:
        logger.error(f"Failed to send verification email to {user.email}: {e}")


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
