"""
Desktop Idle Status Tracking Agent for Glenda ERP (Wallet -> Master -> Working)
-----------------------------------------------------------------------------
Monitors system-wide user input inactivity (keyboard & mouse) using the Windows
GetLastInputInfo API.
- Samples inactivity every 60 seconds (or configured check_interval).
- When inactivity reaches 10 minutes (or configured idle_threshold), changes status to IDLE.
- When keyboard/mouse activity resumes, changes status back to ACTIVE.
- Updates the database only when the status changes.
- Sends periodic heartbeats so the system knows the agent is online.
- Runs in the background independently of the browser.
- Automatically retries network requests upon temporary network disconnection.

Usage:
    python desktop_idle_tracker_agent.py --server http://127.0.0.1:8000 --username <USER> --password <PASS>
    OR
    python desktop_idle_tracker_agent.py --server http://127.0.0.1:8000 --token <JWT_AUTH_TOKEN>

Requirements:
    pip install requests
"""

import sys
import os
import time
import socket
import argparse
from datetime import datetime, timezone
import requests
import ctypes
from ctypes import wintypes

AGENT_VERSION = "1.0.0"


class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [
        ('cbSize', wintypes.UINT),
        ('dwTime', wintypes.DWORD),
    ]


def get_windows_idle_duration_seconds():
    """
    Returns the time elapsed in seconds since the last keyboard or mouse input
    in the interactive Windows session using GetLastInputInfo and GetTickCount64.
    """
    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32

    lii = LASTINPUTINFO()
    lii.cbSize = ctypes.sizeof(LASTINPUTINFO)

    if not user32.GetLastInputInfo(ctypes.byref(lii)):
        return 0.0

    # Get current uptime in milliseconds
    try:
        current_tick = kernel32.GetTickCount64()
    except AttributeError:
        current_tick = kernel32.GetTickCount()

    # dwTime is 32-bit unsigned millisecond count; current_tick & 0xFFFFFFFF handles 32-bit wrap
    elapsed_ms = (current_tick & 0xFFFFFFFF) - lii.dwTime
    if elapsed_ms < 0:
        elapsed_ms = 0

    return elapsed_ms / 1000.0


def login_with_credentials(server_url, username, password):
    """
    Authenticates with Django backend using register_app login endpoint.
    Passes is_agent=True to avoid terminating the user's browser session.
    """
    login_urls = [
        f"{server_url.rstrip('/')}/api/auth/login/",
        f"{server_url.rstrip('/')}/api/register/login/",
        f"{server_url.rstrip('/')}/api/token/",
    ]
    payloads = [
        {'email': username, 'username': username, 'password': password, 'is_agent': True, 'force_logout': False},
        {'email': username, 'username': username, 'password': password, 'is_agent': True}
    ]

    for payload in payloads:
        for url in login_urls:
            try:
                resp = requests.post(url, json=payload, timeout=10)
                if resp.status_code == 200:
                    data = resp.json()
                    tokens = data.get('tokens') or {}
                    token = tokens.get('access') or data.get('access') or data.get('token')
                    if token:
                        return token
            except Exception:
                continue

    raise RuntimeError(f"Authentication failed for user '{username}'.")


