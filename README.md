# Copilot System

This repo is structured as a multi-service "system-wide copilot" workspace.

**Current working path (Phase 1):**
- Mic capture + realtime overlay UI: `apps/overlay-ui/`
- Gateway (WS + orchestration): `services/gateway/`
- STT (Whisper): `services/stt-service/`
- LLM runtime: `ollama` via `docker-compose.yml`

**Compose**
- Base stack: `docker compose up -d --build`
- Optional storage: `docker compose --profile storage up -d`

**Windows Automation**
- Safe default is `AUTOMATION_MODE=dry-run` (no real input is sent).
- For real automation on Windows, run the host agent:
  - `npm -C apps/desktop-client start`
  - Set `AUTOMATION_MODE=live` for the desktop client to actually send inputs.
  - Optionally set `AUTOMATION_TOKEN` on both desktop-client and gateway.
  - Uncomment `AUTOMATION_ENDPOINT=http://host.docker.internal:4010` in `docker-compose.yml` to forward tool calls.
