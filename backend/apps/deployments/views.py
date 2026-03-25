from rest_framework import permissions, viewsets
from .models import Deployment, Snapshot
from .serializers import DeploymentSerializer, SnapshotSerializer


class SnapshotViewSet(viewsets.ModelViewSet):
    queryset = Snapshot.objects.prefetch_related("skills")
    serializer_class = SnapshotSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class DeploymentViewSet(viewsets.ModelViewSet):
    queryset = Deployment.objects.select_related("snapshot", "device_group", "deployed_by")
    serializer_class = DeploymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["status", "device_group"]

    def perform_create(self, serializer):
        serializer.save(deployed_by=self.request.user)
