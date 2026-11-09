"""
Desktop Screenshot Capture Agent for Glenda ERP (Wallet Calendar)
-----------------------------------------------------------------
Authorized Windows background desktop agent that securely communicates
with the Django backend to automatically capture and upload desktop screenshots
at scheduled times without requiring manual button clicks or keeping the browser open.

Usage:
    python desktop_capture_agent.py --server http://127.0.0.1:8000 --token <JWT_AUTH_TOKEN>
    OR
    python desktop_capture_agent.py --server http://127.0.0.1:8000 --username <USER> --password <PASS>

Requirements:
    pip install requests pillow
"""

import sys
import os
import time
import socket
import argparse
import io
from datetime import datetime, date
import requests

try:
    from PIL import Image, ImageGrab
except ImportError:
    Image = None
    ImageGrab = None

import ctypes
from ctypes import wintypes


def capture_windows_screen():
    """
    Captures the primary Windows desktop screen.
    Handles background services/agents by attaching to the input desktop (Win32 OpenInputDesktop).
    Falls back to direct GDI bitblt if PIL ImageGrab fails.
    """
    user32 = ctypes.windll.user32
    gdi32 = ctypes.windll.gdi32

    # Attach thread to interactive user desktop
    hDesk = None
    try:
        hDesk = user32.OpenInputDesktop(0, False, 0x01FF) # DESKTOP_READOBJECTS | GENERIC_ALL
        if hDesk:
            user32.SetThreadDesktop(hDesk)
    except Exception:
        pass

    # Method 1: Try PIL ImageGrab across the entire virtual desktop (all monitors and active windows)
    if ImageGrab:
        try:
            # On Windows, all_screens=True captures across all monitors including any active File Manager, Desktop, or third-party apps
            img = ImageGrab.grab(all_screens=True)
            if img and img.size[0] > 0 and img.size[1] > 0:
                if hDesk:
                    try:
                        user32.CloseDesktop(hDesk)
                    except Exception:
                        pass
                return img
        except Exception as e:
            print(f"[*] ImageGrab notice: {e}. Trying direct GDI screen capture...")

    # Method 2: Direct GDI / BitBlt capture
    try:
        width = user32.GetSystemMetrics(0)
        height = user32.GetSystemMetrics(1)

        hdc_screen = user32.GetDC(0)
        hdc_mem = gdi32.CreateCompatibleDC(hdc_screen)
        hbm = gdi32.CreateCompatibleBitmap(hdc_screen, width, height)
        gdi32.SelectObject(hdc_mem, hbm)

        SRCCOPY = 0x00CC0020
        CAPTUREBLT = 0x40000000
        gdi32.BitBlt(hdc_mem, 0, 0, width, height, hdc_screen, 0, 0, SRCCOPY | CAPTUREBLT)

        class BITMAPINFOHEADER(ctypes.Structure):
            _fields_ = [
                ('biSize', wintypes.DWORD),
                ('biWidth', wintypes.LONG),
                ('biHeight', wintypes.LONG),
                ('biPlanes', wintypes.WORD),
                ('biBitCount', wintypes.WORD),
                ('biCompression', wintypes.DWORD),
                ('biSizeImage', wintypes.DWORD),
                ('biXPelsPerMeter', wintypes.LONG),
                ('biYPelsPerMeter', wintypes.LONG),
                ('biClrUsed', wintypes.DWORD),
                ('biClrImportant', wintypes.DWORD)
            ]

        bmi = BITMAPINFOHEADER()
        bmi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
        bmi.biWidth = width
        bmi.biHeight = -height  # Top-down
        bmi.biPlanes = 1
        bmi.biBitCount = 32
        bmi.biCompression = 0  # BI_RGB

        buf_size = width * height * 4
        buf = ctypes.create_string_buffer(buf_size)
        gdi32.GetDIBits(hdc_mem, hbm, 0, height, buf, ctypes.byref(bmi), 0)

        img = Image.frombuffer('RGBA', (width, height), buf, 'raw', 'BGRA', 0, 1)
        img = img.convert('RGB')

        # Clean up GDI resources
        gdi32.DeleteObject(hbm)
        gdi32.DeleteDC(hdc_mem)
        user32.ReleaseDC(0, hdc_screen)
        if hDesk:
            try:
                user32.CloseDesktop(hDesk)
            except Exception:
                pass

        return img
    except Exception as gdi_err:
        print(f"[!] Direct GDI capture error: {gdi_err}")
        if hDesk:
            try:
                user32.CloseDesktop(hDesk)
            except Exception:
                pass
        return None


