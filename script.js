// Presets for different alert types
const alertPresets = {
    fire: { id: "ALT-F-992", severity: "High", location: "Downtown Sector 4", timestamp: new Date().toISOString(), message: "Large structural fire detected. Evacuate immediately." },
    flood: { id: "ALT-W-104", severity: "Critical", location: "Riverbank Zone", timestamp: new Date().toISOString(), message: "Levee breach imminent. Move to higher ground." },
    earthquake: { id: "ALT-E-773", severity: "High", location: "Fault Line Alpha", timestamp: new Date().toISOString(), message: "Magnitude 6.4 tremor detected. Aftershocks expected." },
    cyclone: { id: "ALT-C-552", severity: "Medium", location: "Coastal Region", timestamp: new Date().toISOString(), message: "Category 3 cyclone approaching. Secure premises." },
    medical: { id: "ALT-M-221", severity: "High", location: "City Hospital", timestamp: new Date().toISOString(), message: "Mass casualty incident. All units respond." }
};

// Generate CRC Table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
        c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    crcTable[n] = c;
}

// Calculate CRC-32 on Uint8Array
function calculateCRC32(bytes) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < bytes.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
}

// Utility functions
function stringToBytes(str) {
    return new TextEncoder().encode(str);
}

function bytesToBinaryStr(bytes) {
    return Array.from(bytes).map(b => b.toString(2).padStart(8, '0')).join('');
}

function binaryStrToBytes(binStr) {
    let bytes = [];
    for (let i = 0; i < binStr.length; i += 8) {
        bytes.push(parseInt(binStr.substr(i, 8), 2));
    }
    return new Uint8Array(bytes);
}

function uint32ToBinaryStr(num) {
    return num.toString(2).padStart(32, '0');
}

function uint32ToHexStr(num) {
    return "0x" + num.toString(16).padStart(8, '0').toUpperCase();
}

function toggleAccordion(btn) {
    btn.classList.toggle("active");
    let content = btn.nextElementSibling;
    if (content.classList.contains("show")) {
        content.classList.remove("show");
    } else {
        content.classList.add("show");
    }
}

function loadPreset() {
    const type = document.getElementById('alertType').value;
    if (type === 'custom') {
        document.getElementById('alertId').value = '';
        document.getElementById('location').value = '';
        document.getElementById('timestamp').value = new Date().toISOString();
        document.getElementById('message').value = '';
        return;
    }
    
    const preset = alertPresets[type];
    document.getElementById('alertId').value = preset.id;
    document.getElementById('severity').value = preset.severity;
    document.getElementById('location').value = preset.location;
    document.getElementById('timestamp').value = preset.timestamp;
    document.getElementById('message').value = preset.message;
}

// Initialize toggle logic
document.getElementById('errorToggle').addEventListener('change', function(e) {
    document.getElementById('errorBitIndex').disabled = !e.target.checked;
});

// Setup on load
window.onload = () => {
    loadPreset();
};

