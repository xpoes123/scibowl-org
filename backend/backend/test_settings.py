"""
Test-specific Django settings.
Extends the main settings with test optimizations.
"""

from .settings import *  # noqa

# Use SQLite in-memory database for fast tests
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Disable password validators for faster tests
AUTH_PASSWORD_VALIDATORS = []

# Use a simpler password hasher for faster tests
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

# Disable migrations and use schema from models directly
# This avoids migration incompatibility issues between PostgreSQL and SQLite
class DisableMigrations:
    def __contains__(self, item):
        return True

    def __getitem__(self, item):
        return None

MIGRATION_MODULES = DisableMigrations()

# Reduce logging during tests
LOGGING = {
    'version': 1,
    'disable_existing_loggers': True,
    'handlers': {
        'null': {
            'class': 'logging.NullHandler',
        },
    },
    'root': {
        'handlers': ['null'],
    },
}

# Disable whitenoise for tests (not needed)
MIDDLEWARE = [m for m in MIDDLEWARE if 'whitenoise' not in m.lower()]

# Speed up tests
DEBUG = False
TEMPLATES[0]['OPTIONS']['debug'] = False
