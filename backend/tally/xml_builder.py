import os
import re
import uuid
import logging
from datetime import datetime
from decimal import Decimal
from django.conf import settings
from django.template import Template, Context

logger = logging.getLogger('tally_sync')


def escape_xml(text):
    if text is None:
        return ""
    return str(text)


def format_date(value):
    if not value:
        return ""
    if isinstance(value, str):
        try:
            value = datetime.strptime(value, "%Y-%m-%d").date()
        except ValueError:
            return value
    return value.strftime("%Y%m%d")

   

def generate_purchase_invoice_xml(invoice, action=None):
    """
    Generates Tally XML for a PurchaseInvoice record using the exact template
    structure in purchase.txt.
    """
    if action is None:
        from purchase_app.models import PurchaseInvoiceSyncLog
        has_synced = PurchaseInvoiceSyncLog.objects.filter(invoice=invoice, status='success').exists()
        action = "Alter" if has_synced else "Create"
    # 0. Pre-flight Master Name Validation & Trimming (Bug 2)
    if not invoice.supplier_ledger or not getattr(invoice.supplier_ledger, "name", None) or not invoice.supplier_ledger.name.strip():
        raise ValueError(f"supplier_ledger is not set on PurchaseInvoice #{invoice.pk} ({invoice.invoice_no})")

    if not invoice.purchase_ledger or not getattr(invoice.purchase_ledger, "name", None) or not invoice.purchase_ledger.name.strip():
        raise ValueError(f"purchase_ledger is not set on PurchaseInvoice #{invoice.pk} ({invoice.invoice_no})")

    items_qs = invoice.items.select_related("product", "godown", "per")
    if not items_qs.exists():
        raise ValueError(f"No line items found on PurchaseInvoice #{invoice.pk} ({invoice.invoice_no})")

    for item in items_qs:
        if not item.product or not getattr(item.product, "name", None) or not item.product.name.strip():
            raise ValueError(f"product is not set on PurchaseInvoiceItem #{item.pk} for Invoice {invoice.invoice_no}")

    # 1. Load purchase.txt template
    template_path = os.path.join(settings.BASE_DIR, 'tally', 'purchase.txt')
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Tally XML template not found at {template_path}")

    with open(template_path, 'r', encoding='utf-8') as f:
        raw_template = f.read()

    template = Template(raw_template)

    # 2. Fetch Company details
    from settings_app.models import Company
    company = Company.objects.first()

    cmp_name = escape_xml(company.name.strip() if company and company.name else "Company Name")
    cmp_gstin = escape_xml(company.gst_no if company and getattr(company, "gst_no", None) else "")
    cmp_state = escape_xml(company.state.strip() if company and getattr(company, "state", None) else "Kerala")
    cmp_pincode = escape_xml(company.pincode if company and getattr(company, "pincode", None) else "")
    cmp_gst_reg_name = escape_xml(getattr(company, "gst_registration_name", None) or "Default")

    buyer_address_lines = []
    if company:
        for addr_field in ["address1", "address2", "address3", "address"]:
            val = getattr(company, addr_field, "")
            if val and val.strip():
                buyer_address_lines.append(escape_xml(val.strip()))
    if not buyer_address_lines:
        buyer_address_lines.append(cmp_name)

    # 3. Supplier Details
    supplier = invoice.supplier_ledger
    party_name = escape_xml(supplier.name.strip())
    party_gstin = escape_xml(getattr(supplier, "gst_number", "") or "")
    party_state = escape_xml(getattr(supplier, "state", "") or cmp_state)
    party_country = escape_xml(getattr(supplier, "country", "") or "India")
    party_pincode = escape_xml(getattr(supplier, "pincode", "") or "")
    # party_pos = escape_xml(getattr(supplier, "placeofsupply", "") or party_state)
    party_pos = escape_xml(getattr(supplier, "placeofsupply", "") or "Kerala")
    party_reg_type = str(getattr(supplier, "registration_type", "unknown")).lower()

    if party_reg_type == "registered":
        gst_reg_type = "Regular"
    elif party_reg_type == "composition":
        gst_reg_type = "Composition"
    elif party_reg_type == "unregistered":
        gst_reg_type = "Unregistered/Consumer"
    else:
        gst_reg_type = "Unregistered/Consumer"

    party_address_lines = []
    if supplier:
        for addr_field in ["address1", "address2", "address3", "address"]:
            val = getattr(supplier, addr_field, "")
            if val and val.strip():
                party_address_lines.append(escape_xml(val.strip()))
    if not party_address_lines:
        party_address_lines.append(party_name)

    # 4. Voucher Dates and IDs
    entry_date_str = format_date(invoice.entry_date) or datetime.now().strftime("%Y%m%d")
    ref_date_str = format_date(invoice.supplier_invoice_date) or entry_date_str

    # Voucher Type Name & Sub-Voucher Type & Prefix
    master_voucher_type_name = ""
    vch_type_attr = ""
    vch_prefix = ""
    p_config = None

    raw_vtype = (invoice.voucher_type or "").strip()
    if raw_vtype.isdigit():
        try:
            from settings_app.models import PrefixConfiguration
            p_config = PrefixConfiguration.objects.filter(id=int(raw_vtype)).first()
            if p_config:
                if getattr(p_config, 'prefix', None) and p_config.prefix.strip():
                    vch_prefix = p_config.prefix.strip()

                if p_config.voucher_type:
                    v_val = getattr(p_config.voucher_type, 'name', None)
                    if v_val:
                        master_voucher_type_name = str(v_val).strip()

                if p_config.sub_type and p_config.sub_type.strip():
                    vch_type_attr = p_config.sub_type.strip()
                elif p_config.subvoucher_type:
                    sub_val = getattr(p_config.subvoucher_type, 'type_name', None) or getattr(p_config.subvoucher_type, 'name', None)
                    if sub_val:
                        vch_type_attr = str(sub_val).strip()
        except Exception:
            pass
    elif raw_vtype:
        vch_type_attr = raw_vtype

    if not vch_prefix:
        inv_no = (invoice.invoice_no or "").strip()
        match = re.match(r'^([A-Za-z0-9_-]+?)(?:[-/_]?\d+)$', inv_no)
        if match:
            vch_prefix = match.group(1).strip()
        else:
            vch_prefix = "PI"

    remote_id = f"GLENDA-{vch_prefix}-{invoice.pk}"
    guid_val = str(uuid.uuid5(uuid.NAMESPACE_DNS, remote_id))

    if not master_voucher_type_name:
        master_voucher_type_name = "Purchase"

    if not vch_type_attr:
        vch_type_attr = master_voucher_type_name

    entered_by = "Administrator"
    if invoice.created_by:
        entered_by = escape_xml(invoice.created_by.first_name or invoice.created_by.username or "Administrator")

    purchase_ledger_name = escape_xml(invoice.purchase_ledger.name.strip())

    # 5. Inventory Items List
    items_data = []
    total_taxable_amount = Decimal("0.00")

    for item in items_qs:
        item_product_name = escape_xml(item.product.name.strip())
        unit_str = escape_xml(
            getattr(item.per, "abbreviation", None)
            or getattr(item.per, "name", "Nos")
        )
        godown_str = escape_xml(item.godown.name.strip() if item.godown and item.godown.name else "Main Location")
        batch_str = escape_xml(item.batch_number.strip() if item.batch_number else "Primary Batch")

        hsn_str = escape_xml(item.hsn or "")

        item_amt = item.amount or Decimal("0.00")
        total_taxable_amount += item_amt

        # In Tally purchase vouchers, item inventory amounts are negative (debit)
        amount_formatted = f"-{item_amt:.2f}"
        rate_formatted = f"{item.rate:.2f}/{unit_str}"
        qty_formatted = f"{item.quantity:.2f} {unit_str}"

        from tally.utils.tally_purchaseReturn_xml import format_tally_display_date, get_tally_jd
        
        mfd_on_str = format_tally_display_date(item.manufacture_date) if item.manufacture_date else ""
        exp_period_str = format_tally_display_date(item.expiry_date) if item.expiry_date else ""
        expiry_jd = get_tally_jd(item.expiry_date) if item.expiry_date else ""


        gst_pct = item.gst_percent or Decimal("0.00")
        if invoice.gst_type == "INTER_STATE":
            cgst_rate = "0.00"
            sgst_rate = "0.00"
            igst_rate = f"{gst_pct:.2f}"
        else:
            cgst_rate = f"{gst_pct / Decimal('2'):.2f}"
            sgst_rate = f"{gst_pct / Decimal('2'):.2f}"
            igst_rate = "0.00"

        items_data.append({
            "stock_item_name": item_product_name,
            "hsn_code": hsn_str,
            "rate_formatted": rate_formatted,
            "amount_formatted": amount_formatted,
            "qty_formatted": qty_formatted,
            "godown_name": godown_str,
            "batch_name": batch_str,
            "mfd_on": mfd_on_str,
            "expiry_period": exp_period_str,
            "expiry_jd": expiry_jd,
            "cgst_rate": cgst_rate,
            "sgst_rate": sgst_rate,
            "igst_rate": igst_rate,
        })

    # 5b. Extra Charges List
    extra_charges_qs = invoice.extra_charges.select_related('ledger', 'ledger__accountGroup')
    extra_charges_data = []
    post_tax_extra_charges_data = []
    total_extra_charges = Decimal("0.00")

    for ec in extra_charges_qs:
        if not ec.ledger or not ec.ledger.name or not ec.ledger.name.strip():
            continue
        ec_amt = ec.amount or Decimal("0.00")
        if ec_amt == Decimal("0.00"):
            continue

        total_extra_charges += ec_amt
        ec_ledger_name = escape_xml(ec.ledger.name.strip())
        parent_grp = "Direct Expenses"
        if ec.ledger.accountGroup and getattr(ec.ledger.accountGroup, "name", None) and ec.ledger.accountGroup.name.strip():
            parent_grp = escape_xml(ec.ledger.accountGroup.name.strip())

        item_dict = {
            "ledger_name": ec_ledger_name,
            "parent_group": parent_grp,
            "amount_formatted": f"{-ec_amt:.2f}",
        }
        if "round" in ec.ledger.name.lower():
            post_tax_extra_charges_data.append(item_dict)
        else:
            extra_charges_data.append(item_dict)

    # 6. GST Ledgers & Roundoff
    gst_l1_obj = invoice.gst_ledger_1
    if not gst_l1_obj and p_config:
        try:
            gst_ledgers = list(p_config.gst_ledger.all())
            if gst_ledgers:
                gst_l1_obj = gst_ledgers[0]
        except Exception:
            pass

    gst_ledger_1_name = escape_xml(gst_l1_obj.name.strip()) if (gst_l1_obj and gst_l1_obj.name) else None
    if not gst_ledger_1_name and invoice.gst_amount_1 and invoice.gst_amount_1 > Decimal("0.00"):
        from finance_app.models import Ledger
        # if invoice.gst_type == "INTER_STATE":
        #     db_ledger = Ledger.objects.filter(name__icontains='IGST').first()
        #     gst_ledger_1_name = escape_xml(db_ledger.name.strip()) if (db_ledger and db_ledger.name) else "IGST"
        # else:
        #     db_ledger = Ledger.objects.filter(name__icontains='CGST').first()
        #     gst_ledger_1_name = escape_xml(db_ledger.name.strip()) if (db_ledger and db_ledger.name) else "CGST"
        if invoice.gst_type == "INTER_STATE":
            db_ledger = (
                Ledger.objects.filter(name__icontains='Input IGST').first()
                or Ledger.objects.filter(name__icontains='IGST').exclude(name__icontains='Output').first()
            )
            if not db_ledger:
                raise ValueError(f"No Input IGST ledger found for Invoice {invoice.invoice_no}. Configure a GST ledger for this voucher type.")
            gst_ledger_1_name = escape_xml(db_ledger.name.strip())
        else:
            db_ledger = (
                Ledger.objects.filter(name__icontains='Input CGST').first()
                or Ledger.objects.filter(name__icontains='CGST').exclude(name__icontains='Output').first()
            )
            if not db_ledger:
                raise ValueError(f"No Input CGST ledger found for Invoice {invoice.invoice_no}. Configure a GST ledger for this voucher type.")
            gst_ledger_1_name = escape_xml(db_ledger.name.strip())

    gst_amount_1_formatted = f"-{invoice.gst_amount_1:.2f}" if (gst_ledger_1_name and invoice.gst_amount_1 and invoice.gst_amount_1 > Decimal("0.00")) else None
    gst_rate_1 = ""
    if gst_ledger_1_name and invoice.gst_amount_1 and invoice.gst_amount_1 > Decimal("0.00"):
        max_gst = max((i.gst_percent for i in items_qs), default=Decimal("0.00"))
        gst_rate_1 = f"{max_gst / Decimal('2'):.2f}" if invoice.gst_type == "STATE" else f"{max_gst:.2f}"

    gst_l2_obj = invoice.gst_ledger_2
    if not gst_l2_obj and p_config:
        try:
            gst_ledgers = list(p_config.gst_ledger.all())
            if len(gst_ledgers) > 1:
                gst_l2_obj = gst_ledgers[1]
        except Exception:
            pass
    is_inter_state = (invoice.gst_type == "INTER_STATE")

    # gst_ledger_2_name = escape_xml(gst_l2_obj.name.strip()) if (gst_l2_obj and gst_l2_obj.name) else None
    # if not gst_ledger_2_name and invoice.gst_amount_2 and invoice.gst_amount_2 > Decimal("0.00"):
    #     from finance_app.models import Ledger
    #     db_ledger = Ledger.objects.filter(name__icontains='SGST').first()
    #     gst_ledger_2_name = escape_xml(db_ledger.name.strip()) if (db_ledger and db_ledger.name) else "SGST"

    gst_ledger_2_name = escape_xml(gst_l2_obj.name.strip()) if (gst_l2_obj and gst_l2_obj.name and not is_inter_state) else None
    if not gst_ledger_2_name and not is_inter_state and invoice.gst_amount_2 and invoice.gst_amount_2 > Decimal("0.00"):
        from finance_app.models import Ledger
        # db_ledger = Ledger.objects.filter(name__icontains='SGST').first()
        # gst_ledger_2_name = escape_xml(db_ledger.name.strip()) if (db_ledger and db_ledger.name) else "SGST"
        db_ledger = (
            Ledger.objects.filter(name__icontains='Input SGST').first()
            or Ledger.objects.filter(name__icontains='SGST').exclude(name__icontains='Output').first()
        )
        if not db_ledger:
            raise ValueError(f"No Input SGST ledger found for Invoice {invoice.invoice_no}. Configure a GST ledger for this voucher type.")
        gst_ledger_2_name = escape_xml(db_ledger.name.strip())

    gst_amount_2_formatted = f"-{invoice.gst_amount_2:.2f}" if (gst_ledger_2_name and not is_inter_state and invoice.gst_amount_2 and invoice.gst_amount_2 > Decimal("0.00")) else None
    gst_rate_2 = ""
    if gst_ledger_2_name and not is_inter_state and invoice.gst_amount_2 and invoice.gst_amount_2 > Decimal("0.00"):
        max_gst = max((i.gst_percent for i in items_qs), default=Decimal("0.00"))
        gst_rate_2 = f"{max_gst / Decimal('2'):.2f}"

    # Roundoff calculation
    total_tax = (invoice.gst_amount_1 or Decimal("0.00")) + (invoice.gst_amount_2 or Decimal("0.00"))
    expected_total = total_taxable_amount + total_extra_charges + total_tax
    roundoff = (invoice.total_amount or Decimal("0.00")) - expected_total

    roundoff_amount_formatted = None
    roundoff_ledger_name = "Round Off"
    if abs(roundoff) >= Decimal("0.01"):
        roundoff_amount_formatted = f"{-roundoff:.2f}"
        from finance_app.models import Ledger
        r_ledger = Ledger.objects.filter(name__icontains='Round').first()
        if r_ledger and r_ledger.name:
            roundoff_ledger_name = escape_xml(r_ledger.name.strip())

    total_amount_formatted = f"{invoice.total_amount:.2f}"
    ref_no = escape_xml(invoice.supplier_invoice_no or invoice.invoice_no)
    vch_no = escape_xml(invoice.invoice_no)

    context_data = {
        "ACTION": action,
        "REMOTE_ID": remote_id,
        "VOUCHER_ID": remote_id,
        "GUID": guid_val,
        "VCHTYPE": vch_type_attr,
        "VOUCHER_TYPE_NAME": vch_type_attr,
        "DATE": entry_date_str,
        "REFERENCE_DATE": ref_date_str,
        "GST_REGISTRATION_TYPE": gst_reg_type,
        "VAT_DEALER_TYPE": "Regular",
        "STATE_NAME": party_state,
        "ENTERED_BY": entered_by,
        "COUNTRY_OF_RESIDENCE": party_country,
        "PARTY_GSTIN": party_gstin,
        "PLACE_OF_SUPPLY": 'Kerala',
        "PARTY_NAME": party_name,
        "PARTY_LEDGER_NAME": party_name,
        "PARTY_MAILING_NAME": party_name,
        "BUYER_NAME": cmp_name,
        "CMP_GSTIN": cmp_gstin,
        "CMP_GST_STATE": cmp_state,
        "CMP_GST_REGISTRATION_NAME": cmp_gst_reg_name,
        "CMP_GST_REG_TYPE": "Regular",
        "VOUCHER_NUMBER": vch_no,
        "REFERENCE_NO": ref_no,
        "PARTY_PINCODE": party_pincode,
        "CONSIGNEE_PINCODE": cmp_pincode,
        "CONSIGNEE_PIN_NUMBER": cmp_pincode,
        "party_address_lines": party_address_lines,
        "buyer_address_lines": buyer_address_lines,
        "items": items_data,
        "extra_charges": extra_charges_data,
        "post_tax_extra_charges": post_tax_extra_charges_data,
        "purchase_ledger_name": purchase_ledger_name,
        "TOTAL_AMOUNT": total_amount_formatted,
        "gst_ledger_1_name": gst_ledger_1_name,
        "gst_amount_1_formatted": gst_amount_1_formatted,
        "gst_rate_1": gst_rate_1,
        "gst_ledger_2_name": gst_ledger_2_name,
        "gst_amount_2_formatted": gst_amount_2_formatted,
        "gst_rate_2": gst_rate_2,
        "extra_charges": extra_charges_data,
        "roundoff_amount_formatted": roundoff_amount_formatted,
        "ROUNDOFF_LEDGER_NAME": roundoff_ledger_name,
    }

    rendered_xml = template.render(Context(context_data))

    # Self-Check (Bug 1): Parse top-level ALLINVENTORYENTRIES.LIST and LEDGERENTRIES.LIST <AMOUNT> tags to ensure Debit = Credit (net sum == 0.00)
    inv_blocks = re.findall(r'<ALLINVENTORYENTRIES.LIST>(.*?)</ALLINVENTORYENTRIES.LIST>', rendered_xml, re.DOTALL)
    top_amounts = []
    for b in inv_blocks:
        m = re.search(r'<AMOUNT>(.*?)</AMOUNT>', b)
        if m and m.group(1).strip():
            top_amounts.append(Decimal(m.group(1).strip()))

    ledg_blocks = re.findall(r'<LEDGERENTRIES.LIST>(.*?)</LEDGERENTRIES.LIST>', rendered_xml, re.DOTALL)
    for b in ledg_blocks:
        m = re.search(r'<AMOUNT>(.*?)</AMOUNT>', b)
        if m and m.group(1).strip():
            top_amounts.append(Decimal(m.group(1).strip()))

    total_net_amount = sum(top_amounts, Decimal("0.00"))

    if abs(total_net_amount) >= Decimal("0.01"):
        logger.error(f"Debit/Credit total mismatch for Invoice {invoice.invoice_no}: net sum is {total_net_amount:.4f}")
        raise ValueError(
            f"XML Debit/Credit imbalance for Invoice {invoice.invoice_no}: "
            f"Net sum of top-level XML entries is {total_net_amount:.2f} (must net to exactly 0.00)."
        )

    return rendered_xml
