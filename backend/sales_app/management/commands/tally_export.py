import requests
from django.core.management.base import BaseCommand

class Command(BaseCommand):
    help = "Export vouchers to check tags"

    def handle(self, *args, **options):
        url = "http://localhost:9000"
        xml = """<ENVELOPE>
<HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
<BODY><EXPORTDATA>
<REQUESTDESC>
<REPORTNAME>Voucher Register</REPORTNAME>
<STATICVARIABLES>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
<VOUCHERTYPENAME>Sales Order</VOUCHERTYPENAME>
</STATICVARIABLES>
</REQUESTDESC>
</EXPORTDATA></BODY>
</ENVELOPE>"""
        try:
            r = requests.post(url, data=xml.encode("utf-8"), headers={"Content-Type": "text/xml"}, timeout=10)
            self.stdout.write(r.text[:5000])
        except Exception as e:
            self.stdout.write(str(e))
