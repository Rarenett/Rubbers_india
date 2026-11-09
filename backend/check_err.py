with open("exported_igs0004.xml", "r", encoding="utf-8") as f:
    text = f.read()

import re
for m in re.finditer(r'<([A-Z0-9_\.]+)[^>]*>(.*?)</\1>', text):
    tag, val = m.group(1), m.group(2).strip()
    if any(k in tag.lower() for k in ["uncertain", "reason", "error", "cess", "ratedetail", "dutyhead"]):
        if val:
            print(f"{tag}: {val}")
