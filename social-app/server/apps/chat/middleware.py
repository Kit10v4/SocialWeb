from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()


@database_sync_to_async
def _get_user_from_token(token: str):
    if not token:
        return AnonymousUser()
    try:
        access = AccessToken(token)
        user_id = access.get("user_id")
        if not user_id:
            return AnonymousUser()
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return AnonymousUser()
    except (TokenError, InvalidToken):
        return AnonymousUser()


class JWTAuthMiddleware:
    """Simple JWT auth middleware for WebSocket connections.

    Expects the access token in the query string as `?token=<JWT>` and
    attaches the corresponding user to `scope["user"]`.
    """

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode()
        query_params = parse_qs(query_string)
        token_list = query_params.get("token") or []
        token = token_list[0] if token_list else None

        scope["user"] = await _get_user_from_token(token)
        return await self.inner(scope, receive, send)
