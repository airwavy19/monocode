# Cloudflare Tunnel Best Practice

This is the **canonical rule** for running Cloudflare tunnels across all projects in this workspace. It exists because the shared-state pattern (`sudo cloudflared service install <TOKEN>` → `/etc/cloudflared/`) caused real incidents — one project's install clobbering another's token, "1033: tunnel exists, no connector" failures on prod, restart loops from metrics-port collisions.

**TL;DR — every project on this workspace uses a per-project systemd unit + per-project config filename + token from the project's own `.env`. Nothing in `/etc/cloudflared/` is shared across projects.**

## Why this exists

The naive install — `sudo cloudflared service install <TOKEN>` — writes the token to `/etc/cloudflared/token` (mode 600, root-readable) and creates `/etc/cloudflared/config.yml` (root-only). On a multi-project host, this is a **single global directory** that one project's install clobbers when the next project runs.

Symptoms observed on this workspace:
- **HTTP 1033** ("tunnel exists, no connector") — CF edge sees a route for `accountabill.rafiamjad.my.id` pointing at a connector ID that doesn't exist on this host. Reason: the connector was registered earlier with one token, then a different project's install overwrote the token without re-registering.
- **Restart loops > 1000x in a row** — two services both bind the metrics port 2000, fail to bind, systemd restarts them in a tight loop. Journal logs don't make this obvious; you have to grep for "bind: address already in use".
- **Random ownership confusion** — `/etc/cloudflared/token` is whoever installed last. Can't tell at a glance which project it belongs to.

These are real incidents, not theoretical. See the `gstackforward/memory.py` lesson for `project=accountabillbuddy` for the full trace.

## The 9 rules

### Rule 1 — Per-project systemd unit. Always.

Every tunnel runs as its own systemd service. Naming: `<project>-tunnel.service`. Lives at `/etc/systemd/system/<project>-tunnel.service`. Source-of-truth copy in `<repo>/deploy/systemd/<project>-tunnel.service` (tracked in git).

**Never** use:
- `cloudflared service install <TOKEN>` (writes to global state)
- `cloudflared tunnel login` + `~/.cloudflared/<UUID>.json` (token in user home)
- `EnvironmentFile=~/.config/cloudflared/*.env` (token in user home, not project-local)

### Rule 2 — Per-project config filename in `/etc/cloudflared/`.

Each tunnel reads from `/etc/cloudflared/<project>-config.yml`. **Never** write to `/etc/cloudflared/config.yml` — that's the global filename cloudflared's own installer creates.

Source-of-truth copy in `<repo>/deploy/cloudflared/<project>-config.yml`.

Verify on any host: `ls /etc/cloudflared/*.yml` should show per-project filenames only.

### Rule 3 — Token from project's `.env`.

Tunnel token lives at `<repo>/.env` as:

```
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoiNTc2ZmMxMmQ3NmI3NTA0ODFmOGJlNTE0NDhlMzNjODMiLCJ0Ijoi...
```

The systemd unit reads it via `EnvironmentFile=-<repo>/.env` (the `-` prefix lets systemd start even if the file is missing, so cloudflared produces a clear error in journalctl instead of systemd refusing to start).

`.env` is gitignored. `.env.example` documents the variable name and a placeholder, never the value.

### Rule 4 — Pin `protocol: http2`. Always.

QUIC connections have been observed to lose UDP at the host level; cloudflared doesn't notice quickly enough and `tunnel-status.sh` shows "0 ready connections" for 60-90 seconds during recovery. HTTP/2 (TCP) is slower to start but reliable.

```yaml
# deploy/cloudflared/<project>-config.yml
protocol: http2

ingress:
  - service: http://127.0.0.1:<local-port>
```

### Rule 5 — Unique `--metrics` port per tunnel.

Each tunnel exposes a localhost-only Prometheus metrics endpoint. Two tunnels picking the same port causes silent restart loops. This workspace assigns ports in **2000+ range** (declared in the port registry below).

```yaml
# deploy/cloudflared/<project>-config.yml
metrics: localhost:200X
```

Before adding a new tunnel, check `ss -ltnp | grep ':200'` to see what's bound. Pick the lowest free port.

### Rule 6 — `TimeoutStartSec=60` on every tunnel unit.

