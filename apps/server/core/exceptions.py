from rest_framework.exceptions import ValidationError
from rest_framework.views import exception_handler


def _first_message(detail):
    """Flatten DRF error details to the first human-readable message."""
    if isinstance(detail, dict):
        for value in detail.values():
            message = _first_message(value)
            if message:
                return message
        return ""
    if isinstance(detail, (list, tuple)):
        for item in detail:
            message = _first_message(item)
            if message:
                return message
        return ""
    return str(detail)


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        if isinstance(exc, ValidationError):
            message = _first_message(exc.detail) or "Invalid input."
        else:
            message = str(exc)
        response.data = {
            "error": {
                "code": exc.__class__.__name__,
                "message": message,
                "details": response.data,
            }
        }

    return response
