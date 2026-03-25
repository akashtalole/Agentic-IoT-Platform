from django.contrib import admin

from .models import AgentSkill, DeviceAgent


@admin.register(AgentSkill)
class AgentSkillAdmin(admin.ModelAdmin):
    list_display = ["name", "version", "model", "enable_thinking", "created_at"]
    search_fields = ["name", "description"]


@admin.register(DeviceAgent)
class DeviceAgentAdmin(admin.ModelAdmin):
    list_display = ["device", "skill", "status", "last_run_at"]
    list_filter = ["status"]
    search_fields = ["device__name", "skill__name"]
