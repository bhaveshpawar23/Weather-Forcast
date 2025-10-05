const API_KEY = '49870336652c7b43b4dd9a87cc310a45';
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const locBtn = document.getElementById('locBtn');
const unitsSel = document.getElementById('units');
const langSel = document.getElementById('lang');
const errEl = document.getElementById('err');
const currentDataEl = document.getElementById('currentData');
const forecastList = document.getElementById('forecastList');
const citiesOverviewList = document.getElementById('citiesOverviewList');

const TARGET_CITIES = [
  { name: "New York", country: "US" },
  { name: "Tokyo", country: "JP" },
  { name: "London", country: "GB" },
  { name: "Sydney", country: "AU" },
  { name: "Dubai", country: "AE" }
];

function showError(msg) {
  errEl.style.display = 'block';
  errEl.textContent = msg;
  setTimeout(() => { errEl.style.display = 'none'; }, 5000);
}

function getWeatherIcon(main) {
  switch (main.toLowerCase()) {
    case 'clear': return '☀️';
    case 'clouds': return '☁️';
    case 'rain': return '🌧️';
    case 'thunderstorm': return '⛈️';
    case 'snow': return '❄️';
    case 'drizzle': return '🌦️';
    case 'mist':
    case 'smoke':
    case 'haze':
    case 'dust':
    case 'fog':
    case 'sand':
    case 'ash':
    case 'squall':
    case 'tornado': return '🌫️';
    default: return '🌈';
  }
}

function updateLoadingState(targetEl, msg, iconClass = 'fa-spinner') {
  targetEl.innerHTML = `<div class="loading-data"><i class="fas ${iconClass}"></i> ${msg}</div>`;
}

function initStarfieldAnimation() {
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width, height;
  let stars = [];
  const numStars = 200;
  const maxSpeed = 1.5;

  function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  }

  class Star {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.z = Math.random() * width;
      this.radius = 0.5 + Math.random() * 1.5;
      this.speed = Math.random() * maxSpeed;
    }
    update() {
      this.z -= this.speed;
      if (this.z <= 0) {
        this.z = width;
        this.x = Math.random() * width;
        this.y = Math.random() * height;
      }
    }
    draw() {
      const x = (this.x - width / 2) * (width / this.z) + width / 2;
      const y = (this.y - height / 2) * (height / this.z) + height / 2;
      const r = this.radius * (width / this.z);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      const opacity = 0.1 + (maxSpeed - this.speed) / maxSpeed * 0.4;
      ctx.fillStyle = `rgba(57, 208, 255, ${opacity})`;
      ctx.fill();
    }
  }

  function createStars() {
    for (let i = 0; i < numStars; i++) stars.push(new Star());
  }

  function animate() {
    ctx.fillStyle = 'rgba(7, 17, 43, 0.4)';
    ctx.fillRect(0, 0, width, height);
    stars.forEach(star => {
      star.update();
      star.draw();
    });
    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  createStars();
  animate();
}

async function getCitiesOverview() {
  citiesOverviewList.innerHTML = '';
  const units = unitsSel.value;
  const tempUnit = units === 'metric' ? '°C' : '°F';

  for (const city of TARGET_CITIES) {
    try {
      const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${city.name},${city.country}&limit=1&appid=${API_KEY}`);
      const geoData = await geoRes.json();
      if (geoData.length === 0) continue;
      const { lat, lon } = geoData[0];

      const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${API_KEY}`;
      const weatherRes = await fetch(weatherUrl);
      const weatherData = await weatherRes.json();

      if (weatherRes.ok) {
        const div = document.createElement('div');
        div.className = 'day-card';
        div.innerHTML = `
          <div class="day-name" style="font-size:16px;">${weatherData.name}</div>
          <div class="day-icon">${getWeatherIcon(weatherData.weather[0].main)}</div>
          <div class="day-temp">${Math.round(weatherData.main.temp)}${tempUnit}</div>
          <div class="day-desc">${weatherData.weather[0].description}</div>
        `;
        citiesOverviewList.appendChild(div);
      }
    } catch (err) {
      console.error(`Error fetching weather for ${city.name}:`, err);
    }
  }

  if (citiesOverviewList.childElementCount === 0) {
    citiesOverviewList.innerHTML = '<div class="loading-data">Could not load weather for selected cities. Check your API key.</div>';
  }
}

