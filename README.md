# KING OF TIME Render Bot

Express.js Slack bot that automatically punches your KING OF TIME working card with auto punch-out after 10 hours.

## ✨ Features

- **Slack Commands**: `/punch in`, `/punch out`, `/punch-in`, `/punch-out`
- **Auto Punch-Out**: Automatically punches out after 10 hours (configurable)
- **Render Deployment**: Free hosting on Render with Uptime Robot monitoring
- **Slack Notifications**: Get notified when auto punch-out happens
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
- `/punch in` - Clock in
- `/punch out` - Clock out
- `/punch-in` - Clock in (dedicated)
- `/punch-out` - Clock out (dedicated)

### Auto Features:
- **Auto punch-out** after 10 hours (or your configured limit)
- **Slack notifications** when auto punch-out happens
- **Hourly checks** to monitor work hours

### Manual Endpoints:
- `GET /` - Health check
- `GET /status` - Check current work status
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

- Environment variables encrypted on Railway
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