from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.db.models import Count

from .models import Conversation, Message


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "participant_names", "message_count", "last_message_preview", "created_at", "updated_at")
    search_fields = ("participants__username",)
    list_per_page = 50
    ordering = ("-updated_at",)

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _message_count=Count("messages", distinct=True),
        )

    @admin.display(description="Participants")
    def participant_names(self, obj):
        participants = obj.participants.all()[:4]
        links = []
        for user in participants:
            url = reverse("admin:users_user_change", args=[user.id])
            links.append(format_html('<a href="{}">{}</a>', url, user.username))
        return format_html(", ".join(links))

    @admin.display(description="Messages", ordering="_message_count")
    def message_count(self, obj):
        return obj._message_count

    @admin.display(description="Last Message")
    def last_message_preview(self, obj):
        last_msg = obj.messages.order_by("-created_at").first()
        if last_msg:
            content = last_msg.content[:40] + "..." if len(last_msg.content) > 40 else last_msg.content
            return f"{last_msg.sender.username}: {content}"
        return "-"


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "sender_link", "conversation_link", "short_content", "is_read", "created_at")
    list_filter = ("is_read", "created_at")
    search_fields = ("sender__username", "content")
    raw_id_fields = ("sender", "conversation")
    list_per_page = 100
    ordering = ("-created_at",)
    actions = ["mark_as_read", "mark_as_unread"]

    @admin.display(description="Sender")
    def sender_link(self, obj):
        url = reverse("admin:users_user_change", args=[obj.sender.id])
        return format_html('<a href="{}">{}</a>', url, obj.sender.username)

    @admin.display(description="Conversation")
    def conversation_link(self, obj):
        url = reverse("admin:chat_conversation_change", args=[obj.conversation.id])
        return format_html('<a href="{}">Conv #{}</a>', url, str(obj.conversation.id)[:8])

    @admin.display(description="Content")
    def short_content(self, obj):
        return obj.content[:60] + "..." if len(obj.content) > 60 else obj.content

    @admin.action(description="Mark selected messages as read")
    def mark_as_read(self, request, queryset):
        count = queryset.update(is_read=True)
        self.message_user(request, f"{count} message(s) marked as read.")

    @admin.action(description="Mark selected messages as unread")
    def mark_as_unread(self, request, queryset):
        count = queryset.update(is_read=False)
        self.message_user(request, f"{count} message(s) marked as unread.")
