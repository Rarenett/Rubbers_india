import requests
import re

req = """<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>VchExp</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVCURRENTCOMPANY>Test Company</SVCURRENTCOMPANY>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="VchExp">
            <TYPE>Voucher</TYPE>
            <FETCH>*</FETCH>
            <FILTER>ByVchNo</FILTER>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="ByVchNo">$VoucherNumber = "IGS-0004/2026"</SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>"""

r = requests.post("http://localhost:9000", data=req.encode("utf-8"), timeout=5)
print("Length:", len(r.text))
with open("exported_igs0004.xml", "w", encoding="utf-8") as f:
    f.write(r.text)

for line in r.text.splitlines():
    if any(k in line for k in ["RATEDETAIL", "DUTYHEAD", "CESS", "Cess", "GST"]):
        print(" ", line.strip())
