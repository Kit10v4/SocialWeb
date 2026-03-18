from datetime import timedelta

from django.db.models import Count, Exists, OuterRef, Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.posts.models import Like, Post
from apps.posts.serializers import PostSerializer
from apps.users.models import Friendship, User
from apps.users.serializers import UserMiniSerializer


def _get_friend_ids(user):
    """Return a set of user IDs that are friends (accepted) with the given user."""

    pairs = Friendship.objects.filter(
        Q(from_user=user, status="accepted") | Q(to_user=user, status="accepted")
    ).values_list("from_user_id", "to_user_id")

    friends = set()
    for a, b in pairs:
        if a:
            friends.add(a)
        if b:
            friends.add(b)
    friends.discard(user.pk)
    return friends


class FeedView(APIView):
    """GET /api/feed/ — cursor-based news feed for the authenticated user."""

    permission_classes = (IsAuthenticated,)
    page_size = 10

    def get(self, request):
        user = request.user
        friends = _get_friend_ids(user)
        visible_user_ids = {user.pk, *friends}

        # Base queryset: posts from self + friends, privacy: public or friends
        qs = (
            Post.objects.filter(
                author_id__in=visible_user_ids,
                privacy__in=[Post.Privacy.PUBLIC, Post.Privacy.FRIENDS],
            )
            .select_related("author")
            .prefetch_related("images", "likes", "comments")
        )

        # Annotations to avoid N+1 queries
        like_subquery = Like.objects.filter(post=OuterRef("pk"), user=user)
        qs = qs.annotate(
            like_count=Count("likes", distinct=True),
            comment_count=Count("comments", distinct=True),
            is_liked=Exists(like_subquery),
        ).order_by("-created_at", "-id")

        # Cursor-based pagination using created_at
        cursor = request.query_params.get("cursor")
        if cursor:
            dt = parse_datetime(cursor)
            if dt is not None:
                qs = qs.filter(created_at__lt=dt)

        items = list(qs[: self.page_size + 1])
        has_next = len(items) > self.page_size
        items = items[: self.page_size]

        next_cursor = None
        if has_next and items:
            last = items[-1]
            next_cursor = last.created_at.isoformat()

        serializer = PostSerializer(items, many=True, context={"request": request})
        return Response({"results": serializer.data, "next_cursor": next_cursor})


class FeedStoriesView(APIView):
    """GET /api/feed/stories/ — list friends with avatar for the stories bar."""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        user = request.user
        friends = _get_friend_ids(user)

        qs = (
            User.objects.filter(pk__in=friends, avatar__isnull=False)
            .exclude(avatar="")
            .order_by("-created_at")
        )

        serializer = UserMiniSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)


class TrendingPostsView(APIView):
    """GET /api/posts/trending/ — posts with most likes in the last 24 hours."""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        user = request.user
        friends = _get_friend_ids(user)
        visible_user_ids = {user.pk, *friends}

        window_start = timezone.now() - timedelta(hours=24)

        base_qs = (
            Post.objects.filter(
                author_id__in=visible_user_ids,
                privacy__in=[Post.Privacy.PUBLIC, Post.Privacy.FRIENDS],
                likes__created_at__gte=window_start,
            )
            .select_related("author")
            .prefetch_related("images", "likes", "comments")
            .distinct()
        )

        recent_like_subquery = Like.objects.filter(
            post=OuterRef("pk"), created_at__gte=window_start
        )
        user_like_subquery = Like.objects.filter(post=OuterRef("pk"), user=user)

        qs = base_qs.annotate(
            recent_likes=Count(
                "likes",
                filter=Q(likes__created_at__gte=window_start),
                distinct=True,
            ),
            like_count=Count("likes", distinct=True),
            comment_count=Count("comments", distinct=True),
            is_liked=Exists(user_like_subquery),
        ).filter(recent_likes__gt=0)

        qs = qs.order_by("-recent_likes", "-created_at")[:10]

        serializer = PostSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)
