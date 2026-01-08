# JM Automated Voice Dispatch (AVD)

## Overview

JM Automated Voice Dispatch (AVD) is a web-based voice dispatch system for Sonoran Radio, leveraging Murf TTS for audio generation. It supports dispatching to speakers or channels, with customizable call types, postal codes, and departments.

**Important:** If you are not using the default proxy server, you will need HTTPS setup through a domain. The proxy server must be port-forwarded because audio files streamed to Sonoran are hosted there. It is highly recommended to leave the default proxy server unless you know what you are doing.

---

## Step 1: Folder Structure

After downloading the project, your `public` folder should look like this:

```
public/
├─ audio/
├─ css/
├─ index.html
├─ js/
├─ postals/
```

* `audio/`: Place audio tones here.
* `css/`: Styles for the web interface.
* `index.html`: Main web interface.
* `js/`: JavaScript files.
* `postals/`: JSON postal datasets.

---

## Step 2: Server Setup

Install dependencies and run the proxy server:

```bash
npm install
node server.js
```

You should see a console output like this:

```text
════════════════════════════════════════════════════════════
🚀  Dispatch Proxy & Web Server Started!
PORT: 8676
UI URL: http://localhost:8676/
Audio Path: /audio
Postals Path: /postals
════════════════════════════════════════════════════════════
```

---

## Step 3: Configuring `config.yml`

You need to populate the following fields in your YAML configuration:

```yaml
# Murf API KEY
murfApiKey: "" # https://murf.ai/api/dashboard

# Sonoran Radio Community ID and Key
communityID: "XXXXXXXX"
communityKey: "xxxxxxx-xxxxxxxxxx-xxxxxxxxxxx-xxxxxxxx"

# Sonoran SSO (Use F12 on https://sonoranradio.com > Application > Local Storage)
ssoAccount: "xxxxxxx-xxxxxxxxxx-xxxxxxxxxxx-xxxxxxxx"
ssoToken: "xxxxxxx-xxxxxxxxxx-xxxxxxxxxxx-xxxxxxxx"

# Sonoran Server and Room ID
serverId: "xxxxx"
roomId: "1" # Usually "1"

Speakers:
  - label: "Station 2"
    id: "xxxxxxx-xxxxxxxxxx-xxxxxxxxx-xxxxxx"
    tone: "station2.mp3"

fields:
  - name: "Departments"
    type: "Dropdown"
    multiple: true
    options: ["Station 1","Station 2","Station 3","Chief 1",...]
  - name: "Call Type"
    type: "Dropdown"
    options: ["Medical Emergency", "Residential structure fire", ...]
  - name: "Postal"
    type: "TextBox"
  - name: "Address"
    type: "TextBox"
  - name: "Channel"
    type: "Dropdown"
    options: ["Main Fire Channel","LEO TAC 1","LEO SPECIAL EVENTS",...]
```

**Important Notes:**

1. **SSO Credentials**: Always use a dedicated Sonoran account. Real SSO tokens can allow full account access.
2. **Play Dispatch Tones**: Ensure this is enabled in the Sonoran Radio members tab.
3. **Server ID & Room ID**: Use F12 console to verify by sending a test tone.
4. **Speaker IDs**: Can be found via `/sonoranradio/speakers.json` or the website debug mode.

---

## Step 4: Web Interface Usage

* Load your `config.yml` using **Load Call Structure** button.
* Enable debug mode to show speaker IDs.
* Choose **Postal Dataset** and **Transmission Mode** (Speakers or Channels).
* Fill in dispatch form and send.
* Audio will be processed by Murf TTS and sent through the proxy to Sonoran Radio.

---

## Step 5: Security & Recommendations

* Use a dedicated Sonoran account to prevent exposing your main account.
* Keep your `murfApiKey`, `communityKey`, and `ssoToken` private.
* Always validate your proxy and server setup before deploying in production.

---

## Step 6: Additional Notes

* Postal autocomplete will help fill in street and cross-streets.
* Channel mode allows sending dispatches directly to Sonoran channels.
* Speaker mode sends dispatches to in-game speaker locations.
* For troubleshooting, check `consoleOutput` and enable debug mode in the interface.

---

## Links & Resources

* Murf API: [https://murf.ai/api/dashboard](https://murf.ai/api/dashboard)
* Sonoran Radio: [https://sonoranradio.com](https://sonoranradio.com)
* GitHub: [https://github.com/JM-FIVEM/sonrad-automated-voice-dispatching](https://github.com/JM-FIVEM/sonrad-automated-voice-dispatching)

---

*Created by @johnnychillx*
