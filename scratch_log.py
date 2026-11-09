import datetime

now = datetime.datetime.now().strftime('%Y-%m-%d')
now_time = datetime.datetime.now().strftime('%Y-%m-%d %H:%M IST')

log_entry = f"""
---

## {now}

### 🐛 Fix: Team Management Dashboard 500 Error
**Files:** Database Schema (rarenett_app_designation)

- Fixed a 500 Internal Server Error encountered on the Team Management Dashboard when fetching `/api/teams/teams/`.
- Root cause: The `level` column was missing from the `rarenett_app_designation` table in the database despite being present in `models.py`, causing `OperationalError: Unknown column`.
- Solution: Manually injected the `level` column into the database schema (`ALTER TABLE rarenett_app_designation ADD COLUMN level INT UNSIGNED NOT NULL DEFAULT 1`).

*Last updated: {now_time}*
"""

with open('WORKLOG.md', 'a', encoding='utf-8') as f:
    f.write(log_entry)
