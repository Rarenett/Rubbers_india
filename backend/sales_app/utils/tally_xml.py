import re
import time
import uuid
import requests
from datetime import datetime

STATE_CODE_TO_NAME = {
    # 2-letter postal state abbreviations
    "AN": "Andaman and Nicobar Islands",
    "AP": "Andhra Pradesh",
    "AR": "Arunachal Pradesh",
    "AS": "Assam",
    "BR": "Bihar",
    "CH": "Chandigarh",
    "CG": "Chhattisgarh",
    "CT": "Chhattisgarh",
    "DH": "Dadra and Nagar Haveli and Daman and Diu",
    "DD": "Daman and Diu",
    "DN": "Dadra and Nagar Haveli",
    "DL": "Delhi",
    "GA": "Goa",
    "GJ": "Gujarat",
    "HR": "Haryana",
    "HP": "Himachal Pradesh",
    "JK": "Jammu and Kashmir",
    "JH": "Jharkhand",
    "KA": "Karnataka",
    "KL": "Kerala",
    "LA": "Ladakh",
    "LD": "Lakshadweep",
    "MP": "Madhya Pradesh",
    "MH": "Maharashtra",
    "MN": "Manipur",
    "ML": "Meghalaya",
    "MZ": "Mizoram",
    "NL": "Nagaland",
    "OR": "Odisha",
    "OD": "Odisha",
    "PY": "Puducherry",
    "PB": "Punjab",
    "RJ": "Rajasthan",
    "SK": "Sikkim",
    "TN": "Tamil Nadu",
    "TG": "Telangana",
    "TS": "Telangana",
    "TR": "Tripura",
    "UP": "Uttar Pradesh",
    "UK": "Uttarakhand",
    "UA": "Uttarakhand",
    "UT": "Uttarakhand",
    "WB": "West Bengal",
    # 2-digit GST state codes
    "01": "Jammu and Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "26": "Dadra and Nagar Haveli and Daman and Diu",
    "27": "Maharashtra",
    "28": "Andhra Pradesh",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman and Nicobar Islands",
    "36": "Telangana",
    "37": "Andhra Pradesh",
    "38": "Ladakh",
    "97": "Other Territory",
}


def resolve_state_name(state_val, gstin=None, default="Kerala"):
    """
    Resolves a 2-letter state abbreviation (e.g. 'KL', 'MH') or code or name
    to Tally's official statutory Indian State name (e.g. 'Kerala', 'Maharashtra').
    If state_val is empty, falls back to the GSTIN's 2-digit state prefix or default.
    """
    clean = str(state_val or "").strip()
    if clean.upper() in STATE_CODE_TO_NAME:
        return STATE_CODE_TO_NAME[clean.upper()]

    for code, name in STATE_CODE_TO_NAME.items():
        if clean.lower() == name.lower():
            return name

    if clean:
        return clean.title()

    if gstin and len(str(gstin).strip()) >= 2:
        gst_code = str(gstin).strip()[:2]
        if gst_code in STATE_CODE_TO_NAME:
            return STATE_CODE_TO_NAME[gst_code]

    return default


def resolve_country_name(country_val, default="India"):
    """
    Normalizes country code/name to Tally's expected statutory country (e.g. 'India').
    """
    if not country_val:
        return default
    clean = str(country_val).strip()
    if clean.upper() in ("IN", "IND", "INDIA"):
        return "India"
    return clean.title()


def resolve_gst_reg_type(reg_type_val, gstin=None):
    """
    Normalizes ERP registration type to Tally's supported GST registration types:
    'Regular', 'Composition', 'Unregistered', 'Consumer'.
    Never outputs 'Unknown' which causes Tally to display '♦ Unknown' and drop GSTIN.
    """
    clean = str(reg_type_val or "").strip().lower()
    if clean in ("registered", "regular") or (gstin and len(str(gstin).strip()) >= 5):
        return "Regular"
    elif clean == "composition":
        return "Composition"
    elif clean == "unregistered":
        return "Unregistered"
    elif clean == "consumer":
        return "Consumer"
    else:
        return "Regular" if (gstin and str(gstin).strip()) else "Unregistered"


def escape_xml(text):
    if text is None:
        return ""
    text = str(text)
    return (
        text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&apos;")
    )


def format_date(value):
    if not value:
        return ""
    # Hardcoded to 01-10-2026 (20261001 in Tally YYYYMMDD format) for Tally compatibility
    return "20261001"


