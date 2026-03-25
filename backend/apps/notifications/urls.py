from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import AlertViewSet, HumanApprovalViewSet

router = DefaultRouter()
router.register("alerts", AlertViewSet, basename="alert")
router.register("approvals", HumanApprovalViewSet, basename="approval")

urlpatterns = [path("", include(router.urls))]
