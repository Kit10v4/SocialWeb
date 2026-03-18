from rest_framework import serializers

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

    def get_reply_count(self, obj):
        return obj.replies.count()


class CreateCommentSerializer(serializers.ModelSerializer):
    """Create a comment or reply."""

    class Meta:
        model = Comment
        fields = ("content", "parent")

    def validate_parent(self, value):
        if value is not None:
            # Ensure parent belongs to the same post (set in view)
            # and is not itself a reply (1 level only)
            if value.parent is not None:
                raise serializers.ValidationError(
                    "Cannot reply to a reply. Only 1 level of nesting allowed."
                )
        return value


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
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    # -- computed fields ---------------------------------------------------

    def get_like_count(self, obj):
        return obj.likes.count()

    def get_comment_count(self, obj):
        return obj.comments.count()

    def get_is_liked(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.likes.filter(user=request.user).exists()

    def get_is_saved(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
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

    def validate(self, data):
        content = data.get("content", "").strip()
        images = data.get("images", [])
        if not content and not images:
            raise serializers.ValidationError(
                "Post must have either content or at least one image."
            )
        return data

    def create(self, validated_data):
        images = validated_data.pop("images", [])
        post = Post.objects.create(**validated_data)
        for idx, img_file in enumerate(images):
            PostImage.objects.create(post=post, image=img_file, order=idx)
        return post

    def update(self, instance, validated_data):
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

    def validate_content(self, value):
        # If clearing content, ensure there are images
        if not value.strip() and not self.instance.images.exists():
            raise serializers.ValidationError(
                "Cannot remove content when there are no images."
            )
        return value