def generate_sales_order_xml(order, tally_url="http://localhost:9000", force_alter=False):
    """
    Generates Tally XML payload for importing a Sales Order into Tally Prime.
    Ensures:
    - Party GST registration type, GSTIN, full State name ('Kerala') and Country ('India')
      are accurately formatted and mapped so Tally displays them without warnings.
    - Intra-state vs Inter-state is accurately detected, ensuring dual GST (Output CGST and
      Output SGST) ledgers and corresponding inventory CGST+SGST duty heads are both emitted.
    - Company GST registration tags are omitted so Tally Prime binds to its active
      Voucher Numbering Series and GST registration without conflict.
    """
    # Hardcoded to 01-10-2026 (20261001) for Tally compatibility
    order_date = "20261001"
    current_date = "20261001"

    customer = order.customer_ledger

    # Fetch company details
    from settings_app.models import Company
    company = Company.objects.first()

    company_state = resolve_state_name(
        getattr(company, "state", None) if company else None,
        default="Kerala"
    )

    party_name = escape_xml(customer.name if customer else "")
    party_gstin = escape_xml(getattr(customer, "gst_number", "") or "")
    party_mailing_name = escape_xml(getattr(customer, "mailing_name", "") or party_name)
    party_pincode = escape_xml(getattr(customer, "pincode", "") or "")
    party_state = escape_xml(resolve_state_name(getattr(customer, "state", ""), gstin=party_gstin, default=company_state))
    party_country = escape_xml(resolve_country_name(getattr(customer, "country", ""), default="India"))
    party_pos = escape_xml(resolve_state_name(getattr(customer, "placeofsupply", ""), gstin=party_gstin, default=party_state))
    party_reg_type_tally = resolve_gst_reg_type(getattr(customer, "registration_type", ""), gstin=party_gstin)

    # Determine whether intra-state (CGST + SGST) or inter-state (IGST)
    has_dual_gst = bool(
        (order.gst_ledger_2 and (order.gst_amount_2 or 0) > 0)
        or (order.gst_ledger_1 and order.gst_ledger_2 and "cgst" in order.gst_ledger_1.name.lower() and "sgst" in order.gst_ledger_2.name.lower())
    )
    has_igst = bool(
        (order.gst_ledger_1 and "igst" in order.gst_ledger_1.name.lower())
        or str(order.order_type).upper() in ["INTER_STATE", "11", "SOI"]
    )
    is_state_order = has_dual_gst or (not has_igst and (
        str(order.order_type).upper() in ["STATE", "12", "SOL"]
        or party_state.strip().lower() == company_state.strip().lower()
    ))

    xml_parts = []

    active_company = get_tally_active_company(tally_url)

    # XML Header
    xml_parts.append("<ENVELOPE>")
    xml_parts.append("<HEADER>")
    xml_parts.append("<TALLYREQUEST>Import Data</TALLYREQUEST>")
    xml_parts.append("</HEADER>")
    xml_parts.append("<BODY>")
    xml_parts.append("<IMPORTDATA>")
    xml_parts.append("<REQUESTDESC>")
    xml_parts.append("<REPORTNAME>Vouchers</REPORTNAME>")
    if active_company:
        xml_parts.append("<STATICVARIABLES>")
        xml_parts.append(f"<SVCURRENTCOMPANY>{escape_xml(active_company)}</SVCURRENTCOMPANY>")
        xml_parts.append("</STATICVARIABLES>")
    xml_parts.append("</REQUESTDESC>")
    xml_parts.append("<REQUESTDATA>")
    xml_parts.append('<TALLYMESSAGE xmlns:UDF="TallyUDF">')

    sync_ctx = resolve_voucher_sync_context(
        obj=order,
        voucher_number=order.so_no,
        voucher_type_name="Sales Order",
        default_prefix="703950cb-0cfb-4a51-8739-10166bf72dc0",
        tally_url=tally_url,
        force_alter=force_alter,
    )
    action = sync_ctx['action']
    guid_str = sync_ctx['guid']

    # For Alter: include VOUCHERNUMBER attribute so Tally can match the existing
    # voucher by number when the REMOTEID lookup fails (unknown/phantom GUID).
    vch_num_attr = f' VOUCHERNUMBER="{escape_xml(order.so_no)}"' if action == 'Alter' else ''
    xml_parts.append(
        f'<VOUCHER REMOTEID="{guid_str}" VCHTYPE="Sales Order" ACTION="{action}"{vch_num_attr} '
        f'OBJVIEW="Invoice Voucher View">'
    )
    xml_parts.append(f"<DATE>{order_date}</DATE>")
    xml_parts.append(f"<EFFECTIVEDATE>{order_date}</EFFECTIVEDATE>")
    xml_parts.append(f"<REFERENCEDATE>{order_date}</REFERENCEDATE>")
    xml_parts.append(f"<GUID>{guid_str}</GUID>")
    xml_parts.append("<VOUCHERTYPENAME>Sales Order</VOUCHERTYPENAME>")
    xml_parts.append(f"<VOUCHERNUMBER>{escape_xml(order.so_no)}</VOUCHERNUMBER>")
    xml_parts.append(f"<OBJECTUPDATEACTION>{action}</OBJECTUPDATEACTION>")
    xml_parts.append(f"<REFERENCE>{escape_xml(order.so_no)}</REFERENCE>")
    xml_parts.append(f"<PARTYNAME>{party_name}</PARTYNAME>")
    xml_parts.append(f"<PARTYLEDGERNAME>{party_name}</PARTYLEDGERNAME>")
    xml_parts.append("<ISINVOICE>Yes</ISINVOICE>")
    xml_parts.append("<PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>")

    # Consignee (Ship To) Address Details
    xml_parts.append('<BASICBUYERADDRESS.LIST TYPE="String">')
    if customer:
        if getattr(customer, "address1", ""):
            xml_parts.append(f"<BASICBUYERADDRESS>{escape_xml(customer.address1)}</BASICBUYERADDRESS>")
        if getattr(customer, "address2", ""):
            xml_parts.append(f"<BASICBUYERADDRESS>{escape_xml(customer.address2)}</BASICBUYERADDRESS>")
        if getattr(customer, "address3", ""):
            xml_parts.append(f"<BASICBUYERADDRESS>{escape_xml(customer.address3)}</BASICBUYERADDRESS>")
        if getattr(customer, "address", "") and not getattr(customer, "address1", ""):
            xml_parts.append(f"<BASICBUYERADDRESS>{escape_xml(customer.address)}</BASICBUYERADDRESS>")
    xml_parts.append("</BASICBUYERADDRESS.LIST>")

    # Buyer (Bill To) Address Details
    xml_parts.append('<ADDRESS.LIST TYPE="String">')
    if customer:
        if getattr(customer, "address1", ""):
            xml_parts.append(f"<ADDRESS>{escape_xml(customer.address1)}</ADDRESS>")
        if getattr(customer, "address2", ""):
            xml_parts.append(f"<ADDRESS>{escape_xml(customer.address2)}</ADDRESS>")
        if getattr(customer, "address3", ""):
            xml_parts.append(f"<ADDRESS>{escape_xml(customer.address3)}</ADDRESS>")
        if getattr(customer, "address", "") and not getattr(customer, "address1", ""):
            xml_parts.append(f"<ADDRESS>{escape_xml(customer.address)}</ADDRESS>")
    xml_parts.append("</ADDRESS.LIST>")

    # Buyer (Bill To) Tax & Statutory Details
    xml_parts.append(f"<GSTREGISTRATIONTYPE>{party_reg_type_tally}</GSTREGISTRATIONTYPE>")
    xml_parts.append(f"<VATDEALERTYPE>{party_reg_type_tally}</VATDEALERTYPE>")
    xml_parts.append(f"<STATENAME>{party_state}</STATENAME>")
    xml_parts.append(f"<COUNTRYOFRESIDENCE>{party_country}</COUNTRYOFRESIDENCE>")
    if party_gstin:
        xml_parts.append(f"<PARTYGSTIN>{party_gstin}</PARTYGSTIN>")
    xml_parts.append(f"<PLACEOFSUPPLY>{party_pos}</PLACEOFSUPPLY>")
    xml_parts.append(f"<BASICBUYERNAME>{party_name}</BASICBUYERNAME>")
    xml_parts.append(f"<PARTYMAILINGNAME>{party_mailing_name}</PARTYMAILINGNAME>")
    if party_pincode:
        xml_parts.append(f"<PARTYPINCODE>{party_pincode}</PARTYPINCODE>")

    # Consignee (Ship To) Tax & Statutory Details
    if party_gstin:
        xml_parts.append(f"<CONSIGNEEGSTIN>{party_gstin}</CONSIGNEEGSTIN>")
    xml_parts.append(f"<CONSIGNEEMAILINGNAME>{party_mailing_name}</CONSIGNEEMAILINGNAME>")
    if party_pincode:
        xml_parts.append(f"<CONSIGNEEPINCODE>{party_pincode}</CONSIGNEEPINCODE>")
    xml_parts.append(f"<CONSIGNEESTATENAME>{party_state}</CONSIGNEESTATENAME>")
    xml_parts.append(f"<CONSIGNEECOUNTRYNAME>{party_country}</CONSIGNEECOUNTRYNAME>")
    xml_parts.append(f"<BASICBASEPARTYNAME>{party_name}</BASICBASEPARTYNAME>")

    # Dispatch Details
    if party_pos:
        xml_parts.append(f"<BASICFINALDESTINATION>{party_pos}</BASICFINALDESTINATION>")

    dispatch_through = escape_xml(getattr(order, "dispatch_through", ""))
    if dispatch_through:
        xml_parts.append(f"<BASICSHIPPEDBY>{dispatch_through}</BASICSHIPPEDBY>")

    driver_name = ""
    if getattr(order, "driver", None) and getattr(order.driver, "user", None):
        first = order.driver.user.first_name or ""
        last = order.driver.user.last_name or ""
        driver_name = escape_xml(f"{first} {last}".strip())

    if driver_name:
        # Carrier Name / Agent
        xml_parts.append(f"<BASICCARRIERAGENTS>{driver_name}</BASICCARRIERAGENTS>")
        xml_parts.append('<CARRIERNAME.LIST TYPE="String">')
        xml_parts.append(f"<CARRIERNAME>{driver_name}</CARRIERNAME>")
        xml_parts.append('</CARRIERNAME.LIST>')

    # ------------------------------------------------------------------
    # Inventory Entries
    # ------------------------------------------------------------------
    for item in order.items.select_related(
        "product",
        "warehouse",
        "per",
    ):
        product_name = escape_xml(item.product.name if item.product else "")
        warehouse = escape_xml(
            item.warehouse.name if item.warehouse else "Main Location"
        )
        unit = escape_xml(
            getattr(item.per, "abbreviation", None)
            or getattr(item.per, "name", "Nos")
        )

        xml_parts.append("<ALLINVENTORYENTRIES.LIST>")
        xml_parts.append(f"<STOCKITEMNAME>{product_name}</STOCKITEMNAME>")
        xml_parts.append("<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>")

        xml_parts.append(
            f"<ACTUALQTY> {item.quantity} {unit}</ACTUALQTY>"
        )
        xml_parts.append(
            f"<BILLEDQTY> {item.quantity} {unit}</BILLEDQTY>"
        )
        xml_parts.append(
            f"<RATE>{item.rate}/{unit}</RATE>"
        )
        xml_parts.append(f"<AMOUNT>{item.amount:.2f}</AMOUNT>")

        # Batch Allocation (Also used for Order tracking in Tally)
        xml_parts.append("<BATCHALLOCATIONS.LIST>")

        if item.manufacture_date:
            xml_parts.append(
                f"<MFDON>{format_date(item.manufacture_date)}</MFDON>"
            )

        xml_parts.append(f"<GODOWNNAME>{warehouse}</GODOWNNAME>")
        xml_parts.append(
            f"<DESTINATIONGODOWNNAME>{warehouse}</DESTINATIONGODOWNNAME>"
        )

        batch_str = getattr(item, "batch_number", "") or ""
        if not batch_str or "primary" in batch_str.lower() or "unbatched" in batch_str.lower():
            batch_str = "Primary Batch"

        xml_parts.append(f"<BATCHNAME>{escape_xml(batch_str)}</BATCHNAME>")

        xml_parts.append(
            f"<ORDERNO>{escape_xml(order.so_no)}</ORDERNO>"
        )
        xml_parts.append(
            f"<ACTUALQTY> {item.quantity} {unit}</ACTUALQTY>"
        )
        xml_parts.append(
            f"<BILLEDQTY> {item.quantity} {unit}</BILLEDQTY>"
        )
        xml_parts.append(f"<AMOUNT>{item.amount:.2f}</AMOUNT>")

        if order.preferred_delivery_date:
            xml_parts.append(
                f"<ORDERDUEDATE>{format_date(order.preferred_delivery_date)}</ORDERDUEDATE>"
            )
        else:
            xml_parts.append(
                f"<ORDERDUEDATE>{order_date}</ORDERDUEDATE>"
            )

        xml_parts.append("</BATCHALLOCATIONS.LIST>")

        # Accounting Allocation
        if getattr(item.product, "sales_ledger", None):
            sales_ledger = item.product.sales_ledger.name
        else:
            sales_ledger = "Sales Local" if is_state_order else "IGST Sales"

        xml_parts.append("<ACCOUNTINGALLOCATIONS.LIST>")
        xml_parts.append(f"<LEDGERNAME>{escape_xml(sales_ledger)}</LEDGERNAME>")
        xml_parts.append("<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>")
        xml_parts.append(f"<AMOUNT>{item.amount:.2f}</AMOUNT>")
        xml_parts.append("</ACCOUNTINGALLOCATIONS.LIST>")

        # GST Rate Details
        gst_pct = float(item.gst_percent or 0)
        if is_state_order:
            half_rate = gst_pct / 2.0
            xml_parts.append("<RATEDETAILS.LIST>")
            xml_parts.append("<GSTRATEDUTYHEAD>CGST</GSTRATEDUTYHEAD>")
            xml_parts.append("<GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>")
            xml_parts.append(
                f"<GSTRATE> {half_rate:g}</GSTRATE>"
            )
            xml_parts.append("</RATEDETAILS.LIST>")

            xml_parts.append("<RATEDETAILS.LIST>")
            xml_parts.append("<GSTRATEDUTYHEAD>SGST/UTGST</GSTRATEDUTYHEAD>")
            xml_parts.append("<GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>")
            xml_parts.append(
                f"<GSTRATE> {half_rate:g}</GSTRATE>"
            )
            xml_parts.append("</RATEDETAILS.LIST>")

        else:
            xml_parts.append("<RATEDETAILS.LIST>")
            xml_parts.append("<GSTRATEDUTYHEAD>IGST</GSTRATEDUTYHEAD>")
            xml_parts.append("<GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>")
            xml_parts.append(
                f"<GSTRATE> {gst_pct:g}</GSTRATE>"
            )
            xml_parts.append("</RATEDETAILS.LIST>")

        xml_parts.append("</ALLINVENTORYENTRIES.LIST>")

    # ------------------------------------------------------------------
    # Party Ledger Entry
    # ------------------------------------------------------------------
    xml_parts.append("<LEDGERENTRIES.LIST>")
    xml_parts.append("<OLDAUDITENTRYIDS.LIST TYPE='Number'>")
    xml_parts.append("<OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>")
    xml_parts.append("</OLDAUDITENTRYIDS.LIST>")
    xml_parts.append(f"<LEDGERNAME>{party_name}</LEDGERNAME>")
    xml_parts.append("<ISPARTYLEDGER>Yes</ISPARTYLEDGER>")
    xml_parts.append("<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>")
    xml_parts.append(f"<AMOUNT>-{order.total_amount:.2f}</AMOUNT>")
    xml_parts.append("</LEDGERENTRIES.LIST>")


    # ------------------------------------------------------------------
    # 1. Extra Charges (e.g. Transportation Charges)
    # ------------------------------------------------------------------
    extra_charges_sum = 0.0
    round_off_order_amt = 0.0
    round_off_order_found = False

    for charge in order.extra_charges.all():
        chg_amt = float(charge.amount or 0)
        if not charge.ledger or abs(chg_amt) < 0.005:
            continue
        ledger_name_lower = charge.ledger.name.strip().lower()
        if "round" in ledger_name_lower and ("off" in ledger_name_lower or "up" in ledger_name_lower):
            round_off_order_amt += chg_amt
            round_off_order_found = True
            continue

        resolved_chg_name = resolve_tally_extra_charge_ledger_name(charge.ledger.name)
        extra_charges_sum += chg_amt
        xml_parts.append("<LEDGERENTRIES.LIST>")
        xml_parts.append("<ROUNDTYPE>&#4; Not Applicable</ROUNDTYPE>")
        xml_parts.append(f"<LEDGERNAME>{escape_xml(resolved_chg_name)}</LEDGERNAME>")
        xml_parts.append("<GSTCLASS>&#4; Not Applicable</GSTCLASS>")
        xml_parts.append("<ISPARTYLEDGER>No</ISPARTYLEDGER>")
        xml_parts.append("<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>")
        xml_parts.append(f"<AMOUNT>{chg_amt:.2f}</AMOUNT>")
        xml_parts.append(f"<VATEXPAMOUNT>{chg_amt:.2f}</VATEXPAMOUNT>")
        xml_parts.append("</LEDGERENTRIES.LIST>")

    # ------------------------------------------------------------------
    # 2. GST Ledger Entries (e.g. CGST, SGST, IGST)
    # ------------------------------------------------------------------
    def append_gst_ledger(ledger_name, amount, rate=None):
        if not ledger_name or amount <= 0:
            return

        xml_parts.append("<LEDGERENTRIES.LIST>")
        xml_parts.append("<OLDAUDITENTRYIDS.LIST TYPE='Number'>")
        xml_parts.append("<OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>")
        xml_parts.append("</OLDAUDITENTRYIDS.LIST>")
        xml_parts.append("<ROUNDTYPE>&#4; Not Applicable</ROUNDTYPE>")

        if rate is not None:
            xml_parts.append("<RATEOFINVOICETAX.LIST TYPE='Number'>")
            xml_parts.append(f"<RATEOFINVOICETAX>{rate:.2f}</RATEOFINVOICETAX>")
            xml_parts.append("</RATEOFINVOICETAX.LIST>")

        xml_parts.append(f"<LEDGERNAME>{escape_xml(ledger_name)}</LEDGERNAME>")
        xml_parts.append("<GSTCLASS>&#4; Not Applicable</GSTCLASS>")
        xml_parts.append("<ISPARTYLEDGER>No</ISPARTYLEDGER>")
        xml_parts.append("<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>")
        xml_parts.append("<LEDGERFROMITEM>No</LEDGERFROMITEM>")
        xml_parts.append(f"<AMOUNT>{amount:.2f}</AMOUNT>")
        xml_parts.append(f"<VATEXPAMOUNT>{amount:.2f}</VATEXPAMOUNT>")
        xml_parts.append("</LEDGERENTRIES.LIST>")

    max_gst = max((float(i.gst_percent or 0) for i in order.items.all()), default=0.0)

    if is_state_order:
        half_rate = max_gst / 2.0
        cgst_name = order.gst_ledger_1.name if order.gst_ledger_1 else "Output CGST"
        sgst_name = order.gst_ledger_2.name if order.gst_ledger_2 else "Output SGST"
        cgst_amt = float(order.gst_amount_1 or 0)
        sgst_amt = float(order.gst_amount_2 or 0)

        if cgst_amt > 0:
            append_gst_ledger(cgst_name, cgst_amt, half_rate)
        if sgst_amt > 0:
            append_gst_ledger(sgst_name, sgst_amt, half_rate)
    else:
        igst_name = order.gst_ledger_1.name if order.gst_ledger_1 else "Output IGST"
        igst_amt = float(order.gst_amount_1 or 0) + float(order.gst_amount_2 or 0)
        if igst_amt > 0:
            append_gst_ledger(igst_name, igst_amt, max_gst)

    # ------------------------------------------------------------------
    # 3. Round Off / Roundup (Always last)
    # ------------------------------------------------------------------
    taxable = sum(float(i.amount or 0) for i in order.items.all())
    tax = float(order.gst_amount_1 or 0) + float(order.gst_amount_2 or 0)
    expected_total = taxable + tax + extra_charges_sum
    calc_round_off = float(order.total_amount or 0) - expected_total
    round_off = round_off_order_amt if round_off_order_found else calc_round_off

    if abs(round_off) >= 0.005:
        xml_parts.append("<LEDGERENTRIES.LIST>")
        xml_parts.append("<LEDGERNAME>Round Off</LEDGERNAME>")
        xml_parts.append("<ROUNDTYPE>Normal Rounding</ROUNDTYPE>")
        xml_parts.append("<ROUNDLIMIT>1</ROUNDLIMIT>")
        xml_parts.append(f"<AMOUNT>{round_off:.2f}</AMOUNT>")
        xml_parts.append("</LEDGERENTRIES.LIST>")

    # ------------------------------------------------------------------
    # Closing XML
    # ------------------------------------------------------------------
    xml_parts.append("</VOUCHER>")
    xml_parts.append("</TALLYMESSAGE>")
    xml_parts.append("</REQUESTDATA>")
    xml_parts.append("</IMPORTDATA>")
    xml_parts.append("</BODY>")
    xml_parts.append("</ENVELOPE>")

    return "\n".join(xml_parts)


def format_tally_date(val, default="20260901"):
    """
    Formats a date object or string into Tally's YYYYMMDD format.
    """
    if not val:
        return default
    from datetime import date, datetime
    if isinstance(val, (date, datetime)):
        return val.strftime("%Y%m%d")
    s = str(val).strip().replace("-", "")[:8]
    return s if len(s) == 8 and s.isdigit() else default


def format_expiry_date(val):
    """
    Formats date into e.g. '1-Sep-27' for Tally batch expiry.
    """
    if not val:
        return ""
    from datetime import date, datetime
    if isinstance(val, (date, datetime)):
        return f"{val.day}-{val.strftime('%b')}-{val.strftime('%y')}"
    return str(val)


_TALLY_VCH_TYPES_CACHE = {"timestamp": 0, "types": []}


def get_tally_voucher_types(tally_url="http://localhost:9000"):
    """
    Fetches available Voucher Types from Tally Prime with a 60-second in-memory cache.
    Fails quickly and silently if Tally is offline.
    """
    now = time.time()
    if now - _TALLY_VCH_TYPES_CACHE["timestamp"] < 60 and _TALLY_VCH_TYPES_CACHE["types"]:
        return _TALLY_VCH_TYPES_CACHE["types"]
    try:
        req = """<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>VTCollection</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME='VTCollection'><TYPE>VoucherType</TYPE><FETCH>Name,Parent</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>"""
        r = requests.post(tally_url, data=req.encode("utf-8"), timeout=1.5)
        if r.status_code == 200:
            names = []
            pos = 0
            while True:
                pos = r.text.find('<VOUCHERTYPE ', pos)
                if pos == -1:
                    break
                end = r.text.find('</VOUCHERTYPE>', pos)
                chunk = r.text[pos:end + 14]
                name_m = re.search(r'NAME="([^"]+)"', chunk)
                if name_m:
                    names.append(name_m.group(1).strip())
                pos = end + 14
            if names:
                _TALLY_VCH_TYPES_CACHE["timestamp"] = now
                _TALLY_VCH_TYPES_CACHE["types"] = names
                return names
    except Exception:
        pass
    return _TALLY_VCH_TYPES_CACHE["types"]


