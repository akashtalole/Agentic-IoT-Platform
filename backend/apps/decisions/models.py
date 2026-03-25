"""Agent decision and audit trail models."""

from django.conf import settings
from django.db import models

from apps.devices.models import Device


class AgentDecision(models.Model):
    """
    A record of one Claude agent reasoning cycle.
    Stores full reasoning, tool calls, and outcome for the audit trail.
    """

    class DecisionStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        EXECUTED = "executed", "Executed"
        WAITING_APPROVAL = "waiting_approval", "Waiting Approval"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        ERROR = "error", "Error"

    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name="decisions")
    agent = models.ForeignKey(
        "agents.DeviceAgent", on_delete=models.SET_NULL, null=True, blank=True, related_name="decisions"
    )
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    # Sensor readings that triggered this decision
    sensor_context = models.JSONField(default=dict)
    # Full reasoning text from Claude (may include thinking blocks)
    reasoning_text = models.TextField(blank=True)
    # List of tool calls made during the decision
    tool_calls = models.JSONField(default=list)
    action_taken = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=30, choices=DecisionStatus.choices, default=DecisionStatus.PENDING)
    # Human-in-the-loop
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    approval_timestamp = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "agent_decisions"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["device", "-timestamp"]),
            models.Index(fields=["status", "-timestamp"]),
        ]

    def __str__(self):
        return f"Decision({self.device.name}) @ {self.timestamp}: {self.action_taken}"


class AuditLog(models.Model):
    """Immutable audit log of all platform events."""

    device = models.ForeignKey(Device, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs")
    decision = models.ForeignKey(
        AgentDecision, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    event_type = models.CharField(max_length=50, db_index=True)
    details = models.JSONField(default=dict)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-timestamp"]

    def __str__(self):
        return f"AuditLog({self.event_type}) @ {self.timestamp}"
