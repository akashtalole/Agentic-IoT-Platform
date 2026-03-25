from django.contrib import admin

from .models import AgentDecision, AuditLog


@admin.register(AgentDecision)
class AgentDecisionAdmin(admin.ModelAdmin):
    list_display = ["device", "action_taken", "status", "timestamp"]
    list_filter = ["status"]
    search_fields = ["device__name", "action_taken"]
    readonly_fields = ["timestamp", "sensor_context", "reasoning_text", "tool_calls"]


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["event_type", "device", "user", "timestamp"]
    list_filter = ["event_type"]
    readonly_fields = ["timestamp", "details"]
