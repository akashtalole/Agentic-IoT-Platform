"""Root URL configuration for Agentic IoT Platform."""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    # API v1
    path("api/v1/auth/", include("apps.users.urls")),
    path("api/v1/", include("apps.devices.urls")),
    path("api/v1/", include("apps.telemetry.urls")),
    path("api/v1/", include("apps.agents.urls")),
    path("api/v1/", include("apps.decisions.urls")),
    path("api/v1/", include("apps.deployments.urls")),
    path("api/v1/", include("apps.notifications.urls")),
    # OpenAPI schema
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]
