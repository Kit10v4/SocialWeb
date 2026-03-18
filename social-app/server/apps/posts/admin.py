from django.contrib import admin

from .models import Comment, Like, Post, PostImage, SavedPost


class PostImageInline(admin.TabularInline):
    model = PostImage
    extra = 0
    fields = ("image", "order")


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("author", "short_content", "privacy", "image_count", "created_at")
    list_filter = ("privacy", "created_at")
    search_fields = ("author__username", "content")
    inlines = (PostImageInline,)

    @admin.display(description="Content")
    def short_content(self, obj):
        return obj.content[:80] if obj.content else "[no text]"

    @admin.display(description="Images")
    def image_count(self, obj):
        return obj.images.count()


@admin.register(PostImage)
class PostImageAdmin(admin.ModelAdmin):
    list_display = ("post", "image", "order")
    list_filter = ("post",)


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("author", "post", "parent", "short_content", "created_at")
    list_filter = ("created_at",)
    search_fields = ("author__username", "content")

    @admin.display(description="Content")
    def short_content(self, obj):
        return obj.content[:80]


@admin.register(Like)
class LikeAdmin(admin.ModelAdmin):
    list_display = ("user", "post", "created_at")
    search_fields = ("user__username",)


@admin.register(SavedPost)
class SavedPostAdmin(admin.ModelAdmin):
    list_display = ("user", "post", "created_at")
    search_fields = ("user__username",)
