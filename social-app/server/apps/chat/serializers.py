from rest_framework import serializers

from apps.users.serializers import UserMiniSerializer

from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    sender = UserMiniSerializer(read_only=True)

    class Meta:
        model = Message
        fields = (
            "id",
            "conversation",
            "sender",
            "content",
            "message_type",
            "is_read",
            "created_at",
        )
        read_only_fields = ("id", "conversation", "sender", "is_read", "created_at")


class ConversationSerializer(serializers.ModelSerializer):
    participants = UserMiniSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ("id", "participants", "created_at", "updated_at", "last_message")
        read_only_fields = fields

    def get_last_message(self, obj):
        msg = obj.messages.select_related("sender").order_by("-created_at").first()
        if not msg:
            return None
        return MessageSerializer(msg, context=self.context).data
