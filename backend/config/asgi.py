"""ASGI config for Agentic IoT Platform — Django Channels routing."""

import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

django_asgi_app = get_asgi_application()

# Import websocket routes after Django setup
from apps.devices.consumers import DeviceConsumer  # noqa: E402
from apps.agents.consumers import AgentConsumer  # noqa: E402
from apps.notifications.consumers import AlertConsumer  # noqa: E402

websocket_urlpatterns = [
    # ws://host/ws/devices/        → fleet-wide status updates
    # ws://host/ws/devices/{id}/   → single device live telemetry
    # ws://host/ws/agents/{id}/    → streaming agent reasoning
    # ws://host/ws/alerts/         → real-time alert notifications
]

# Import URL patterns dynamically to avoid circular imports
from django.urls import path, re_path  # noqa: E402

websocket_urlpatterns = [
    path("ws/devices/", DeviceConsumer.as_asgi()),
    re_path(r"ws/devices/(?P<device_id>[^/]+)/$", DeviceConsumer.as_asgi()),
    re_path(r"ws/agents/(?P<agent_id>[^/]+)/$", AgentConsumer.as_asgi()),
    path("ws/alerts/", AlertConsumer.as_asgi()),
]

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        ),
    }
)
