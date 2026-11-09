import re
import logging
import requests
from django.utils import timezone
from django.conf import settings
from sales_app.models import (
    SalesOrder, SalesOrderSyncLog,
    SalesInvoice, SalesInvoiceSyncLog,
    SalesReturn, SalesReturnSyncLog,
    TallySyncConfig
)
from sales_app.utils.tally_xml import (
    generate_sales_order_xml,
    generate_sales_invoice_xml,
    generate_sales_return_xml,
    get_tally_existing_voucher_info
)

logger = logging.getLogger('tally_sync')

def normalize_voucher_type(vtype):
    """
    Normalizes voucher type string to standard canonical form ('Sales Order', 'Sales Invoice', 'Sales Return').
    """
    if not vtype:
        return 'Sales Order'
    s = str(vtype).strip().lower()
    if 'invoice' in s:
        return 'Sales Invoice'
    elif 'return' in s:
        return 'Sales Return'
    elif 'order' in s:
        return 'Sales Order'
    return str(vtype).strip()


def get_tally_config(voucher_type='Sales Order'):
    """
    Retrieves or creates default TallySyncConfig for the given voucher type.
    """
    norm_type = normalize_voucher_type(voucher_type)
    config = TallySyncConfig.objects.filter(voucher_type__iexact=norm_type).first()
    if not config:
        config, _ = TallySyncConfig.objects.get_or_create(
            voucher_type=norm_type,
            defaults={
                'auto_push_on_save': False,
                'tally_url': getattr(settings, 'TALLY_URL', 'http://localhost:9000'),
            }
        )
    return config


