"""
Claude Agent SDK Integration Service.

Orchestrates IoT agent reasoning using the Anthropic Python SDK with tool use.
Each device runs an AgentSkill that calls Claude with device-specific tool
definitions. Tool calls are executed against real device state (DB + MQTT).
"""

import logging
from typing import Any

import anthropic
from django.conf import settings

logger = logging.getLogger(__name__)

# Default tool definitions for all IoT devices.
# Per-device capabilities extend or override these via AgentSkill.tool_definitions.
DEFAULT_IOT_TOOLS: list[dict] = [
    {
        "name": "read_sensor_data",
        "description": "Read current or historical sensor readings for this device",
        "input_schema": {
            "type": "object",
            "properties": {
                "sensor_name": {
                    "type": "string",
                    "description": "Name of the sensor to read",
                },
                "time_range_minutes": {
                    "type": "integer",
                    "description": "How many minutes of historical data to return (default: 1 = latest only)",
                },
            },
            "required": ["sensor_name"],
        },
    },
    {
        "name": "trigger_actuator",
        "description": "Send a command to a physical actuator on this device",
        "input_schema": {
            "type": "object",
            "properties": {
                "actuator_id": {
                    "type": "string",
                    "description": "Identifier of the actuator to control",
                },
                "action": {
                    "type": "string",
                    "description": "Action to perform (e.g. on, off, set, open, close)",
                },
                "parameters": {
                    "type": "object",
                    "description": "Additional parameters for the action (e.g. speed, duration)",
                },
            },
            "required": ["actuator_id", "action"],
        },
    },
    {
        "name": "send_alert",
        "description": "Send an alert to the operator dashboard",
        "input_schema": {
            "type": "object",
            "properties": {
                "severity": {
                    "type": "string",
                    "enum": ["info", "warning", "critical"],
                    "description": "Alert severity level",
                },
                "message": {
                    "type": "string",
                    "description": "Human-readable alert message",
                },
                "details": {
                    "type": "object",
                    "description": "Additional structured details",
                },
            },
            "required": ["severity", "message"],
        },
    },
    {
        "name": "request_human_approval",
        "description": (
            "Pause execution and request a human operator to approve a critical action "
            "before proceeding. Use for shutdowns, emergency stops, or irreversible actions."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "proposed_action": {
                    "type": "string",
                    "description": "The action Claude wants to take (must be human-readable)",
                },
                "reason": {
                    "type": "string",
                    "description": "Why this action is needed and why human approval is required",
                },
                "urgency": {
                    "type": "string",
                    "enum": ["low", "medium", "high"],
                    "description": "How urgently approval is needed",
                },
            },
            "required": ["proposed_action", "reason"],
        },
    },
    {
        "name": "analyze_trend",
        "description": "Analyze sensor data trend over a time window and return statistics",
        "input_schema": {
            "type": "object",
            "properties": {
                "sensor_name": {
                    "type": "string",
                    "description": "Sensor to analyze",
                },
                "window_hours": {
                    "type": "number",
                    "description": "Analysis window in hours (default: 1)",
                },
                "metrics": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["min", "max", "mean", "std", "trend"]},
                    "description": "Statistical metrics to calculate",
                },
            },
            "required": ["sensor_name"],
        },
    },
]


