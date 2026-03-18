"""
ASGI config for social-app project.
Supports HTTP + WebSocket via Django Channels.
"""

import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Initialize Django ASGI application early to ensure AppRegistry is populated
django_asgi_app = get_asgi_application()

# Import websocket routes after Django setup
from apps.chat.middleware import JWTAuthMiddleware
from apps.chat.routing import websocket_urlpatterns as chat_websocket_urlpatterns
from apps.notifications.routing import (
    websocket_urlpatterns as notifications_websocket_urlpatterns,
)

combined_websocket_urlpatterns = [
    *chat_websocket_urlpatterns,
    *notifications_websocket_urlpatterns,
]

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JWTAuthMiddleware(
            AuthMiddlewareStack(
                URLRouter(combined_websocket_urlpatterns)
            )
        ),
    }
)