def parse_tally_response(response_text, order=None, invoice=None, return_obj=None, tally_url=None):
    """
    Parses Tally XML response to determine success and extract descriptive message.
    Decodes HTML entities and pinpoints the exact cause of exceptions or failures.
    Supports SalesOrder, SalesInvoice, and SalesReturn objects.
    """
    import html

    if not response_text:
        return False, "Empty response from Tally."

    # Decode HTML entities like &apos; -> '
    decoded_text = html.unescape(response_text)

    # 1. Look for explicit <LINEERROR> tags
    line_errors = re.findall(r'<LINEERROR>(.*?)</LINEERROR>', decoded_text, re.DOTALL | re.IGNORECASE)
    if line_errors:
        clean_errors = " | ".join([err.strip() for err in line_errors if err.strip()])
        if "could not find company" in clean_errors.lower():
            return False, (
                f"No company is currently opened in Tally Prime ({clean_errors}). "
                f"Please verify Tally Prime is running and open your company (e.g. 'Test Company') "
                f"so that the Gateway of Tally is visible, then retry."
            )
        return False, clean_errors

    # 2. Check for <EXCEPTIONS> count
    exceptions_match = re.search(r'<EXCEPTIONS>(\d+)</EXCEPTIONS>', decoded_text, re.IGNORECASE)
    if exceptions_match and int(exceptions_match.group(1)) > 0:
        exc_count = exceptions_match.group(1)
        if return_obj:
            doc_type = "Sales Return"
            doc_no = return_obj.return_no
        elif invoice:
            doc_type = "Sales Invoice"
            doc_no = invoice.invoice_no
        else:
            doc_type = "Sales Order"
            doc_no = order.so_no if order else ""
        label = f" for '{doc_no}'" if doc_no else ""

        # Check for 'No accounting allocations' (affects_stock = False on ledger)
        if tally_url:
            try:
                from sales_app.utils.tally_xml import get_tally_sales_ledgers
                tally_ledgers = get_tally_sales_ledgers(tally_url)
                sl_to_check = None
                if return_obj and getattr(return_obj, 'sales_ledger', None):
                    sl_to_check = return_obj.sales_ledger.name
                elif invoice and getattr(invoice, 'sales_ledger', None):
                    sl_to_check = invoice.sales_ledger.name
                if sl_to_check and tally_ledgers:
                    ch_info = tally_ledgers.get(sl_to_check.strip().lower())
                    if ch_info and not ch_info[1]:
                        return False, (
                            f"No accounting allocations: Ledger '{ch_info[0]}' in Tally has "
                            f"'Inventory values are affected' set to 'No'. In Tally Prime, go to Gateway of Tally > "
                            f"Alter > Ledger > '{ch_info[0]}' and set 'Inventory values are affected?' to 'Yes'."
                        )
            except Exception:
                pass

        # Try to extract Tally's actual rejection reason from the response body.
        # Tally embeds the real reason in LINEERROR, EXCEPTIONDESC, or DESC tags.
        tally_reason = None
        for tag in ('LINEERROR', 'EXCEPTIONDESC', 'ERRORDESC', 'DESC'):
            tag_m = re.search(rf'<{tag}>(.*?)</{tag}>', decoded_text, re.DOTALL | re.IGNORECASE)
            if tag_m and tag_m.group(1).strip():
                tally_reason = tag_m.group(1).strip()
                break

        # Log the full raw response for debugging
        logger.error(
            f"Tally EXCEPTIONS={exc_count}{label}. Raw response (first 800 chars): "
            f"{decoded_text[:800]}"
        )

        if tally_reason:
            return False, (
                f"Tally Exception ({exc_count}){label}: {tally_reason}"
            )
        return False, (
            f"Tally Exception ({exc_count}): Voucher import was rejected by Tally{label}. "
            f"Common causes: Voucher number already exists in Tally (duplicate), "
            f"the date is outside the company's active financial year, "
            f"or required master (item, ledger, or voucher type) does not exist in Tally. "
            f"Raw response: {decoded_text[:400]}"
        )

    # 3. Check for <ERRORS> count
    errors_match = re.search(r'<ERRORS>(\d+)</ERRORS>', decoded_text, re.IGNORECASE)
    if errors_match and int(errors_match.group(1)) > 0:
        desc_match = re.search(r'<DESC>(.*?)</DESC>', decoded_text, re.DOTALL | re.IGNORECASE)
        err_detail = desc_match.group(1).strip() if desc_match else f"{errors_match.group(1)} error(s) reported by Tally."
        return False, err_detail

    # 4. Check for <CREATED> or <ALTERED>
    created_match = re.search(r'<CREATED>(\d+)</CREATED>', decoded_text, re.IGNORECASE)
    altered_match = re.search(r'<ALTERED>(\d+)</ALTERED>', decoded_text, re.IGNORECASE)
    created_count = int(created_match.group(1)) if created_match else 0
    altered_count = int(altered_match.group(1)) if altered_match else 0

    if created_count > 0 or altered_count > 0:
        return True, f"Tally successfully synced (Created: {created_count}, Altered: {altered_count})."

    # 5. Check if 0 created and 0 altered
    if created_match and altered_match and created_count == 0 and altered_count == 0:
        return False, "Tally did not create or alter any voucher. The entry may be duplicate or blocked by Tally rules."

    # Fallback text search
    if ('Created' in decoded_text or 'Altered' in decoded_text) and ('Error' not in decoded_text and 'failed' not in decoded_text.lower()):
        return True, "Sales order successfully imported to Tally."

    return False, (decoded_text[:300] + '...') if len(decoded_text) > 300 else decoded_text


