from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.posts.models import Comment, Like
from apps.users.models import Friendship

from .models import Notification
from .utils import broadcast_notification


@receiver(post_save, sender=Like)
def create_like_notification(sender, instance: Like, created, **kwargs):
    """Notify post author when someone likes their post."""

    if not created:
        return

    post = instance.post
    recipient = post.author
    sender_user = instance.user

    if recipient.id == sender_user.id:
        return

    notif = Notification.objects.create(
        recipient=recipient,
        sender=sender_user,
        notification_type=Notification.Type.LIKE,
        text=f"{sender_user.username} đã thích bài viết của bạn",
        target_id=post.id,
    )
    broadcast_notification(notif)


@receiver(post_save, sender=Comment)
def create_comment_notification(sender, instance: Comment, created, **kwargs):
    """Notify post author when someone comments on their post."""

    if not created:
        return

    post = instance.post
    recipient = post.author
    sender_user = instance.author

    if recipient.id == sender_user.id:
        return

    notif = Notification.objects.create(
        recipient=recipient,
        sender=sender_user,
        notification_type=Notification.Type.COMMENT,
        text=f"{sender_user.username} đã bình luận về bài viết của bạn",
        target_id=post.id,
    )
    broadcast_notification(notif)


@receiver(post_save, sender=Friendship)
def create_friendship_notification(sender, instance: Friendship, created, **kwargs):
    """Notify users on new friend request / acceptance."""

    if created and instance.status == Friendship.Status.PENDING:
        # New friend request → notify recipient (to_user)
        notif = Notification.objects.create(
            recipient=instance.to_user,
            sender=instance.from_user,
            notification_type=Notification.Type.FRIEND_REQUEST,
            text=f"{instance.from_user.username} đã gửi lời mời kết bạn",
            target_id=instance.id,
        )
        broadcast_notification(notif)
    elif instance.status == Friendship.Status.ACCEPTED:
        # Friend request accepted → notify requester (from_user)
        notif = Notification.objects.create(
            recipient=instance.from_user,
            sender=instance.to_user,
            notification_type=Notification.Type.FRIEND_ACCEPT,
            text=f"{instance.to_user.username} đã chấp nhận lời mời kết bạn",
            target_id=instance.id,
        )
        broadcast_notification(notif)
