from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TournamentViewSet, TeamViewSet, CoachViewSet, PlayerViewSet, RoomViewSet, GameViewSet

router = DefaultRouter()
router.register(r'tournaments', TournamentViewSet, basename='tournament')
router.register(r'teams', TeamViewSet, basename='team')
router.register(r'coaches', CoachViewSet, basename='coach')
router.register(r'players', PlayerViewSet, basename='player')
router.register(r'rooms', RoomViewSet, basename='room')
router.register(r'games', GameViewSet, basename='game')

urlpatterns = [
    path('', include(router.urls)),
]
