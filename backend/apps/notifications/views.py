from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from .models import Alert, HumanApprovalRequest
from .serializers import AlertSerializer, HumanApprovalRequestSerializer


class AlertViewSet(ModelViewSet):
    queryset = Alert.objects.select_related("device", "resolved_by")
    serializer_class = AlertSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["severity", "device"]
    http_method_names = ["get", "patch", "head", "options"]

    @action(detail=True, methods=["patch"])
    def resolve(self, request, pk=None):
        alert = self.get_object()
        alert.resolved_at = timezone.now()
        alert.resolved_by = request.user
        alert.save(update_fields=["resolved_at", "resolved_by"])
        return Response(AlertSerializer(alert).data)


class HumanApprovalViewSet(ModelViewSet):
    queryset = HumanApprovalRequest.objects.select_related("device", "responder")
    serializer_class = HumanApprovalRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["status", "device"]
    http_method_names = ["get", "post", "patch", "head", "options"]

    @action(detail=False, methods=["get"])
    def pending(self, request):
        qs = self.queryset.filter(status=HumanApprovalRequest.ApprovalStatus.PENDING)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["patch"])
    def respond(self, request, pk=None):
        approval_req = self.get_object()
        response_status = request.data.get("status")
        if response_status not in ("approved", "rejected"):
            return Response({"error": "status must be 'approved' or 'rejected'"}, status=400)
        approval_req.status = response_status
        approval_req.responder = request.user
        approval_req.responded_at = timezone.now()
        approval_req.save(update_fields=["status", "responder", "responded_at"])
        return Response(HumanApprovalRequestSerializer(approval_req).data)
