from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.test import override_settings

from .models import User


@override_settings(RECAPTCHA_ENABLED=False)
class RegisterViewTests(APITestCase):
    def _register_payload(self, **overrides):
        payload = {
            "email": "ok@example.com",
            "username": "okuser",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
            "recaptcha_token": "test-recaptcha-token",
            "terms_accepted": True,
        }
        payload.update(overrides)
        return payload

    def test_register_email_exists(self):
        User.objects.create_user(
            email="existing@example.com",
            username="existing",
            password="StrongPass123!",
        )
        payload = self._register_payload(email="existing@example.com", username="newuser")
        response = self.client.post("/api/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_weak_password(self):
        payload = self._register_payload(
            email="new@example.com",
            username="newuser",
            password="12345678",
            password_confirm="12345678",
        )
        response = self.client.post("/api/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_success(self):
        payload = self._register_payload()
        response = self.client.post("/api/auth/register/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("detail", response.data)
        self.assertIn("email", response.data)
        self.assertTrue(User.objects.filter(email="ok@example.com").exists())

    def test_register_with_invalid_authorization_header_still_works(self):
        payload = self._register_payload(
            email="header@example.com",
            username="headeruser",
        )
        response = self.client.post(
            "/api/auth/register/",
            payload,
            format="json",
            HTTP_AUTHORIZATION="Bearer invalid-token",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


@override_settings(RECAPTCHA_ENABLED=False)
class AuthCookieFlowTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="cookie@example.com",
            username="cookieuser",
            password="StrongPass123!",
            is_active=True,
        )

    def test_login_sets_auth_cookies(self):
        response = self.client.post(
            "/api/auth/login/",
            {"email": self.user.email, "password": "StrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", response.cookies)
        self.assertIn("refresh_token", response.cookies)


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
