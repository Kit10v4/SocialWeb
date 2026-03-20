from django.urls import path

from .views import (
    ConversationListCreateView,
    ConversationMarkReadView,
    MessageListView,
    UnreadCountView,
)

urlpatterns = [
    path("conversations/", ConversationListCreateView.as_view(), name="conversation-list"),
    path(
        "conversations/unread-count/",
        UnreadCountView.as_view(),
        name="conversation-unread-count",
    ),
    path(
        "conversations/<uuid:pk>/messages/",
        MessageListView.as_view(),
        name="conversation-messages",
    ),
    path(
        "conversations/<uuid:pk>/read/",
        ConversationMarkReadView.as_view(),
        name="conversation-mark-read",
    ),
]
