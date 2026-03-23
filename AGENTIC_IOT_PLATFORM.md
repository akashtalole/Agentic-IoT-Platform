# Agentic IoT Platform: Claude + FlowFuse

> **Vision**: An IoT platform where edge devices don't just collect data — they reason, decide, and act autonomously using AI agent skills, all remotely managed from a FlowFuse Dashboard.

---

## The Problem with Traditional IoT

Current IoT deployments are **rules-based and brittle**:

- Developers hard-code `if temperature > 80 then alert` — every edge case requires a code change
- Devices can't adapt to novel situations or understand context
- Managing thousands of edge devices means deploying thousands of individual rule updates
- No natural language interface — operators must understand the underlying logic to interact with systems

**Agentic IoT changes this.** Instead of rules, devices run AI agents that can observe sensor data, reason about what it means, and take appropriate action — including actions the original developer never explicitly programmed.

---

## Platform Architecture

The Agentic IoT Platform layers three technologies into a cohesive system:

```
┌─────────────────────────────────────────────────────────────────┐
│                   FlowFuse Cloud Dashboard                       │
│  • Natural language device commands                              │
│  • Real-time agent decision monitoring                           │
│  • Fleet management & snapshot deployment                        │
│  • Human-in-the-loop approval for critical actions               │
└──────────────────────────┬──────────────────────────────────────┘
                           │ MQTT heartbeat + snapshot deployment
┌──────────────────────────▼──────────────────────────────────────┐
│              FlowFuse Device Agent + Node-RED                    │
│  • Runs on edge hardware (Raspberry Pi, Jetson, industrial PLC)  │
│  • Hosts Claude agent skill nodes as npm packages               │
│  • Executes agentic loops: observe → reason → act                │
│  • Reports decisions back to dashboard via MQTT                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Anthropic API (HTTP)
┌──────────────────────────▼──────────────────────────────────────┐
│                    Claude AI (Agent Skills)                       │
│  • Receives sensor context + available tool definitions          │
│  • Reasons about the situation                                   │
│  • Returns tool_use calls → Node-RED executes them              │
│  • Supports multi-turn agentic loops                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │ GPIO / MQTT / HTTP / Serial
┌──────────────────────────▼──────────────────────────────────────┐
│                  Physical World                                   │
│  Sensors: temperature, vibration, vision cameras, gas detectors  │
│  Actuators: relays, motors, valves, displays, alarms             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### 1. Agent Skills as Custom Node-RED Nodes

Agent "skills" are packaged as npm Node-RED contribution packages. Each skill node:

- Accepts a message payload (sensor readings, events, user commands)
- Calls the Anthropic API with a system prompt + tool definitions for available device capabilities
- Receives a `tool_use` response from Claude
- Routes the message to the appropriate output pin to trigger the corresponding actuator

**Example skill nodes:**

| npm Package | What it does |
|---|---|
| `node-red-contrib-claude-anomaly` | Detects anomalies in time-series sensor streams |
| `node-red-contrib-claude-maintenance` | Predicts maintenance needs from vibration/heat data |
| `node-red-contrib-claude-nlcommand` | Translates natural language operator commands into device actions |
| `node-red-contrib-claude-multiagent` | Coordinates decisions across multiple device agents via MQTT |
| `node-red-contrib-claude-vision` | Analyzes camera frames for defects, safety events, occupancy |

**Example Node-RED flow with Claude skill:**

```
[MQTT In: sensors] → [Claude Anomaly Node] → [Switch: tool_use type]
                                                   ├─ "trigger_alert" → [MQTT Out: alarm]
                                                   ├─ "adjust_setpoint" → [GPIO Out: relay]
                                                   └─ "escalate_human" → [Email/Slack Out]
