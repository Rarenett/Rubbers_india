from rest_framework.views import exception_handler
from django.db.models import ProtectedError
from rest_framework.response import Response
from rest_framework import status

def custom_exception_handler(exc, context):
    """
    Custom exception handler to catch ProtectedError and ensure JSON responses.
    """
    # Call DRF's default exception handler first to get the standard error response.
    response = exception_handler(exc, context)

    # If DRF doesn't handle the exception, it returns None
    if response is None:
        if isinstance(exc, ProtectedError):
            # Extract the protected objects and their models
            protected_objects = exc.protected_objects
            model_name = protected_objects[0]._meta.verbose_name if protected_objects else "related records"
            
            data = {
                "detail": f"Cannot delete this record because it is being used by {model_name}."
            }
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
        
        # For any other unhandled exception, return a JSON 500 instead of allowing Django's HTML page
        data = {
            "detail": f"Internal Server Error: {str(exc)}"
        }
        return Response(data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return response
