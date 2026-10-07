from .models import UserProfile
def get_profiles():
    return UserProfile.objects.all()
