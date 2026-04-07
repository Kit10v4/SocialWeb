from django.urls import path

from .views import FeedActiveFriendsView, FeedView, TrendingPostsView

urlpatterns = [
    path("feed/", FeedView.as_view(), name="feed"),
    path("feed/active-friends/", FeedActiveFriendsView.as_view(), name="feed-active-friends"),
    path("posts/trending/", TrendingPostsView.as_view(), name="posts-trending"),
]
