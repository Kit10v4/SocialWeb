import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Conversation(models.Model):
    """A chat conversation between two or more users."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL, related_name="conversations"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        verbose_name = "conversation"
        verbose_name_plural = "conversations"

    def __str__(self):
        names = ", ".join(u.username for u in self.participants.all()[:3])
        return f"Conversation({names})"


class Message(models.Model):
    """A single message inside a conversation."""

    class MessageType(models.TextChoices):
        TEXT = "text", "Text"
        IMAGE = "image", "Image"
        FILE = "file", "File"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="messages_sent"
    )
    content = models.TextField(max_length=3000, blank=True)
    message_type = models.CharField(
        max_length=10, choices=MessageType.choices, default=MessageType.TEXT
    )
    image = models.ImageField(upload_to="chat/", blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        verbose_name = "message"
        verbose_name_plural = "messages"

    def __str__(self):
        base = self.content or "[attachment]"
        return f"{self.sender.username}: {base[:40]}"

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        super().save(*args, **kwargs)
        # When a new message is created, bump the parent conversation's updated_at
        if is_new and self.conversation_id:
            Conversation.objects.filter(pk=self.conversation_id).update(
                updated_at=timezone.now()
            )
