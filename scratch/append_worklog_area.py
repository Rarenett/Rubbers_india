import os
from datetime import datetime

worklog_path = r'c:\Archana\glenda_vite\WORKLOG.md'
today = datetime.now().strftime("%Y-%m-%d")
time_now = datetime.now().strftime("%Y-%m-%d %H:%M IST")

entry = f"""
### 🟢 Feature: Common Master Area Geofencing & Mapping Enhancements
**Files:** `backend/area_app/models.py`, `backend/area_app/serializers.py`, `backend/area_app/views.py`, `backend/area_app/urls.py`, `frontend/src/jsx/components/CommonMaster/AreaCreation.jsx`, `frontend/src/jsx/components/CommonMaster/AreaLocationMapping.jsx`

- Added `DeliveryLocationCoordinate` and `AreaGeofenceHistory` models to `area_app`.
- Updated `Area` model with `polygon_coordinates`.
- Added `/api/areas/{{id}}/detected_locations/` and nearest coordinate lookup endpoints strictly isolated within Common Master.
- Rewrote `AreaCreation.jsx` to include Polygon Geofencing (using Google Maps DrawingManager), Heatmap overlays, and Geofence History version restoration.
- Maintained backward compatibility for circle geofences.
- Updated `AreaLocationMapping.jsx` to automatically detect and auto-select Main Delivery Locations using Point-in-Polygon logic without invoking Route Stops.

*Last updated: {time_now}*
"""

try:
    with open(worklog_path, 'r', encoding='utf-8') as f:
        content = f.read()
except UnicodeDecodeError:
    try:
        with open(worklog_path, 'r', encoding='utf-16') as f:
            content = f.read()
    except:
        content = ""

# Remove old last updated line if exists
if "*Last updated:" in content:
    content = content.rsplit("*Last updated:", 1)[0].strip()

# Check if today's date is already there
if f"## {today}" in content:
    # Append under today
    content = content + "\n\n" + entry
else:
    content = content + "\n\n" + f"## {today}\n\n" + entry

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content.strip() + "\n")