def push_sales_order_to_tally(order, tally_url=None, user=None, push_type='manual'):
    """
    Pushes a single SalesOrder to Tally server and logs the result.
    If the client-side Tally Agent is connected, queues the order for the agent.
    """
    from django.utils import timezone
    config = get_tally_config('Sales Order')
    agent_connected = bool(
        config and getattr(config, 'agent_last_seen', None) and
        (timezone.now() - config.agent_last_seen).total_seconds() < 90
    )
    if agent_connected:
        order.sync_status = 'queued'
        order.is_synced = False
        order.save(update_fields=['sync_status', 'is_synced'])
        SalesOrderSyncLog.objects.create(
            sales_order=order,
            status='failed',
            error_message='Queued for Tally Agent push',
            synced_by=user,
            push_type=push_type
        )
        return {
            'success': True,
            'order_id': order.id,
            'so_no': order.so_no,
            'status': 'queued',
            'queued': True,
            'message': f"Sales order {order.so_no} queued for Tally Agent. It will be pushed in a few seconds.",
        }

    if not tally_url:
        tally_url = config.tally_url or 'http://localhost:9000'

    try:
        xml_data = generate_sales_order_xml(order, tally_url=tally_url)
        response = requests.post(
            tally_url,
            data=xml_data.encode('utf-8'),
            headers={'Content-Type': 'text/xml'},
            timeout=15
        )

        is_success, message = parse_tally_response(response.text, order=order, tally_url=tally_url)

        # Auto-retry with Alter when Tally returns EXCEPTIONS (duplicate voucher number).
        # This handles two scenarios:
        #   A) tally_guid is NULL — legacy path sent Create but voucher already exists in Tally.
        #   B) tally_guid is set to a phantom GUID — a GUID saved before a previous push was
        #      confirmed successful. Tally can’t find it by REMOTEID, treats Alter as Create,
        #      hits duplicate voucher number.
        # Fix: Clear the stored GUID so the legacy path runs fresh (using the live Tally
        # collection query with the now-correct tally_url) to determine the right action.
        # Auto-retry with Alter when Tally returns EXCEPTIONS (duplicate voucher number).
        # Handles both: tally_guid=NULL (Create sent but voucher exists) and
        # tally_guid=phantom (stored before a push was confirmed, or mismatched with Tally).
        # Fix: Query Tally live to discover the actual REMOTEID of the existing voucher in Tally,
        # update order.tally_guid, and retry with ACTION="Alter" and the true REMOTEID.
        if not is_success and 'EXCEPTIONS' in response.text:
            prior_guid = order.tally_guid
            logger.warning(
                f"[Tally Retry] EXCEPTIONS on first attempt for order {order.so_no}. "
                f"Querying Tally live for existing voucher REMOTEID..."
            )
            vch_info = get_tally_existing_voucher_info(order.so_no, voucher_type_name="Sales Order", tally_url=tally_url)
            if vch_info.get('exists') and vch_info.get('remote_id'):
                logger.info(f"[Tally Retry] Found existing REMOTEID in Tally: {vch_info['remote_id']}")
                order.tally_guid = vch_info['remote_id']
                order.save(update_fields=['tally_guid'])
            else:
                logger.warning("[Tally Retry] Could not discover existing REMOTEID from Tally, attempting force_alter.")

            xml_data = generate_sales_order_xml(order, tally_url=tally_url, force_alter=True)
            response = requests.post(
                tally_url,
                data=xml_data.encode('utf-8'),
                headers={'Content-Type': 'text/xml'},
                timeout=15
            )
            is_success, message = parse_tally_response(response.text, order=order, tally_url=tally_url)
            if not is_success and prior_guid and not order.tally_guid:
                order.tally_guid = prior_guid
                order.save(update_fields=['tally_guid'])

        order.sync_status = 'synced' if is_success else 'failed'
        order.is_synced = is_success

        # Persist the GUID on the first successful Create push so future pushes
        # (after an edit resets sync_status) always use Alter with the same GUID.
        update_fields = ['sync_status', 'is_synced']
        if is_success and not order.tally_guid:
            guid_m = re.search(r'REMOTEID="([^"]+)"', xml_data)
            if guid_m:
                order.tally_guid = guid_m.group(1)
                update_fields.append('tally_guid')
        order.save(update_fields=update_fields)

        SalesOrderSyncLog.objects.create(
            sales_order=order,
            tally_response=response.text,
            error_message=None if is_success else message,
            status='success' if is_success else 'failed',
            synced_by=user,
            push_type=push_type
        )

        return {
            'success': is_success,
            'order_id': order.id,
            'so_no': order.so_no,
            'status': 'synced' if is_success else 'failed',
            'message': message,
            'tally_response': response.text
        }

    except (requests.exceptions.Timeout, requests.exceptions.ReadTimeout):
        err_msg = (
            "Tally server timed out (15s). Tally Prime may currently be waiting on an open voucher screen, "
            "dialog, or prompt. Please return to the 'Gateway of Tally' in Tally Prime and retry."
        )
        order.sync_status = 'failed'
        order.is_synced = False
        order.save(update_fields=['sync_status', 'is_synced'])
        SalesOrderSyncLog.objects.create(
            sales_order=order,
            error_message=err_msg,
            status='failed',
            synced_by=user,
            push_type=push_type
        )
        return {
            'success': False,
            'order_id': order.id,
            'so_no': order.so_no,
            'status': 'failed',
            'message': err_msg
        }
    except requests.exceptions.ConnectionError:
        err_msg = (
            f"Could not connect to Tally server at {tally_url}. "
            "If your ERP is hosted on the cloud, please ensure the Tally Sync Agent (Start_Tally_Agent.bat) is running on your PC."
        )
        order.sync_status = 'failed'
        order.is_synced = False
        order.save(update_fields=['sync_status', 'is_synced'])
        SalesOrderSyncLog.objects.create(
            sales_order=order,
            error_message=err_msg,
            status='failed',
            synced_by=user,
            push_type=push_type
        )
        return {
            'success': False,
            'order_id': order.id,
            'so_no': order.so_no,
            'status': 'failed',
            'message': err_msg
        }
    except Exception as e:
        err_msg = f"Error pushing order to Tally: {str(e)}"
        order.sync_status = 'failed'
        order.is_synced = False
        order.save(update_fields=['sync_status', 'is_synced'])
        SalesOrderSyncLog.objects.create(
            sales_order=order,
            error_message=err_msg,
            status='failed',
            synced_by=user,
            push_type=push_type
        )
        return {
            'success': False,
            'order_id': order.id,
            'so_no': order.so_no,
            'status': 'failed',
            'message': err_msg
        }


