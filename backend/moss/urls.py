from django.urls import path

from .views import ScoresheetEventsView

urlpatterns = [
    path("scoresheets/<int:scoresheet_id>/events/", ScoresheetEventsView.as_view(), name="scoresheet-events"),
]
