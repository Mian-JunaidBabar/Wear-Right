import os
import secrets
import warnings
from datetime import timedelta
from pathlib import Path
import dj_database_url

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = os.environ.get('DEBUG', 'False').lower() in ('true', '1', 'yes')

SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    if DEBUG:
        warnings.warn("SECRET_KEY not found in environment. Generating a throwaway key for local development.")
        SECRET_KEY = secrets.token_urlsafe(50)
    else:
        raise ValueError("SECRET_KEY environment variable is required")

allowed_hosts_str = os.environ.get('ALLOWED_HOSTS', '')
if allowed_hosts_str == '*':
    ALLOWED_HOSTS = ['*']
else:
    ALLOWED_HOSTS = [host.strip() for host in allowed_hosts_str.split(',') if host.strip()]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'dj_rest_auth',
    # Domain apps
    'core',
    'accounts',
    'catalog',
    'scanner',
    'recommender',
    'orders',
    'staff',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'
WSGI_APPLICATION = 'core.wsgi.application'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

DATABASES = {
    'default': dj_database_url.config(
        default="postgres://wearright:wearright@localhost:5433/wearright",
        conn_max_age=600
    )
}

# Deliberately light for a student project: a minimum length only. Add the similarity, common-password
# and numeric validators back here if this ever faces real users.
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 6}},
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'core.authentication.JWTCookieAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ],
    'EXCEPTION_HANDLER': 'core.exceptions.custom_exception_handler',
    'DEFAULT_THROTTLE_RATES': {
        'password_reset': '5/hour',
    },
}

# JWT lives in httpOnly cookies, never in JS-readable storage.
# JWT_AUTH_SECURE is False because local development runs on plain http.
REST_AUTH = {
    'USE_JWT': True,
    'TOKEN_MODEL': None,
    'SESSION_LOGIN': False,
    'JWT_AUTH_COOKIE': 'wr-access',
    'JWT_AUTH_REFRESH_COOKIE': 'wr-refresh',
    'JWT_AUTH_HTTPONLY': True,
    'JWT_AUTH_SAMESITE': 'Lax',
    'JWT_AUTH_SECURE': False,
    # Cookie-authenticated requests must carry Django's CSRF token (X-CSRFToken header).
    'JWT_AUTH_COOKIE_USE_CSRF': True,
    'LOGIN_SERIALIZER': 'accounts.serializers.LoginSerializer',
    # Our serializers: they email the FRONTEND_URL link through core.emails and share one no-enumeration answer.
    'PASSWORD_RESET_SERIALIZER': 'accounts.serializers.PasswordResetRequestSerializer',
    'PASSWORD_RESET_CONFIRM_SERIALIZER': 'accounts.serializers.PasswordResetConfirmSerializer',
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

# The browser only talks to the Next.js origin; its rewrite forwards /api/* to Django,
# so Origin is the Next.js origin while Host is Django's. Trust the Next.js origins for CSRF.
CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        'CSRF_TRUSTED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000'
    ).split(',')
    if origin.strip()
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
# Product photos live outside the code: point MEDIA_ROOT at any folder (see .env.example).
MEDIA_ROOT = Path(os.environ.get('MEDIA_ROOT', BASE_DIR / 'media'))
# Local deployments serve /media/ from Django (core/urls.py) while DEBUG is on or off.
# In production put a web server in front of Django, point it at MEDIA_ROOT and set
# SERVE_MEDIA=False so Django stops serving files itself.
SERVE_MEDIA = os.environ.get('SERVE_MEDIA', 'True').lower() in ('true', '1', 'yes')

# Email: in development Mailpit receives everything at localhost:1025 and shows it at
# http://localhost:8025 (see docker-compose.yml). Point these at any SMTP provider to deploy.
EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'localhost')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '1025'))
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'False').lower() in ('true', '1', 'yes')
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'Wear Right <no-reply@wearright.local>')

# Emails link to the Next.js app, never to Django.
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000').rstrip('/')
PASSWORD_RESET_TIMEOUT = int(os.environ.get('PASSWORD_RESET_TIMEOUT', '3600'))  # one hour

# Local AI model weights (rembg, MediaPipe). Filled by `make models`; never committed.
ML_MODELS_DIR = Path(os.environ.get('ML_MODELS_DIR', BASE_DIR / 'ml_models'))

# Demo catalog: shoppers only see products that are on the mannequin (staff still see everything).
SHOP_MANNEQUIN_ONLY = os.environ.get('SHOP_MANNEQUIN_ONLY', 'False').lower() in ('true', '1', 'yes')

# Face scan photo checks: override any threshold from scanner/engine/quality.py THRESHOLDS, e.g.
# SKIN_SCAN_QUALITY = {"cast_b_warm_fail": 24.0}. Empty uses the defaults.
SKIN_SCAN_QUALITY = {}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
