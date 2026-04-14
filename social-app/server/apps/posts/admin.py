from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.db.models import Count

from .models import Comment, Like, Post, PostImage, SavedPost


class PostImageInline(admin.TabularInline):
    model = PostImage
    extra = 0
    fields = ("image", "order")


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = (
        "id", "author_link", "short_content", "privacy", 
        "image_count", "like_count", "comment_count", "created_at"
    )
    list_filter = ("privacy", "created_at")
    search_fields = ("author__username", "author__email", "content")
    inlines = (PostImageInline,)
    raw_id_fields = ("author",)
    list_per_page = 50
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
    actions = ["make_public", "make_private", "delete_selected_posts"]

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _like_count=Count("likes", distinct=True),
            _comment_count=Count("comments", distinct=True),
        )

    @admin.display(description="Author")
    def author_link(self, obj):
        url = reverse("admin:users_user_change", args=[obj.author.id])
        return format_html('<a href="{}">{}</a>', url, obj.author.username)

    @admin.display(description="Content")
    def short_content(self, obj):
        return obj.content[:60] + "..." if obj.content and len(obj.content) > 60 else (obj.content or "[no text]")

    @admin.display(description="Images")
    def image_count(self, obj):
        return obj.images.count()

    @admin.display(description="Likes", ordering="_like_count")
    def like_count(self, obj):
        return obj._like_count

    @admin.display(description="Comments", ordering="_comment_count")
    def comment_count(self, obj):
        return obj._comment_count

    @admin.action(description="Make selected posts public")
    def make_public(self, request, queryset):
        count = queryset.update(privacy="public")
        self.message_user(request, f"{count} post(s) set to public.")

    @admin.action(description="Make selected posts private (friends only)")
    def make_private(self, request, queryset):
        count = queryset.update(privacy="friends")
        self.message_user(request, f"{count} post(s) set to friends only.")

    @admin.action(description="Delete selected posts")
    def delete_selected_posts(self, request, queryset):
        count = queryset.count()
        queryset.delete()
        self.message_user(request, f"{count} post(s) deleted.")


@admin.register(PostImage)
class PostImageAdmin(admin.ModelAdmin):
    list_display = ("id", "post_link", "image_preview", "order", "created_at")
    list_filter = ("created_at",)
    raw_id_fields = ("post",)

    @admin.display(description="Post")
    def post_link(self, obj):
        url = reverse("admin:posts_post_change", args=[obj.post.id])
        return format_html('<a href="{}">Post #{}</a>', url, obj.post.id)

    @admin.display(description="Preview")
    def image_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" width="60" height="60" style="object-fit:cover;border-radius:4px;" />', obj.image.url)
        return "-"

    def created_at(self, obj):
        return obj.post.created_at
    created_at.short_description = "Created"


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("id", "author_link", "post_link", "short_content", "is_reply", "created_at")
    list_filter = ("created_at",)
    search_fields = ("author__username", "content")
    raw_id_fields = ("author", "post", "parent")
    list_per_page = 50
    ordering = ("-created_at",)
    actions = ["delete_selected_comments"]

    @admin.display(description="Author")
    def author_link(self, obj):
        url = reverse("admin:users_user_change", args=[obj.author.id])
        return format_html('<a href="{}">{}</a>', url, obj.author.username)

    @admin.display(description="Post")
    def post_link(self, obj):
        url = reverse("admin:posts_post_change", args=[obj.post.id])
        return format_html('<a href="{}">Post #{}</a>', url, obj.post.id)

    @admin.display(description="Content")
    def short_content(self, obj):
        return obj.content[:50] + "..." if len(obj.content) > 50 else obj.content

    @admin.display(description="Reply", boolean=True)
    def is_reply(self, obj):
        return obj.parent is not None

    @admin.action(description="Delete selected comments")
    def delete_selected_comments(self, request, queryset):
        count = queryset.count()
        queryset.delete()
        self.message_user(request, f"{count} comment(s) deleted.")


@admin.register(Like)
class LikeAdmin(admin.ModelAdmin):
    list_display = ("user_link", "post_link", "created_at")
    search_fields = ("user__username",)
    raw_id_fields = ("user", "post")
    list_per_page = 100

    @admin.display(description="User")
    def user_link(self, obj):
        url = reverse("admin:users_user_change", args=[obj.user.id])
        return format_html('<a href="{}">{}</a>', url, obj.user.username)

    @admin.display(description="Post")
    def post_link(self, obj):
        url = reverse("admin:posts_post_change", args=[obj.post.id])
        return format_html('<a href="{}">Post #{}</a>', url, obj.post.id)


@admin.register(SavedPost)
class SavedPostAdmin(admin.ModelAdmin):
    list_display = ("user_link", "post_link", "created_at")
    search_fields = ("user__username",)
    raw_id_fields = ("user", "post")
    list_per_page = 100

    @admin.display(description="User")
    def user_link(self, obj):
        url = reverse("admin:users_user_change", args=[obj.user.id])
        return format_html('<a href="{}">{}</a>', url, obj.user.username)

    @admin.display(description="Post")
    def post_link(self, obj):
        url = reverse("admin:posts_post_change", args=[obj.post.id])
        return format_html('<a href="{}">Post #{}</a>', url, obj.post.id)
