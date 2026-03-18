from django.urls import path

from .views import (
    ConversationListCreateView,
    ConversationMarkReadView,
    MessageListView,
)

urlpatterns = [
    path("conversations/", ConversationListCreateView.as_view(), name="conversation-list"),
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
