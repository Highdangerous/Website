"use strict";

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

// WMO weather codes -> [label, emoji]
const WEATHER_CODES = {
  0: ["Clear sky", "☀️"], 1: ["Mainly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"], 48: ["Rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Heavy drizzle", "🌧️"],
  61: ["Light rain", "🌦️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
  71: ["Light snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Heavy snow", "❄️"], 77: ["Snow grains", "❄️"],
  80: ["Rain showers", "🌦️"], 81: ["Rain showers", "🌧️"], 82: ["Violent showers", "⛈️"],
  85: ["Snow showers", "🌨️"], 86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"], 96: ["Thunderstorm with hail", "⛈️"], 99: ["Thunderstorm with hail", "⛈️"],
};

const $ = (id) => document.getElementById(id);
const state = { metric: true, place: null };

try {
  state.metric = localStorage.getItem("units") !== "imperial";
} catch { /* storage unavailable: keep default */ }

function describe(code) {
  return WEATHER_CODES[code] || ["Unknown", "❔"];
}

function setStatus(message, isError = false) {
  const el = $("status");
  el.textContent = message;
  el.classList.toggle("error", isError);
}

// fetch wrapper: turns network failures and bad HTTP statuses into readable errors
async function getJSON(url, params) {
  const full = `${url}?${new URLSearchParams(params)}`;
  let res;
  try {
    res = await fetch(full);
  } catch {
    throw new Error("Network problem. Check your connection and try again.");
  }
  if (!res.ok) throw new Error(`The weather service returned an error (${res.status}).`);
  return res.json();
}

async function findCity(name) {
  const data = await getJSON(GEO_URL, { name, count: 1, language: "en", format: "json" });
  if (!data.results || data.results.length === 0) {
    throw new Error(`No city found for "${name}".`);
  }
  const { name: city, country, admin1, latitude, longitude } = data.results[0];
  return { label: [city, admin1, country].filter(Boolean).join(", "), latitude, longitude };
}

async function getWeather({ latitude, longitude }) {
  return getJSON(FORECAST_URL, {
    latitude,
    longitude,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    temperature_unit: state.metric ? "celsius" : "fahrenheit",
    wind_speed_unit: state.metric ? "kmh" : "mph",
    timezone: "auto",
  });
}

function render(label, w) {
  const deg = state.metric ? "°C" : "°F";
  const speed = state.metric ? "km/h" : "mph";
  const [desc, icon] = describe(w.current.weather_code);

  $("place").textContent = label;
  $("temp").textContent = `${icon} ${Math.round(w.current.temperature_2m)}${deg}`;
  $("desc").textContent = desc;
  $("feels").textContent = `${Math.round(w.current.apparent_temperature)}${deg}`;
  $("wind").textContent = `${Math.round(w.current.wind_speed_10m)} ${speed}`;
  $("humidity").textContent = `${w.current.relative_humidity_2m}%`;

  const list = $("days");
  list.replaceChildren();
  w.daily.time.forEach((date, i) => {
    const li = document.createElement("li");
    const day = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" });
    const [dayDesc, dayIcon] = describe(w.daily.weather_code[i]);
    li.title = dayDesc;
    li.textContent = `${day} ${dayIcon} ${Math.round(w.daily.temperature_2m_max[i])}° / ${Math.round(w.daily.temperature_2m_min[i])}°`;
    list.append(li);
  });

  $("current").hidden = false;
  $("forecast").hidden = false;
}

async function load(place) {
  setStatus("Loading…");
  try {
    const weather = await getWeather(place);
    state.place = place;
    render(place.label, weather);
    setStatus("");
    try { localStorage.setItem("lastCity", place.label.split(",")[0]); } catch { /* ignore */ }
  } catch (err) {
    setStatus(err.message, true);
  }
}

async function search(name) {
  setStatus("Searching…");
  try {
    await load(await findCity(name));
  } catch (err) {
    setStatus(err.message, true);
  }
}

$("search").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("city").value.trim();
  if (name) search(name);
});

function updateUnitsButton() {
  $("units").textContent = state.metric ? "°C" : "°F";
}

$("units").addEventListener("click", () => {
  state.metric = !state.metric;
  try { localStorage.setItem("units", state.metric ? "metric" : "imperial"); } catch { /* ignore */ }
  updateUnitsButton();
  if (state.place) load(state.place);
});

updateUnitsButton();
let last = "London";
try { last = localStorage.getItem("lastCity") || last; } catch { /* ignore */ }
search(last);
