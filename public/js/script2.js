let config = null;
let debugMode = false;
let version = "1.3.8nicotine";
let owner = `
   oooo   .oooooo.   ooooo   ooooo ooooo      ooo ooooo      ooo oooooo   oooo 
   \`888  d8P'  \`Y8b  \`888'   \`888' \`888b.     \`8' \`888b.     \`8'  \`888.   .8'  
    888 888      888  888     888   8 \`88b.    8   8 \`88b.    8    \`888. .8'   
    888 888      888  888ooooo888   8   \`88b.  8   8   \`88b.  8     \`888.8'    
    888 888      888  888     888   8     \`88b.8   8     \`88b.8      \`888'     
    888 \`88b    d88'  888     888   8       \`888   8       \`888       888      
 .o. 88P  \`Y8bood8P'  o888o   o888o o8o        \`8  o8o        \`8      o888o     
 \`Y888P                                                                         
                                                                               
`;

let postalCache = null;
console.log(owner);
console.log("SCRIPT2.JS VERSION:", version);

async function loadPostals(filename) {
    const cached = localStorage.getItem(filename);
    if (cached) {
        postalCache = JSON.parse(cached);
        console.log(`[POSTALS] Loaded ${filename} from cache`);
        return postalCache;
    }

    const resp = await fetch(`./postals/${filename}`);
    if (!resp.ok) throw new Error("Failed to load postals: " + filename);
    const data = await resp.json();

    localStorage.setItem(filename, JSON.stringify(data));
    postalCache = data;
    console.log(`[POSTALS] Loaded ${filename} from server`);
    return data;
}

// Load default dataset on page load
window.addEventListener("DOMContentLoaded", async () => {
    const defaultDataset = document.getElementById("postalDataset").value;
    await loadPostals(defaultDataset);
});

// Change postal dataset dynamically
document.getElementById("postalDataset").addEventListener("change", async (e) => {
    const filename = e.target.value;
    await loadPostals(filename);
});

document.getElementById("debugModeToggle").addEventListener("change", (e) => {
    debugMode = e.target.checked;
    document.getElementById("debugButton").style.display = debugMode ? "inline-block" : "none";

    // Hide debug output if debug mode is turned off
    if (!debugMode) {
        const debugBox = document.getElementById("debugOutput");
        debugBox.style.display = "none";
        debugBox.innerHTML = "";
    }
});

document.getElementById("transmitMode").addEventListener("change", async () => {
    const mode = document.getElementById("transmitMode").value;

    if (mode === "channel") {
        document.getElementById("speakersDropdown").style.display = "none";
        document.getElementById("channelDropdownContainer").style.display = "block";

        await loadChannels();
    } else {
        document.getElementById("speakersDropdown").style.display = "block";
        document.getElementById("channelDropdownContainer").style.display = "none";
    }
});

async function loadChannels() {
    const resp = await fetch("https://avdp.johnnychillx.com/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            communityId: config.communityID,
            communityKey: config.communityKey
        })
    });

    const data = await resp.json();
    if (!data.channels) return;

    const container = document.getElementById("channelsDropdown");
    container.innerHTML = "";

    data.channels.forEach(ch => {
        const lbl = document.createElement("label");
        lbl.innerHTML = `
            <input type="checkbox" value="${ch.id}" data-group="${ch.groupId}">
            ${ch.displayName} (Grp ${ch.groupId})
        `;
        container.appendChild(lbl);
    });
}


// Load YAML
async function loadFromFile() {
    const file = document.getElementById("yamlFile").files[0];
    if (!file) return alert("Select a file!");
    const text = await file.text();
    document.getElementById("yamlInput").value = text;
    buildForm();
}

