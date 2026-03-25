from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),

    # API endpoints
    path('api/', include('users.urls')),
    path('api/', include('tournaments.urls')),
    path('api/moss/', include('moss.urls')),
]
