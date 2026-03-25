from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import CustomUser


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ["username", "email", "role", "team", "is_active"]
    list_filter = ["role", "is_active"]
    fieldsets = UserAdmin.fieldsets + (
        ("IoT Platform", {"fields": ("role", "team", "avatar_url")}),
    )