// Build form dynamically from YAML
function buildForm() {
    config = jsyaml.load(document.getElementById("yamlInput").value);
    const container = document.getElementById("dynamicForm");
    container.innerHTML = "";

    // --- build your fields as before ---
    config.fields.forEach(field => {
        const label = document.createElement("div");
        label.className = "field-label";
        label.innerText = field.name;
        container.appendChild(label);

        if (field.type === "TextBox") {
            const input = document.createElement("input");
            input.type = "text";
            input.dataset.fieldName = field.name;
            container.appendChild(input);
        }

        if (field.type === "Dropdown") {
            if (field.multiple) {
                const wrapper = document.createElement("div");
                wrapper.className = "checkbox-group";
                field.options.forEach(op => {
                    const lbl = document.createElement("label");
                    lbl.innerHTML = `<input type="checkbox" value="${op}" data-field-name="${field.name}"> ${op}`;
                    wrapper.appendChild(lbl);
                });
                container.appendChild(wrapper);
            } else {
                const select = document.createElement("select");
                select.dataset.fieldName = field.name;
                field.options.forEach(op => {
                    const o = document.createElement("option");
                    o.textContent = op;
                    select.appendChild(o);
                });
                container.appendChild(select);
            }
        }
    });

    // --- build speakers ---
    if (config.Speakers && config.Speakers.length) {
        const label = document.createElement("div");
        label.className = "field-label";
        label.innerText = "Speakers";
        container.appendChild(label);

        const wrapper = document.createElement("div");
        wrapper.className = "checkbox-group";
        wrapper.id = "speakersDropdown";

        config.Speakers.forEach(speaker => {
            const lbl = document.createElement("label");
            lbl.innerHTML = `<input type="checkbox" value="${speaker.id}" data-label="${speaker.label}"> ${speaker.label}`;
            wrapper.appendChild(lbl);
        });

        container.appendChild(wrapper);
    }

    // --- Attach postal features AFTER form exists ---
    attachPostalLookup();
    attachPostalAutocomplete();
}



function attachPostalAutocomplete() {
    const addressInput = document.querySelector('input[data-field-name="Address"]');
    let postalInput = document.querySelector('input[data-field-name="Postal"]');

    if (!postalInput) {
        postalInput = document.createElement("input");
        postalInput.type = "text";
        postalInput.dataset.fieldName = "Postal";
        postalInput.placeholder = "Postal Code";
        addressInput.parentNode.insertBefore(postalInput, addressInput);
    }

    let suggestionBox = document.createElement("div");
    suggestionBox.className = "postal-suggestions";
    suggestionBox.style.position = "absolute";
    suggestionBox.style.border = "1px solid #ccc";
    suggestionBox.style.background = "#fff";
    suggestionBox.style.zIndex = "999";
    suggestionBox.style.maxHeight = "200px";
    suggestionBox.style.overflowY = "auto";
    suggestionBox.style.display = "none";
    addressInput.parentNode.appendChild(suggestionBox);

    addressInput.addEventListener("input", () => {
        const val = addressInput.value.trim();
        suggestionBox.innerHTML = "";

        if (!val) {
            suggestionBox.style.display = "none";
            return;
        }

        const suggestions = Object.keys(postalCache)
            .filter(p => p.toLowerCase().startsWith(val.toLowerCase()))
            .slice(0, 10);

        suggestions.forEach(key => {
            const entry = postalCache[key];
            const item = document.createElement("div");
            item.textContent = `${entry.postal} - ${entry.street}${entry.cross ? " / " + entry.cross : ""}`;
            item.style.padding = "4px 6px";
            item.style.cursor = "pointer";

            item.addEventListener("click", () => {
                // **Set both Address and Postal dataset values**
                addressInput.value = entry.street;
                addressInput.dataset.postal = entry.postal;
                addressInput.dataset.street = entry.street;
                addressInput.dataset.cross = entry.cross || "";
                postalInput.value = entry.postal; // update the Postal field too
                suggestionBox.style.display = "none";
            });

            suggestionBox.appendChild(item);
        });

        if (suggestions.length) suggestionBox.style.display = "block";
    });
}


