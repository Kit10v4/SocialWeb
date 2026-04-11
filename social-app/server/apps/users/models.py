import uuid
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15


class UserManager(BaseUserManager):
    """Custom manager for User model."""

    def create_user(self, email, username, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        if not username:
            raise ValueError("Username is required")

        email = self.normalize_email(email)
        user = self.model(email=email, username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, username, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, username, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom User model with UUID primary key."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=50, unique=True)
    email = models.EmailField(unique=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True)
    cover_photo = models.ImageField(upload_to="covers/", blank=True)
    bio = models.TextField(max_length=500, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    terms_accepted_at = models.DateTimeField(null=True, blank=True)
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    last_failed_login = models.DateTimeField(null=True, blank=True)
    locked_until = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "user"
        verbose_name_plural = "users"
        indexes = [
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return self.username

    def is_locked_out(self) -> bool:
        if self.locked_until and timezone.now() < self.locked_until:
            return True
        return False

    def remaining_lockout_seconds(self) -> int:
        if self.locked_until and timezone.now() < self.locked_until:
            delta = self.locked_until - timezone.now()
            return max(0, int(delta.total_seconds()))
        return 0

    def record_failed_login(self) -> None:
        now = timezone.now()
        if (
            self.last_failed_login
            and now - self.last_failed_login
            > timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        ):
            self.failed_login_attempts = 0

        self.failed_login_attempts += 1
        self.last_failed_login = now

        if self.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            self.locked_until = now + timedelta(minutes=LOCKOUT_DURATION_MINUTES)

        self.save(
            update_fields=[
                "failed_login_attempts",
                "last_failed_login",
                "locked_until",
            ]
        )

    def clear_failed_logins(self) -> None:
        if self.failed_login_attempts > 0 or self.locked_until:
            self.failed_login_attempts = 0
            self.last_failed_login = None
            self.locked_until = None
            self.save(
                update_fields=[
                    "failed_login_attempts",
                    "last_failed_login",
                    "locked_until",
                ]
            )


class Friendship(models.Model):
    """Friendship / friend-request model."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        BLOCKED = "blocked", "Blocked"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    from_user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="friendships_sent"
    )
    to_user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="friendships_received"
    )
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("from_user", "to_user")
        ordering = ["-created_at"]
        verbose_name = "friendship"
        verbose_name_plural = "friendships"
        indexes = [
            models.Index(fields=["from_user", "status"]),
            models.Index(fields=["to_user", "status"]),
        ]

    def __str__(self):
        return f"{self.from_user} → {self.to_user} ({self.status})"


class Report(models.Model):
    """User report model."""

    class Reason(models.TextChoices):
        SPAM = 'spam', 'Spam'
        SENSITIVE = 'sensitive', 'Sensitive content'
        IMPERSONATION = 'impersonation', 'Impersonation'
        OTHER = 'other', 'Other'

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reports_sent'
    )
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reports_received'
    )
    reason = models.CharField(max_length=20, choices=Reason.choices)
    detail = models.TextField(max_length=1000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('reporter', 'target_user')
        verbose_name = "report"
        verbose_name_plural = "reports"

    def __str__(self):
        return f"{self.reporter} reported {self.target_user} ({self.reason})"


class EmailVerificationToken(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="email_verification_token",
    )
    token = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_valid(self) -> bool:
        """Token còn hiệu lực trong 24 giờ."""
        expiry = self.created_at + timedelta(hours=24)
        return timezone.now() < expiry

    @classmethod
    def create_for_user(cls, user):
        cls.objects.filter(user=user).delete()
        token = secrets.token_urlsafe(32)
        return cls.objects.create(user=user, token=token)


class PasswordResetToken(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="password_reset_tokens",
    )
    token = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"PasswordResetToken({self.user.email}, used={self.is_used})"

    @classmethod
    def create_for_user(cls, user):
        cls.objects.filter(user=user, is_used=False).delete()
        token = secrets.token_urlsafe(32)
        return cls.objects.create(user=user, token=token)

    def is_valid(self) -> bool:
        if self.is_used:
            return False
        expiry = self.created_at + timedelta(hours=1)
        return timezone.now() < expiry


class AuditLog(models.Model):
    class EventType(models.TextChoices):
        LOGIN_SUCCESS = "login_success", "Đăng nhập thành công"
        LOGIN_FAILED = "login_failed", "Đăng nhập thất bại"
        LOGIN_LOCKED = "login_locked", "Tài khoản bị khóa"
        REGISTER_SUCCESS = "register_success", "Đăng ký thành công"
        REGISTER_FAILED = "register_failed", "Đăng ký thất bại"
        PASSWORD_RESET = "password_reset", "Đặt lại mật khẩu"
        EMAIL_VERIFIED = "email_verified", "Xác minh email"
        LOGOUT = "logout", "Đăng xuất"

    event_type = models.CharField(max_length=30, choices=EventType.choices)
    email = models.EmailField(blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    detail = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["event_type", "created_at"]),
            models.Index(fields=["ip_address", "created_at"]),
            models.Index(fields=["email", "created_at"]),
        ]

    def __str__(self):
        return f"[{self.event_type}] {self.email} @ {self.ip_address}"
