"""WebSocket consumer for real-time device status and telemetry."""

import json

from channels.generic.websocket import AsyncWebsocketConsumer


class DeviceConsumer(AsyncWebsocketConsumer):
    """
    WebSocket endpoint for device updates.

    URL patterns:
      ws/devices/          → fleet-wide updates (group: fleet_updates)
      ws/devices/{id}/     → single device live telemetry (group: device_{id})
    """

    async def connect(self):
        self.device_id = self.scope["url_route"]["kwargs"].get("device_id")
        if self.device_id:
            self.group_name = f"device_{self.device_id}"
        else:
            self.group_name = "fleet_updates"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        """Handle incoming WebSocket messages (e.g. actuator commands from Angular)."""
        data = json.loads(text_data)
        # Echo back as acknowledgment
        await self.send(text_data=json.dumps({"type": "ack", "data": data}))

    # --- Channel layer message handlers ---

    async def device_status(self, event):
        """Broadcast device status change."""
        await self.send(text_data=json.dumps({"type": "device_status", **event["data"]}))

    async def sensor_reading(self, event):
        """Broadcast new sensor reading."""
        await self.send(text_data=json.dumps({"type": "sensor_reading", **event["data"]}))

    async def fleet_update(self, event):
        """Broadcast fleet-level update."""
        await self.send(text_data=json.dumps({"type": "fleet_update", **event["data"]}))
