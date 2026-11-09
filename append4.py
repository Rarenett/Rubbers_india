import datetime
with open('WORKLOG.md', 'a', encoding='utf-8') as f:
    date_str = datetime.datetime.now().strftime('%Y-%m-%d')
    time_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M IST')
    f.write(f"\n\n---\n\n## {date_str}\n\n### 🐛 Fix: Area Deletion Blocked by Obsolete Mappings\n**Files:** `backend/area_app/models.py`\n\n- Changed `on_delete` from `models.PROTECT` to `models.CASCADE` on `AreaLocationMapping.area` to prevent invisible mapping records from permanently blocking Area deletion.\n- Ran database migrations to apply the change.\n\n*Last updated: {time_str}*\n")
