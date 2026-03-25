"""Device serializers."""

from rest_framework import serializers

from .models import Actuator, Device, DeviceGroup, Sensor


class DeviceGroupSerializer(serializers.ModelSerializer):
    device_count = serializers.SerializerMethodField()

    class Meta:
        model = DeviceGroup
        fields = ["id", "name", "description", "device_count", "created_at"]

    def get_device_count(self, obj):
        return obj.devices.count()


class SensorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sensor
        fields = ["id", "name", "display_name", "unit", "data_type", "last_value", "last_updated"]


class ActuatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Actuator
        fields = ["id", "name", "display_name", "actuator_type", "state", "last_command_at"]


class DeviceListSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source="group.name", read_only=True)

    class Meta:
        model = Device
        fields = [
            "id", "device_id", "name", "group", "group_name",
            "device_type", "location", "status", "last_heartbeat",
            "firmware_version", "registered_at",
        ]


class DeviceDetailSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source="group.name", read_only=True)
    sensors = SensorSerializer(many=True, read_only=True)
    actuators = ActuatorSerializer(many=True, read_only=True)

    class Meta:
        model = Device
        fields = [
            "id", "device_id", "name", "group", "group_name",
            "device_type", "location", "status", "last_heartbeat",
            "firmware_version", "metadata", "capabilities",
            "mqtt_topic_prefix", "registered_at", "updated_at",
            "sensors", "actuators",
        ]
        read_only_fields = ["device_id", "registered_at", "updated_at"]


class DeviceCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = ["name", "group", "device_type", "location", "firmware_version", "metadata", "capabilities", "mqtt_topic_prefix"]
