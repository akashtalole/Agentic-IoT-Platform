from rest_framework import serializers
from .models import Alert, HumanApprovalRequest


class AlertSerializer(serializers.ModelSerializer):
    device_name = serializers.CharField(source="device.name", read_only=True)
    is_resolved = serializers.BooleanField(read_only=True)

    class Meta:
        model = Alert
        fields = ["id", "device", "device_name", "decision", "severity", "message",
                  "is_resolved", "resolved_at", "resolved_by", "created_at"]
        read_only_fields = ["id", "created_at"]


class HumanApprovalRequestSerializer(serializers.ModelSerializer):
    device_name = serializers.CharField(source="device.name", read_only=True)

    class Meta:
        model = HumanApprovalRequest
        fields = ["id", "device", "device_name", "decision", "proposed_action",
                  "reason", "status", "responder", "responded_at", "expires_at", "created_at"]
        read_only_fields = ["id", "status", "responded_at", "created_at"]
