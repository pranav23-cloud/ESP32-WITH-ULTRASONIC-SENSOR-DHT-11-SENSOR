# ESP32 Sensor Web Interface (DHT11 + HC-SR04)

A modern, responsive, real-time web interface for an ESP32 reading **HC-SR04 Ultrasonic Distance** and **DHT11 Temperature & Humidity** sensors.

---

## 📁 Project Files

| File | Description |
|---|---|
| [`index.html`](index.html) | Standalone dashboard interface with metric gauges, proximity alert badges, and real-time history chart. |
| [`style.css`](style.css) | Dark-mode glassmorphic styling, responsive grid, dynamic progress indicators, and smooth animations. |
| [`app.js`](app.js) | Frontend logic: live polling, HTML5 canvas real-time telemetry chart, demo simulation mode, and IP switcher. |
| [`esp32_sensor_webserver.ino`](esp32_sensor_webserver.ino) | Arduino code with Wi-Fi, non-blocking sensor loop (`millis()`), JSON REST endpoint (`/data`) with CORS, and embedded dashboard (`/`). |

---

## 🚀 Quick Start Guide

### Step 1: Flash the ESP32 Code
1. Open [`esp32_sensor_webserver.ino`](esp32_sensor_webserver.ino) in the **Arduino IDE**.
2. Update your Wi-Fi credentials around line 25:
   ```cpp
   const char* ssid     = "YOUR_WIFI_NAME";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```
3. Connect your ESP32 via USB and select your board (`ESP32 Dev Module`) and COM Port.
4. Click **Upload**.

---

### Step 2: Find the ESP32 IP Address
1. Open the **Serial Monitor** in Arduino IDE (`Ctrl + Shift + M`).
2. Set the baud rate to **115200**.
3. Once connected, the ESP32 will output:
   ```text
   [+] Wi-Fi Connected!
   [+] ESP32 IP Address: http://192.168.1.105
   [+] Open the link above in any browser on your network!
   ```

---

### Step 3: Open the Web Interface

You have **two options** to view the dashboard:

#### Option A: Direct from ESP32 (No PC server needed!)
Open any browser on your phone, tablet, or PC connected to the same Wi-Fi and navigate to:
```
http://<YOUR_ESP32_IP>
```
*(Example: `http://192.168.1.105`)*

#### Option B: Open `index.html` Locally
1. Double-click [`index.html`](index.html) to open it in Chrome, Edge, or Firefox.
2. Click the **Gear / Settings icon (⚙️)** in the top right.
3. Enter your ESP32's IP address (e.g. `192.168.1.105`) and click **Connect**.
4. You can also click **"Simulate Demo Data"** anytime to test the animations, chart, and alert thresholds without hardware!

---

## 📌 Pinout Reference

| Sensor | Sensor Pin | ESP32 GPIO | Notes |
|---|---|---|---|
| **DHT11** | VCC | 3.3V or 5V | |
| **DHT11** | GND | GND | |
| **DHT11** | DATA / OUT | **GPIO 4** | 10k pull-up resistor if bare sensor |
| **HC-SR04**| VCC | 5V (VIN) | HC-SR04 requires 5V |
| **HC-SR04**| GND | GND | |
| **HC-SR04**| TRIG | **GPIO 5** | Trigger pulse output |
| **HC-SR04**| ECHO | **GPIO 18** | Echo pulse input |

---

## 🌟 Key Features
- **Non-blocking Execution**: Uses `millis()` timing so HTTP web requests never experience lag or timeout.
- **Proximity Alerts**:
  - 🟢 **Safe / Clear**: Distance > 30 cm
  - 🟡 **Warning**: Distance 10 cm - 30 cm
  - 🔴 **Collision Risk / Critical**: Distance < 10 cm
- **Live Canvas Telemetry**: Rolling chart graphing distance, temperature, and humidity history without external dependencies.
- **CORS Enabled**: The `/data` REST API includes `Access-Control-Allow-Origin: *`, allowing external apps or local files to consume sensor readings.
