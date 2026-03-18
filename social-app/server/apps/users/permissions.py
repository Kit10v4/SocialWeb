from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsOwnerOrReadOnly(BasePermission):
    """
    Object-level permission:
    - Read (GET, HEAD, OPTIONS) → allowed for anyone authenticated.
    - Write (PUT, PATCH, DELETE) → allowed only if obj.author/obj.user == request.user.

    Works with any model that has an `author` or `user` FK to User.
    """

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True

        # Support models that use `author` (Post, Comment) or `user` (Like, FeedItem)
        owner = getattr(obj, "author", None) or getattr(obj, "user", None)
        return owner == request.user
