import requests
import json

url = "http://localhost:8000/api/area/geocode_reverse/"
params = {
    'lat': 10.0889,
    'lon': 76.8837
}

try:
    response = requests.get(url, params=params)
    print("Status:", response.status_code)
    print("Response:", json.dumps(response.json(), indent=2))
except Exception as e:
    print("Error:", e)
