/**
 * ESP32 Sensor Dashboard
 * Real-time monitoring for HC-SR04 & DHT11
 */

// Application State
const state = {
  espIp: localStorage.getItem('esp32_ip') || (window.location.hostname && window.location.hostname !== '' && window.location.hostname !== 'localhost' && window.location.protocol.startsWith('http') ? window.location.host : '192.168.1.100'),
  pollInterval: 2000,
  pollTimer: null,
  isDemoMode: false,
  activeChartChannel: 'distance', // 'distance', 'temperature', 'humidity'
  minTemp: null,
  maxTemp: null,
  history: {
    labels: [],
    temperature: [],
    humidity: [],
    distance: []
  },
  maxHistoryPoints: 25
};

// DOM Elements
const el = {
  connectionStatus: document.getElementById('connectionStatus'),
  statusText: document.getElementById('statusText'),
  configBtn: document.getElementById('configBtn'),
  configPanel: document.getElementById('configPanel'),
  espIpInput: document.getElementById('espIpInput'),
  saveIpBtn: document.getElementById('saveIpBtn'),
  testDemoBtn: document.getElementById('testDemoBtn'),
  demoNotice: document.getElementById('demoNotice'),

  // Metric displays
  tempValue: document.getElementById('tempValue'),
  tempBar: document.getElementById('tempBar'),
  tempMin: document.getElementById('tempMin'),
  tempMax: document.getElementById('tempMax'),
  tempStatus: document.getElementById('tempStatus'),

  humidityValue: document.getElementById('humidityValue'),
  humidityBar: document.getElementById('humidityBar'),
  comfortLevel: document.getElementById('comfortLevel'),
  dewPoint: document.getElementById('dewPoint'),

  distanceValue: document.getElementById('distanceValue'),
  distanceBar: document.getElementById('distanceBar'),
  proximityTag: document.getElementById('proximityTag'),
  proximityAlert: document.getElementById('proximityAlert'),
  distanceInches: document.getElementById('distanceInches'),

  // Controls & Chart
  lastUpdated: document.getElementById('lastUpdated'),
  pollIntervalSelect: document.getElementById('pollIntervalSelect'),
  manualRefreshBtn: document.getElementById('manualRefreshBtn'),
  filterBtns: document.querySelectorAll('.filter-btn'),
  canvas: document.getElementById('liveChart')
};

// Canvas 2D context
const ctx = el.canvas ? el.canvas.getContext('2d') : null;

// ==========================================
// Initialization
// ==========================================
function init() {
  if (el.espIpInput) {
    el.espIpInput.value = state.espIp;
  }

  // Setup Event Listeners
  setupEventListeners();

  // Resize canvas high-DPI support
  resizeCanvas();
  window.addEventListener('resize', () => {
    resizeCanvas();
    drawChart();
  });

  // Start polling
  startPolling();

  // Initial fetch
  fetchData();
}

function setupEventListeners() {
  // Toggle config modal
  el.configBtn.addEventListener('click', () => {
    el.configPanel.classList.toggle('hidden');
  });

  // Save IP
  el.saveIpBtn.addEventListener('click', () => {
    const rawVal = el.espIpInput.value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (rawVal) {
      state.espIp = rawVal;
      localStorage.setItem('esp32_ip', rawVal);
      state.isDemoMode = false;
      el.demoNotice.textContent = '';
      el.configPanel.classList.add('hidden');
      updateStatus('connecting', 'Connecting...');
      fetchData();
    }
  });

  // Demo / Simulation toggle
  el.testDemoBtn.addEventListener('click', () => {
    state.isDemoMode = !state.isDemoMode;
    if (state.isDemoMode) {
      el.demoNotice.textContent = 'Simulating mock sensor data';
      el.testDemoBtn.textContent = 'Stop Simulation';
      updateStatus('online', 'Demo Mode');
      simulateData();
    } else {
      el.demoNotice.textContent = '';
      el.testDemoBtn.textContent = 'Simulate Demo Data';
      updateStatus('connecting', 'Reconnecting...');
      fetchData();
    }
  });

  // Change Polling interval
  el.pollIntervalSelect.addEventListener('change', (e) => {
    state.pollInterval = parseInt(e.target.value, 10);
    startPolling();
  });

  // Manual Refresh
  el.manualRefreshBtn.addEventListener('click', () => {
    if (state.isDemoMode) {
      simulateData();
    } else {
      fetchData();
    }
  });

  // Chart Channel Filters
  el.filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      el.filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeChartChannel = btn.getAttribute('data-channel');
      drawChart();
    });
  });
}

function startPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(() => {
    if (state.isDemoMode) {
      simulateData();
    } else {
      fetchData();
    }
  }, state.pollInterval);
}

