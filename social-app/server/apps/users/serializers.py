from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.db.models import Q
from rest_framework import serializers

from .models import Friendship, User


# ---------------------------------------------------------------------------
# Auth serializers (unchanged)
# ---------------------------------------------------------------------------

class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=50)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, data):
        if data["password"] != data["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Passwords do not match."}
            )
        return data

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(email=data["email"], password=data["password"])
        if user is None:
            raise serializers.ValidationError("Invalid email or password.")
        if not user.is_active:
            raise serializers.ValidationError("This account is deactivated.")
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
            "created_at",
        )
        read_only_fields = ("id", "email", "created_at")

    # -- computed fields -----------------------------------------------------

    def get_friends_count(self, obj):
        return (
            obj.friendships_sent.filter(status="accepted").count()
            + obj.friendships_received.filter(status="accepted").count()
        )

    def get_posts_count(self, obj):
        return obj.posts.count()

    def get_friendship_status(self, obj):
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

    def validate_username(self, value):
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
