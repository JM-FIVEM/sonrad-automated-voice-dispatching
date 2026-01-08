let johnny = `
    ░█████ ░███     ░███            ░███    ░██    ░██ ░███████   
      ░██  ░████   ░████           ░██░██   ░██    ░██ ░██   ░██  
      ░██  ░██░██ ░██░██          ░██  ░██  ░██    ░██ ░██    ░██ 
      ░██  ░██ ░████ ░██ ░██████ ░█████████ ░██    ░██ ░██    ░██ 
░██   ░██  ░██  ░██  ░██         ░██    ░██  ░██  ░██  ░██    ░██ 
░██   ░██  ░██       ░██         ░██    ░██   ░██░██   ░██   ░██  
 ░██████   ░██       ░██         ░██    ░██    ░███    ░███████   
                                                                  
  https://github.com/JM-FIVEM/sonrad-automated-voice-dispatching                                              
                                                                                                                                             
`;

const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const ffmpegPath = require("ffmpeg-static");

const app = express();
const PORT = 8676;
const AUDIO_DIR = path.join(__dirname, "audio_temp");
const WEB_DIR = path.join(__dirname, "public");

if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR);

app.use("/", express.static(WEB_DIR));
app.use("/postals", express.static(path.join(WEB_DIR, "postals")));
app.use("/css", express.static(path.join(WEB_DIR, "css")));
app.use("/js", express.static(path.join(WEB_DIR, "js")));
app.use("/audio", express.static(path.join(WEB_DIR, "audio")));


app.use(bodyParser.json());
console.log("Booting...");

process.on("uncaughtException", err => {
  console.error("UNCAUGHT:", err);
});
process.on("unhandledRejection", err => {
  console.error("UNHANDLED:", err);
});

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use("/audio", express.static(AUDIO_DIR));

async function waitForUrl(url, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const resp = await fetch(url, { method: "HEAD" });
      if (resp.ok) return true;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`URL not reachable: ${url}`);
}

