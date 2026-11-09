import requests
import json

lat = 10.0889
lon = 76.8837

url = "https://nominatim.openstreetmap.org/reverse"
params = {
    'lat': lat,
    'lon': lon,
    'format': 'json'
}
headers = {
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'GlendaViteApp/1.0 (contact@glendavite.com)'
}
response = requests.get(url, params=params, headers=headers, timeout=10)
print(response.status_code)
print(json.dumps(response.json(), indent=2))