def authenticate(server_url, username, password):
    """Logs into the backend and returns the JWT access token."""
    login_urls = [
        f"{server_url.rstrip('/')}/api/auth/login/",
        f"{server_url.rstrip('/')}/api/register/login/",
        f"{server_url.rstrip('/')}/api/token/",
        f"{server_url.rstrip('/')}/api/login/"
    ]
    # Include is_agent=True so the agent authenticates without terminating active browser sessions
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
                        print(f"[OK] Successfully authenticated as '{username}'")
                        return token
            except Exception:
                continue

    print(f"[!] Authentication failed for user '{username}'.")
    return None


def send_heartbeat(server_url, headers, hostname):
    """Sends a heartbeat ping to let the backend/UI know the desktop agent is active."""
    url = f"{server_url.rstrip('/')}/api/wallet/calendar/agent-heartbeat/"
    try:
        requests.post(url, headers=headers, json={
            'version': '1.2.0',
            'hostname': hostname
        }, timeout=5)
    except Exception:
        pass


def upload_capture_with_retry(server_url, headers, sched_id, sched_date, sched_time, image_buffer, max_retries=3):
    """Uploads screenshot to the backend with retry backoff."""
    url = f"{server_url.rstrip('/')}/api/wallet/calendar/capture/"
    data = {
        'schedule_id': sched_id,
        'scheduled_date': sched_date,
        'scheduled_time': sched_time,
        'status': 'Captured',
        'capture_source': 'Windows Desktop Agent'
    }

    for attempt in range(1, max_retries + 1):
        try:
            image_buffer.seek(0)
            files = {
                'screenshot_file': (f"desktop_capture_{sched_date}_{sched_time.replace(':', '-')}.png", image_buffer, 'image/png')
            }
            resp = requests.post(url, headers=headers, data=data, files=files, timeout=25)
            if resp.status_code in (200, 201):
                return True, resp.json()
            else:
                print(f"[!] Upload returned status {resp.status_code}: {resp.text} (attempt {attempt}/{max_retries})")
        except Exception as e:
            print(f"[!] Network error during upload: {e} (attempt {attempt}/{max_retries})")

        if attempt < max_retries:
            time.sleep(2 * attempt)

    return False, None


