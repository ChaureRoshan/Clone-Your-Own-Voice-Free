const express = require("express");
const multer = require("multer");
const cors = require("cors");

const app = express();

/* Extra origins (e.g. local testing) ke liye env: CORS_ORIGINS="http://localhost:5500,https://x.com" */
const allowedOrigins = [
  "https://sgvt323.github.io",
  ...(process.env.CORS_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean)
];

app.use(cors({
  origin: allowedOrigins
}));

app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

const API_KEY = process.env.SARVAM_API_KEY;

app.get("/", (req, res) => {
  res.send("AI Voice Clone Backend is running");
});

/* ---------- Premium access ----------
   Premium = cloning from an uploaded video/audio file.
   Recording your own voice stays free.
   Set PREMIUM_CODES on Render (comma-separated, long random strings) and give one
   code to each paying subscriber. Remove a code to cancel that subscriber. */
const PREMIUM_CODES = (process.env.PREMIUM_CODES || "")
  .split(",").map(s => s.trim()).filter(Boolean);

/* ---------- Razorpay (30-day Premium pass) ----------
   Env: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (never put these in the website!)
        PREMIUM_PRICE_INR (default 199), PREMIUM_DAYS (default 30)
        PREMIUM_SECRET (any long random string; used to sign access codes)
   After a verified payment the server returns a signed access code that works for
   PREMIUM_DAYS from the payment time. No database needed. */
const crypto = require("crypto");

const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const PRICE_INR = Number(process.env.PREMIUM_PRICE_INR) || 199;
const PREMIUM_DAYS = Number(process.env.PREMIUM_DAYS) || 30;
const SIGN_SECRET = process.env.PREMIUM_SECRET || RZP_KEY_SECRET || "";
const PAY_ENABLED = !!(RZP_KEY_ID && RZP_KEY_SECRET && SIGN_SECRET);

function sign(exp) {
  return crypto.createHmac("sha256", SIGN_SECRET).update("vc|" + exp).digest("base64url").slice(0, 22);
}

function makeToken(expSeconds) {
  const exp = Math.floor(expSeconds).toString(36);
  return "vc_" + exp + "_" + sign(exp);
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function tokenExpiry(code) {
  const m = /^vc_([0-9a-z]+)_([A-Za-z0-9_-]{22})$/.exec(String(code || "").trim());
  if (!m || !SIGN_SECRET || !safeEqual(sign(m[1]), m[2])) return 0;
  return parseInt(m[1], 36);
}

function isPremium(code) {
  if (!code) return false;
  const c = String(code).trim();
  if (PREMIUM_CODES.some(p => safeEqual(p, c))) return true;   // manual codes never expire
  return tokenExpiry(c) > Date.now() / 1000;                   // paid, signed, 30-day codes
}

const rzpAuth = () =>
  "Basic " + Buffer.from(RZP_KEY_ID + ":" + RZP_KEY_SECRET).toString("base64");

app.get("/api/pay/config", (req, res) => {
  res.json({ enabled: PAY_ENABLED, price: PRICE_INR, days: PREMIUM_DAYS, currency: "INR" });
});

app.post("/api/pay/order", async (req, res) => {
  try {
    if (!PAY_ENABLED) return res.status(503).json({ error: "Payments are not set up yet." });

    const r = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: rzpAuth(), "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Math.round(PRICE_INR * 100),             // paise
        currency: "INR",
        receipt: "vocalis_" + Date.now().toString(36),
        notes: { product: "vocalis_premium" }
      })
    });
    const order = await r.json();
    if (!r.ok) return res.status(502).json({ error: (order.error && order.error.description) || "Could not start payment." });

    res.json({ order_id: order.id, amount: order.amount, currency: order.currency, key_id: RZP_KEY_ID });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/pay/verify", async (req, res) => {
  try {
    if (!PAY_ENABLED) return res.status(503).json({ error: "Payments are not set up yet." });

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment details." });
    }

    /* 1) the signature proves Razorpay (not the browser) says this payment succeeded */
    const expected = crypto.createHmac("sha256", RZP_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id).digest("hex");
    if (!safeEqual(expected, razorpay_signature)) {
      return res.status(400).json({ error: "Payment could not be verified." });
    }

    /* 2) read the order from Razorpay: must be ours, and paid in full */
    const r = await fetch("https://api.razorpay.com/v1/orders/" + encodeURIComponent(razorpay_order_id), {
      headers: { Authorization: rzpAuth() }
    });
    const order = await r.json();
    if (!r.ok || order.status !== "paid" ||
        !order.notes || order.notes.product !== "vocalis_premium" ||
        order.amount_paid < Math.round(PRICE_INR * 100)) {
      return res.status(400).json({ error: "This payment is not complete." });
    }

    /* 3) validity counts from the payment time, so re-sending the same payment cannot extend it */
    const exp = order.created_at + PREMIUM_DAYS * 86400;
    if (exp <= Date.now() / 1000) {
      return res.status(400).json({ error: "This payment's Premium period has already ended." });
    }

    res.json({ ok: true, code: makeToken(exp), expires_at: exp });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/premium/verify", (req, res) => {
  const code = req.body && req.body.code;
  const exp = tokenExpiry(code);
  res.json({ ok: isPremium(code), expires_at: exp || null });
});