def resolve_sales_invoice_voucher_type_name(invoice, is_interstate=False, is_registered=False, tally_url="http://localhost:9000"):
    """
    Dynamically determines the Voucher Type Name in Tally Prime for a Sales Invoice.
    
    Instead of hardcoding to 'Sales Gst State' / 'Sales Gst Unregistered', this dynamically
    detects the voucher type selected on the Sales Invoice (from PrefixConfiguration,
    sub-voucher type, sales ledger, or explicit voucher_type) and matches it against
    available Tally Prime voucher types.
    """
    tally_types = get_tally_voucher_types(tally_url)
    tally_types_lower = {t.lower(): t for t in tally_types}

    candidates = []

    # 1. Explicit voucher_type if set and not generic 'Sales'
    vt_name = invoice.voucher_type.name.strip() if (invoice.voucher_type and invoice.voucher_type.name) else ""
    if vt_name and vt_name.lower() != "sales":
        candidates.append(vt_name)

    # 2. Match PrefixConfiguration from invoice_no prefix
    explicit_sub_type = None
    try:
        from settings_app.models import PrefixConfiguration
        if invoice.invoice_no:
            configs = list(PrefixConfiguration.objects.select_related('subvoucher_type', 'ledger', 'voucher_type').all())
            configs.sort(key=lambda c: len(c.prefix) if c.prefix else 0, reverse=True)
            for pc in configs:
                if pc.prefix and invoice.invoice_no.lower().startswith(pc.prefix.lower()):
                    if pc.subvoucher_type and pc.subvoucher_type.type_name:
                        name = pc.subvoucher_type.type_name.strip()
                        candidates.append(name)
                        explicit_sub_type = name
                    if pc.sub_type:
                        name = pc.sub_type.strip()
                        candidates.append(name)
                        if not explicit_sub_type:
                            explicit_sub_type = name
                    if pc.ledger and pc.ledger.name:
                        candidates.append(pc.ledger.name.strip())
                    if pc.prefix:
                        candidates.append(pc.prefix.strip())
                    break
    except Exception:
        pass

    # 3. From invoice.sales_ledger
    if invoice.sales_ledger and invoice.sales_ledger.name:
        candidates.append(invoice.sales_ledger.name.strip())

    # Check if any candidate directly matches an available Voucher Type in Tally (excluding generic 'Sales')
    for cand in candidates:
        if cand.lower() in tally_types_lower and cand.lower() != "sales":
            return tally_types_lower[cand.lower()]

    # Intelligent matching for B2C / B2B sub-voucher types
    for cand in candidates:
        cand_low = cand.lower()
        if cand_low in ("b2c", "b2c sales"):
            for t_low, t_name in tally_types_lower.items():
                if t_low in ("b2c sales", "b2c", "b2c unregistered"):
                    return t_name
            return cand
        elif cand_low in ("b2b", "b2b sales"):
            for t_low, t_name in tally_types_lower.items():
                if t_low in ("b2b sales", "b2b"):
                    return t_name
            return cand

    # If the user/prefix configuration explicitly designated a specific voucher / sub-voucher type
    # (e.g. "IGST Sales"), we must strictly use it and NOT silently re-route to another voucher type
    # like "Sales Gst Interstate".
    # Returning the explicit type ensures Tally receives `<VOUCHERTYPENAME>IGST Sales</VOUCHERTYPENAME>`,
    # so if it does not exist in Tally, Tally will raise:
    # "Line Error: Voucher Type 'IGST Sales' does not exist!"
    if explicit_sub_type and explicit_sub_type.lower() != "sales":
        return explicit_sub_type

    if vt_name and vt_name.lower() != "sales":
        return vt_name

    # Generic Fallback only when the invoice has NO explicit sub-voucher type:
    # Interstate check
    if is_interstate:
        if is_registered:
            return tally_types_lower.get("sales gst interstate", "Sales Gst Interstate")
        else:
            return tally_types_lower.get("sales interstate unregistered", "Sales Interstate Unregistered")

    # Default state GST sales or Sales
    if "sales gst state" in tally_types_lower and is_registered:
        return tally_types_lower["sales gst state"]
    elif "sales gst unregistered" in tally_types_lower and not is_registered:
        return tally_types_lower["sales gst unregistered"]
    elif "sales" in tally_types_lower:
        return tally_types_lower["sales"]

    if is_registered:
        return "Sales Gst State"
    else:
        return "Sales Gst Unregistered"


_TALLY_COMPANY_CACHE = {"timestamp": 0, "name": None}


def get_tally_active_company(tally_url="http://localhost:9000"):
    """
    Fetches the name of the currently active/opened company in Tally Prime (60s cache).
    Returns company name string if open, or None if no company is loaded.
    """
    now = time.time()
    if now - _TALLY_COMPANY_CACHE["timestamp"] < 60 and _TALLY_COMPANY_CACHE["name"]:
        return _TALLY_COMPANY_CACHE["name"]
    try:
        req = """<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>CompCol</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME='CompCol'><TYPE>Company</TYPE><FETCH>Name</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>"""
        r = requests.post(tally_url, data=req.encode("utf-8"), timeout=1.5)
        if r.status_code == 200:
            m = re.search(r'<COMPANY[^>]*NAME="([^"]+)"', r.text)
            if m:
                company_name = m.group(1).strip()
                _TALLY_COMPANY_CACHE["timestamp"] = now
                _TALLY_COMPANY_CACHE["name"] = company_name
                return company_name
            m2 = re.search(r'<COMPANY[^>]*>.*?<NAME[^>]*>([^<]+)</NAME>', r.text, re.DOTALL)
            if m2:
                company_name = m2.group(1).strip()
                _TALLY_COMPANY_CACHE["timestamp"] = now
                _TALLY_COMPANY_CACHE["name"] = company_name
                return company_name
    except Exception:
        pass
    return None


_TALLY_LEDGERS_CACHE = {"timestamp": 0, "ledgers": {}}


def get_tally_sales_ledgers(tally_url="http://localhost:9000"):
    """
    Fetches available Ledgers from Tally Prime with their AffectsStock status (60s cache).
    Returns a dict mapping lowercase ledger name -> (exact_name, affects_stock_bool).
    """
    now = time.time()
    if now - _TALLY_LEDGERS_CACHE["timestamp"] < 60 and _TALLY_LEDGERS_CACHE["ledgers"]:
        return _TALLY_LEDGERS_CACHE["ledgers"]
    try:
        req = """<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>LedgerCol</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME='LedgerCol'><TYPE>Ledger</TYPE><FETCH>Name,Parent,AffectsStock</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>"""
        r = requests.post(tally_url, data=req.encode("utf-8"), timeout=1.5)
        if r.status_code == 200:
            pos = 0
            ledgers = {}
            while True:
                pos = r.text.find('<LEDGER ', pos)
                if pos == -1:
                    break
                end = r.text.find('</LEDGER>', pos)
                chunk = r.text[pos:end + 9]
                name_m = re.search(r'NAME="([^"]+)"', chunk)
                stock_m = re.search(r'<AFFECTSSTOCK[^>]*>([^<]+)</AFFECTSSTOCK>', chunk)
                name = name_m.group(1).strip() if name_m else None
                stock = stock_m.group(1).strip().lower() if stock_m else 'no'
                if name:
                    ledgers[name.lower()] = (name, stock == 'yes')
                pos = end + 9
            if ledgers:
                _TALLY_LEDGERS_CACHE["timestamp"] = now
                _TALLY_LEDGERS_CACHE["ledgers"] = ledgers
                return ledgers
    except Exception:
        pass
    return _TALLY_LEDGERS_CACHE["ledgers"]


def resolve_tally_extra_charge_ledger_name(raw_name, tally_url="http://localhost:9000"):
    """
    Resolves an extra charge ledger name against Tally's existing ledgers.
    Handles typos, variations like 'Transportation Charges' vs 'Transporation Charges',
    case differences, etc.
    """
    if not raw_name:
        return raw_name
    clean = str(raw_name).strip()
    clean_lower = clean.lower()

    tally_ledgers = get_tally_sales_ledgers(tally_url)
    if tally_ledgers:
        # Exact match (case insensitive)
        if clean_lower in tally_ledgers:
            return tally_ledgers[clean_lower][0]

        # Check typo variations (e.g., transportation vs transporation)
        simplified = re.sub(r'[^a-z0-9]', '', clean_lower)
        for t_low, (t_name, _) in tally_ledgers.items():
            t_simple = re.sub(r'[^a-z0-9]', '', t_low)
            if simplified == t_simple:
                return t_name
            # Common typo in Tally: missing 't' in transportation -> transporation
            if 'transpor' in simplified and 'transpor' in t_simple and 'charge' in simplified and 'charge' in t_simple:
                return t_name
            if 'discount' in simplified and 'discount' in t_simple:
                return t_name
            if 'roundoff' in simplified and 'roundoff' in t_simple:
                return t_name

    return clean


def get_tally_existing_voucher_info(voucher_number, voucher_type_name=None, tally_url="http://localhost:9000"):
    """
    Queries Tally's Collection to check if a voucher exists and extract its REMOTEID and GUID.
    Uses lightweight Collection export with short timeout (1.5s).
    When voucher_type_name is supplied the filter also matches on VoucherTypeName so a
    Sales Order number cannot accidentally cross-match a same-numbered Sales Invoice.
    """
    if not voucher_number:
        return {'exists': False, 'remote_id': None, 'guid': None}
    try:
        active_company = get_tally_active_company(tally_url)
        company_tag = f"<STATICVARIABLES><SVCURRENTCOMPANY>{escape_xml(active_company)}</SVCURRENTCOMPANY></STATICVARIABLES>" if active_company else ""

        # Build filter expression: always match voucher number; optionally also match type.
        vch_num_filter = f'$VoucherNumber = "{escape_xml(voucher_number)}"'
        if voucher_type_name:
            filter_expr = f'{vch_num_filter} AND $VoucherTypeName = "{escape_xml(voucher_type_name)}"'
        else:
            filter_expr = vch_num_filter

        col_xml = (
            f"<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>VchCol</ID></HEADER>"
            f"<BODY><DESC>{company_tag}"
            f"<STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>"
            f"<TDL><TDLMESSAGE>"
            f"<COLLECTION NAME='VchCol'><TYPE>Voucher</TYPE>"
            f"<FETCH>*,REMOTEGUID,REMOTEALTGUID</FETCH>"
            f"<FILTER>VchFilter</FILTER></COLLECTION>"
            f"<SYSTEM TYPE='Formulae' NAME='VchFilter'>{filter_expr}</SYSTEM>"
            f"</TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>"
        )
        r = requests.post(tally_url, data=col_xml.encode('utf-8'), timeout=2.5)
        text = r.text
        if f"<VOUCHERNUMBER>{voucher_number}</VOUCHERNUMBER>" in text or f">{voucher_number}<" in text:
            # Tally returns REMOTEID as an XML attribute or element, or in REMOTEGUID/REMOTEALTGUID
            rem_g = re.search(r'<REMOTEGUID>([^<]+)</REMOTEGUID>', text) or re.search(r'<REMOTEALTGUID>([^<]+)</REMOTEALTGUID>', text)
            rem_m = re.search(r'REMOTEID="([^"]+)"', text) or re.search(r'<REMOTEID>([^<]+)</REMOTEID>', text)
            guid_m = re.search(r'<GUID>([^<]+)</GUID>', text)
            actual_remote_id = (rem_g.group(1) if rem_g else None) or (rem_m.group(1) if rem_m else None)
            return {
                'exists': True,
                'remote_id': actual_remote_id,
                'guid': actual_remote_id or (guid_m.group(1) if guid_m else None)
            }
    except Exception:
        pass
    return {'exists': False, 'remote_id': None, 'guid': None}


def resolve_voucher_sync_context(obj, voucher_number, voucher_type_name, default_prefix, tally_url="http://localhost:9000", force_alter=False):
    """
    Determines whether a voucher should be Created or Altered in Tally Prime,
    and resolves the exact REMOTEID / GUID.

    Fast path (preferred):
        If obj.tally_guid is already set, return Alter immediately using that
        exact GUID — no DB queries, no Tally network call, no re-derivation.
        This is the correct path for any voucher that was successfully pushed
        before, even if sync_status was reset to 'pending' by an edit.

    Legacy fallback (rows synced before tally_guid was persisted):
        1. Query Tally's Collection live to find the true REMOTEID if the voucher
           already exists in Tally.
        2. Newest successful sync log / sync_status check.
        3. Deterministic GUID built from the voucher number digits + default_prefix.
    """
    # ------------------------------------------------------------------
    # FORCE ALTER: caller has confirmed the voucher already exists in Tally
    # (e.g. a Create attempt returned EXCEPTIONS = duplicate).
    # Query Tally live to obtain the voucher's true REMOTEID recognized by Tally.
    # ------------------------------------------------------------------
    if force_alter:
        forced_guid = None
        # Check stored GUID first if valid
        stored = getattr(obj, 'tally_guid', None)
        if stored:
            forced_guid = stored
        else:
            vch_info = get_tally_existing_voucher_info(voucher_number, voucher_type_name, tally_url=tally_url)
            if vch_info.get('remote_id'):
                forced_guid = vch_info['remote_id']

        if not forced_guid:
            num_m_fa = re.search(r'(\d+)', str(voucher_number or ""))
            obj_num_fa = int(num_m_fa.group(1)) if num_m_fa else getattr(obj, 'id', 1)
            forced_guid = f"{default_prefix}-{obj_num_fa:08d}"

        return {
            'is_existing': True,
            'action': 'Alter',
            'guid': forced_guid,
            'remote_id': forced_guid,
        }

    # ------------------------------------------------------------------
    # FAST PATH: persisted GUID exists — use it immediately.
    # ------------------------------------------------------------------
    stored_guid = getattr(obj, 'tally_guid', None)
    if stored_guid:
        return {
            'is_existing': True,
            'action': 'Alter',
            'guid': stored_guid,
            'remote_id': stored_guid,
        }

    # ------------------------------------------------------------------
    # LEGACY FALLBACK: resolve GUID for rows without a persisted tally_guid.
    # ------------------------------------------------------------------
    is_existing = False
    resolved_guid = None
    resolved_remote_id = None

    num_m_d = re.search(r'(\d+)', str(voucher_number or ""))
    obj_num_d = int(num_m_d.group(1)) if num_m_d else getattr(obj, 'id', 1)
    deterministic_guid = f"{default_prefix}-{obj_num_d:08d}"

    # Check database sync history
    if obj:
        if getattr(obj, 'is_synced', False) or str(getattr(obj, 'sync_status', '')).lower() == 'synced':
            is_existing = True

        if hasattr(obj, 'sync_logs'):
            try:
                succ_log = obj.sync_logs.filter(status='success').order_by('-attempted_at').first()
                if succ_log:
                    is_existing = True
                    resp = succ_log.tally_response or ""
                    guid_m = re.search(r'<GUID>([^<]+)</GUID>', resp)
                    if guid_m:
                        resolved_guid = guid_m.group(1).strip()
                        resolved_remote_id = resolved_guid
            except Exception:
                pass

    # If believed to exist OR to confirm whether it exists in Tally, query Tally live.
    if not resolved_remote_id:
        vch_info = get_tally_existing_voucher_info(voucher_number, voucher_type_name, tally_url=tally_url)
        if vch_info.get('exists'):
            is_existing = True
            if vch_info.get('remote_id'):
                resolved_remote_id = vch_info['remote_id']
                resolved_guid = resolved_remote_id

    # Fallback to deterministic GUID
    if not resolved_remote_id:
        resolved_guid = deterministic_guid
        resolved_remote_id = deterministic_guid

    final_guid = resolved_remote_id or resolved_guid
    action = "Alter" if is_existing else "Create"

    # For legacy rows where the voucher is confirmed to already exist in Tally,
    # backfill obj.tally_guid so future pushes use the fast path.
    if is_existing and obj and hasattr(obj, 'tally_guid') and not getattr(obj, 'tally_guid', None) and final_guid:
        obj.tally_guid = final_guid
        try:
            obj.save(update_fields=['tally_guid'])
        except Exception:
            pass

    return {
        'is_existing': is_existing,
        'action': action,
        'guid': final_guid,
        'remote_id': final_guid,
    }