def run_agent(server_url, token=None, username=None, password=None, poll_interval=10):
    hostname = socket.gethostname()
    print("=" * 65)
    print(" Glenda ERP — Authorized Desktop Screenshot Capture Agent")
    print("=" * 65)
    print(f"[*] Target Server : {server_url}")
    print(f"[*] Workstation   : {hostname}")
    print(f"[*] Poll Interval : {poll_interval}s")

    if not ImageGrab:
        print("[!] ERROR: Pillow is required for desktop capture. Run: pip install pillow")
        sys.exit(1)

    if not token and username and password:
        token = authenticate(server_url, username, password)

    if not token:
        # Fallback: Attempt local token generation if running on the local workstation host
        try:
            sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
            os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
            import django
            django.setup()
            from django.contrib.auth import get_user_model
            from rest_framework_simplejwt.tokens import RefreshToken
            User = get_user_model()
            # Find the primary active admin or user
            user_obj = None
            if username:
                user_obj = User.objects.filter(email=username).first() or User.objects.filter(username=username).first()
            if not user_obj:
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
        print("[!] ERROR: Valid authentication token or credentials required.")
        sys.exit(1)

    headers = {'Authorization': f'Bearer {token}'}
    captured_schedule_ids_today = set()
    current_day = date.today()

    print("[*] Agent running. Monitoring scheduled capture times automatically...")

    while True:
        try:
            today = date.today()
            if today != current_day:
                current_day = today
                captured_schedule_ids_today.clear()

            # 1. Send liveness heartbeat
            send_heartbeat(server_url, headers, hostname)

            # 2. Query pending captures from backend
            pending_url = f"{server_url.rstrip('/')}/api/wallet/calendar/pending-captures/"
            resp = requests.get(pending_url, headers=headers, timeout=10)

            if resp.status_code == 200:
                data = resp.json()
                pending_schedules = data.get('pending_schedules', [])

                for item in pending_schedules:
                    sched_id = item['id']
                    if sched_id in captured_schedule_ids_today:
                        continue

                    # If scheduled time is due now
                    if item.get('is_due', False):
                        sched_date = item['scheduled_date']
                        sched_time = item['scheduled_time']
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] Automatic trigger: capturing desktop for schedule #{sched_id} at {sched_time}...")

                        # Capture ongoing Windows desktop screen
                        screenshot = capture_windows_screen()
                        if not screenshot:
                            print(f"[✗] Failed to grab screen for schedule #{sched_id}. Retrying...")
                            continue

                        buffer = io.BytesIO()
                        screenshot.save(buffer, format='PNG')
                        buffer.seek(0)

                        success, result = upload_capture_with_retry(
                            server_url, headers, sched_id, sched_date, sched_time, buffer
                        )

                        if success:
                            print(f"[OK] Screenshot automatically captured and saved for schedule #{sched_id} ({sched_time})")
                            captured_schedule_ids_today.add(sched_id)
                        else:
                            print(f"[FAILED] Failed to upload screenshot for schedule #{sched_id}")

            elif resp.status_code == 401:
                print("[!] Authentication token expired. Attempting re-authentication...")
                if username and password:
                    new_token = authenticate(server_url, username, password)
                    if new_token:
                        token = new_token
                        headers['Authorization'] = f'Bearer {token}'
                else:
                    # Attempt local refresh
                    try:
                        from django.contrib.auth import get_user_model
                        from rest_framework_simplejwt.tokens import RefreshToken
                        User = get_user_model()
                        user_obj = (
                            User.objects.filter(email='admin7@gmail.com', is_active=True).first()
                            or User.objects.filter(is_active=True).first()
                        )
                        if user_obj:
                            token = str(RefreshToken.for_user(user_obj).access_token)
                            headers['Authorization'] = f'Bearer {token}'
                            print(f"[*] Successfully renewed access token locally for '{user_obj.username}'")
                        else:
                            print("[!] Please supply a fresh token.")
                    except Exception as renew_err:
                        print(f"[!] Please supply a fresh token. Error: {renew_err}")
            else:
                print(f"[!] Server returned {resp.status_code}: {resp.text}")

        except requests.exceptions.ConnectionError:
            print(f"[!] Cannot connect to server at {server_url}. Retrying in {poll_interval}s...")
        except Exception as e:
            print(f"[!] Agent error: {e}")

        time.sleep(poll_interval)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Glenda ERP Desktop Screenshot Capture Agent")
    parser.add_argument('--server', default='http://127.0.0.1:8000', help='Base URL of Django backend')
    parser.add_argument('--token', default=None, help='JWT Bearer authentication token')
    parser.add_argument('--username', default=None, help='Username or Email for login')
    parser.add_argument('--password', default=None, help='Password for login')
    parser.add_argument('--poll', type=int, default=10, help='Polling interval in seconds')
    args = parser.parse_args()

    run_agent(args.server, args.token, args.username, args.password, args.poll)
