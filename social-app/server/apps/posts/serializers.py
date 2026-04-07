from rest_framework import serializers
import bleach
from PIL import Image
from typing import Any

from apps.users.serializers import UserMiniSerializer

from .models import Comment, Like, Post, PostImage, SavedPost


# ---------------------------------------------------------------------------
# PostImage
# ---------------------------------------------------------------------------

class PostImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostImage
        fields = ("id", "image", "order")
        read_only_fields = fields


# ---------------------------------------------------------------------------
# Comment + Reply
# ---------------------------------------------------------------------------

class ReplySerializer(serializers.ModelSerializer):
    """Serializer for nested replies (1 level only)."""

    author = UserMiniSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ("id", "author", "content", "created_at")
        read_only_fields = fields


class CommentSerializer(serializers.ModelSerializer):
    """Comment serializer with nested replies."""

    author = UserMiniSerializer(read_only=True)
    replies = ReplySerializer(many=True, read_only=True)
    reply_count = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = (
            "id",
            "author",
            "content",
            "parent",
            "replies",
            "reply_count",
            "created_at",
        )
        read_only_fields = ("id", "author", "replies", "reply_count", "created_at")

    def get_reply_count(self, obj: Comment) -> int:
        return obj.replies.count()


class CreateCommentSerializer(serializers.ModelSerializer):
    """Create a comment or reply."""

    class Meta:
        model = Comment
        fields = ("content", "parent")

    def validate_parent(self, value: Comment | None) -> Comment | None:
        if value is not None:
            # Ensure parent belongs to the same post (set in view)
            # and is not itself a reply (1 level only)
            if value.parent is not None:
                raise serializers.ValidationError(
                    "Cannot reply to a reply. Only 1 level of nesting allowed."
                )
        return value

    def validate_content(self, value: str) -> str:
        content = (value or "").strip()
        if not content:
            raise serializers.ValidationError("Comment content cannot be empty.")
        return bleach.clean(content, tags=[], attributes={}, strip=True)


# ---------------------------------------------------------------------------
# Post
# ---------------------------------------------------------------------------

class PostSerializer(serializers.ModelSerializer):
    """Full post serializer for reading."""

    author = UserMiniSerializer(read_only=True)
    images = PostImageSerializer(many=True, read_only=True)
    like_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()
    is_trending = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = Post
        fields = (
            "id",
            "author",
            "content",
            "images",
            "privacy",
            "like_count",
            "comment_count",
            "is_liked",
            "is_saved",
            "is_trending",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    # -- computed fields ---------------------------------------------------

    def get_like_count(self, obj: Post) -> int:
        # Prefer annotated value when available to avoid extra queries
        if hasattr(obj, "like_count"):
            return obj.like_count
        return obj.likes.count()

    def get_comment_count(self, obj: Post) -> int:
        # Prefer annotated value when available to avoid extra queries
        if hasattr(obj, "comment_count"):
            return obj.comment_count
        return obj.comments.count()

    def get_is_liked(self, obj: Post) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        # Use annotated flag when provided by queryset
        if hasattr(obj, "is_liked"):
            return bool(obj.is_liked)
        return obj.likes.filter(user=request.user).exists()

    def get_is_saved(self, obj: Post) -> bool:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        # Use annotated flag when provided by queryset
        if hasattr(obj, "is_saved"):
            return bool(obj.is_saved)
        return obj.saves.filter(user=request.user).exists()


class CreatePostSerializer(serializers.ModelSerializer):
    """Create/update a post with optional images (max 10)."""

    images = serializers.ListField(
        child=serializers.ImageField(),
        write_only=True,
        required=False,
        max_length=10,
    )

    class Meta:
        model = Post
        fields = ("content", "images", "privacy")

    def validate_images(self, images: list[Any]) -> list[Any]:
        max_size = 5 * 1024 * 1024  # 5MB
        allowed_types = {"image/jpeg", "image/png", "image/webp"}
        allowed_formats = {"JPEG", "PNG", "WEBP"}
        for img in images or []:
            content_type = getattr(img, "content_type", "")
            size = getattr(img, "size", 0)
            if size > max_size:
                raise serializers.ValidationError("Each image must be <= 5MB.")
            if content_type not in allowed_types:
                raise serializers.ValidationError(
                    "Unsupported image type. Only JPG, PNG, WEBP are allowed."
                )
            try:
                image = Image.open(img)
                image.verify()
                if image.format not in allowed_formats:
                    raise serializers.ValidationError(
                        "Unsupported image type. Only JPG, PNG, WEBP are allowed."
                    )
                img.seek(0)
            except serializers.ValidationError:
                raise
            except Exception:
                raise serializers.ValidationError(
                    "Invalid image file. Please upload a valid JPG, PNG, or WEBP image."
                )
        return images

    def validate(self, data: dict[str, Any]) -> dict[str, Any]:
        content = data.get("content", "") or ""
        content = content.strip()
        images = data.get("images", [])

        if not content and not images:
            raise serializers.ValidationError(
                "Post must have either content or at least one image."
            )

        if content:
            allowed_tags = ["b", "i", "strong", "em", "a", "br", "p"]
            allowed_attrs = {"a": ["href", "title", "rel"]}
            cleaned = bleach.clean(
                content,
                tags=allowed_tags,
                attributes=allowed_attrs,
                strip=True,
            )
            data["content"] = cleaned

        return data

    def create(self, validated_data: dict[str, Any]) -> Post:
        images = validated_data.pop("images", [])
        post = Post.objects.create(**validated_data)
        for idx, img_file in enumerate(images):
            PostImage.objects.create(post=post, image=img_file, order=idx)
        return post

    def update(self, instance: Post, validated_data: dict[str, Any]) -> Post:
        images = validated_data.pop("images", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # If new images provided, replace old ones
        if images is not None:
            instance.images.all().delete()
            for idx, img_file in enumerate(images):
                PostImage.objects.create(post=instance, image=img_file, order=idx)

        return instance


class UpdatePostSerializer(serializers.ModelSerializer):
    """Update post — only content and privacy can be changed."""

    class Meta:
        model = Post
        fields = ("content", "privacy")

    def validate_content(self, value: str) -> str:
        # If clearing content, ensure there are images
        if not value.strip() and not self.instance.images.exists():
            raise serializers.ValidationError(
                "Cannot remove content when there are no images."
            )
        return value
