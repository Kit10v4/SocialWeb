from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User

from .models import Like, Post


class PostCreateViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="poster@example.com",
            username="poster",
            password="StrongPass123!",
        )
        self.client.force_authenticate(user=self.user)

    def test_create_post_without_content_and_images(self):
        response = self.client.post("/api/posts/", {"content": ""}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_post_success_with_content(self):
        response = self.client.post(
            "/api/posts/",
            {"content": "Xin chào SocialWeb", "privacy": "public"},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Post.objects.filter(author=self.user).count(), 1)


class LikeToggleViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="liker@example.com",
            username="liker",
            password="StrongPass123!",
        )
        self.author = User.objects.create_user(
            email="author@example.com",
            username="author",
            password="StrongPass123!",
        )
        self.post = Post.objects.create(author=self.author, content="Post to like")
        self.client.force_authenticate(user=self.user)

    def test_like_then_unlike(self):
        like_response = self.client.post(f"/api/posts/{self.post.id}/like/", {}, format="json")
        self.assertEqual(like_response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Like.objects.filter(post=self.post, user=self.user).exists())

        unlike_response = self.client.post(f"/api/posts/{self.post.id}/like/", {}, format="json")
        self.assertEqual(unlike_response.status_code, status.HTTP_200_OK)
        self.assertFalse(Like.objects.filter(post=self.post, user=self.user).exists())
