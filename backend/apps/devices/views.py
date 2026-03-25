"""Device views."""

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Device, DeviceGroup, Sensor
from .serializers import (
    DeviceCreateSerializer,
    DeviceDetailSerializer,
    DeviceGroupSerializer,
    DeviceListSerializer,
    SensorSerializer,
)


class DeviceGroupViewSet(viewsets.ModelViewSet):
    queryset = DeviceGroup.objects.all()
    serializer_class = DeviceGroupSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description"]


class DeviceViewSet(viewsets.ModelViewSet):
    queryset = Device.objects.select_related("group").prefetch_related("sensors", "actuators")
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "device_type", "group"]
    search_fields = ["name", "location", "device_id"]
    ordering_fields = ["name", "registered_at", "last_heartbeat"]

    def get_serializer_class(self):
        if self.action == "list":
            return DeviceListSerializer
        if self.action == "create":
            return DeviceCreateSerializer
        return DeviceDetailSerializer

    @action(detail=True, methods=["get"])
    def sensors(self, request, pk=None):
        device = self.get_object()
        sensors = device.sensors.all()
        serializer = SensorSerializer(sensors, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def heartbeat(self, request, pk=None):
        """Update device heartbeat from MQTT bridge."""
        from django.utils import timezone
        device = self.get_object()
        device.last_heartbeat = timezone.now()
        device.status = Device.Status.ONLINE
        device.save(update_fields=["last_heartbeat", "status"])
        return Response({"status": "ok"})
