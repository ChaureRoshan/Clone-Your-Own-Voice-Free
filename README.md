# Vocalis

Your voice, infinitely spoken. Clone your voice from a short clip and turn any Hindi or Marathi text into speech in your own voice.

- **Free:** record your own voice live (after confirming it is your voice and accepting the Terms).
- **Premium:** clone from an uploaded video or audio file (needs an access code).

## Hosting
- **Frontend:** `index.html` (GitHub Pages / Netlify)
- **Backend:** `server.js` (Render)

## Render environment variables
| Name | Value |
|---|---|
| `SARVAM_API_KEY` | your Sarvam API key |
| `CORS_ORIGINS` | comma-separated site URLs, e.g. `https://chaureroshan.github.io,https://vocalis.netlify.app` |
| `PREMIUM_CODES` | comma-separated long random access codes, one per paying subscriber. Remove a code to cancel that subscriber. |

Set `PREMIUM_URL` at the top of the script in `index.html` to your payment link.
