from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model

User = get_user_model()


class UserRegistrationTestCase(TestCase):
    """Test suite for User Registration API endpoint"""

    def setUp(self):
        """Set up test client"""
        self.client = APIClient()
        self.url = reverse('users:register')

    def test_register_user_success(self):
        """Test successful user registration"""
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'SecurePass123!',
            'password_confirm': 'SecurePass123!'
        }

        response = self.client.post(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['username'], 'newuser')
        self.assertEqual(response.data['email'], 'newuser@example.com')

        # Verify user was created in database
        self.assertTrue(User.objects.filter(username='newuser').exists())

    def test_register_user_with_name(self):
        """Test user registration with optional name fields"""
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'SecurePass123!',
            'password_confirm': 'SecurePass123!',
            'first_name': 'Jane',
            'last_name': 'Doe',
        }

        response = self.client.post(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(username='newuser')
        self.assertEqual(user.first_name, 'Jane')
        self.assertEqual(user.last_name, 'Doe')

    def test_register_password_mismatch(self):
        """Test registration fails when passwords don't match"""
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'SecurePass123!',
            'password_confirm': 'DifferentPass123!'
        }

        response = self.client.post(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username='newuser').exists())

    def test_register_duplicate_username(self):
        """Test registration fails with duplicate username"""
        # Create existing user
        User.objects.create_user(
            username='existinguser',
            email='existing@example.com',
            password='testpass123'
        )

        data = {
            'username': 'existinguser',
            'email': 'different@example.com',
            'password': 'SecurePass123!',
            'password_confirm': 'SecurePass123!'
        }

        response = self.client.post(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_duplicate_email(self):
        """Test registration fails with duplicate email"""
        # Create existing user
        User.objects.create_user(
            username='existinguser',
            email='existing@example.com',
            password='testpass123'
        )

        data = {
            'username': 'newuser',
            'email': 'existing@example.com',
            'password': 'SecurePass123!',
            'password_confirm': 'SecurePass123!'
        }

        response = self.client.post(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_invalid_email(self):
        """Test registration fails with invalid email"""
        data = {
            'username': 'newuser',
            'email': 'invalid-email',
            'password': 'SecurePass123!',
            'password_confirm': 'SecurePass123!'
        }

        response = self.client.post(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_missing_required_fields(self):
        """Test registration fails when required fields are missing"""
        data = {
            'username': 'newuser'
        }

        response = self.client.post(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class UserLoginTestCase(TestCase):
    """Test suite for User Login (JWT Token) API endpoint"""

    def setUp(self):
        """Set up test client and user"""
        self.client = APIClient()
        self.url = reverse('users:token_obtain_pair')

        # Create test user
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='TestPass123!'
        )

    def test_login_success(self):
        """Test successful login with valid credentials"""
        data = {
            'username': 'testuser',
            'password': 'TestPass123!'
        }

        response = self.client.post(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_login_invalid_password(self):
        """Test login fails with invalid password"""
        data = {
            'username': 'testuser',
            'password': 'WrongPassword123!'
        }

        response = self.client.post(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_nonexistent_user(self):
        """Test login fails with non-existent username"""
        data = {
            'username': 'nonexistent',
            'password': 'TestPass123!'
        }

        response = self.client.post(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_missing_credentials(self):
        """Test login fails when credentials are missing"""
        data = {
            'username': 'testuser'
        }

        response = self.client.post(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TokenRefreshTestCase(TestCase):
    """Test suite for JWT Token Refresh endpoint"""

    def setUp(self):
        """Set up test client and user"""
        self.client = APIClient()
        self.token_url = reverse('users:token_obtain_pair')
        self.refresh_url = reverse('users:token_refresh')

        # Create test user
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='TestPass123!'
        )

    def test_refresh_token_success(self):
        """Test successful token refresh"""
        # First, login to get refresh token
        login_data = {
            'username': 'testuser',
            'password': 'TestPass123!'
        }
        login_response = self.client.post(self.token_url, login_data)
        refresh_token = login_response.data['refresh']

        # Use refresh token to get new access token
        refresh_data = {
            'refresh': refresh_token
        }
        response = self.client.post(self.refresh_url, refresh_data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_refresh_token_invalid(self):
        """Test refresh fails with invalid token"""
        data = {
            'refresh': 'invalid.token.here'
        }

        response = self.client.post(self.refresh_url, data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_token_missing(self):
        """Test refresh fails when token is missing"""
        response = self.client.post(self.refresh_url, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class UserProfileTestCase(TestCase):
    """Test suite for User Profile API endpoints"""

    def setUp(self):
        """Set up test client and users"""
        self.client = APIClient()
        self.url = reverse('users:profile')

        # Create test users
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='testpass123',
            first_name='Jane',
            last_name='Doe',
        )

        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='testpass123'
        )

    def test_get_profile_unauthenticated(self):
        """Test that unauthenticated users cannot access profile"""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_profile_authenticated(self):
        """Test authenticated user can get their profile"""
        self.client.force_authenticate(user=self.user1)

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'user1')
        self.assertEqual(response.data['email'], 'user1@example.com')
        self.assertEqual(response.data['first_name'], 'Jane')
        self.assertEqual(response.data['last_name'], 'Doe')

    def test_update_profile(self):
        """Test user can update their profile"""
        self.client.force_authenticate(user=self.user2)

        data = {
            'first_name': 'Updated',
            'last_name': 'Name',
        }

        response = self.client.patch(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.user2.refresh_from_db()
        self.assertEqual(self.user2.first_name, 'Updated')
        self.assertEqual(self.user2.last_name, 'Name')

    def test_partial_update_profile(self):
        """Test user can partially update their profile"""
        self.client.force_authenticate(user=self.user1)

        data = {
            'first_name': 'NewName'
        }

        response = self.client.patch(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.user1.refresh_from_db()
        self.assertEqual(self.user1.first_name, 'NewName')
        # Other fields should remain unchanged
        self.assertEqual(self.user1.last_name, 'Doe')


class UserDetailViewTestCase(TestCase):
    """Test suite for Public User Profile endpoint"""

    def setUp(self):
        """Set up test client and users"""
        self.client = APIClient()

        self.user = User.objects.create_user(
            username='publicuser',
            email='public@example.com',
            password='testpass123',
            first_name='Public',
            last_name='User',
        )

        self.url = reverse('users:user_detail', kwargs={'username': 'publicuser'})

    def test_get_public_profile_unauthenticated(self):
        """Test unauthenticated users can view public profiles"""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'publicuser')
        self.assertEqual(response.data['first_name'], 'Public')

    def test_get_public_profile_authenticated(self):
        """Test authenticated users can view public profiles"""
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=other_user)

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'publicuser')

    def test_public_profile_excludes_email(self):
        """Test that email is not exposed in public profile"""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Verify email is not in response
        self.assertNotIn('email', response.data)

    def test_get_nonexistent_user_profile(self):
        """Test accessing non-existent user returns 404"""
        url = reverse('users:user_detail', kwargs={'username': 'nonexistent'})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
