from django.urls import path

from .views import ScoresheetCreateView, ScoresheetEventsView

urlpatterns = [
    path("scoresheets/", ScoresheetCreateView.as_view(), name="scoresheet-create"),
    path("scoresheets/<int:scoresheet_id>/events/", ScoresheetEventsView.as_view(), name="scoresheet-events"),
]
