from django.db.models import Q
from django.utils.decorators import method_decorator
from rest_framework import generics, serializers as drf_serializers, status

try:
    from ratelimit.decorators import ratelimit
except Exception:  # pragma: no cover - fallback if ratelimit isn't installed
    def ratelimit(*args, **kwargs):
        def decorator(view_func):
            return view_func

        return decorator
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsOwnerOrReadOnly

from .models import Comment, Like, Post, SavedPost
from .serializers import (
    CommentSerializer,
    CreateCommentSerializer,
    CreatePostSerializer,
    PostSerializer,
    UpdatePostSerializer,
)


# ===========================================================================
# Post CRUD
# ===========================================================================

@method_decorator(
    ratelimit(key="ip", rate="20/m", method="POST", block=True),
    name="dispatch",
)
class PostListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/posts/       — list posts (filtered by privacy + friendship)
    POST /api/posts/       — create a new post (with optional images)
    """

    permission_classes = (IsAuthenticated,)
    parser_classes = (MultiPartParser, FormParser)

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CreatePostSerializer
        return PostSerializer

    def get_queryset(self):
        user = self.request.user
        # Public posts, friends' posts, or own posts
        from apps.users.models import Friendship

        friend_ids = list(
            Friendship.objects.filter(
                Q(from_user=user, status="accepted") | Q(to_user=user, status="accepted")
            ).values_list("from_user_id", "to_user_id")
        )
        # Flatten tuples
        friends = set()
        for pair in friend_ids:
            friends.update(pair)
        friends.discard(user.pk)

        return Post.objects.filter(
            Q(privacy="public")
            | Q(author=user)
            | Q(author_id__in=friends, privacy__in=["public", "friends"])
        ).select_related("author").prefetch_related("images", "likes", "comments")

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class PostDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/posts/<id>/  — get post detail
    PUT    /api/posts/<id>/  — update post (owner only)
    DELETE /api/posts/<id>/  — delete post (owner only)
    """

    permission_classes = (IsAuthenticated, IsOwnerOrReadOnly)
    lookup_field = "pk"

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return UpdatePostSerializer
        return PostSerializer

    def get_queryset(self):
        return Post.objects.select_related("author").prefetch_related(
            "images", "likes", "comments"
        )


# ===========================================================================
# Like toggle
# ===========================================================================

class LikeToggleView(APIView):
    """
    POST /api/posts/<id>/like/  — toggle like (like if not liked, unlike if liked)
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, pk):
        post = Post.objects.filter(pk=pk).first()
        if not post:
            return Response({"detail": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

        like, created = Like.objects.get_or_create(user=request.user, post=post)
        if not created:
            like.delete()
            return Response({"liked": False, "like_count": post.likes.count()})

        return Response(
            {"liked": True, "like_count": post.likes.count()},
            status=status.HTTP_201_CREATED,
        )


# ===========================================================================
# Comments
# ===========================================================================

class CommentListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/posts/<id>/comments/  — list top-level comments (with replies)
    POST /api/posts/<id>/comments/  — create a comment or reply
    """

    permission_classes = (IsAuthenticated,)

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CreateCommentSerializer
        return CommentSerializer

    def get_queryset(self):
        # Only top-level comments (parent=None), replies are nested
        return (
            Comment.objects.filter(post_id=self.kwargs["pk"], parent=None)
            .select_related("author")
            .prefetch_related("replies__author")
        )

    def perform_create(self, serializer):
        post = Post.objects.filter(pk=self.kwargs["pk"]).first()
        if not post:
            raise drf_serializers.ValidationError("Post not found.")

        parent = serializer.validated_data.get("parent")
        if parent and parent.post_id != post.pk:
            raise drf_serializers.ValidationError("Parent comment does not belong to this post.")

        serializer.save(author=self.request.user, post=post)


class CommentDeleteView(APIView):
    """
    DELETE /api/comments/<id>/  — delete comment (owner or post owner only)
    """

    permission_classes = (IsAuthenticated,)

    def delete(self, request, pk):
        comment = Comment.objects.select_related("post__author").filter(pk=pk).first()
        if not comment:
            return Response({"detail": "Comment not found."}, status=status.HTTP_404_NOT_FOUND)

        # Allow deletion by comment author or post author
        if comment.author != request.user and comment.post.author != request.user:
            return Response(
                {"detail": "You do not have permission to delete this comment."},
                status=status.HTTP_403_FORBIDDEN,
            )

        comment.delete()
        return Response({"detail": "Comment deleted."}, status=status.HTTP_200_OK)


# ===========================================================================
# Save / Bookmark toggle
# ===========================================================================

class SaveToggleView(APIView):
    """
    POST /api/posts/<id>/save/  — toggle bookmark (save if not saved, unsave if saved)
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, pk):
        post = Post.objects.filter(pk=pk).first()
        if not post:
            return Response({"detail": "Post not found."}, status=status.HTTP_404_NOT_FOUND)

        saved, created = SavedPost.objects.get_or_create(user=request.user, post=post)
        if not created:
            saved.delete()
            return Response({"saved": False})

        return Response({"saved": True}, status=status.HTTP_201_CREATED)


# ===========================================================================
# Saved posts list
# ===========================================================================

class SavedPostListView(generics.ListAPIView):
    """
    GET /api/posts/saved/  — list posts the user has bookmarked
    """

    permission_classes = (IsAuthenticated,)
    serializer_class = PostSerializer

    def get_queryset(self):
        saved_post_ids = SavedPost.objects.filter(user=self.request.user).values_list(
            "post_id", flat=True
        )
        return Post.objects.filter(pk__in=saved_post_ids).select_related("author").prefetch_related(
            "images", "likes", "comments"
        )