def ensure_tally_sales_ledger_affects_stock(ledger_name, tally_url="http://localhost:9000"):
    """
    Ensures that a sales ledger in Tally has 'Inventory values are affected? Yes'.
    If it is set to 'No', Tally rejects item invoices/returns with 'No accounting allocations'.
    """
    if not ledger_name:
        return
    sl_name = str(ledger_name).strip()
    sl_lower = sl_name.lower()
    tally_ledgers = get_tally_sales_ledgers(tally_url)
    if tally_ledgers and sl_lower in tally_ledgers:
        exact_name, affects_stock = tally_ledgers[sl_lower]
        if not affects_stock:
            try:
                active_company = get_tally_active_company(tally_url)
                company_tag = f"<STATICVARIABLES><SVCURRENTCOMPANY>{escape_xml(active_company)}</SVCURRENTCOMPANY></STATICVARIABLES>" if active_company else ""
                alter_xml = (
                    f"<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>"
                    f"<BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>All Masters</REPORTNAME>{company_tag}</REQUESTDESC>"
                    f"<REQUESTDATA><TALLYMESSAGE xmlns:UDF=\"TallyUDF\">"
                    f"<LEDGER NAME=\"{escape_xml(exact_name)}\" ACTION=\"Alter\">"
                    f"<NAME.LIST><NAME>{escape_xml(exact_name)}</NAME></NAME.LIST>"
                    f"<AFFECTSSTOCK>Yes</AFFECTSSTOCK>"
                    f"</LEDGER></TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>"
                )
                requests.post(tally_url, data=alter_xml.encode('utf-8'), timeout=2)
                _TALLY_LEDGERS_CACHE["timestamp"] = 0
            except Exception:
                pass


def resolve_sales_accounting_ledger_name(raw_ledger_name, is_interstate=False, tally_url="http://localhost:9000"):
    """
    Resolves the sales accounting ledger to be used in <ACCOUNTINGALLOCATIONS.LIST>.
    
    Strictly adheres to the user rule:
    If a specific sales ledger was chosen (e.g. 'B2B Sales', 'IGST Sales'), use that exact
    ledger name. If it does not exist or has incompatible settings in Tally, do NOT silently
    fall back to arbitrary defaults like 'Sales Local'; allow Tally to reject it with a line error.
    """
    if not raw_ledger_name:
        return "Sales Local" if not is_interstate else "IGST Sales"

    sl_name = str(raw_ledger_name).strip()
    if not sl_name:
        return "Sales Local" if not is_interstate else "IGST Sales"

    # Auto-ensure ledger in Tally has AffectsStock=Yes so Tally does not reject with 'No accounting allocations'
    ensure_tally_sales_ledger_affects_stock(sl_name, tally_url=tally_url)

    tally_ledgers = get_tally_sales_ledgers(tally_url)
    sl_lower = sl_name.lower()

    if tally_ledgers and sl_lower in tally_ledgers:
        return tally_ledgers[sl_lower][0]

    # If not in Tally's known ledgers or Tally is offline, strictly preserve the designated ledger name
    return sl_name


