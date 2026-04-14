from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "id", "recipient_link", "sender_link", "notification_type", 
        "short_text", "is_read", "created_at"
    )
    list_filter = ("notification_type", "is_read", "created_at")
    search_fields = ("recipient__username", "sender__username", "text")
    raw_id_fields = ("recipient", "sender")
    list_per_page = 100
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    actions = ["mark_as_read", "mark_as_unread", "delete_old_notifications"]

    @admin.display(description="Recipient")
    def recipient_link(self, obj):
        url = reverse("admin:users_user_change", args=[obj.recipient.id])
        return format_html('<a href="{}">{}</a>', url, obj.recipient.username)

    @admin.display(description="Sender")
    def sender_link(self, obj):
        url = reverse("admin:users_user_change", args=[obj.sender.id])
        return format_html('<a href="{}">{}</a>', url, obj.sender.username)

    @admin.display(description="Text")
    def short_text(self, obj):
        return obj.text[:50] + "..." if len(obj.text) > 50 else obj.text

    @admin.action(description="Mark selected as read")
    def mark_as_read(self, request, queryset):
        count = queryset.update(is_read=True)
        self.message_user(request, f"{count} notification(s) marked as read.")

    @admin.action(description="Mark selected as unread")
    def mark_as_unread(self, request, queryset):
        count = queryset.update(is_read=False)
        self.message_user(request, f"{count} notification(s) marked as unread.")

    @admin.action(description="Delete all read notifications (cleanup)")
    def delete_old_notifications(self, request, queryset):
        count = queryset.filter(is_read=True).delete()[0]
        self.message_user(request, f"{count} read notification(s) deleted.")
