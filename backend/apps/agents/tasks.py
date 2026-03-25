"""Celery tasks for agent processing."""

import logging
from datetime import datetime, timezone

from celery import shared_task
from django.utils import timezone as django_timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=5)
def process_sensor_reading(self, device_id: str, sensor_name: str, payload: dict):
    """
    Triggered when a sensor reading arrives via MQTT.
    Ingests the reading and runs the device's agent if one is active.
    """
    try:
        from apps.devices.models import Device, Sensor
        from apps.telemetry.models import SensorReading

        device = Device.objects.get(device_id=device_id)

        # Determine value
        value = None
        raw_payload = payload
        if isinstance(payload, (int, float)):
            value = float(payload)
            raw_payload = None
        elif isinstance(payload, dict):
            value = payload.get("value")
            if isinstance(value, (int, float)):
                value = float(value)

        ts = payload.get("timestamp") if isinstance(payload, dict) else None
        if ts:
            try:
                timestamp = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                timestamp = django_timezone.now()
        else:
            timestamp = django_timezone.now()

        sensor, _ = Sensor.objects.get_or_create(
            device=device, name=sensor_name,
            defaults={"data_type": "float" if value is not None else "json"},
        )
        SensorReading.objects.create(
            device=device, sensor=sensor, sensor_name=sensor_name,
            value=value, raw_payload=raw_payload, timestamp=timestamp,
        )
        sensor.last_value = value or raw_payload
        sensor.last_updated = timestamp
        sensor.save(update_fields=["last_value", "last_updated"])

        # Update device heartbeat
        device.last_heartbeat = django_timezone.now()
        from apps.devices.models import Device as D
        device.status = D.Status.ONLINE
        device.save(update_fields=["last_heartbeat", "status"])

        # Run agent if one is active for this device
        if hasattr(device, "agent") and device.agent.status == "active":
            run_agent_decision.delay(device.id, {sensor_name: value or raw_payload})

    except Exception as exc:
        logger.error("process_sensor_reading failed for device=%s sensor=%s: %s", device_id, sensor_name, exc)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2, default_retry_delay=10)
def run_agent_decision(self, device_pk: int, sensor_context: dict):
    """Run Claude agent reasoning for a device with the given sensor context."""
    try:
        from apps.devices.models import Device
        from services.agent_service import AgentService

        device = Device.objects.select_related("agent__skill").get(pk=device_pk)
        if not hasattr(device, "agent"):
            return

        agent_svc = AgentService()
        result = agent_svc.run_agent(device.agent, sensor_context)
        logger.info("Agent decision for device %s: action=%s", device.device_id, result.get("action_taken"))
        return result

    except Exception as exc:
        logger.error("run_agent_decision failed for device pk=%s: %s", device_pk, exc)
        raise self.retry(exc=exc)


@shared_task
def process_nl_command(device_id: str, command: str):
    """Execute a natural language command sent via MQTT."""
    try:
        from apps.devices.models import Device
        from services.agent_service import AgentService

        device = Device.objects.get(device_id=device_id)
        if not hasattr(device, "agent"):
            logger.warning("No agent for device %s, ignoring NL command.", device_id)
            return

        agent_svc = AgentService()
        result = agent_svc.run_nl_command(device.agent, command)
        logger.info("NL command processed for device %s: %s", device_id, result)
        return result

    except Exception as exc:
        logger.error("process_nl_command failed for device=%s: %s", device_id, exc)


@shared_task
def store_edge_audit(device_id: str, payload: dict):
    """Store audit log from edge device (FlowFuse/Node-RED)."""
    try:
        from apps.decisions.models import AuditLog
        from apps.devices.models import Device

        device = Device.objects.get(device_id=device_id)
        AuditLog.objects.create(
            device=device,
            event_type="edge_audit",
            details=payload,
        )
    except Exception as exc:
        logger.error("store_edge_audit failed for device=%s: %s", device_id, exc)
