"""Agent views."""

from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AgentSkill, DeviceAgent
from .serializers import AgentSkillSerializer, DeviceAgentSerializer, NLCommandSerializer


class AgentSkillViewSet(viewsets.ModelViewSet):
    queryset = AgentSkill.objects.all()
    serializer_class = AgentSkillSerializer
    permission_classes = [permissions.IsAuthenticated]


class DeviceAgentViewSet(viewsets.ModelViewSet):
    queryset = DeviceAgent.objects.select_related("device", "skill")
    serializer_class = DeviceAgentSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=["post"])
    def run(self, request, pk=None):
        """POST /api/v1/agents/{id}/run/ — manually trigger an agent cycle."""
        device_agent = self.get_object()
        from apps.agents.tasks import run_agent_decision
        sensor_context = request.data.get("sensor_context", {})
        task = run_agent_decision.delay(device_agent.device.pk, sensor_context)
        return Response({"task_id": task.id, "status": "queued"})

    @action(detail=True, methods=["post"])
    def command(self, request, pk=None):
        """POST /api/v1/agents/{id}/command/ — send NL command to agent."""
        device_agent = self.get_object()
        serializer = NLCommandSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from services.agent_service import AgentService
        agent_svc = AgentService()
        result = agent_svc.run_nl_command(device_agent, serializer.validated_data["command"])
        return Response(result)