Cloudflared takes a few seconds to negotiate 4 HTTP/2 HA sessions. Default 90s systemd timeout is fine but explicit 60s makes intent clear.

```ini
[Service]
TimeoutStartSec=60
TimeoutStopSec=20
Restart=on-failure
RestartSec=5
```

### Rule 7 — Disable systemd's default restart cap.

Default `StartLimitBurst=5` in `StartLimitIntervalSec=10s` is too aggressive for production tunnels. A real failure can take 60-90s to surface; the default would mark the unit failed before it's recovered.

```ini
[Service]
# Override default "5 restarts / 10 s" cap. Without this, legitimate slow
# restarts hit the limit and systemd marks the unit as failed before
# recovery completes.
StartLimitIntervalSec=0
```

### Rule 8 — Post-install smoke. Always.

`install_tunnel.sh` (or equivalent) runs `curl -sI https://<hostname>` within 60 seconds of `systemctl enable --now`. Failure modes:

| Status | Meaning | Fix |
|---|---|---|
| `HTTP/2 200` (or 30x) | Tunnel live, edge routing works | Done |
| `HTTP/2 1033` | Tunnel exists, no connector live | Wrong token in `.env`. Regenerate in dashboard, update `.env`, restart. |
| `HTTP/2 530` / `502` | Tunnel up, edge forwarding fails | Backend service (Next.js / Flask / etc.) not running on the local port. Check it. |
| Empty / connection refused | DNS not yet propagated, or tunnel silent | Wait 60s, re-check. If still empty, `journalctl -u <unit> -n 50`. |

Smoke goes in `<repo>/deploy/install_tunnel.sh` (or `scripts/install_tunnel.sh`), not separate. It runs as the last step of install.

### Rule 9 — Restart-loop alarm: 5/10min = hard fail.

Per `forward.md` → Deployment & Live Site → "Restart-loops are alarms, not noise" (the relevant bullet under Deployment & Live Site). A flapping systemd unit is worse than a down one:

```bash
journalctl -u <project>-tunnel.service --since "10 min ago" | grep -c "Started"
```

If the count > 5, treat as a hard fail. Two prime causes:

1. **Metrics port collision** — `ss -ltnp | grep ':200X'` shows two cloudflared PIDs on the same port. Fix: pick a different port in `<project>-config.yml`.
2. **Token / config drift** — `/etc/cloudflared/<project>-config.yml` differs from `<repo>/deploy/cloudflared/<project>-config.yml`. Fix: `sudo bash deploy/install_tunnel.sh` re-syncs.

## Port registry (canonical, copy-paste across projects)

| Project | Tunnel name | Metrics port | Local app port | Service name | Notes |
|---|---|---|---|---|---|
| mmxquota | mmxquota | **2000** | 3033 | `mmxquota-tunnel.service` | Original "global" install; migrated to per-project |
| (apr23-gatevis-gatevision) | gatevision-tunnel | **2001** | 5000-5005 | (Docker container) | HTTP/2, see canonical `apps/rndcam/scripts/llama-cpp-server.sh` style |
| oversight (cscustomscanner) | oversight | **2002** | 9007 | `oversight-tunnel.service` | cscustomscanner's main dashboard |
| cschat (cscustomscanner) | cschat | **2003** | 9008 | `cschat-tunnel.service` | cscustomscanner's chat service |
| accountabillbuddy | accountabillbuddy | **2004** | 30189 | `accountabillbuddy-tunnel.service` | Next.js dev server, host=afamic.id |
| **next tunnel goes here** | — | **2005** | — | — | Run `ss -ltnp \| grep ':200'` to confirm free |

**Rule:** next available port = previous max + 1. Don't skip. Don't reuse. Even briefly.

## Per-project file layout

The same shape in every repo on this host:

```
<repo>/
├── .env                              # contains CLOUDFLARE_TUNNEL_TOKEN=... (gitignored)
├── .env.example                      # documents CLOUDFLARE_TUNNEL_TOKEN=, no value
├── deploy/
│   ├── cloudflared/
│   │   └── <project>-config.yml      # ← tunnel config (tracked)
│   ├── systemd/
│   │   └── <project>-tunnel.service  # ← systemd unit (tracked)
│   ├── install_tunnel.sh             # ← idempotent installer (tracked, chmod +x)
│   └── tunnel/
│       └── README.md                  # ← project-specific notes (optional)
```

