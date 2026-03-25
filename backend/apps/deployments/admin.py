from django.contrib import admin
from .models import Deployment, Snapshot


@admin.register(Snapshot)
class SnapshotAdmin(admin.ModelAdmin):
    list_display = ["name", "created_by", "created_at"]


@admin.register(Deployment)
class DeploymentAdmin(admin.ModelAdmin):
    list_display = ["snapshot", "device_group", "status", "deployed_by", "deployed_at"]
    list_filter = ["status"]
