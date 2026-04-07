import uuid

from django.conf import settings
from django.db import models


class Notification(models.Model):
    """User notification (like, comment, friend request, message, etc.)."""

    class Type(models.TextChoices):
        LIKE = "like", "Like"
        COMMENT = "comment", "Comment"
        FRIEND_REQUEST = "friend_request", "Friend Request"
        FRIEND_ACCEPT = "friend_accept", "Friend Accepted"
        MESSAGE = "message", "Message"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications_sent"
    )
    notification_type = models.CharField(max_length=20, choices=Type.choices)
    text = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    target_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "notification"
        verbose_name_plural = "notifications"

    def __str__(self):
        return f"→ {self.recipient.username}: {self.text[:50]}"
