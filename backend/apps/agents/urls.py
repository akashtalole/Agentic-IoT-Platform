"""Agent URL patterns."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AgentSkillViewSet, DeviceAgentViewSet

router = DefaultRouter()
router.register("agent-skills", AgentSkillViewSet, basename="agent-skill")
router.register("agents", DeviceAgentViewSet, basename="device-agent")

urlpatterns = [
    path("", include(router.urls)),
]
