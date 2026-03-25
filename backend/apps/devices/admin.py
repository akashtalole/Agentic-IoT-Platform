from django.contrib import admin

from .models import Actuator, Device, DeviceGroup, Sensor


@admin.register(DeviceGroup)
class DeviceGroupAdmin(admin.ModelAdmin):
    list_display = ["name", "description"]


class SensorInline(admin.TabularInline):
    model = Sensor
    extra = 0


class ActuatorInline(admin.TabularInline):
    model = Actuator
    extra = 0


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ["name", "device_id", "device_type", "status", "group", "last_heartbeat"]
    list_filter = ["status", "device_type", "group"]
    search_fields = ["name", "device_id", "location"]
    inlines = [SensorInline, ActuatorInline]
