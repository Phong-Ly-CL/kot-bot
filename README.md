# KING OF TIME Render Bot

Express.js Slack bot that automatically punches your KING OF TIME working card with auto punch-out after 10 hours.

## ✨ Features

- **Slack Commands**: `/punch in`, `/punch out`, `/punch-in`, `/punch-out`
- **Scheduled Punch-Out**: Schedule punch-out at specific time (e.g., `/punch out @ 19:00`)
- **Auto Punch-Out**: Automatically punches out after 10 hours (configurable)
- **Render Deployment**: Free hosting on Render with Uptime Robot monitoring
- **Slack Notifications**: Get notified when auto/scheduled punch-out happens
- **Status Checking**: Manual status endpoint to check current work hours
- **Keep-Alive**: Uptime Robot keeps the bot awake for reliable auto punch-out

## 🚀 Render Deployment

1. **Fork/Clone this repo**

2. **Connect to Render:**
   - Go to [render.com](https://render.com)
   - Create new **Web Service** from GitHub repo
   - Connect your repository

3. **Set Environment Variables in Render:**
   ```
   KOT_ID=your-actual-user-id
   KOT_PASS=your-actual-password
   AUTO_PUNCH_OUT_ENABLED=true
   MAX_WORK_HOURS=10
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```

4. **Deploy automatically** - Render will build and deploy

5. **Set up Uptime Robot:**
   - Go to [uptimerobot.com](https://uptimerobot.com) (free account)
   - Create HTTP monitor for `https://your-app.onrender.com/keep-alive`
   - Set interval to **10 minutes**
   - This keeps your bot awake for auto punch-out

## 🤖 Slack App Setup

1. **Create Slack App** at https://api.slack.com/apps

2. **Add Slash Commands** pointing to your Render URL:
   - `/punch` → `https://your-app.onrender.com/slack/punch`
   - `/punch-in` → `https://your-app.onrender.com/slack/punch`
   - `/punch-out` → `https://your-app.onrender.com/slack/punch`

3. **Create Incoming Webhook** (optional, for notifications):
   - Go to "Incoming Webhooks" → Enable → Add to workspace
   - Copy webhook URL to `SLACK_WEBHOOK_URL` env var

4. **Install app to workspace**

## 🎯 Usage

### Slack Commands:
- `/punch in` - Clock in immediately
- `/punch out` - Clock out immediately
- `/punch out @ 19:00` - Schedule punch-out at 19:00 JST
- `/punch status` - View your scheduled punch-out
- `/punch cancel` - Cancel scheduled punch-out
- `/punch-in` - Clock in (dedicated command)
- `/punch-out` - Clock out immediately (dedicated command)
- `/punch-out @ 18:30` - Schedule punch-out at 18:30 JST
- `/punch-out cancel` - Cancel scheduled punch-out

### Scheduled Punch-Out:
- Use `@ HH:MM` format to schedule punch-out (JST timezone)
- Example: `/punch out @ 19:00` schedules punch-out at 7:00 PM JST
- Check status: `/punch status` shows your scheduled time and countdown
- Cancel schedule: `/punch cancel` or `/punch-out cancel`
- Only one scheduled punch-out per user (new schedule replaces old)
- Schedules persist until server restart

### Auto Features:
- **Auto punch-out** after 10 hours (or your configured limit)
- **Scheduled punch-out takes priority** over auto punch-out
- **Slack notifications** when auto/scheduled punch-out happens
- **Hourly checks** to monitor work hours
- **In-memory tracking** - punch-in times stored in memory (resets on server restart)

### Manual Endpoints:
- `GET /` - Health check
- `GET /status` - Check current work status
- `GET /scheduled` - View all scheduled punch-outs
- `POST /punch/in` - Manual punch in
- `POST /punch/out` - Manual punch out

## ⚙️ Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `KOT_ID` | Your KING OF TIME user ID | Required |
| `KOT_PASS` | Your KING OF TIME password | Required |
| `AUTO_PUNCH_OUT_ENABLED` | Enable auto punch-out | `false` |
| `MAX_WORK_HOURS` | Hours before auto punch-out | `10` |
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications | Optional |

## 🔒 Security

- Environment variables encrypted on Render
- All Slack responses are ephemeral (private)
- No credentials stored in code
- Headless browser automation

## 💰 Cost

**Render Free Tier:**
- 750 hours monthly (more than enough)
- Sleeps after 15 minutes (Uptime Robot prevents this)
- Truly free forever

**Uptime Robot:**
- 50 monitors free
- 5-minute check interval (we use 10 minutes)

## 🧪 Local Development

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your credentials

# Run locally
npm run dev
```

## 📝 Notes

- First deployment may take 2-3 minutes for Puppeteer to install
- Auto punch-out checks run every hour
- Uptime Robot keeps the app alive (pings every 10 minutes)
- Cold starts may take 15-30 seconds if app goes to sleep
- Keep-alive endpoints: `/ping`, `/keep-alive`, `/`
- **Important**: Punch-in times are stored in memory and will reset if the server restarts
- **Important**: Auto punch-out only works if you punch in via this bot (Slack commands or API)