```

### 2. Claude Tool Definitions = Device Capabilities

When a Claude skill node calls the Anthropic API, it passes **tool definitions** that describe what the device can physically do:

```json
{
  "tools": [
    {
      "name": "trigger_relay",
      "description": "Activate or deactivate a relay controlling a physical actuator",
      "input_schema": {
        "type": "object",
        "properties": {
          "relay_id": { "type": "string" },
          "state": { "type": "boolean" },
          "duration_seconds": { "type": "number" }
        }
      }
    },
    {
      "name": "publish_alert",
      "description": "Send an alert with priority level to the operator dashboard",
      "input_schema": {
        "type": "object",
        "properties": {
          "message": { "type": "string" },
          "priority": { "type": "string", "enum": ["info", "warning", "critical"] }
        }
      }
    },
    {
      "name": "request_human_approval",
      "description": "Pause and ask a human operator to approve before proceeding",
      "input_schema": {
        "type": "object",
        "properties": {
          "proposed_action": { "type": "string" },
          "reason": { "type": "string" }
        }
      }
    }
  ]
}
```

Claude selects which tool to call based on the sensor context and the system prompt. The Node-RED skill node then maps each tool name to a specific output pin.

### 3. Remote Deployment via FlowFuse Snapshots

FlowFuse's **snapshot system** is the deployment mechanism for agent skills:

1. **Design** agent flows in the cloud Node-RED editor on FlowFuse
2. **Install** Claude skill nodes via FlowFuse's node package manager
3. **Configure** environment variables (`ANTHROPIC_API_KEY`, model name, tool configs) — secrets never live in flows
4. **Create Snapshot** — captures the entire flow, installed nodes, and environment config
5. **Assign to Device Group** — target a fleet of devices (e.g., "factory-floor-line-1")
6. **Deploy** — FlowFuse pushes the snapshot to all devices in the group simultaneously
7. **Rollback** — if agent behavior is unexpected, one click reverts to a previous snapshot

**Fleet provisioning with auto-registration:**

```bash
# On a new device, install the FlowFuse Device Agent
npx @flowfuse/device-agent

# Use a provisioning token (no manual registration needed per device)
# The device auto-registers to the correct team + application group
```

New devices automatically receive the latest assigned snapshot and begin running agent skills immediately — enabling scalable fleet management with zero per-device configuration.

### 4. FlowFuse Dashboard as the Agent Control Plane

The FlowFuse Dashboard 2.0 becomes the **operator interface for the AI agent fleet**:

#### Real-Time Agent Monitoring
- Live feed of agent decisions across all connected devices
- Sensor readings, Claude's reasoning summary, and the action taken
- Timestamps and device IDs for full traceability

#### Natural Language Device Control
```
Operator types: "Reduce temperature in Zone 3 by 5 degrees"
        ↓
Dashboard sends to FlowFuse cloud flow
        ↓
Claude NL Command skill translates to: set_setpoint(zone=3, delta=-5)
        ↓
Command dispatched to Zone 3 device agent via MQTT
        ↓
Device agent executes and confirms back to dashboard
```

#### Human-in-the-Loop Approval
High-stakes decisions (shutting down a production line, triggering emergency stops) route through a Dashboard approval widget before execution:

```
Claude decides: "Vibration pattern indicates imminent bearing failure — recommend shutdown"
        ↓
Dashboard shows: [APPROVE SHUTDOWN] [OVERRIDE: CONTINUE] [REQUEST MORE DATA]
        ↓
