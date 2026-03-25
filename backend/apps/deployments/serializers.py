from rest_framework import serializers
from .models import Deployment, Snapshot


class SnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = Snapshot
        fields = ["id", "name", "description", "skills", "config", "created_by", "created_at"]
        read_only_fields = ["id", "created_at"]


class DeploymentSerializer(serializers.ModelSerializer):
    snapshot_name = serializers.CharField(source="snapshot.name", read_only=True)
    group_name = serializers.CharField(source="device_group.name", read_only=True)

    class Meta:
        model = Deployment
        fields = [
            "id", "snapshot", "snapshot_name", "device_group", "group_name",
            "status", "deployed_by", "deployed_at", "completed_at",
            "rollback_snapshot", "notes",
        ]
        read_only_fields = ["id", "status", "deployed_at", "completed_at"]
