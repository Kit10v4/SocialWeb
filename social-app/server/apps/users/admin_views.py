"""
Admin API views for the React Admin Panel.
Only accessible by staff/superuser.
"""
from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.generics import ListAPIView, RetrieveUpdateAPIView
from rest_framework.pagination import CursorPagination
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.posts.models import Post, Comment, Like
from apps.chat.models import Conversation, Message

from .models import AuditLog, Friendship, Report, User
from .serializers import UserProfileSerializer


class AdminUserPagination(CursorPagination):
    page_size = 20
    ordering = '-created_at'
    cursor_query_param = 'cursor'


class AdminStatsView(APIView):
    """Dashboard statistics for admin panel."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        now = timezone.now()
        today = now.date()
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)

        # User statistics
        total_users = User.objects.count()
        active_users = User.objects.filter(is_active=True).count()
        new_users_today = User.objects.filter(created_at__date=today).count()
        new_users_week = User.objects.filter(created_at__gte=week_ago).count()
        new_users_month = User.objects.filter(created_at__gte=month_ago).count()
        locked_users = User.objects.filter(locked_until__gt=now).count()

        # Post statistics
        total_posts = Post.objects.count()
        posts_today = Post.objects.filter(created_at__date=today).count()
        posts_week = Post.objects.filter(created_at__gte=week_ago).count()
        total_comments = Comment.objects.count()
        total_likes = Like.objects.count()

        # Friendship statistics
        total_friendships = Friendship.objects.filter(status='accepted').count()
        pending_requests = Friendship.objects.filter(status='pending').count()

        # Report statistics
        pending_reports = Report.objects.count()

        # Chat statistics
        total_conversations = Conversation.objects.count()
        total_messages = Message.objects.count()

        return Response({
            'users': {
                'total': total_users,
                'active': active_users,
                'locked': locked_users,
                'new_today': new_users_today,
                'new_week': new_users_week,
                'new_month': new_users_month,
            },
            'posts': {
                'total': total_posts,
                'today': posts_today,
                'week': posts_week,
                'comments': total_comments,
                'likes': total_likes,
            },
            'friendships': {
                'total': total_friendships,
                'pending': pending_requests,
            },
            'reports': {
                'pending': pending_reports,
            },
            'chat': {
                'conversations': total_conversations,
                'messages': total_messages,
            },
        })


class AdminUserListView(ListAPIView):
    """List all users with filtering and search."""
    permission_classes = [IsAdminUser]
    pagination_class = AdminUserPagination

    def get_queryset(self):
        queryset = User.objects.annotate(
            post_count=Count('posts', distinct=True),
            friend_count=Count('friendships_sent', filter=Q(friendships_sent__status='accepted'), distinct=True),
        ).order_by('-created_at')

        # Search
        search = self.request.query_params.get('search', '')
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) | Q(email__icontains=search)
            )

        # Filter by status
        status_filter = self.request.query_params.get('status', '')
        if status_filter == 'active':
            queryset = queryset.filter(is_active=True)
        elif status_filter == 'inactive':
            queryset = queryset.filter(is_active=False)
        elif status_filter == 'locked':
            queryset = queryset.filter(locked_until__gt=timezone.now())
        elif status_filter == 'staff':
            queryset = queryset.filter(is_staff=True)

        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)

        users = []
        for user in page:
            users.append({
                'id': str(user.id),
                'username': user.username,
                'email': user.email,
                'avatar': user.avatar.url if user.avatar else None,
                'bio': user.bio,
                'is_active': user.is_active,
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser,
                'is_locked': user.is_locked_out(),
                'locked_until': user.locked_until,
                'failed_login_attempts': user.failed_login_attempts,
                'post_count': user.post_count,
                'friend_count': user.friend_count,
                'created_at': user.created_at,
                'updated_at': user.updated_at,
            })

        return self.get_paginated_response(users)


class AdminUserDetailView(RetrieveUpdateAPIView):
    """Get or update a single user."""
    permission_classes = [IsAdminUser]
    queryset = User.objects.all()
    lookup_field = 'id'

    def retrieve(self, request, *args, **kwargs):
        user = self.get_object()
        
        # Get user's recent posts
        recent_posts = Post.objects.filter(author=user).order_by('-created_at')[:5]
        posts_data = [{
            'id': str(p.id),
            'content': p.content[:100],
            'privacy': p.privacy,
            'created_at': p.created_at,
            'like_count': p.likes.count(),
            'comment_count': p.comments.count(),
        } for p in recent_posts]

        # Get user's friends count
        friend_count = Friendship.objects.filter(
            Q(from_user=user, status='accepted') | Q(to_user=user, status='accepted')
        ).count()

        # Get reports about this user
        reports_received = Report.objects.filter(target_user=user).select_related('reporter')
        reports_data = [{
            'id': r.id,
            'reporter': r.reporter.username,
            'reason': r.reason,
            'detail': r.detail,
            'created_at': r.created_at,
        } for r in reports_received]

        # Get recent audit logs for this user
        audit_logs = AuditLog.objects.filter(
            Q(user=user) | Q(email=user.email)
        ).order_by('-created_at')[:20]
        audit_data = [{
            'event_type': log.event_type,
            'ip_address': log.ip_address,
            'created_at': log.created_at,
        } for log in audit_logs]

        return Response({
            'id': str(user.id),
            'username': user.username,
            'email': user.email,
            'avatar': user.avatar.url if user.avatar else None,
            'cover_photo': user.cover_photo.url if user.cover_photo else None,
            'bio': user.bio,
            'date_of_birth': user.date_of_birth,
            'is_active': user.is_active,
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser,
            'is_locked': user.is_locked_out(),
            'locked_until': user.locked_until,
            'failed_login_attempts': user.failed_login_attempts,
            'terms_accepted_at': user.terms_accepted_at,
            'created_at': user.created_at,
            'updated_at': user.updated_at,
            'post_count': Post.objects.filter(author=user).count(),
            'friend_count': friend_count,
            'recent_posts': posts_data,
            'reports_received': reports_data,
            'audit_logs': audit_data,
        })

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        
        # Prevent demoting self
        if user == request.user:
            if 'is_staff' in request.data and not request.data['is_staff']:
                return Response(
                    {'error': 'Không thể tự bỏ quyền staff của chính mình'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if 'is_active' in request.data and not request.data['is_active']:
                return Response(
                    {'error': 'Không thể tự vô hiệu hóa tài khoản của mình'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Update allowed fields
        allowed_fields = ['is_active', 'is_staff']
        for field in allowed_fields:
            if field in request.data:
                setattr(user, field, request.data[field])

        user.save()
        return Response({'status': 'updated'})


class AdminUserActionView(APIView):
    """Perform actions on users (ban, activate, unlock)."""
    permission_classes = [IsAdminUser]

    def post(self, request, id, action):
        try:
            user = User.objects.get(id=id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        # Prevent actions on self
        if user == request.user:
            return Response(
                {'error': 'Không thể thực hiện action này trên chính mình'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Prevent actions on superusers (unless by superuser)
        if user.is_superuser and not request.user.is_superuser:
            return Response(
                {'error': 'Không có quyền thao tác với superuser'},
                status=status.HTTP_403_FORBIDDEN
            )

        if action == 'activate':
            user.is_active = True
            user.save(update_fields=['is_active'])
            return Response({'status': 'activated', 'is_active': True})

        elif action == 'deactivate':
            user.is_active = False
            user.save(update_fields=['is_active'])
            return Response({'status': 'deactivated', 'is_active': False})

        elif action == 'unlock':
            user.failed_login_attempts = 0
            user.locked_until = None
            user.save(update_fields=['failed_login_attempts', 'locked_until'])
            return Response({'status': 'unlocked'})

        elif action == 'make_staff':
            user.is_staff = True
            user.save(update_fields=['is_staff'])
            return Response({'status': 'now_staff', 'is_staff': True})

        elif action == 'remove_staff':
            user.is_staff = False
            user.save(update_fields=['is_staff'])
            return Response({'status': 'staff_removed', 'is_staff': False})

        else:
            return Response(
                {'error': f'Unknown action: {action}'},
                status=status.HTTP_400_BAD_REQUEST
            )


class AdminReportListView(ListAPIView):
    """List all reports."""
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        return Report.objects.select_related('reporter', 'target_user').order_by('-created_at')

    def list(self, request, *args, **kwargs):
        reports = self.get_queryset()
        data = [{
            'id': r.id,
            'reporter': {
                'id': str(r.reporter.id),
                'username': r.reporter.username,
                'avatar': r.reporter.avatar.url if r.reporter.avatar else None,
            },
            'target_user': {
                'id': str(r.target_user.id),
                'username': r.target_user.username,
                'avatar': r.target_user.avatar.url if r.target_user.avatar else None,
                'is_active': r.target_user.is_active,
            },
            'reason': r.reason,
            'reason_display': r.get_reason_display(),
            'detail': r.detail,
            'created_at': r.created_at,
        } for r in reports]

        return Response(data)


class AdminReportActionView(APIView):
    """Handle report actions (dismiss, ban user)."""
    permission_classes = [IsAdminUser]

    def post(self, request, id, action):
        try:
            report = Report.objects.select_related('target_user').get(id=id)
        except Report.DoesNotExist:
            return Response({'error': 'Report not found'}, status=status.HTTP_404_NOT_FOUND)

        if action == 'dismiss':
            report.delete()
            return Response({'status': 'dismissed'})

        elif action == 'ban':
            target = report.target_user
            if not target.is_superuser:
                target.is_active = False
                target.save(update_fields=['is_active'])
            report.delete()
            return Response({'status': 'banned_and_dismissed'})

        else:
            return Response(
                {'error': f'Unknown action: {action}'},
                status=status.HTTP_400_BAD_REQUEST
            )


class AdminAuditLogListView(ListAPIView):
    """List recent audit logs."""
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        return AuditLog.objects.select_related('user').order_by('-created_at')[:100]

    def list(self, request, *args, **kwargs):
        logs = self.get_queryset()
        data = [{
            'id': log.id,
            'event_type': log.event_type,
            'event_display': log.get_event_type_display(),
            'email': log.email,
            'user': {
                'id': str(log.user.id),
                'username': log.user.username,
            } if log.user else None,
            'ip_address': log.ip_address,
            'created_at': log.created_at,
        } for log in logs]

        return Response(data)