Operator clicks APPROVE → command sent to device → actuator triggered
```

#### Agent Audit Trail
Every Claude decision is published to an audit MQTT topic and rendered in the Dashboard:

| Timestamp | Device | Sensor Reading | Claude Decision | Action Taken |
|---|---|---|---|---|
| 14:23:01 | line-1-motor-3 | vibration: 12.4g | Bearing wear detected, schedule maintenance | Published work order |
| 14:23:45 | boiler-room-2 | temp: 94°C | Within normal range | No action |
| 14:24:12 | entry-gate-1 | camera: person | Unrecognized face at 2am | Triggered alert |

---

## MQTT Topic Convention

All devices follow a consistent topic structure enabling cross-device coordination:

```
iot/{device-id}/sensors/{sensor-name}     ← Raw sensor data (inbound)
iot/{device-id}/agent/input               ← Commands sent to agent (inbound)
iot/{device-id}/agent/decision            ← Claude's reasoning output (outbound)
iot/{device-id}/actuators/{actuator-id}   ← Actuation commands (outbound)
iot/{device-id}/agent/audit               ← Full decision log with context (outbound)
iot/fleet/broadcast                       ← Platform-wide messages to all devices
```

Multi-agent coordination: a `coordinator-agent` device subscribes to all device audit topics and uses Claude to make fleet-level decisions (e.g., load balancing across production lines).

---

## Key Use Cases

### Smart Factory Quality Control
- **Sensors**: Vision camera on conveyor belt
- **Agent Skill**: `node-red-contrib-claude-vision`
- **Flow**: Camera frame → Claude analyzes for defects → triggers reject relay or passes item
- **Dashboard**: Live defect rate, examples of flagged items, Claude's reasoning

### Predictive Maintenance
- **Sensors**: Vibration + temperature on rotating machinery
- **Agent Skill**: `node-red-contrib-claude-maintenance`
- **Flow**: Time-series sensor data → Claude identifies degradation pattern → creates maintenance ticket
- **Dashboard**: Equipment health scores, predicted failure windows, maintenance calendar

### Smart Building Optimization
- **Sensors**: Occupancy, temperature, CO2, energy meters
- **Agent Skill**: `node-red-contrib-claude-multiagent` (HVAC agent + Lighting agent + Energy agent)
- **Flow**: Agents coordinate via MQTT → Claude makes cross-system optimization decisions
- **Dashboard**: Real-time energy usage, comfort scores, operator natural language overrides

### Precision Agriculture
- **Sensors**: Soil moisture, weather station, crop cameras
- **Agent Skill**: `node-red-contrib-claude-anomaly` + custom irrigation tools
- **Flow**: Sensor readings + weather forecast → Claude decides irrigation schedule → controls pumps
- **Dashboard**: Field map with agent decisions, water usage trends, crop health alerts

### Edge Security
- **Sensors**: IP cameras, door sensors, access card readers
- **Agent Skill**: `node-red-contrib-claude-vision`
- **Flow**: Camera feed → Claude evaluates threat → alerts security team or locks doors
- **Dashboard**: Live camera feeds with AI annotations, incident log, response actions

---

## Security & Governance

| Concern | Approach |
|---|---|
| API Key Management | Stored as FlowFuse environment variables in snapshots — never in flow JSON |
| Critical Action Safety | `request_human_approval` tool forces dashboard confirmation before execution |
| Audit & Compliance | Every Claude decision logged to MQTT audit topic, retained in FlowFuse |
| Offline Resilience | Fallback Node-RED rules-based flow runs when Anthropic API is unreachable |
| Access Control | FlowFuse role-based access: operators see dashboard, engineers edit flows |
| MQTT Security | TLS + authentication on broker; device certificates managed by FlowFuse |
| Prompt Injection | Sensor data is passed as structured JSON, not raw user input |

---

## Technical Stack

| Layer | Technology |
|---|---|
| Edge Runtime | FlowFuse Device Agent + Node-RED |
| Agent Skills | Custom npm packages (`node-red-contrib-claude-*`) |
| AI Reasoning | Claude (claude-sonnet-4-6 or claude-opus-4-6) via Anthropic API |
| Messaging | MQTT (Mosquitto / EMQX / AWS IoT Core) |
| Remote Management | FlowFuse Cloud (snapshot deployment, fleet management) |
| Operator UI | FlowFuse Dashboard 2.0 |
| Hardware | Raspberry Pi, NVIDIA Jetson, industrial gateways, ESP32 |

---

## Getting Started

### Prerequisites
- [FlowFuse account](https://app.flowfuse.com) (free tier works for development)
- Anthropic API key
- Edge device: Raspberry Pi 4 or equivalent (Node.js 18+ required)

### Step 1: Install FlowFuse Device Agent

```bash
# On your edge device
npm install -g @flowfuse/device-agent

