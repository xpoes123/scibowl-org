from rest_framework import serializers
from .models import Question, UserQuestionHistory, Bookmark


class QuestionSerializer(serializers.ModelSerializer):
    """Serializer for Question model - includes answers (for admin/review)"""

    accuracy_rate = serializers.ReadOnlyField()

    class Meta:
        model = Question
        fields = [
            'id', 'question_text', 'category', 'question_type', 'question_style',
            'correct_answer', 'option_1', 'option_2', 'option_3', 'option_4',
            'source', 'explanation', 'times_answered', 'times_correct',
            'accuracy_rate', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'times_answered', 'times_correct', 'created_at', 'updated_at']


class QuestionListSerializer(serializers.ModelSerializer):
    """Simplified serializer for question lists (without answers) - for practice/quiz"""

    class Meta:
        model = Question
        fields = [
            'id', 'question_text', 'category', 'question_type', 'question_style',
            'option_1', 'option_2', 'option_3', 'option_4', 'source'
        ]


class UserQuestionHistorySerializer(serializers.ModelSerializer):
    """Serializer for UserQuestionHistory"""

    question = QuestionListSerializer(read_only=True)
    question_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = UserQuestionHistory
        fields = [
            'id', 'user', 'question', 'question_id', 'user_answer',
            'is_correct', 'time_taken', 'answered_at'
        ]
        read_only_fields = ['id', 'user', 'answered_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class BookmarkSerializer(serializers.ModelSerializer):
    """Serializer for Bookmark model"""

    question = QuestionListSerializer(read_only=True)
    question_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = Bookmark
        fields = ['id', 'user', 'question', 'question_id', 'notes', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)
