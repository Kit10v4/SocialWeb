from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db.models import Count, Exists, OuterRef, Q
from django.utils.decorators import method_decorator
from typing import Any
from rest_framework import generics, status

from django_ratelimit.decorators import ratelimit
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from apps.posts.models import Like, Post, SavedPost
from apps.posts.serializers import PostSerializer

from .models import Friendship, Report, User
from .serializers import (
    FriendshipSerializer,
    LoginSerializer,
    RegisterSerializer,
    UpdateProfileSerializer,
    UserMiniSerializer,
    UserProfileSerializer,
)
from .utils import resize_image


# ===========================================================================
# Auth views (unchanged)
# ===========================================================================

def _get_tokens(user: Any) -> dict[str, str]:
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


@method_decorator(
    ratelimit(key="ip", rate="3/m", method="POST", block=True),
    name="dispatch",
)
class RegisterView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request: Any) -> Response:
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {"user": UserProfileSerializer(user, context={"request": request}).data,
             "tokens": _get_tokens(user)},
            status=status.HTTP_201_CREATED,
        )


@method_decorator(
    ratelimit(key="ip", rate="5/m", method="POST", block=True),
    name="dispatch",
)
class LoginView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request: Any) -> Response:
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        return Response(
            {"user": UserProfileSerializer(user, context={"request": request}).data,
             "tokens": _get_tokens(user)},
            status=status.HTTP_200_OK,
        )


class CustomTokenRefreshView(TokenRefreshView):
    pass


