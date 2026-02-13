# Deploy LINE Webhook on Vercel

## Files
- `/api/line/webhook.js`
- `/api/line/status.js`
- `vercel.json`
- `.env` with `LINE_CHANNEL_ACCESS_TOKEN` and `LINE_CHANNEL_SECRET`

## Steps
- Push project to GitHub
- Import to Vercel
- Add Environment Variables:
  - `LINE_CHANNEL_ACCESS_TOKEN`
  - `LINE_CHANNEL_SECRET`
- Deploy
- Set LINE Webhook URL:
  - `https://<your-vercel-domain>/api/line/webhook`
- Verify in LINE Developers

## Test
- GET `https://<your-vercel-domain>/api/line/status` → `{"status":"active"}`
- POST JSON to `https://<your-vercel-domain>/api/line/webhook`
