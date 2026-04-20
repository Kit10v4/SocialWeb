from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from django.urls import reverse
from django.db.models import Count

from .models import AuditLog, Friendship, Report, User, PasswordResetToken, EmailVerificationToken


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        "username", "email", "is_active", "is_staff", 
        "is_verified", "post_count", "friend_count", "created_at"
    )
    list_filter = ("is_active", "is_staff", "is_superuser", "created_at")
    search_fields = ("username", "email")
    ordering = ("-created_at",)
    list_per_page = 50
    date_hierarchy = "created_at"
    actions = ["activate_users", "deactivate_users", "unlock_users", "send_verification_email"]

    fieldsets = (
        (None, {"fields": ("email", "username", "password")}),
        ("Profile", {"fields": ("avatar", "cover_photo", "bio", "date_of_birth")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Security", {"fields": ("failed_login_attempts", "locked_until", "terms_accepted_at")}),
        ("Dates", {"fields": ("created_at", "updated_at")}),
    )
    readonly_fields = ("created_at", "updated_at", "failed_login_attempts", "locked_until")
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "username", "password1", "password2")}),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            _post_count=Count("posts", distinct=True),
            _friend_count=Count("friendships_sent", distinct=True),
        )

    @admin.display(description="Verified", boolean=True)
    def is_verified(self, obj):
        try:
            return obj.is_active and not EmailVerificationToken.objects.filter(user=obj).exists()
        except Exception:
            return obj.is_active

    @admin.display(description="Posts", ordering="_post_count")
    def post_count(self, obj):
        return obj._post_count

    @admin.display(description="Friends", ordering="_friend_count")
    def friend_count(self, obj):
        return obj._friend_count

    @admin.action(description="Activate selected users")
    def activate_users(self, request, queryset):
        count = queryset.update(is_active=True)
        self.message_user(request, f"{count} user(s) activated.")

    @admin.action(description="Deactivate selected users")
    def deactivate_users(self, request, queryset):
        count = queryset.exclude(is_superuser=True).update(is_active=False)
        self.message_user(request, f"{count} user(s) deactivated.")

    @admin.action(description="Unlock selected users (clear failed logins)")
    def unlock_users(self, request, queryset):
        count = queryset.update(failed_login_attempts=0, locked_until=None)
        self.message_user(request, f"{count} user(s) unlocked.")

    @admin.action(description="Resend verification email")
    def send_verification_email(self, request, queryset):
        from .utils import send_verification_email
        count = 0
        for user in queryset.filter(is_active=True):
            send_verification_email(user)
            count += 1
        self.message_user(request, f"Verification email sent to {count} user(s).")


@admin.register(Friendship)
class FriendshipAdmin(admin.ModelAdmin):
    list_display = ("from_user", "to_user", "status", "created_at", "updated_at")
    list_filter = ("status", "created_at")
    search_fields = ("from_user__username", "to_user__username", "from_user__email", "to_user__email")
    list_per_page = 50
    raw_id_fields = ("from_user", "to_user")
    actions = ["accept_requests", "reject_requests"]

    @admin.action(description="Accept selected friend requests")
    def accept_requests(self, request, queryset):
        count = queryset.filter(status="pending").update(status="accepted")
        self.message_user(request, f"{count} request(s) accepted.")

    @admin.action(description="Reject selected friend requests")
    def reject_requests(self, request, queryset):
        count = queryset.filter(status="pending").delete()[0]
        self.message_user(request, f"{count} request(s) rejected and deleted.")


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = (
        "id", "reporter_link", "target_user_link", "reason", 
        "short_detail", "created_at", "action_buttons"
    )
    list_filter = ("reason", "created_at")
    search_fields = ("reporter__username", "target_user__username", "detail")
    readonly_fields = ("reporter", "target_user", "reason", "detail", "created_at")
    list_per_page = 30
    ordering = ("-created_at",)
    actions = ["ban_reported_users", "dismiss_reports"]

    @admin.display(description="Reporter")
    def reporter_link(self, obj):
        url = reverse("admin:users_user_change", args=[obj.reporter.id])
        return format_html('<a href="{}">{}</a>', url, obj.reporter.username)

    @admin.display(description="Reported User")
    def target_user_link(self, obj):
        url = reverse("admin:users_user_change", args=[obj.target_user.id])
        return format_html('<a href="{}">{}</a>', url, obj.target_user.username)

    @admin.display(description="Detail")
    def short_detail(self, obj):
        return obj.detail[:50] + "..." if len(obj.detail) > 50 else obj.detail

    @admin.display(description="Actions")
    def action_buttons(self, obj):
        ban_url = reverse("admin:users_user_change", args=[obj.target_user.id])
        return format_html(
            '<a class="button" href="{}">View User</a>',
            ban_url
        )

    @admin.action(description="Ban reported users (deactivate)")
    def ban_reported_users(self, request, queryset):
        user_ids = queryset.values_list("target_user_id", flat=True)
        count = User.objects.filter(id__in=user_ids, is_superuser=False).update(is_active=False)
        queryset.delete()
        self.message_user(request, f"{count} user(s) banned, reports dismissed.")

    @admin.action(description="Dismiss reports (no action)")
    def dismiss_reports(self, request, queryset):
        count = queryset.delete()[0]
        self.message_user(request, f"{count} report(s) dismissed.")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("event_type", "email", "user_link", "ip_address", "created_at")
    list_filter = ("event_type", "created_at")
    search_fields = ("email", "ip_address", "user__username")
    readonly_fields = (
        "event_type", "email", "user", "ip_address",
        "user_agent", "detail", "created_at",
    )
    ordering = ("-created_at",)
    list_per_page = 100
    date_hierarchy = "created_at"

    @admin.display(description="User")
    def user_link(self, obj):
        if obj.user:
            url = reverse("admin:users_user_change", args=[obj.user.id])
            return format_html('<a href="{}">{}</a>', url, obj.user.username)
        return "-"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "is_used", "is_valid_display", "created_at")
    list_filter = ("is_used", "created_at")
    search_fields = ("user__username", "user__email")
    readonly_fields = ("user", "token", "is_used", "created_at")
    ordering = ("-created_at",)

    @admin.display(description="Valid", boolean=True)
    def is_valid_display(self, obj):
        return obj.is_valid()

    def has_add_permission(self, request):
        return False


@admin.register(EmailVerificationToken)
class EmailVerificationTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "is_valid_display", "created_at")
    list_filter = ("created_at",)
    search_fields = ("user__username", "user__email")
    readonly_fields = ("user", "token", "created_at")
    ordering = ("-created_at",)

    @admin.display(description="Valid", boolean=True)
    def is_valid_display(self, obj):
        return obj.is_valid()

    def has_add_permission(self, request):
        return False


# ── Customize Admin Site ─────────────────────────────────────────────
admin.site.site_header = "Connect Administration"
admin.site.site_title = "Connect Admin"
admin.site.index_title = "Dashboard"
