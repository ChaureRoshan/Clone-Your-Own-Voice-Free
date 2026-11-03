# Vocalis

Your voice, infinitely spoken. Clone your voice from a short clip and turn any Hindi or Marathi text into speech in your own voice.

- **Free:** record your own voice live (after confirming it is your voice and accepting the Terms).
- **Premium:** clone from an uploaded video or audio file. Paid with Razorpay; one payment unlocks 30 days.

## Hosting
- **Frontend:** `index.html` (GitHub Pages / Netlify)
- **Backend:** `server.js` (Render)

## Render environment variables
| Name | Value |
|---|---|
| `SARVAM_API_KEY` | your Sarvam API key |
| `CORS_ORIGINS` | comma-separated site URLs, e.g. `https://chaureroshan.github.io,https://ai-vocalis.netlify.app` |
| `RAZORPAY_KEY_ID` | from Razorpay Dashboard → Account & Settings → API Keys |
| `RAZORPAY_KEY_SECRET` | same page. Keep it secret. Never put it in index.html |
| `PREMIUM_SECRET` | any long random string (signs the access codes) |
| `PREMIUM_PRICE_INR` | optional, default 199 |
| `PREMIUM_DAYS` | optional, default 30 |
| `PREMIUM_CODES` | optional, manual never-expiring codes (comma-separated) |
