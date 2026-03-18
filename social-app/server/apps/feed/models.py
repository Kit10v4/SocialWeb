import uuid

from django.conf import settings
from django.db import models


class FeedItem(models.Model):
    """
    Denormalized feed entry — one row per (user, post) pair.
    Pre-computed when a post is created so the news-feed query is a simple
    filter on `user` ordered by `-created_at`.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="feed"
    )
    post = models.ForeignKey(
        "posts.Post", on_delete=models.CASCADE, related_name="feed_entries"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("user", "post")

    def __str__(self):
        return f"Feed({self.user.username}) ← Post({self.post_id})"