async function getWeather(lat, lon) {
  updateLoadingState(currentDataEl, 'Retrieving Real-time Weather...');
  try {
    const units = unitsSel.value;
    const lang = langSel.value;
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${units}&lang=${lang}&appid=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok) {
      updateCurrent(data, units);
      getPollution(lat, lon);
      getForecast(lat, lon);
    } else {
      showError(data.message || 'Unable to fetch weather data.');
      updateLoadingState(currentDataEl, 'Failed to Load Data.', 'fa-exclamation-triangle');
    }
  } catch (err) {
    showError('Network Error: Could not connect to weather service.');
    updateLoadingState(currentDataEl, 'Connection Error.', 'fa-wifi');
  }
}

async function getPollution(lat, lon) {
  let aqiText = 'Air Quality: N/A';
  let oxygenText = 'O₂ Level: N/A';

  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
    const data = await res.json();
    if (res.ok && data.list.length) {
      const air = data.list[0];
      const aqi = air.main.aqi;
      const co = air.components.co ? air.components.co.toFixed(1) : 'N/A';
      const aqiMessages = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
      aqiText = `AQI: ${aqi} (${aqiMessages[aqi - 1] || 'Unknown'})`;
      oxygenText = `CO: ${co} μg/m³`;
    }
  } catch (err) {
    console.error('Pollution API Error:', err);
  }

  const pollutionValEl = document.getElementById('pollutionVal');
  const oxygenValEl = document.getElementById('oxygenVal');
  if (pollutionValEl) pollutionValEl.textContent = aqiText;
  if (oxygenValEl) oxygenValEl.textContent = oxygenText;
}

function updateCurrent(data, units) {
  const isMetric = units === 'metric';
  const tempUnit = isMetric ? '°C' : '°F';
  const speedUnit = isMetric ? 'm/s' : 'mph';
  const sunriseTime = new Date(data.sys.sunrise * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const sunsetTime = new Date(data.sys.sunset * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const html = `
    <div class="cur-header">
      <div class="cur-loc" id="cityName">${data.name}, ${data.sys.country}</div>
      <div class="date-time">${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
    <div class="weather-display">
      <div class="icon-container" id="weatherIcon">${getWeatherIcon(data.weather[0].main)}</div>
      <div class="temp-info">
        <div class="temps" id="temp">${Math.round(data.main.temp)}${tempUnit}</div>
        <div class="desc-info">
          <div class="desc" id="weatherDesc">${data.weather[0].description}</div>
        </div>
      </div>
    </div>
    <div class="details-grid">
      <div class="detail-card"><span class="detail-label">Feels Like</span><strong id="feelsVal">${Math.round(data.main.feels_like)}${tempUnit}</strong></div>
      <div class="detail-card"><span class="detail-label">Humidity</span><strong id="humidityVal">${data.main.humidity}%</strong></div>
      <div class="detail-card"><span class="detail-label">Wind Speed</span><strong id="windVal">${data.wind.speed.toFixed(1)} ${speedUnit}</strong></div>
      <div class="detail-card"><span class="detail-label">Sunrise</span><strong id="sunriseVal">${sunriseTime}</strong></div>
      <div class="detail-card"><span class="detail-label">Sunset</span><strong id="sunsetVal">${sunsetTime}</strong></div>
      <div class="detail-card"><span class="detail-label">Air Quality</span><strong id="pollutionVal">Loading...</strong></div>
      <div class="detail-card"><span class="detail-label">CO Level</span><strong id="oxygenVal">Loading...</strong></div>
      <div class="detail-card"><span class="detail-label">Pressure</span><strong id="pressureVal">${data.main.pressure} hPa</strong></div>
    </div>
  `;
  currentDataEl.innerHTML = html;
}

async function getForecast(lat, lon) {
  updateLoadingState(forecastList, 'Compiling 5-Day Forecast...');
  try {
    const units = unitsSel.value;
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${units}&appid=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok) {
      forecastList.innerHTML = '';
      const dailyData = {};
      const today = new Date().toLocaleDateString('en-US');
      data.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const dayKey = date.toLocaleDateString('en-US');
        if (dayKey !== today) {
          if (!dailyData[dayKey]) {
            dailyData[dayKey] = {
              day: date.toLocaleDateString('en-US', { weekday: 'short' }),
              temp: item.main.temp_max,
              icon: getWeatherIcon(item.weather[0].main),
              desc: item.weather[0].description
            };
          } else {
            if (item.main.temp_max > dailyData[dayKey].temp) {
              dailyData[dayKey].temp = item.main.temp_max;
            }
          }
        }
      });
      Object.values(dailyData).slice(0, 5).forEach(day => {
        const div = document.createElement('div');
        div.className = 'day-card';
        div.innerHTML = `
          <div class="day-name">${day.day}</div>
          <div class="day-icon">${day.icon}</div>
          <div class="day-temp">${Math.round(day.temp)}°</div>
          <div class="day-desc">${day.desc}</div>
        `;
        forecastList.appendChild(div);
      });
    } else {
      forecastList.innerHTML = '<div class="loading-data"><i class="fas fa-frown-open"></i> Forecast not available.</div>';
    }
  } catch (err) {
    forecastList.innerHTML = '<div class="loading-data"><i class="fas fa-exclamation-circle"></i> Error loading forecast.</div>';
  }
}

