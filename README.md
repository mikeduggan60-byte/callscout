# CallScout — Options Research Terminal

AI-powered long call options research. Live stock prices via Yahoo Finance, live options chains via Tradier, Reddit & StockTwits sentiment, Claude AI recommendations.

## Deploy to Netlify or Vercel

### Option A — Netlify (drag & drop, no account setup needed)

1. Run `npm install` then `npm run build` in this folder
2. Go to [netlify.com](https://netlify.com) → sign up free
3. Drag the `dist/` folder onto the Netlify dashboard
4. Done — you get a live URL instantly

### Option B — Vercel (recommended, automatic deploys)

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → sign up with GitHub
3. Click "Add New Project" → import your repo
4. Vercel auto-detects Vite → click Deploy
5. Done — every git push auto-deploys

### Option C — Run locally

```bash
npm install
npm run dev
```
Open http://localhost:5173

## Getting your Tradier token

1. Open a free account at [tradier.com](https://tradier.com)
2. Go to [web.tradier.com/user/api](https://web.tradier.com/user/api)
3. Copy your **Production Access Token**
4. Paste it into CallScout at login
