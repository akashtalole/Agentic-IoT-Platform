"""Device URL patterns."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DeviceGroupViewSet, DeviceViewSet

router = DefaultRouter()
router.register("devices", DeviceViewSet, basename="device")
router.register("device-groups", DeviceGroupViewSet, basename="device-group")

urlpatterns = [
    path("", include(router.urls)),
]
