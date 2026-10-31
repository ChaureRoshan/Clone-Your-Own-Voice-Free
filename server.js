
const express = require("express");
const multer = require("multer");
const cors = require("cors");

const app = express();

app.use(cors({
  origin: "https://sgvt323.github.io"
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

app.post("/api/voice/create", upload.single("file"), async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({ error: "API key missing" });
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
    form.append("output_audio_codec", "mp3");

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

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=voice.mp3"
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
