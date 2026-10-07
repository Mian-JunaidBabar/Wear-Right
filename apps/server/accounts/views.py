from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .selectors import get_profiles
from .serializers import UserProfileSerializer
from .services import create_profile

class UserProfileAPIView(APIView):
    def get(self, request):
        profiles = get_profiles()
        serializer = UserProfileSerializer(profiles, many=True)
        return Response({"status": "success", "profiles": serializer.data}, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = UserProfileSerializer(data=request.data)
        if serializer.is_valid():
            profile = create_profile(serializer)
            return Response({"status": "success", "message": "User profile saved successfully", "profile": UserProfileSerializer(profile).data}, status=status.HTTP_201_CREATED)
        return Response({"status": "error", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
