import os
import re
import json
from django.conf import settings


def sync_company_branding(company=None):
    """
    Dynamically syncs Company metadata (display name, description, theme color)
    from the Company table into frontend HTML and manifest files.
    Ensures that social preview scrapers (WhatsApp, Facebook, Twitter)
    always receive the dynamic company name from the database.
    """
    if company is None:
        try:
            from .models import Company
            company = Company.objects.first()
        except Exception:
            company = None

    display_name = ''
    description = 'Enterprise Resource Planning'
    theme_color = '#1a3a72'

    if company:
        display_name = (company.display_name or company.name or '').strip()
        if company.description:
            description = company.description.strip()
        if hasattr(company, 'login_panel_color') and company.login_panel_color:
            theme_color = company.login_panel_color

    if not display_name:
        display_name = 'ERP'

    title_text = f"{display_name} - ERP" if not display_name.endswith('ERP') else display_name

    base_dir = settings.BASE_DIR
    frontend_dir = os.path.abspath(os.path.join(base_dir, '..', 'frontend'))

    html_paths = [
        os.path.join(frontend_dir, 'index.html'),
        os.path.join(frontend_dir, 'build', 'index.html'),
    ]
    manifest_paths = [
        os.path.join(frontend_dir, 'public', 'manifest.json'),
        os.path.join(frontend_dir, 'build', 'manifest.json'),
    ]

    for h_path in html_paths:
        if os.path.exists(h_path):
            try:
                with open(h_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Update <title>
                content = re.sub(r'<title>.*?</title>', f'<title>{title_text}</title>', content, flags=re.IGNORECASE)

                # Update <meta name="description" ...>
                content = re.sub(
                    r'<meta\s+name=["\']description["\']\s+content=["\'].*?["\']\s*/?>',
                    f'<meta name="description" content="{description}" />',
                    content,
                    flags=re.IGNORECASE
                )

                # Update <meta property="og:title" ...>
                content = re.sub(
                    r'<meta\s+property=["\']og:title["\']\s+content=["\'].*?["\']\s*/?>',
                    f'<meta property="og:title" content="{title_text}" />',
                    content,
                    flags=re.IGNORECASE
                )

                # Update <meta property="og:description" ...>
                content = re.sub(
                    r'<meta\s+property=["\']og:description["\']\s+content=["\'].*?["\']\s*/?>',
                    f'<meta property="og:description" content="{description}" />',
                    content,
                    flags=re.IGNORECASE
                )

                # Update <meta name="twitter:title" ...>
                content = re.sub(
                    r'<meta\s+name=["\']twitter:title["\']\s+content=["\'].*?["\']\s*/?>',
                    f'<meta name="twitter:title" content="{title_text}" />',
                    content,
                    flags=re.IGNORECASE
                )

                # Update <meta name="twitter:description" ...>
                content = re.sub(
                    r'<meta\s+name=["\']twitter:description["\']\s+content=["\'].*?["\']\s*/?>',
                    f'<meta name="twitter:description" content="{description}" />',
                    content,
                    flags=re.IGNORECASE
                )

                with open(h_path, 'w', encoding='utf-8') as f:
                    f.write(content)
            except Exception as e:
                print(f"[branding_sync] Failed updating {h_path}: {e}")

    for m_path in manifest_paths:
        if os.path.exists(m_path):
            try:
                with open(m_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                data['short_name'] = display_name
                data['name'] = title_text
                data['theme_color'] = theme_color
                with open(m_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2)
            except Exception as e:
                print(f"[branding_sync] Failed updating {m_path}: {e}")

    return True
