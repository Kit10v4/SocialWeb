from django.contrib import admin

from .models import FeedItem


@admin.register(FeedItem)
class FeedItemAdmin(admin.ModelAdmin):
    list_display = ("user", "post", "created_at")
    search_fields = ("user__username",)
