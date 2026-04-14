import requests as http_requests

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.db.models import Q
from django.utils import timezone
from typing import Any
from rest_framework import serializers

from .models import Friendship, LOCKOUT_DURATION_MINUTES, MAX_FAILED_ATTEMPTS, User


# ---------------------------------------------------------------------------
# Auth serializers (unchanged)
# ---------------------------------------------------------------------------

class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=50)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)
    recaptcha_token = serializers.CharField(write_only=True)
    terms_accepted = serializers.BooleanField(write_only=True)

    def validate_email(self, value: str) -> str:
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def validate_username(self, value: str) -> str:
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_password(self, value: str) -> str:
        validate_password(value)
        return value

    def validate_recaptcha_token(self, value: str) -> str:
        """Verify reCAPTCHA token với Google siteverify API."""
        if not settings.RECAPTCHA_ENABLED:
            return value  # bypass trong development/test

        if not value:
            raise serializers.ValidationError("reCAPTCHA token bị thiếu.")

        secret = settings.RECAPTCHA_SECRET_KEY
        if not secret:
            raise serializers.ValidationError(
                "reCAPTCHA chưa được cấu hình phía server."
            )

        try:
            resp = http_requests.post(
                settings.RECAPTCHA_VERIFY_URL,
                data={"secret": secret, "response": value},
                timeout=5,
            )
            result = resp.json()
        except Exception:
            raise serializers.ValidationError(
                "Không thể xác minh reCAPTCHA. Vui lòng thử lại."
            )

        if not result.get("success"):
            error_codes = result.get("error-codes", [])
            raise serializers.ValidationError(
                f"reCAPTCHA xác minh thất bại: {', '.join(error_codes)}"
            )

        return value

    def validate_terms_accepted(self, value: bool) -> bool:
        if not value:
            raise serializers.ValidationError(
                "Bạn phải đồng ý với Điều khoản dịch vụ và Chính sách "
                "bảo mật để tiếp tục."
            )
        return value

    def validate(self, data: dict[str, Any]) -> dict[str, Any]:
        if data["password"] != data["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Passwords do not match."}
            )
        return data

    def create(self, validated_data: dict[str, Any]) -> User:
        validated_data.pop("password_confirm")
        validated_data.pop("recaptcha_token")
        terms_accepted = validated_data.pop("terms_accepted")

        user = User.objects.create_user(
            **validated_data,
            is_active=False,
        )
        if terms_accepted:
            user.terms_accepted_at = timezone.now()
            user.save(update_fields=["terms_accepted_at"])

        from .utils import send_verification_email

        send_verification_email(user)
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data: dict[str, Any]) -> dict[str, Any]:
        email = data.get("email", "").lower()

        try:
            user_obj = User.objects.get(email=email)
            if user_obj.is_locked_out():
                remaining = user_obj.remaining_lockout_seconds()
                minutes = remaining // 60
                seconds = remaining % 60
                raise serializers.ValidationError(
                    f"Tài khoản tạm thời bị khóa do đăng nhập sai nhiều lần. "
                    f"Thử lại sau {minutes} phút {seconds} giây."
                )
        except User.DoesNotExist:
            pass

        user = authenticate(email=email, password=data["password"])
        if user is None:
            try:
                failed_user = User.objects.get(email=email)
                failed_user.record_failed_login()
                remaining_attempts = max(
                    0, MAX_FAILED_ATTEMPTS - failed_user.failed_login_attempts
                )
                if failed_user.is_locked_out():
                    raise serializers.ValidationError(
                        f"Tài khoản đã bị khóa {LOCKOUT_DURATION_MINUTES} phút "
                        f"do đăng nhập sai quá {MAX_FAILED_ATTEMPTS} lần."
                    )
                if remaining_attempts <= 2:
                    raise serializers.ValidationError(
                        f"Sai mật khẩu. Còn {remaining_attempts} lần thử "
                        f"trước khi tài khoản bị khóa tạm thời."
                    )
            except User.DoesNotExist:
                pass

            raise serializers.ValidationError("Email hoặc mật khẩu không đúng.")
        if not user.is_active:
            raise serializers.ValidationError("Tài khoản này đã bị vô hiệu hóa.")

        user.clear_failed_logins()
        data["user"] = user
        return data


# ---------------------------------------------------------------------------
# User serializers
# ---------------------------------------------------------------------------

class UserMiniSerializer(serializers.ModelSerializer):
    """Lightweight serializer for embedding in posts, comments, etc."""

    class Meta:
        model = User
        fields = ("id", "username", "avatar")
        read_only_fields = fields


class UserProfileSerializer(serializers.ModelSerializer):
    """Full profile — used when viewing any user's profile page."""

    friends_count = serializers.SerializerMethodField()
    posts_count = serializers.SerializerMethodField()
    friendship_status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "avatar",
            "cover_photo",
            "bio",
            "date_of_birth",
            "friends_count",
            "posts_count",
            "friendship_status",
            "is_staff",
            "is_superuser",
            "created_at",
        )
        read_only_fields = ("id", "email", "is_staff", "is_superuser", "created_at")

    # -- computed fields -----------------------------------------------------

    def get_friends_count(self, obj: User) -> int:
        return (
            obj.friendships_sent.filter(status="accepted").count()
            + obj.friendships_received.filter(status="accepted").count()
        )

    def get_posts_count(self, obj: User) -> int:
        return obj.posts.count()

    def get_friendship_status(self, obj: User) -> str:
        """
        Return the friendship status between the *request user* and *obj*.
        Possible values: "self", "accepted", "pending", "sent", "none".
        """
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return "none"

        me = request.user
        if me.pk == obj.pk:
            return "self"

        # I sent a request to this user
        sent = Friendship.objects.filter(from_user=me, to_user=obj).first()
        if sent:
            return "sent" if sent.status == "pending" else sent.status

        # This user sent a request to me
        received = Friendship.objects.filter(from_user=obj, to_user=me).first()
        if received:
            return "pending" if received.status == "pending" else received.status

        return "none"


class UpdateProfileSerializer(serializers.ModelSerializer):
    """Only the fields a user is allowed to edit on their own profile."""

    class Meta:
        model = User
        fields = ("username", "bio", "avatar", "cover_photo", "date_of_birth")

    def _validate_image(self, image: Any) -> Any:
        if not image:
            return image
        max_size = 5 * 1024 * 1024  # 5MB
        allowed_types = {"image/jpeg", "image/png", "image/webp"}
        content_type = getattr(image, "content_type", "")
        size = getattr(image, "size", 0)
        if size > max_size:
            raise serializers.ValidationError("Image must be <= 5MB.")
        if content_type not in allowed_types:
            raise serializers.ValidationError(
                "Unsupported image type. Only JPG, PNG, WEBP are allowed."
            )
        return image

    def validate_avatar(self, value: Any) -> Any:
        return self._validate_image(value)

    def validate_cover_photo(self, value: Any) -> Any:
        return self._validate_image(value)

    def validate_username(self, value: str) -> str:
        user = self.instance
        if User.objects.filter(username=value).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value


# ---------------------------------------------------------------------------
# Friendship serializers
# ---------------------------------------------------------------------------

class FriendshipSerializer(serializers.ModelSerializer):
    from_user = UserMiniSerializer(read_only=True)
    to_user = UserMiniSerializer(read_only=True)

    class Meta:
        model = Friendship
        fields = ("id", "from_user", "to_user", "status", "created_at")
        read_only_fields = fields