class IoTToolExecutor:
    """Executes tool calls from Claude against the IoT platform database and MQTT."""

    def __init__(self, device):
        self.device = device

    def execute(self, tool_name: str, tool_input: dict) -> str:
        """Dispatch tool call to the appropriate handler and return result as string."""
        handlers = {
            "read_sensor_data": self._read_sensor_data,
            "trigger_actuator": self._trigger_actuator,
            "send_alert": self._send_alert,
            "request_human_approval": self._request_human_approval,
            "analyze_trend": self._analyze_trend,
        }
        handler = handlers.get(tool_name)
        if not handler:
            return f"Error: Unknown tool '{tool_name}'"
        try:
            return handler(**tool_input)
        except Exception as exc:
            logger.error("Tool %s failed for device %s: %s", tool_name, self.device.device_id, exc)
            return f"Error executing {tool_name}: {exc}"

    def _read_sensor_data(self, sensor_name: str, time_range_minutes: int = 1) -> str:
        from django.utils import timezone
        from datetime import timedelta
        from apps.telemetry.models import SensorReading

        cutoff = timezone.now() - timedelta(minutes=time_range_minutes)
        readings = (
            SensorReading.objects.filter(
                device=self.device,
                sensor_name=sensor_name,
                timestamp__gte=cutoff,
            )
            .order_by("-timestamp")[:50]
        )
        if not readings:
            return f"No readings found for sensor '{sensor_name}' in last {time_range_minutes} minutes."

        data = [{"timestamp": r.timestamp.isoformat(), "value": r.value, "raw": r.raw_payload} for r in readings]
        return str(data)

    def _trigger_actuator(self, actuator_id: str, action: str, parameters: dict | None = None) -> str:
        from django.utils import timezone
        from apps.devices.models import Actuator

        try:
            actuator = Actuator.objects.get(device=self.device, name=actuator_id)
        except Actuator.DoesNotExist:
            return f"Actuator '{actuator_id}' not found on device."

        actuator.state = {"action": action, "parameters": parameters or {}}
        actuator.last_command_at = timezone.now()
        actuator.last_command_by = "agent"
        actuator.save(update_fields=["state", "last_command_at", "last_command_by"])

        # Publish MQTT command
        from services.mqtt_service import MQTTService
        topic = f"{self.device.mqtt_topic_prefix or f'iot/{self.device.device_id}'}/actuators/{actuator_id}"
        MQTTService.publish(topic, {"action": action, "parameters": parameters or {}})

        return f"Actuator '{actuator_id}' triggered: action={action}, parameters={parameters}"

    def _send_alert(self, severity: str, message: str, details: dict | None = None) -> str:
        from apps.notifications.models import Alert
        from apps.decisions.models import AgentDecision

        Alert.objects.create(
            device=self.device,
            severity=severity,
            message=message,
        )

        # Broadcast via WebSocket
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "alerts",
            {
                "type": "new_alert",
                "data": {
                    "device_id": str(self.device.device_id),
                    "device_name": self.device.name,
                    "severity": severity,
                    "message": message,
                },
            },
        )
        return f"Alert sent: [{severity}] {message}"

    def _request_human_approval(self, proposed_action: str, reason: str, urgency: str = "medium") -> str:
        from apps.notifications.models import HumanApprovalRequest
        from django.utils import timezone
        from datetime import timedelta

        approval_request = HumanApprovalRequest.objects.create(
            device=self.device,
            proposed_action=proposed_action,
            reason=reason,
            expires_at=timezone.now() + timedelta(hours=1),
        )

        # Broadcast to dashboard
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "alerts",
            {
                "type": "approval_request",
                "data": {
                    "request_id": approval_request.id,
                    "device_id": str(self.device.device_id),
                    "device_name": self.device.name,
                    "proposed_action": proposed_action,
                    "reason": reason,
                    "urgency": urgency,
                },
            },
        )
        return f"Human approval requested (id={approval_request.id}). Agent paused pending approval."

    def _analyze_trend(self, sensor_name: str, window_hours: float = 1.0, metrics: list | None = None) -> str:
        from django.utils import timezone
        from datetime import timedelta
        from apps.telemetry.models import SensorReading

        metrics = metrics or ["min", "max", "mean", "trend"]
        cutoff = timezone.now() - timedelta(hours=window_hours)
        readings = SensorReading.objects.filter(
            device=self.device, sensor_name=sensor_name,
            timestamp__gte=cutoff, value__isnull=False,
        ).values_list("value", flat=True).order_by("timestamp")

        values = list(readings)
        if not values:
            return f"No data for sensor '{sensor_name}' in last {window_hours} hours."

        result = {"sensor": sensor_name, "count": len(values), "window_hours": window_hours}
        if "min" in metrics:
            result["min"] = min(values)
        if "max" in metrics:
            result["max"] = max(values)
        if "mean" in metrics:
            result["mean"] = sum(values) / len(values)
        if "std" in metrics and len(values) > 1:
            mean = sum(values) / len(values)
            result["std"] = (sum((v - mean) ** 2 for v in values) / len(values)) ** 0.5
        if "trend" in metrics and len(values) >= 2:
            # Simple linear trend direction
            first_half = values[: len(values) // 2]
            second_half = values[len(values) // 2 :]
            avg_first = sum(first_half) / len(first_half)
            avg_second = sum(second_half) / len(second_half)
            result["trend"] = "increasing" if avg_second > avg_first else "decreasing" if avg_second < avg_first else "stable"

        return str(result)


class AgentService:
    """
    Orchestrates Claude AI agent runs for IoT devices.

    Uses the Anthropic Python SDK with tool use (manual agentic loop)
    for full control over reasoning, tool execution, and decision logging.
    """

    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    def run_agent(self, device_agent, sensor_context: dict) -> dict:
        """
        Run a single agent reasoning cycle for a device.

        Args:
            device_agent: DeviceAgent instance with skill and device
            sensor_context: Dict of current sensor readings to reason about

        Returns:
            Dict with reasoning_text, tool_calls, action_taken, status
        """
        from apps.decisions.models import AgentDecision
        from django.utils import timezone

        device = device_agent.device
        skill = device_agent.skill

        # Build tool definitions: skill-specific + defaults
        tools = skill.tool_definitions if skill.tool_definitions else DEFAULT_IOT_TOOLS

        # Build the initial user message with sensor context
        user_message = (
            f"Current sensor readings for device '{device.name}':\n"
            f"{sensor_context}\n\n"
            f"Analyze the readings and take appropriate action using available tools."
        )

        messages = [{"role": "user", "content": user_message}]

        tool_executor = IoTToolExecutor(device)
        tool_calls_log = []
        reasoning_text = ""
        action_taken = "none"

        # Manual agentic loop — gives full control for logging and human-in-the-loop
        max_iterations = 10
        iteration = 0
        while iteration < max_iterations:
            iteration += 1
            try:
                thinking_config = {"type": "adaptive"} if skill.enable_thinking else None
                create_kwargs: dict[str, Any] = {
                    "model": skill.model,
                    "max_tokens": skill.max_tokens,
                    "system": skill.system_prompt,
                    "tools": tools,
                    "messages": messages,
                }
                if thinking_config:
                    create_kwargs["thinking"] = thinking_config

                response = self.client.messages.create(**create_kwargs)
            except anthropic.APIError as exc:
                logger.error("Claude API error for device %s: %s", device.device_id, exc)
                return {
                    "reasoning_text": f"API error: {exc}",
                    "tool_calls": tool_calls_log,
                    "action_taken": "error",
                    "status": "error",
                }

            # Extract text from response (may also have thinking blocks)
            for block in response.content:
                if block.type == "text":
                    reasoning_text += block.text

            # Done — no more tool calls
            if response.stop_reason == "end_turn":
                action_taken = "completed"
                break

            # Execute tool calls
            if response.stop_reason == "tool_use":
                tool_use_blocks = [b for b in response.content if b.type == "tool_use"]
                messages.append({"role": "assistant", "content": response.content})

                tool_results = []
                for tool_call in tool_use_blocks:
                    logger.info(
                        "Device %s: executing tool %s with %s",
                        device.device_id, tool_call.name, tool_call.input,
                    )
                    result = tool_executor.execute(tool_call.name, tool_call.input)
                    tool_calls_log.append({
                        "tool": tool_call.name,
                        "input": tool_call.input,
                        "result": result,
                    })

                    # Handle human approval request — pause the loop
                    if tool_call.name == "request_human_approval":
                        action_taken = "waiting_approval"
                        device_agent.status = "waiting_approval"
                        device_agent.save(update_fields=["status"])
                        break

                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool_call.id,
                        "content": result,
                    })

                if action_taken == "waiting_approval":
                    break

                messages.append({"role": "user", "content": tool_results})
                action_taken = "tool_executed"
            else:
                break

        # Persist conversation history
        device_agent.conversation_history = messages[-20:]  # Keep last 20 turns
        device_agent.last_run_at = timezone.now()
        device_agent.save(update_fields=["conversation_history", "last_run_at"])

        # Save decision record
        decision = AgentDecision.objects.create(
            device=device,
            agent=device_agent,
            sensor_context=sensor_context,
            reasoning_text=reasoning_text,
            tool_calls=tool_calls_log,
            action_taken=action_taken,
            status="executed" if action_taken not in ("error", "waiting_approval") else action_taken,
        )

        # Broadcast reasoning to Angular frontend via WebSocket
        self._broadcast_decision(device, decision)

        return {
            "decision_id": decision.id,
            "reasoning_text": reasoning_text,
            "tool_calls": tool_calls_log,
            "action_taken": action_taken,
            "status": "executed",
        }

    def run_nl_command(self, device_agent, command: str) -> dict:
        """
        Execute a natural language command from an operator.
        Example: "Reduce temperature in Zone 3 by 5 degrees"
        """
        device = device_agent.device
        skill = device_agent.skill
        tools = skill.tool_definitions if skill.tool_definitions else DEFAULT_IOT_TOOLS

        messages = [{"role": "user", "content": f"Operator command: {command}"}]
        tool_executor = IoTToolExecutor(device)
        tool_calls_log = []
        reasoning_text = ""

        max_iterations = 5
        iteration = 0
        while iteration < max_iterations:
            iteration += 1
            try:
                response = self.client.messages.create(
                    model=skill.model,
                    max_tokens=skill.max_tokens,
                    system=skill.system_prompt,
                    tools=tools,
                    messages=messages,
                    thinking={"type": "adaptive"} if skill.enable_thinking else None,
                )
            except anthropic.APIError as exc:
                return {"error": str(exc), "tool_calls": tool_calls_log}

            for block in response.content:
                if block.type == "text":
                    reasoning_text += block.text

            if response.stop_reason == "end_turn":
                break

            if response.stop_reason == "tool_use":
                tool_use_blocks = [b for b in response.content if b.type == "tool_use"]
                messages.append({"role": "assistant", "content": response.content})
                tool_results = []
                for tc in tool_use_blocks:
                    result = tool_executor.execute(tc.name, tc.input)
                    tool_calls_log.append({"tool": tc.name, "input": tc.input, "result": result})
                    tool_results.append({"type": "tool_result", "tool_use_id": tc.id, "content": result})
                messages.append({"role": "user", "content": tool_results})
            else:
                break

        return {
            "reasoning_text": reasoning_text,
            "tool_calls": tool_calls_log,
            "status": "completed",
        }

    def _broadcast_decision(self, device, decision):
        """Push agent decision to Angular frontend via WebSocket channel."""
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"device_{device.device_id}",
            {
                "type": "agent_decision",
                "data": {
                    "decision_id": decision.id,
                    "device_id": str(device.device_id),
                    "reasoning_text": decision.reasoning_text[:500],
                    "action_taken": decision.action_taken,
                    "tool_calls_count": len(decision.tool_calls),
                    "timestamp": decision.timestamp.isoformat(),
                },
            },
        )
