# Electrolyte Bot — Telegram Task Reminder

Electrolyte Bot imports task CSV files, groups pending tasks by technician, creates branded task-card images, and sends them through the Telegram Bot API. The dashboard, SQLite storage, technician matching, and Excel export workflows are unchanged.

## Setup

1. Create a bot with Telegram's `@BotFather` and copy its API token.
2. Set `TELEGRAM_BOT_TOKEN` in `backend/.env` (or your cloud host's environment settings).
3. Start the backend and open the Setup tab to verify that the bot is connected.
4. Each technician must open the bot and press **Start** before it can send them a message.
5. In **Technicians**, save each technician's numeric Telegram chat ID. Bulk CSV format is `Name, Chat ID`.
6. Upload the task CSV and choose **Bulk Send**.

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
