from django.contrib import admin

from .models import SensorReading


@admin.register(SensorReading)
class SensorReadingAdmin(admin.ModelAdmin):
    list_display = ["device", "sensor_name", "value", "timestamp", "quality_flag"]
    list_filter = ["quality_flag", "device"]
    search_fields = ["device__name", "sensor_name"]
    ordering = ["-timestamp"]
