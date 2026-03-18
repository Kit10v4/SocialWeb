from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import AnonymousUser

from .models import Notification
from .serializers import NotificationSerializer


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """Per-user notifications over WebSocket.

    Group name: "user_<user_id>".
    """

    async def connect(self):
        user = self.scope.get("user") or AnonymousUser()
        if not user.is_authenticated:
            await self.close()
            return

        self.user = user
        self.group_name = f"user_{self.user.pk}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Send initial unread count
        count = await self._get_unread_count()
        await self.send_json({"type": "unread_count", "count": count})

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        # Currently we do not handle client-initiated events, but you could
        # extend this to allow clients to request manual refresh, etc.
        event_type = content.get("type")
        if event_type == "refresh":
            await self._send_latest_list()

    # ------------------------------------------------------------------
    # Events from channel layer
    # ------------------------------------------------------------------

    async def notify(self, event):
        """Broadcasted when a new notification is created for this user."""

        await self.send_json(
            {
                "type": "notification",
                "notification": event["notification"],
            }
        )

        # Also send updated unread count
        count = await self._get_unread_count()
        await self.send_json({"type": "unread_count", "count": count})

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @database_sync_to_async
    def _get_unread_count(self) -> int:
        return Notification.objects.filter(recipient=self.user, is_read=False).count()

    @database_sync_to_async
    def _get_latest_notifications(self):
        qs = Notification.objects.filter(recipient=self.user).select_related(
            "recipient", "sender"
        )[:10]
        return NotificationSerializer(qs, many=True).data

    async def _send_latest_list(self):
        data = await self._get_latest_notifications()
        await self.send_json({"type": "list", "notifications": data})
