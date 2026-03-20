from django.db.models import Q
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import User

from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer


class ConversationListCreateView(APIView):
    """List user's conversations or create/get a 1-1 conversation."""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        qs = (
            Conversation.objects.filter(participants=request.user)
            .prefetch_related("participants")
            .order_by("-updated_at")
        )
        serializer = ConversationSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    def post(self, request):
        other_id = request.data.get("user_id")
        if not other_id:
            return Response(
                {"detail": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST
            )

        if str(other_id) == str(request.user.pk):
            return Response(
                {"detail": "Cannot create a conversation with yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            other_user = User.objects.get(pk=other_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        conv = (
            Conversation.objects.filter(participants=request.user)
            .filter(participants=other_user)
            .first()
        )

        if not conv:
            conv = Conversation.objects.create()
            conv.participants.set([request.user, other_user])

        serializer = ConversationSerializer(conv, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class MessageListView(generics.ListAPIView):
    """Paginated message history for a conversation."""

    permission_classes = (IsAuthenticated,)
    serializer_class = MessageSerializer

    def get_queryset(self):
        user = self.request.user
        conv_id = self.kwargs["pk"]

        # Ensure the user is a participant
        if not Conversation.objects.filter(id=conv_id, participants=user).exists():
            from rest_framework.exceptions import NotFound

            raise NotFound("Conversation not found.")

        return (
            Message.objects.filter(conversation_id=conv_id)
            .select_related("sender")
            .order_by("-created_at")
        )


class ConversationMarkReadView(APIView):
    """Mark all messages in a conversation as read for the current user."""

    permission_classes = (IsAuthenticated,)

    def post(self, request, pk):
        user = request.user

        try:
            conversation = Conversation.objects.get(id=pk, participants=user)
        except Conversation.DoesNotExist:
            return Response({"detail": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)

        updated = (
            Message.objects.filter(conversation=conversation, is_read=False)
            .exclude(sender=user)
            .update(is_read=True)
        )

        return Response({"updated": updated}, status=status.HTTP_200_OK)


class UnreadCountView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        count = (
            Message.objects.filter(
                conversation__participants=request.user,
                is_read=False,
            )
            .exclude(sender=request.user)
            .count()
        )
        return Response({"count": count}, status=status.HTTP_200_OK)