class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request: Any) -> Response:
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response({"detail": "Refresh token is required."},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            RefreshToken(refresh_token).blacklist()
        except TokenError:
            return Response({"detail": "Token is invalid or already blacklisted."},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Successfully logged out."})


class ChangePasswordView(APIView):
    """POST /api/auth/change-password/ — change user's password."""
    permission_classes = (IsAuthenticated,)

    def post(self, request: Any) -> Response:
        user = request.user
        current_password = request.data.get("current_password")
        new_password = request.data.get("new_password")
        confirm_password = request.data.get("confirm_password")

        # Validate required fields
        if not all([current_password, new_password, confirm_password]):
            return Response(
                {"detail": "Vui lòng điền đầy đủ các trường."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify current password
        if not user.check_password(current_password):
            return Response(
                {"detail": "Mật khẩu hiện tại không đúng."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check new password match
        if new_password != confirm_password:
            return Response(
                {"detail": "Mật khẩu mới không khớp."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate new password with Django validators
        try:
            validate_password(new_password, user)
        except ValidationError as e:
            return Response(
                {"detail": e.messages[0] if e.messages else "Mật khẩu không hợp lệ."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Set new password
        user.set_password(new_password)
        user.save()

        # Blacklist all outstanding refresh tokens
        outstanding_tokens = OutstandingToken.objects.filter(user=user)
        for token in outstanding_tokens:
            try:
                BlacklistedToken.objects.get_or_create(token=token)
            except Exception:
                pass

        # Generate new tokens
        new_tokens = _get_tokens(user)

        return Response({
            "detail": "Đổi mật khẩu thành công.",
            "tokens": new_tokens
        })


class ChangeEmailView(APIView):
    """POST /api/auth/change-email/ — change user's email."""
    permission_classes = (IsAuthenticated,)

    def post(self, request: Any) -> Response:
        user = request.user
        new_email = request.data.get("new_email", "").strip().lower()
        password = request.data.get("password")

        # Validate required fields
        if not new_email or not password:
            return Response(
                {"detail": "Vui lòng điền đầy đủ các trường."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify password
        if not user.check_password(password):
            return Response(
                {"detail": "Mật khẩu không đúng."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if email already exists
        if User.objects.filter(email=new_email).exclude(pk=user.pk).exists():
            return Response(
                {"detail": "Email này đã được sử dụng."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update email
        user.email = new_email
        user.save(update_fields=["email"])

        return Response({
            "detail": "Đã cập nhật email thành công.",
            "email": new_email
        })


class DeleteAccountView(APIView):
    """DELETE /api/auth/delete-account/ — permanently delete user account."""
    permission_classes = (IsAuthenticated,)

    def delete(self, request: Any) -> Response:
        user = request.user
        password = request.data.get("password")

        # Validate required field
        if not password:
            return Response(
                {"detail": "Vui lòng nhập mật khẩu để xác nhận."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify password
        if not user.check_password(password):
            return Response(
                {"detail": "Mật khẩu không đúng."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Blacklist all outstanding tokens
        outstanding_tokens = OutstandingToken.objects.filter(user=user)
        for token in outstanding_tokens:
            try:
                BlacklistedToken.objects.get_or_create(token=token)
            except Exception:
                pass

        # Delete user (cascade will handle related data)
        user.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = UserProfileSerializer

    def get_object(self) -> Any:
        return self.request.user


# ===========================================================================
# Profile views
# ===========================================================================

class UserProfileView(generics.RetrieveAPIView):
    """GET /api/users/<username>/ — view any user's public profile."""
    serializer_class = UserProfileSerializer
    lookup_field = "username"
    queryset = User.objects.filter(is_active=True)


class UpdateMyProfileView(APIView):
    """PUT /api/users/me/ — update own profile (bio, avatar, cover, birthday)."""
    permission_classes = (IsAuthenticated,)

    def put(self, request: Any) -> Response:
        user = request.user
        data = request.data.copy()

        # Resize images before saving
        if "avatar" in request.FILES:
            data["avatar"] = resize_image(request.FILES["avatar"], size=(400, 400))
        if "cover_photo" in request.FILES:
            data["cover_photo"] = resize_image(request.FILES["cover_photo"], size=(1200, 480))

        serializer = UpdateProfileSerializer(user, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            UserProfileSerializer(user, context={"request": request}).data
        )


class UserSearchView(generics.ListAPIView):
    """GET /api/users/search/?q=keyword — search by username or email."""
    serializer_class = UserMiniSerializer

    def get_queryset(self) -> Any:
        q = self.request.query_params.get("q", "").strip()
        if len(q) < 2:
            return User.objects.none()
        return User.objects.filter(
            Q(username__icontains=q) | Q(email__icontains=q),
            is_active=True,
        ).exclude(pk=self.request.user.pk)


class SuggestionsView(generics.ListAPIView):
    """GET /api/users/suggestions/ — users not yet friends, random order."""
    serializer_class = UserMiniSerializer

    def get_queryset(self) -> Any:
        me = self.request.user
        # IDs of everyone I have *any* relationship with
        related_ids = set(
            Friendship.objects.filter(
                Q(from_user=me) | Q(to_user=me)
            ).values_list("from_user_id", "to_user_id")
            # values_list returns tuples; flatten them
            .distinct()
        )
        exclude_ids = {me.pk}
        for pair in related_ids:
            exclude_ids.update(pair)

        return User.objects.filter(is_active=True).exclude(
            pk__in=exclude_ids
        ).order_by("?")[:20]


# ===========================================================================
# Friendship views
# ===========================================================================

def _get_friendship(user_a: Any, user_b: Any) -> Any:
    """Return the Friendship row between two users (either direction) or None."""
    return Friendship.objects.filter(
        Q(from_user=user_a, to_user=user_b)
        | Q(from_user=user_b, to_user=user_a)
    ).first()


class SendFriendRequestView(APIView):
    """POST /api/friends/request/<user_id>/"""
    permission_classes = (IsAuthenticated,)

    def post(self, request: Any, user_id: str) -> Response:
        if str(request.user.pk) == str(user_id):
            return Response({"detail": "You cannot send a friend request to yourself."},
                            status=status.HTTP_400_BAD_REQUEST)

        target = User.objects.filter(pk=user_id, is_active=True).first()
        if not target:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        existing = _get_friendship(request.user, target)
        if existing:
            if existing.status == "accepted":
                return Response({"detail": "You are already friends."}, status=status.HTTP_400_BAD_REQUEST)
            if existing.status == "pending":
                return Response({"detail": "A friend request already exists."}, status=status.HTTP_400_BAD_REQUEST)
            if existing.status == "blocked":
                return Response({"detail": "This action is not allowed."}, status=status.HTTP_403_FORBIDDEN)

        friendship = Friendship.objects.create(from_user=request.user, to_user=target)
        return Response(FriendshipSerializer(friendship).data, status=status.HTTP_201_CREATED)


class AcceptFriendRequestView(APIView):
    """POST /api/friends/accept/<user_id>/ — accept request FROM user_id."""
    permission_classes = (IsAuthenticated,)

    def post(self, request: Any, user_id: str) -> Response:
        friendship = Friendship.objects.filter(
            from_user_id=user_id, to_user=request.user, status="pending"
        ).first()
        if not friendship:
            return Response({"detail": "No pending friend request from this user."},
                            status=status.HTTP_404_NOT_FOUND)

        friendship.status = "accepted"
        friendship.save(update_fields=["status", "updated_at"])
        return Response(FriendshipSerializer(friendship).data)


class RejectFriendRequestView(APIView):
    """POST /api/friends/reject/<user_id>/ — reject / cancel request."""
    permission_classes = (IsAuthenticated,)

    def post(self, request: Any, user_id: str) -> Response:
        friendship = Friendship.objects.filter(
            Q(from_user_id=user_id, to_user=request.user)
            | Q(from_user=request.user, to_user_id=user_id),
            status="pending",
        ).first()
        if not friendship:
            return Response({"detail": "No pending friend request found."},
                            status=status.HTTP_404_NOT_FOUND)

        friendship.delete()
        return Response({"detail": "Friend request removed."}, status=status.HTTP_200_OK)


class UnfriendView(APIView):
    """DELETE /api/friends/<user_id>/ — remove an existing friendship."""
    permission_classes = (IsAuthenticated,)

    def delete(self, request: Any, user_id: str) -> Response:
        friendship = Friendship.objects.filter(
            Q(from_user=request.user, to_user_id=user_id)
            | Q(from_user_id=user_id, to_user=request.user),
            status="accepted",
        ).first()
        if not friendship:
            return Response({"detail": "You are not friends with this user."},
                            status=status.HTTP_404_NOT_FOUND)

        friendship.delete()
        return Response({"detail": "Friendship removed."}, status=status.HTTP_200_OK)


class FriendListView(generics.ListAPIView):
    """GET /api/friends/ — list current user's accepted friends."""
    serializer_class = UserMiniSerializer

    def get_queryset(self) -> Any:
        me = self.request.user
        sent_ids = Friendship.objects.filter(
            from_user=me, status="accepted"
        ).values_list("to_user_id", flat=True)
        recv_ids = Friendship.objects.filter(
            to_user=me, status="accepted"
        ).values_list("from_user_id", flat=True)
        return User.objects.filter(pk__in=list(sent_ids) + list(recv_ids))


class FriendRequestListView(generics.ListAPIView):
    """GET /api/friends/requests/ — pending requests sent TO me."""
    serializer_class = FriendshipSerializer

    def get_queryset(self) -> Any:
        return Friendship.objects.filter(
            to_user=self.request.user, status="pending"
        ).select_related("from_user", "to_user")


# ===========================================================================
# User Posts view
# ===========================================================================

class UserPostsView(APIView):
    """
    GET /api/users/<username>/posts/ — list posts of a specific user with cursor pagination.

    Privacy rules:
    - Public posts: visible to everyone
    - Friends posts: visible only if viewer is friends with author
    - Private posts: visible only to author themselves
    """
    permission_classes = (IsAuthenticated,)
    page_size = 10

    def get(self, request: Any, username: str) -> Response:
        from django.utils.dateparse import parse_datetime

        target_user = User.objects.filter(username=username, is_active=True).first()

        if not target_user:
            return Response({"results": [], "next_cursor": None})

        viewer = request.user if request.user.is_authenticated else None
        is_own_profile = viewer and viewer.pk == target_user.pk

        # Base queryset for target user's posts
        qs = Post.objects.filter(author=target_user)

        if is_own_profile:
            # Owner can see all their posts
            pass
        elif viewer:
            # Check if viewer is friends with target user
            is_friend = Friendship.objects.filter(
                Q(from_user=viewer, to_user=target_user, status="accepted") |
                Q(from_user=target_user, to_user=viewer, status="accepted")
            ).exists()

            if is_friend:
                # Friends can see public + friends posts
                qs = qs.filter(privacy__in=["public", "friends"])
            else:
                # Non-friends can only see public posts
                qs = qs.filter(privacy="public")
        else:
            # Anonymous users can only see public posts
            qs = qs.filter(privacy="public")

        # Annotate with counts and is_liked for performance
        qs = qs.select_related("author").prefetch_related("images")
        qs = qs.annotate(
            like_count=Count("likes", distinct=True),
            comment_count=Count("comments", distinct=True),
        )

        if viewer:
            qs = qs.annotate(
                is_liked=Exists(
                    Like.objects.filter(post=OuterRef("pk"), user=viewer)
                ),
                is_saved=Exists(
                    SavedPost.objects.filter(post=OuterRef("pk"), user=viewer)
                ),
            )

        qs = qs.order_by("-created_at", "-id")

        # Cursor-based pagination
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


# ===========================================================================
# Report views
# ===========================================================================

class ReportUserView(APIView):
    """POST /api/reports/ — report a user."""
    permission_classes = (IsAuthenticated,)

    def post(self, request: Any) -> Response:
        target_id = request.data.get('target_user')
        reason = request.data.get('reason', 'other')
        detail = request.data.get('detail', '')
        if not target_id:
            return Response({'detail': 'target_user required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            target = User.objects.get(pk=target_id)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        if str(target_id) == str(request.user.pk):
            return Response({'detail': 'Cannot report yourself.'}, status=status.HTTP_400_BAD_REQUEST)
        Report.objects.get_or_create(
            reporter=request.user,
            target_user=target,
            defaults={'reason': reason, 'detail': detail}
        )
        return Response({'detail': 'Report submitted.'}, status=status.HTTP_201_CREATED)
