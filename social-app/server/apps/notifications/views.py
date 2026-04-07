from rest_framework import generics, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from typing import Any

from .models import Notification
from .serializers import NotificationSerializer


class NotificationPagination(PageNumberPagination):
    """Custom pagination for notifications with page_size=20."""
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 50


class NotificationListView(generics.ListAPIView):
    """GET /api/notifications/ — list notifications for the current user (paginated)."""

    permission_classes = (IsAuthenticated,)
    serializer_class = NotificationSerializer
    pagination_class = NotificationPagination

    def get_queryset(self) -> Any:
        return Notification.objects.filter(recipient=self.request.user).select_related(
            "recipient", "sender"
        )


class NotificationMarkAllReadView(APIView):
    """POST /api/notifications/read/ — mark all as read for the current user."""

    permission_classes = (IsAuthenticated,)

    def post(self, request: Any) -> Response:
        updated = Notification.objects.filter(
            recipient=request.user, is_read=False
        ).update(is_read=True)
        return Response({"updated": updated}, status=status.HTTP_200_OK)


class NotificationMarkOneReadView(APIView):
    """POST /api/notifications/<id>/read/ — mark a single notification as read."""

    permission_classes = (IsAuthenticated,)

    def post(self, request: Any, pk: str) -> Response:
        try:
            notif = Notification.objects.get(pk=pk, recipient=request.user)
        except Notification.DoesNotExist:
            return Response(
                {"detail": "Notification not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not notif.is_read:
            notif.is_read = True
            notif.save(update_fields=["is_read"])
        return Response({"updated": True}, status=status.HTTP_200_OK)


class NotificationUnreadCountView(APIView):
    """GET /api/notifications/unread-count/ — return unread notifications count."""

    permission_classes = (IsAuthenticated,)

    def get(self, request: Any) -> Response:
        count = Notification.objects.filter(
            recipient=request.user, is_read=False
        ).count()
        return Response({"count": count})
