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
# from apps.chat.routing import websocket_urlpatterns  # uncomment when ready

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        # Uncomment below when you create websocket routes:
        # "websocket": AuthMiddlewareStack(
        #     URLRouter(websocket_urlpatterns)
        # ),
    }
)
