import logging

from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
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


logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is None:  # an unexpected crash: answer in JSON so the web app can show a message, and log the cause
        logger.exception('Unhandled error in %s', context.get('view').__class__.__name__, exc_info=exc)
        return Response(
            {'error': {'code': 'ServerError', 'message': 'Something went wrong on our side. Please try again.', 'details': {}}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

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