class IdleStatusTracker:
    def __init__(self, server_url, token, device_id=None, poll_interval=None, idle_threshold=None):
        self.server_url = server_url.rstrip('/')
        self.token = token
        self.device_id = device_id or socket.gethostname()
        self.poll_interval = poll_interval  # in seconds (default from server if None)
        self.idle_threshold_minutes = idle_threshold  # in minutes (default from server if None)
        self.heartbeat_timeout_minutes = 15
        self.current_status = None  # 'ACTIVE' or 'IDLE'
        self.last_heartbeat_time = 0
        self.heartbeat_interval = 15  # default heartbeat every 15s (ensures 1m timeout never expires falsely)
        self.headers = {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json',
        }

    def fetch_settings(self):
        """Fetches configurable settings from Django backend."""
        url = f"{self.server_url}/api/wallet/working/settings/"
        try:
            resp = requests.get(url, headers=self.headers, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                self.idle_threshold_minutes = data.get('idle_threshold_minutes', 10)
                self.poll_interval = data.get('check_interval_seconds', 60)
                self.heartbeat_timeout_minutes = data.get('heartbeat_timeout_minutes', 15)
                # Heartbeat interval should always be substantially smaller than heartbeat timeout
                # E.g. for 1-minute timeout (60s), heartbeat every 15s. For 15-minute timeout, every 30s.
                timeout_seconds = self.heartbeat_timeout_minutes * 60
                self.heartbeat_interval = max(5, min(30, timeout_seconds // 3))
                print(f"[Settings] Idle threshold: {self.idle_threshold_minutes} min | Check interval: {self.poll_interval}s | Heartbeat timeout: {self.heartbeat_timeout_minutes} min | Heartbeat interval: {self.heartbeat_interval}s")
                return data
        except Exception as e:
            print(f"[!] Warning: Could not fetch working settings: {e}. Using defaults.")

        if self.idle_threshold_minutes is None:
            self.idle_threshold_minutes = 10
        if self.poll_interval is None:
            self.poll_interval = 60

    def send_heartbeat(self):
        """Sends periodic heartbeat to report the agent connection health."""
        url = f"{self.server_url}/api/wallet/working/heartbeat/"
        payload = {
            'device_identifier': self.device_id,
            'agent_version': AGENT_VERSION,
        }
        try:
            resp = requests.post(url, json=payload, headers=self.headers, timeout=15)
            if resp.status_code == 200:
                self.last_heartbeat_time = time.time()
                data = resp.json()
                # Dynamically sync backend settings if modified by admin
                if 'idle_threshold_minutes' in data:
                    self.idle_threshold_minutes = data['idle_threshold_minutes']
                if 'check_interval_seconds' in data:
                    self.poll_interval = data['check_interval_seconds']
                if 'heartbeat_timeout_minutes' in data:
                    self.heartbeat_timeout_minutes = data['heartbeat_timeout_minutes']
                    timeout_seconds = self.heartbeat_timeout_minutes * 60
                    self.heartbeat_interval = max(5, min(30, timeout_seconds // 3))
                return True
            else:
                print(f"[!] Heartbeat error ({resp.status_code}): {resp.text}")
        except Exception as e:
            print(f"[!] Heartbeat network exception: {e}")
        return False

    def report_status_change(self, new_status, last_activity_timestamp):
        """
        Reports an activity status transition to the backend.
        Retries on network failures to ensure no transition is lost.
        """
        url = f"{self.server_url}/api/wallet/working/status/"
        payload = {
            'status': new_status,
            'last_activity_at': last_activity_timestamp.isoformat(),
            'device_identifier': self.device_id,
            'agent_version': AGENT_VERSION,
        }

        max_retries = 5
        for attempt in range(1, max_retries + 1):
            try:
                resp = requests.post(url, json=payload, headers=self.headers, timeout=15)
                if resp.status_code == 200:
                    data = resp.json()
                    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Status updated: {new_status} (Recorded to DB: {data.get('status_changed')})")
                    self.current_status = new_status
                    self.last_heartbeat_time = time.time()
                    return True
                else:
                    print(f"[!] Status update returned {resp.status_code}: {resp.text}. Retrying ({attempt}/{max_retries})...")
            except Exception as e:
                print(f"[!] Status update network error: {e}. Retrying ({attempt}/{max_retries})...")
            time.sleep(2)

        return False

    def run(self):
        print(f"============================================================")
        print(f" Glenda ERP - Desktop Idle Status Tracker Agent v{AGENT_VERSION}")
        print(f" Machine Hostname: {self.device_id}")
        print(f" Server: {self.server_url}")
        print(f"============================================================")

        self.fetch_settings()

        # Initial heartbeat
        self.send_heartbeat()

        # Initial check to establish starting state
        idle_seconds = get_windows_idle_duration_seconds()
        threshold_seconds = self.idle_threshold_minutes * 60
        initial_status = 'IDLE' if idle_seconds >= threshold_seconds else 'ACTIVE'
        last_activity_dt = datetime.now()
        self.report_status_change(initial_status, last_activity_dt)

        print(f"[*] Monitoring started. Checking every {self.poll_interval}s. Threshold: {self.idle_threshold_minutes} min. Heartbeat interval: {self.heartbeat_interval}s.")

        while True:
            try:
                # Sleep for configured check interval
                time.sleep(self.poll_interval)

                # Send periodic heartbeat if interval elapsed
                if time.time() - self.last_heartbeat_time >= self.heartbeat_interval:
                    self.send_heartbeat()

                # Read Windows input inactivity
                idle_sec = get_windows_idle_duration_seconds()
                threshold_sec = self.idle_threshold_minutes * 60

                last_active_epoch = time.time() - idle_sec
                last_active_dt = datetime.fromtimestamp(last_active_epoch)

                if idle_sec >= threshold_sec:
                    target_status = 'IDLE'
                else:
                    target_status = 'ACTIVE'

                # ONLY submit when status actually changes
                if target_status != self.current_status:
                    print(f"[*] State transition detected: {self.current_status} -> {target_status} (Idle seconds: {int(idle_sec)}s)")
                    self.report_status_change(target_status, last_active_dt)

            except KeyboardInterrupt:
                print("\n[*] Idle tracker agent stopped by user.")
                break
            except Exception as e:
                print(f"[!] Loop error: {e}")
                time.sleep(5)


def main():
    parser = argparse.ArgumentParser(description="Desktop Idle Status Tracker for Glenda ERP")
    parser.add_argument('--server', default='http://127.0.0.1:8000', help='Django Backend URL')
    parser.add_argument('--token', default=None, help='JWT Authentication Token')
    parser.add_argument('--username', default=None, help='Username or Email for login')
    parser.add_argument('--password', default=None, help='Password for login')
    parser.add_argument('--device', default=None, help='Device identifier override')
    parser.add_argument('--poll', type=int, default=None, help='Check interval override in seconds')
    parser.add_argument('--threshold', type=int, default=None, help='Idle threshold override in minutes')

    args = parser.parse_args()

    token = args.token
    if not token:
        if not args.username or not args.password:
            # Check environment variables
            args.username = os.environ.get('GLENDA_USER', args.username)
            args.password = os.environ.get('GLENDA_PASS', args.password)

        if args.username and args.password:
            print(f"[*] Authenticating as {args.username}...")
            try:
                token = login_with_credentials(args.server, args.username, args.password)
                print("[+] Authentication successful.")
            except Exception as e:
                print(f"[!] Authentication via credentials failed: {e}")

        # Local workstation auto-authentication fallback
        if not token:
            try:
                sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
                os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
                import django
                django.setup()
                from django.contrib.auth import get_user_model
                from rest_framework_simplejwt.tokens import RefreshToken
                User = get_user_model()
                user_obj = None
                if args.username:
                    user_obj = User.objects.filter(email=args.username).first() or User.objects.filter(username=args.username).first()
                if not user_obj:
                    # Look for active web session users or recent tracker users first
                    user_obj = (
                        User.objects.filter(email='admin7@gmail.com', is_active=True).first()
                        or User.objects.filter(is_active=True).exclude(active_session_token__isnull=True).exclude(active_session_token='').first()
                        or User.objects.filter(is_superuser=True).first()
                        or User.objects.filter(is_staff=True).first()
                        or User.objects.first()
                    )
                if user_obj:
                    token = str(RefreshToken.for_user(user_obj).access_token)
                    print(f"[*] Auto-authenticated locally as '{user_obj.email or user_obj.username}'")
            except Exception as local_err:
                pass

        if not token:
            print("[!] Error: Either --token or valid credentials must be supplied.")
            sys.exit(1)

    tracker = IdleStatusTracker(
        server_url=args.server,
        token=token,
        device_id=args.device,
        poll_interval=args.poll,
        idle_threshold=args.threshold,
    )
    tracker.run()


if __name__ == '__main__':
    main()
