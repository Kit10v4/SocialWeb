from django.urls import path

from .views import FeedStoriesView, FeedView, TrendingPostsView

urlpatterns = [
    path("feed/", FeedView.as_view(), name="feed"),
    path("feed/stories/", FeedStoriesView.as_view(), name="feed-stories"),
    path("posts/trending/", TrendingPostsView.as_view(), name="posts-trending"),
]
