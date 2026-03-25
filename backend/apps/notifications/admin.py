from django.contrib import admin
from .models import Alert, HumanApprovalRequest


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ["device", "severity", "message", "is_resolved", "created_at"]
    list_filter = ["severity"]


@admin.register(HumanApprovalRequest)
class HumanApprovalRequestAdmin(admin.ModelAdmin):
    list_display = ["device", "proposed_action", "status", "created_at"]
    list_filter = ["status"]