def push_pending_sales_orders(order_ids=None, tally_url=None, from_date=None, to_date=None, user=None, push_type='manual'):
    """
    Pushes pending or selected sales orders to Tally.
    Optionally filters by date range (from_date, to_date).
    """
    config = get_tally_config('Sales Order')
    url = tally_url or config.tally_url or 'http://localhost:9000'

    if order_ids:
        orders = SalesOrder.objects.filter(id__in=order_ids)
    else:
        # Push un-synced orders (pending or failed)
        orders = SalesOrder.objects.filter(is_synced=False).order_by('created_at')
        if from_date:
            orders = orders.filter(entry_date__gte=from_date)
        if to_date:
            orders = orders.filter(entry_date__lte=to_date)

    order_list = list(orders)
    total_count = len(order_list)

    results = []
    synced_count = 0
    failed_count = 0

    for order in order_list:
        res = push_sales_order_to_tally(order, tally_url=url, user=user, push_type=push_type)
        results.append(res)
        if res.get('success'):
            synced_count += 1
        else:
            failed_count += 1

    # Update config last_sync_at
    config.last_sync_at = timezone.now()
    config.save(update_fields=['last_sync_at'])

    return {
        'total': total_count,
        'synced_count': synced_count,
        'failed_count': failed_count,
        'results': results
    }


