# Testing & CI/CD Setup Complete

This document summarizes the testing infrastructure that has been set up for the NSB Arena project.

## What's Been Added

### 1. Unit Tests

#### Questions API Tests ([backend/questions/tests/test_api.py](backend/questions/tests/test_api.py))
- **QuestionListViewTestCase** (8 tests)
  - List questions (authenticated/unauthenticated)
  - Filter by category, question type, question style, source
  - Search functionality
  - Ordering by created_at
  - Pagination

- **QuestionDetailViewTestCase** (2 tests)
  - Get question detail
  - 404 for non-existent questions

- **UserQuestionHistoryTestCase** (5 tests)
  - List history (auth required)
  - User isolation (users only see their own history)
  - Create history entries
  - Question stats updates

- **BookmarkTestCase** (9 tests)
  - List bookmarks (auth required)
  - User isolation
  - Create, update, delete bookmarks
  - Duplicate prevention
  - Permission checks (can't modify other users' bookmarks)

**Total: 24 tests for questions API**

#### Users/Auth API Tests ([backend/users/tests/test_api.py](backend/users/tests/test_api.py))
- **UserRegistrationTestCase** (7 tests)
  - Successful registration
  - Registration with profile info
  - Password mismatch validation
  - Duplicate username/email prevention
  - Email validation
  - Required field validation

- **UserLoginTestCase** (4 tests)
  - Successful login (JWT tokens)
  - Invalid password/username
  - Missing credentials

- **TokenRefreshTestCase** (3 tests)
  - Token refresh success
  - Invalid/missing token handling

- **UserProfileTestCase** (5 tests)
  - Get profile (auth required)
  - Update profile (full/partial)
  - Profile statistics

- **UserDetailViewTestCase** (5 tests)
  - Public profile viewing
  - Email privacy (not exposed publicly)
  - User statistics in public profile
  - 404 for non-existent users

**Total: 24 tests for users/auth API**

### 2. GitHub Actions CI/CD ([.github/workflows/backend-tests.yml](.github/workflows/backend-tests.yml))

The workflow runs automatically on:
- Pull requests to `main` or `develop` branches
- Pushes to `main` or `develop` branches
- Only when backend files change

#### Three Jobs:

**Test Job:**
- Runs on Python 3.11 and 3.12 (matrix)
- Installs dependencies with pip caching
- Runs migrations
- Executes all tests with verbose output
- Generates coverage reports
- Uploads HTML coverage report as artifact

**Lint Job:**
- Runs flake8 for code quality
- Checks for syntax errors
- Reports complexity and style issues

**Security Job:**
- Runs `safety` to check for vulnerable dependencies
- Runs `bandit` to detect security issues in code

### 3. Test Configuration

#### Database Configuration ([backend/backend/settings.py](backend/backend/settings.py))
```python
# Automatically uses SQLite in-memory for tests (much faster than PostgreSQL)
if 'test' in sys.argv or 'test_coverage' in sys.argv:
    DATABASES['default'] = {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
```

#### Pytest Configuration ([backend/pytest.ini](backend/pytest.ini))
- Configured for pytest as alternative to Django test runner
- Markers for slow/integration tests
- Verbose output by default

### 4. Development Dependencies ([backend/requirements-dev.txt](backend/requirements-dev.txt))
```
pytest, pytest-django, pytest-cov  # Testing
flake8, black, isort               # Code quality
bandit, safety                     # Security
coverage                           # Coverage reporting
```

### 5. Helper Scripts & Documentation

- [backend/run_tests.sh](backend/run_tests.sh) - Convenient test runner script
- [backend/TESTING.md](backend/TESTING.md) - Comprehensive testing guide
- [TESTING_SETUP.md](TESTING_SETUP.md) - This file

## How to Use

### Running Tests Locally (Docker)

```bash
# Start containers
docker-compose up -d

# Run all tests
docker-compose exec web python manage.py test

# Run with verbose output
docker-compose exec web python manage.py test --verbosity=2

# Run specific app
docker-compose exec web python manage.py test questions

# Run with coverage
docker-compose exec web coverage run --source='.' manage.py test
docker-compose exec web coverage report
docker-compose exec web coverage html
```

### Running Tests Locally (without Docker)

```bash
cd backend

# Create virtual environment (first time only)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Run tests
python manage.py test

# Or use the helper script
./run_tests.sh --verbose --coverage
```

### Viewing Test Results in CI

1. Create a pull request
2. GitHub Actions will automatically run tests
3. Check the "Actions" tab to see results
4. All three jobs (test, lint, security) must pass
5. Download coverage report artifact if needed

## Test Coverage

Current test coverage: **48 endpoint tests** covering:
- All authentication endpoints (register, login, token refresh)
- All user profile endpoints (get, update, public profiles)
- All question endpoints (list, detail, filters, search)
- All user question history endpoints (list, create)
- All bookmark endpoints (CRUD operations)

### Coverage Goals
- API Endpoints: ✅ All major endpoints covered
- Authentication: ✅ JWT auth fully tested
- Permissions: ✅ User isolation tested
- Validation: ✅ Error cases tested
- Models: ⚠️ Custom methods need tests (future enhancement)
- Serializers: ⚠️ Custom validation needs tests (future enhancement)

## Continuous Integration Flow

```
Developer creates PR
        ↓
GitHub Actions triggered
        ↓
    ┌───┴───┬────────┐
    ↓       ↓        ↓
  Test    Lint   Security
 (Py 3.11)
    ↓
  Test
 (Py 3.12)
    ↓
All jobs pass
        ↓
   PR approved
        ↓
  Merge to main
```

## Best Practices

1. **Always run tests before creating a PR**
   ```bash
   docker-compose exec web python manage.py test
   ```

2. **Write tests for new features**
   - Add tests in the appropriate `tests/test_*.py` file
   - Follow existing test patterns
   - Test both success and error cases

3. **Check coverage for new code**
   ```bash
   docker-compose exec web coverage run --source='.' manage.py test
   docker-compose exec web coverage report
   ```

4. **Fix lint issues before committing**
   ```bash
   flake8 .
   ```

5. **Monitor GitHub Actions**
   - Don't merge if tests fail
   - Review coverage reports
   - Address security warnings

## Future Enhancements

- [ ] Add integration tests for full user workflows
- [ ] Add performance/load tests
- [ ] Set up pre-commit hooks
- [ ] Add test coverage badge to README
- [ ] Set up code quality monitoring (CodeClimate, SonarQube)
- [ ] Add E2E tests with frontend integration
- [ ] Set up test database seeding for consistent test data

## Troubleshooting

### Tests fail locally but pass in CI
- Check Python version matches CI (3.11 or 3.12)
- Ensure all dependencies are installed
- Clear migration cache: `find . -path "*/migrations/*.pyc" -delete`

### GitHub Actions workflow not triggering
- Check that changes are in `backend/**` paths
- Verify workflow file is in `.github/workflows/`
- Check branch protection rules

### Coverage report not generating
- Install coverage: `pip install coverage`
- Ensure tests run successfully first
- Check file permissions for `htmlcov/` directory

## Questions?

See [backend/TESTING.md](backend/TESTING.md) for detailed testing documentation.