function attachPostalLookup() {
    const postalInput = document.querySelector('input[data-field-name="Postal"]');
    const addressInput = document.querySelector('input[data-field-name="Address"]');
    if (!postalInput || !addressInput || !postalCache) return;

    postalInput.addEventListener("blur", () => {
        const postal = postalInput.value.trim();
        const entry = postalCache[postal];
        if (!entry) return;

        const street = entry.street || "";
        const cross = entry.cross ? entry.cross.join(" and ") : "";
        addressInput.value = cross ? `${street}, cross of ${cross}` : street;
    });
}

// Get selected speakers
function getSelectedSpeakers() {
    const checkboxes = [...document.querySelectorAll('#speakersDropdown input[type=checkbox]:checked')];
    return checkboxes.map(cb => ({ id: cb.value, label: cb.dataset.label }));
}
function getSelectedChannels() {
    const checkboxes = [...document.querySelectorAll('#channelsDropdown input[type=checkbox]:checked')];
    return checkboxes.map(cb => ({
        id: Number(cb.value),
        group: Number(cb.dataset.group),
        label: cb.parentElement.textContent.trim()
    }));
}


// Reset form
function resetForm() {
    document.querySelectorAll("input[type=text]").forEach(i => i.value = "");
    document.querySelectorAll("input[type=checkbox]").forEach(i => i.checked = false);
}

// Build dispatch text
function buildText() {
    const firstPass = ["Departments", "Call Type", "Address", "Cross Street"];
    const secondPass = ["Departments", "Call Type", "Address", "Cross Street", "Channel"];

    let outputBlocks = [];
    const totalEntries = 2; // For demo or dynamic

    for (let i = 0; i < totalEntries; i++) {
        const pattern = i === 0 ? firstPass : secondPass;
        let block = [];

        pattern.forEach(fieldName => {
            const field = config.fields.find(f => f.name === fieldName);
            if (!field) return;

            let value = "";

            // Grab user input
            if (field.type === "TextBox") {
                const input = document.querySelector(`input[data-field-name="${field.name}"]`);
                if (input) value = input.value;
            }

            if (field.type === "Dropdown") {
                if (field.multiple) {
                    const boxes = [...document.querySelectorAll(
                        `input[type=checkbox][data-field-name="${field.name}"]:checked`
                    )];
                    value = boxes.map(b => b.value).join(", ");
                } else {
                    const select = document.querySelector(`select[data-field-name="${field.name}"]`);
                    if (select) value = select.value;
                }
            }

            // Inject postal enrichment if Address field
if (fieldName === "Address") {
    const addressInput = document.querySelector('input[data-field-name="Address"]');
    const postalInput = document.querySelector('input[data-field-name="Postal"]');

    if (addressInput) {
        const parts = [];

        // Postal first
        if (addressInput.dataset.postal) parts.push(addressInput.dataset.postal);
        else if (postalInput?.value) parts.push(postalInput.value);

        // Street: dataset.street or the actual input value
        if (addressInput.dataset.street) parts.push(addressInput.dataset.street);
        else if (addressInput.value) parts.push(addressInput.value);

        // Cross street
        if (addressInput.dataset.cross) parts.push(`at ${addressInput.dataset.cross}`);

        value = parts.join(", ");
    }
}




            if (value) {
                const spoken = field.includeFieldName && field.saidName
                    ? `${field.saidName}, ${value}`
                    : value;
                block.push(spoken);
            }
        });

        if (i === 1) {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, "0");
            const minutes = String(now.getMinutes()).padStart(2, "0");
            const localTime = `${hours}:${minutes}`;
            block.push(`timeout, ${localTime}`);
        }
        
        outputBlocks.push(block.join(", "));
    }

    return outputBlocks.join(", ");
}

