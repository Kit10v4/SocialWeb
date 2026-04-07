from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import User


class RegisterViewTests(APITestCase):
    def test_register_email_exists(self):
        User.objects.create_user(
            email="existing@example.com",
            username="existing",
            password="StrongPass123!",
        )
        payload = {
            "email": "existing@example.com",
            "username": "newuser",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
        }
        response = self.client.post("/api/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_weak_password(self):
        payload = {
            "email": "new@example.com",
            "username": "newuser",
            "password": "12345678",
            "password_confirm": "12345678",
        }
        response = self.client.post("/api/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_success(self):
        payload = {
            "email": "ok@example.com",
            "username": "okuser",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
        }
        response = self.client.post("/api/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("tokens", response.data)
        self.assertTrue(User.objects.filter(email="ok@example.com").exists())


class FriendRequestViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="u1@example.com", username="u1", password="StrongPass123!"
        )
        self.other = User.objects.create_user(
            email="u2@example.com", username="u2", password="StrongPass123!"
        )
        self.client.force_authenticate(user=self.user)

    def test_send_request_to_self(self):
        response = self.client.post(f"/api/friends/request/{self.user.id}/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_send_duplicate_request(self):
        first = self.client.post(f"/api/friends/request/{self.other.id}/", {}, format="json")
        second = self.client.post(f"/api/friends/request/{self.other.id}/", {}, format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
