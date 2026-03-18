from django.contrib import admin

from .models import Conversation, Message


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "participant_names", "created_at", "updated_at")
    search_fields = ("participants__username",)

    @admin.display(description="Participants")
    def participant_names(self, obj):
        return ", ".join(u.username for u in obj.participants.all()[:4])


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("sender", "conversation", "short_content", "is_read", "created_at")
    list_filter = ("is_read", "created_at")
    search_fields = ("sender__username", "content")

    @admin.display(description="Content")
    def short_content(self, obj):
        return obj.content[:80]
