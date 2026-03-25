"""User models with role-based access control."""

from django.contrib.auth.models import AbstractUser
from django.db import models


class CustomUser(AbstractUser):
    """Extended user model with IoT platform roles."""

    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        OPERATOR = "operator", "Operator"
        VIEWER = "viewer", "Viewer"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.VIEWER)
    team = models.CharField(max_length=100, blank=True)
    avatar_url = models.URLField(blank=True)

    class Meta:
        db_table = "users"

    def __str__(self):
        return f"{self.username} ({self.role})"

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN

    @property
    def is_operator(self):
        return self.role in (self.Role.ADMIN, self.Role.OPERATOR)
