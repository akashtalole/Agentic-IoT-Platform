"""Time-series sensor reading storage."""

from django.db import models

from apps.devices.models import Device, Sensor


class SensorReading(models.Model):
    """
    A single sensor reading from a device.

    High-volume table — indexed heavily on (device, sensor, timestamp).
    For production, use TimescaleDB hypertable partitioned by timestamp.
    """

    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name="readings", db_index=True)
    sensor = models.ForeignKey(
        Sensor, on_delete=models.SET_NULL, null=True, blank=True, related_name="readings"
    )
    sensor_name = models.CharField(max_length=100, db_index=True)
    # Numeric value for fast aggregation queries
    value = models.FloatField(null=True, blank=True)
    # Full raw payload for non-numeric sensors
    raw_payload = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(db_index=True)
    quality_flag = models.CharField(max_length=20, default="good")  # good / uncertain / bad

    class Meta:
        db_table = "sensor_readings"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["device", "sensor_name", "-timestamp"]),
            models.Index(fields=["device", "-timestamp"]),
        ]

    def __str__(self):
        return f"{self.device.name}/{self.sensor_name} @ {self.timestamp}: {self.value}"
