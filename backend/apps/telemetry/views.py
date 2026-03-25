"""Telemetry views — ingest and query sensor data."""

from django.utils.dateparse import parse_datetime
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.devices.models import Device, Sensor

from .models import SensorReading
from .serializers import SensorReadingSerializer, TelemetryIngestSerializer


class TelemetryIngestView(APIView):
    """POST /api/v1/telemetry/ingest/ — ingest a sensor reading."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        device_id = request.data.get("device_id")
        try:
            device = Device.objects.get(device_id=device_id)
        except Device.DoesNotExist:
            return Response({"error": "Device not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = TelemetryIngestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Get or create the sensor
        sensor, _ = Sensor.objects.get_or_create(
            device=device, name=data["sensor_name"],
            defaults={"data_type": "float" if data.get("value") is not None else "json"},
        )

        reading = SensorReading.objects.create(
            device=device,
            sensor=sensor,
            sensor_name=data["sensor_name"],
            value=data.get("value"),
            raw_payload=data.get("raw_payload"),
            timestamp=data["timestamp"],
            quality_flag=data.get("quality_flag", "good"),
        )

        # Update sensor last_value
        sensor.last_value = data.get("value") or data.get("raw_payload")
        sensor.last_updated = data["timestamp"]
        sensor.save(update_fields=["last_value", "last_updated"])

        # Broadcast via WebSocket
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"device_{device.device_id}",
            {
                "type": "sensor_reading",
                "data": {
                    "device_id": str(device.device_id),
                    "sensor_name": data["sensor_name"],
                    "value": data.get("value"),
                    "timestamp": data["timestamp"].isoformat(),
                },
            },
        )

        return Response(SensorReadingSerializer(reading).data, status=status.HTTP_201_CREATED)


class DeviceTelemetryView(generics.ListAPIView):
    """GET /api/v1/devices/{id}/telemetry/ — query time-series readings."""

    serializer_class = SensorReadingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        device_id = self.kwargs.get("device_id")
        qs = SensorReading.objects.filter(device__device_id=device_id)

        sensor = self.request.query_params.get("sensor")
        if sensor:
            qs = qs.filter(sensor_name=sensor)

        from_ts = self.request.query_params.get("from")
        to_ts = self.request.query_params.get("to")
        if from_ts:
            qs = qs.filter(timestamp__gte=parse_datetime(from_ts))
        if to_ts:
            qs = qs.filter(timestamp__lte=parse_datetime(to_ts))

        return qs.order_by("-timestamp")[:1000]
