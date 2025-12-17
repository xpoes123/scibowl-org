from django.urls import path
from .views import (
    QuestionListView, QuestionDetailView,
    UserQuestionHistoryListCreateView,
    BookmarkListCreateView, BookmarkDetailView
)

app_name = 'questions'

urlpatterns = [
    # Question endpoints
    path('', QuestionListView.as_view(), name='question_list'),
    path('<int:pk>/', QuestionDetailView.as_view(), name='question_detail'),

    # User history endpoints
    path('history/', UserQuestionHistoryListCreateView.as_view(), name='history_list'),

    # Bookmark endpoints
    path('bookmarks/', BookmarkListCreateView.as_view(), name='bookmark_list'),
    path('bookmarks/<int:pk>/', BookmarkDetailView.as_view(), name='bookmark_detail'),
]
