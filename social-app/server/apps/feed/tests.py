from django.urls import reverse
from rest_framework.test import APITestCase

from apps.posts.models import Post
from apps.users.models import Friendship, User


class FeedAPITests(APITestCase):
    def setUp(self):
        self.me = User.objects.create_user(
            email="me@example.com", username="me", password="password123"
        )
        self.friend = User.objects.create_user(
            email="friend@example.com", username="friend", password="password123"
        )
        self.stranger = User.objects.create_user(
            email="stranger@example.com", username="stranger", password="password123"
        )

        Friendship.objects.create(
            from_user=self.me,
            to_user=self.friend,
            status=Friendship.Status.ACCEPTED,
        )

        # Posts visible in feed
        self.own_public = Post.objects.create(
            author=self.me, content="own public", privacy=Post.Privacy.PUBLIC
        )
        self.friend_public = Post.objects.create(
            author=self.friend, content="friend public", privacy=Post.Privacy.PUBLIC
        )
        self.friend_friends = Post.objects.create(
            author=self.friend, content="friend friends", privacy=Post.Privacy.FRIENDS
        )

        # Posts not visible in feed
        self.own_private = Post.objects.create(
            author=self.me, content="own private", privacy=Post.Privacy.PRIVATE
        )
        self.stranger_public = Post.objects.create(
            author=self.stranger, content="stranger public", privacy=Post.Privacy.PUBLIC
        )

        self.client.force_authenticate(user=self.me)

    def test_feed_returns_only_self_and_friends_posts(self):
        url = reverse("feed")
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

        ids = {item["id"] for item in response.data.get("results", [])}

        # Visible: own public + friend's public/friends-only
        self.assertIn(str(self.own_public.id), ids)
        self.assertIn(str(self.friend_public.id), ids)
        self.assertIn(str(self.friend_friends.id), ids)

        # Not visible: own private, stranger posts
        self.assertNotIn(str(self.own_private.id), ids)
        self.assertNotIn(str(self.stranger_public.id), ids)

    def test_feed_cursor_pagination(self):
        # Create extra posts so we exceed one page (10 items)
        for i in range(12):
            Post.objects.create(
                author=self.me,
                content=f"extra post {i}",
                privacy=Post.Privacy.PUBLIC,
            )

        url = reverse("feed")
        first_page = self.client.get(url)
        self.assertEqual(first_page.status_code, 200)

        first_results = first_page.data.get("results", [])
        next_cursor = first_page.data.get("next_cursor")

        self.assertEqual(len(first_results), 10)
        self.assertIsNotNone(next_cursor)

        second_page = self.client.get(url, {"cursor": next_cursor})
        self.assertEqual(second_page.status_code, 200)

        second_results = second_page.data.get("results", [])
        # Remaining posts should be fewer than or equal to page size
        self.assertLessEqual(len(second_results), 10)

        # Ensure no overlap between pages
        first_ids = {item["id"] for item in first_results}
        second_ids = {item["id"] for item in second_results}
        self.assertTrue(first_ids.isdisjoint(second_ids))
