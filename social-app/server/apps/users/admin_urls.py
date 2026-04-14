"""Admin API URLs."""
from django.urls import path
from . import admin_views

urlpatterns = [
    # Dashboard stats
    path('stats/', admin_views.AdminStatsView.as_view(), name='admin-stats'),
    
    # Users management
    path('users/', admin_views.AdminUserListView.as_view(), name='admin-users'),
    path('users/<uuid:id>/', admin_views.AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('users/<uuid:id>/<str:action>/', admin_views.AdminUserActionView.as_view(), name='admin-user-action'),
    
    # Reports management
    path('reports/', admin_views.AdminReportListView.as_view(), name='admin-reports'),
    path('reports/<int:id>/<str:action>/', admin_views.AdminReportActionView.as_view(), name='admin-report-action'),
    
    # Audit logs
    path('audit-logs/', admin_views.AdminAuditLogListView.as_view(), name='admin-audit-logs'),
]
