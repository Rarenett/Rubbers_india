import requests
print("Getting areas...")
areas = requests.get('http://localhost:8000/api/areas/', headers={'Authorization': 'Bearer test'}).json()
if 'results' in areas:
    areas = areas['results']

for area in areas:
    print("Area:", area['name'], area['id'])
    history = requests.get(f'http://localhost:8000/api/geofence-history/?area={area["id"]}', headers={'Authorization': 'Bearer test'}).json()
    if 'results' in history:
        history = history['results']
    print("History length:", len(history))
    if len(history) > 0:
        print("polygon_distances:", history[0].get('polygon_distances'))
