"""Telemetry serializers."""

from rest_framework import serializers

from apps.devices.models import Device

from .models import SensorReading


class SensorReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SensorReading
        fields = ["id", "device", "sensor_name", "value", "raw_payload", "timestamp", "quality_flag"]
        read_only_fields = ["id"]


class TelemetryIngestSerializer(serializers.Serializer):
    """Used by the MQTT bridge to ingest sensor readings."""

    sensor_name = serializers.CharField(max_length=100)
    value = serializers.FloatField(required=False, allow_null=True)
    raw_payload = serializers.JSONField(required=False, allow_null=True)
    timestamp = serializers.DateTimeField()
    quality_flag = serializers.CharField(default="good")

    def validate(self, attrs):
        if attrs.get("value") is None and attrs.get("raw_payload") is None:
            raise serializers.ValidationError("Provide either value or raw_payload.")
        return attrs
