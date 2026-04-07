from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User

from .models import Conversation


class ConversationListTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="chat1@example.com",
            username="chat1",
            password="StrongPass123!",
        )
        self.other = User.objects.create_user(
            email="chat2@example.com",
            username="chat2",
            password="StrongPass123!",
        )
        self.third = User.objects.create_user(
            email="chat3@example.com",
            username="chat3",
            password="StrongPass123!",
        )
        self.conv_visible = Conversation.objects.create()
        self.conv_visible.participants.set([self.user, self.other])
        self.conv_hidden = Conversation.objects.create()
        self.conv_hidden.participants.set([self.other, self.third])

        self.client.force_authenticate(user=self.user)

    def test_only_current_user_conversations_are_listed(self):
        response = self.client.get("/api/conversations/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {str(item["id"]) for item in response.data}
        self.assertIn(str(self.conv_visible.id), ids)
        self.assertNotIn(str(self.conv_hidden.id), ids)
