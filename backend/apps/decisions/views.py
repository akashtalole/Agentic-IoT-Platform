"""Decision views."""

from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet

from .models import AgentDecision, AuditLog
from .serializers import AgentDecisionSerializer, AuditLogSerializer


class AgentDecisionViewSet(ReadOnlyModelViewSet):
    queryset = AgentDecision.objects.select_related("device", "agent", "approved_by")
    serializer_class = AgentDecisionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["device", "status", "action_taken"]
    ordering_fields = ["timestamp"]

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """POST /api/v1/decisions/{id}/approve/ — human-in-the-loop approval."""
        decision = self.get_object()
        if decision.status != AgentDecision.DecisionStatus.WAITING_APPROVAL:
            return Response(
                {"error": "Decision is not awaiting approval."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        decision.status = AgentDecision.DecisionStatus.APPROVED
        decision.approved_by = request.user
        decision.approval_timestamp = timezone.now()
        decision.save(update_fields=["status", "approved_by", "approval_timestamp"])

        # Resume agent execution
        from apps.agents.tasks import run_agent_decision
        run_agent_decision.delay(decision.device.pk, decision.sensor_context)

        return Response(AgentDecisionSerializer(decision).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        """POST /api/v1/decisions/{id}/reject/ — reject a pending decision."""
        decision = self.get_object()
        decision.status = AgentDecision.DecisionStatus.REJECTED
        decision.approved_by = request.user
        decision.approval_timestamp = timezone.now()
        decision.save(update_fields=["status", "approved_by", "approval_timestamp"])
        return Response(AgentDecisionSerializer(decision).data)


class AuditLogViewSet(ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related("device", "user")
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ["device", "event_type"]
    ordering_fields = ["timestamp"]
