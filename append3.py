import datetime
with open('WORKLOG.md', 'a', encoding='utf-8') as f:
    date_str = datetime.datetime.now().strftime('%Y-%m-%d')
    time_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M IST')
    f.write(f"\n\n---\n\n## {date_str}\n\n### 🐛 Fix: Display meaningful error when deleting an Area that is in use\n**Files:** `backend/area_app/views.py`, `frontend/src/jsx/components/CommonMaster/AreaCreation.jsx`\n\n- Caught `ProtectedError` in `AreaViewSet.destroy()` so the backend gracefully handles deletion attempts of Areas that are mapped to existing locations or salesmen.\n- Updated `AreaCreation.jsx` to dynamically display the backend's detailed error message instead of a generic string, explaining exactly why the area couldn't be deleted.\n\n*Last updated: {time_str}*\n")
