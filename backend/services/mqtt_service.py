"""
MQTT Integration Service.

Subscribes to IoT device topics, ingests sensor data, and triggers
Claude agent reasoning via Celery tasks.
Also provides a publish method for agent actuator commands.
"""

import json
import logging
import threading

import paho.mqtt.client as mqtt
from django.conf import settings

logger = logging.getLogger(__name__)

_mqtt_client: mqtt.Client | None = None
_client_lock = threading.Lock()


class MQTTService:
    """Singleton MQTT client manager."""

    @classmethod
    def get_client(cls) -> mqtt.Client:
        global _mqtt_client
        with _client_lock:
            if _mqtt_client is None or not _mqtt_client.is_connected():
                _mqtt_client = cls._create_client()
        return _mqtt_client

    @classmethod
    def _create_client(cls) -> mqtt.Client:
        client = mqtt.Client(
            client_id=settings.MQTT_CLIENT_ID,
            protocol=mqtt.MQTTv5,
        )
        if settings.MQTT_USERNAME:
            client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)
        if settings.MQTT_USE_TLS:
            client.tls_set()

        client.on_connect = cls._on_connect
        client.on_message = cls._on_message
        client.on_disconnect = cls._on_disconnect

        client.connect(settings.MQTT_BROKER_HOST, settings.MQTT_BROKER_PORT, keepalive=60)
        client.loop_start()
        return client

    @staticmethod
    def _on_connect(client, userdata, flags, rc, properties=None):
        if rc == 0:
            logger.info("MQTT connected to %s:%s", settings.MQTT_BROKER_HOST, settings.MQTT_BROKER_PORT)
            # Subscribe to all device sensor topics
            client.subscribe("iot/+/sensors/+", qos=1)
            client.subscribe("iot/+/agent/input", qos=1)
            client.subscribe("iot/+/agent/audit", qos=1)
            client.subscribe("iot/fleet/broadcast", qos=0)
            logger.info("MQTT subscribed to IoT topics")
        else:
            logger.error("MQTT connection failed with rc=%d", rc)

    @staticmethod
    def _on_disconnect(client, userdata, rc, properties=None):
        logger.warning("MQTT disconnected (rc=%d). Will auto-reconnect.", rc)

    @staticmethod
    def _on_message(client, userdata, msg):
        """Handle incoming MQTT messages from IoT devices."""
        topic = msg.topic
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            logger.warning("Failed to decode MQTT message on %s: %s", topic, exc)
            return

        parts = topic.split("/")
        if len(parts) < 3:
            return

        device_id = parts[1]

        # iot/{device_id}/sensors/{sensor_name}
        if len(parts) == 4 and parts[2] == "sensors":
            sensor_name = parts[3]
            logger.debug("Sensor reading: device=%s sensor=%s value=%s", device_id, sensor_name, payload)
            # Dispatch to Celery for agent processing
            from apps.agents.tasks import process_sensor_reading
            process_sensor_reading.delay(device_id, sensor_name, payload)

        # iot/{device_id}/agent/input — direct NL command from operator
        elif len(parts) == 4 and parts[2] == "agent" and parts[3] == "input":
            command = payload.get("command", "")
            if command:
                from apps.agents.tasks import process_nl_command
                process_nl_command.delay(device_id, command)

        # iot/{device_id}/agent/audit — decision audit from edge devices
        elif len(parts) == 4 and parts[2] == "agent" and parts[3] == "audit":
            from apps.agents.tasks import store_edge_audit
            store_edge_audit.delay(device_id, payload)

    @classmethod
    def publish(cls, topic: str, payload: dict | str, qos: int = 1) -> None:
        """Publish a message to an MQTT topic."""
        client = cls.get_client()
        if isinstance(payload, dict):
            payload = json.dumps(payload)
        result = client.publish(topic, payload, qos=qos)
        if result.rc != mqtt.MQTT_ERR_SUCCESS:
            logger.error("MQTT publish failed on topic %s: rc=%d", topic, result.rc)
        else:
            logger.debug("MQTT published to %s", topic)

    @classmethod
    def start(cls):
        """Initialize the MQTT connection (call from Celery worker startup)."""
        cls.get_client()
        logger.info("MQTT service started")

    @classmethod
    def stop(cls):
        global _mqtt_client
        if _mqtt_client:
            _mqtt_client.loop_stop()
            _mqtt_client.disconnect()
            _mqtt_client = None
            logger.info("MQTT service stopped")
