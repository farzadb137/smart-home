import { appstate, updateSettings } from "../state.js";
import { createIcon } from "../icon.js"

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

// Rough mapping of Open-Meteo weather codes to short descriptions
const WEATHER_CODES = {
    0:  { label: "Clear sky",                       icon: "sun" },
    1:  { label: "Mainly clear",                    icon: "sun" },
    2:  { label: "Partly cloudy",                   icon: "cloud-sun" },
    3:  { label: "Overcast",                        icon: "cloud" },
    45: { label: "Fog",                             icon: "cloud-fog" },
    48: { label: "Depositing rime fog",             icon: "cloud-fog" },
    51: { label: "Light drizzle",                   icon: "cloud-drizzle" },
    53: { label: "Moderate drizzle",                icon: "cloud-drizzle" },
    55: { label: "Dense drizzle",                   icon: "cloud-drizzle" },
    56: { label: "Light freezing drizzle",          icon: "cloud-drizzle" },
    57: { label: "Dense freezing drizzle",          icon: "cloud-drizzle" },
    61: { label: "Slight rain",                     icon: "cloud-rain" },
    63: { label: "Moderate rain",                   icon: "cloud-rain" },
    65: { label: "Heavy rain",                      icon: "cloud-rain" },
    66: { label: "Light freezing rain",             icon: "cloud-rain" },
    67: { label: "Heavy freezing rain",             icon: "cloud-rain" },
    71: { label: "Slight snow",                     icon: "cloud-snow" },
    73: { label: "Moderate snow",                   icon: "cloud-snow" },
    75: { label: "Heavy snow",                      icon: "cloud-snow" },
    77: { label: "Snow grains",                     icon: "cloud-snow" },
    80: { label: "Slight rain showers",             icon: "cloud-rain" },
    81: { label: "Moderate rain showers",           icon: "cloud-rain" },
    82: { label: "Violent rain showers",            icon: "cloud-rain" },
    85: { label: "Slight snow showers",             icon: "cloud-snow" },
    86: { label: "Heavy snow showers",              icon: "cloud-snow" },
    95: { label: "Thunderstorm",                    icon: "cloud-lightning" },
    96: { label: "Thunderstorm with slight hail",   icon: "cloud-lightning" },
    99: { label: "Thunderstorm with heavy hail",    icon: "cloud-lightning" }
};

function getWeatherInfo(code) {
    return WEATHER_CODES[code] || {
        label: "Unknown conditions",
        icon: "cloude"
    };
}

export function getCity() {
    const loc = appstate.settings.location;
    if (loc && loc.cityName) return loc;

    const savedCity = localStorage.getItem("smarthome-city");
    if (savedCity) return { cityName: savedCity, latitude: "", longitude: "", label: "" };

    return { cityName: "Tehran, Iran", latitude: "", longitude: "", label: "" };
}

function saveLocation(location) {
    updateSettings({ location }); // replaces appstate.settings.location as a whole object
    localStorage.setItem("smarthome-city", location.cityName);
}

function setCity(cityName) {
  updateSettings({ cityName: cityName });
  localStorage.setItem("smarthome-city", cityName);
}

async function geocodeCity(name) {
    const res = await fetch(`${GEOCODE_URL}?name=${encodeURIComponent(name)}&count=1`);
    if (!res.ok) throw new Error(`Geocoding request failed: ${res.status}`);
    const data = await res.json();
    if (!data.results || !data.results.length) throw new Error("City not found");
    const { latitude, longitude, name: cityName, country } = data.results[0];
    return { latitude, longitude, label: `${cityName}, ${country}` };
}

async function fetchWeather(lat, lon) {
    const res = await fetch(`${WEATHER_URL}?latitude=${lat}&longitude=${lon}&current_weather=true`);
    if (!res.ok) throw new Error(`Weather request failed: ${res.status}`);
    const data = await res.json();
    if (!data.current_weather) throw new Error("Weather data unavailable");
    return data.current_weather;
}

export async function updateWeather(location) {
    const temperature = document.getElementById("weather-temp");
    const icon = document.getElementById("weather-icon");
    const description = document.getElementById("weather-desc");
    const cityInput = document.getElementById("city-input");

    try {
        let { cityName, latitude, longitude, label } = location;

        if (!latitude || !longitude) {
            const geo = await geocodeCity(cityName);
            latitude = geo.latitude;
            longitude = geo.longitude;
            label = geo.label;
        }

        const weather = await fetchWeather(latitude, longitude);
        if (!weather) throw new Error("Weather data unavailable");
        if (typeof weather.temperature === "number")
            temperature.textContent = `${Math.round(weather.temperature)}°C`;
        else
            temperature.textContent = "-";

        const weatherInfo = getWeatherInfo(weather.weathercode);
        let weatherIcon = weatherInfo.icon;
        if (weather.is_day === 0 && (weather.weathercode === 0 || weather.weathercode ===1)) weatherIcon = "moon";
        if (icon) icon.innerHTML = createIcon(weatherIcon);
        description.textContent = weatherInfo.label;

        if (cityInput) cityInput.value = label || cityName;

        saveLocation({ cityName, latitude, longitude, label });
    } catch (err) {
        console.error("Failed to update weather:", err);
        if (description) description.textContent = "Weather unavailable";
        if (temperature) description.textContent = "-";
        if (icon) description.textContent = createIcon("cloud");
    }
}