async function startSimulation() {
    // 1. Get Data
    const dataObj = {
        id: document.getElementById('alertId').value,
        severity: document.getElementById('severity').value,
        location: document.getElementById('location').value,
        timestamp: document.getElementById('timestamp').value,
        message: document.getElementById('message').value
    };
    
    const jsonStr = JSON.stringify(dataObj);
    document.getElementById('displayOriginalData').textContent = JSON.stringify(dataObj, null, 2);
    
    // 2. Binary Conversion
    const bytes = stringToBytes(jsonStr);
    const dataBinStr = bytesToBinaryStr(bytes);
    document.getElementById('displayBinaryData').textContent = dataBinStr;
    
    // 3. CRC Generation
    const crcVal = calculateCRC32(bytes);
    const crcHex = uint32ToHexStr(crcVal);
    const crcBin = uint32ToBinaryStr(crcVal);
    
    document.getElementById('displaySenderCrcHex').textContent = crcHex;
    document.getElementById('displaySenderCrcBin').textContent = crcBin;
    
    // 4. Transmitted Packet
    const packetStr = dataBinStr + crcBin;
    const packetDisplay = `<span class="data-part">${dataBinStr}</span><span class="crc-part">${crcBin}</span>`;
    document.getElementById('displayTransmittedPacket').innerHTML = packetDisplay;
    
    // Determine Error
    const simulateError = document.getElementById('errorToggle').checked;
    let corruptedPacket = packetStr;
    let errorIdx = -1;
    
    if (simulateError) {
        let bitIndexInput = document.getElementById('errorBitIndex').value;
        if (bitIndexInput !== "" && !isNaN(bitIndexInput)) {
            errorIdx = parseInt(bitIndexInput);
        } else {
            errorIdx = Math.floor(Math.random() * packetStr.length);
            document.getElementById('errorBitIndex').value = errorIdx;
        }
        
        if (errorIdx >= 0 && errorIdx < packetStr.length) {
            let arr = corruptedPacket.split('');
            arr[errorIdx] = arr[errorIdx] === '0' ? '1' : '0';
            corruptedPacket = arr.join('');
        }
    }
    
    // Reset Receiver UI
    document.getElementById('displayReceivedPacket').innerHTML = "Receiving...";
    document.getElementById('displayReceivedCrc').textContent = "-";
    document.getElementById('displayRecalculatedCrc').textContent = "-";
    
    const finalBox = document.getElementById('finalResultBox');
    finalBox.className = "final-result-box";
    document.getElementById('resultIcon').className = "fas fa-spinner fa-spin";
    document.getElementById('resultIcon').style.display = "inline-block";
    document.getElementById('resultText').textContent = "Status: Transmitting...";
    document.getElementById('resultDesc').textContent = "Packet is traveling through the network.";
    
    // Start Animation
    const packetEl = await playAnimation(packetStr, corruptedPacket, simulateError);
    
    // Post Animation: Receiver side logic
    const receivedDataBin = corruptedPacket.slice(0, -32);
    const receivedCrcBin = corruptedPacket.slice(-32);
    
    // Format Display
    let formattedReceived = "";
    if (simulateError && errorIdx >= 0 && errorIdx < corruptedPacket.length) {
        const p1 = corruptedPacket.slice(0, errorIdx);
        const p2 = corruptedPacket.slice(errorIdx + 1);
        const badBit = corruptedPacket[errorIdx];
        formattedReceived = `${p1}<span class="bit-corrupted" title="Corrupted Bit">${badBit}</span>${p2}`;
    } else {
        formattedReceived = `<span class="data-part">${receivedDataBin}</span><span class="crc-part">${receivedCrcBin}</span>`;
    }
    document.getElementById('displayReceivedPacket').innerHTML = formattedReceived;
    
    // Recalculate CRC
    const receivedBytes = binaryStrToBytes(receivedDataBin);
    const recalculatedCrcVal = calculateCRC32(receivedBytes);
    const recalculatedCrcHex = uint32ToHexStr(recalculatedCrcVal);
    const receivedCrcHex = uint32ToHexStr(parseInt(receivedCrcBin, 2));
    
    document.getElementById('displayReceivedCrc').textContent = receivedCrcHex;
    document.getElementById('displayRecalculatedCrc').textContent = recalculatedCrcHex;
    
    // Final Decision
    document.getElementById('resultIcon').style.display = "inline-block";
    const receiverNode = document.querySelector('.node.receiver');
    receiverNode.classList.remove('success', 'error');
    
    if (receivedCrcHex === recalculatedCrcHex) {
        finalBox.className = "final-result-box success";
        document.getElementById('resultIcon').className = "fas fa-check-circle";
        document.getElementById('resultText').textContent = "Status: ACCEPT";
        document.getElementById('resultDesc').textContent = "CRCs match. Data integrity verified. Packet accepted.";
        receiverNode.classList.add('success');
        packetEl.style.borderColor = "#10b981";
        packetEl.style.boxShadow = "0 0 15px #10b981";
        packetEl.style.color = "#10b981";
    } else {
        finalBox.className = "final-result-box error";
        document.getElementById('resultIcon').className = "fas fa-times-circle";
        document.getElementById('resultText').textContent = "Status: REJECT";
        document.getElementById('resultDesc').textContent = "CRCs do not match! Data corruption detected. Packet rejected.";
        receiverNode.classList.add('error');
        packetEl.style.borderColor = "#ef4444";
        packetEl.style.boxShadow = "0 0 15px #ef4444";
        packetEl.style.color = "#ef4444";
    }
    
    // Fade out and remove packet
    packetEl.style.transition = "all 0.5s ease, opacity 1s ease 3s"; 
    packetEl.style.opacity = '0';
    setTimeout(() => {
        if (packetEl.parentNode) packetEl.remove();
        receiverNode.classList.remove('success', 'error');
    }, 4000);
    
    // Auto-scroll to receiver panel
    document.getElementById('receiverPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function playAnimation(packetStr, corruptedPacket, isError) {
    return new Promise(resolve => {
        const stream = document.getElementById('dataStream');
        const strike = document.getElementById('errorStrike');
        
        // Create packet element
        const packetEl = document.createElement('div');
        packetEl.className = 'packet-anim';
        
        // Display a small preview of the packet using actual data
        let previewText = packetStr;
        if (packetStr.length > 30) {
            previewText = packetStr.substring(0, 12) + '...' + packetStr.substring(packetStr.length - 8);
        }
        packetEl.textContent = previewText;
        
        stream.appendChild(packetEl);
        
        // Animate
        setTimeout(() => {
            packetEl.style.left = "calc(100% + 50px)";
        }, 50);
        
        if (isError) {
            setTimeout(() => {
                strike.classList.remove('hidden');
                packetEl.classList.add('corrupted');
                
                let errPreview = corruptedPacket;
                if (corruptedPacket.length > 30) {
                    errPreview = corruptedPacket.substring(0, 12) + '...' + corruptedPacket.substring(corruptedPacket.length - 8);
                }
                packetEl.innerHTML = `<span style="color: #ef4444; font-weight: bold;">[ERR]</span> ${errPreview}`;
                
                setTimeout(() => {
                    strike.classList.add('hidden');
                }, 500);
            }, 1500); // Trigger midway
        }
        
        setTimeout(() => {
            resolve(packetEl);
        }, 3000); // 3 seconds transmission
    });
}