app.post("/api/voice/create", upload.single("file"), async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({ error: "API key missing" });
    }

    /* Consent is required for every sample */
    if (req.body.consent !== "true") {
      return res.status(400).json({
        error: "You must confirm the voice is yours (or you have permission) and accept the Terms."
      });
    }

    const source = req.body.source;
    if (source !== "record" && source !== "upload") {
      return res.status(400).json({ error: "Invalid request. Please refresh the page." });
    }

    /* Uploading a video/audio file is a Premium feature */
    if (source === "upload" && !isPremium(req.get("x-premium-code"))) {
      return res.status(402).json({
        error: "Premium is required to clone from a video or audio file. Recording your own voice is free."
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Audio file missing" });
    }

    const form = new FormData();

    form.append(
      "file",
      new Blob([req.file.buffer], { type: req.file.mimetype }),
      req.file.originalname || "voice.wav"
    );

    form.append("name", req.body.name || "My Voice");
    form.append("language", req.body.language || "hi-IN");

    const response = await fetch(
      "https://api.sarvam.ai/voices/create",
      {
        method: "POST",
        headers: { "api-subscription-key": API_KEY },
        body: form
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/voice/generate", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({ error: "API key missing" });
    }

    const { voice_id, text, language_code } = req.body;

    if (!voice_id || !text || !language_code) {
      return res.status(400).json({
        error: "voice_id, text and language_code required"
      });
    }

    if (text.length > 1000) {
      return res.status(400).json({
        error: "Text 1000 characters पेक्षा कमी ठेवा"
      });
    }

    const form = new FormData();

    form.append("voice_id", voice_id);
    form.append("text", text);
    form.append("language_code", language_code);
    /* WAV = lossless. MP3 se tut-tut / artifacts aate the, aur browser me
       chunks jodte waqt bhi WAV clean rehta hai. */
    form.append("output_audio_codec", "wav");
    form.append("speech_sample_rate", "24000");

    const pace = Number(req.body.pace);
    if (Number.isFinite(pace) && pace >= 0.5 && pace <= 2 && pace !== 1) {
      form.append("pace", String(pace));
    }

    const response = await fetch(
      "https://api.sarvam.ai/voices/clone",
      {
        method: "POST",
        headers: { "api-subscription-key": API_KEY },
        body: form
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data
      });
    }

    const audio = data.audio_b64 || data.audio;

    if (!audio) {
      return res.status(500).json({
        error: "Audio not returned",
        details: data
      });
    }

    const audioBuffer = Buffer.from(audio, "base64");

    res.setHeader("Content-Type", "audio/wav");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=voice.wav"
    );

    res.send(audioBuffer);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Voice Clone Backend running on port " + PORT);
});
