from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.http import JsonResponse


def health_check(request):
    """Health check endpoint for UptimeRobot to keep Render server alive."""
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("admin/", admin.site.urls),
    path("api/", include("apps.users.urls")),
    path("api/", include("apps.posts.urls")),
    path("api/", include("apps.feed.urls")),
    path("api/", include("apps.chat.urls")),
    path("api/", include("apps.notifications.urls")),
]

if "debug_toolbar" in settings.INSTALLED_APPS:
    import debug_toolbar

    urlpatterns += [
        path("__debug__/", include(debug_toolbar.urls)),
    ]
