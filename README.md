# KING OF TIME Render Bot

Express.js Slack bot that automatically punches your KING OF TIME working card with auto punch-in and auto punch-out.

## ✨ Features

- **Slack Commands**: `/punch in`, `/punch out`, `/punch-in`, `/punch-out`
- **Scheduled Punch-Out**: Schedule punch-out at specific time (e.g., `/punch out @ 19:00`)
- **Auto Punch-In**: Automatically punches in at random time within configured window (e.g., 08:30-09:30 JST)
- **Auto Punch-Out**: Automatically punches out after 10 hours (configurable)
- **Render Deployment**: Free hosting on Render with Uptime Robot monitoring
- **Slack Notifications**: Get notified when auto/scheduled punch-in/out happens
- **Status Checking**: Manual status endpoint to check current work hours
- **Keep-Alive**: Uptime Robot keeps the bot awake for reliable auto features

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
   AUTO_PUNCH_IN_ENABLED=true
   AUTO_PUNCH_IN_TIME_START=08:30
   AUTO_PUNCH_IN_TIME_END=09:30
   AUTO_PUNCH_OUT_ENABLED=true
   MAX_WORK_HOURS=10
   AUTO_PUNCH_OUT_DELAY_MIN=0
   AUTO_PUNCH_OUT_DELAY_MAX=30
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   API_SECRET=your-random-secret-key
   SLACK_SIGNING_SECRET=your-slack-signing-secret
   ```

   Generate a random API secret:
   ```bash
   openssl rand -hex 32
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

3. **Get Signing Secret** (for security):
   - Go to "Basic Information" → "App Credentials"
   - Copy "Signing Secret" to `SLACK_SIGNING_SECRET` env var in Render
   - This verifies requests are actually from Slack

4. **Create Incoming Webhook** (optional, for notifications):
   - Go to "Incoming Webhooks" → Enable → Add to workspace
   - Copy webhook URL to `SLACK_WEBHOOK_URL` env var

5. **Install app to workspace**

## 🎯 Usage

### Slack Commands:
- `/punch in` - Clock in immediately
- `/punch out` - Clock out immediately
- `/punch out @ 19:00` - Schedule punch-out at 19:00 JST
- `/punch status` - View punch-in time, work duration, and scheduled punch-out
- `/punch remind HH:MM` - Manually set punch-in time (e.g., `/punch remind 09:00`)
- `/punch cancel` - Cancel scheduled punch-out
- `/punch-in` - Clock in (dedicated command)
- `/punch-out` - Clock out immediately (dedicated command)
- `/punch-out @ 18:30` - Schedule punch-out at 18:30 JST
- `/punch-out cancel` - Cancel scheduled punch-out

### Manual Punch-In Time Reminder:
- Use `/punch remind HH:MM` to manually set when you punched in (JST timezone)
- Example: `/punch remind 09:00` tells the bot you punched in at 9:00 AM JST
- Useful when server restarts and loses in-memory punch-in data
- The bot will calculate your work duration and trigger auto punch-out correctly
- Time must be in the past (earlier than current time)
- **Auto punch-out**: If work duration exceeds MAX_WORK_HOURS when setting remind time, bot will punch you out immediately

### Status Command:
- Use `/punch status` to check your current status
- Shows punch-in time and work duration if you're punched in (according to bot memory)
- Shows scheduled punch-out time and countdown if scheduled
- Helpful reminder to use `/punch remind HH:MM` if bot lost your punch-in data

### Scheduled Punch-Out:
- Use `@ HH:MM` format to schedule punch-out (JST timezone)
- Example: `/punch out @ 19:00` schedules punch-out at 7:00 PM JST
- Check status: `/punch status` shows your scheduled time and countdown
- Cancel schedule: `/punch cancel` or `/punch-out cancel`
- Only one scheduled punch-out per user (new schedule replaces old)
- Schedules persist until server restart

### Auto Features:
- **Auto punch-in** at random time within configured window (e.g., 08:30-09:30 JST)
  - Schedules new random time daily at midnight JST
  - Skips if already punched in
  - Skips on weekends (Saturday and Sunday)
  - Skips on Japanese public holidays
- **Auto punch-out** after 10 hours (or your configured limit)
  - Random delay (0-30 minutes by default) after reaching max hours
  - Checks every 5 minutes for more responsive detection
- **Scheduled punch-out takes priority** over auto punch-out
- **Slack notifications** when auto/scheduled punch-in/out happens
- **In-memory tracking** - punch-in times and schedules stored in memory (resets on server restart)

### Manual Endpoints:
- `GET /` - Health check (public)
- `GET /ping` - Ping endpoint (public)
- `GET /keep-alive` - Keep-alive for Uptime Robot (public)
- `GET /status` - Check current work status (requires API secret)
- `GET /scheduled` - View all scheduled punch-outs (requires API secret)
- `POST /punch/in` - Manual punch in (requires API secret)
- `POST /punch/out` - Manual punch out (requires API secret)

**Authentication for manual endpoints:**
```bash
# Using header (recommended)
curl -H "X-API-Secret: your-secret" https://your-app.onrender.com/status

# Using query parameter
curl https://your-app.onrender.com/status?secret=your-secret
```

## ⚙️ Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `KOT_ID` | Your KING OF TIME user ID | Required |
| `KOT_PASS` | Your KING OF TIME password | Required |
| `AUTO_PUNCH_IN_ENABLED` | Enable auto punch-in | `false` |
| `AUTO_PUNCH_IN_TIME_START` | Auto punch-in window start time (HH:MM JST) | `08:30` |
| `AUTO_PUNCH_IN_TIME_END` | Auto punch-in window end time (HH:MM JST) | `09:30` |
| `AUTO_PUNCH_OUT_ENABLED` | Enable auto punch-out | `false` |
| `MAX_WORK_HOURS` | Hours before auto punch-out | `10` |
| `AUTO_PUNCH_OUT_DELAY_MIN` | Minimum delay (minutes) before auto punch-out | `0` |
| `AUTO_PUNCH_OUT_DELAY_MAX` | Maximum delay (minutes) before auto punch-out | `30` |
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications | Optional |
| `SLACK_SIGNING_SECRET` | Slack signing secret for request verification | Recommended |
| `API_SECRET` | Secret key for manual API endpoints | Optional |

## 🔒 Security

- Environment variables encrypted on Render
- All Slack responses are ephemeral (private)
- No credentials stored in code
- Headless browser automation
- **Slack signature verification** - Validates all `/slack/punch` requests from Slack
- **API secret protection** for manual endpoints (optional but recommended)
- **Public endpoints**: `/`, `/ping`, `/keep-alive` only
- **Protected endpoints**: `/status`, `/scheduled`, `/punch/*` require `X-API-Secret` header
- **Replay attack prevention** - Rejects Slack requests older than 5 minutes

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
- Auto punch-in schedules new random time daily at midnight JST
- Auto punch-in skips weekends (Saturday and Sunday) and Japanese public holidays
- Auto punch-out checks run every 5 minutes
- Auto punch-out adds random delay (0-30 min) after reaching max hours
- Uptime Robot keeps the app alive (pings every 10 minutes)
- Cold starts may take 15-30 seconds if app goes to sleep
- Keep-alive endpoints: `/ping`, `/keep-alive`, `/`
- **Important**: Punch-in times and schedules are stored in memory and will reset if the server restarts
- **Important**: Auto punch-out only works if you punch in via this bot (Slack commands, API, or auto punch-in)