# Weather

A small weather app in plain HTML, CSS and JavaScript. It uses the free [Open-Meteo](https://open-meteo.com/) APIs, so there is **no API key and no build step**.

- Search any city (geocoding API), then get current conditions and a 7-day forecast
- °C / °F toggle, remembered between visits
- Remembers your last city
- Light and dark theme that follows your system setting

## Run it

```sh
python3 -m http.server 8000
```

Open http://localhost:8000/weather/.

## What it shows off

- `fetch` with `async` / `await`
- Error handling for three cases: network failure, bad HTTP status, and a city that doesn't exist
- Building a query string with `URLSearchParams`
- Mapping API weather codes to text and emoji
- `localStorage` that fails gracefully when unavailable

## Ideas to extend

- Hourly chart for the next 24 hours
- "Use my location" with `navigator.geolocation`
- Autocomplete suggestions from the geocoding API (`count: 5`)
- Background that changes with the weather
