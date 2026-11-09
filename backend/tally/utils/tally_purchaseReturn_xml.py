import os
import uuid
from datetime import datetime
from decimal import Decimal
from django.conf import settings
from django.template import Template, Context

import logging

logger = logging.getLogger(__name__)

# The three values PurchaseReturn.voucher_type can hold directly via its own
# model choices (not via a PrefixConfiguration id). These map 1:1 to the
# actual Tally voucher types already in use — this is a fixed, internal
# mapping (not a client-naming assumption), so it's safe to hardcode.
_BASE_CHOICE_MAP = {
    "b2b purchase": "B2B Purchase Return",
    "b2c purchase": "B2C Purchase Return",
    "igst purchase": "IGST Purchase Return",
}


def resolve_voucher_type_name(purchase_return):
    """
    Resolve the Tally voucher type name for a purchase return.

    Mirrors the pattern used for purchase invoices in xml_builder.py:
    read the name directly from whatever the client has configured in
    PrefixConfiguration (sub_type / subvoucher_type.type_name), rather than
    matching against a hardcoded table of client-decided labels. This is
    what makes it safe against clients naming their voucher sub-types
    differently, and against PrefixConfiguration row IDs differing per
    client/environment.

    The one exception is PurchaseReturn's own three built-in model choices
    ('B2B Purchase', 'B2C Purchase', 'IGST Purchase') — those aren't
    client-defined text, they're this app's fixed enum, so they're mapped
    to their known Tally voucher type names to keep existing behaviour
    unchanged for any records using them directly.
    """
    raw_vtype = str(purchase_return.voucher_type or "").strip()
    vch_type_attr = ""

    if raw_vtype.isdigit():
        try:
            from settings_app.models import PrefixConfiguration
            p_config = PrefixConfiguration.objects.filter(id=int(raw_vtype)).first()
            if p_config:
                if p_config.sub_type and p_config.sub_type.strip():
                    vch_type_attr = p_config.sub_type.strip()
                elif p_config.subvoucher_type:
                    sub_val = (
                        getattr(p_config.subvoucher_type, "type_name", None)
                        or getattr(p_config.subvoucher_type, "name", None)
                    )
                    if sub_val:
                        vch_type_attr = str(sub_val).strip()
        except Exception:
            logger.warning(
                "Purchase return %s: could not resolve PrefixConfiguration id '%s'.",
                getattr(purchase_return, "pk", "?"), raw_vtype,
            )
    elif raw_vtype.lower() in _BASE_CHOICE_MAP:
        vch_type_attr = _BASE_CHOICE_MAP[raw_vtype.lower()]
    elif raw_vtype:
        # Unrecognized free text — use it exactly as configured/entered,
        # same as the invoice code does, rather than forcing it into a
        # fixed set of expected labels.
        vch_type_attr = raw_vtype

    if not vch_type_attr:
        vch_type_attr = "Debit Note"

    return vch_type_attr


def _is_b2c_return(purchase_return):
    """
    True if this purchase return is a B2C (unregistered-party) voucher.

    GST must NEVER be posted for these — the supplier is unregistered, so
    there's no input tax credit and no duty ledger to post against. This
    is checked independently of whatever happens to be sitting in
    gst_ledger_1/gst_ledger_2/gst_amount_1/gst_amount_2 on the record,
    because those fields can hold stale values (e.g. a ledger was cleared
    in the UI but the computed tax amount wasn't), and independently of
    whatever GST ledgers happen to be configured against this voucher
    type's PrefixConfiguration in Settings — B2C is exempt by rule, not by
    configuration hygiene.

    Mirrors resolve_voucher_type_name()'s logic for reading the sub-type
    label, since voucher_type may be either a PrefixConfiguration id or
    one of PurchaseReturn's own base choices (e.g. "b2c purchase").
    """
    raw_vtype = str(purchase_return.voucher_type or "").strip()

    if raw_vtype.isdigit():
        try:
            from settings_app.models import PrefixConfiguration
            p_config = PrefixConfiguration.objects.filter(id=int(raw_vtype)).first()
            if p_config:
                label = (p_config.sub_type or "").strip()
                if not label and p_config.subvoucher_type:
                    label = str(
                        getattr(p_config.subvoucher_type, "type_name", None)
                        or getattr(p_config.subvoucher_type, "name", "")
                        or ""
                    ).strip()
                return "b2c" in label.lower()
        except Exception:
            logger.warning(
                "Purchase return %s: could not resolve PrefixConfiguration id '%s' "
                "for B2C check — treating as non-B2C.",
                getattr(purchase_return, "pk", "?"), raw_vtype,
            )
        return False

    return "b2c" in raw_vtype.lower()


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

