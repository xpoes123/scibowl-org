from rest_framework import generics, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Question, UserQuestionHistory, Bookmark
from .serializers import (
    QuestionSerializer, QuestionListSerializer,
    UserQuestionHistorySerializer, BookmarkSerializer
)


class QuestionListView(generics.ListAPIView):
    """API endpoint for listing questions (without answers for practice mode)"""
    queryset = Question.objects.all()
    serializer_class = QuestionListSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'question_type', 'question_style', 'source']
    search_fields = ['question_text']
    ordering_fields = ['created_at', 'times_answered']
    ordering = ['-created_at']


class QuestionDetailView(generics.RetrieveAPIView):
    """API endpoint for retrieving a single question with answer"""
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer
    permission_classes = [permissions.AllowAny]


class UserQuestionHistoryListCreateView(generics.ListCreateAPIView):
    """API endpoint for viewing and creating user question history"""
    serializer_class = UserQuestionHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return UserQuestionHistory.objects.filter(user=self.request.user)


class BookmarkListCreateView(generics.ListCreateAPIView):
    """API endpoint for viewing and creating bookmarks"""
    serializer_class = BookmarkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Bookmark.objects.filter(user=self.request.user)


class BookmarkDetailView(generics.RetrieveUpdateDestroyAPIView):
    """API endpoint for managing individual bookmarks"""
    serializer_class = BookmarkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Bookmark.objects.filter(user=self.request.user)
