# Testing Guide

This document explains how to run tests for the NSB Arena backend.

## Test Structure

Tests are organized by Django app:
- `questions/tests/test_api.py` - API endpoint tests for questions, history, and bookmarks
- `questions/tests/test_pdf_parser.py` - PDF parsing utility tests
- `users/tests/test_api.py` - API endpoint tests for authentication and user profiles

## Running Tests

### Using Docker (Recommended)

Since this project uses Docker, you can run tests in the Docker container:

```bash
# Run all tests in Docker
docker-compose exec web python manage.py test

# Run tests with verbose output
docker-compose exec web python manage.py test --verbosity=2

# Run specific app tests
docker-compose exec web python manage.py test questions
docker-compose exec web python manage.py test users

# Run with coverage
docker-compose exec web coverage run --source='.' manage.py test
docker-compose exec web coverage report
```

If containers aren't running, start them first:
```bash
docker-compose up -d
```

### Using Django's test runner (local without Docker)

```bash
# Run all tests
python manage.py test

# Run tests with verbose output
python manage.py test --verbosity=2

# Run specific app tests
python manage.py test questions
python manage.py test users

# Run specific test file
python manage.py test questions.tests.test_api
python manage.py test users.tests.test_api

# Run specific test class
python manage.py test questions.tests.test_api.QuestionListViewTestCase

# Run specific test method
python manage.py test questions.tests.test_api.QuestionListViewTestCase.test_filter_by_category
```

### Using pytest (optional)

First, install development dependencies:

```bash
pip install -r requirements-dev.txt
```

Then run tests:

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=. --cov-report=html

# Run specific test file
pytest questions/tests/test_api.py

# Run specific test
pytest questions/tests/test_api.py::QuestionListViewTestCase::test_filter_by_category

# Run tests matching a pattern
pytest -k "bookmark"

# Run tests with verbose output
pytest -v

# Run tests and show print statements
pytest -s
```

## Test Coverage

Generate a coverage report:

```bash
# Using coverage.py with Django
coverage run --source='.' manage.py test
coverage report
coverage html  # Generate HTML report in htmlcov/

# Using pytest
pytest --cov=. --cov-report=html --cov-report=term
```

View the HTML coverage report:
```bash
# Open htmlcov/index.html in your browser
```

## Test Database

Tests automatically use an in-memory SQLite database for speed. This is configured in `settings.py`:

```python
if 'test' in sys.argv:
    DATABASES['default'] = {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
```

You don't need PostgreSQL running to execute tests.

## Continuous Integration

Tests run automatically on every pull request via GitHub Actions. The workflow:

1. Tests against Python 3.11 and 3.12
2. Runs all tests with verbose output
3. Generates coverage reports
4. Runs code quality checks (flake8)
5. Runs security checks (bandit, safety)

See [.github/workflows/backend-tests.yml](../.github/workflows/backend-tests.yml) for details.

## Writing Tests

### Example Test Structure

```python
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

class MyAPITestCase(TestCase):
    def setUp(self):
        """Set up test fixtures"""
        self.client = APIClient()
        # Create test data

    def test_my_endpoint(self):
        """Test description"""
        response = self.client.get('/api/endpoint/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
```

### Authentication in Tests

```python
# Force authentication
self.client.force_authenticate(user=self.user)

# Get JWT tokens
response = self.client.post('/api/auth/login/', {
    'username': 'testuser',
    'password': 'testpass'
})
token = response.data['access']
self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
```

### Assertions

```python
# Status codes
self.assertEqual(response.status_code, status.HTTP_200_OK)
self.assertEqual(response.status_code, status.HTTP_201_CREATED)
self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

# Response data
self.assertIn('key', response.data)
self.assertEqual(response.data['key'], 'value')
self.assertEqual(response.data['count'], 5)

# Database
self.assertTrue(Model.objects.filter(field='value').exists())
self.assertEqual(Model.objects.count(), 3)
```

## Test Coverage Goals

- **Endpoint Tests**: All API endpoints should have tests for:
  - Successful requests
  - Authentication/permission checks
  - Error cases (400, 401, 404)
  - Data validation
  - Edge cases

- **Model Tests**: Test custom model methods and properties

- **Serializer Tests**: Test custom validation and serialization logic

Current test coverage: Run `coverage report` to see current coverage.

## Common Issues

### Import Errors
If you get import errors, make sure you're running tests from the `backend` directory:
```bash
cd backend
python manage.py test
```

### Database Errors
Tests use SQLite in-memory, not PostgreSQL. If you see PostgreSQL connection errors, check that the test database configuration is correct in settings.py.

### Authentication Errors
Make sure to use `self.client.force_authenticate(user=self.user)` for authenticated requests in tests.

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Clear Names**: Use descriptive test method names: `test_user_can_create_bookmark`
3. **One Assertion**: Test one thing per test method when possible
4. **setUp Method**: Use `setUp()` to create common test fixtures
5. **tearDown**: Usually not needed as Django handles database cleanup
6. **Factory Pattern**: Consider using factory_boy for complex test data (optional)

## Running Tests Before Commits

It's recommended to run tests before committing:

```bash
# Quick test
python manage.py test

# Full check (tests + linting)
python manage.py test && flake8 .
```

Consider setting up a pre-commit hook for automatic test running.
