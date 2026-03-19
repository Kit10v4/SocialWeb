from django.urls import path

from . import views

urlpatterns = [
    # --- Posts CRUD ---------------------------------------------------------
    path("posts/", views.PostListCreateView.as_view(), name="post-list-create"),
    path("posts/search/", views.PostSearchView.as_view(), name="post-search"),
    path("posts/saved/", views.SavedPostListView.as_view(), name="post-saved-list"),
    path("posts/<uuid:pk>/", views.PostDetailView.as_view(), name="post-detail"),

    # --- Like / Save --------------------------------------------------------
    path("posts/<uuid:pk>/like/", views.LikeToggleView.as_view(), name="post-like"),
    path("posts/<uuid:pk>/save/", views.SaveToggleView.as_view(), name="post-save"),

    # --- Comments -----------------------------------------------------------
    path("posts/<uuid:pk>/comments/", views.CommentListCreateView.as_view(), name="post-comments"),
    path("comments/<uuid:pk>/", views.CommentDeleteView.as_view(), name="comment-delete"),
]
