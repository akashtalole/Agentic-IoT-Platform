from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AgentDecisionViewSet, AuditLogViewSet

router = DefaultRouter()
router.register("decisions", AgentDecisionViewSet, basename="decision")
router.register("audit-log", AuditLogViewSet, basename="audit-log")

urlpatterns = [path("", include(router.urls))]