def get_tally_jd(value):
    if not value:
        return ""
    if isinstance(value, str):
        try:
            value = datetime.strptime(value, "%Y-%m-%d").date()
        except ValueError:
            return ""
    if isinstance(value, datetime):
        value = value.date()
    # Tally epoch is 1899-12-30
    import datetime as dt
    epoch = dt.date(1899, 12, 30)
    return str((value - epoch).days)

def format_tally_display_date(value):
    if not value:
        return ""
    if isinstance(value, str):
        try:
            value = datetime.strptime(value, "%Y-%m-%d").date()
        except ValueError:
            return value
    if isinstance(value, datetime):
        value = value.date()
    return value.strftime("%d-%b-%Y")


def generate_purchase_return_xml(order):
    """
    Generates Tally XML for a PurchaseReturn record using the exact template
    structure in purchase_return.txt.
    """
    # 1. Load purchase_return.txt template
    template_path = os.path.join(settings.BASE_DIR, 'tally', 'purchase_return.txt')
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Tally XML template not found at {template_path}")

    with open(template_path, 'r', encoding='utf-8') as f:
        raw_template = f.read()

    template = Template(raw_template)

    # 2. Fetch Company details
    from settings_app.models import Company
    company = Company.objects.first()

    cmp_name = escape_xml(company.name if company and company.name else "Company Name")
    cmp_gstin = escape_xml(company.gst_no if company and getattr(company, "gst_no", None) else "")
    cmp_state = escape_xml(company.state if company and getattr(company, "state", None) else "Kerala")
    cmp_pincode = escape_xml(company.pincode if company and getattr(company, "pincode", None) else "")

    buyer_address_lines = []
    if company:
        for addr_field in ["address1", "address2", "address3", "address"]:
            val = getattr(company, addr_field, "")
            if val and val.strip():
                buyer_address_lines.append(escape_xml(val.strip()))
    if not buyer_address_lines:
        buyer_address_lines.append(cmp_name)

    # 3. Supplier Details
    supplier = order.supplier_ledger
    party_name = escape_xml(supplier.name if supplier else "")
    party_gstin = escape_xml(getattr(supplier, "gst_number", "") or "")
    party_state = escape_xml(getattr(supplier, "state", "") or cmp_state)
    party_country = escape_xml(getattr(supplier, "country", "") or "India")
    party_pincode = escape_xml(getattr(supplier, "pincode", "") or "")
    # Place of supply for a purchase return is always the company's own
    # registration state — it should never come from the supplier record.
    party_pos = cmp_state
    party_reg_type = str(getattr(supplier, "registration_type", "unknown")).lower()

    if party_reg_type == "registered":
        gst_reg_type = "Regular"
    elif party_reg_type == "composition":
        gst_reg_type = "Composition"
    elif party_reg_type == "unregistered":
        gst_reg_type = "Unregistered/Consumer"
    else:
        gst_reg_type = "Regular"

    party_address_lines = []
    if supplier:
        for addr_field in ["address1", "address2", "address3", "address"]:
            val = getattr(supplier, addr_field, "")
            if val and val.strip():
                party_address_lines.append(escape_xml(val.strip()))
    if not party_address_lines:
        party_address_lines.append(party_name)

    # 4. Voucher Dates and IDs
    entry_date_str = format_date(order.entry_date) or datetime.now().strftime("%Y%m%d")
    ref_date_str = format_date(order.supplier_invoice_date) or entry_date_str

    remote_id = f"PR-{order.pk}"
    guid_val = str(uuid.uuid5(uuid.NAMESPACE_OID, remote_id))

    voucher_type_name = resolve_voucher_type_name(order)
    is_b2c = _is_b2c_return(order)

    entered_by = "Administrator"
    if order.created_by:
        entered_by = escape_xml(order.created_by.first_name or order.created_by.username or "Administrator")

    purchase_ledger_name = escape_xml(order.purchase_ledger.name if order.purchase_ledger else "Purchase Return")

    # 5. Inventory Items List
    items_data = []
    total_taxable_amount = Decimal("0.00")

    for item in order.items.select_related("product", "godown", "per"):
        item_product_name = escape_xml(item.product.name if item.product else "")
        unit_str = escape_xml(
            getattr(item.per, "abbreviation", None)
            or getattr(item.per, "name", "Nos")
        )
        godown_str = escape_xml(item.godown.name if item.godown else "Main Location")
        batch_str = escape_xml(item.batch_number if item.batch_number else "Primary Batch")

        hsn_str = escape_xml(item.hsn or "")

        item_amt = item.amount or Decimal("0.00")
        total_taxable_amount += item_amt

        # In Tally Debit Notes (Purchase Returns), inventory amounts are positive (Credit)
        amount_formatted = f"{item_amt:.2f}"
        rate_formatted = f"{item.rate:.2f}/{unit_str}"
        qty_formatted = f"{item.quantity:.2f} {unit_str}"

        mfd_on_str = format_tally_display_date(item.manufacture_date) if item.manufacture_date else ""
        exp_period_str = format_tally_display_date(item.expiry_date) if item.expiry_date else ""
        expiry_jd = get_tally_jd(item.expiry_date) if item.expiry_date else ""

        # B2C is unregistered — never show/apply a GST rate on the item,
        # even if the item master still has one configured.
        gst_pct = Decimal("0.00") if is_b2c else (item.gst_percent or Decimal("0.00"))
        if order.gst_type == "INTER_STATE":
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

    # 6. GST Ledgers & Roundoff
    #
    # B2C is unregistered — no input tax credit, no duty ledger to post
    # against — so GST is suppressed unconditionally here, regardless of
    # what gst_ledger_1/2 or gst_amount_1/2 hold on the record. This is a
    # deliberate hard stop, not just "no ledger configured": we never
    # invent a ledger name to post an orphaned tax amount against (the old
    # fallback here used to silently default to "Input SGST"/"Input CGST"/
    # "Input IGST" whenever the amount was nonzero, even with no ledger
    # actually linked — that's removed). If a ledger isn't genuinely
    # linked, nothing is posted for it, full stop.
    if is_b2c:
        gst_ledger_1_name = None
        gst_amount_1_formatted = None
        gst_rate_1 = ""
        gst_ledger_2_name = None
        gst_amount_2_formatted = None
        gst_rate_2 = ""

        if (order.gst_amount_1 or Decimal("0.00")) > 0 or (order.gst_amount_2 or Decimal("0.00")) > 0:
            logger.warning(
                "Purchase return %s is B2C but has nonzero gst_amount_1/gst_amount_2 "
                "stored on the record (%s / %s) — suppressing GST in the Tally export. "
                "Worth checking why tax was calculated for an unregistered supplier.",
                getattr(order, "pk", "?"), order.gst_amount_1, order.gst_amount_2,
            )
    else:
        gst_ledger_1_name = (
            escape_xml(order.gst_ledger_1.name)
            if order.gst_ledger_1 and order.gst_amount_1 > 0
            else None
        )
        gst_amount_1_formatted = f"{order.gst_amount_1:.2f}" if gst_ledger_1_name else None
        gst_rate_1 = ""
        if gst_ledger_1_name:
            max_gst = max((i.gst_percent for i in order.items.all()), default=Decimal("0.00"))
            gst_rate_1 = f"{max_gst / Decimal('2'):.2f}" if order.gst_type == "STATE" else f"{max_gst:.2f}"

        gst_ledger_2_name = (
            escape_xml(order.gst_ledger_2.name)
            if order.gst_ledger_2 and order.gst_amount_2 > 0
            else None
        )
        gst_amount_2_formatted = f"{order.gst_amount_2:.2f}" if gst_ledger_2_name else None
        gst_rate_2 = ""
        if gst_ledger_2_name:
            max_gst = max((i.gst_percent for i in order.items.all()), default=Decimal("0.00"))
            gst_rate_2 = f"{max_gst / Decimal('2'):.2f}"

        # A nonzero GST amount with no ledger actually linked used to
        # silently fall back to a guessed ledger name. That's no longer
        # done — log it instead so it's visible and fixable at the source
        # (the record should have a ledger linked, or the amount should be
        # zero), rather than guessing in Tally.
        if order.gst_amount_1 and order.gst_amount_1 > 0 and not order.gst_ledger_1:
            logger.warning(
                "Purchase return %s has gst_amount_1=%s but no gst_ledger_1 linked — "
                "skipping this GST entry in the Tally export instead of guessing a ledger.",
                getattr(order, "pk", "?"), order.gst_amount_1,
            )
        if order.gst_amount_2 and order.gst_amount_2 > 0 and not order.gst_ledger_2:
            logger.warning(
                "Purchase return %s has gst_amount_2=%s but no gst_ledger_2 linked — "
                "skipping this GST entry in the Tally export instead of guessing a ledger.",
                getattr(order, "pk", "?"), order.gst_amount_2,
            )

    # Extra Charges
    extra_charges_data = []
    total_extra_charges = Decimal("0.00")
    for charge in order.extra_charges.all():
        charge_amt = charge.amount or Decimal("0.00")
        total_extra_charges += charge_amt
        # For Debit Note, extra charge ledger (like Inventory) is credited
        extra_charges_data.append({
            "ledger_name": escape_xml(charge.ledger.name),
            "amount_formatted": f"{charge_amt:.2f}"
        })

    # Roundoff calculation
    #
    # Uses only the GST amounts that are actually being posted in this XML
    # (gst_amount_1_formatted / gst_amount_2_formatted), not the raw
    # order.gst_amount_1/2 fields. If GST was suppressed above (B2C, or a
    # nonzero amount with no ledger linked) but total_amount on the record
    # still includes that tax, using the raw fields here would make this
    # block treat the whole orphaned tax amount as a "rounding difference"
    # and silently dump it into a second Roundoff ledger line — which is
    # exactly the duplicate "Round Off" line this was producing.
    posted_tax = Decimal("0.00")
    if gst_amount_1_formatted:
        posted_tax += order.gst_amount_1 or Decimal("0.00")
    if gst_amount_2_formatted:
        posted_tax += order.gst_amount_2 or Decimal("0.00")

    expected_total = total_taxable_amount + posted_tax + total_extra_charges
    roundoff = (order.total_amount or Decimal("0.00")) - expected_total

    roundoff_amount_formatted = None
    if abs(roundoff) >= Decimal("0.01"):
        # Round off in credit direction
        roundoff_amount_formatted = f"{roundoff:.2f}"
        if is_b2c:
            logger.warning(
                "Purchase return %s (B2C) has a %.2f gap between total_amount and "
                "items + extra charges after suppressing GST. This is being posted "
                "as a Roundoff ledger entry, but it likely means total_amount on "
                "the record still includes tax that should be removed at the "
                "source (recalculate/save the return) rather than rounded off.",
                getattr(order, "pk", "?"), roundoff,
            )

    # For Debit Note, Party Ledger is Debit (Negative)
    total_amount_formatted = f"-{order.total_amount:.2f}"
    ref_no = escape_xml(order.supplier_invoice_no or order.return_no)
    vch_no = escape_xml(order.return_no)

    context_data = {
        "ITEM_ISDEEMEDPOSITIVE": "No",
        "PARTY_ISDEEMEDPOSITIVE": "Yes",
        "REMOTE_ID": remote_id,
        "VOUCHER_ID": remote_id,
        "GUID": guid_val,
        "VOUCHER_TYPE_NAME": voucher_type_name,
        "DATE": entry_date_str,
        "REFERENCE_DATE": ref_date_str,
        "GST_REGISTRATION_TYPE": gst_reg_type,
        "VAT_DEALER_TYPE": "Regular",
        "STATE_NAME": party_state,
        "ENTERED_BY": entered_by,
        "COUNTRY_OF_RESIDENCE": party_country,
        "PARTY_GSTIN": party_gstin,
        "PLACE_OF_SUPPLY": party_pos,
        "PARTY_NAME": party_name,
        "PARTY_LEDGER_NAME": party_name,
        "PARTY_MAILING_NAME": party_name,
        "BUYER_NAME": cmp_name,
        "CMP_GSTIN": cmp_gstin,
        "CMP_GST_STATE": cmp_state,
        "CMP_GST_REG_TYPE": "Regular",
        "VOUCHER_NUMBER": vch_no,
        "REFERENCE_NO": ref_no,
        "PARTY_PINCODE": party_pincode,
        "CONSIGNEE_PINCODE": cmp_pincode,
        "CONSIGNEE_PIN_NUMBER": cmp_pincode,
        "ORIGINAL_INVOICE_NO": order.supplier_invoice_no or "",
        "ORIGINAL_INVOICE_DATE": order.supplier_invoice_date.strftime("%Y%m%d") if order.supplier_invoice_date else "",
        "party_address_lines": party_address_lines,
        "buyer_address_lines": buyer_address_lines,
        "items": items_data,
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
    }

    return template.render(Context(context_data))