# Feed is computed on-the-fly per request.
# Posts from self + accepted friends, filtered by privacy, scored by engagement.

from datetime import timedelta
from typing import Any

from django.db.models import Count, Exists, OuterRef, Q
from django.db.models import ExpressionWrapper, F, FloatField, IntegerField, Value
from django.db.models.functions import Now
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.posts.models import Like, Post, SavedPost
from apps.posts.serializers import PostSerializer
from apps.users.models import Friendship, User
from apps.users.serializers import UserMiniSerializer


def _get_friend_ids(user: Any, request: Any = None) -> set:
    """Return a set of user IDs that are friends (accepted) with the given user.

    If request is provided, the result is cached on the request object
    to avoid redundant queries within the same request cycle.
    """
    cache_key = "_friend_ids_cache"

    # Check request-level cache if available
    if request is not None and hasattr(request, cache_key):
        return getattr(request, cache_key)

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

    # Cache on request if available
    if request is not None:
        setattr(request, cache_key, friends)

    return friends


class FeedView(APIView):
    """GET /api/feed/ — cursor-based news feed for the authenticated user.

    Strategy: Fetch 3x page_size posts by recency, score them in Python, return top
    page_size. The cursor for the next page is the created_at of the oldest post
    among the fetched batch (not the returned page), ensuring older high-score posts
    aren't missed on subsequent pages.
    """

    permission_classes = (IsAuthenticated,)
    page_size = 10
    fetch_multiplier = 3  # fetch 30 posts, pick top 10

    def get(self, request: Any) -> Response:
        user = request.user
        friends = _get_friend_ids(user, request)
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
        saved_subquery = SavedPost.objects.filter(post=OuterRef("pk"), user=user)
        qs = qs.annotate(
            like_count=Count("likes", distinct=True),
            comment_count=Count("comments", distinct=True),
            is_liked=Exists(like_subquery),
            is_saved=Exists(saved_subquery),
        ).order_by("-created_at", "-id")

        # Cursor-based pagination using created_at
        cursor = request.query_params.get("cursor")
        if cursor:
            dt = parse_datetime(cursor)
            if dt is not None:
                qs = qs.filter(created_at__lt=dt)

        def recency_bonus(created_at: Any) -> int:
            if not created_at:
                return 0
            now = timezone.now()
            delta = now - created_at
            if delta <= timedelta(hours=1):
                return 50
            if delta <= timedelta(hours=6):
                return 30
            if delta <= timedelta(hours=24):
                return 10
            if delta <= timedelta(days=3):
                return 5
            return 0

        def compute_score(post: Any) -> int:
            return (
                (post.like_count or 0) * 2
                + (post.comment_count or 0) * 3
                + recency_bonus(post.created_at)
            )

        # Fetch more posts to find high-score ones among older posts
        fetch_count = self.page_size * self.fetch_multiplier
        items = list(qs[: fetch_count])

        for post in items:
            post.score = compute_score(post)
            post.is_trending = post.score > 20

        # Sort by score descending, pick top page_size
        items.sort(key=lambda p: p.score, reverse=True)
        result_items = items[: self.page_size]

        # Cursor is based on the oldest post in the fetched batch (not result)
        # This ensures we don't skip older high-score posts on next page
        has_next = len(items) >= fetch_count
        next_cursor = None
        if has_next and items:
            oldest_in_batch = min(items, key=lambda p: p.created_at)
            next_cursor = oldest_in_batch.created_at.isoformat()

        serializer = PostSerializer(result_items, many=True, context={"request": request})
        return Response({"results": serializer.data, "next_cursor": next_cursor})


class FeedActiveFriendsView(APIView):
    """GET /api/feed/active-friends/ — list friends with avatar for active friends bar."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Any) -> Response:
        user = request.user
        friends = _get_friend_ids(user, request)

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

    def get(self, request: Any) -> Response:
        user = request.user
        friends = _get_friend_ids(user, request)
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
        saved_subquery = SavedPost.objects.filter(post=OuterRef("pk"), user=user)

        qs = base_qs.annotate(
            recent_likes=Count(
                "likes",
                filter=Q(likes__created_at__gte=window_start),
                distinct=True,
            ),
            like_count=Count("likes", distinct=True),
            comment_count=Count("comments", distinct=True),
            is_liked=Exists(user_like_subquery),
            is_saved=Exists(saved_subquery),
        ).filter(recent_likes__gt=0)

        qs = qs.order_by("-recent_likes", "-created_at")[:10]

        serializer = PostSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)
