/*
 * =========================================================================
 * ESP32 Web Server: HC-SR04 Ultrasonic & DHT11 Sensor System
 * 
 * Features:
 *  - Serves real-time JSON API at /data (CORS enabled for external web pages)
 *  - Serves complete web dashboard directly at http://<ESP32_IP>/
 *  - Non-blocking sensor reading (no delay() freezing the web server)
 * 
 * Wiring:
 *  - DHT11 Data Pin -> GPIO 4
 *  - HC-SR04 TRIG   -> GPIO 5
 *  - HC-SR04 ECHO   -> GPIO 18
 * =========================================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <DHT.h>

// --------------------------------------------------
// Wi-Fi Credentials (CHANGE THESE TO MATCH YOUR NETWORK)
// --------------------------------------------------
const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// --------------------------------------------------
// Pin Configurations (Matching your setup)
// --------------------------------------------------
#define DHT_PIN 4
#define DHT_TYPE DHT11

#define TRIG_PIN 5
#define ECHO_PIN 18

// Initialize Sensors & Server
DHT dht(DHT_PIN, DHT_TYPE);
WebServer server(80);

// Global Variables to store readings
float temperature = 0.0;
float humidity    = 0.0;
float distance    = 0.0;
bool dhtError     = false;

// Timing interval (Non-blocking: reads sensors every 2000 ms)
unsigned long previousMillis = 0;
const long readInterval = 2000;

// --------------------------------------------------
// Embedded Web Page (Served directly from ESP32 Flash)
// --------------------------------------------------
const char INDEX_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ESP32 Sensor Monitor</title>
  <style>
    :root {
      --bg: #0b0f19; --card: #17223b; --border: #243456;
      --text: #f1f5f9; --muted: #94a3b8;
    }
    * { margin:0; padding:0; box-sizing:border-box; font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 20px; display: flex; justify-content: center; }
    .container { width: 100%; max-width: 900px; display: flex; flex-direction: column; gap: 20px; }
    header { background: #131b2e; border: 1px solid var(--border); padding: 20px; border-radius: 14px; display: flex; justify-content: space-between; align-items: center; }
    h1 { font-size: 1.3rem; }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; background: rgba(16,185,129,0.15); color: #34d399; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 20px; position: relative; overflow: hidden; }
    .card::before { content:''; position:absolute; top:0; left:0; width:100%; height:4px; }
    .card-temp::before { background: #f97316; }
    .card-hum::before { background: #06b6d4; }
    .card-dist::before { background: #10b981; }
    .card-title { font-size: 0.85rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
    .card-val { font-size: 2.8rem; font-weight: 700; font-family: monospace; display: flex; align-items: baseline; gap: 6px; }
    .card-val span { font-size: 1.2rem; color: var(--muted); font-weight: 400; }
    .progress-bg { height: 6px; background: rgba(0,0,0,0.3); border-radius: 3px; margin: 16px 0 10px 0; overflow: hidden; }
    .progress-bar { height: 100%; transition: width 0.3s; }
    .bar-temp { background: linear-gradient(90deg, #f97316, #ef4444); }
    .bar-hum { background: linear-gradient(90deg, #06b6d4, #3b82f6); }
    .bar-dist { background: linear-gradient(90deg, #10b981, #06b6d4); }
    .sub-text { font-size: 0.8rem; color: var(--muted); }
    .tag { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-top: 6px; }
    .tag-danger { background: rgba(239,68,68,0.2); color: #f87171; }
    .tag-warning { background: rgba(245,158,11,0.2); color: #fbbf24; }
    .tag-safe { background: rgba(16,185,129,0.2); color: #34d399; }
    footer { font-size: 0.8rem; color: var(--muted); text-align: center; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>ESP32 Live Sensor Monitor</h1>
        <p style="font-size:0.8rem; color:#94a3b8; margin-top:4px;">DHT11 + HC-SR04 Ultrasonic</p>
      </div>
      <div class="badge"><span class="dot"></span> Online</div>
    </header>

    <div class="grid">
      <!-- Temperature -->
      <div class="card card-temp">
        <div class="card-title">Temperature (DHT11)</div>
        <div class="card-val"><span id="temp">--</span><span>°C</span></div>
        <div class="progress-bg"><div id="tempBar" class="progress-bar bar-temp" style="width:0%"></div></div>
        <div class="sub-text">Status: <strong id="tempStatus">Normal</strong></div>
      </div>

      <!-- Humidity -->
      <div class="card card-hum">
        <div class="card-title">Humidity (DHT11)</div>
        <div class="card-val"><span id="hum">--</span><span>%</span></div>
        <div class="progress-bg"><div id="humBar" class="progress-bar bar-hum" style="width:0%"></div></div>
        <div class="sub-text">Comfort: <strong id="humStatus">--</strong></div>
      </div>

      <!-- Ultrasonic Distance -->
      <div class="card card-dist">
        <div class="card-title">Distance (HC-SR04)</div>
        <div class="card-val"><span id="dist">--</span><span>cm</span></div>
        <div class="progress-bg"><div id="distBar" class="progress-bar bar-dist" style="width:0%"></div></div>
        <div id="distAlert"><span class="tag tag-safe">Safe Distance</span></div>
      </div>
    </div>

    <footer>
      Last updated: <span id="time">--</span> &bull; Auto-refreshing every 2s
    </footer>
  </div>

  <script>
    async function updateData() {
      try {
        const res = await fetch('/data');
        if (!res.ok) return;
        const d = await res.json();

        // Update Temperature
        if (d.temperature !== null) {
          document.getElementById('temp').innerText = d.temperature.toFixed(1);
          document.getElementById('tempBar').style.width = Math.min(100, Math.max(0, (d.temperature / 50) * 100)) + '%';
          document.getElementById('tempStatus').innerText = d.temperature > 32 ? 'High' : (d.temperature < 18 ? 'Cool' : 'Optimal');
        }

        // Update Humidity
        if (d.humidity !== null) {
          document.getElementById('hum').innerText = Math.round(d.humidity);
          document.getElementById('humBar').style.width = Math.min(100, Math.max(0, d.humidity)) + '%';
          document.getElementById('humStatus').innerText = d.humidity > 60 ? 'Humid' : (d.humidity < 30 ? 'Dry' : 'Comfortable');
        }

        // Update Distance
        if (d.distance !== null && d.distance > 0) {
          document.getElementById('dist').innerText = d.distance.toFixed(1);
          document.getElementById('distBar').style.width = Math.min(100, Math.max(0, (d.distance / 150) * 100)) + '%';
          
          let alertHtml = '';
          if (d.distance < 10) {
            alertHtml = '<span class="tag tag-danger">CRITICAL: Close (< 10cm)</span>';
          } else if (d.distance < 30) {
            alertHtml = '<span class="tag tag-warning">WARNING: Nearby (< 30cm)</span>';
          } else {
            alertHtml = '<span class="tag tag-safe">CLEAR (> 30cm)</span>';
          }
          document.getElementById('distAlert').innerHTML = alertHtml;
        } else {
          document.getElementById('dist').innerText = 'Out';
          document.getElementById('distBar').style.width = '0%';
          document.getElementById('distAlert').innerHTML = '<span class="tag">Out of range</span>';
        }

        document.getElementById('time').innerText = new Date().toLocaleTimeString();
      } catch (e) {
        console.error("Fetch error:", e);
      }
    }

    setInterval(updateData, 2000);
    updateData();
  </script>
</body>
</html>
)rawliteral";

// --------------------------------------------------
// Read Ultrasonic Distance Helper
// --------------------------------------------------
float readUltrasonicDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout (max ~5 meters)
  if (duration == 0) {
    return -1.0; // Out of range or no echo
  }
  return (duration * 0.0343) / 2.0;
}

// --------------------------------------------------
// HTTP Handler: Root (Serves Web Dashboard)
// --------------------------------------------------
void handleRoot() {
  server.send(200, "text/html", INDEX_HTML);
}

// --------------------------------------------------
// HTTP Handler: /data (JSON REST API with CORS)
// --------------------------------------------------
void handleData() {
  // Allow requests from any origin (e.g. index.html running locally on PC)
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "*");

  String json = "{";
  
  if (dhtError) {
    json += "\"temperature\": null, \"humidity\": null, ";
  } else {
    json += "\"temperature\": " + String(temperature, 1) + ", ";
    json += "\"humidity\": " + String(humidity, 1) + ", ";
  }

  if (distance < 0) {
    json += "\"distance\": null";
  } else {
    json += "\"distance\": " + String(distance, 1);
  }

  json += "}";

  server.send(200, "application/json", json);
}

// --------------------------------------------------
// Setup
// --------------------------------------------------
void setup() {
  Serial.begin(115200);

  // Initialize DHT
  dht.begin();

  // Initialize Ultrasonic Pins
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);

  Serial.println();
  Serial.println("=================================");
  Serial.println(" ESP32 SENSOR WEB SERVER");
  Serial.println("=================================");

  // Connect to Wi-Fi
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[+] Wi-Fi Connected!");
    Serial.print("[+] ESP32 IP Address: http://");
    Serial.println(WiFi.localIP());
    Serial.println("[+] Open the link above in any browser on your network!");
  } else {
    Serial.println("\n[-] Wi-Fi connection timed out. Please check SSID & Password.");
    Serial.println("    You can still test offline or setup Access Point mode.");
  }

  // Define HTTP routes
  server.on("/", HTTP_GET, handleRoot);
  server.on("/data", HTTP_GET, handleData);

  // Start HTTP server
  server.begin();
  Serial.println("[+] HTTP server started on port 80");
  Serial.println("---------------------------------");
}

// --------------------------------------------------
// Main Loop
// --------------------------------------------------
void loop() {
  // Always handle incoming web client requests immediately
  server.handleClient();

  // Non-blocking sensor reading every 2 seconds
  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= readInterval) {
    previousMillis = currentMillis;

    // 1. Read DHT11
    float h = dht.readHumidity();
    float t = dht.readTemperature();

    if (isnan(h) || isnan(t)) {
      dhtError = true;
      Serial.println("[!] ERROR: Failed to read DHT11");
    } else {
      dhtError = false;
      humidity = h;
      temperature = t;
      Serial.print("Temp: ");
      Serial.print(temperature);
      Serial.print(" °C | Hum: ");
      Serial.print(humidity);
      Serial.println(" %");
    }

    // 2. Read HC-SR04
    distance = readUltrasonicDistance();
    if (distance < 0) {
      Serial.println("Distance: Out of range / No echo");
    } else {
      Serial.print("Distance: ");
      Serial.print(distance);
      Serial.println(" cm");
    }

    Serial.println("---------------------------------");
  }
}
