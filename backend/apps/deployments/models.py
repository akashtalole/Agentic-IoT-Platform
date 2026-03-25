"""Snapshot and deployment models for fleet management."""

from django.conf import settings
from django.db import models

from apps.agents.models import AgentSkill
from apps.devices.models import DeviceGroup


class Snapshot(models.Model):
    """
    A versioned snapshot of an agent skill configuration,
    ready to be deployed to a device group.
    """

    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    skills = models.ManyToManyField(AgentSkill, blank=True, related_name="snapshots")
    config = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "snapshots"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Snapshot: {self.name}"


class Deployment(models.Model):
    """A deployment of a Snapshot to a DeviceGroup."""

    class DeploymentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
        ROLLED_BACK = "rolled_back", "Rolled Back"

    snapshot = models.ForeignKey(Snapshot, on_delete=models.PROTECT, related_name="deployments")
    device_group = models.ForeignKey(DeviceGroup, on_delete=models.PROTECT, related_name="deployments")
    status = models.CharField(max_length=20, choices=DeploymentStatus.choices, default=DeploymentStatus.PENDING)
    deployed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    deployed_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    rollback_snapshot = models.ForeignKey(
        Snapshot, on_delete=models.SET_NULL, null=True, blank=True, related_name="rollbacks"
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "deployments"
        ordering = ["-deployed_at"]

    def __str__(self):
        return f"Deploy {self.snapshot.name} → {self.device_group.name}"