// Get speaker data from backend for debug mode
async function fetchSpeakers() {
    if (!config?.communityID) {
        console.error("No communityID in YAML");
        return [];
    }

    try {
        const resp = await fetch("https://avdp.johnnychillx.com/speakers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        communityId: config.communityID,
        ssoAccount: config.ssoAccount,
        ssoToken: config.ssoToken
    })
});

        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(errText);
        }

        const data = await resp.json();

        if (debugMode) {
            console.log("Fetched speakers:", data);
            const debugBox = document.getElementById("debugOutput");
            debugBox.style.display = "block";
            debugBox.innerHTML = data.map(s => `ID: ${s.id} | Label: ${s.label} | Group: ${s.group || "N/A"}`).join("<br>");
        }

        return data;
    } catch (err) {
        console.error("Error fetching speakers:", err);
        if (debugMode) {
            const debugBox = document.getElementById("debugOutput");
            debugBox.style.display = "block";
            debugBox.innerHTML = "Error fetching speakers: " + err.message;
        }
        return [];
    }
}

async function showDebugSpeakers() {
    const speakers = await fetchSpeakers();
    if (!speakers.length) alert("No speakers found!");
}

function getSelectedDepartments() {
    return [...document.querySelectorAll(
        `input[type=checkbox][data-field-name="Departments"]:checked`
    )].map(cb => cb.value);
}



// Generate Murf audio
async function generateMurfAudio(text) {
    const apiKey = config?.murfApiKey;
    if (!apiKey) throw new Error("No Murf API key in YAML!");
    const resp = await fetch("https://api.murf.ai/v1/speech/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": apiKey },
        body: JSON.stringify({
            voiceId: "en-US-charlotte",
            style: "Narration",
            text,
            rate: 0,
            pitch: 0,
            sampleRate: 8000,
            format: "WAV",
            channelType: "MONO",
            encodeAsBase64: false
        })
    });
    const data = await resp.json();
    if (!data.audioFile) throw new Error("Murf TTS failed!");
    return data.audioFile;
}

// Send to local server proxy
async function sendToSonoran(audioUrl, targets, mode) {
    const resp = await fetch("https://avdp.johnnychillx.com/send_dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            communityId: config.communityID,
            communityKey: config.communityKey,
            ssoAccount: config.ssoAccount,
            ssoToken: config.ssoToken,
            speakers: targets,
            serverId: config.serverId,
            roomId: config.roomId,  
            audioUrl,
            mode // <── NEW
        })
    });

    const data = await resp.json();
    console.log("Proxy Response:", data);
}

async function sendDispatch() {
    try {
        const text = buildText();
        if (!text) return alert("No text generated!");

        // --- Call Type --- later push notification stuff
        const callTypeInput = document.querySelector(`select[data-field-name="Call Type"]`);
        const callType = callTypeInput?.value || "Dispatch";

        // --- Postal & Address (DECLARE ONCE) ---
        const postalInput = document.querySelector('input[data-field-name="Postal"]');
        const addressInput = document.querySelector('input[data-field-name="Address"]');

        const postal = postalInput?.value || "";
        const address =
            addressInput?.dataset.street ||
            addressInput?.value ||
            "";

        // --- Units (Departments only) ---
        const units = getSelectedDepartments();


        // --- Audio routing logic ---
        const mode = document.getElementById("transmitMode").value;

        let targets = [];
        if (mode === "speaker") {
            targets = getSelectedSpeakers();
        } else {
            targets = getSelectedChannels();
        }

        if (!targets.length) return alert("Select at least one target!");

        // STEP 1: Tone
        let toneFile = null;

        if (mode === "speaker") {
            const firstSpeaker = config.Speakers.find(s => s.id === targets[0].id);
            if (firstSpeaker) toneFile = firstSpeaker.tone;
        } else {
            if (config.Speakers && config.Speakers.length) {
                toneFile = config.Speakers[0].tone;
            }
        }

        if (toneFile) {
            const toneUrl = `https://avdp.johnnychillx.com/audio/${toneFile}`;
            await sendToSonoran(toneUrl, targets, mode, postal, address);
        }

        // STEP 2: Voice (TTS)
        const murfUrl = await generateMurfAudio(text);
        await new Promise(resolve => setTimeout(resolve, 4200));

        await sendToSonoran(murfUrl, targets, mode, postal, address);

    } catch (err) {
        console.error(err);
        alert("Error: " + err.message);
    }
}

