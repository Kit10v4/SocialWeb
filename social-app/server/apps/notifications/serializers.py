from rest_framework import serializers

from apps.users.serializers import UserMiniSerializer

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    recipient = UserMiniSerializer(read_only=True)
    sender = UserMiniSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = (
            "id",
            "recipient",
            "sender",
            "notification_type",
            "text",
            "target_id",
            "is_read",
            "created_at",
        )
        read_only_fields = fields
