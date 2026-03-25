"""Device, fleet group, sensor and actuator models."""

import uuid

from django.db import models


class DeviceGroup(models.Model):
    """Logical grouping of IoT devices (e.g. factory-floor-line-1)."""

    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "device_groups"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Device(models.Model):
    """An IoT edge device registered to the platform."""

    class Status(models.TextChoices):
        ONLINE = "online", "Online"
        OFFLINE = "offline", "Offline"
        ERROR = "error", "Error"
        PROVISIONING = "provisioning", "Provisioning"

    class DeviceType(models.TextChoices):
        RASPBERRY_PI = "raspberry_pi", "Raspberry Pi"
        JETSON = "jetson", "NVIDIA Jetson"
        ESP32 = "esp32", "ESP32"
        INDUSTRIAL = "industrial", "Industrial Gateway"
        SIMULATED = "simulated", "Simulated"
        OTHER = "other", "Other"

    device_id = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    name = models.CharField(max_length=150)
    group = models.ForeignKey(
        DeviceGroup, on_delete=models.SET_NULL, null=True, blank=True, related_name="devices"
    )
    device_type = models.CharField(max_length=30, choices=DeviceType.choices, default=DeviceType.OTHER)
    location = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OFFLINE)
    last_heartbeat = models.DateTimeField(null=True, blank=True)
    firmware_version = models.CharField(max_length=50, blank=True)
    # Flexible metadata (e.g. IP address, hardware specs, tags)
    metadata = models.JSONField(default=dict, blank=True)
    # Tool definitions for the device's Claude agent
    capabilities = models.JSONField(default=list, blank=True)
    mqtt_topic_prefix = models.CharField(max_length=200, blank=True)
    registered_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "devices"
        ordering = ["-registered_at"]

    def __str__(self):
        return f"{self.name} ({self.device_id})"

    @property
    def mqtt_sensor_topic(self):
        prefix = self.mqtt_topic_prefix or f"iot/{self.device_id}"
        return f"{prefix}/sensors/+"

    @property
    def mqtt_agent_input_topic(self):
        prefix = self.mqtt_topic_prefix or f"iot/{self.device_id}"
        return f"{prefix}/agent/input"

    @property
    def mqtt_actuator_topic(self):
        prefix = self.mqtt_topic_prefix or f"iot/{self.device_id}"
        return f"{prefix}/actuators/+"


class Sensor(models.Model):
    """A sensor on a device (temperature, vibration, camera, etc.)."""

    class DataType(models.TextChoices):
        FLOAT = "float", "Float"
        INTEGER = "integer", "Integer"
        BOOLEAN = "boolean", "Boolean"
        STRING = "string", "String"
        JSON = "json", "JSON"

    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name="sensors")
    name = models.CharField(max_length=100)
    display_name = models.CharField(max_length=150, blank=True)
    unit = models.CharField(max_length=30, blank=True)
    data_type = models.CharField(max_length=15, choices=DataType.choices, default=DataType.FLOAT)
    last_value = models.JSONField(null=True, blank=True)
    last_updated = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "sensors"
        unique_together = [["device", "name"]]

    def __str__(self):
        return f"{self.device.name}/{self.name}"


class Actuator(models.Model):
    """A controllable actuator on a device (relay, motor, valve, etc.)."""

    class ActuatorType(models.TextChoices):
        RELAY = "relay", "Relay"
        MOTOR = "motor", "Motor"
        VALVE = "valve", "Valve"
        DISPLAY = "display", "Display"
        ALARM = "alarm", "Alarm"
        OTHER = "other", "Other"

    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name="actuators")
    name = models.CharField(max_length=100)
    display_name = models.CharField(max_length=150, blank=True)
    actuator_type = models.CharField(max_length=20, choices=ActuatorType.choices, default=ActuatorType.OTHER)
    state = models.JSONField(default=dict, blank=True)
    last_command_at = models.DateTimeField(null=True, blank=True)
    last_command_by = models.CharField(max_length=50, blank=True)

    class Meta:
        db_table = "actuators"
        unique_together = [["device", "name"]]

    def __str__(self):
        return f"{self.device.name}/{self.name}"
