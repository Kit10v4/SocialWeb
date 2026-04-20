import io
import logging
import threading

from django.conf import settings
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.core.mail import send_mail
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


def _send_mail_sync(subject, message, from_email, recipient_list):
    """Gửi email đồng bộ qua provider được cấu hình (smtp/sendgrid)."""
    provider = getattr(settings, "EMAIL_PROVIDER", "smtp").strip().lower()
    if provider == "sendgrid":
        api_key = getattr(settings, "SENDGRID_API_KEY", "")
        if not api_key:
            logger.warning("SENDGRID_API_KEY not configured, skipping email to %s", recipient_list)
            return False
        if not from_email:
            logger.warning("DEFAULT_FROM_EMAIL not configured, skipping email to %s", recipient_list)
            return False

        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail

            msg = Mail(
                from_email=from_email,
                to_emails=recipient_list,
                subject=subject,
                plain_text_content=message,
            )
            client = SendGridAPIClient(api_key)
            response = client.send(msg)
            print("=== SENDGRID DEBUG ===")
            print(f"Status: {response.status_code}")
            body = (
                response.body.decode("utf-8", errors="replace")
                if isinstance(response.body, (bytes, bytearray))
                else str(response.body)
            )
            print(f"Body: {body}")
            if 200 <= response.status_code < 300:
                logger.info("Email sent to %s via SendGrid SDK", recipient_list)
                return True
            logger.error(
                "SendGrid SDK failed for %s: status=%s body=%s",
                recipient_list,
                response.status_code,
                response.body[:500],
            )
            return False
        except Exception as e:
            logger.error("SendGrid SDK error for %s: %s", recipient_list, e)
            return False

    if not getattr(settings, "EMAIL_HOST_USER", ""):
        logger.warning("EMAIL_HOST_USER not configured, skipping email to %s", recipient_list)
        return False

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=recipient_list,
            fail_silently=False,
        )
        logger.info("Email sent to %s via SMTP", recipient_list)
        return True
    except Exception as e:
        logger.error("Failed to send email to %s: %s", recipient_list, e)
        return False


def _send_mail_async(subject, message, from_email, recipient_list):
    """Gửi email trong background thread (non-blocking)."""
    thread = threading.Thread(
        target=_send_mail_sync,
        args=(subject, message, from_email, recipient_list),
        daemon=True,
    )
    thread.start()


def send_verification_email(user):
    """Gửi email xác minh tài khoản sau khi DB commit xong."""
    from django.db import transaction

    def _do_send():
        try:
            from django.db import close_old_connections
            close_old_connections()
            token_obj = EmailVerificationToken.create_for_user(user)
            verify_url = (
                f"{settings.FRONTEND_URL}/verify-email"
                f"?token={token_obj.token}"
            )
            _send_mail_sync(
                subject="[Connect] Xác minh địa chỉ email",
                message=(
                    f"Chào {user.username},\n\n"
                    f"Cảm ơn bạn đã đăng ký Connect!\n"
                    f"Nhấn vào link sau để xác minh email (hiệu lực 24 giờ):\n\n"
                    f"{verify_url}\n\n"
                    f"Nếu bạn không đăng ký tài khoản này, hãy bỏ qua email này.\n\n"
                    f"— Đội Connect"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
            )
        except Exception as e:
            logger.error("send_verification_email failed for %s: %s", user.email, e)

    def _send_in_thread():
        thread = threading.Thread(target=_do_send)
        thread.start()

    transaction.on_commit(_send_in_thread)


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
