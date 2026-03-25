"""Telemetry URL patterns."""

from django.urls import path

from .views import DeviceTelemetryView, TelemetryIngestView

urlpatterns = [
    path("telemetry/ingest/", TelemetryIngestView.as_view(), name="telemetry-ingest"),
    path("devices/<uuid:device_id>/telemetry/", DeviceTelemetryView.as_view(), name="device-telemetry"),
]
