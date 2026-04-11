class SecurityHeadersMiddleware:
    """
    Thêm các security headers không có sẵn trong Django defaults.
    Đặt sau SecurityMiddleware trong MIDDLEWARE list.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        response["Content-Security-Policy"] = (
            "default-src 'self'; "
            "img-src 'self' data: https://res.cloudinary.com "
            "https://ui-avatars.com; "
            "script-src 'self' 'unsafe-inline' https://www.google.com "
            "https://www.gstatic.com; "
            "frame-src https://www.google.com; "
            "style-src 'self' 'unsafe-inline'; "
            "connect-src 'self' wss: https://api.cloudinary.com;"
        )

        response["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=(), "
            "payment=(), usb=(), magnetometer=()"
        )

        return response