def push_sales_invoice_to_tally(invoice, tally_url=None, user=None, push_type='manual'):
    """
    Pushes a single SalesInvoice to Tally server and logs the result.
    If the client-side Tally Agent is connected, queues the invoice for the agent.
    """
    from django.utils import timezone
    config = get_tally_config('Sales Invoice')
    agent_connected = bool(
        config and getattr(config, 'agent_last_seen', None) and
        (timezone.now() - config.agent_last_seen).total_seconds() < 90
    )
    if agent_connected:
        invoice.sync_status = 'queued'
        invoice.is_synced = False
        invoice.save(update_fields=['sync_status', 'is_synced'])
        SalesInvoiceSyncLog.objects.create(
            sales_invoice=invoice,
            status='failed',
            error_message='Queued for Tally Agent push',
            synced_by=user,
            push_type=push_type
        )
        return {
            'success': True,
            'invoice_id': invoice.id,
            'invoice_no': invoice.invoice_no,
            'status': 'queued',
            'queued': True,
            'message': f"Sales invoice {invoice.invoice_no} queued for Tally Agent. It will be pushed in a few seconds.",
        }

    if not tally_url:
        tally_url = config.tally_url or 'http://localhost:9000'

    try:
        xml_data = generate_sales_invoice_xml(invoice, tally_url=tally_url)
        response = requests.post(
            tally_url,
            data=xml_data.encode('utf-8'),
            headers={'Content-Type': 'text/xml'},
            timeout=15
        )

        is_success, message = parse_tally_response(response.text, invoice=invoice, tally_url=tally_url)

        # Auto-retry with Alter when Tally returns EXCEPTIONS (duplicate voucher number).
        # Handles both: tally_guid=NULL (Create sent but voucher exists) and
        # tally_guid=phantom (stored before a push was confirmed, Tally never accepted it).
        # Fix: clear GUID so legacy path re-queries Tally live and picks the right action.
        # Auto-retry with Alter when Tally returns EXCEPTIONS (duplicate voucher number).
        # Handles both: tally_guid=NULL (Create sent but voucher exists) and
        # tally_guid=phantom (stored before a push was confirmed, or mismatched with Tally).
        # Fix: Query Tally live to discover the actual REMOTEID of the existing voucher in Tally,
        # update invoice.tally_guid, and retry with ACTION="Alter" and the true REMOTEID.
        if not is_success and 'EXCEPTIONS' in response.text:
            prior_guid = invoice.tally_guid
            logger.warning(
                f"[Tally Retry] EXCEPTIONS on first attempt for invoice {invoice.invoice_no}. "
                f"Querying Tally live for existing voucher REMOTEID..."
            )
            vch_info = get_tally_existing_voucher_info(invoice.invoice_no, tally_url=tally_url)
            if vch_info.get('exists') and vch_info.get('remote_id'):
                logger.info(f"[Tally Retry] Found existing REMOTEID in Tally: {vch_info['remote_id']}")
                invoice.tally_guid = vch_info['remote_id']
                invoice.save(update_fields=['tally_guid'])
            else:
                logger.warning("[Tally Retry] Could not discover existing REMOTEID from Tally, attempting force_alter.")

            xml_data = generate_sales_invoice_xml(invoice, tally_url=tally_url, force_alter=True)
            response = requests.post(
                tally_url,
                data=xml_data.encode('utf-8'),
                headers={'Content-Type': 'text/xml'},
                timeout=15
            )
            is_success, message = parse_tally_response(response.text, invoice=invoice, tally_url=tally_url)
            if not is_success and prior_guid and not invoice.tally_guid:
                invoice.tally_guid = prior_guid
                invoice.save(update_fields=['tally_guid'])

        invoice.sync_status = 'synced' if is_success else 'failed'
        invoice.is_synced = is_success

        # Persist the GUID on the first successful Create push so future pushes
        # (after an edit resets sync_status) always use Alter with the same GUID.
        update_fields = ['sync_status', 'is_synced']
        if is_success and not invoice.tally_guid:
            guid_m = re.search(r'REMOTEID="([^"]+)"', xml_data)
            if guid_m:
                invoice.tally_guid = guid_m.group(1)
                update_fields.append('tally_guid')
        invoice.save(update_fields=update_fields)

        SalesInvoiceSyncLog.objects.create(
            sales_invoice=invoice,
            tally_response=response.text,
            error_message=None if is_success else message,
            status='success' if is_success else 'failed',
            synced_by=user,
            push_type=push_type
        )

        return {
            'success': is_success,
            'invoice_id': invoice.id,
            'invoice_no': invoice.invoice_no,
            'status': 'synced' if is_success else 'failed',
            'message': message,
            'tally_response': response.text
        }

    except (requests.exceptions.Timeout, requests.exceptions.ReadTimeout):
        err_msg = (
            "Tally server timed out (15s). Tally Prime may currently be waiting on an open voucher screen, "
            "dialog, or prompt. Please return to the 'Gateway of Tally' in Tally Prime and retry."
        )
        invoice.sync_status = 'failed'
        invoice.is_synced = False
        invoice.save(update_fields=['sync_status', 'is_synced'])
        SalesInvoiceSyncLog.objects.create(
            sales_invoice=invoice,
            error_message=err_msg,
            status='failed',
            synced_by=user,
            push_type=push_type
        )
        return {
            'success': False,
            'invoice_id': invoice.id,
            'invoice_no': invoice.invoice_no,
            'status': 'failed',
            'message': err_msg
        }
    except requests.exceptions.ConnectionError:
        err_msg = (
            f"Could not connect to Tally server at {tally_url}. "
            "If your ERP is hosted on the cloud, please ensure the Tally Sync Agent (Start_Tally_Agent.bat) is running on your PC."
        )
        invoice.sync_status = 'failed'
        invoice.is_synced = False
        invoice.save(update_fields=['sync_status', 'is_synced'])
        SalesInvoiceSyncLog.objects.create(
            sales_invoice=invoice,
            error_message=err_msg,
            status='failed',
            synced_by=user,
            push_type=push_type
        )
        return {
            'success': False,
            'invoice_id': invoice.id,
            'invoice_no': invoice.invoice_no,
            'status': 'failed',
            'message': err_msg
        }
    except Exception as e:
        err_msg = f"Error pushing invoice to Tally: {str(e)}"
        invoice.sync_status = 'failed'
        invoice.is_synced = False
        invoice.save(update_fields=['sync_status', 'is_synced'])
        SalesInvoiceSyncLog.objects.create(
            sales_invoice=invoice,
            error_message=err_msg,
            status='failed',
            synced_by=user,
            push_type=push_type
        )
        return {
            'success': False,
            'invoice_id': invoice.id,
            'invoice_no': invoice.invoice_no,
            'status': 'failed',
            'message': err_msg
        }