// ==========================================
// Network & Data Fetching
// ==========================================
async function fetchData() {
  if (state.isDemoMode) return;

  // Determine Endpoint
  let endpoint = `http://${state.espIp}/data`;
  if (window.location.protocol.startsWith('http') && window.location.host === state.espIp) {
    endpoint = '/data';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2800);

  try {
    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });

    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);

    const data = await res.json();
    handleSensorData(data);
    updateStatus('online', 'Connected');
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('Sensor fetch failed:', err.message);
    updateStatus('offline', 'Offline');
  }
}

// Demo data generator for immediate testing
function simulateData() {
  const mockTemp = (24 + Math.sin(Date.now() / 10000) * 4 + (Math.random() - 0.5) * 0.5).toFixed(1);
  const mockHum = Math.round(52 + Math.cos(Date.now() / 12000) * 8 + (Math.random() - 0.5) * 2);
  const mockDist = Math.max(3, Math.round(35 + Math.sin(Date.now() / 5000) * 30 + (Math.random() - 0.5) * 5));

  handleSensorData({
    temperature: parseFloat(mockTemp),
    humidity: parseFloat(mockHum),
    distance: parseFloat(mockDist)
  });
}

// ==========================================
// Update UI with Sensor Data
// ==========================================
function handleSensorData(data) {
  const { temperature, humidity, distance } = data;

  // 1. Update Temperature
  if (typeof temperature === 'number' && !isNaN(temperature)) {
    el.tempValue.textContent = temperature.toFixed(1);
    
    // Min / Max
    if (state.minTemp === null || temperature < state.minTemp) state.minTemp = temperature;
    if (state.maxTemp === null || temperature > state.maxTemp) state.maxTemp = temperature;
    el.tempMin.textContent = `${state.minTemp.toFixed(1)}°`;
    el.tempMax.textContent = `${state.maxTemp.toFixed(1)}°`;

    // Percentage bar (assuming 0°C to 50°C DHT11 range)
    const tempPct = Math.min(100, Math.max(0, (temperature / 50) * 100));
    el.tempBar.style.width = `${tempPct}%`;

    if (temperature > 32) {
      el.tempStatus.textContent = 'Hot';
      el.tempStatus.style.color = '#ef4444';
    } else if (temperature < 18) {
      el.tempStatus.textContent = 'Cool';
      el.tempStatus.style.color = '#38bdf8';
    } else {
      el.tempStatus.textContent = 'Normal';
      el.tempStatus.style.color = '#34d399';
    }
  } else {
    el.tempValue.textContent = '--';
    el.tempBar.style.width = '0%';
  }

  // 2. Update Humidity
  if (typeof humidity === 'number' && !isNaN(humidity)) {
    el.humidityValue.textContent = Math.round(humidity);
    el.humidityBar.style.width = `${Math.min(100, Math.max(0, humidity))}%`;

    // Comfort calculation
    if (humidity < 30) {
      el.comfortLevel.textContent = 'Dry';
      el.comfortLevel.style.color = '#f59e0b';
    } else if (humidity <= 60) {
      el.comfortLevel.textContent = 'Optimal';
      el.comfortLevel.style.color = '#34d399';
    } else {
      el.comfortLevel.textContent = 'Humid';
      el.comfortLevel.style.color = '#38bdf8';
    }

    // Dew point estimate
    if (typeof temperature === 'number' && !isNaN(temperature)) {
      const dew = (temperature - ((100 - humidity) / 5)).toFixed(1);
      el.dewPoint.textContent = `${dew}°C`;
    }
  } else {
    el.humidityValue.textContent = '--';
    el.humidityBar.style.width = '0%';
  }

  // 3. Update Ultrasonic Distance
  if (typeof distance === 'number' && !isNaN(distance) && distance > 0) {
    el.distanceValue.textContent = distance.toFixed(1);

    // Percentage bar (0 to 150 cm visual scale)
    const distPct = Math.min(100, Math.max(0, (distance / 150) * 100));
    el.distanceBar.style.width = `${distPct}%`;

    // Inches
    const inches = (distance * 0.393701).toFixed(1);
    el.distanceInches.textContent = `${inches} in`;

    // Proximity logic
    if (distance < 10) {
      el.proximityTag.className = 'proximity-tag danger';
      el.proximityTag.textContent = 'CRITICAL: VERY CLOSE (< 10 cm)';
      el.proximityAlert.textContent = 'COLLISION RISK';
      el.proximityAlert.style.color = '#ef4444';
    } else if (distance < 30) {
      el.proximityTag.className = 'proximity-tag warning';
      el.proximityTag.textContent = 'WARNING: OBJECT NEARBY (< 30 cm)';
      el.proximityAlert.textContent = 'Approaching';
      el.proximityAlert.style.color = '#f59e0b';
    } else {
      el.proximityTag.className = 'proximity-tag safe';
      el.proximityTag.textContent = 'CLEAR PATH (> 30 cm)';
      el.proximityAlert.textContent = 'None';
      el.proximityAlert.style.color = '#34d399';
    }
  } else {
    el.distanceValue.textContent = 'Out';
    el.distanceBar.style.width = '0%';
    el.proximityTag.className = 'proximity-tag';
    el.proximityTag.textContent = 'Out of range / No echo';
    el.proximityAlert.textContent = 'Out of range';
    el.proximityAlert.style.color = '#94a3b8';
    el.distanceInches.textContent = '--';
  }

  // 4. Update Time
  const now = new Date();
  el.lastUpdated.textContent = now.toLocaleTimeString();

  // 5. Append to history for chart
  const timeLabel = `${now.getMinutes()}:${now.getSeconds() < 10 ? '0' : ''}${now.getSeconds()}`;
  appendHistory(timeLabel, temperature, humidity, distance);
  drawChart();
}

