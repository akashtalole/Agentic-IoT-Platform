"""WebSocket consumer for real-time alerts."""

import json

from channels.generic.websocket import AsyncWebsocketConsumer


class AlertConsumer(AsyncWebsocketConsumer):
    """
    WebSocket endpoint for real-time alerts and approval requests.
    ws/alerts/
    """

    async def connect(self):
        self.group_name = "alerts"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def new_alert(self, event):
        await self.send(text_data=json.dumps({"type": "alert", **event["data"]}))

    async def approval_request(self, event):
        await self.send(text_data=json.dumps({"type": "approval_request", **event["data"]}))
