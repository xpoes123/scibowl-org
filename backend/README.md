# NSB Arena Backend

Django REST API backend for the National Science Bowl practice platform.

## Tech Stack

- **Framework:** Django 5.1 + Django REST Framework
- **Database:** PostgreSQL
- **Authentication:** JWT (djangorestframework-simplejwt)
- **Deployment:** Docker + Gunicorn

## Features

- User authentication and profiles
- Question database with filtering and search
- User question history tracking
- Bookmark system
- Category and difficulty-based filtering
- Stats tracking (accuracy, question performance)

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Start the development server with PostgreSQL
docker-compose up

# The API will be available at http://localhost:8000
```

### Option 2: Local Development

**Prerequisites:**
- Python 3.14+
- PostgreSQL 16+

**Setup:**

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run development server
python manage.py runserver
```

## API Endpoints

### Authentication
- `POST /api/auth/register/` - Register new user
- `POST /api/auth/login/` - Login (get JWT tokens)
- `POST /api/auth/refresh/` - Refresh access token

### Users
- `GET /api/profile/` - Get current user profile
- `PUT /api/profile/` - Update current user profile
- `GET /api/users/<username>/` - Get user by username

### Questions
- `GET /api/questions/` - List questions (supports filtering)
  - Query params: `category`, `question_type`, `difficulty`, `search`
- `GET /api/questions/<id>/` - Get question details with answer
- `POST /api/questions/history/` - Submit answer and record history
- `GET /api/questions/history/` - Get user's question history

### Bookmarks
- `GET /api/questions/bookmarks/` - List user's bookmarks
- `POST /api/questions/bookmarks/` - Create bookmark
- `GET /api/questions/bookmarks/<id>/` - Get bookmark details
- `PUT /api/questions/bookmarks/<id>/` - Update bookmark
- `DELETE /api/questions/bookmarks/<id>/` - Delete bookmark

## Database Models

### User
- Custom user model extending Django's AbstractUser
- Fields: username, email, school, grade_level, bio, stats

### Question
- Categories: Biology, Chemistry, Physics, Earth & Space, Math, Energy
- Types: Short Answer, Multiple Choice, Identify All, Rank
- Difficulty: Easy, Medium, Hard

### UserQuestionHistory
- Tracks user answers and performance
- Records time taken, correctness

### Bookmark
- Users can bookmark questions for later review
- Optional notes field

## Environment Variables

See `.env.example` for all available configuration options.

Key variables:
- `SECRET_KEY` - Django secret key
- `DEBUG` - Debug mode (True/False)
- `DB_NAME`, `DB_USER`, `DB_PASSWORD` - Database credentials
- `CORS_ALLOWED_ORIGINS` - Allowed frontend origins

## Development

### Creating Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

### Running Tests

```bash
python manage.py test
```

### Admin Panel

Access the Django admin at `http://localhost:8000/admin/`

## Deployment

The backend is configured for deployment on platforms like:
- Railway
- Render
- Fly.io
- AWS/GCP/Azure

Make sure to:
1. Set environment variables in your hosting platform
2. Set `DEBUG=False` in production
3. Configure `ALLOWED_HOSTS`
4. Use a strong `SECRET_KEY`
5. Set up PostgreSQL database

## Project Structure

```
nsb-arena-backend/
├── backend/           # Django project settings
├── users/             # User authentication app
├── questions/         # Questions and practice app
├── manage.py
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

## License

MIT