function appendHistory(label, temp, hum, dist) {
  state.history.labels.push(label);
  state.history.temperature.push(temp ?? null);
  state.history.humidity.push(hum ?? null);
  state.history.distance.push(dist > 0 ? dist : null);

  if (state.history.labels.length > state.maxHistoryPoints) {
    state.history.labels.shift();
    state.history.temperature.shift();
    state.history.humidity.shift();
    state.history.distance.shift();
  }
}

// Status badge helper
function updateStatus(statusClass, text) {
  el.connectionStatus.className = `status-badge ${statusClass}`;
  el.statusText.textContent = text;
}

// ==========================================
// Custom Lightweight Canvas Chart
// ==========================================
function resizeCanvas() {
  if (!el.canvas) return;
  const rect = el.canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  el.canvas.width = rect.width * dpr;
  el.canvas.height = 200 * dpr;
  ctx.scale(dpr, dpr);
}

function drawChart() {
  if (!ctx || !el.canvas) return;

  const rect = el.canvas.parentElement.getBoundingClientRect();
  const width = rect.width;
  const height = 200;

  ctx.clearRect(0, 0, width, height);

  const series = state.history[state.activeChartChannel] || [];
  if (series.length < 2) {
    // Draw placeholder
    ctx.fillStyle = '#64748b';
    ctx.font = '13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Collecting real-time data points...', width / 2, height / 2);
    return;
  }

  // Determine channel colors & min/max
  let color = '#10b981';
  let unit = 'cm';
  let minVal = 0;
  let maxVal = 100;

  if (state.activeChartChannel === 'temperature') {
    color = '#f97316';
    unit = '°C';
    minVal = 10;
    maxVal = 45;
  } else if (state.activeChartChannel === 'humidity') {
    color = '#06b6d4';
    unit = '%';
    minVal = 0;
    maxVal = 100;
  } else if (state.activeChartChannel === 'distance') {
    color = '#10b981';
    unit = 'cm';
    minVal = 0;
    maxVal = 120;
  }

  // Adapt max dynamically if data exceeds
  const validVals = series.filter(v => v !== null);
  if (validVals.length > 0) {
    const dataMax = Math.max(...validVals);
    if (dataMax > maxVal) maxVal = Math.ceil(dataMax * 1.2);
  }

  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 30;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  // Draw Grid lines
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = paddingTop + (plotHeight / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();

    // Value label
    const valLabel = Math.round(maxVal - (i * (maxVal - minVal) / gridLines));
    ctx.fillStyle = '#64748b';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${valLabel}${unit}`, paddingLeft - 8, y + 3);
  }

  // Calculate points
  const points = [];
  const step = plotWidth / (state.maxHistoryPoints - 1);
  const offset = (state.maxHistoryPoints - series.length) * step;

  series.forEach((val, idx) => {
    if (val !== null) {
      const x = paddingLeft + offset + (idx * step);
      const normalized = (val - minVal) / (maxVal - minVal);
      const clamped = Math.min(1, Math.max(0, normalized));
      const y = paddingTop + plotHeight - (clamped * plotHeight);
      points.push({ x, y, val });
    }
  });

  if (points.length < 2) return;

  // Fill gradient area below the line
  const grad = ctx.createLinearGradient(0, paddingTop, 0, height - paddingBottom);
  grad.addColorStop(0, color + '44');
  grad.addColorStop(1, color + '00');

  ctx.beginPath();
  ctx.moveTo(points[0].x, height - paddingBottom);
  points.forEach(pt => ctx.lineTo(pt.x, pt.y));
  ctx.lineTo(points[points.length - 1].x, height - paddingBottom);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Draw smooth line
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();

  // Draw points
  points.forEach((pt, idx) => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, idx === points.length - 1 ? 4 : 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    if (idx === points.length - 1) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });
}

// Start on DOM ready
document.addEventListener('DOMContentLoaded', init);