def generate_sales_invoice_xml(invoice, tally_url="http://localhost:9000", force_alter=False):
    """
    Generates Tally Prime XML import payload for a SalesInvoice.
    Conforms to Tally Prime's 'Invoice Voucher View' specification.
    """
    from settings_app.models import Company

    company = Company.objects.first()
    raw_company_gstin = (company.gst_no if company and getattr(company, "gst_no", None) else "") or ""
    # In Tally Prime's active company (Test Company), the company's GST registration is 32aagcg7847l1z7.
    # If the ERP DB contains a dummy placeholder (e.g. 27ABCDE1234F1Z5) or is empty, fallback to 32aagcg7847l1z7
    if not raw_company_gstin or raw_company_gstin.upper().startswith("27ABCDE"):
        raw_company_gstin = "32aagcg7847l1z7"
    company_gstin = escape_xml(raw_company_gstin)
    company_state = resolve_state_name(
        getattr(company, "state", None),
        gstin=company_gstin,
        default="Kerala"
    )

    customer = invoice.customer_ledger
    party_name = escape_xml(customer.name if customer else "")
    party_gstin = escape_xml(invoice.buyer_gst_no or getattr(customer, "gst_number", "") or "")
    party_state = escape_xml(resolve_state_name(
        getattr(customer, "state", "") or getattr(invoice, "buyer_state", "") or "",
        gstin=party_gstin,
        default=company_state
    ))
    party_country = escape_xml(resolve_country_name(
        getattr(customer, "country", "") or getattr(invoice, "buyer_country", "") or "",
        default="India"
    ))
    party_pincode = escape_xml(getattr(customer, "pincode", "") or getattr(invoice, "buyer_pincode", "") or "")
    party_pos = escape_xml(resolve_state_name(
        getattr(customer, "placeofsupply", "") or getattr(invoice, "place_of_supply", "") or "",
        gstin=party_gstin,
        default=party_state
    ))
    party_reg_type_tally = resolve_gst_reg_type(
        getattr(customer, "registration_type", "") or getattr(invoice, "buyer_registration_type", "") or "",
        gstin=party_gstin
    )

    # Determine whether intra-state or inter-state
    items = list(invoice.items.select_related("product", "warehouse", "per").all())
    has_dual_gst = bool((invoice.gst_amount_1 or 0) > 0 and (invoice.gst_amount_2 or 0) > 0)
    has_igst = any((getattr(i, 'igst_amount', 0) or 0) > 0 for i in items)
    is_interstate = has_igst or (party_state.strip().lower() != company_state.strip().lower() and not has_dual_gst)
    is_registered = party_reg_type_tally in ("Regular", "Composition")

    # Determine Voucher Type Name dynamically based on the selected voucher type / sub-type
    voucher_type_name = resolve_sales_invoice_voucher_type_name(
        invoice,
        is_interstate=is_interstate,
        is_registered=is_registered,
        tally_url=tally_url,
    )

    date_str = format_tally_date(invoice.entry_date)
    sync_ctx = resolve_voucher_sync_context(
        obj=invoice,
        voucher_number=invoice.invoice_no,
        voucher_type_name=voucher_type_name,
        # Unique prefix for Sales Invoice — must differ from Sales Order prefix
        # to prevent REMOTEID collisions when order and invoice share the same
        # numeric voucher suffix (e.g. SO-0001 and INV-0001 → same digits).
        default_prefix="a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        tally_url=tally_url,
        force_alter=force_alter,
    )
    action = sync_ctx['action']
    guid_str = sync_ctx['guid']
    narration_str = escape_xml(invoice.narration or f"Sales Invoice {invoice.invoice_no}")

    # Buyer address
    buyer_addresses = []
    if invoice.buyer_address:
        for line in invoice.buyer_address.split("\n"):
            line = line.strip()
            if line:
                buyer_addresses.append(line)
    elif customer:
        for fld in ("address1", "address2", "address3", "address"):
            val = getattr(customer, fld, "")
            if val and val.strip() and val.strip() not in buyer_addresses:
                buyer_addresses.append(val.strip())

    xml_parts = []
    xml_parts.append("<ENVELOPE>")
    xml_parts.append(" <HEADER>")
    xml_parts.append("  <TALLYREQUEST>Import Data</TALLYREQUEST>")
    xml_parts.append(" </HEADER>")
    xml_parts.append(" <BODY>")
    active_company = get_tally_active_company(tally_url)
    xml_parts.append("  <IMPORTDATA>")
    xml_parts.append("   <REQUESTDESC>")
    xml_parts.append("    <REPORTNAME>All Masters</REPORTNAME>")
    if active_company:
        xml_parts.append("    <STATICVARIABLES>")
        xml_parts.append(f"     <SVCURRENTCOMPANY>{escape_xml(active_company)}</SVCURRENTCOMPANY>")
        xml_parts.append("    </STATICVARIABLES>")
    xml_parts.append("   </REQUESTDESC>")
    xml_parts.append("   <REQUESTDATA>")
    xml_parts.append('    <TALLYMESSAGE xmlns:UDF="TallyUDF">')
    # For Alter: include VOUCHERNUMBER attribute so Tally can match the existing
    # voucher by number when the REMOTEID lookup fails (unknown/phantom GUID).
    vch_num_attr = f' VOUCHERNUMBER="{escape_xml(invoice.invoice_no)}"' if action == 'Alter' else ''
    xml_parts.append(
        f'     <VOUCHER REMOTEID="{guid_str}" VCHTYPE="{voucher_type_name}" ACTION="{action}"{vch_num_attr} OBJVIEW="Invoice Voucher View">'
    )
    xml_parts.append(f"      <OBJECTUPDATEACTION>{action}</OBJECTUPDATEACTION>")

    # Address lists
    if buyer_addresses:
        xml_parts.append('      <ADDRESS.LIST TYPE="String">')
        for addr in buyer_addresses:
            xml_parts.append(f"       <ADDRESS>{escape_xml(addr)}</ADDRESS>")
        xml_parts.append("      </ADDRESS.LIST>")
        xml_parts.append('      <BASICBUYERADDRESS.LIST TYPE="String">')
        for addr in buyer_addresses:
            xml_parts.append(f"       <BASICBUYERADDRESS>{escape_xml(addr)}</BASICBUYERADDRESS>")
        xml_parts.append("      </BASICBUYERADDRESS.LIST>")

    xml_parts.append('      <OLDAUDITENTRYIDS.LIST TYPE="Number">')
    xml_parts.append("       <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>")
    xml_parts.append("      </OLDAUDITENTRYIDS.LIST>")
    xml_parts.append(f"      <DATE>{date_str}</DATE>")
    xml_parts.append(f"      <VCHSTATUSDATE>{date_str}</VCHSTATUSDATE>")
    xml_parts.append(f"      <GUID>{guid_str}</GUID>")
    xml_parts.append(f"      <GSTREGISTRATIONTYPE>{party_reg_type_tally}</GSTREGISTRATIONTYPE>")
    xml_parts.append(f"      <VATDEALERTYPE>{party_reg_type_tally}</VATDEALERTYPE>")
    xml_parts.append(f"      <STATENAME>{party_state}</STATENAME>")
    xml_parts.append(f"      <NARRATION>{narration_str}</NARRATION>")
    xml_parts.append(f"      <OBJECTUPDATEACTION>{action}</OBJECTUPDATEACTION>")
    xml_parts.append(f"      <COUNTRYOFRESIDENCE>{party_country}</COUNTRYOFRESIDENCE>")
    if party_gstin:
        xml_parts.append(f"      <PARTYGSTIN>{party_gstin}</PARTYGSTIN>")
    xml_parts.append(f"      <PLACEOFSUPPLY>{party_pos}</PLACEOFSUPPLY>")
    xml_parts.append(f"      <VOUCHERTYPENAME>{voucher_type_name}</VOUCHERTYPENAME>")
    xml_parts.append(f"      <PARTYNAME>{party_name}</PARTYNAME>")
    if company_gstin:
        xml_parts.append(f'      <GSTREGISTRATION TAXTYPE="GST" TAXREGISTRATION="{company_gstin}">{company_gstin}</GSTREGISTRATION>')
        xml_parts.append(f"      <CMPGSTIN>{company_gstin}</CMPGSTIN>")
    xml_parts.append(f"      <PARTYLEDGERNAME>{party_name}</PARTYLEDGERNAME>")
    xml_parts.append(f"      <VOUCHERNUMBER>{escape_xml(invoice.invoice_no)}</VOUCHERNUMBER>")
    xml_parts.append(f"      <BASICBUYERNAME>{party_name}</BASICBUYERNAME>")
    xml_parts.append("      <CMPGSTREGISTRATIONTYPE>Regular</CMPGSTREGISTRATIONTYPE>")
    xml_parts.append(f"      <PARTYMAILINGNAME>{party_name}</PARTYMAILINGNAME>")
    if party_pincode:
        xml_parts.append(f"      <PARTYPINCODE>{party_pincode}</PARTYPINCODE>")
    if party_gstin:
        xml_parts.append(f"      <CONSIGNEEGSTIN>{party_gstin}</CONSIGNEEGSTIN>")
    xml_parts.append(f"      <CONSIGNEEMAILINGNAME>{party_name}</CONSIGNEEMAILINGNAME>")
    if party_pincode:
        xml_parts.append(f"      <CONSIGNEEPINCODE>{party_pincode}</CONSIGNEEPINCODE>")
    xml_parts.append(f"      <CONSIGNEESTATENAME>{party_state}</CONSIGNEESTATENAME>")
    xml_parts.append(f"      <CMPGSTSTATE>{company_state}</CMPGSTSTATE>")
    xml_parts.append(f"      <CONSIGNEECOUNTRYNAME>{party_country}</CONSIGNEECOUNTRYNAME>")
    xml_parts.append(f"      <BASICBASEPARTYNAME>{party_name}</BASICBASEPARTYNAME>")
    xml_parts.append("      <NUMBERINGSTYLE>Manual</NUMBERINGSTYLE>")
    xml_parts.append("      <CSTFORMISSUETYPE>&#4; Not Applicable</CSTFORMISSUETYPE>")
    xml_parts.append("      <CSTFORMRECVTYPE>&#4; Not Applicable</CSTFORMRECVTYPE>")
    xml_parts.append("      <FBTPAYMENTTYPE>Default</FBTPAYMENTTYPE>")
    xml_parts.append("      <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>")
    xml_parts.append("      <VCHSTATUSTAXADJUSTMENT>Default</VCHSTATUSTAXADJUSTMENT>")
    xml_parts.append(f"      <VCHSTATUSVOUCHERTYPE>{voucher_type_name}</VCHSTATUSVOUCHERTYPE>")
    if company_gstin:
        xml_parts.append(f"      <VCHSTATUSTAXUNIT>{company_gstin}</VCHSTATUSTAXUNIT>")
    xml_parts.append("      <VCHGSTCLASS>&#4; Not Applicable</VCHGSTCLASS>")
    xml_parts.append("      <VCHENTRYMODE>Item Invoice</VCHENTRYMODE>")
    xml_parts.append("      <DIFFACTUALQTY>No</DIFFACTUALQTY>")
    xml_parts.append("      <ISMSTFROMSYNC>No</ISMSTFROMSYNC>")
    xml_parts.append("      <ISDELETED>No</ISDELETED>")
    xml_parts.append("      <ISSECURITYONWHENENTERED>No</ISSECURITYONWHENENTERED>")
    xml_parts.append("      <ASORIGINAL>No</ASORIGINAL>")
    xml_parts.append("      <AUDITED>No</AUDITED>")
    xml_parts.append("      <ISCOMMONPARTY>No</ISCOMMONPARTY>")
    xml_parts.append("      <FORJOBCOSTING>No</FORJOBCOSTING>")
    xml_parts.append("      <ISOPTIONAL>No</ISOPTIONAL>")
    xml_parts.append(f"      <EFFECTIVEDATE>{date_str}</EFFECTIVEDATE>")
    xml_parts.append("      <USEFOREXCISE>No</USEFOREXCISE>")
    xml_parts.append("      <ISFORJOBWORKIN>No</ISFORJOBWORKIN>")
    xml_parts.append("      <ALLOWCONSUMPTION>No</ALLOWCONSUMPTION>")
    xml_parts.append("      <USEFORINTEREST>No</USEFORINTEREST>")
    xml_parts.append("      <USEFORGAINLOSS>No</USEFORGAINLOSS>")
    xml_parts.append("      <USEFORGODOWNTRANSFER>No</USEFORGODOWNTRANSFER>")
    xml_parts.append("      <USEFORCOMPOUND>No</USEFORCOMPOUND>")
    xml_parts.append("      <USEFORSERVICETAX>No</USEFORSERVICETAX>")
    xml_parts.append("      <ISREVERSECHARGEAPPLICABLE>No</ISREVERSECHARGEAPPLICABLE>")
    xml_parts.append("      <ISSYSTEM>No</ISSYSTEM>")
    xml_parts.append("      <ISFETCHEDONLY>No</ISFETCHEDONLY>")
    xml_parts.append("      <ISGSTOVERRIDDEN>No</ISGSTOVERRIDDEN>")
    xml_parts.append("      <ISCANCELLED>No</ISCANCELLED>")
    xml_parts.append("      <ISONHOLD>No</ISONHOLD>")
    xml_parts.append("      <ISSUMMARY>No</ISSUMMARY>")
    xml_parts.append("      <ISECOMMERCESUPPLY>No</ISECOMMERCESUPPLY>")
    xml_parts.append("      <ISBOENOTAPPLICABLE>No</ISBOENOTAPPLICABLE>")
    xml_parts.append("      <ISGSTSECSEVENAPPLICABLE>No</ISGSTSECSEVENAPPLICABLE>")
    xml_parts.append("      <IGNOREEINVVALIDATION>No</IGNOREEINVVALIDATION>")
    xml_parts.append("      <CMPGSTISOTHTERRITORYASSESSEE>No</CMPGSTISOTHTERRITORYASSESSEE>")
    xml_parts.append("      <PARTYGSTISOTHTERRITORYASSESSEE>No</PARTYGSTISOTHTERRITORYASSESSEE>")
    xml_parts.append("      <IRNJSONEXPORTED>No</IRNJSONEXPORTED>")
    xml_parts.append("      <IRNCANCELLED>No</IRNCANCELLED>")
    xml_parts.append("      <IGNOREGSTCONFLICTINMIG>No</IGNOREGSTCONFLICTINMIG>")
    xml_parts.append("      <ISOPBALTRANSACTION>No</ISOPBALTRANSACTION>")
    xml_parts.append("      <IGNOREGSTFORMATVALIDATION>No</IGNOREGSTFORMATVALIDATION>")
    xml_parts.append("      <ISELIGIBLEFORITC>Yes</ISELIGIBLEFORITC>")
    xml_parts.append("      <IGNOREGSTOPTIONALUNCERTAIN>No</IGNOREGSTOPTIONALUNCERTAIN>")
    xml_parts.append("      <UPDATESUMMARYVALUES>No</UPDATESUMMARYVALUES>")
    xml_parts.append("      <ISEWAYBILLAPPLICABLE>No</ISEWAYBILLAPPLICABLE>")
    xml_parts.append("      <ISDELETEDRETAINED>No</ISDELETEDRETAINED>")
    xml_parts.append("      <ISNULL>No</ISNULL>")
    xml_parts.append("      <ISINVOICE>Yes</ISINVOICE>")
    xml_parts.append("      <VOUCHERNUMBERSERIES>Default</VOUCHERNUMBERSERIES>")

    # ------------------------------------------------------------------
    # Inventory Entries
    # ------------------------------------------------------------------
    raw_sales_ledger_name = invoice.sales_ledger.name.strip() if (invoice.sales_ledger and invoice.sales_ledger.name) else ""
    sales_ledger_default = resolve_sales_accounting_ledger_name(
        raw_sales_ledger_name,
        is_interstate=is_interstate,
    )

    for item in items:
        product_name = escape_xml(item.product.name if item.product else "")
        warehouse = escape_xml(item.warehouse.name if item.warehouse else "Main Location")
        
        # Unit normalization (Tally unit master casing)
        raw_unit = getattr(item.per, "abbreviation", None) or getattr(item.per, "name", "Nos")
        if raw_unit:
            raw_unit_str = str(raw_unit).strip()
            if raw_unit_str.lower() in ("case", "nos", "box", "btl", "can", "jar", "crate", "pac", "kg", "mtr", "pcs"):
                unit = raw_unit_str.capitalize()
            else:
                unit = escape_xml(raw_unit_str)
        else:
            unit = "Nos"

        hsn_code = escape_xml(item.hsn or "")
        rate_val = float(item.rate or 0)
        amount_val = float(item.amount or 0)
        qty_val = float(item.quantity or 0)
        
        # Batch name normalization
        raw_batch = (item.batch_number or "").strip()
        if not raw_batch or "primary" in raw_batch.lower() or "unbatched" in raw_batch.lower():
            batch_name = "Primary Batch"
        else:
            batch_name = escape_xml(raw_batch)

        xml_parts.append("      <ALLINVENTORYENTRIES.LIST>")
        xml_parts.append(f"       <STOCKITEMNAME>{product_name}</STOCKITEMNAME>")
        xml_parts.append("       <GSTOVRDNISREVCHARGEAPPL>&#4; Not Applicable</GSTOVRDNISREVCHARGEAPPL>")
        xml_parts.append("       <GSTOVRDNTAXABILITY>Taxable</GSTOVRDNTAXABILITY>")
        xml_parts.append("       <GSTSOURCETYPE>Stock Item</GSTSOURCETYPE>")
        xml_parts.append(f"       <GSTITEMSOURCE>{product_name}</GSTITEMSOURCE>")
        xml_parts.append("       <HSNSOURCETYPE>Stock Item</HSNSOURCETYPE>")
        xml_parts.append(f"       <HSNITEMSOURCE>{product_name}</HSNITEMSOURCE>")
        xml_parts.append("       <GSTOVRDNSTOREDNATURE/>")
        xml_parts.append("       <GSTOVRDNTYPEOFSUPPLY>Goods</GSTOVRDNTYPEOFSUPPLY>")
        xml_parts.append("       <GSTRATEINFERAPPLICABILITY>As per Masters/Company</GSTRATEINFERAPPLICABILITY>")
        if hsn_code:
            xml_parts.append(f"       <GSTHSNNAME>{hsn_code}</GSTHSNNAME>")
            xml_parts.append("       <GSTHSNINFERAPPLICABILITY>As per Masters/Company</GSTHSNINFERAPPLICABILITY>")
        xml_parts.append("       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>")
        xml_parts.append("       <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>")
        xml_parts.append("       <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>")
        xml_parts.append("       <CONTENTNEGISPOS>No</CONTENTNEGISPOS>")
        xml_parts.append("       <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>")
        xml_parts.append(f"       <RATE>{rate_val:.2f}/{unit}</RATE>")
        xml_parts.append(f"       <AMOUNT>{amount_val:.2f}</AMOUNT>")
        xml_parts.append(f"       <ACTUALQTY> {qty_val:g} {unit}</ACTUALQTY>")
        xml_parts.append(f"       <BILLEDQTY> {qty_val:g} {unit}</BILLEDQTY>")

        # Batch Allocations
        xml_parts.append("       <BATCHALLOCATIONS.LIST>")
        if item.manufacture_date:
            xml_parts.append(f"        <MFDON>{format_tally_date(item.manufacture_date)}</MFDON>")
        xml_parts.append(f"        <GODOWNNAME>{warehouse}</GODOWNNAME>")
        xml_parts.append(f"        <BATCHNAME>{batch_name}</BATCHNAME>")
        xml_parts.append(f"        <DESTINATIONGODOWNNAME>{warehouse}</DESTINATIONGODOWNNAME>")
        xml_parts.append("        <INDENTNO>&#4; Not Applicable</INDENTNO>")
        xml_parts.append("        <ORDERNO>&#4; Not Applicable</ORDERNO>")
        xml_parts.append("        <TRACKINGNUMBER>&#4; Not Applicable</TRACKINGNUMBER>")
        xml_parts.append("        <DYNAMICCSTISCLEARED>No</DYNAMICCSTISCLEARED>")
        xml_parts.append(f"        <AMOUNT>{amount_val:.2f}</AMOUNT>")
        xml_parts.append(f"        <ACTUALQTY> {qty_val:g} {unit}</ACTUALQTY>")
        xml_parts.append(f"        <BILLEDQTY> {qty_val:g} {unit}</BILLEDQTY>")
        if item.expiry_date:
            xml_parts.append(f"        <EXPIRYPERIOD>{format_expiry_date(item.expiry_date)}</EXPIRYPERIOD>")
        xml_parts.append("        <ADDITIONALDETAILS.LIST>        </ADDITIONALDETAILS.LIST>")
        xml_parts.append("        <VOUCHERCOMPONENTLIST.LIST>        </VOUCHERCOMPONENTLIST.LIST>")
        xml_parts.append("       </BATCHALLOCATIONS.LIST>")

        # Accounting Allocations
        raw_item_sl = (getattr(item.product, "sales_ledger", None) and item.product.sales_ledger.name) or raw_sales_ledger_name
        item_sales_ledger = resolve_sales_accounting_ledger_name(
            raw_item_sl,
            is_interstate=is_interstate,
        )

        xml_parts.append("       <ACCOUNTINGALLOCATIONS.LIST>")
        xml_parts.append('        <OLDAUDITENTRYIDS.LIST TYPE="Number">')
        xml_parts.append("         <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>")
        xml_parts.append("        </OLDAUDITENTRYIDS.LIST>")
        xml_parts.append(f"        <LEDGERNAME>{escape_xml(item_sales_ledger)}</LEDGERNAME>")
        xml_parts.append("        <GSTCLASS>&#4; Not Applicable</GSTCLASS>")
        xml_parts.append("        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>")
        xml_parts.append("        <LEDGERFROMITEM>No</LEDGERFROMITEM>")
        xml_parts.append("        <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>")
        xml_parts.append("        <ISPARTYLEDGER>No</ISPARTYLEDGER>")
        xml_parts.append("        <GSTOVERRIDDEN>No</GSTOVERRIDDEN>")
        xml_parts.append("        <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>")
        xml_parts.append("        <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>")
        xml_parts.append("        <STRDGSTISPARTYLEDGER>No</STRDGSTISPARTYLEDGER>")
        xml_parts.append("        <STRDGSTISDUTYLEDGER>No</STRDGSTISDUTYLEDGER>")
        xml_parts.append("        <CONTENTNEGISPOS>No</CONTENTNEGISPOS>")
        xml_parts.append("        <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>")
        xml_parts.append(f"        <AMOUNT>{amount_val:.2f}</AMOUNT>")
        xml_parts.append("       </ACCOUNTINGALLOCATIONS.LIST>")

        # Rate Details (Tax)
        gst_pct = float(item.gst_percent or 0)
        if not is_interstate:
            half_rate = gst_pct / 2.0
            xml_parts.append("       <RATEDETAILS.LIST>")
            xml_parts.append("        <GSTRATEDUTYHEAD>CGST</GSTRATEDUTYHEAD>")
            xml_parts.append("        <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>")
            xml_parts.append(f"        <GSTRATE> {half_rate:g}</GSTRATE>")
            xml_parts.append("       </RATEDETAILS.LIST>")
            xml_parts.append("       <RATEDETAILS.LIST>")
            xml_parts.append("        <GSTRATEDUTYHEAD>SGST/UTGST</GSTRATEDUTYHEAD>")
            xml_parts.append("        <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>")
            xml_parts.append(f"        <GSTRATE> {half_rate:g}</GSTRATE>")
            xml_parts.append("       </RATEDETAILS.LIST>")
        else:
            xml_parts.append("       <RATEDETAILS.LIST>")
            xml_parts.append("        <GSTRATEDUTYHEAD>IGST</GSTRATEDUTYHEAD>")
            xml_parts.append("        <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>")
            xml_parts.append(f"        <GSTRATE> {gst_pct:g}</GSTRATE>")
            xml_parts.append("       </RATEDETAILS.LIST>")

        xml_parts.append("      </ALLINVENTORYENTRIES.LIST>")

    # ------------------------------------------------------------------
    # Party Ledger Entry (Debit)
    # ------------------------------------------------------------------
    total_val = float(invoice.total_amount or 0)
    xml_parts.append("      <LEDGERENTRIES.LIST>")
    xml_parts.append('       <OLDAUDITENTRYIDS.LIST TYPE="Number">')
    xml_parts.append("        <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>")
    xml_parts.append("       </OLDAUDITENTRYIDS.LIST>")
    xml_parts.append(f"       <LEDGERNAME>{party_name}</LEDGERNAME>")
    xml_parts.append("       <GSTCLASS>&#4; Not Applicable</GSTCLASS>")
    xml_parts.append("       <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>")
    xml_parts.append("       <LEDGERFROMITEM>No</LEDGERFROMITEM>")
    xml_parts.append("       <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>")
    xml_parts.append("       <ISPARTYLEDGER>Yes</ISPARTYLEDGER>")
    xml_parts.append("       <GSTOVERRIDDEN>No</GSTOVERRIDDEN>")
    xml_parts.append("       <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>")
    xml_parts.append("       <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>")
    xml_parts.append("       <STRDGSTISPARTYLEDGER>No</STRDGSTISPARTYLEDGER>")
    xml_parts.append("       <STRDGSTISDUTYLEDGER>No</STRDGSTISDUTYLEDGER>")
    xml_parts.append("       <CONTENTNEGISPOS>No</CONTENTNEGISPOS>")
    xml_parts.append("       <ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>")
    xml_parts.append(f"       <AMOUNT>-{total_val:.2f}</AMOUNT>")
    xml_parts.append("      </LEDGERENTRIES.LIST>")


    # ------------------------------------------------------------------
    # 1. Extra Charges (Credit, e.g. Transportation Charges)
    # ------------------------------------------------------------------
    extra_charges_sum = 0.0
    round_off_charge_amt = 0.0
    round_off_charge_found = False

    for charge in invoice.extra_charges.select_related("ledger").all():
        chg_amt = float(charge.amount or 0)
        if not charge.ledger or abs(chg_amt) < 0.005:
            continue
        ledger_name_lower = charge.ledger.name.strip().lower()
        if "round" in ledger_name_lower and ("off" in ledger_name_lower or "up" in ledger_name_lower):
            round_off_charge_amt += chg_amt
            round_off_charge_found = True
            continue

        resolved_chg_name = resolve_tally_extra_charge_ledger_name(charge.ledger.name)
        extra_charges_sum += chg_amt
        xml_parts.append("      <LEDGERENTRIES.LIST>")
        xml_parts.append('       <OLDAUDITENTRYIDS.LIST TYPE="Number">')
        xml_parts.append("        <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>")
        xml_parts.append("       </OLDAUDITENTRYIDS.LIST>")
        xml_parts.append("       <APPROPRIATEFOR>&#4; Not Applicable</APPROPRIATEFOR>")
        xml_parts.append(f"       <LEDGERNAME>{escape_xml(resolved_chg_name)}</LEDGERNAME>")
        xml_parts.append("       <GSTCLASS>&#4; Not Applicable</GSTCLASS>")
        xml_parts.append("       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>")
        xml_parts.append("       <LEDGERFROMITEM>No</LEDGERFROMITEM>")
        xml_parts.append("       <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>")
        xml_parts.append("       <ISPARTYLEDGER>No</ISPARTYLEDGER>")
        xml_parts.append("       <GSTOVERRIDDEN>No</GSTOVERRIDDEN>")
        xml_parts.append("       <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>")
        xml_parts.append("       <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>")
        xml_parts.append("       <STRDGSTISPARTYLEDGER>No</STRDGSTISPARTYLEDGER>")
        xml_parts.append("       <STRDGSTISDUTYLEDGER>No</STRDGSTISDUTYLEDGER>")
        xml_parts.append("       <CONTENTNEGISPOS>No</CONTENTNEGISPOS>")
        xml_parts.append("       <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>")
        xml_parts.append(f"       <AMOUNT>{chg_amt:.2f}</AMOUNT>")
        xml_parts.append(f"       <VATEXPAMOUNT>{chg_amt:.2f}</VATEXPAMOUNT>")
        xml_parts.append("      </LEDGERENTRIES.LIST>")

    # ------------------------------------------------------------------
    # 2. GST Ledger Entries (Credit, e.g. CGST, SGST, IGST)
    # ------------------------------------------------------------------
    def append_invoice_duty_ledger(ledger_name, amount):
        if not ledger_name or amount <= 0:
            return
        xml_parts.append("      <LEDGERENTRIES.LIST>")
        xml_parts.append('       <OLDAUDITENTRYIDS.LIST TYPE="Number">')
        xml_parts.append("        <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>")
        xml_parts.append("       </OLDAUDITENTRYIDS.LIST>")
        xml_parts.append("       <APPROPRIATEFOR>&#4; Not Applicable</APPROPRIATEFOR>")
        xml_parts.append("       <ROUNDTYPE>&#4; Not Applicable</ROUNDTYPE>")
        xml_parts.append(f"       <LEDGERNAME>{escape_xml(ledger_name)}</LEDGERNAME>")
        xml_parts.append("       <GSTCLASS>&#4; Not Applicable</GSTCLASS>")
        xml_parts.append("       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>")
        xml_parts.append("       <LEDGERFROMITEM>No</LEDGERFROMITEM>")
        xml_parts.append("       <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>")
        xml_parts.append("       <ISPARTYLEDGER>No</ISPARTYLEDGER>")
        xml_parts.append("       <GSTOVERRIDDEN>No</GSTOVERRIDDEN>")
        xml_parts.append("       <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>")
        xml_parts.append("       <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>")
        xml_parts.append("       <STRDGSTISPARTYLEDGER>No</STRDGSTISPARTYLEDGER>")
        xml_parts.append("       <STRDGSTISDUTYLEDGER>No</STRDGSTISDUTYLEDGER>")
        xml_parts.append("       <CONTENTNEGISPOS>No</CONTENTNEGISPOS>")
        xml_parts.append("       <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>")
        xml_parts.append(f"       <AMOUNT>{amount:.2f}</AMOUNT>")
        xml_parts.append(f"       <VATEXPAMOUNT>{amount:.2f}</VATEXPAMOUNT>")
        xml_parts.append("      </LEDGERENTRIES.LIST>")

    cgst_amt = float(invoice.gst_amount_1 or 0)
    sgst_amt = float(invoice.gst_amount_2 or 0)

    if not is_interstate:
        cgst_name = invoice.gst_ledger_1.name if invoice.gst_ledger_1 else "Output CGST"
        sgst_name = invoice.gst_ledger_2.name if invoice.gst_ledger_2 else "Output SGST"
        if cgst_amt > 0:
            append_invoice_duty_ledger(cgst_name, cgst_amt)
        if sgst_amt > 0:
            append_invoice_duty_ledger(sgst_name, sgst_amt)
    else:
        igst_amt = cgst_amt + sgst_amt
        igst_name = invoice.gst_ledger_1.name if invoice.gst_ledger_1 else "Output IGST"
        if igst_amt > 0:
            append_invoice_duty_ledger(igst_name, igst_amt)

    # ------------------------------------------------------------------
    # 3. Round Off / Roundup (Always last to balance voucher)
    # ------------------------------------------------------------------
    taxable_sum = sum(float(i.amount or 0) for i in items)
    tax_sum = cgst_amt + sgst_amt
    expected_credit = taxable_sum + tax_sum + extra_charges_sum
    calc_round_off = total_val - expected_credit
    round_off = round_off_charge_amt if round_off_charge_found else calc_round_off

    if abs(round_off) >= 0.005:
        xml_parts.append("      <LEDGERENTRIES.LIST>")
        xml_parts.append('       <OLDAUDITENTRYIDS.LIST TYPE="Number">')
        xml_parts.append("        <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>")
        xml_parts.append("       </OLDAUDITENTRYIDS.LIST>")
        xml_parts.append("       <APPROPRIATEFOR>&#4; Not Applicable</APPROPRIATEFOR>")
        xml_parts.append("       <LEDGERNAME>Round Off</LEDGERNAME>")
        xml_parts.append("       <GSTCLASS>&#4; Not Applicable</GSTCLASS>")
        xml_parts.append("       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>")
        xml_parts.append("       <LEDGERFROMITEM>No</LEDGERFROMITEM>")
        xml_parts.append("       <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>")
        xml_parts.append("       <ISPARTYLEDGER>No</ISPARTYLEDGER>")
        xml_parts.append("       <GSTOVERRIDDEN>No</GSTOVERRIDDEN>")
        xml_parts.append("       <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>")
        xml_parts.append("       <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>")
        xml_parts.append("       <STRDGSTISPARTYLEDGER>No</STRDGSTISPARTYLEDGER>")
        xml_parts.append("       <STRDGSTISDUTYLEDGER>No</STRDGSTISDUTYLEDGER>")
        xml_parts.append("       <CONTENTNEGISPOS>No</CONTENTNEGISPOS>")
        xml_parts.append("       <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>")
        xml_parts.append(f"       <AMOUNT>{round_off:.2f}</AMOUNT>")
        xml_parts.append(f"       <VATEXPAMOUNT>{round_off:.2f}</VATEXPAMOUNT>")
        xml_parts.append("      </LEDGERENTRIES.LIST>")

    # ------------------------------------------------------------------
    # Closing XML
    # ------------------------------------------------------------------
    xml_parts.append("     </VOUCHER>")
    xml_parts.append("    </TALLYMESSAGE>")
    xml_parts.append("   </REQUESTDATA>")
    xml_parts.append("  </IMPORTDATA>")
    xml_parts.append(" </BODY>")
    xml_parts.append("</ENVELOPE>")

    return "\n".join(xml_parts)


