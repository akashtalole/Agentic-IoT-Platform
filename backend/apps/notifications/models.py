"""Alert and human-approval request models."""

from django.conf import settings
from django.db import models

from apps.decisions.models import AgentDecision
from apps.devices.models import Device


class Alert(models.Model):
    class Severity(models.TextChoices):
        INFO = "info", "Info"
        WARNING = "warning", "Warning"
        CRITICAL = "critical", "Critical"

    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name="alerts")
    decision = models.ForeignKey(
        AgentDecision, on_delete=models.SET_NULL, null=True, blank=True, related_name="alerts"
    )
    severity = models.CharField(max_length=20, choices=Severity.choices)
    message = models.TextField()
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "alerts"
        ordering = ["-created_at"]

    @property
    def is_resolved(self):
        return self.resolved_at is not None

    def __str__(self):
        return f"[{self.severity}] {self.device.name}: {self.message[:60]}"


class HumanApprovalRequest(models.Model):
    class ApprovalStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        EXPIRED = "expired", "Expired"

    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name="approval_requests")
    decision = models.ForeignKey(
        AgentDecision, on_delete=models.SET_NULL, null=True, blank=True, related_name="approval_requests"
    )
    proposed_action = models.TextField()
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=ApprovalStatus.choices, default=ApprovalStatus.PENDING)
    responder = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    responded_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "human_approval_requests"
        ordering = ["-created_at"]

    def __str__(self):
        return f"ApprovalRequest({self.device.name}): {self.proposed_action[:60]}"
