"""WebSocket consumer for streaming agent reasoning."""

import json

from channels.generic.websocket import AsyncWebsocketConsumer


class AgentConsumer(AsyncWebsocketConsumer):
    """
    WebSocket endpoint for streaming agent reasoning to Angular frontend.
    ws/agents/{agent_id}/
    """

    async def connect(self):
        self.agent_id = self.scope["url_route"]["kwargs"]["agent_id"]
        self.group_name = f"agent_{self.agent_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        # Support NL commands sent from Angular chat UI
        if data.get("type") == "nl_command":
            await self.send(text_data=json.dumps({"type": "ack", "message": "Command received, processing..."}))

    # --- Channel layer message handlers ---

    async def agent_decision(self, event):
        await self.send(text_data=json.dumps({"type": "agent_decision", **event["data"]}))

    async def agent_thinking(self, event):
        """Stream partial reasoning text during agent execution."""
        await self.send(text_data=json.dumps({"type": "thinking", **event["data"]}))

    async def tool_call(self, event):
        """Notify frontend of a tool call being executed."""
        await self.send(text_data=json.dumps({"type": "tool_call", **event["data"]}))
