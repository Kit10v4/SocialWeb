from django.db.models import Q
from django.utils.decorators import method_decorator
from rest_framework import generics, status

try:
    from ratelimit.decorators import ratelimit
except Exception:  # pragma: no cover - fallback if ratelimit isn't installed
    def ratelimit(*args, **kwargs):
        def decorator(view_func):
            return view_func

        return decorator
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from .models import Friendship, User
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

def _get_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


@method_decorator(
    ratelimit(key="ip", rate="3/m", method="POST", block=True),
    name="dispatch",
)
class RegisterView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
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

    def post(self, request):
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

    def post(self, request):
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


class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = UserProfileSerializer

    def get_object(self):
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

    def put(self, request):
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

    def get_queryset(self):
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

    def get_queryset(self):
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

def _get_friendship(user_a, user_b):
    """Return the Friendship row between two users (either direction) or None."""
    return Friendship.objects.filter(
        Q(from_user=user_a, to_user=user_b)
        | Q(from_user=user_b, to_user=user_a)
    ).first()


class SendFriendRequestView(APIView):
    """POST /api/friends/request/<user_id>/"""
    permission_classes = (IsAuthenticated,)

    def post(self, request, user_id):
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

    def post(self, request, user_id):
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

    def post(self, request, user_id):
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

    def delete(self, request, user_id):
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

    def get_queryset(self):
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

    def get_queryset(self):
        return Friendship.objects.filter(
            to_user=self.request.user, status="pending"
        ).select_related("from_user", "to_user")