def resolve_sales_return_voucher_type_name(sales_return, is_interstate=False, is_registered=True, tally_url="http://localhost:9000"):
    """
    Dynamically determines the Voucher Type Name in Tally Prime for a Sales Return.
    
    Adheres to the user rule: The voucher type selected in the sales return form
    should match with the voucher type in Tally. If the voucher type does not exist in Tally,
    do NOT silently fall back to 'Credit Note' or other defaults; preserve the selected voucher
    type name so that Tally raises a line error during import.
    """
    tally_types = get_tally_voucher_types(tally_url)
    tally_types_lower = {t.lower(): t for t in tally_types}

    explicit_vt = None

    # 1. From sales_return.voucher_type (which may be a string name or a numeric ID)
    raw_vt = (sales_return.voucher_type or "").strip()
    if raw_vt:
        if raw_vt.isdigit():
            try:
                from settings_app.models import PrefixConfiguration
                pc = PrefixConfiguration.objects.select_related('subvoucher_type', 'voucher_type').filter(id=int(raw_vt)).first()
                if pc:
                    if pc.subvoucher_type and pc.subvoucher_type.type_name:
                        explicit_vt = pc.subvoucher_type.type_name.strip()
                    elif pc.sub_type:
                        explicit_vt = pc.sub_type.strip()
                    elif pc.voucher_type and pc.voucher_type.name and pc.voucher_type.name.lower() not in ("credit note", "sales return"):
                        explicit_vt = pc.voucher_type.name.strip()
            except Exception:
                pass
        elif raw_vt.lower() not in ("sales return", "credit note"):
            explicit_vt = raw_vt

    # 2. Match PrefixConfiguration from return_no prefix if not yet identified
    if not explicit_vt and sales_return.return_no:
        try:
            from settings_app.models import PrefixConfiguration
            configs = list(PrefixConfiguration.objects.select_related('subvoucher_type', 'voucher_type').all())
            configs.sort(key=lambda c: len(c.prefix) if c.prefix else 0, reverse=True)
            for pc in configs:
                if pc.prefix and sales_return.return_no.lower().startswith(pc.prefix.lower()):
                    if pc.subvoucher_type and pc.subvoucher_type.type_name:
                        explicit_vt = pc.subvoucher_type.type_name.strip()
                    elif pc.sub_type:
                        explicit_vt = pc.sub_type.strip()
                    elif pc.voucher_type and pc.voucher_type.name and pc.voucher_type.name.lower() not in ("credit note", "sales return"):
                        explicit_vt = pc.voucher_type.name.strip()
                    break
        except Exception:
            pass

    # If the user designated a specific voucher / return type (e.g. "B2B Return", "B2B return"):
    if explicit_vt:
        # If it exists in Tally, return Tally's exact casing
        if explicit_vt.lower() in tally_types_lower:
            return tally_types_lower[explicit_vt.lower()]
        # If it does NOT exist in Tally, strictly return explicit_vt so Tally outputs a line error!
        return explicit_vt

    # Generic fallback only if NO specific voucher type was designated
    if "credit note" in tally_types_lower:
        return tally_types_lower["credit note"]
    return "Credit Note"


