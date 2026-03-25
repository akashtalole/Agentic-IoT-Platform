"""Agent skill and device agent models."""

from django.conf import settings
from django.db import models

from apps.devices.models import Device


class AgentSkill(models.Model):
    """
    A reusable AI agent skill that can be assigned to devices.
    Defines the Claude model, system prompt, and available tools.
    """

    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    version = models.CharField(max_length=20, default="1.0.0")
    # Claude model to use
    model = models.CharField(max_length=50, default="claude-opus-4-6")
    # System prompt that defines the agent's persona and instructions
    system_prompt = models.TextField()
    # JSON array of Claude tool definitions
    tool_definitions = models.JSONField(default=list)
    max_tokens = models.IntegerField(default=4096)
    # Enable adaptive thinking
    enable_thinking = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "agent_skills"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} v{self.version}"


class DeviceAgent(models.Model):
    """
    Active agent instance for a specific device.
    Holds the conversation history and runtime configuration.
    """

    class AgentStatus(models.TextChoices):
        ACTIVE = "active", "Active"
        PAUSED = "paused", "Paused"
        ERROR = "error", "Error"
        WAITING_APPROVAL = "waiting_approval", "Waiting Approval"

    device = models.OneToOneField(Device, on_delete=models.CASCADE, related_name="agent")
    skill = models.ForeignKey(AgentSkill, on_delete=models.PROTECT, related_name="device_agents")
    status = models.CharField(max_length=30, choices=AgentStatus.choices, default=AgentStatus.ACTIVE)
    # Persisted conversation history for multi-turn context
    conversation_history = models.JSONField(default=list, blank=True)
    last_run_at = models.DateTimeField(null=True, blank=True)
    # Per-device config overrides
    config_overrides = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "device_agents"

    def __str__(self):
        return f"Agent({self.device.name}) — {self.skill.name}"