def push_pending_sales_invoices(invoice_ids=None, tally_url=None, from_date=None, to_date=None, user=None, push_type='manual'):
    """
    Pushes pending or selected sales invoices to Tally.
    Optionally filters by date range (from_date, to_date).
    """
    config = get_tally_config('Sales Invoice')
    url = tally_url or config.tally_url or 'http://localhost:9000'

    if invoice_ids:
        invoices = SalesInvoice.objects.filter(id__in=invoice_ids)
    else:
        # Push un-synced invoices (pending or failed)
        invoices = SalesInvoice.objects.filter(is_synced=False).order_by('created_at')
        if from_date:
            invoices = invoices.filter(entry_date__gte=from_date)
        if to_date:
            invoices = invoices.filter(entry_date__lte=to_date)

    inv_list = list(invoices)
    total_count = len(inv_list)

    results = []
    synced_count = 0
    failed_count = 0

    for inv in inv_list:
        res = push_sales_invoice_to_tally(inv, tally_url=url, user=user, push_type=push_type)
        results.append(res)
        if res.get('success'):
            synced_count += 1
        else:
            failed_count += 1

    # Update config last_sync_at
    config.last_sync_at = timezone.now()
    config.save(update_fields=['last_sync_at'])

    return {
        'total': total_count,
        'synced_count': synced_count,
        'failed_count': failed_count,
        'results': results
    }


