from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from questions.models import Question, UserQuestionHistory, Bookmark

User = get_user_model()


class QuestionListViewTestCase(TestCase):
    """Test suite for Question List API endpoint"""

    def setUp(self):
        """Set up test client and sample data"""
        self.client = APIClient()
        self.url = reverse('questions:question_list')

        # Create test user
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

        # Create sample questions
        self.question1 = Question.objects.create(
            question_text='What is the atomic number of Carbon?',
            category='CHEMISTRY',
            question_style='SHORT_ANSWER',
            question_type='TOSSUP',
            correct_answer='6',
            source='MIT_2025',
            explanation='Carbon has 6 protons'
        )

        self.question2 = Question.objects.create(
            question_text='What is Newton\'s first law?',
            category='PHYSICS',
            question_style='MULTIPLE_CHOICE',
            question_type='BONUS',
            correct_answer='W',
            option_1='An object in motion stays in motion',
            option_2='Force equals mass times acceleration',
            option_3='Every action has an equal reaction',
            option_4='Energy is conserved',
            source='REGIONALS_2024',
            explanation='Law of inertia'
        )

        self.question3 = Question.objects.create(
            question_text='Name three types of RNA',
            category='BIOLOGY',
            question_style='IDENTIFY_ALL',
            question_type='TOSSUP',
            correct_answer='mRNA, tRNA, rRNA',
            source='NATIONALS_2024',
            explanation='Three main types of RNA'
        )

    def test_list_questions_unauthenticated(self):
        """Test that unauthenticated users can list questions"""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 3)

    def test_filter_by_category(self):
        """Test filtering questions by category"""
        response = self.client.get(self.url, {'category': 'CHEMISTRY'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['question_text'],
                        'What is the atomic number of Carbon?')

    def test_filter_by_question_type(self):
        """Test filtering questions by question type"""
        response = self.client.get(self.url, {'question_type': 'TOSSUP'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)

    def test_filter_by_question_style(self):
        """Test filtering questions by question style"""
        response = self.client.get(self.url, {'question_style': 'MULTIPLE_CHOICE'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    def test_filter_by_source(self):
        """Test filtering questions by source"""
        response = self.client.get(self.url, {'source': 'MIT_2025'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    def test_search_questions(self):
        """Test searching questions by text"""
        response = self.client.get(self.url, {'search': 'Carbon'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    def test_ordering_by_created_at(self):
        """Test ordering questions by created_at"""
        response = self.client.get(self.url, {'ordering': '-created_at'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Most recent should be first
        self.assertEqual(response.data['results'][0]['id'], self.question3.id)

    def test_pagination(self):
        """Test that pagination works correctly"""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('count', response.data)
        self.assertIn('results', response.data)
        self.assertIn('next', response.data)
        self.assertIn('previous', response.data)


class QuestionDetailViewTestCase(TestCase):
    """Test suite for Question Detail API endpoint"""

    def setUp(self):
        """Set up test client and sample data"""
        self.client = APIClient()

        self.question = Question.objects.create(
            question_text='What is the speed of light?',
            category='PHYSICS',
            question_style='SHORT_ANSWER',
            question_type='TOSSUP',
            correct_answer='3.00 x 10^8 m/s',
            source='MIT_2025',
            explanation='Speed of light in vacuum'
        )

        self.url = reverse('questions:question_detail', kwargs={'pk': self.question.pk})

    def test_get_question_detail(self):
        """Test retrieving a single question"""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['question_text'], 'What is the speed of light?')
        self.assertEqual(response.data['category'], 'PHYSICS')

    def test_get_nonexistent_question(self):
        """Test retrieving a non-existent question returns 404"""
        url = reverse('questions:question_detail', kwargs={'pk': 99999})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class UserQuestionHistoryTestCase(TestCase):
    """Test suite for User Question History API endpoints"""

    def setUp(self):
        """Set up test client and sample data"""
        self.client = APIClient()
        self.url = reverse('questions:history_list')

        # Create test users
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='testpass123'
        )

        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='testpass123'
        )

        # Create test question
        self.question = Question.objects.create(
            question_text='What is H2O?',
            category='CHEMISTRY',
            question_style='SHORT_ANSWER',
            question_type='TOSSUP',
            correct_answer='Water',
            source='MIT_2025'
        )

    def test_list_history_unauthenticated(self):
        """Test that unauthenticated users cannot access history"""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_history_authenticated(self):
        """Test authenticated user can list their own history"""
        self.client.force_authenticate(user=self.user1)

        # Create history for user1
        UserQuestionHistory.objects.create(
            user=self.user1,
            question=self.question,
            user_answer='Water',
            is_correct=True,
            time_taken=10
        )

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    def test_user_only_sees_own_history(self):
        """Test users only see their own history"""
        # Create history for both users
        UserQuestionHistory.objects.create(
            user=self.user1,
            question=self.question,
            user_answer='Water',
            is_correct=True,
            time_taken=10
        )

        UserQuestionHistory.objects.create(
            user=self.user2,
            question=self.question,
            user_answer='H2O',
            is_correct=True,
            time_taken=15
        )

        # User1 should only see their own history
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    def test_create_history_entry(self):
        """Test creating a new history entry"""
        self.client.force_authenticate(user=self.user1)

        data = {
            'question_id': self.question.id,
            'user_answer': 'Water',
            'is_correct': True,
            'time_taken': 12
        }

        response = self.client.post(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(UserQuestionHistory.objects.count(), 1)

        # Verify question stats updated
        self.question.refresh_from_db()
        self.assertEqual(self.question.times_answered, 1)
        self.assertEqual(self.question.times_correct, 1)

    def test_create_history_unauthenticated(self):
        """Test unauthenticated users cannot create history"""
        data = {
            'question_id': self.question.id,
            'user_answer': 'Water',
            'is_correct': True,
            'time_taken': 12
        }

        response = self.client.post(self.url, data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class BookmarkTestCase(TestCase):
    """Test suite for Bookmark API endpoints"""

    def setUp(self):
        """Set up test client and sample data"""
        self.client = APIClient()
        self.list_url = reverse('questions:bookmark_list')

        # Create test users
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='testpass123'
        )

        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='testpass123'
        )

        # Create test questions
        self.question1 = Question.objects.create(
            question_text='What is DNA?',
            category='BIOLOGY',
            question_style='SHORT_ANSWER',
            question_type='TOSSUP',
            correct_answer='Deoxyribonucleic acid',
            source='MIT_2025'
        )

        self.question2 = Question.objects.create(
            question_text='What is ATP?',
            category='BIOLOGY',
            question_style='SHORT_ANSWER',
            question_type='TOSSUP',
            correct_answer='Adenosine triphosphate',
            source='MIT_2025'
        )

    def test_list_bookmarks_unauthenticated(self):
        """Test that unauthenticated users cannot access bookmarks"""
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_bookmarks_authenticated(self):
        """Test authenticated user can list their bookmarks"""
        self.client.force_authenticate(user=self.user1)

        # Create bookmark for user1
        Bookmark.objects.create(
            user=self.user1,
            question=self.question1,
            notes='Important question'
        )

        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    def test_user_only_sees_own_bookmarks(self):
        """Test users only see their own bookmarks"""
        # Create bookmarks for both users
        Bookmark.objects.create(
            user=self.user1,
            question=self.question1,
            notes='User1 note'
        )

        Bookmark.objects.create(
            user=self.user2,
            question=self.question2,
            notes='User2 note'
        )

        # User1 should only see their bookmark
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['notes'], 'User1 note')

    def test_create_bookmark(self):
        """Test creating a new bookmark"""
        self.client.force_authenticate(user=self.user1)

        data = {
            'question': self.question1.id,
            'notes': 'Need to review this'
        }

        response = self.client.post(self.list_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Bookmark.objects.count(), 1)
        self.assertEqual(Bookmark.objects.first().notes, 'Need to review this')

    def test_create_duplicate_bookmark(self):
        """Test that duplicate bookmarks are prevented"""
        self.client.force_authenticate(user=self.user1)

        # Create first bookmark
        Bookmark.objects.create(
            user=self.user1,
            question=self.question1,
            notes='First note'
        )

        # Try to create duplicate
        data = {
            'question': self.question1.id,
            'notes': 'Second note'
        }

        response = self.client.post(self.list_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_bookmark(self):
        """Test updating a bookmark"""
        self.client.force_authenticate(user=self.user1)

        bookmark = Bookmark.objects.create(
            user=self.user1,
            question=self.question1,
            notes='Original note'
        )

        url = reverse('questions:bookmark_detail', kwargs={'pk': bookmark.pk})
        data = {'notes': 'Updated note'}

        response = self.client.put(url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        bookmark.refresh_from_db()
        self.assertEqual(bookmark.notes, 'Updated note')

    def test_delete_bookmark(self):
        """Test deleting a bookmark"""
        self.client.force_authenticate(user=self.user1)

        bookmark = Bookmark.objects.create(
            user=self.user1,
            question=self.question1,
            notes='To delete'
        )

        url = reverse('questions:bookmark_detail', kwargs={'pk': bookmark.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Bookmark.objects.count(), 0)

    def test_cannot_update_other_user_bookmark(self):
        """Test that users cannot update other users' bookmarks"""
        # Create bookmark for user2
        bookmark = Bookmark.objects.create(
            user=self.user2,
            question=self.question1,
            notes='User2 note'
        )

        # Try to update as user1
        self.client.force_authenticate(user=self.user1)
        url = reverse('questions:bookmark_detail', kwargs={'pk': bookmark.pk})
        data = {'notes': 'Hacked note'}

        response = self.client.put(url, data)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_delete_other_user_bookmark(self):
        """Test that users cannot delete other users' bookmarks"""
        # Create bookmark for user2
        bookmark = Bookmark.objects.create(
            user=self.user2,
            question=self.question1,
            notes='User2 note'
        )

        # Try to delete as user1
        self.client.force_authenticate(user=self.user1)
        url = reverse('questions:bookmark_detail', kwargs={'pk': bookmark.pk})

        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(Bookmark.objects.count(), 1)
