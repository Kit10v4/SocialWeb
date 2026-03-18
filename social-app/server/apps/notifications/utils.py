from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import Notification
from .serializers import NotificationSerializer


def broadcast_notification(notification: Notification):
    """Send a newly created notification to the recipient's WebSocket group.

    Group name convention: user_<user_id>
    """

    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    group_name = f"user_{notification.recipient_id}"
    payload = NotificationSerializer(notification).data

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "notify",
            "notification": payload,
        },
    )
