from django.urls import path

from . import views

urlpatterns = [
    # --- Auth ---------------------------------------------------------------
    path("auth/register/", views.RegisterView.as_view(), name="auth-register"),
    path("auth/login/", views.LoginView.as_view(), name="auth-login"),
    path("auth/refresh/", views.CustomTokenRefreshView.as_view(), name="auth-refresh"),
    path("auth/logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", views.MeView.as_view(), name="auth-me"),

    # --- Profile ------------------------------------------------------------
    path("users/me/", views.UpdateMyProfileView.as_view(), name="user-update-me"),
    path("users/search/", views.UserSearchView.as_view(), name="user-search"),
    path("users/suggestions/", views.SuggestionsView.as_view(), name="user-suggestions"),
    path("users/<str:username>/", views.UserProfileView.as_view(), name="user-profile"),

    # --- Friends ------------------------------------------------------------
    path("friends/", views.FriendListView.as_view(), name="friend-list"),
    path("friends/requests/", views.FriendRequestListView.as_view(), name="friend-requests"),
    path("friends/request/<uuid:user_id>/", views.SendFriendRequestView.as_view(), name="friend-request-send"),
    path("friends/accept/<uuid:user_id>/", views.AcceptFriendRequestView.as_view(), name="friend-request-accept"),
    path("friends/reject/<uuid:user_id>/", views.RejectFriendRequestView.as_view(), name="friend-request-reject"),
    path("friends/<uuid:user_id>/", views.UnfriendView.as_view(), name="friend-unfriend"),
]
