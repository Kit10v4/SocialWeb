from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import AnonymousUser

from apps.users.models import User

from .models import Conversation, Message


class ChatConsumer(AsyncJsonWebsocketConsumer):
    """Real-time chat consumer for a single conversation room."""

    async def connect(self):
        user = self.scope.get("user") or AnonymousUser()
        if not user.is_authenticated:
            await self.close()
            return

        self.user = user
        self.conversation_id = self.scope["url_route"]["kwargs"]["conversation_id"]
        self.room_group_name = f"chat_{self.conversation_id}"

        # Ensure the user is a participant of the conversation
        if not await self._is_participant():
            await self.close()
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        # Send last 20 messages as history (oldest first)
        history = await self._get_last_messages()
        await self.send_json({"type": "chat_history", "messages": history})

        # Notify others that this user is online in this conversation
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "user_online",
                "user": self._serialize_user(self.user),
                "conversation_id": str(self.conversation_id),
            },
        )

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    # ------------------------------------------------------------------
    # Incoming messages from websocket
    # ------------------------------------------------------------------

    async def receive_json(self, content, **kwargs):
        event_type = content.get("type")

        if event_type == "chat_message":
            text = (content.get("content") or "").strip()
            message_type = content.get("message_type", "text")
            if not text and message_type == "text":
                return

            message = await self._create_message(text, message_type)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message",
                    "message": message,
                },
            )

        elif event_type == "typing_indicator":
            is_typing = bool(content.get("is_typing", True))
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "typing_indicator",
                    "user": self._serialize_user(self.user),
                    "is_typing": is_typing,
                    "conversation_id": str(self.conversation_id),
                },
            )

        elif event_type == "mark_read":
            updated = await self._mark_read()
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "mark_read",
                    "conversation_id": str(self.conversation_id),
                    "user_id": str(self.user.pk),
                    "updated": updated,
                },
            )

        elif event_type == "user_online":
            # Forward explicit user_online events if client wants to trigger them
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "user_online",
                    "user": self._serialize_user(self.user),
                    "conversation_id": str(self.conversation_id),
                },
            )

        else:
            await self.send_json({"type": "error", "message": "Unknown event type."})

    # ------------------------------------------------------------------
    # Events from channel layer (broadcast to clients)
    # ------------------------------------------------------------------

    async def chat_message(self, event):
        await self.send_json({"type": "chat_message", "message": event["message"]})

    async def typing_indicator(self, event):
        await self.send_json(
            {
                "type": "typing_indicator",
                "user": event["user"],
                "is_typing": event["is_typing"],
                "conversation_id": event["conversation_id"],
            }
        )

    async def mark_read(self, event):
        await self.send_json(
            {
                "type": "mark_read",
                "conversation_id": event["conversation_id"],
                "user_id": event["user_id"],
                "updated": event["updated"],
            }
        )

    async def user_online(self, event):
        await self.send_json(
            {
                "type": "user_online",
                "user": event["user"],
                "conversation_id": event["conversation_id"],
            }
        )

    # ------------------------------------------------------------------
    # Helpers (DB access)
    # ------------------------------------------------------------------

    @database_sync_to_async
    def _is_participant(self) -> bool:
        return Conversation.objects.filter(
            id=self.conversation_id, participants=self.user
        ).exists()

    @database_sync_to_async
    def _get_last_messages(self):
        qs = (
            Message.objects.filter(conversation_id=self.conversation_id)
            .select_related("sender")
            .order_by("-created_at")[:20]
        )
        messages = [self._serialize_message(m) for m in reversed(list(qs))]
        return messages

    @database_sync_to_async
    def _create_message(self, content: str, message_type: str):
        conversation = Conversation.objects.get(id=self.conversation_id)
        if not conversation.participants.filter(pk=self.user.pk).exists():
            raise PermissionError("Not a participant in this conversation.")

        message = Message.objects.create(
            conversation=conversation,
            sender=self.user,
            content=content,
            message_type=message_type or Message.MessageType.TEXT,
        )
        return self._serialize_message(message)

    @database_sync_to_async
    def _mark_read(self) -> int:
        return (
            Message.objects.filter(conversation_id=self.conversation_id, is_read=False)
            .exclude(sender=self.user)
            .update(is_read=True)
        )

    # ------------------------------------------------------------------
    # Serialization helpers (pure Python)
    # ------------------------------------------------------------------

    def _serialize_user(self, user: User):
        avatar_url = None
        avatar = getattr(user, "avatar", None)
        if avatar:
            try:
                avatar_url = avatar.url
            except Exception:  # pragma: no cover - defensive
                avatar_url = None
        return {"id": str(user.pk), "username": user.username, "avatar": avatar_url}

    def _serialize_message(self, message: Message):
        return {
            "id": str(message.id),
            "conversation_id": str(message.conversation_id),
            "sender": self._serialize_user(message.sender),
            "content": message.content,
            "message_type": getattr(message, "message_type", "text"),
            "is_read": message.is_read,
            "created_at": message.created_at.isoformat(),
        }
