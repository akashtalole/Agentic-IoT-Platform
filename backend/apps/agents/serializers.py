"""Agent serializers."""

from rest_framework import serializers

from .models import AgentSkill, DeviceAgent


class AgentSkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentSkill
        fields = [
            "id", "name", "description", "version", "model",
            "system_prompt", "tool_definitions", "max_tokens",
            "enable_thinking", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class DeviceAgentSerializer(serializers.ModelSerializer):
    skill_name = serializers.CharField(source="skill.name", read_only=True)
    device_name = serializers.CharField(source="device.name", read_only=True)

    class Meta:
        model = DeviceAgent
        fields = [
            "id", "device", "device_name", "skill", "skill_name",
            "status", "last_run_at", "config_overrides",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "status", "last_run_at", "created_at", "updated_at"]


class NLCommandSerializer(serializers.Serializer):
    command = serializers.CharField(min_length=3, max_length=2000)
