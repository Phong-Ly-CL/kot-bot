# KING OF TIME Railway Bot

Express.js Slack bot that automatically punches your KING OF TIME working card with auto punch-out after 10 hours.

## ✨ Features

- **Slack Commands**: `/punch in`, `/punch out`, `/punch-in`, `/punch-out`
- **Auto Punch-Out**: Automatically punches out after 10 hours (configurable)
- **Railway Deployment**: Free hosting on Railway
- **Slack Notifications**: Get notified when auto punch-out happens
- **Status Checking**: Manual status endpoint to check current work hours

## 🚀 Railway Deployment

1. **Fork/Clone this repo**

2. **Connect to Railway:**
   - Go to [railway.app](https://railway.app)
   - Create new project from GitHub repo
   - Connect your repository

3. **Set Environment Variables in Railway:**
   ```
   KOT_ID=your-actual-user-id
   KOT_PASS=your-actual-password
   AUTO_PUNCH_OUT_ENABLED=true
   MAX_WORK_HOURS=10
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```

4. **Deploy automatically** - Railway will build and deploy

## 🤖 Slack App Setup

1. **Create Slack App** at https://api.slack.com/apps

2. **Add Slash Commands** pointing to your Railway URL:
   - `/punch` → `https://your-app.railway.app/slack/punch`
   - `/punch-in` → `https://your-app.railway.app/slack/punch`
   - `/punch-out` → `https://your-app.railway.app/slack/punch`

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

**Railway Free Tier:**
- $5 credit monthly
- 500 hours runtime
- Should be more than enough for this bot

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
- Railway keeps the app alive during active hours
- Cold starts may take 10-15 seconds