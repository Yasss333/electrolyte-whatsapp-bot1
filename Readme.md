# Electrolyte Bot — Telegram Task Reminder

Electrolyte Bot imports task CSV files, groups pending tasks by technician, creates branded task-card images, and sends them through the Telegram Bot API. The dashboard, SQLite storage, technician matching, and Excel export workflows are unchanged.

## Setup

### Create the bot with BotFather

1. Open Telegram and search for `@BotFather`.
2. Send `/newbot`, then enter a display name and a unique username ending in `bot`.
3. Copy the HTTP API token BotFather returns.
4. Set `TELEGRAM_BOT_TOKEN` in `backend/.env` (or your cloud host's environment settings).
5. Start the backend and open the Setup tab to verify that the bot is connected.

### Add technician chat IDs

1. Send the bot username to each technician and have each technician open it and press **Start**. A bot cannot start a direct conversation itself.
2. Ask the technician to send any message containing the word `task` or `tasks` (or `/start`). The backend prints their numeric chat ID as `[TELEGRAM_CHAT_ID] ...` in its console.
3. In **Technicians**, save the technician's name and that numeric Telegram chat ID. Bulk CSV format is `Name, Chat ID`.
4. Upload the task CSV and choose **Bulk Send**.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Yes | API token supplied by BotFather |
| `PORT` | No | Backend HTTP port; defaults to 5000 |
| `MAX_TASKS_PER_CARD` | No | Number of tasks per generated image card; defaults to 25 |
| `VITE_API_URL` | Frontend only | Public backend URL, when not running locally |

Telegram bots cannot initiate a direct conversation with a user: each technician must start the bot once. Use a chat-ID helper bot or your bot's update logs to obtain their numeric chat ID.

## Docker

Set `TELEGRAM_BOT_TOKEN` in the environment used by Docker Compose, then run:

```bash
docker compose up --build
```

The backend uses the HTTPS Telegram Bot API directly; it does not require a browser, QR link, persistent messaging session, or Chromium.
