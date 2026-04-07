import logging
from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import Notification
from .serializers import NotificationSerializer

logger = logging.getLogger(__name__)


def broadcast_notification(notification: Notification) -> None:
    """Send a newly created notification to the recipient's WebSocket group.

    Group name convention: user_<user_id>

    If the channel layer is unavailable or fails, the error is logged
    but does not propagate, ensuring the calling transaction is not rolled back.
    """

    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    group_name = f"user_{notification.recipient_id}"
    payload = NotificationSerializer(notification).data

    try:
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "notify",
                "notification": payload,
            },
        )
    except Exception as e:
        # Log the error but don't crash the signal handler or rollback the transaction
        logger.warning(
            "Failed to broadcast notification %s to group %s: %s",
            notification.pk,
            group_name,
            str(e),
        )
