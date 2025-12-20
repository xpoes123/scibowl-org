from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model"""

    accuracy = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'bio', 'school', 'grade_level',
            'total_questions_answered', 'correct_answers', 'accuracy',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'total_questions_answered', 'correct_answers', 'created_at', 'updated_at']


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration"""

    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password]
    )
    password_confirm = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'password_confirm',
            'first_name', 'last_name', 'school', 'grade_level'
        ]

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError(
                {"password": "Password fields didn't match."}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user


class PublicUserSerializer(serializers.ModelSerializer):
    """Serializer for public user profiles (excludes email)"""

    accuracy = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name',
            'bio', 'school', 'grade_level',
            'total_questions_answered', 'correct_answers', 'accuracy',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'total_questions_answered', 'correct_answers', 'created_at', 'updated_at']