def push_sales_return_to_tally(sales_return, tally_url=None, user=None, push_type='manual'):
    """
    Pushes a single SalesReturn to Tally server and logs the result.
    If the client-side Tally Agent is connected, queues the return for the agent.
    """
    from django.utils import timezone
    config = get_tally_config('Sales Return')
    agent_connected = bool(
        config and getattr(config, 'agent_last_seen', None) and
        (timezone.now() - config.agent_last_seen).total_seconds() < 90
    )
    if agent_connected:
        sales_return.sync_status = 'queued'
        sales_return.is_synced = False
        sales_return.save(update_fields=['sync_status', 'is_synced'])
        SalesReturnSyncLog.objects.create(
            sales_return=sales_return,
            status='failed',
            error_message='Queued for Tally Agent push',
            synced_by=user,
            push_type=push_type
        )
        return {
            'success': True,
            'return_id': sales_return.id,
            'return_no': sales_return.return_no,
            'status': 'queued',
            'queued': True,
            'message': f"Sales return {sales_return.return_no} queued for Tally Agent. It will be pushed in a few seconds.",
        }

    if not tally_url:
        tally_url = config.tally_url or 'http://localhost:9000'

    try:
        xml_data = generate_sales_return_xml(sales_return, tally_url=tally_url)
        response = requests.post(
            tally_url,
            data=xml_data.encode('utf-8'),
            headers={'Content-Type': 'text/xml'},
            timeout=15
        )

        is_success, message = parse_tally_response(response.text, return_obj=sales_return, tally_url=tally_url)

        # Auto-retry with Alter when Tally returns EXCEPTIONS (duplicate voucher number).
        # Handles both: tally_guid=NULL and tally_guid=phantom.
        # Auto-retry with Alter when Tally returns EXCEPTIONS (duplicate voucher number).
        # Handles both: tally_guid=NULL and tally_guid=phantom.
        # Fix: Query Tally live to discover the actual REMOTEID of the existing voucher in Tally,
        # update sales_return.tally_guid, and retry with ACTION="Alter" and the true REMOTEID.
        if not is_success and 'EXCEPTIONS' in response.text:
            prior_guid = sales_return.tally_guid
            logger.warning(
                f"[Tally Retry] EXCEPTIONS on first attempt for return {sales_return.return_no}. "
                f"Querying Tally live for existing voucher REMOTEID..."
            )
            vch_info = get_tally_existing_voucher_info(sales_return.return_no, voucher_type_name="Credit Note", tally_url=tally_url)
            if vch_info.get('exists') and vch_info.get('remote_id'):
                logger.info(f"[Tally Retry] Found existing REMOTEID in Tally: {vch_info['remote_id']}")
                sales_return.tally_guid = vch_info['remote_id']
                sales_return.save(update_fields=['tally_guid'])
            else:
                logger.warning("[Tally Retry] Could not discover existing REMOTEID from Tally, attempting force_alter.")

            xml_data = generate_sales_return_xml(sales_return, tally_url=tally_url, force_alter=True)
            response = requests.post(
                tally_url,
                data=xml_data.encode('utf-8'),
                headers={'Content-Type': 'text/xml'},
                timeout=15
            )
            is_success, message = parse_tally_response(response.text, return_obj=sales_return, tally_url=tally_url)
            if not is_success and prior_guid and not sales_return.tally_guid:
                sales_return.tally_guid = prior_guid
                sales_return.save(update_fields=['tally_guid'])

        sales_return.sync_status = 'synced' if is_success else 'failed'
        sales_return.is_synced = is_success

        # Persist the GUID on the first successful Create push so future pushes
        # (after an edit resets sync_status) always use Alter with the same GUID.
        update_fields = ['sync_status', 'is_synced']
        if is_success and not sales_return.tally_guid:
            guid_m = re.search(r'REMOTEID="([^"]+)"', xml_data)
            if guid_m:
                sales_return.tally_guid = guid_m.group(1)
                update_fields.append('tally_guid')
        sales_return.save(update_fields=update_fields)

        SalesReturnSyncLog.objects.create(
            sales_return=sales_return,
            tally_response=response.text,
            error_message=None if is_success else message,
            status='success' if is_success else 'failed',
            synced_by=user,
            push_type=push_type
        )

        return {
            'success': is_success,
            'return_id': sales_return.id,
            'return_no': sales_return.return_no,
            'status': 'synced' if is_success else 'failed',
            'message': message,
            'tally_response': response.text
        }

    except (requests.exceptions.Timeout, requests.exceptions.ReadTimeout):
        err_msg = (
            "Tally server timed out (15s). Tally Prime may currently be waiting on an open voucher screen, "
            "dialog, or prompt. Please return to the 'Gateway of Tally' in Tally Prime and retry."
        )
        sales_return.sync_status = 'failed'
        sales_return.is_synced = False
        sales_return.save(update_fields=['sync_status', 'is_synced'])
        SalesReturnSyncLog.objects.create(
            sales_return=sales_return,
            error_message=err_msg,
            status='failed',
            synced_by=user,
            push_type=push_type
        )
        return {
            'success': False,
            'return_id': sales_return.id,
            'return_no': sales_return.return_no,
            'status': 'failed',
            'message': err_msg
        }
    except requests.exceptions.ConnectionError:
        err_msg = (
            f"Could not connect to Tally server at {tally_url}. "
            "If your ERP is hosted on the cloud, please ensure the Tally Sync Agent (Start_Tally_Agent.bat) is running on your PC."
        )
        sales_return.sync_status = 'failed'
        sales_return.is_synced = False
        sales_return.save(update_fields=['sync_status', 'is_synced'])
        SalesReturnSyncLog.objects.create(
            sales_return=sales_return,
            error_message=err_msg,
            status='failed',
            synced_by=user,
            push_type=push_type
        )
        return {
            'success': False,
            'return_id': sales_return.id,
            'return_no': sales_return.return_no,
            'status': 'failed',
            'message': err_msg
        }
    except Exception as e:
        err_msg = f"Error pushing sales return to Tally: {str(e)}"
        sales_return.sync_status = 'failed'
        sales_return.is_synced = False
        sales_return.save(update_fields=['sync_status', 'is_synced'])
        SalesReturnSyncLog.objects.create(
            sales_return=sales_return,
            error_message=err_msg,
            status='failed',
            synced_by=user,
            push_type=push_type
        )
        return {
            'success': False,
            'return_id': sales_return.id,
            'return_no': sales_return.return_no,
            'status': 'failed',
            'message': err_msg
        }