app.post("/send_dispatch", async (req, res) => {
  try {
    const { speakers, audioUrl, label = "Test Tone" } = req.body;
    if (!speakers || !audioUrl) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const tempId = uuidv4();
    const tempWav = path.join(AUDIO_DIR, `${tempId}.wav`);
    const tempMp3 = path.join(AUDIO_DIR, `${tempId}.mp3`);

    const response = await fetch(audioUrl);
    if (!response.ok) throw new Error("Failed to download audio");
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(tempWav, buffer);

    await new Promise((resolve, reject) => {
      const cmd = `"${ffmpegPath}" -y -i "${tempWav}" -ac 1 -ar 22050 -codec:a libmp3lame "${tempMp3}"`;
      exec(cmd, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    fs.unlinkSync(tempWav); // delete WAV

    const publicUrl = `https://avdp.johnnychillx.com/audio/${tempId}.mp3`;

    await waitForUrl(publicUrl, 5000);

    const payload = {
      serverId: req.body.serverId,
      roomId: req.body.roomId,
      tones: [
        {
          id: Math.floor(Math.random() * 999999),
          src: publicUrl,
          icon: "fas fa-broadcast-tower",
          color: "#ff0000",
          label,
          textColor: "#ffffff"
        }
      ],
playTo: speakers.map(s => {
  // If mode is "channel"
  if (req.body.mode === "channel") {
    return {
      label: s.label || "Channel",
      type: "channel",
      icon: "fas fa-broadcast-tower",
      color: "bg-grey-9",
      value: Number(s.id),     // channel ID number
      group: Number(s.group),  // channel groupId
      tooltip: "Radio Channel"
    };
  }

  // Otherwise: speaker mode
  return {
    label: s.label || "Speaker",
    type: "game",
    icon: "fa-solid fa-location-pin",
    color: "bg-primary",
    value: s.id,               // speaker UUID
    tooltip: "In-Game Speaker",
    group: s.group || null,
    speakerGroup: s.group || null
  };
})

    };

    console.log("Sending payload:", JSON.stringify(payload, null, 2));

    const srResp = await fetch("https://api.sonoranradio.com/radio/tone", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "sonoran-radio-account": req.body.ssoAccount,
        "sonoran-radio-auth-token": req.body.ssoToken,
        "origin": "https://sonoranradio.com",
        "referer": "https://sonoranradio.com/",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      },
      body: JSON.stringify(payload)
    });

    const data = await srResp.json();

    setTimeout(() => {
      if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);
    }, 60_000);

    res.json({ result: "success", publicUrl, data });
  } catch (err) {
    console.error("Dispatch error:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

app.post("/channels", async (req, res) => {
  try {
    const { communityId, communityKey } = req.body;
    if (!communityId || !communityKey) {
      return res.status(400).json({ error: "Missing communityId or communityKey" });
    }

    const url = `https://api.sonoranradio.com/api/radio/get-community-channels/${communityId}/${communityKey}`;

    const resp = await fetch(url, {
      headers: { "Content-Type": "application/json" }
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(resp.status).json({ error: txt });
    }

    const data = await resp.json();
    res.json(data);

  } catch (err) {
    console.error("Channel fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});


app.post("/speakers", async (req, res) => {
  try {
    const { communityId } = req.body;
    if (!communityId) {
      return res.status(400).json({ error: "Missing communityId" });
    }

    // Call Sonoran Radio API
    const resp = await fetch(`https://api.sonoranradio.com/panel/servers/${communityId}`, {
      headers: {
        "accept": "application/json",
        "sonoran-radio-account": req.body.ssoAccount,
        "sonoran-radio-auth-token": req.body.ssoToken
      }
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: `Sonoran API error: ${text}` });
    }

    const data = await resp.json();

    if (!data?.data?.toneSpeakerLocations) {
      return res.status(500).json({ error: "toneSpeakerLocations not found" });
    }

    res.json(data.data.toneSpeakerLocations);
  } catch (err) {
    console.error("Speaker fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/ers/dispatch", async (req, res) => {
  try {
    const {
      serverId,
      ssoAccount,
      ssoToken,
      murfApiKey,
      service,
      unit,
      callType,
      location,
      channel,
      tone,
      respondText
    } = req.body;

    if (!serverId || !ssoAccount || !ssoToken) {
      throw new Error("Missing Sonoran credentials");
    }

    /* ---------------- TONE ---------------- */
    await fetch("https://avdp.johnnychillx.com/send_dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serverId,
        ssoAccount,
        ssoToken,
        speakers: [channel],
        audioUrl: `https://avdp.johnnychillx.com/audio/${tone}`,
        mode: "channel",
        label: `${service.toUpperCase()} Tone`
      })
    });

    /* ---------------- MURF ---------------- */
    const text = `
${unit}, ${callType}, ${location},
${unit}, ${callType}, ${location},
${respondText}
    `.replace(/\s+/g, " ").trim();

    const murfResp = await fetch("https://api.murf.ai/v1/speech/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": murfApiKey
      },
      body: JSON.stringify({
        voiceId: "en-US-charlotte",
        style: "Narration",
        text,
        sampleRate: 8000,
        format: "WAV",
        channelType: "MONO",
        encodeAsBase64: false
      })
    });

    const murfData = await murfResp.json();
    if (!murfData.audioFile) throw new Error("Murf generation failed");

    await new Promise(r => setTimeout(r, 4200));

    /* ---------------- VOICE ---------------- */
    await fetch("https://avdp.johnnychillx.com/send_dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serverId,
        ssoAccount,
        ssoToken,
        speakers: [channel],
        audioUrl: murfData.audioFile,
        mode: "channel",
        label: `${service.toUpperCase()} Dispatch`
      })
    });

    res.json({ ok: true });

  } catch (err) {
    console.error("ERS dispatch error:", err);
    res.status(500).json({ error: err.message });
  }
});


app.listen(PORT, () => {
  const reset = "\x1b[0m";
  const bold = "\x1b[1m";
  const cyan = "\x1b[36m";
  const magenta = "\x1b[35m";
  const yellow = "\x1b[33m";
  const green = "\x1b[32m";
  const purple = "\x1b[35m";

  const line = "═".repeat(60);

  // Print Johnny in bold purple
  console.log(`${purple}${bold}${johnny}${reset}`);

  console.log(`${magenta}${line}${reset}`);
  console.log(`${bold}${cyan}🚀  Dispatch Proxy & Web Server Started!${reset}`);
  console.log(`${yellow}PORT:${reset} ${green}${PORT}${reset}`);
  console.log(`${yellow}UI URL:${reset} ${green}http://localhost:${PORT}/${reset}`);
  console.log(`${yellow}Audio Path:${reset} ${green}/audio${reset}`);
  console.log(`${yellow}Postals Path:${reset} ${green}/postals${reset}`);
  console.log(`${magenta}${line}${reset}\n`);
});