# Start with web UI for easy setup
flowfuse-device-agent --ui
```

### Step 2: Register the Device

1. In FlowFuse Dashboard → Your Application → Remote Instances → Add Device
2. Download the device configuration file
3. Place `device.yml` in the agent config directory
4. Restart the agent — it connects to FlowFuse automatically

### Step 3: Build Your First Agent Flow

In FlowFuse, open the Node-RED editor for your device:

1. Install the Claude skill node package (when published: `node-red-contrib-claude-agent`)
2. Drag in: `[inject]` → `[claude-skill]` → `[debug]`
3. Configure the Claude skill node:
   - Model: `claude-sonnet-4-6`
   - System prompt: "You are a sensor monitoring agent. Analyze the provided readings."
   - Tools: define what actuators are available
4. Set `ANTHROPIC_API_KEY` in FlowFuse environment variables

### Step 4: Deploy to Your Fleet

1. FlowFuse → Application → Create Snapshot
2. Assign snapshot to your device group
3. Click Deploy — all devices in the group receive the agent skill

---

## Development Roadmap

| Phase | Milestone | Description |
|---|---|---|
| **Phase 1** | Claude Skill Node MVP | Single `node-red-contrib-claude-agent` node with configurable tools. Open source on npm. |
| **Phase 2** | Specialized Skill Library | Domain-specific nodes: anomaly detection, vision, NL commands, maintenance prediction |
| **Phase 3** | Multi-Agent Coordination | MQTT-based agent mesh; devices share context and coordinate decisions |
| **Phase 4** | Dashboard Control Plane | Purpose-built FlowFuse Dashboard template for agent fleet management |
| **Phase 5** | MCP Server Integration | Model Context Protocol server running on FlowFuse — agents access shared tools and resources |
| **Phase 6** | Agent Marketplace | FlowFuse-hosted catalog of agent skill packages for common IoT verticals |

---

## Why This Stack?

**FlowFuse + Node-RED** is uniquely suited for agentic IoT:

- Node-RED's visual flow model maps naturally to agentic loops (observe → reason → act)
- FlowFuse snapshot deployment solves the hardest problem in IoT: **getting new code to edge devices safely**
- The Node-RED ecosystem has thousands of hardware integration nodes — Claude agents get all of them as potential tools
- FlowFuse Dashboard provides the operator UI without building a custom frontend
- The existing FlowFuse fleet management scales from 1 device to 10,000+

**Claude** brings reasoning capabilities that rule-based systems can never match:

- Handles novel situations without explicit programming
- Natural language interface reduces operator training burden
- Tool use enables structured, reliable actuation (not free-form text parsing)
- Multi-turn conversation enables complex multi-step reasoning before acting

---

## Contributing

This project is open source under the Apache 2.0 License. Contributions welcome:

- New Claude skill node packages for specific IoT verticals
- Example FlowFuse flows and dashboard templates
- Integration guides for specific hardware platforms
- Documentation and tutorials

---

## References

- [FlowFuse Documentation](https://flowfuse.com/docs/)
- [FlowFuse Device Agent](https://github.com/FlowFuse/device-agent)
- [FlowFuse Dashboard 2.0](https://dashboard.flowfuse.com/)
- [Anthropic API Documentation](https://docs.anthropic.com/)
- [Node-RED Documentation](https://nodered.org/docs/)
- [MQTT and LLM Architecture Patterns](https://www.emqx.com/en/blog/why-and-how-mqtt-is-used-in-ai-llm-applications)