def push_pending_sales_returns(return_ids=None, tally_url=None, from_date=None, to_date=None, user=None, push_type='manual'):
    """
    Pushes pending or selected sales returns to Tally.
    Optionally filters by date range (from_date, to_date).
    """
    config = get_tally_config('Sales Return')
    url = tally_url or config.tally_url or 'http://localhost:9000'

    if return_ids:
        returns = SalesReturn.objects.filter(id__in=return_ids)
    else:
        # Push un-synced returns (pending or failed)
        returns = SalesReturn.objects.filter(is_synced=False).order_by('created_at')
        if from_date:
            returns = returns.filter(entry_date__gte=from_date)
        if to_date:
            returns = returns.filter(entry_date__lte=to_date)

    ret_list = list(returns)
    total_count = len(ret_list)

    results = []
    synced_count = 0
    failed_count = 0

    for sr in ret_list:
        res = push_sales_return_to_tally(sr, tally_url=url, user=user, push_type=push_type)
        results.append(res)
        if res.get('success'):
            synced_count += 1
        else:
            failed_count += 1

    # Update config last_sync_at
    config.last_sync_at = timezone.now()
    config.save(update_fields=['last_sync_at'])

    return {
        'total': total_count,
        'synced_count': synced_count,
        'failed_count': failed_count,
        'results': results
    }


def test_tally_connection(tally_url=None):
    """
    Tests if Tally HTTP/ODBC endpoint is reachable and responsive.
    Performs a TCP socket check first, then tests XML communication.
    """
    import socket
    from urllib.parse import urlparse

    if not tally_url:
        config = get_tally_config('Sales Order')
        tally_url = config.tally_url or 'http://localhost:9000'

    parsed = urlparse(tally_url)
    host = parsed.hostname or '127.0.0.1'
    port = parsed.port or 9000
    connect_host = '127.0.0.1' if host in ('localhost', '127.0.0.1') else host

    # 1. Socket Ping Check
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(2.5)
    try:
        s.connect((connect_host, port))
        s.close()
    except Exception:
        return {
            'connected': False,
            'is_idle': False,
            'message': f"Could not reach Tally on {host}:{port}. Please ensure Tally is open and port {port} is enabled in F12 / Advanced Configuration.",
            'error': 'ConnectionRefused'
        }

    # 2. HTTP / XML Request Test
    test_xml = (
        "<ENVELOPE>"
        "<HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>"
        "<BODY><EXPORTDATA><REQUESTDESC>"
        "<REPORTNAME>List of Companies</REPORTNAME>"
        "<STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>"
        "</REQUESTDESC></EXPORTDATA></BODY>"
        "</ENVELOPE>"
    )

    request_url = tally_url.replace('localhost', '127.0.0.1')
    try:
        response = requests.post(
            request_url,
            data=test_xml.encode('utf-8'),
            headers={'Content-Type': 'text/xml'},
            timeout=4
        )
        if response.status_code == 200:
            return {
                'connected': True,
                'is_idle': False,
                'message': f"Connected successfully to Tally at {tally_url}!",
                'status_code': response.status_code
            }
        else:
            return {
                'connected': False,
                'is_idle': False,
                'message': f"Tally responded with HTTP status {response.status_code}.",
                'status_code': response.status_code
            }
    except (requests.exceptions.Timeout, requests.exceptions.ReadTimeout):
        return {
            'connected': True,
            'is_idle': True,
            'message': (
                f"Tally server is running on port {port}, but is waiting on a screen or no company is opened. "
                "Please open your company in Tally (so the Gateway of Tally is visible) and close any prompt."
            )
        }
    except requests.exceptions.ConnectionError:
        return {
            'connected': False,
            'is_idle': False,
            'message': f"Could not connect to Tally server at {tally_url}.",
            'error': 'ConnectionError'
        }
    except Exception as e:
        return {
            'connected': False,
            'is_idle': False,
            'message': f"Connection test error: {str(e)}",
            'error': str(e)
        }