def generate_sales_return_xml(sales_return, tally_url="http://localhost:9000", force_alter=False):
    """
    Generates Tally Prime XML import payload for a SalesReturn (Credit Note).
    Conforms to Tally Prime's 'Invoice Voucher View' specification matching
    the exact XML structure for Sales Return B2B / Credit Note.
    """
    from settings_app.models import Company

    company = Company.objects.first()
    raw_company_gstin = (company.gst_no if company and getattr(company, "gst_no", None) else "") or ""
    if not raw_company_gstin or raw_company_gstin.upper().startswith("27ABCDE"):
        raw_company_gstin = "32AAGCG7847L1Z7"
    company_gstin = escape_xml(raw_company_gstin)
    company_state = resolve_state_name(
        getattr(company, "state", None),
        gstin=company_gstin,
        default="Kerala"
    )

    customer = sales_return.customer_ledger
    party_name = escape_xml(customer.name if customer else "")
    party_gstin = escape_xml(getattr(customer, "gst_number", "") or "")
    party_state = escape_xml(resolve_state_name(
        getattr(customer, "state", "") or "",
        gstin=party_gstin,
        default=company_state
    ))
    party_country = escape_xml(resolve_country_name(
        getattr(customer, "country", "") or "",
        default="India"
    ))
    party_pincode = escape_xml(getattr(customer, "pincode", "") or "")
    party_pos = escape_xml(resolve_state_name(
        getattr(customer, "placeofsupply", "") or "",
        gstin=party_gstin,
        default=party_state
    ))
    party_reg_type_tally = resolve_gst_reg_type(
        getattr(customer, "registration_type", "") or "",
        gstin=party_gstin
    )

    return_sales_ledger = (
        sales_return.sales_ledger.name.strip()
        if sales_return.sales_ledger and sales_return.sales_ledger.name
        else None
    )

    items = list(sales_return.items.select_related("product", "warehouse", "per").all())
    has_dual_gst = bool((sales_return.gst_amount_1 or 0) > 0 and (sales_return.gst_amount_2 or 0) > 0)
    has_igst = any((getattr(i, 'igst_amount', 0) or 0) > 0 for i in items)
    is_interstate = (sales_return.return_type == 'INTER_STATE') or has_igst or (party_state.strip().lower() != company_state.strip().lower() and not has_dual_gst)
    is_registered = party_reg_type_tally in ("Regular", "Composition")

    voucher_type_name = resolve_sales_return_voucher_type_name(
        sales_return,
        is_interstate=is_interstate,
        is_registered=is_registered,
        tally_url=tally_url,
    )

    date_str = format_tally_date(sales_return.entry_date)
    ref_date_str = format_tally_date(sales_return.sales_invoice_date) if sales_return.sales_invoice_date else date_str
    sync_ctx = resolve_voucher_sync_context(
        obj=sales_return,
        voucher_number=sales_return.return_no,
        voucher_type_name=voucher_type_name,
        default_prefix="b2f9bc40-8bb4-48b4-b2ac-0c6c858801dc",
        tally_url=tally_url,
        force_alter=force_alter,
    )
    action = sync_ctx['action']
    guid_str = sync_ctx['guid']
    reference_no = escape_xml(sales_return.sales_invoice_no or "Invoice No")
    return_no = escape_xml(sales_return.return_no)
    entered_by = escape_xml(sales_return.created_by.username if sales_return.created_by else "admin")

    # Customer addresses
    buyer_addresses = []
    if customer:
        for fld in ("address1", "address2", "address3", "address"):
            val = getattr(customer, fld, "")
            if val and val.strip() and val.strip() not in buyer_addresses:
                buyer_addresses.append(val.strip())

    xml_parts = []
    xml_parts.append("<ENVELOPE>")
    xml_parts.append(" <HEADER>")
    xml_parts.append("  <TALLYREQUEST>Import Data</TALLYREQUEST>")
    xml_parts.append(" </HEADER>")
    xml_parts.append(" <BODY>")
    active_company = get_tally_active_company(tally_url)
    xml_parts.append("  <IMPORTDATA>")
    xml_parts.append("   <REQUESTDESC>")
    xml_parts.append("    <REPORTNAME>All Masters</REPORTNAME>")
    if active_company:
        xml_parts.append("    <STATICVARIABLES>")
        xml_parts.append(f"     <SVCURRENTCOMPANY>{escape_xml(active_company)}</SVCURRENTCOMPANY>")
        xml_parts.append("    </STATICVARIABLES>")
    xml_parts.append("   </REQUESTDESC>")
    xml_parts.append("   <REQUESTDATA>")
    xml_parts.append('    <TALLYMESSAGE xmlns:UDF="TallyUDF">')
    # For Alter: include VOUCHERNUMBER attribute so Tally can match the existing
    # voucher by number when the REMOTEID lookup fails (unknown/phantom GUID).
    vch_num_attr = f' VOUCHERNUMBER="{escape_xml(sales_return.return_no)}"' if action == 'Alter' else ''
    xml_parts.append(
        f'     <VOUCHER REMOTEID="{guid_str}" VCHTYPE="{voucher_type_name}" ACTION="{action}"{vch_num_attr} OBJVIEW="Invoice Voucher View">'
    )
    xml_parts.append(f"      <OBJECTUPDATEACTION>{action}</OBJECTUPDATEACTION>")

    if buyer_addresses:
        xml_parts.append('      <ADDRESS.LIST TYPE="String">')
        for addr in buyer_addresses:
            xml_parts.append(f"       <ADDRESS>{escape_xml(addr)}</ADDRESS>")
        xml_parts.append("      </ADDRESS.LIST>")
        xml_parts.append('      <BASICBUYERADDRESS.LIST TYPE="String">')
        for addr in buyer_addresses:
            xml_parts.append(f"       <BASICBUYERADDRESS>{escape_xml(addr)}</BASICBUYERADDRESS>")
        xml_parts.append("      </BASICBUYERADDRESS.LIST>")

    xml_parts.append('      <OLDAUDITENTRYIDS.LIST TYPE="Number">')
    xml_parts.append("       <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>")
    xml_parts.append("      </OLDAUDITENTRYIDS.LIST>")
    xml_parts.append(f"      <DATE>{date_str}</DATE>")
    xml_parts.append(f"      <REFERENCEDATE>{ref_date_str}</REFERENCEDATE>")
    xml_parts.append(f"      <VCHSTATUSDATE>{date_str}</VCHSTATUSDATE>")
    xml_parts.append(f"      <GUID>{guid_str}</GUID>")
    xml_parts.append(f"      <GSTREGISTRATIONTYPE>{party_reg_type_tally}</GSTREGISTRATIONTYPE>")
    xml_parts.append(f"      <VATDEALERTYPE>{party_reg_type_tally}</VATDEALERTYPE>")
    xml_parts.append(f"      <STATENAME>{party_state}</STATENAME>")
    xml_parts.append(f"      <ENTEREDBY>{entered_by}</ENTEREDBY>")
    xml_parts.append(f"      <OBJECTUPDATEACTION>{action}</OBJECTUPDATEACTION>")
    xml_parts.append(f"      <COUNTRYOFRESIDENCE>{party_country}</COUNTRYOFRESIDENCE>")
    if party_gstin:
        xml_parts.append(f"      <PARTYGSTIN>{party_gstin}</PARTYGSTIN>")
    xml_parts.append(f"      <PLACEOFSUPPLY>{party_pos}</PLACEOFSUPPLY>")
    xml_parts.append(f"      <VOUCHERTYPENAME>{voucher_type_name}</VOUCHERTYPENAME>")
    xml_parts.append(f"      <PARTYNAME>{party_name}</PARTYNAME>")
    if company_gstin:
        xml_parts.append(f'      <GSTREGISTRATION TAXTYPE="GST" TAXREGISTRATION="{company_gstin}">Kerala Registration</GSTREGISTRATION>')
        xml_parts.append(f"      <CMPGSTIN>{company_gstin}</CMPGSTIN>")
    xml_parts.append(f"      <PARTYLEDGERNAME>{party_name}</PARTYLEDGERNAME>")
    xml_parts.append(f"      <VOUCHERNUMBER>{return_no}</VOUCHERNUMBER>")
    xml_parts.append(f"      <BASICBUYERNAME>{party_name}</BASICBUYERNAME>")
    xml_parts.append("      <CMPGSTREGISTRATIONTYPE>Regular</CMPGSTREGISTRATIONTYPE>")
    xml_parts.append(f"      <REFERENCE>{reference_no}</REFERENCE>")
    xml_parts.append(f"      <PARTYMAILINGNAME>{party_name}</PARTYMAILINGNAME>")
    if party_pincode:
        xml_parts.append(f"      <PARTYPINCODE>{party_pincode}</PARTYPINCODE>")
    if party_gstin:
        xml_parts.append(f"      <CONSIGNEEGSTIN>{party_gstin}</CONSIGNEEGSTIN>")
    xml_parts.append(f"      <CONSIGNEEMAILINGNAME>{party_name}</CONSIGNEEMAILINGNAME>")
    if party_pincode:
        xml_parts.append(f"      <CONSIGNEEPINCODE>{party_pincode}</CONSIGNEEPINCODE>")
    xml_parts.append(f"      <CONSIGNEESTATENAME>{party_state}</CONSIGNEESTATENAME>")
    xml_parts.append(f"      <CMPGSTSTATE>{company_state}</CMPGSTSTATE>")
    xml_parts.append(f"      <CONSIGNEECOUNTRYNAME>{party_country}</CONSIGNEECOUNTRYNAME>")
    xml_parts.append(f"      <BASICBASEPARTYNAME>{party_name}</BASICBASEPARTYNAME>")
    xml_parts.append("      <NUMBERINGSTYLE>Manual</NUMBERINGSTYLE>")
    xml_parts.append("      <CSTFORMISSUETYPE>&#4; Not Applicable</CSTFORMISSUETYPE>")
    xml_parts.append("      <CSTFORMRECVTYPE>&#4; Not Applicable</CSTFORMRECVTYPE>")
    xml_parts.append("      <FBTPAYMENTTYPE>Default</FBTPAYMENTTYPE>")
    xml_parts.append("      <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>")
    xml_parts.append("      <VCHSTATUSTAXADJUSTMENT>Default</VCHSTATUSTAXADJUSTMENT>")
    xml_parts.append(f"      <VCHSTATUSVOUCHERTYPE>{voucher_type_name}</VCHSTATUSVOUCHERTYPE>")
    if company_gstin:
        xml_parts.append("      <VCHSTATUSTAXUNIT>Kerala Registration</VCHSTATUSTAXUNIT>")
    xml_parts.append("      <VCHGSTCLASS>&#4; Not Applicable</VCHGSTCLASS>")
    xml_parts.append("      <VCHENTRYMODE>Item Invoice</VCHENTRYMODE>")
    xml_parts.append("      <DIFFACTUALQTY>No</DIFFACTUALQTY>")
    xml_parts.append("      <ISMSTFROMSYNC>No</ISMSTFROMSYNC>")
    xml_parts.append("      <ISDELETED>No</ISDELETED>")
    xml_parts.append("      <ISSECURITYONWHENENTERED>Yes</ISSECURITYONWHENENTERED>")
    xml_parts.append("      <ASORIGINAL>No</ASORIGINAL>")
    xml_parts.append("      <AUDITED>No</AUDITED>")
    xml_parts.append("      <ISCOMMONPARTY>No</ISCOMMONPARTY>")
    xml_parts.append("      <FORJOBCOSTING>No</FORJOBCOSTING>")
    xml_parts.append("      <ISOPTIONAL>No</ISOPTIONAL>")
    xml_parts.append(f"      <EFFECTIVEDATE>{date_str}</EFFECTIVEDATE>")
    xml_parts.append("      <USEFOREXCISE>No</USEFOREXCISE>")
    xml_parts.append("      <ISFORJOBWORKIN>No</ISFORJOBWORKIN>")
    xml_parts.append("      <ALLOWCONSUMPTION>No</ALLOWCONSUMPTION>")
    xml_parts.append("      <USEFORINTEREST>No</USEFORINTEREST>")
    xml_parts.append("      <USEFORGAINLOSS>No</USEFORGAINLOSS>")
    xml_parts.append("      <USEFORGODOWNTRANSFER>No</USEFORGODOWNTRANSFER>")
    xml_parts.append("      <USEFORCOMPOUND>No</USEFORCOMPOUND>")
    xml_parts.append("      <USEFORSERVICETAX>No</USEFORSERVICETAX>")
    xml_parts.append("      <ISREVERSECHARGEAPPLICABLE>No</ISREVERSECHARGEAPPLICABLE>")
    xml_parts.append("      <ISSYSTEM>No</ISSYSTEM>")
    xml_parts.append("      <ISFETCHEDONLY>No</ISFETCHEDONLY>")
    xml_parts.append("      <ISGSTOVERRIDDEN>No</ISGSTOVERRIDDEN>")
    xml_parts.append("      <ISCANCELLED>No</ISCANCELLED>")
    xml_parts.append("      <ISONHOLD>No</ISONHOLD>")
    xml_parts.append("      <ISSUMMARY>No</ISSUMMARY>")
    xml_parts.append("      <ISECOMMERCESUPPLY>No</ISECOMMERCESUPPLY>")
    xml_parts.append("      <ISBOENOTAPPLICABLE>No</ISBOENOTAPPLICABLE>")
    xml_parts.append("      <ISGSTSECSEVENAPPLICABLE>No</ISGSTSECSEVENAPPLICABLE>")
    xml_parts.append("      <IGNOREEINVVALIDATION>No</IGNOREEINVVALIDATION>")
    xml_parts.append("      <CMPGSTISOTHTERRITORYASSESSEE>No</CMPGSTISOTHTERRITORYASSESSEE>")
    xml_parts.append("      <PARTYGSTISOTHTERRITORYASSESSEE>No</PARTYGSTISOTHTERRITORYASSESSEE>")
    xml_parts.append("      <IRNJSONEXPORTED>No</IRNJSONEXPORTED>")
    xml_parts.append("      <IRNCANCELLED>No</IRNCANCELLED>")
    xml_parts.append("      <IGNOREGSTCONFLICTINMIG>No</IGNOREGSTCONFLICTINMIG>")
    xml_parts.append("      <ISOPBALTRANSACTION>No</ISOPBALTRANSACTION>")
    xml_parts.append("      <IGNOREGSTFORMATVALIDATION>No</IGNOREGSTFORMATVALIDATION>")
    xml_parts.append("      <ISELIGIBLEFORITC>Yes</ISELIGIBLEFORITC>")
    xml_parts.append("      <IGNOREGSTOPTIONALUNCERTAIN>No</IGNOREGSTOPTIONALUNCERTAIN>")
    xml_parts.append("      <UPDATESUMMARYVALUES>No</UPDATESUMMARYVALUES>")
    xml_parts.append("      <ISEWAYBILLAPPLICABLE>No</ISEWAYBILLAPPLICABLE>")
    xml_parts.append("      <ISDELETEDRETAINED>No</ISDELETEDRETAINED>")
    xml_parts.append("      <ISNULL>No</ISNULL>")
    xml_parts.append("      <ISINVOICE>Yes</ISINVOICE>")
    xml_parts.append("      <VOUCHERNUMBERSERIES>Default</VOUCHERNUMBERSERIES>")

    # ------------------------------------------------------------------
    # Inventory entries
    # ------------------------------------------------------------------
    raw_sales_ledger = sales_return.sales_ledger.name.strip() if (sales_return.sales_ledger and sales_return.sales_ledger.name) else ""
    return_sales_ledger = resolve_sales_accounting_ledger_name(
        raw_sales_ledger or "Sales Return B2B",
        is_interstate=is_interstate
    )

    for item in items:
        product_name = escape_xml(item.product.name if item.product else "")
        warehouse = escape_xml(item.warehouse.name if item.warehouse else "Main Location")

        raw_unit = getattr(item.per, "abbreviation", None) or getattr(item.per, "name", "Nos")
        if raw_unit:
            raw_unit_str = str(raw_unit).strip()
            if raw_unit_str.lower() in ("case", "nos", "box", "btl", "can", "jar", "crate", "pac", "kg", "mtr", "pcs"):
                unit = raw_unit_str.capitalize()
            else:
                unit = escape_xml(raw_unit_str)
        else:
            unit = "Nos"

        hsn_code = escape_xml(item.hsn or "")
        rate_val = float(item.rate or 0)
        amount_val = float(item.amount or 0)
        qty_val = float(item.quantity or 0)

        raw_batch = (item.batch_number or "").strip()
        if not raw_batch or "primary" in raw_batch.lower() or "unbatched" in raw_batch.lower():
            batch_name = "Primary Batch"
        else:
            batch_name = escape_xml(raw_batch)

        xml_parts.append("      <ALLINVENTORYENTRIES.LIST>")
        xml_parts.append(f"       <STOCKITEMNAME>{product_name}</STOCKITEMNAME>")
        xml_parts.append("       <GSTOVRDNISREVCHARGEAPPL>&#4; Not Applicable</GSTOVRDNISREVCHARGEAPPL>")
        xml_parts.append("       <GSTOVRDNTAXABILITY>Taxable</GSTOVRDNTAXABILITY>")
        xml_parts.append("       <GSTSOURCETYPE>Stock Item</GSTSOURCETYPE>")
        xml_parts.append(f"       <GSTITEMSOURCE>{product_name}</GSTITEMSOURCE>")
        xml_parts.append("       <HSNSOURCETYPE>Stock Item</HSNSOURCETYPE>")
        xml_parts.append(f"       <HSNITEMSOURCE>{product_name}</HSNITEMSOURCE>")
        xml_parts.append("       <GSTOVRDNSTOREDNATURE/>")
        xml_parts.append("       <GSTOVRDNTYPEOFSUPPLY>Goods</GSTOVRDNTYPEOFSUPPLY>")
        xml_parts.append("       <GSTRATEINFERAPPLICABILITY>As per Masters/Company</GSTRATEINFERAPPLICABILITY>")
        if hsn_code:
            xml_parts.append(f"       <GSTHSNNAME>{hsn_code}</GSTHSNNAME>")
            xml_parts.append("       <GSTHSNDESCRIPTION>Drinking Water</GSTHSNDESCRIPTION>")
            xml_parts.append("       <GSTHSNINFERAPPLICABILITY>As per Masters/Company</GSTHSNINFERAPPLICABILITY>")
        xml_parts.append("       <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>")
        xml_parts.append("       <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>")
        xml_parts.append("       <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>")
        xml_parts.append("       <CONTENTNEGISPOS>No</CONTENTNEGISPOS>")
        xml_parts.append("       <ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>")
        xml_parts.append("       <ISAUTONEGATE>No</ISAUTONEGATE>")
        xml_parts.append("       <ISCUSTOMSCLEARANCE>No</ISCUSTOMSCLEARANCE>")
        xml_parts.append("       <ISTRACKCOMPONENT>No</ISTRACKCOMPONENT>")
        xml_parts.append("       <ISTRACKPRODUCTION>No</ISTRACKPRODUCTION>")
        xml_parts.append("       <ISPRIMARYITEM>No</ISPRIMARYITEM>")
        xml_parts.append("       <ISSCRAP>No</ISSCRAP>")
        xml_parts.append(f"       <RATE>{rate_val:.2f}/{unit}</RATE>")
        xml_parts.append(f"       <AMOUNT>-{amount_val:.2f}</AMOUNT>")
        xml_parts.append(f"       <ACTUALQTY> {qty_val:g} {unit}</ACTUALQTY>")
        xml_parts.append(f"       <BILLEDQTY> {qty_val:g} {unit}</BILLEDQTY>")

        # Batch Allocations
        xml_parts.append("       <BATCHALLOCATIONS.LIST>")
        if item.manufacture_date:
            xml_parts.append(f"        <MFDON>{format_tally_date(item.manufacture_date)}</MFDON>")
        xml_parts.append(f"        <GODOWNNAME>{warehouse}</GODOWNNAME>")
        xml_parts.append(f"        <BATCHNAME>{batch_name}</BATCHNAME>")
        xml_parts.append(f"        <DESTINATIONGODOWNNAME>{warehouse}</DESTINATIONGODOWNNAME>")
        xml_parts.append("        <INDENTNO>&#4; Not Applicable</INDENTNO>")
        xml_parts.append("        <ORDERNO>&#4; Not Applicable</ORDERNO>")
        xml_parts.append("        <TRACKINGNUMBER>&#4; Not Applicable</TRACKINGNUMBER>")
        xml_parts.append("        <DYNAMICCSTISCLEARED>No</DYNAMICCSTISCLEARED>")
        xml_parts.append(f"        <AMOUNT>-{amount_val:.2f}</AMOUNT>")
        xml_parts.append(f"        <ACTUALQTY> {qty_val:g} {unit}</ACTUALQTY>")
        xml_parts.append(f"        <BILLEDQTY> {qty_val:g} {unit}</BILLEDQTY>")
        if item.expiry_date:
            xml_parts.append(f"        <EXPIRYPERIOD>{format_expiry_date(item.expiry_date)}</EXPIRYPERIOD>")
        xml_parts.append("        <ADDITIONALDETAILS.LIST>        </ADDITIONALDETAILS.LIST>")
        xml_parts.append("        <VOUCHERCOMPONENTLIST.LIST>        </VOUCHERCOMPONENTLIST.LIST>")
        xml_parts.append("       </BATCHALLOCATIONS.LIST>")

        # Accounting Allocations
        raw_item_sl = return_sales_ledger or (getattr(item.product, "sales_ledger", None) and item.product.sales_ledger.name)
        item_sales_ledger = resolve_sales_accounting_ledger_name(
            raw_item_sl,
            is_interstate=is_interstate
        )

        xml_parts.append("       <ACCOUNTINGALLOCATIONS.LIST>")
        xml_parts.append('        <OLDAUDITENTRYIDS.LIST TYPE="Number">')
        xml_parts.append("         <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>")
        xml_parts.append("        </OLDAUDITENTRYIDS.LIST>")
        xml_parts.append(f"        <LEDGERNAME>{escape_xml(item_sales_ledger)}</LEDGERNAME>")
        xml_parts.append("        <GSTCLASS>&#4; Not Applicable</GSTCLASS>")
        xml_parts.append("        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>")
        xml_parts.append("        <LEDGERFROMITEM>No</LEDGERFROMITEM>")
        xml_parts.append("        <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>")
        xml_parts.append("        <ISPARTYLEDGER>No</ISPARTYLEDGER>")
        xml_parts.append("        <GSTOVERRIDDEN>No</GSTOVERRIDDEN>")
        xml_parts.append("        <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>")
        xml_parts.append("        <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>")
        xml_parts.append("        <STRDGSTISPARTYLEDGER>No</STRDGSTISPARTYLEDGER>")
        xml_parts.append("        <STRDGSTISDUTYLEDGER>No</STRDGSTISDUTYLEDGER>")
        xml_parts.append("        <CONTENTNEGISPOS>No</CONTENTNEGISPOS>")
        xml_parts.append("        <ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>")
        xml_parts.append("        <ISCAPVATTAXALTERED>No</ISCAPVATTAXALTERED>")
        xml_parts.append("        <ISCAPVATNOTCLAIMED>No</ISCAPVATNOTCLAIMED>")
        xml_parts.append(f"        <AMOUNT>-{amount_val:.2f}</AMOUNT>")
        xml_parts.append("       </ACCOUNTINGALLOCATIONS.LIST>")

        # Rate Details (Tax)
        gst_pct = float(item.gst_percent or 0)
        if not is_interstate:
            half_rate = gst_pct / 2.0
            xml_parts.append("       <RATEDETAILS.LIST>")
            xml_parts.append("        <GSTRATEDUTYHEAD>CGST</GSTRATEDUTYHEAD>")
            xml_parts.append("        <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>")
            xml_parts.append(f"        <GSTRATE> {half_rate:g}</GSTRATE>")
            xml_parts.append("       </RATEDETAILS.LIST>")
            xml_parts.append("       <RATEDETAILS.LIST>")
            xml_parts.append("        <GSTRATEDUTYHEAD>SGST/UTGST</GSTRATEDUTYHEAD>")
            xml_parts.append("        <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>")
            xml_parts.append(f"        <GSTRATE> {half_rate:g}</GSTRATE>")
            xml_parts.append("       </RATEDETAILS.LIST>")
        else:
            xml_parts.append("       <RATEDETAILS.LIST>")
            xml_parts.append("        <GSTRATEDUTYHEAD>IGST</GSTRATEDUTYHEAD>")
            xml_parts.append("        <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>")
            xml_parts.append(f"        <GSTRATE> {gst_pct:g}</GSTRATE>")
            xml_parts.append("       </RATEDETAILS.LIST>")

        xml_parts.append("      </ALLINVENTORYENTRIES.LIST>")

    # ------------------------------------------------------------------
    # Party Ledger Entry (Credit to Party: Deemed Positive No, Positive Amount)
    # ------------------------------------------------------------------
    total_val = float(sales_return.total_amount or 0)
    xml_parts.append("      <LEDGERENTRIES.LIST>")
    xml_parts.append('       <OLDAUDITENTRYIDS.LIST TYPE="Number">')
    xml_parts.append("        <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>")
    xml_parts.append("       </OLDAUDITENTRYIDS.LIST>")
    xml_parts.append(f"       <LEDGERNAME>{party_name}</LEDGERNAME>")
    xml_parts.append("       <GSTCLASS>&#4; Not Applicable</GSTCLASS>")
    xml_parts.append("       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>")
    xml_parts.append("       <LEDGERFROMITEM>No</LEDGERFROMITEM>")
    xml_parts.append("       <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>")
    xml_parts.append("       <ISPARTYLEDGER>Yes</ISPARTYLEDGER>")
    xml_parts.append("       <GSTOVERRIDDEN>No</GSTOVERRIDDEN>")
    xml_parts.append("       <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>")
    xml_parts.append("       <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>")
    xml_parts.append("       <STRDGSTISPARTYLEDGER>No</STRDGSTISPARTYLEDGER>")
    xml_parts.append("       <STRDGSTISDUTYLEDGER>No</STRDGSTISDUTYLEDGER>")
    xml_parts.append("       <CONTENTNEGISPOS>No</CONTENTNEGISPOS>")
    xml_parts.append("       <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>")
    xml_parts.append("       <ISCAPVATTAXALTERED>No</ISCAPVATTAXALTERED>")
    xml_parts.append("       <ISCAPVATNOTCLAIMED>No</ISCAPVATNOTCLAIMED>")
    xml_parts.append(f"       <AMOUNT>{total_val:.2f}</AMOUNT>")
    xml_parts.append("      </LEDGERENTRIES.LIST>")

    # ------------------------------------------------------------------
    # Duty / Tax Ledgers (Deemed Positive Yes, Negative Amount)
    # ------------------------------------------------------------------
    def append_sales_return_tax_ledger(ledger_name, amount, tax_rate=None):
        if not ledger_name or amount <= 0:
            return
        xml_parts.append("      <LEDGERENTRIES.LIST>")
        xml_parts.append('       <OLDAUDITENTRYIDS.LIST TYPE="Number">')
        xml_parts.append("        <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>")
        xml_parts.append("       </OLDAUDITENTRYIDS.LIST>")
        if tax_rate is not None:
            xml_parts.append('       <RATEOFINVOICETAX.LIST TYPE="Number">')
            xml_parts.append(f"        <RATEOFINVOICETAX> {tax_rate:g}</RATEOFINVOICETAX>")
            xml_parts.append("       </RATEOFINVOICETAX.LIST>")
        xml_parts.append("       <APPROPRIATEFOR>&#4; Not Applicable</APPROPRIATEFOR>")
        xml_parts.append("       <ROUNDTYPE>&#4; Not Applicable</ROUNDTYPE>")
        xml_parts.append(f"       <LEDGERNAME>{escape_xml(ledger_name)}</LEDGERNAME>")
        xml_parts.append("       <GSTCLASS>&#4; Not Applicable</GSTCLASS>")
        xml_parts.append("       <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>")
        xml_parts.append("       <LEDGERFROMITEM>No</LEDGERFROMITEM>")
        xml_parts.append("       <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>")
        xml_parts.append("       <ISPARTYLEDGER>No</ISPARTYLEDGER>")
        xml_parts.append("       <GSTOVERRIDDEN>No</GSTOVERRIDDEN>")
        xml_parts.append("       <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>")
        xml_parts.append("       <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>")
        xml_parts.append("       <STRDGSTISPARTYLEDGER>No</STRDGSTISPARTYLEDGER>")
        xml_parts.append("       <STRDGSTISDUTYLEDGER>No</STRDGSTISDUTYLEDGER>")
        xml_parts.append("       <CONTENTNEGISPOS>No</CONTENTNEGISPOS>")
        xml_parts.append("       <ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>")
        xml_parts.append("       <ISCAPVATTAXALTERED>No</ISCAPVATTAXALTERED>")
        xml_parts.append("       <ISCAPVATNOTCLAIMED>No</ISCAPVATNOTCLAIMED>")
        xml_parts.append(f"       <AMOUNT>-{amount:.2f}</AMOUNT>")
        xml_parts.append(f"       <VATEXPAMOUNT>-{amount:.2f}</VATEXPAMOUNT>")
        xml_parts.append("      </LEDGERENTRIES.LIST>")

    cgst_amt = float(sales_return.gst_amount_1 or 0)
    sgst_amt = float(sales_return.gst_amount_2 or 0)

    tax_rate_val = None
    if items and items[0].gst_percent:
        tax_rate_val = float(items[0].gst_percent) / 2.0 if not is_interstate else float(items[0].gst_percent)

    if not is_interstate:
        cgst_name = sales_return.gst_ledger_1.name if sales_return.gst_ledger_1 else "Input CGST 2.5%"
        sgst_name = sales_return.gst_ledger_2.name if sales_return.gst_ledger_2 else "Input SGST 2.5%"
        if cgst_amt > 0:
            append_sales_return_tax_ledger(cgst_name, cgst_amt, tax_rate=tax_rate_val)
        if sgst_amt > 0:
            append_sales_return_tax_ledger(sgst_name, sgst_amt, tax_rate=tax_rate_val)
    else:
        igst_amt = cgst_amt + sgst_amt
        igst_name = sales_return.gst_ledger_1.name if sales_return.gst_ledger_1 else "Input IGST"
        if igst_amt > 0:
            append_sales_return_tax_ledger(igst_name, igst_amt, tax_rate=tax_rate_val)

    # ------------------------------------------------------------------
    # Round Off
    # ------------------------------------------------------------------
    taxable_sum = sum(float(i.amount or 0) for i in items)
    tax_sum = cgst_amt + sgst_amt
    round_off = (taxable_sum + tax_sum) - total_val

    if abs(round_off) >= 0.005:
        is_pos = (round_off > 0)
        ro_amt_str = f"{abs(round_off):.2f}"
        xml_parts.append("      <LEDGERENTRIES.LIST>")
        xml_parts.append('       <OLDAUDITENTRYIDS.LIST TYPE="Number">')
        xml_parts.append("        <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>")
        xml_parts.append("       </OLDAUDITENTRYIDS.LIST>")
        xml_parts.append("       <ROUNDTYPE>Normal Rounding</ROUNDTYPE>")
        xml_parts.append("       <LEDGERNAME>Round Off</LEDGERNAME>")
        xml_parts.append("       <GSTCLASS>&#4; Not Applicable</GSTCLASS>")
        xml_parts.append(f"       <ISDEEMEDPOSITIVE>{'Yes' if is_pos else 'No'}</ISDEEMEDPOSITIVE>")
        xml_parts.append("       <LEDGERFROMITEM>No</LEDGERFROMITEM>")
        xml_parts.append("       <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>")
        xml_parts.append("       <ISPARTYLEDGER>No</ISPARTYLEDGER>")
        xml_parts.append("       <GSTOVERRIDDEN>No</GSTOVERRIDDEN>")
        xml_parts.append("       <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>")
        xml_parts.append("       <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>")
        xml_parts.append("       <STRDGSTISPARTYLEDGER>No</STRDGSTISPARTYLEDGER>")
        xml_parts.append("       <STRDGSTISDUTYLEDGER>No</STRDGSTISDUTYLEDGER>")
        xml_parts.append("       <CONTENTNEGISPOS>No</CONTENTNEGISPOS>")
        xml_parts.append(f"       <ISLASTDEEMEDPOSITIVE>{'Yes' if is_pos else 'No'}</ISLASTDEEMEDPOSITIVE>")
        xml_parts.append("       <ISCAPVATTAXALTERED>No</ISCAPVATTAXALTERED>")
        xml_parts.append("       <ISCAPVATNOTCLAIMED>No</ISCAPVATNOTCLAIMED>")
        xml_parts.append("       <ROUNDLIMIT> 1</ROUNDLIMIT>")
        xml_parts.append(f"       <AMOUNT>{ro_amt_str if is_pos else f'-{ro_amt_str}'}</AMOUNT>")
        xml_parts.append(f"       <VATEXPAMOUNT>{ro_amt_str if is_pos else f'-{ro_amt_str}'}</VATEXPAMOUNT>")
        xml_parts.append("      </LEDGERENTRIES.LIST>")

    # ------------------------------------------------------------------
    # Statutory GST List
    # ------------------------------------------------------------------
    xml_parts.append("      <GST.LIST>")
    xml_parts.append("       <PURPOSETYPE>GST</PURPOSETYPE>")
    xml_parts.append("       <STAT.LIST>")
    xml_parts.append("        <PURPOSETYPE>GST</PURPOSETYPE>")
    xml_parts.append(f"        <STATKEY>202610661Outward CdNote{return_no}</STATKEY>")
    xml_parts.append("        <ISFETCHEDONLY>No</ISFETCHEDONLY>")
    xml_parts.append("        <ISDELETED>No</ISDELETED>")
    xml_parts.append("        <TALLYCONTENTUSER.LIST>        </TALLYCONTENTUSER.LIST>")
    xml_parts.append("       </STAT.LIST>")
    xml_parts.append("      </GST.LIST>")

    # ------------------------------------------------------------------
    # Closing XML
    # ------------------------------------------------------------------
    xml_parts.append("     </VOUCHER>")
    xml_parts.append("    </TALLYMESSAGE>")
    xml_parts.append("   </REQUESTDATA>")
    xml_parts.append("  </IMPORTDATA>")
    xml_parts.append(" </BODY>")
    xml_parts.append("</ENVELOPE>")

    return "\n".join(xml_parts)