`forward_agents.py` (in `gstackforward/`) auto-stages this doc + `memory.py` + `<repo>/AGENTS.md` to every sibling repo on `--yes`. The `deploy/...` files are NOT auto-staged — those are project-specific, not generic.

## Day-to-day commands

```bash
# Status of any tunnel on this host:
sudo bash <repo>/deploy/install_tunnel.sh --status

# Restart after config change (config-side OR token-side):
sudo bash <repo>/deploy/install_tunnel.sh --restart

# First-time install (one-time, after dashboard setup):
sudo bash <repo>/deploy/install_tunnel.sh

# Uninstall (cleanup):
sudo bash <repo>/deploy/install_tunnel.sh --uninstall

# Check the port registry for collisions:
ss -ltnp | grep ':200'      # all current metrics ports
ss -ltnp | grep ':7844'     # cloudflared QUIC inbound (if QUIC enabled)
```

## Anti-patterns (NEVER do)

| Anti-pattern | Why it breaks |
|---|---|
| `sudo cloudflared service install <TOKEN>` | Writes to global `/etc/cloudflared/`. One project's install clobbers another's token. The 1033 family. |
| `cloudflared tunnel route dns <tunnel> <host>` with `~/.cloudflared/<UUID>.json` | Token in user home, not project-local. Cannot be deployed as code. Easy to forget when rotating machines. |
| `cloudflared tunnel --config /etc/cloudflared/config.yml` (the default filename) | The "default" is the shared one. Any project-specific config there competes with mmxquota's already-installed config. |
| Using `cloudflared`'s auto-update flag (`--no-autoupdate` is the safe setting) | Auto-update can break compatibility mid-deployment. Disable it. |
| Sharing `cloudflared` binary across multiple machines with the same hardcoded metrics port | Restart loops. Each machine needs its own port assignment. |
| Setting `metrics: 0.0.0.0:<port>` (all interfaces) | Exposes the metrics endpoint to the local network. Use `localhost:<port>`. |

## When `forward.md` §18 references this

This doc is the runtime reference. `forward.md` §18 Tunneling & Ports is the abstraction (rules + principles). When you need to set up a tunnel, follow **this**. When you need to argue a refactor, cite **`forward.md` §18 Tunneling & Ports** + **the 9 rules above**.

## Migrations from old pattern

If you find a project on this host still using:
- `/etc/cloudflared/config.yml` (the global filename)
- `/etc/cloudflared/token` (the bare token file)
- `EnvironmentFile=~/.config/cloudflared/*.env` (user home token)

…it's an old install. Migration:

```bash
# 1. Read existing config, identify the tunnel name + token
sudo cat /etc/cloudflared/config.yml
sudo -s cat /etc/cloudflared/token  # only root can read

# 2. Move per-project:
sudo mv /etc/cloudflared/config.yml /etc/cloudflared/<project>-config.yml

# 3. Update systemd unit (if it exists):
sudo sed -i 's|/etc/cloudflared/config\.yml|/etc/cloudflared/<project>-config.yml|' \
  /etc/systemd/system/<project>-tunnel.service
sudo sed -i 's|EnvironmentFile=.*|EnvironmentFile=-<repo>/.env|' \
  /etc/systemd/system/<project>-tunnel.service

# 4. Restart:
sudo systemctl daemon-reload
sudo systemctl restart <project>-tunnel.service

# 5. Clean up the bare token (orphan after migration):
sudo rm /etc/cloudflared/token

# 6. Smoke:
curl -sI https://<project-domain> | head -3
```

## Sources / further reading

- [Cloudflare tunnel docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Local management API](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/configure-tunnels/local-management-api/)
- Working examples on this host: `mmxquota/deploy/install_tunnel.sh`, `cscustomscanner/deploy/install_tunnel.sh`, `apr23-gatevis/infra/tunnel/`
- Local lessons via `gstackforward/memory.py recall "1033"` (post-incident analysis)
- This file's source of truth: `gstackforward/templates/tunnel-best-practice.md` (auto-staged to every repo via `forward_agents.py`)
