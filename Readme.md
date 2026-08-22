# Electrolyte Bot — WhatsApp Task Reminder

A full-stack automation system that sends WhatsApp reminders to technicians for their pending tasks. The admin uploads a CSV, and the bot sends a branded summary image to each technician via WhatsApp.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React + Tailwind (Vite) |
| Backend | Node.js + Express + SQLite |
| WhatsApp | `whatsapp-web.js` + Puppeteer |
| Deployment | Docker (local only) |

---

## Architecture

```
Admin Browser ──▶ React App (Vite) ──▶ Node Backend (Express)
                                               │
                                        SQLite DB (tasks.db)
                                               │
                                        WhatsApp Web (Puppeteer)
```

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) (free)
- Git (optional)

---

## Setup & Running

### First-time setup

```bash
# Clone the repo
git clone <repo-url>
cd electrolyte-bot

# Start the app
docker-compose up -d
```

Or double-click:
- **Windows** → `start.bat`
- **Mac/Linux** → `./start.sh`

Wait **2–5 minutes** for Docker to build images on the first run.

### Scan WhatsApp QR

1. Open `http://localhost:5173`
2. Go to **Setup** → scan the QR code
3. On your phone: **WhatsApp → Settings → Linked Devices → Link a Device**

### Subsequent starts

```bash
docker-compose up -d
# Wait 30–60 seconds, then open http://localhost:5173
```

### Stop the app

```bash
docker-compose down
```

---

## Using the App

1. **Add Technicians** — Go to the Technicians tab → add name + 10-digit phone number.
2. **Upload Tasks** — Go to Upload & Send → drag & drop your CSV → click **Load Tasks**.
3. **Send Reminders** — Click **Bulk Send**. Each technician gets a WhatsApp image + text summary.
4. **Dashboard** — View stats, daily volume, and per-technician breakdown.

---

## Folder Structure

```
electrolyte-bot/
├── backend/
│   ├── Dockerfile
│   └── src/
│       ├── index.js
│       ├── whatsapp.js
│       ├── csvParser.js
│       ├── imageGenerator.js
│       └── db.js
├── frontend/
│   ├── Dockerfile
│   └── src/
├── docker-compose.yml
├── start.bat
├── start.sh
└── README.md
```

---

## Updating the App

```bash
docker-compose down
docker-compose up -d --build
```

## Reset Everything

```bash
docker-compose down
rm -rf data/session/
docker-compose up -d
# Re-scan the QR code after restart
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| QR code not showing | `docker-compose logs backend` |
| Messages timing out | Delete `data/session/` and re-scan QR |
| Second upload skips tasks | Fixed — only `LineItem Status = 'Completed'` marks tasks resolved (not `WO Status`) |
| Chromium not found | Ensure `PUPPETEER_EXECUTABLE_PATH` is set in the Dockerfile |

---

## ⚠️ Cloud Deployment Warning

**Do not deploy on free cloud tiers (Render, Railway, etc.).**

Puppeteer requires ≥2 GB RAM and a persistent disk. Free tiers will crash with timeouts and disconnected sessions.

- ✅ Runs perfectly locally with Docker
- ❌ Cloud only viable on **paid tiers** with sufficient resources

---

## Disclaimer

This project uses `whatsapp-web.js`, which automates WhatsApp Web and is **not** an official WhatsApp API. Use responsibly. The developers are not liable for account bans or misuse.

---

*Built for internship — Electrolyte Solutions*