function fetchByCity() {
  const city = cityInput.value.trim();
  if (!city) {
    showError('Please enter a City, State, or Country.');
    return;
  }
  updateLoadingState(currentDataEl, 'Locating City...');
  updateLoadingState(forecastList, 'Searching for Forecast...');
  fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${API_KEY}`)
    .then(res => res.json())
    .then(data => {
      if (data.length) {
        getWeather(data[0].lat, data[0].lon);
      } else {
        showError('Location not found. Try "City,CountryCode" for best results.');
        updateLoadingState(currentDataEl, 'Location Not Found.', 'fa-map-marker-alt');
        updateLoadingState(forecastList, 'No Forecast Available.', 'fa-chart-line');
      }
    })
    .catch(() => {
      showError('Error fetching location coordinates.');
      updateLoadingState(currentDataEl, 'Location Error.', 'fa-exclamation-triangle');
      updateLoadingState(forecastList, 'No Forecast Available.', 'fa-chart-line');
    });
}

function fetchByLocation() {
  if (navigator.geolocation) {
    updateLoadingState(currentDataEl, 'Accessing Geo-Location...');
    updateLoadingState(forecastList, 'Awaiting Location...');
    navigator.geolocation.getCurrentPosition(
      pos => { getWeather(pos.coords.latitude, pos.coords.longitude); },
      () => {
        showError('Location access denied or unavailable.');
        updateLoadingState(currentDataEl, 'Location Denied.', 'fa-ban');
      }
    );
  } else {
    showError('Geolocation is not supported by this browser.');
    updateLoadingState(currentDataEl, 'Geolocation Unsupported.', 'fa-times-circle');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initStarfieldAnimation();
  updateLoadingState(currentDataEl, 'Click "My Location" or Search for a City!', 'fa-globe');
  updateLoadingState(forecastList, 'No Data Loaded.', 'fa-chart-line');
  getCitiesOverview();
});

searchBtn.addEventListener('click', fetchByCity);
cityInput.addEventListener('keydown', function (event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    document.getElementById('searchBtn').click();
  }
});
locBtn.addEventListener('click', fetchByLocation);

function handleSettingsChange() {
  const currentCity = document.getElementById('cityName');
  if (currentCity && currentCity.textContent !== 'Click "My Location" or Search for a City!') {
    fetchByCity();
  }
  getCitiesOverview();
}

unitsSel.addEventListener('change', handleSettingsChange);
langSel.addEventListener('change', handleSettingsChange);
