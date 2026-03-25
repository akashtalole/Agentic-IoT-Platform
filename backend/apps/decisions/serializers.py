"""Decision serializers."""

from rest_framework import serializers

from .models import AgentDecision, AuditLog


class AgentDecisionSerializer(serializers.ModelSerializer):
    device_name = serializers.CharField(source="device.name", read_only=True)

    class Meta:
        model = AgentDecision
        fields = [
            "id", "device", "device_name", "agent", "timestamp",
            "sensor_context", "reasoning_text", "tool_calls",
            "action_taken", "status", "approved_by", "approval_timestamp",
        ]
        read_only_fields = ["id", "timestamp", "device_name"]


class AuditLogSerializer(serializers.ModelSerializer):
    device_name = serializers.CharField(source="device.name", read_only=True, allow_null=True)

    class Meta:
        model = AuditLog
        fields = ["id", "device", "device_name", "decision", "user", "event_type", "details", "timestamp"]
        read_only_fields = fields
