from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class CookieJWTAuthentication(JWTAuthentication):
    """
    Đọc JWT access token từ httpOnly cookie 'access_token'
    thay vì Authorization header.
    Fallback về header nếu cookie không có.
    """

    def authenticate(self, request):
        raw_token = request.COOKIES.get("access_token")

        if raw_token is None:
            # Không có cookie -> fallback về Authorization header
            return super().authenticate(request)

        try:
            validated_token = self.get_validated_token(raw_token)
            return self.get_user(validated_token), validated_token
        except (InvalidToken, TokenError):
            # Token hết hạn/invalid -> fallback về Authorization header
            # Nếu header cũng không có -> return None để frontend gọi refresh
            return super().authenticate(request)
