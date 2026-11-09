import logging
from django.db import transaction
from django.db.models import Q
from rest_framework import views, status, viewsets
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

logger = logging.getLogger(__name__)

from finance_app.models import VoucherType, StockJournalType, ManufacturalJournalType
from django.shortcuts import render
from register_app.permissions import module_permission
from finance_app.models import AccountGroup, Ledger, StockJournal,Quotation,ManufacturalJournal
from finance_app.serializers import (
    AccountGroupSerializer,
    LedgerSerializer,
    VoucherTypeSerializer,
    StockJournalTypeSerializer,
    StockJournalSerializer,
    PrefixConfigurationForJournalSerializer,
    QuotationSerializer,
    ManufacturalJournalTypeSerializer,
    ManufacturalJournalSerializer,)
from datetime import datetime, date as date_type

def parse_date_obj(v):
    if not v:
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date_type):
        return v
    if isinstance(v, str):
        try:
            return datetime.strptime(v[:10], '%Y-%m-%d').date()
        except Exception:
            return None
    return None


def get_company_name_and_address():
    company_name = "Glenda Aqua"
    company_address = ""
    try:
        from settings_app.models import Company, CompanyAddress
        comp = Company.objects.filter(is_active=True).first()
        if not comp:
            comp = Company.objects.first()
        if comp:
            company_name = comp.display_name or comp.name or company_name
            addr = CompanyAddress.objects.filter(company=comp, is_default=True).first()
            if not addr:
                addr = CompanyAddress.objects.filter(company=comp).first()
            
            if not addr:
                addr = CompanyAddress.objects.create(
                    company=comp,
                    address_type='registered',
                    address_line_1='Plot No. 45, Industrial Area',
                    address_line_2='Kattedan',
                    city='Hyderabad',
                    state='Telangana',
                    country='IN',
                    pincode='500077',
                    is_default=True
                )

            if addr:
                parts = [addr.address_line_1, addr.address_line_2, addr.city, addr.state, addr.country, addr.pincode]
                formatted_addr = ", ".join([str(p).strip() for p in parts if p and str(p).strip()])
                if formatted_addr:
                    company_address = formatted_addr
    except Exception:
        pass
    
    return company_name, company_address



STANDARD_ACCOUNT_GROUPS = [
    # Primary Main Heads
    {'name': 'Capital Account', 'parent': None, 'nature': 'Liability', 'sort_order': 10, 'is_main_head': True},
    {'name': 'Loans (Liability)', 'parent': None, 'nature': 'Liability', 'sort_order': 20, 'is_main_head': True},
    {'name': 'Current Liabilities', 'parent': None, 'nature': 'Liability', 'sort_order': 30, 'is_main_head': True},
    {'name': 'Fixed Assets', 'parent': None, 'nature': 'Asset', 'sort_order': 40, 'is_main_head': True},
    {'name': 'Investments', 'parent': None, 'nature': 'Asset', 'sort_order': 50, 'is_main_head': True},
    {'name': 'Current Assets', 'parent': None, 'nature': 'Asset', 'sort_order': 60, 'is_main_head': True},
    {'name': 'Branch / Divisions', 'parent': None, 'nature': 'Asset', 'sort_order': 70, 'is_main_head': True},
    {'name': 'Misc. Expenses (Asset)', 'parent': None, 'nature': 'Asset', 'sort_order': 80, 'is_main_head': True},
    {'name': 'Suspense A/c', 'parent': None, 'nature': 'Liability', 'sort_order': 90, 'is_main_head': True},
    {'name': 'Sales Accounts', 'parent': None, 'nature': 'Income', 'sort_order': 100, 'is_main_head': True},
    {'name': 'Direct Incomes', 'parent': None, 'nature': 'Income', 'sort_order': 110, 'is_main_head': True},
    {'name': 'Indirect Incomes', 'parent': None, 'nature': 'Income', 'sort_order': 120, 'is_main_head': True},
    {'name': 'Purchase Accounts', 'parent': None, 'nature': 'Expense', 'sort_order': 130, 'is_main_head': True},
    {'name': 'Direct Expenses', 'parent': None, 'nature': 'Expense', 'sort_order': 140, 'is_main_head': True},
    {'name': 'Indirect Expenses', 'parent': None, 'nature': 'Expense', 'sort_order': 150, 'is_main_head': True},

    # Subgroups
    {'name': 'Reserves & Surplus', 'parent': 'Capital Account', 'nature': 'Liability', 'sort_order': 11, 'is_main_head': False},
    {'name': 'Bank OD A/c', 'parent': 'Loans (Liability)', 'nature': 'Liability', 'sort_order': 21, 'is_main_head': False},
    {'name': 'Secured Loans', 'parent': 'Loans (Liability)', 'nature': 'Liability', 'sort_order': 22, 'is_main_head': False},
    {'name': 'Unsecured Loans', 'parent': 'Loans (Liability)', 'nature': 'Liability', 'sort_order': 23, 'is_main_head': False},
    {'name': 'Duties & Taxes', 'parent': 'Current Liabilities', 'nature': 'Liability', 'sort_order': 31, 'is_main_head': False},
    {'name': 'Provisions', 'parent': 'Current Liabilities', 'nature': 'Liability', 'sort_order': 32, 'is_main_head': False},
    {'name': 'Sundry Creditors', 'parent': 'Current Liabilities', 'nature': 'Liability', 'sort_order': 33, 'is_main_head': False},
    {'name': 'Stock-in-hand', 'parent': 'Current Assets', 'nature': 'Asset', 'sort_order': 61, 'is_main_head': False},
    {'name': 'Deposits (Asset)', 'parent': 'Current Assets', 'nature': 'Asset', 'sort_order': 62, 'is_main_head': False},
    {'name': 'Loans & Advances (Asset)', 'parent': 'Current Assets', 'nature': 'Asset', 'sort_order': 63, 'is_main_head': False},
    {'name': 'Sundry Debtors', 'parent': 'Current Assets', 'nature': 'Asset', 'sort_order': 64, 'is_main_head': False},
    {'name': 'Cash-in-hand', 'parent': 'Current Assets', 'nature': 'Asset', 'sort_order': 65, 'is_main_head': False},
    {'name': 'Bank Accounts', 'parent': 'Current Assets', 'nature': 'Asset', 'sort_order': 66, 'is_main_head': False},
    {'name': 'Payroll Expenses', 'parent': 'Indirect Expenses', 'nature': 'Expense', 'sort_order': 151, 'is_main_head': False},
    {'name': 'Administrative Expenses', 'parent': 'Indirect Expenses', 'nature': 'Expense', 'sort_order': 152, 'is_main_head': False},
    {'name': 'Selling & Distribution Expenses', 'parent': 'Indirect Expenses', 'nature': 'Expense', 'sort_order': 153, 'is_main_head': False},
    {'name': 'Financial Expenses', 'parent': 'Indirect Expenses', 'nature': 'Expense', 'sort_order': 154, 'is_main_head': False},
    {'name': 'Depreciation & Amortisation', 'parent': 'Indirect Expenses', 'nature': 'Expense', 'sort_order': 155, 'is_main_head': False},
    {'name': 'Operating Incomes', 'parent': 'Direct Incomes', 'nature': 'Income', 'sort_order': 111, 'is_main_head': False},
]



def ensure_share_capital_ledgers():
    try:
        from finance_app.models import JournalVoucher
        # Clean up any temporary test journal voucher if present
        jv = JournalVoucher.objects.filter(voucher_no='JV-SHARE-CAPITAL-001').first()
        if jv:
            jv.delete()
    except Exception:
        pass

    try:
        cap_group = AccountGroup.objects.filter(name='Capital Account').first()
        if not cap_group:
            cap_group, _ = AccountGroup.objects.get_or_create(
                name='Capital Account',
                defaults={'nature': 'Liability', 'sort_order': 10, 'is_main_head': True}
            )
        elif cap_group.nature != 'Liability':
            cap_group.nature = 'Liability'
            cap_group.save()

        share_cap_group = AccountGroup.objects.filter(name='Share Capital A/c').first()
        if not share_cap_group:
            share_cap_group, _ = AccountGroup.objects.get_or_create(
                name='Share Capital A/c',
                defaults={'parent': cap_group, 'nature': 'Liability', 'sort_order': 12, 'is_main_head': False}
            )
        elif share_cap_group.nature != 'Liability':
            share_cap_group.nature = 'Liability'
            share_cap_group.save()

        reserves_group = AccountGroup.objects.filter(name='Reserves & Surplus').first()
        if not reserves_group:
            reserves_group, _ = AccountGroup.objects.get_or_create(
                name='Reserves & Surplus',
                defaults={'parent': cap_group, 'nature': 'Liability', 'sort_order': 11, 'is_main_head': False}
            )
        elif reserves_group.nature != 'Liability':
            reserves_group.nature = 'Liability'
            reserves_group.save()
    except Exception:
        pass

def ensure_default_account_groups():
    existing_map = {g.name: g for g in AccountGroup.objects.all()}

    for item in STANDARD_ACCOUNT_GROUPS:
        group = existing_map.get(item['name'])
        parent_obj = None
        if item['parent']:
            parent_obj = existing_map.get(item['parent']) or AccountGroup.objects.filter(name=item['parent']).first()

        if not group:
            group, _ = AccountGroup.objects.get_or_create(
                name=item['name'],
                defaults={
                    'parent': parent_obj,
                    'nature': item['nature'],
                    'sort_order': item['sort_order'],
                    'is_main_head': item['is_main_head'],
                }
            )
            existing_map[item['name']] = group
        else:
            updated = False
            if group.nature != item['nature']:
                group.nature = item['nature']
                updated = True
            if parent_obj and group.parent_id != parent_obj.id:
                group.parent = parent_obj
                updated = True
            if updated:
                group.save()

    ensure_share_capital_ledgers()

class AccountGroupViewSet(viewsets.ModelViewSet):
    queryset = AccountGroup.objects.all().order_by('sort_order', 'name')
    serializer_class = AccountGroupSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        try:
            ensure_default_account_groups()
        except Exception:
            pass
        return super().get_queryset()

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(created_by=user)

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(edited_by=user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        standard_names = {item['name'] for item in STANDARD_ACCOUNT_GROUPS}

        if instance.name in standard_names:
            return Response(
                {"detail": f"Standard Account Group '{instance.name}' is system-protected and cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if instance.ledgers.exists() or instance.subgroups.exists():
            return Response(
                {"detail": f"Account Group '{instance.name}' has linked ledgers or subgroups and cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST
            )

        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def download_template(self, request):
        import openpyxl
        from django.http import HttpResponse
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Account Groups"
        ws.append([
            "Name*", "Parent Group", "Nature*", "Sort Order", "Is Main Head"
        ])
        
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename="AccountGroup_Template.xlsx"'
        wb.save(response)
        return response

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def import_excel(self, request):
        import openpyxl
        file = request.FILES.get('file')
        if not file:
            return Response({"detail": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            wb = openpyxl.load_workbook(file)
            if "Account Groups" not in wb.sheetnames:
                ws = wb.active
            else:
                ws = wb["Account Groups"]

            rows = list(ws.rows)
            if not rows:
                return Response({"detail": "The Excel sheet is empty."}, status=status.HTTP_400_BAD_REQUEST)

            headers = [str(cell.value).replace('*', '').strip() if cell.value else "" for cell in rows[0]]
            
            def get_idx(name):
                return headers.index(name) if name in headers else -1

            name_idx = get_idx("Name")
            parent_idx = get_idx("Parent Group")
            nature_idx = get_idx("Nature")
            sort_idx = get_idx("Sort Order")
            main_idx = get_idx("Is Main Head")

            if name_idx == -1 or nature_idx == -1:
                return Response({"detail": "Columns 'Name' and 'Nature' are mandatory."}, status=status.HTTP_400_BAD_REQUEST)

            added = 0
            updated = 0
            errors = []

            # Valid nature choices
            valid_natures = dict(AccountGroup.NATURE_CHOICES)
            # Create lowercase mapping for lenient matching
            nature_map = {k.lower(): k for k in valid_natures.keys()}

            for row_idx, row in enumerate(rows[1:], start=2):
                if not any(cell.value for cell in row):
                    continue
                
                name_val = row[name_idx].value
                if not name_val:
                    errors.append(f"Row {row_idx}: 'Name' is required.")
                    continue
                name_val = str(name_val).strip()

                nature_val = row[nature_idx].value
                if not nature_val:
                    errors.append(f"Row {row_idx}: 'Nature' is required.")
                    continue
                nature_val = str(nature_val).strip()
                nature_lower = nature_val.lower()
                
                if nature_lower not in nature_map:
                    errors.append(f"Row {row_idx}: 'Nature' must be one of {', '.join(valid_natures.keys())}.")
                    continue
                
                actual_nature = nature_map[nature_lower]

                parent_name = row[parent_idx].value if parent_idx != -1 else None
                parent_obj = None
                if parent_name:
                    parent_name = str(parent_name).strip()
                    parent_obj = AccountGroup.objects.filter(name__iexact=parent_name).first()
                    if not parent_obj:
                        parent_obj = AccountGroup.objects.create(name=parent_name, nature='Asset')

                sort_val = row[sort_idx].value if sort_idx != -1 else 0
                try:
                    sort_val = int(sort_val) if sort_val is not None else 0
                except ValueError:
                    sort_val = 0

                main_val = row[main_idx].value if main_idx != -1 else False
                if main_val is None:
                    main_val = False
                elif isinstance(main_val, str):
                    main_val = main_val.strip().lower() in ['yes', 'true', '1', 'y']
                else:
                    main_val = bool(main_val)

                kwargs = {
                    'name': name_val,
                    'parent': parent_obj,
                    'nature': actual_nature,
                    'sort_order': sort_val,
                    'is_main_head': main_val,
                }

                group = AccountGroup.objects.filter(name__iexact=name_val).first()
                if group:
                    for k, v in kwargs.items():
                        setattr(group, k, v)
                    group.edited_by = request.user
                    group.save()
                    updated += 1
                else:
                    kwargs['created_by'] = request.user
                    AccountGroup.objects.create(**kwargs)
                    added += 1

            if errors:
                return Response({
                    "detail": "Import completed with errors.", 
                    "added": added, 
                    "updated": updated, 
                    "errors": errors
                }, status=status.HTTP_207_MULTI_STATUS)
                
            return Response({"detail": "Import successful.", "added": added, "updated": updated}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"detail": f"Error parsing Excel file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)



class LedgerViewSet(viewsets.ModelViewSet):
    queryset = Ledger.objects.all().order_by('name')
    serializer_class = LedgerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        group_name = self.request.query_params.get('group_name')
        if group_name:
            queryset = queryset.filter(accountGroup__name__iexact=group_name)
        return queryset

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(created_by=user)

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(edited_by=user)

    @action(detail=False, methods=['get'])
    def download_template(self, request):
        import openpyxl
        from django.http import HttpResponse
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Ledgers"
        headers = [
            "Name*", "Account Group*", "Maintain Billwise Details", "Opening Balance", "Opening Balance Type",
            "Credit Limit", "Registration Type", "GST Number", "PAN Number", "Phone", "Email",
            "Address", "Mailing Name", "Address Line 1", "Address Line 2", "Address Line 3",
            "Place of Supply", "State", "Country", "Pincode",
            "Bank Name", "Bank Account No", "Bank Branch", "Bank IFSC Code",
            "Contact Name", "Contact Phone No",
            "GST Applicable Date", "GST Percentage", "HSN Code"
        ]
        ws.append(headers)
        
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename="Ledger_Template.xlsx"'
        wb.save(response)
        return response

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def import_excel(self, request):
        import openpyxl
        import dateutil.parser
        import datetime
        file = request.FILES.get('file')
        if not file:
            return Response({"detail": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            wb = openpyxl.load_workbook(file)
            if "Ledgers" not in wb.sheetnames:
                ws = wb.active
            else:
                ws = wb["Ledgers"]

            rows = list(ws.rows)
            if not rows:
                return Response({"detail": "The Excel sheet is empty."}, status=status.HTTP_400_BAD_REQUEST)

            headers = [str(cell.value).replace('*', '').strip() if cell.value else "" for cell in rows[0]]
            
            def get_idx(name):
                return headers.index(name) if name in headers else -1

            name_idx = get_idx("Name")
            group_idx = get_idx("Account Group")

            if name_idx == -1 or group_idx == -1:
                return Response({"detail": "Columns 'Name' and 'Account Group' are mandatory."}, status=status.HTTP_400_BAD_REQUEST)

            added = 0
            updated = 0
            errors = []

            for row_idx, row in enumerate(rows[1:], start=2):
                if not any(cell.value for cell in row):
                    continue
                
                name_val = row[name_idx].value
                if not name_val:
                    errors.append(f"Row {row_idx}: 'Name' is required.")
                    continue
                name_val = str(name_val).strip()

                group_val = row[group_idx].value
                if not group_val:
                    errors.append(f"Row {row_idx}: 'Account Group' is required.")
                    continue
                group_val = str(group_val).strip()
                
                from finance_app.models import AccountGroup, Ledger, LedgerBankDetail, LedgerContactDetail, LedgerGst
                group_obj = AccountGroup.objects.filter(name__iexact=group_val).first()
                if not group_obj:
                    group_obj = AccountGroup.objects.create(name=group_val, nature='Asset', created_by=request.user)

                def get_val(col_name, default=None):
                    idx = get_idx(col_name)
                    if idx != -1:
                        val = row[idx].value
                        return val if val is not None else default
                    return default

                def get_bool(col_name):
                    val = get_val(col_name)
                    if isinstance(val, str):
                        return val.strip().lower() in ['yes', 'y', 'true', '1']
                    return bool(val)
                
                def get_float(col_name):
                    val = get_val(col_name)
                    try:
                        return float(val) if val is not None else 0.0
                    except ValueError:
                        return 0.0

                kwargs = {
                    'accountGroup': group_obj,
                    'maintain_biilwise_details': get_bool("Maintain Billwise Details"),
                    'opening_balance': get_float("Opening Balance"),
                    'opening_balance_type': str(get_val("Opening Balance Type", "Dr")).strip().capitalize()[:2],
                    'credit_limit': get_float("Credit Limit"),
                    'registration_type': str(get_val("Registration Type", "unknown")).strip().lower(),
                    'gst_number': str(get_val("GST Number", "")).strip(),
                    'pan_number': str(get_val("PAN Number", "")).strip(),
                    'phone': str(get_val("Phone", "")).strip(),
                    'email': str(get_val("Email", "")).strip(),
                    'address': str(get_val("Address", "")).strip(),
                    'mailing_name': str(get_val("Mailing Name", "")).strip(),
                    'address1': str(get_val("Address Line 1", "")).strip(),
                    'address2': str(get_val("Address Line 2", "")).strip(),
                    'address3': str(get_val("Address Line 3", "")).strip(),
                    'placeofsupply': str(get_val("Place of Supply", "")).strip(),
                    'state': str(get_val("State", "")).strip(),
                    'country': str(get_val("Country", "")).strip(),
                    'pincode': str(get_val("Pincode", "")).strip(),
                }
                
                # Cleanup enums
                if kwargs['opening_balance_type'] not in ['Dr', 'Cr']:
                    kwargs['opening_balance_type'] = 'Dr'
                if kwargs['registration_type'] not in ['unknown', 'registered', 'unregistered', 'composition']:
                    kwargs['registration_type'] = 'unknown'

                ledger = Ledger.objects.filter(name__iexact=name_val).first()
                if ledger:
                    for k, v in kwargs.items():
                        setattr(ledger, k, v)
                    ledger.edited_by = request.user
                    ledger.save()
                    updated += 1
                else:
                    kwargs['name'] = name_val
                    kwargs['created_by'] = request.user
                    ledger = Ledger.objects.create(**kwargs)
                    added += 1

                # Handle child tables
                bank_name = get_val("Bank Name")
                bank_acc = get_val("Bank Account No")
                if bank_name or bank_acc:
                    LedgerBankDetail.objects.update_or_create(
                        ledger=ledger,
                        defaults={
                            'bank_name': str(bank_name or "").strip(),
                            'bank_account_no': str(bank_acc or "").strip(),
                            'branch': str(get_val("Bank Branch", "")).strip(),
                            'ifsc_code': str(get_val("Bank IFSC Code", "")).strip(),
                        }
                    )

                contact_name = get_val("Contact Name")
                contact_phone = get_val("Contact Phone No")
                if contact_name or contact_phone:
                    LedgerContactDetail.objects.update_or_create(
                        ledger=ledger,
                        defaults={
                            'contact_name': str(contact_name or "").strip(),
                            'phone_no': str(contact_phone or "").strip(),
                        }
                    )

                gst_date = get_val("GST Applicable Date")
                gst_percent = get_val("GST Percentage")
                hsn_code = get_val("HSN Code")
                if gst_percent is not None or hsn_code or gst_date:
                    if gst_date and isinstance(gst_date, str):
                        try:
                            gst_date = dateutil.parser.parse(gst_date).date()
                        except:
                            gst_date = datetime.date.today()
                    elif not isinstance(gst_date, datetime.date):
                        if hasattr(gst_date, 'date'):
                            gst_date = gst_date.date()
                        else:
                            gst_date = datetime.date.today()
                    
                    try:
                        gst_percent = float(gst_percent) if gst_percent is not None else 0.0
                    except ValueError:
                        gst_percent = 0.0
                        
                    LedgerGst.objects.update_or_create(
                        ledger=ledger,
                        applicable_date=gst_date,
                        defaults={
                            'gst_percentage': gst_percent,
                            'hsn_code': str(hsn_code or "").strip(),
                            'registration_type': kwargs['registration_type'],
                            'gst_number': kwargs['gst_number'],
                            'place_of_supply': kwargs['placeofsupply'],
                        }
                    )

            if errors:
                return Response({
                    "detail": "Import completed with errors.", 
                    "added": added, 
                    "updated": updated, 
                    "errors": errors
                }, status=status.HTTP_207_MULTI_STATUS)
                
            return Response({"detail": "Import successful.", "added": added, "updated": updated}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"detail": f"Error parsing Excel file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='vouchers')
    def vouchers(self, request, pk=None):
        ledger = self.get_object()
        
        op_bal = float(ledger.opening_balance or 0.0)
        op_type = ledger.opening_balance_type or ('Cr' if ledger.accountGroup and ledger.accountGroup.nature in ('Liability', 'Income') else 'Dr')
        
        running_net = op_bal if op_type == 'Dr' else -op_bal
        
        entries = []
        
        from .models import ServiceInvoice, ServiceInvoiceDetail, JournalVoucherDetail, ReceiptVoucherDetail, PaymentVoucherDetail, ContraVoucherDetail, BillAllocation
        from sales_app.models import SalesInvoice, SalesReturn
        from purchase_app.models import PurchaseInvoice, PurchaseReturn
        
        # 1. Sales Invoices for customer_ledger (Debtor)
        for inv in SalesInvoice.objects.filter(customer_ledger=ledger):
            amt = float(inv.total_amount or 0.0)
            sales_ledger_name = inv.sales_ledger.name if inv.sales_ledger else 'Sales'
            entries.append({
                'id': f"sinv_{inv.id}",
                'date': str(inv.entry_date),
                'voucher_type': 'Sales Invoice',
                'voucher_no': inv.invoice_no,
                'particulars': sales_ledger_name,
                'debit': amt,
                'credit': 0.0,
                'narration': inv.narration or f"Sales Invoice {inv.invoice_no}",
            })

        # 1b. Sales Returns for customer_ledger (Debtor)
        for ret in SalesReturn.objects.filter(customer_ledger=ledger):
            amt = float(ret.total_amount or 0.0)
            sales_ledger_name = ret.sales_ledger.name if ret.sales_ledger else 'Sales Return'
            entries.append({
                'id': f"sret_{ret.id}",
                'date': str(ret.entry_date),
                'voucher_type': 'Sales Return',
                'voucher_no': ret.return_no,
                'particulars': sales_ledger_name,
                'debit': 0.0,
                'credit': amt,
                'narration': ret.narration or f"Sales Return {ret.return_no}",
            })

        # 2. Sales Invoices for sales_ledger (Income)
        for inv in SalesInvoice.objects.filter(sales_ledger=ledger):
            amt = float(inv.total_amount or 0.0)
            customer_name = inv.customer_ledger.name if inv.customer_ledger else 'Customer'
            entries.append({
                'id': f"sinvd_{inv.id}",
                'date': str(inv.entry_date),
                'voucher_type': 'Sales Invoice',
                'voucher_no': inv.invoice_no,
                'particulars': customer_name,
                'debit': 0.0,
                'credit': amt,
                'narration': inv.narration or f"Sales Invoice {inv.invoice_no}",
            })

        # 2b. Sales Returns for sales_ledger (Income)
        for ret in SalesReturn.objects.filter(sales_ledger=ledger):
            amt = float(ret.total_amount or 0.0)
            customer_name = ret.customer_ledger.name if ret.customer_ledger else 'Customer'
            entries.append({
                'id': f"sretd_{ret.id}",
                'date': str(ret.entry_date),
                'voucher_type': 'Sales Return',
                'voucher_no': ret.return_no,
                'particulars': customer_name,
                'debit': amt,
                'credit': 0.0,
                'narration': ret.narration or f"Sales Return {ret.return_no}",
            })

        # 3. Purchase Invoices for supplier_ledger (Creditor)
        for inv in PurchaseInvoice.objects.filter(supplier_ledger=ledger):
            amt = float(inv.total_amount or 0.0)
            purchase_ledger_name = inv.purchase_ledger.name if inv.purchase_ledger else 'Purchase'
            entries.append({
                'id': f"pinv_{inv.id}",
                'date': str(inv.entry_date),
                'voucher_type': 'Purchase Invoice',
                'voucher_no': inv.invoice_no,
                'particulars': purchase_ledger_name,
                'debit': 0.0,
                'credit': amt,
                'narration': f"Purchase Invoice {inv.invoice_no}",
            })

        # 3b. Purchase Returns for supplier_ledger (Creditor)
        for ret in PurchaseReturn.objects.filter(supplier_ledger=ledger):
            amt = float(ret.total_amount or 0.0)
            purchase_ledger_name = ret.purchase_ledger.name if ret.purchase_ledger else 'Purchase Return'
            entries.append({
                'id': f"pret_{ret.id}",
                'date': str(ret.entry_date),
                'voucher_type': 'Purchase Return',
                'voucher_no': ret.return_no,
                'particulars': purchase_ledger_name,
                'debit': amt,
                'credit': 0.0,
                'narration': ret.narration or f"Purchase Return {ret.return_no}",
            })

        # 4. Purchase Invoices for purchase_ledger (Expense)
        for inv in PurchaseInvoice.objects.filter(purchase_ledger=ledger):
            amt = float(inv.total_amount or 0.0)
            supplier_name = inv.supplier_ledger.name if inv.supplier_ledger else 'Supplier'
            entries.append({
                'id': f"pinvd_{inv.id}",
                'date': str(inv.entry_date),
                'voucher_type': 'Purchase Invoice',
                'voucher_no': inv.invoice_no,
                'particulars': supplier_name,
                'debit': amt,
                'credit': 0.0,
                'narration': f"Purchase Invoice {inv.invoice_no}",
            })

        # 4b. Purchase Returns for purchase_ledger (Expense)
        for ret in PurchaseReturn.objects.filter(purchase_ledger=ledger):
            amt = float(ret.total_amount or 0.0)
            supplier_name = ret.supplier_ledger.name if ret.supplier_ledger else 'Supplier'
            entries.append({
                'id': f"pretd_{ret.id}",
                'date': str(ret.entry_date),
                'voucher_type': 'Purchase Return',
                'voucher_no': ret.return_no,
                'particulars': supplier_name,
                'debit': 0.0,
                'credit': amt,
                'narration': ret.narration or f"Purchase Return {ret.return_no}",
            })

        # 5. Service Invoices
        for inv in ServiceInvoice.objects.filter(customer=ledger):
            amt = float(inv.net_amount or 0.0)
            entries.append({
                'id': f"srv_{inv.id}",
                'date': str(inv.invoice_date),
                'voucher_type': 'Service Invoice',
                'voucher_no': inv.invoice_no,
                'particulars': 'Service Sales',
                'debit': amt,
                'credit': 0.0,
                'narration': inv.narration or f"Service Invoice {inv.invoice_no}",
            })
            
        for inv_detail in ServiceInvoiceDetail.objects.filter(service_ledger=ledger):
            amt = float(inv_detail.amount or 0.0)
            entries.append({
                'id': f"srvd_{inv_detail.id}",
                'date': str(inv_detail.invoice.invoice_date),
                'voucher_type': 'Service Sales',
                'voucher_no': inv_detail.invoice.invoice_no,
                'particulars': inv_detail.invoice.customer.name if inv_detail.invoice.customer else 'Customer',
                'debit': 0.0,
                'credit': amt,
                'narration': f"Service Invoice {inv_detail.invoice.invoice_no}",
            })

        # 6. Journals
        for j in JournalVoucherDetail.objects.filter(ledger=ledger).select_related('voucher'):
            d_amt = float(j.debit_amount or 0.0)
            c_amt = float(j.credit_amount or 0.0)
            other = j.voucher.details.exclude(id=j.id).first()
            other_name = other.ledger.name if (other and other.ledger) else 'As per details'
            entries.append({
                'id': f"jrn_{j.id}",
                'date': str(j.voucher.voucher_date),
                'voucher_type': 'Journal',
                'voucher_no': j.voucher.voucher_no,
                'particulars': other_name,
                'debit': d_amt,
                'credit': c_amt,
                'narration': j.narration or j.voucher.narration or f"Journal Voucher {j.voucher.voucher_no}",
            })

        # 7. Receipts
        for r in ReceiptVoucherDetail.objects.filter(ledger=ledger).select_related('voucher'):
            d_amt = float(r.debit_amount or 0.0)
            c_amt = float(r.credit_amount or 0.0)
            other = r.voucher.details.exclude(id=r.id).first()
            other_name = other.ledger.name if (other and other.ledger) else 'As per details'
            entries.append({
                'id': f"rcp_{r.id}",
                'date': str(r.voucher.voucher_date),
                'voucher_type': 'Receipt',
                'voucher_no': r.voucher.voucher_no,
                'particulars': other_name,
                'debit': d_amt,
                'credit': c_amt,
                'narration': r.narration or r.voucher.narration or f"Receipt Voucher {r.voucher.voucher_no}",
            })

        # 8. Payments
        for p in PaymentVoucherDetail.objects.filter(ledger=ledger).select_related('voucher'):
            d_amt = float(p.debit_amount or 0.0)
            c_amt = float(p.credit_amount or 0.0)
            other = p.voucher.details.exclude(id=p.id).first()
            other_name = other.ledger.name if (other and other.ledger) else 'As per details'
            entries.append({
                'id': f"pym_{p.id}",
                'date': str(p.voucher.voucher_date),
                'voucher_type': 'Payment',
                'voucher_no': p.voucher.voucher_no,
                'particulars': other_name,
                'debit': d_amt,
                'credit': c_amt,
                'narration': p.narration or p.voucher.narration or f"Payment Voucher {p.voucher.voucher_no}",
            })

        # 9. Contras
        for c in ContraVoucherDetail.objects.filter(ledger=ledger).select_related('voucher'):
            d_amt = float(c.debit_amount or 0.0)
            c_amt = float(c.credit_amount or 0.0)
            other = c.voucher.details.exclude(id=c.id).first()
            other_name = other.ledger.name if (other and other.ledger) else 'As per details'
            entries.append({
                'id': f"cnt_{c.id}",
                'date': str(c.voucher.voucher_date),
                'voucher_type': 'Contra',
                'voucher_no': c.voucher.voucher_no,
                'particulars': other_name,
                'debit': d_amt,
                'credit': c_amt,
                'narration': c.narration or c.voucher.narration or f"Contra Voucher {c.voucher.voucher_no}",
            })

        # -------------------------------------------------------------
        # BILL ALLOCATION & OUTSTANDING BILLS CALCULATION
        # -------------------------------------------------------------
        bills_map = {}

        for inv in SalesInvoice.objects.filter(customer_ledger=ledger):
            bills_map[inv.invoice_no] = {
                'bill_no': inv.invoice_no,
                'date': str(inv.entry_date),
                'bill_type': 'Sales Invoice',
                'original_amount': float(inv.total_amount or 0.0),
                'paid_amount': 0.0,
                'pending_amount': float(inv.total_amount or 0.0),
                'status': 'Unpaid'
            }

        for inv in PurchaseInvoice.objects.filter(supplier_ledger=ledger):
            bills_map[inv.invoice_no] = {
                'bill_no': inv.invoice_no,
                'date': str(inv.entry_date),
                'bill_type': 'Purchase Invoice',
                'original_amount': float(inv.total_amount or 0.0),
                'paid_amount': 0.0,
                'pending_amount': float(inv.total_amount or 0.0),
                'status': 'Unpaid'
            }

        for inv in ServiceInvoice.objects.filter(customer=ledger):
            bills_map[inv.invoice_no] = {
                'bill_no': inv.invoice_no,
                'date': str(inv.invoice_date),
                'bill_type': 'Service Invoice',
                'original_amount': float(inv.net_amount or 0.0),
                'paid_amount': 0.0,
                'pending_amount': float(inv.net_amount or 0.0),
                'status': 'Unpaid'
            }

        allocations = BillAllocation.objects.filter(
            Q(receipt_detail__ledger=ledger) |
            Q(payment_detail__ledger=ledger) |
            Q(journal_detail__ledger=ledger)
        ).select_related('against_sales_invoice', 'against_purchase_invoice')

        allocation_by_detail = {}
        for alloc in allocations:
            ref_name = alloc.name or (alloc.against_sales_invoice.invoice_no if alloc.against_sales_invoice else (alloc.against_purchase_invoice.invoice_no if alloc.against_purchase_invoice else ''))
            allocated_amt = float(alloc.amount or 0.0)
            
            if ref_name and ref_name in bills_map:
                bills_map[ref_name]['paid_amount'] += allocated_amt

            key = None
            if alloc.receipt_detail_id:
                key = f"rcp_{alloc.receipt_detail_id}"
            elif alloc.payment_detail_id:
                key = f"pym_{alloc.payment_detail_id}"
            elif alloc.journal_detail_id:
                key = f"jrn_{alloc.journal_detail_id}"

            if key:
                if key not in allocation_by_detail:
                    allocation_by_detail[key] = []
                allocation_by_detail[key].append({
                    'allocation_type': alloc.allocation_type,
                    'bill_no': ref_name,
                    'amount': allocated_amt
                })

        bills = []
        for b_no, b in bills_map.items():
            orig = b['original_amount']
            paid = round(b['paid_amount'], 2)
            pending = round(orig - paid, 2)
            b['paid_amount'] = paid
            b['pending_amount'] = max(0.0, pending)
            if pending <= 0:
                b['status'] = 'Paid'
            elif paid > 0 and pending > 0:
                b['status'] = 'Partially Paid'
            else:
                b['status'] = 'Unpaid'
            bills.append(b)

        bills.sort(key=lambda x: x['date'], reverse=True)

        entries.sort(key=lambda x: x['date'])
        
        total_debit = 0.0
        total_credit = 0.0
        processed_vouchers = []

        curr_net = running_net
        for entry in entries:
            dr = entry['debit']
            cr = entry['credit']
            total_debit += dr
            total_credit += cr
            curr_net += (dr - cr)
            
            b_amt = round(abs(curr_net), 2)
            b_type = 'Dr' if curr_net >= 0 else 'Cr'

            allocs = allocation_by_detail.get(entry['id'], [])
            
            processed_vouchers.append({
                **entry,
                'bill_allocations': allocs,
                'running_balance': b_amt,
                'running_balance_type': b_type
            })

        closing_net = curr_net
        closing_amt = round(abs(closing_net), 2)
        closing_type = 'Dr' if closing_net >= 0 else 'Cr'

        return Response({
            'ledger_id': ledger.id,
            'ledger_name': ledger.name,
            'account_group_name': ledger.accountGroup.name if ledger.accountGroup else '',
            'opening_balance': op_bal,
            'opening_balance_type': op_type,
            'total_debit': round(total_debit, 2),
            'total_credit': round(total_credit, 2),
            'closing_balance': closing_amt,
            'closing_balance_type': closing_type,
            'vouchers': processed_vouchers,
            'bills': bills,
            'summary': {
                'total_bills': len(bills),
                'unpaid_count': sum(1 for b in bills if b['status'] == 'Unpaid'),
                'partially_paid_count': sum(1 for b in bills if b['status'] == 'Partially Paid'),
                'paid_count': sum(1 for b in bills if b['status'] == 'Paid'),
                'total_pending_amount': round(sum(b['pending_amount'] for b in bills), 2)
            }
        })

    @action(detail=False, methods=['post'], url_path='import-tally')
    def import_tally(self, request):
        """
        Queue a 'fetch_ledgers' command for the Tally Agent running on the client PC.
        If the agent is not connected, falls back to the direct pyodbc path (local dev only).
        """
        from django.utils import timezone
        from sales_app.models import TallySyncConfig

        # Check if Tally Agent is connected (seen within the last 90 seconds)
        config = TallySyncConfig.objects.first()
        agent_connected = (
            config and config.agent_last_seen and
            (timezone.now() - config.agent_last_seen).total_seconds() < 90
        )

        if agent_connected:
            # Queue the command for the agent
            TallySyncConfig.objects.update(
                pending_import_command='fetch_ledgers',
                import_command_status='pending',
                import_command_error=None,
                import_command_result=None,
            )
            return Response({
                'queued': True,
                'message': 'Fetch request sent to Tally Agent. Ledgers will be imported in a few seconds.',
            })

        # ── Fallback: Direct pyodbc (only works when Django runs on same machine as Tally) ──
        try:
            import pyodbc
        except ImportError:
            return Response(
                {"error": "Tally Agent is not connected. "
                           "Please make sure the Tally Sync Agent (Start_Tally_Agent.bat) is running on the client PC."},
                status=status.HTTP_400_BAD_REQUEST
            )
        from finance_app.models import AccountGroup, LedgerContactDetail

        conn = None
        for dsn in ['TallyODBC64_9000', 'TallyODBC_9000']:
            try:
                conn = pyodbc.connect(f'DSN={dsn}', timeout=5)
                break
            except Exception:
                continue

        if not conn:
            return Response(
                {"error": "Could not connect to Tally ODBC and no Tally Agent is running. "
                           "Please start the Tally Sync Agent (Start_Tally_Agent.bat) on the client PC."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            cursor = conn.cursor()
            query = "SELECT $Name, $PriorStateName, $StateName, $Parent, $LedgerPhone, $LedgerContact, $LedgerMobile, $IsBillWiseOn, $CreditLimit, $_PrimaryGroup, $_Address1, $_Address2, $_Address3, $_Address4, $_Address5, $_PartyGSTIN, $CountryName, $PinCode, $MailingName, $GSTRegistrationType, $Email, $OpeningBalance FROM Ledger"
            cursor.execute(query)
            rows = cursor.fetchall()

            existing_ledgers = {l.name: l for l in Ledger.objects.select_related('accountGroup').prefetch_related('contact_details').all()}
            new_count = 0
            update_count = 0

            STATE_CODE_MAP = {
                'andhra pradesh': 'AP', 'arunachal pradesh': 'AR', 'assam': 'AS', 'bihar': 'BR',
                'chhattisgarh': 'CG', 'goa': 'GA', 'gujarat': 'GJ', 'haryana': 'HR',
                'himachal pradesh': 'HP', 'jharkhand': 'JH', 'karnataka': 'KA', 'kerala': 'KL',
                'madhya pradesh': 'MP', 'maharashtra': 'MH', 'manipur': 'MN', 'meghalaya': 'ML',
                'mizoram': 'MZ', 'nagaland': 'NL', 'odisha': 'OR', 'punjab': 'PB',
                'rajasthan': 'RJ', 'sikkim': 'SK', 'tamil nadu': 'TN', 'telangana': 'TG',
                'tripura': 'TR', 'uttar pradesh': 'UP', 'uttarakhand': 'UT', 'west bengal': 'WB',
                'andaman and nicobar islands': 'AN', 'chandigarh': 'CH',
                'dadra and nagar haveli and daman and diu': 'DH', 'delhi': 'DL',
                'jammu and kashmir': 'JK', 'ladakh': 'LA', 'lakshadweep': 'LD', 'puducherry': 'PY'
            }

            for row in rows:
                name = row[0]
                if not name or not str(name).strip(): continue
                name = str(name).strip()

                prior_state = row[1]
                state_name = row[2]
                parent = row[3]
                phone = row[4]
                contact = row[5]
                mobile = row[6]
                is_bill_wise = row[7]
                credit_limit = row[8]
                addr1 = row[10]
                addr2 = row[11]
                addr3 = row[12]
                addr4 = row[13]
                addr5 = row[14]
                gstin = row[15]
                country_name = row[16]
                pincode = row[17]
                mailing_name = row[18]
                gst_reg_type = row[19]
                email_address = row[20]
                opening_balance = row[21]

                final_state = state_name if state_name else prior_state

                group_obj = None
                if parent:
                    parent_str = str(parent).strip()
                    group_obj, _ = AccountGroup.objects.get_or_create(name=parent_str, defaults={'nature': 'Asset'})

                bill_wise = True if str(is_bill_wise).lower() == 'yes' else False

                try:
                    cl = float(credit_limit) if credit_limit else 0.0
                    cl = abs(cl)
                except:
                    cl = 0.0

                try:
                    parsed_opening_balance = float(opening_balance) if opening_balance else 0.0
                    parsed_opening_balance = abs(parsed_opening_balance)
                except:
                    parsed_opening_balance = 0.0

                address_parts = filter(None, [addr1, addr2, addr3, addr4, addr5])
                address = " ".join([str(p) for p in address_parts])

                final_phone = phone if phone else mobile

                parsed_state = str(final_state)[:100] if final_state else None
                if parsed_state:
                    parsed_state_lower = parsed_state.lower().strip()
                    parsed_state = STATE_CODE_MAP.get(parsed_state_lower, parsed_state)

                parsed_phone = str(final_phone)[:100] if final_phone else None
                parsed_addr1 = str(addr1)[:100] if addr1 else None
                parsed_addr2 = str(addr2)[:100] if addr2 else None
                parsed_addr3 = str(addr3)[:100] if addr3 else None
                parsed_address = str(address)[:100] if address else None
                parsed_gstin = str(gstin)[:100] if gstin else None

                parsed_pincode = str(pincode)[:100] if pincode else None
                parsed_mailing_name = str(mailing_name)[:100] if mailing_name else None
                parsed_email = str(email_address)[:100] if email_address else None

                parsed_country = None
                if country_name:
                    cn_lower = str(country_name).lower().strip()
                    if cn_lower == 'india':
                        parsed_country = 'IN'
                    else:
                        parsed_country = str(country_name)[:100]

                parsed_reg_type = 'unregistered'
                if parsed_gstin and parsed_gstin.strip():
                    parsed_reg_type = 'registered'

                parsed_place_of_supply = parsed_state

                if name in existing_ledgers:
                    ledger = existing_ledgers[name]
                    updated = False

                    if ledger.accountGroup != group_obj:
                        ledger.accountGroup = group_obj
                        updated = True
                    if ledger.maintain_biilwise_details != bill_wise:
                        ledger.maintain_biilwise_details = bill_wise
                        updated = True
                    if (ledger.state or None) != parsed_state:
                        ledger.state = parsed_state
                        updated = True
                    if (ledger.country or None) != parsed_country:
                        ledger.country = parsed_country
                        updated = True
                    if (ledger.placeofsupply or None) != parsed_place_of_supply:
                        ledger.placeofsupply = parsed_place_of_supply
                        updated = True
                    if (ledger.pincode or None) != parsed_pincode:
                        ledger.pincode = parsed_pincode
                        updated = True
                    if (ledger.mailing_name or None) != parsed_mailing_name:
                        ledger.mailing_name = parsed_mailing_name
                        updated = True
                    if (ledger.email or None) != parsed_email:
                        ledger.email = parsed_email
                        updated = True
                    if ledger.registration_type != parsed_reg_type:
                        ledger.registration_type = parsed_reg_type
                        updated = True
                    if (ledger.phone or None) != parsed_phone:
                        ledger.phone = parsed_phone
                        updated = True
                    if float(ledger.credit_limit or 0) != cl:
                        ledger.credit_limit = cl
                        updated = True
                    if float(ledger.opening_balance or 0) != parsed_opening_balance:
                        ledger.opening_balance = parsed_opening_balance
                        updated = True
                    if (ledger.address1 or None) != parsed_addr1:
                        ledger.address1 = parsed_addr1
                        updated = True
                    if (ledger.address2 or None) != parsed_addr2:
                        ledger.address2 = parsed_addr2
                        updated = True
                    if (ledger.address3 or None) != parsed_addr3:
                        ledger.address3 = parsed_addr3
                        updated = True
                    if (ledger.address or None) != parsed_address:
                        ledger.address = parsed_address
                        updated = True
                    if (ledger.gst_number or None) != parsed_gstin:
                        ledger.gst_number = parsed_gstin
                        updated = True

                    if updated:
                        ledger.save()
                        update_count += 1

                    if contact:
                        contact_detail = ledger.contact_details.first()
                        if contact_detail:
                            c_updated = False
                            parsed_contact_name = str(contact)[:100]
                            parsed_c_phone = str(phone)[:50] if phone else None
                            parsed_c_mobile = str(mobile)[:50] if mobile else None

                            if (contact_detail.contact_name or None) != parsed_contact_name:
                                contact_detail.contact_name = parsed_contact_name
                                c_updated = True
                            if (contact_detail.phone_no or None) != parsed_c_phone:
                                contact_detail.phone_no = parsed_c_phone
                                c_updated = True
                            if (contact_detail.primary_mobile or None) != parsed_c_mobile:
                                contact_detail.primary_mobile = parsed_c_mobile
                                c_updated = True
                            if (contact_detail.email or None) != parsed_email:
                                contact_detail.email = parsed_email
                                c_updated = True

                            if c_updated:
                                contact_detail.save()
                        else:
                            LedgerContactDetail.objects.create(
                                ledger=ledger,
                                contact_name=str(contact)[:100],
                                phone_no=str(phone)[:50] if phone else None,
                                primary_mobile=str(mobile)[:50] if mobile else None,
                                email=parsed_email
                            )
                else:
                    ledger = Ledger(
                        name=name,
                        accountGroup=group_obj,
                        maintain_biilwise_details=bill_wise,
                        state=parsed_state,
                        country=parsed_country,
                        placeofsupply=parsed_place_of_supply,
                        pincode=parsed_pincode,
                        mailing_name=parsed_mailing_name,
                        email=parsed_email,
                        registration_type=parsed_reg_type,
                        phone=parsed_phone,
                        credit_limit=cl,
                        opening_balance=parsed_opening_balance,
                        address1=parsed_addr1,
                        address2=parsed_addr2,
                        address3=parsed_addr3,
                        address=parsed_address,
                        gst_number=parsed_gstin,
                        created_by=request.user if request.user.is_authenticated else None
                    )
                    ledger.save()
                    new_count += 1

                    if contact or parsed_email:
                        LedgerContactDetail.objects.create(
                            ledger=ledger,
                            contact_name=str(contact)[:100] if contact else None,
                            phone_no=str(phone)[:50] if phone else None,
                            primary_mobile=str(mobile)[:50] if mobile else None,
                            email=parsed_email
                        )

            cursor.close()
            conn.close()
            return Response({"message": f"Successfully imported {new_count} new ledgers and updated {update_count} existing ledgers from Tally"})

        except Exception as e:
            if conn:
                conn.close()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_path='import-tally-status')
    def import_tally_status(self, request):
        """Poll for the result of a queued fetch_ledgers import command."""
        from sales_app.models import TallySyncConfig
        config = TallySyncConfig.objects.filter(pending_import_command='fetch_ledgers').first() \
            or TallySyncConfig.objects.first()
        if not config:
            return Response({'status': 'idle'})
        return Response({
            'status': config.import_command_status,
            'message': config.import_command_result,
            'error': config.import_command_error,
            'last_updated': config.import_command_at,
        })



STANDARD_VOUCHER_TYPES = [
    {'name': 'Attendance', 'code': 'ATT'},
    {'name': 'Contra', 'code': 'CN'},
    {'name': 'Credit Note', 'code': 'CRN'},
    {'name': 'Debit Note', 'code': 'DBN'},
    {'name': 'Delivery Note', 'code': 'DN'},
    {'name': 'Job Work In Order', 'code': 'JWIO'},
    {'name': 'Job Work Out Order', 'code': 'JWOO'},
    {'name': 'Journal', 'code': 'JV'},
    {'name': 'Manufactural Journal', 'code': 'MJ'},
    {'name': 'Material In', 'code': 'MIN'},
    {'name': 'Material Out', 'code': 'MOUT'},
    {'name': 'Memorandum', 'code': 'MEMO'},
    {'name': 'Payment', 'code': 'PM'},
    {'name': 'Payroll', 'code': 'PR'},
    {'name': 'Physical Stock', 'code': 'PS'},
    {'name': 'Purchase', 'code': 'PU'},
    {'name': 'Purchase Order Gst', 'code': 'POG'},
    {'name': 'Purchase Return', 'code': 'PRT'},
    {'name': 'Quotation', 'code': 'QUOT'},
    {'name': 'Receipt', 'code': 'RC'},
    {'name': 'Receipt Note', 'code': 'RN'},
    {'name': 'Rejections In', 'code': 'REJI'},
    {'name': 'Rejections Out', 'code': 'REJO'},
    {'name': 'Reversing Journal', 'code': 'RJ'},
    {'name': 'Sales', 'code': 'SA'},
    {'name': 'Sales Order', 'code': 'SO'},
    {'name': 'Sales Return', 'code': 'SRT'},
    {'name': 'Stock Journal', 'code': 'SJ'},
]

def ensure_default_voucher_types():
    standard_names = {vtype['name'].lower() for vtype in STANDARD_VOUCHER_TYPES}

    # 1. Ensure all 24 standard voucher types exist
    for vtype in STANDARD_VOUCHER_TYPES:
        obj = VoucherType.objects.filter(name__iexact=vtype['name']).first()
        if not obj:
            if VoucherType.objects.filter(code=vtype['code']).exists():
                vtype_code = f"{vtype['code']}_{VoucherType.objects.count() + 1}"
            else:
                vtype_code = vtype['code']
            VoucherType.objects.get_or_create(
                name=vtype['name'],
                defaults={'code': vtype_code, 'is_active': True}
            )

    # 2. Delete any extra non-standard voucher types and their protected references
    try:
        from inventory_app.models import ProductConfiguration
        for pc in ProductConfiguration.objects.select_related('voucher_type').all():
            if pc.voucher_type and pc.voucher_type.name.lower() not in standard_names:
                pc.delete()

        extra_types = [vt for vt in VoucherType.objects.all() if vt.name.lower() not in standard_names]
        for vt in extra_types:
            try:
                vt.delete()
            except Exception:
                pass
    except Exception:
        pass

class VoucherTypeViewSet(viewsets.ModelViewSet):
    """
    CRUD for Voucher Types
    """
    queryset = VoucherType.objects.all().order_by('name')
    serializer_class = VoucherTypeSerializer
    permission_classes = [module_permission('company')]
    
    @action(detail=True, methods=['get'], url_path='subtypes')
    def subtypes(self, request, pk=None):
        voucher_type = self.get_object()
        type_name = (voucher_type.name or '').lower()
        subtypes = []
        if 'stock journal' in type_name:
            from .models import StockJournalType
            subtypes = list(StockJournalType.objects.values_list('stock_journal_type', flat=True))
        elif 'manufactural journal' in type_name or 'manufacturing journal' in type_name or 'manufacture journal' in type_name:
            from .models import ManufacturalJournalType
            subtypes = list(ManufacturalJournalType.objects.values_list('manufactural_journal_type', flat=True))
        return Response(subtypes)

    def get_queryset(self):
        try:
            ensure_default_voucher_types()
        except Exception:
            pass
        return super().get_queryset()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        standard_names = {vt['name'].lower() for vt in STANDARD_VOUCHER_TYPES}

        if instance.name.lower() in standard_names:
            return Response(
                {"detail": f"Standard Voucher Type '{instance.name}' is system-protected and cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST
            )

        return super().destroy(request, *args, **kwargs)

class QuotationViewSet(viewsets.ModelViewSet):
    queryset = Quotation.objects.all().order_by('-created_at')
    serializer_class = QuotationSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(created_by=user)

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(edited_by=user)

    @action(detail=False, methods=['get'], url_path='next-number')
    def next_number(self, request):
        from settings_app.models import PrefixConfiguration
        config_id = request.query_params.get('prefix_config_id')
        prefix = 'QT'
        padding = 4
        starting_number = 1
        postfix = ''
        
        if config_id:
            try:
                config = PrefixConfiguration.objects.get(pk=config_id)
                prefix = config.prefix or 'QT'
                padding = config.number_padding or 4
                starting_number = config.starting_number or 1
                postfix = config.postfix or ''
            except PrefixConfiguration.DoesNotExist:
                pass
        
        separator = "-" if not prefix.endswith("-") else ""
        lookup_prefix = f"{prefix}{separator}"
        
        existing_qs = Quotation.objects.filter(quotation_no__startswith=lookup_prefix)
        existing = list(existing_qs.values_list('quotation_no', flat=True))
        
        max_num = starting_number - 1
        for qno in existing:
            stripped = qno[len(lookup_prefix):]
            if postfix and stripped.endswith(postfix):
                stripped = stripped[:-len(postfix)]
            try:
                num = int(stripped)
                if num > max_num:
                    max_num = num
            except (ValueError, TypeError):
                pass
        
        next_num = max_num + 1
        padded = str(next_num).zfill(padding)
        next_no = f"{lookup_prefix}{padded}{postfix}"
        
        return Response({'next_no': next_no})


from .models import ServiceInvoice
from .serializers import ServiceInvoiceSerializer

class ServiceInvoiceViewSet(viewsets.ModelViewSet):
    queryset = ServiceInvoice.objects.all().order_by('-invoice_date', '-id')
    serializer_class = ServiceInvoiceSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(created_by=user)

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(edited_by=user)


from .models import JournalVoucher
from .serializers import JournalVoucherSerializer

class JournalVoucherViewSet(viewsets.ModelViewSet):
    queryset = JournalVoucher.objects.all().order_by('-voucher_date', '-id')
    serializer_class = JournalVoucherSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(created_by=user)

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(edited_by=user)


from .models import ReceiptVoucher, PaymentVoucher
from .serializers import ReceiptVoucherSerializer, PaymentVoucherSerializer

class ReceiptVoucherViewSet(viewsets.ModelViewSet):
    queryset = ReceiptVoucher.objects.all().order_by('-voucher_date', '-id')
    serializer_class = ReceiptVoucherSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(created_by=user)

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(edited_by=user)


class PaymentVoucherViewSet(viewsets.ModelViewSet):
    queryset = PaymentVoucher.objects.all().order_by('-voucher_date', '-id')
    serializer_class = PaymentVoucherSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(created_by=user)

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(edited_by=user)


from .models import ContraVoucher
from .serializers import ContraVoucherSerializer

class ContraVoucherViewSet(viewsets.ModelViewSet):
    queryset = ContraVoucher.objects.all().order_by('-voucher_date', '-id')
    serializer_class = ContraVoucherSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(created_by=user)

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(edited_by=user)


class StockJournalTypeViewSet(viewsets.ModelViewSet):
    queryset = StockJournalType.objects.all().order_by('stock_journal_type')
    serializer_class = StockJournalTypeSerializer
    permission_classes = [IsAuthenticated]


# ─────────────────────────────────────────────────────────────────────────────
# Stock Journal Views
# ─────────────────────────────────────────────────────────────────────────────

class StockJournalViewSet(viewsets.ModelViewSet):
    """
    Full CRUD for StockJournal, including nested details.
    On create/update: syncs StockTable + StockTableDuplicate.
    On destroy: removes associated StockTable + StockTableDuplicate entries.
    """
    queryset = StockJournal.objects.select_related(
        'stock_journal_type'
    ).prefetch_related('details__stock_item', 'details__warehouse').order_by('-journal_date', '-id')
    serializer_class = StockJournalSerializer
    permission_classes = [IsAuthenticated]

    def perform_destroy(self, instance):
        """Remove stock table entries before deleting the journal."""
        from inventory_app.models import StockTable, StockTableDuplicate
        journal_id = instance.id
        instance.delete()
        StockTable.objects.filter(
            transaction_type='STOCK_JOURNAL',
            reference_id=journal_id
        ).delete()
        StockTableDuplicate.objects.filter(
            transaction_type='STOCK_JOURNAL',
            reference_id=journal_id
        ).delete()

    @action(detail=False, methods=['get'], url_path='next-number')
    def next_number(self, request):
        """
        GET /api/finance/stock-journals/next-number/?prefix_config_id=<id>
        Returns the next formatted journal number for the given prefix config.
        """
        from settings_app.models import PrefixConfiguration
        config_id = request.query_params.get('prefix_config_id')
        if not config_id:
            return Response({'error': 'prefix_config_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            config = PrefixConfiguration.objects.get(pk=config_id)
        except PrefixConfiguration.DoesNotExist:
            return Response({'error': 'PrefixConfiguration not found'}, status=status.HTTP_404_NOT_FOUND)

        prefix = config.prefix or ''
        postfix = config.postfix or ''
        existing_qs = StockJournal.objects.filter(journal_no__startswith=prefix)
        if config.sub_type:
            existing_qs = existing_qs.filter(stock_journal_type__stock_journal_type=config.sub_type)
        existing = list(existing_qs.values_list('journal_no', flat=True))
        
        max_num = config.starting_number - 1
        for jno in existing:
            stripped = jno[len(prefix):]
            if postfix and stripped.endswith(postfix):
                stripped = stripped[:-len(postfix)]
            try:
                num = int(stripped)
                if num > max_num:
                    max_num = num
            except (ValueError, TypeError):
                pass
        next_num = max_num + 1
        padded = str(next_num).zfill(config.number_padding)
        preview = f"{prefix}{padded}{postfix}"
        return Response({'next_number': preview, 'count': len(existing)})


class StockJournalPrefixConfigListView(views.APIView):
    """
    GET /api/finance/stock-journal-prefix-configs/
    Returns PrefixConfiguration records that are relevant for stock journals.
    Returns all prefix configurations (frontend can filter by type if needed).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from settings_app.models import PrefixConfiguration
        # Return all prefix configurations; filter by prefix_type name if provided
        type_name = request.query_params.get('type_name', '')
        qs = PrefixConfiguration.objects.select_related('voucher_type', 'branch').order_by(
            'voucher_type__name', 'prefix'
        )
        if type_name:
            qs = qs.filter(voucher_type__name__icontains=type_name)
        serializer = PrefixConfigurationForJournalSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ManufacturalJournalTypeViewSet(viewsets.ModelViewSet):
    queryset = ManufacturalJournalType.objects.all().order_by('manufactural_journal_type')
    serializer_class = ManufacturalJournalTypeSerializer
    permission_classes = [IsAuthenticated]


class ManufacturalJournalViewSet(viewsets.ModelViewSet):
    queryset = ManufacturalJournal.objects.select_related(
        'manufactural_journal_type', 'rnd_entry'
    ).prefetch_related('details__stock_item', 'details__warehouse').order_by('-journal_date', '-id')
    serializer_class = ManufacturalJournalSerializer
    permission_classes = [IsAuthenticated]

    def perform_destroy(self, instance):
        from inventory_app.models import StockTable, StockTableDuplicate
        journal_id = instance.id
        instance.delete()
        StockTable.objects.filter(
            transaction_type='MANUFACTURING_JOURNAL',
            reference_id=journal_id
        ).delete()
        StockTableDuplicate.objects.filter(
            transaction_type='MANUFACTURING_JOURNAL',
            reference_id=journal_id
        ).delete()

    @action(detail=False, methods=['get'], url_path='next-number')
    def next_number(self, request):
        from django.db.models import Q
        from settings_app.models import PrefixConfiguration
        config_id = request.query_params.get('prefix_config_id')
        config = None
        if config_id:
            try:
                config = PrefixConfiguration.objects.select_related('branch', 'voucher_type').get(pk=config_id)
            except (PrefixConfiguration.DoesNotExist, ValueError):
                config = None

        if not config:
            config = PrefixConfiguration.objects.select_related('branch', 'voucher_type').filter(
                Q(voucher_type__name__icontains='manufactural journal') |
                Q(voucher_type__name__icontains='manufacturing journal') |
                Q(voucher_type__name__icontains='manufactural') |
                Q(subvoucher_type__type_name__icontains='manufactural') |
                Q(sub_type__icontains='production')
            ).first()

        if not config:
            return Response({'next_number': 'MFJ-0001/2026', 'count': 0})

        branch_code = config.branch.branch_code if (config.branch and getattr(config.branch, 'branch_code', None)) else ''
        prefix = config.prefix or 'MFJ'
        padding = config.number_padding or 4
        postfix = config.postfix or ''

        prefix_part = f"{branch_code}-" if branch_code else ""
        prefix_part += prefix
        if not prefix_part.endswith('-'):
            prefix_part += '-'

        postfix_part = f"/{postfix}" if (postfix and not postfix.startswith('/')) else postfix

        existing_qs = ManufacturalJournal.objects.filter(journal_no__startswith=prefix)
        existing = list(existing_qs.values_list('journal_no', flat=True))

        max_num = config.starting_number - 1
        for jno in existing:
            if not jno:
                continue
            curr = str(jno)
            if branch_code and curr.startswith(f"{branch_code}-"):
                curr = curr[len(f"{branch_code}-"):]
            if curr.startswith(prefix):
                curr = curr[len(prefix):]
            if curr.startswith('-'):
                curr = curr[1:]
            if postfix_part and curr.endswith(postfix_part):
                curr = curr[:-len(postfix_part)]
            elif postfix and curr.endswith(postfix):
                curr = curr[:-len(postfix)]
            if curr.endswith('/'):
                curr = curr[:-1]
            try:
                num = int(curr)
                if num > max_num:
                    max_num = num
            except (ValueError, TypeError):
                pass
        next_num = max_num + 1
        padded = str(next_num).zfill(padding)
        preview = f"{prefix_part}{padded}{postfix_part}"
        return Response({'next_number': preview, 'count': len(existing)})


class ManufacturalJournalPrefixConfigListView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Q
        from settings_app.models import PrefixConfiguration
        type_name = request.query_params.get('type_name', '')
        qs = PrefixConfiguration.objects.select_related('voucher_type', 'subvoucher_type', 'branch').order_by(
            'prefix'
        )
        if type_name:
            qs = qs.filter(
                Q(voucher_type__name__icontains=type_name) |
                Q(subvoucher_type__type_name__icontains=type_name) |
                Q(sub_type__icontains=type_name)
            )
        else:
            qs = qs.filter(
                Q(voucher_type__name__icontains='manufactur') |
                Q(subvoucher_type__type_name__icontains='manufactur') |
                Q(sub_type__icontains='production') |
                Q(sub_type__icontains='consumption')
            )
        serializer = PrefixConfigurationForManufacturalJournalSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class TrialBalanceAPIView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            ensure_default_account_groups()
        except Exception:
            pass

        from django.db.models import Sum, Q
        from datetime import datetime
        from .models import (
            AccountGroup, Ledger, JournalVoucherDetail, ReceiptVoucherDetail,
            PaymentVoucherDetail, ContraVoucherDetail, ServiceInvoice, ServiceInvoiceDetail
        )

        from_date_str = request.query_params.get('from_date', None)
        to_date_str = request.query_params.get('to_date', None)

        from_date = None
        to_date = None
        if from_date_str:
            try:
                from_date = datetime.strptime(from_date_str, '%Y-%m-%d').date()
            except ValueError:
                pass
        if to_date_str:
            try:
                to_date = datetime.strptime(to_date_str, '%Y-%m-%d').date()
            except ValueError:
                pass

        groups = AccountGroup.objects.all().order_by('sort_order', 'name')
        ledgers = Ledger.objects.select_related('accountGroup').all()

        # Dictionary to store per-ledger totals
        # ledger_id -> { opening_dr, opening_cr, period_dr, period_cr, closing_dr, closing_cr }
        ledger_metrics = {}

        for l in ledgers:
            nature = (l.accountGroup.nature if l.accountGroup else 'Asset').capitalize()
            init_op = float(l.opening_balance or 0.0)
            op_type = l.opening_balance_type or ('Dr' if nature in ['Asset', 'Expense'] else 'Cr')
            
            # Determine initial Dr / Cr for opening balance based on explicit Dr/Cr or group nature
            init_op_dr = init_op if op_type == 'Dr' else 0.0
            init_op_cr = init_op if op_type == 'Cr' else 0.0

            ledger_metrics[l.id] = {
                'id': l.id,
                'name': l.name,
                'group_id': l.accountGroup_id,
                'group_name': l.accountGroup.name if l.accountGroup else 'Unassigned',
                'nature': nature,
                'opening_dr': init_op_dr,
                'opening_cr': init_op_cr,
                'period_dr': 0.0,
                'period_cr': 0.0,
                'closing_dr': 0.0,
                'closing_cr': 0.0,
            }

        # Helper to compute transactions per voucher table
        def process_voucher_details(detail_model, date_field_path):
            qs = detail_model.objects.all()
            for d in qs:
                lid = d.ledger_id
                if lid not in ledger_metrics:
                    continue
                vdate = getattr(d.voucher, 'voucher_date', None)
                if not vdate:
                    continue

                dr = float(d.debit_amount or 0.0)
                cr = float(d.credit_amount or 0.0)

                # Prior to from_date -> Adjust opening balance
                if from_date and vdate < from_date:
                    ledger_metrics[lid]['opening_dr'] += dr
                    ledger_metrics[lid]['opening_cr'] += cr
                # Within date range
                elif (not from_date or vdate >= from_date) and (not to_date or vdate <= to_date):
                    ledger_metrics[lid]['period_dr'] += dr
                    ledger_metrics[lid]['period_cr'] += cr

        process_voucher_details(JournalVoucherDetail, 'voucher__voucher_date')
        process_voucher_details(ReceiptVoucherDetail, 'voucher__voucher_date')
        process_voucher_details(PaymentVoucherDetail, 'voucher__voucher_date')
        process_voucher_details(ContraVoucherDetail, 'voucher__voucher_date')

        # Service Invoices
        service_invs = ServiceInvoice.objects.prefetch_related('details').all()
        for inv in service_invs:
            vdate = inv.invoice_date
            if not vdate:
                continue

            # Customer (Debit net_amount)
            cid = inv.customer_id
            if cid in ledger_metrics:
                dr = float(inv.net_amount or 0.0)
                if from_date and vdate < from_date:
                    ledger_metrics[cid]['opening_dr'] += dr
                elif (not from_date or vdate >= from_date) and (not to_date or vdate <= to_date):
                    ledger_metrics[cid]['period_dr'] += dr

            # Service details (Credit gross/amount)
            for d in inv.details.all():
                slid = d.service_ledger_id
                if slid in ledger_metrics:
                    cr = float(d.amount or d.gross or 0.0)
                    if from_date and vdate < from_date:
                        ledger_metrics[slid]['opening_cr'] += cr
                    elif (not from_date or vdate >= from_date) and (not to_date or vdate <= to_date):
                        ledger_metrics[slid]['period_cr'] += cr

            # GST Ledgers (Credit GST)
            if inv.gst_ledger_1_id and inv.gst_ledger_1_id in ledger_metrics:
                cr = float(inv.cgst or 0.0) + float(inv.igst or 0.0)
                if from_date and vdate < from_date:
                    ledger_metrics[inv.gst_ledger_1_id]['opening_cr'] += cr
                elif (not from_date or vdate >= from_date) and (not to_date or vdate <= to_date):
                    ledger_metrics[inv.gst_ledger_1_id]['period_cr'] += cr

            if inv.gst_ledger_2_id and inv.gst_ledger_2_id in ledger_metrics:
                cr = float(inv.sgst or 0.0)
                if from_date and vdate < from_date:
                    ledger_metrics[inv.gst_ledger_2_id]['opening_cr'] += cr
                elif (not from_date or vdate >= from_date) and (not to_date or vdate <= to_date):
                    ledger_metrics[inv.gst_ledger_2_id]['period_cr'] += cr

            # Round Off Ledger Credit / Debit for ServiceInvoices
            ro_amt = float(getattr(inv, 'round_off', 0.0) or 0.0)
            if ro_amt != 0:
                ro_id = getattr(inv, 'round_off_ledger_id', None)
                if not ro_id:
                    ro_lm = next((lm for lm in ledger_metrics.values() if 'round' in lm['name'].lower()), None)
                    if ro_lm:
                        ro_id = ro_lm['id']
                if ro_id and ro_id in ledger_metrics:
                    if ro_amt > 0:
                        if from_date and vdate < from_date:
                            ledger_metrics[ro_id]['opening_cr'] += ro_amt
                        elif (not from_date or vdate >= from_date) and (not to_date or vdate <= to_date):
                            ledger_metrics[ro_id]['period_cr'] += ro_amt
                    else:
                        if from_date and vdate < from_date:
                            ledger_metrics[ro_id]['opening_dr'] += abs(ro_amt)
                        elif (not from_date or vdate >= from_date) and (not to_date or vdate <= to_date):
                            ledger_metrics[ro_id]['period_dr'] += abs(ro_amt)

        # ── PurchaseInvoices ──────────────────────────────────────────────────
        try:
            from purchase_app.models import PurchaseInvoice
            for inv in PurchaseInvoice.objects.select_related('purchase_ledger', 'supplier_ledger').all():
                vdate = inv.entry_date
                if not vdate:
                    continue
                amt = float(inv.total_amount or 0.0)
                in_period     = (not from_date or vdate >= from_date) and (not to_date or vdate <= to_date)
                before_period = from_date and vdate < from_date

                plid = inv.purchase_ledger_id
                if plid and plid in ledger_metrics:
                    if before_period:
                        ledger_metrics[plid]['opening_dr'] += amt
                    elif in_period:
                        ledger_metrics[plid]['period_dr'] += amt

                slid = inv.supplier_ledger_id
                if slid and slid in ledger_metrics:
                    if before_period:
                        ledger_metrics[slid]['opening_cr'] += amt
                    elif in_period:
                        ledger_metrics[slid]['period_cr'] += amt
        except Exception:
            pass

        # ── PurchaseReturns ───────────────────────────────────────────────────
        try:
            from purchase_app.models import PurchaseReturn
            for ret in PurchaseReturn.objects.select_related('purchase_ledger', 'supplier_ledger').all():
                vdate = ret.entry_date
                if not vdate:
                    continue
                amt = float(ret.total_amount or 0.0)
                in_period     = (not from_date or vdate >= from_date) and (not to_date or vdate <= to_date)
                before_period = from_date and vdate < from_date

                plid = ret.purchase_ledger_id
                if plid and plid in ledger_metrics:
                    if before_period:
                        ledger_metrics[plid]['opening_cr'] += amt
                    elif in_period:
                        ledger_metrics[plid]['period_cr'] += amt

                slid = ret.supplier_ledger_id
                if slid and slid in ledger_metrics:
                    if before_period:
                        ledger_metrics[slid]['opening_dr'] += amt
                    elif in_period:
                        ledger_metrics[slid]['period_dr'] += amt
        except Exception:
            pass

        # ── SalesInvoices ─────────────────────────────────────────────────────
        try:
            from sales_app.models import SalesInvoice
            for inv in SalesInvoice.objects.select_related('sales_ledger', 'customer_ledger').all():
                vdate = inv.entry_date
                if not vdate:
                    continue
                amt = float(inv.total_amount or 0.0)
                in_period     = (not from_date or vdate >= from_date) and (not to_date or vdate <= to_date)
                before_period = from_date and vdate < from_date

                slid = inv.sales_ledger_id
                if slid and slid in ledger_metrics:
                    if before_period:
                        ledger_metrics[slid]['opening_cr'] += amt
                    elif in_period:
                        ledger_metrics[slid]['period_cr'] += amt

                clid = inv.customer_ledger_id
                if clid and clid in ledger_metrics:
                    if before_period:
                        ledger_metrics[clid]['opening_dr'] += amt
                    elif in_period:
                        ledger_metrics[clid]['period_dr'] += amt
        except Exception:
            pass

        # ── SalesReturns ──────────────────────────────────────────────────────
        try:
            from sales_app.models import SalesReturn
            for ret in SalesReturn.objects.select_related('sales_ledger', 'customer_ledger').all():
                vdate = ret.entry_date
                if not vdate:
                    continue
                amt = float(ret.total_amount or 0.0)
                in_period     = (not from_date or vdate >= from_date) and (not to_date or vdate <= to_date)
                before_period = from_date and vdate < from_date

                slid = ret.sales_ledger_id
                if slid and slid in ledger_metrics:
                    if before_period:
                        ledger_metrics[slid]['opening_dr'] += amt
                    elif in_period:
                        ledger_metrics[slid]['period_dr'] += amt

                clid = ret.customer_ledger_id
                if clid and clid in ledger_metrics:
                    if before_period:
                        ledger_metrics[clid]['opening_cr'] += amt
                    elif in_period:
                        ledger_metrics[clid]['period_cr'] += amt
        except Exception:
            pass

        # ── JournalVouchers ───────────────────────────────────────────────────
        try:
            from finance_app.models import JournalVoucherDetail
            for jdetail in JournalVoucherDetail.objects.select_related('voucher', 'ledger').all():
                vdate = jdetail.voucher.voucher_date
                if not vdate:
                    continue
                lid = jdetail.ledger_id
                if lid and lid in ledger_metrics:
                    dr = float(jdetail.debit_amount or 0.0)
                    cr = float(jdetail.credit_amount or 0.0)
                    if from_date and vdate < from_date:
                        ledger_metrics[lid]['opening_dr'] += dr
                        ledger_metrics[lid]['opening_cr'] += cr
                    elif (not from_date or vdate >= from_date) and (not to_date or vdate <= to_date):
                        ledger_metrics[lid]['period_dr'] += dr
                        ledger_metrics[lid]['period_cr'] += cr
        except Exception:
            pass

        # Calculate final Closing Balances for each ledger
        for lid, m in ledger_metrics.items():
            net_opening = m['opening_dr'] - m['opening_cr']
            if net_opening >= 0:
                m['opening_dr'] = net_opening
                m['opening_cr'] = 0.0
            else:
                m['opening_dr'] = 0.0
                m['opening_cr'] = abs(net_opening)

            net_closing = (m['opening_dr'] - m['opening_cr']) + (m['period_dr'] - m['period_cr'])
            if net_closing >= 0:
                m['closing_dr'] = round(net_closing, 2)
                m['closing_cr'] = 0.0
            else:
                m['closing_dr'] = 0.0
                m['closing_cr'] = round(abs(net_closing), 2)

            m['opening_dr'] = round(m['opening_dr'], 2)
            m['opening_cr'] = round(m['opening_cr'], 2)
            m['period_dr'] = round(m['period_dr'], 2)
            m['period_cr'] = round(m['period_cr'], 2)

        # Build group hierarchy tree
        group_map = {}
        for g in groups:
            group_map[g.id] = {
                'id': g.id,
                'name': g.name,
                'parent_id': g.parent_id,
                'nature': g.nature,
                'is_main_head': g.is_main_head,
                'opening_dr': 0.0,
                'opening_cr': 0.0,
                'period_dr': 0.0,
                'period_cr': 0.0,
                'closing_dr': 0.0,
                'closing_cr': 0.0,
                'ledgers': [],
                'subgroups': []
            }

        # Attach ledgers to their groups
        for lid, m in ledger_metrics.items():
            gid = m['group_id']
            if gid in group_map:
                group_map[gid]['ledgers'].append(m)

        # ── Grouping under Standard Tally Primary Heads ───────────────────────
        PRIMARY_HEAD_MAPPING = {
            'sundry debtors': 'Current Assets',
            'cash-in-hand': 'Current Assets',
            'cash in hand': 'Current Assets',
            'bank accounts': 'Current Assets',
            'stock-in-hand': 'Current Assets',
            'stock in hand': 'Current Assets',
            'deposits (asset)': 'Current Assets',
            'loans & advances (asset)': 'Current Assets',
            'assets': 'Current Assets',
            'tools': 'Current Assets',

            'sundry creditors': 'Current Liabilities',
            'duties & taxes': 'Current Liabilities',
            'duties and taxes': 'Current Liabilities',
            'provisions': 'Current Liabilities',

            'share capital a/c': 'Capital Account',
            'reserves & surplus': 'Capital Account',
            'reserves and surplus': 'Capital Account',
            'abcd': 'Capital Account',
        }

        # Standard Tally primary heads order & containers with correct nature
        HEAD_NATURE_MAP = {
            'Capital Account': 'Liability',
            'Loans (Liability)': 'Liability',
            'Current Liabilities': 'Liability',
            'Fixed Assets': 'Asset',
            'Investments': 'Asset',
            'Current Assets': 'Asset',
            'Misc. Expenses (ASSET)': 'Asset',
            'Suspense A/c': 'Liability',
            'NON CURRENT LIABILITIES': 'Liability',
            'Sales Accounts': 'Income',
            'Purchase Accounts': 'Expense',
            'Direct Expenses': 'Expense',
            'Indirect Expenses': 'Expense',
            'Direct Incomes': 'Income',
            'Indirect Incomes': 'Income',
            'Profit & Loss A/c': 'Income'
        }
        standard_heads = list(HEAD_NATURE_MAP.keys())

        primary_containers = {}
        for phead, pnat in HEAD_NATURE_MAP.items():
            primary_containers[phead.lower()] = {
                'id': f"primary-{phead.lower().replace(' ', '-').replace('(', '').replace(')', '')}",
                'name': phead,
                'parent_id': None,
                'nature': pnat,
                'is_main_head': True,
                'opening_dr': 0.0,
                'opening_cr': 0.0,
                'period_dr': 0.0,
                'period_cr': 0.0,
                'closing_dr': 0.0,
                'closing_cr': 0.0,
                'ledgers': [],
                'subgroups': []
            }

        # Overwrite container if DB already has exact group, or assign parent
        for gid, gdict in list(group_map.items()):
            gname_lower = gdict['name'].lower()
            if gname_lower in primary_containers:
                primary_containers[gname_lower] = gdict
            elif gdict['parent_id'] is None:
                target_phead = PRIMARY_HEAD_MAPPING.get(gname_lower)
                if target_phead and target_phead.lower() in primary_containers:
                    gdict['parent_id'] = primary_containers[target_phead.lower()]['id']

        # Attach subgroups
        for gid, gdict in list(group_map.items()):
            pid = gdict['parent_id']
            if pid is not None:
                if isinstance(pid, str) and pid.startswith('primary-'):
                    pcontainer = next((c for c in primary_containers.values() if c['id'] == pid), None)
                    if pcontainer and gdict not in pcontainer['subgroups']:
                        pcontainer['subgroups'].append(gdict)
                elif pid in group_map:
                    if gdict not in group_map[pid]['subgroups']:
                        group_map[pid]['subgroups'].append(gdict)
            else:
                gname_lower = gdict['name'].lower()
                if gname_lower in primary_containers:
                    primary_containers[gname_lower] = gdict
                else:
                    # Default unmapped parent-less group to Current Assets
                    primary_containers['current assets']['subgroups'].append(gdict)

        # Attach unassigned ledgers (ledgers without an account group) to primary containers
        for lid, m in ledger_metrics.items():
            gid = m['group_id']
            if not gid or gid not in group_map:
                target_head = 'current assets' if m['nature'] in ['Asset', 'Expense'] else 'current liabilities'
                if target_head in primary_containers and m not in primary_containers[target_head]['ledgers']:
                    primary_containers[target_head]['ledgers'].append(m)

        # Recursive function to compute group totals
        def compute_group_totals(gnode):
            op_dr = sum(l['opening_dr'] for l in gnode['ledgers'])
            op_cr = sum(l['opening_cr'] for l in gnode['ledgers'])
            p_dr = sum(l['period_dr'] for l in gnode['ledgers'])
            p_cr = sum(l['period_cr'] for l in gnode['ledgers'])
            c_dr = sum(l['closing_dr'] for l in gnode['ledgers'])
            c_cr = sum(l['closing_cr'] for l in gnode['ledgers'])

            for sub in gnode['subgroups']:
                sub_totals = compute_group_totals(sub)
                op_dr += sub_totals['opening_dr']
                op_cr += sub_totals['opening_cr']
                p_dr += sub_totals['period_dr']
                p_cr += sub_totals['period_cr']
                c_dr += sub_totals['closing_dr']
                c_cr += sub_totals['closing_cr']

            gnode['opening_dr'] = round(op_dr, 2)
            gnode['opening_cr'] = round(op_cr, 2)
            gnode['period_dr'] = round(p_dr, 2)
            gnode['period_cr'] = round(p_cr, 2)
            gnode['closing_dr'] = round(c_dr, 2)
            gnode['closing_cr'] = round(c_cr, 2)

            return gnode

        top_groups = []
        for phead in standard_heads:
            container = primary_containers[phead.lower()]
            compute_group_totals(container)
            if container['subgroups'] or container['ledgers'] or container['closing_dr'] > 0 or container['closing_cr'] > 0 or container['opening_dr'] > 0 or container['opening_cr'] > 0:
                top_groups.append(container)

        # Grand Totals
        grand_op_dr = round(sum(tg['opening_dr'] for tg in top_groups), 2)
        grand_op_cr = round(sum(tg['opening_cr'] for tg in top_groups), 2)
        grand_period_dr = round(sum(tg['period_dr'] for tg in top_groups), 2)
        grand_period_cr = round(sum(tg['period_cr'] for tg in top_groups), 2)
        grand_closing_dr = round(sum(tg['closing_dr'] for tg in top_groups), 2)
        grand_closing_cr = round(sum(tg['closing_cr'] for tg in top_groups), 2)

        diff = round(abs(grand_closing_dr - grand_closing_cr), 2)
        is_balanced = diff <= 1.0

        company_name = None
        company_name, company_address = get_company_name_and_address()

        response_data = {
            'company_name': company_name,
            'company_address': company_address,
            'from_date': from_date_str,
            'to_date': to_date_str,
            'groups': top_groups,
            'flat_ledgers': list(ledger_metrics.values()),
            'totals': {
                'opening_dr': grand_op_dr,
                'opening_cr': grand_op_cr,
                'period_dr': grand_period_dr,
                'period_cr': grand_period_cr,
                'closing_dr': grand_closing_dr,
                'closing_cr': grand_closing_cr,
                'difference': diff,
                'is_balanced': is_balanced
            }
        }

        return Response(response_data, status=status.HTTP_200_OK)


class ProfitAndLossAPIView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            ensure_default_account_groups()
        except Exception:
            pass

        from datetime import datetime
        from decimal import Decimal
        from django.db.models import Sum, Q
        from .models import (
            AccountGroup, Ledger,
            JournalVoucherDetail, ReceiptVoucherDetail,
            PaymentVoucherDetail, ContraVoucherDetail,
            ServiceInvoice
        )

        from_date_str = request.query_params.get('from_date', None)
        to_date_str   = request.query_params.get('to_date', None)

        from_date = None
        to_date   = None
        if from_date_str:
            try:
                from_date = datetime.strptime(from_date_str, '%Y-%m-%d').date()
            except ValueError:
                pass
        if to_date_str:
            try:
                to_date = datetime.strptime(to_date_str, '%Y-%m-%d').date()
            except ValueError:
                pass

        # ── 1. Seed ledger metrics from opening balances ──────────────────────
        ledgers = Ledger.objects.select_related('accountGroup').all()
        ledger_metrics = {}

        for l in ledgers:
            nature     = (l.accountGroup.nature if l.accountGroup else 'Asset').capitalize()
            init_op    = float(l.opening_balance or 0.0)
            op_type    = l.opening_balance_type or ('Dr' if nature in ['Asset', 'Expense'] else 'Cr')
            init_op_dr = init_op if op_type == 'Dr' else 0.0
            init_op_cr = init_op if op_type == 'Cr' else 0.0

            ledger_metrics[l.id] = {
                'id':         l.id,
                'name':       l.name,
                'group_id':   l.accountGroup_id,
                'group_name': l.accountGroup.name if l.accountGroup else 'Unassigned',
                'nature':     nature,
                'opening_dr': init_op_dr,
                'opening_cr': init_op_cr,
                'period_dr':  0.0,
                'period_cr':  0.0,
            }

        # ── 2. Process finance voucher details ────────────────────────────────
        def apply_voucher_details(detail_qs):
            for d in detail_qs.select_related('voucher'):
                lid   = d.ledger_id
                vdate = getattr(d.voucher, 'voucher_date', None)
                if lid not in ledger_metrics or not vdate:
                    continue
                dr = float(d.debit_amount  or 0.0)
                cr = float(d.credit_amount or 0.0)
                if from_date and vdate < from_date:
                    ledger_metrics[lid]['opening_dr'] += dr
                    ledger_metrics[lid]['opening_cr'] += cr
                elif (not from_date or vdate >= from_date) and (not to_date or vdate <= to_date):
                    ledger_metrics[lid]['period_dr'] += dr
                    ledger_metrics[lid]['period_cr'] += cr

        apply_voucher_details(JournalVoucherDetail.objects.all())
        apply_voucher_details(ReceiptVoucherDetail.objects.all())
        apply_voucher_details(PaymentVoucherDetail.objects.all())
        apply_voucher_details(ContraVoucherDetail.objects.all())

        # ── 3. ServiceInvoice (Cr to sales/service ledger, Dr to customer) ───
        for inv in ServiceInvoice.objects.prefetch_related('details').all():
            vdate = inv.invoice_date
            if not vdate:
                continue
            in_period = (not from_date or vdate >= from_date) and (not to_date or vdate <= to_date)
            before_period = from_date and vdate < from_date

            cid = inv.customer_id
            if cid in ledger_metrics:
                dr = float(inv.net_amount or 0.0)
                if before_period:
                    ledger_metrics[cid]['opening_dr'] += dr
                elif in_period:
                    ledger_metrics[cid]['period_dr'] += dr

            for d in inv.details.all():
                slid = d.service_ledger_id
                if slid in ledger_metrics:
                    cr = float(d.amount or d.gross or 0.0)
                    if before_period:
                        ledger_metrics[slid]['opening_cr'] += cr
                    elif in_period:
                        ledger_metrics[slid]['period_cr'] += cr

        # ── 4. PurchaseInvoice → debit purchase_ledger, credit supplier ──────
        try:
            from purchase_app.models import PurchaseInvoice
            for inv in PurchaseInvoice.objects.select_related('purchase_ledger', 'supplier_ledger').all():
                vdate = inv.entry_date
                if not vdate:
                    continue
                in_period     = (not from_date or vdate >= from_date) and (not to_date or vdate <= to_date)
                before_period = from_date and vdate < from_date

                amount = float(inv.total_amount or 0.0)

                # Purchase ledger is Dr (Goods / Expense received)
                plid = inv.purchase_ledger_id
                if plid and plid in ledger_metrics:
                    if before_period:
                        ledger_metrics[plid]['opening_dr'] += amount
                    elif in_period:
                        ledger_metrics[plid]['period_dr'] += amount

                # Supplier ledger is Cr (accounts payable)
                slid = inv.supplier_ledger_id
                if slid and slid in ledger_metrics:
                    if before_period:
                        ledger_metrics[slid]['opening_cr'] += amount
                    elif in_period:
                        ledger_metrics[slid]['period_cr'] += amount
        except Exception:
            pass

        # ── 4b. PurchaseReturn → credit purchase_ledger, debit supplier ──────
        try:
            from purchase_app.models import PurchaseReturn
            for ret in PurchaseReturn.objects.select_related('purchase_ledger', 'supplier_ledger').all():
                vdate = ret.entry_date
                if not vdate:
                    continue
                in_period     = (not from_date or vdate >= from_date) and (not to_date or vdate <= to_date)
                before_period = from_date and vdate < from_date

                amount = float(ret.total_amount or 0.0)

                # Purchase ledger is Cr (returns reduce purchases)
                plid = ret.purchase_ledger_id
                if plid and plid in ledger_metrics:
                    if before_period:
                        ledger_metrics[plid]['opening_cr'] += amount
                    elif in_period:
                        ledger_metrics[plid]['period_cr'] += amount

                # Supplier ledger is Dr (reduces accounts payable)
                slid = ret.supplier_ledger_id
                if slid and slid in ledger_metrics:
                    if before_period:
                        ledger_metrics[slid]['opening_dr'] += amount
                    elif in_period:
                        ledger_metrics[slid]['period_dr'] += amount
        except Exception:
            pass

        # ── 5. SalesInvoice → credit sales_ledger, debit customer ────────────
        try:
            from sales_app.models import SalesInvoice
            for inv in SalesInvoice.objects.select_related('sales_ledger', 'customer_ledger').all():
                vdate = inv.entry_date
                if not vdate:
                    continue
                in_period     = (not from_date or vdate >= from_date) and (not to_date or vdate <= to_date)
                before_period = from_date and vdate < from_date

                amount = float(inv.total_amount or 0.0)

                # Sales ledger is Cr (income)
                sl_id = inv.sales_ledger_id
                if sl_id and sl_id in ledger_metrics:
                    if before_period:
                        ledger_metrics[sl_id]['opening_cr'] += amount
                    elif in_period:
                        ledger_metrics[sl_id]['period_cr'] += amount

                # Customer ledger is Dr (receivable)
                cl_id = inv.customer_ledger_id
                if cl_id and cl_id in ledger_metrics:
                    if before_period:
                        ledger_metrics[cl_id]['opening_dr'] += amount
                    elif in_period:
                        ledger_metrics[cl_id]['period_dr'] += amount
        except Exception:
            pass

        # ── 5b. SalesReturn → debit sales_ledger, credit customer ────────────
        try:
            from sales_app.models import SalesReturn
            for ret in SalesReturn.objects.select_related('sales_ledger', 'customer_ledger').all():
                vdate = ret.entry_date
                if not vdate:
                    continue
                in_period     = (not from_date or vdate >= from_date) and (not to_date or vdate <= to_date)
                before_period = from_date and vdate < from_date

                amount = float(ret.total_amount or 0.0)

                # Sales ledger is Dr (returns reduce sales)
                sl_id = ret.sales_ledger_id
                if sl_id and sl_id in ledger_metrics:
                    if before_period:
                        ledger_metrics[sl_id]['opening_dr'] += amount
                    elif in_period:
                        ledger_metrics[sl_id]['period_dr'] += amount

                # Customer ledger is Cr (reduces receivable)
                cl_id = ret.customer_ledger_id
                if cl_id and cl_id in ledger_metrics:
                    if before_period:
                        ledger_metrics[cl_id]['opening_cr'] += amount
                    elif in_period:
                        ledger_metrics[cl_id]['period_cr'] += amount
        except Exception:
            pass

        # ── 6. Compute net closing balance per ledger ─────────────────────────
        for m in ledger_metrics.values():
            net = (m['opening_dr'] - m['opening_cr']) + (m['period_dr'] - m['period_cr'])
            if net >= 0:
                m['closing_dr'] = round(net, 2)
                m['closing_cr'] = 0.0
            else:
                m['closing_dr'] = 0.0
                m['closing_cr'] = round(abs(net), 2)

        # ── 7. Categorise ledgers into P&L buckets ────────────────────────────
        # For Expense accounts  → use period_dr  (net debit activity in period)
        # For Income accounts   → use period_cr  (net credit activity in period)
        # For Stock accounts    → use opening balance / closing
        opening_stock   = 0.0
        closing_stock   = 0.0
        purchases       = []
        direct_expenses = []
        sales_accounts  = []
        direct_incomes  = []
        indirect_expenses = []
        indirect_incomes  = []

        show_zero = request.query_params.get('show_zero', 'false').lower() == 'true'

        for m in ledger_metrics.values():
            gname  = m['group_name'].lower()
            nature = m['nature'].lower()

            # ── Stock-in-hand ───
            if 'stock' in gname and ('hand' in gname or 'opening' in gname):
                # Skip ledger accumulation for stock; stock valuation is derived from StockTable
                continue

            # Decide display amount per account type
            if nature == 'expense':
                amt = round(m['period_dr'] - m['period_cr'], 2)
            elif nature == 'income':
                amt = round(m['period_cr'] - m['period_dr'], 2)
            else:
                # Asset / Liability — use closing balance
                amt = round(m['closing_dr'] - m['closing_cr'], 2)

            # Skip zero ledgers unless show_zero is requested
            if not show_zero and amt == 0 and m['period_dr'] == 0 and m['period_cr'] == 0:
                continue

            # For Income ledgers, if net amount is <= 0 (e.g. Sales Return exceeds Sales), do not display as positive income
            if not show_zero and amt <= 0 and nature == 'income':
                continue

            entry = {
                'id':     m['id'],
                'name':   m['name'],
                'amount': max(amt, 0.0) if not show_zero else amt,
                # Keep raw fields for backward compat
                'closing_dr': m['closing_dr'],
                'closing_cr': m['closing_cr'],
                'period_dr':  m['period_dr'],
                'period_cr':  m['period_cr'],
            }

            if 'purchase' in gname:
                purchases.append(entry)
            elif 'direct expense' in gname or 'manufacturing' in gname:
                direct_expenses.append(entry)
            elif 'sales' in gname:
                sales_accounts.append(entry)
            elif 'indirect expense' in gname or ('expense' in nature and 'indirect' in gname):
                indirect_expenses.append(entry)
            elif 'indirect income' in gname or ('income' in gname and 'indirect' in gname):
                indirect_incomes.append(entry)
            elif 'direct income' in gname or ('income' in gname and 'indirect' not in gname):
                direct_incomes.append(entry)
            elif 'expense' in nature:
                indirect_expenses.append(entry)
            elif 'income' in nature:
                indirect_incomes.append(entry)

        # ── 8. Stock Valuation from StockTable using Weighted Average Rate ──
        # Requirement: Take values from StockTable, rate is Weighted Average Rate (not valuation rate),
        # and today's closing stock is tomorrow's opening stock.
        opening_stock = 0.0
        closing_stock = 0.0
        opening_stock_items = []
        closing_stock_items = []

        stock_summary_categories = {
            'Raw Materials': {'category': 'Raw Materials', 'opening_value': 0.0, 'closing_value': 0.0, 'items': []},
            'Semi-Finished Goods (WIP)': {'category': 'Semi-Finished Goods (WIP)', 'opening_value': 0.0, 'closing_value': 0.0, 'items': []},
            'Finished Goods': {'category': 'Finished Goods', 'opening_value': 0.0, 'closing_value': 0.0, 'items': []},
            'Machinery & Vehicles': {'category': 'Machinery & Vehicles', 'opening_value': 0.0, 'closing_value': 0.0, 'items': []},
            'Equipments': {'category': 'Equipments', 'opening_value': 0.0, 'closing_value': 0.0, 'items': []},
            'Spare Parts': {'category': 'Spare Parts', 'opening_value': 0.0, 'closing_value': 0.0, 'items': []},
        }

        try:
            from inventory_app.models import StockItem, StockTable

            stock_items = StockItem.objects.select_related('stock_group', 'base_unit').all()

            for item in stock_items:
                g_name = (item.stock_group.name if item.stock_group else '').lower()
                i_name = item.name.lower()

                unit_str = item.base_unit.uqc_code if (item.base_unit and item.base_unit.uqc_code) else (item.base_unit.name if item.base_unit else 'NOS')

                if 'machine' in g_name or 'machine' in i_name or 'vehicle' in g_name or 'vehicle' in i_name or 'truck' in g_name or 'van' in g_name or 'car' in g_name or 'auto' in g_name:
                    cat_key = 'Machinery & Vehicles'
                elif 'equipment' in g_name or 'equipment' in i_name or 'equip' in g_name or 'equip' in i_name or 'tool' in g_name or 'instrument' in g_name:
                    cat_key = 'Equipments'
                elif 'spare' in g_name or 'spare' in i_name or 'part' in g_name or 'part' in i_name or 'component' in g_name:
                    cat_key = 'Spare Parts'
                elif 'semi' in g_name or 'semi' in i_name or 'wip' in g_name or 'work' in g_name or 'process' in g_name:
                    cat_key = 'Semi-Finished Goods (WIP)'
                elif 'finish' in g_name or 'finish' in i_name or 'product' in g_name or 'goods' in g_name:
                    cat_key = 'Finished Goods'
                else:
                    cat_key = 'Raw Materials'

                # 1. Calculate Weighted Average Rate from all IN movements in StockTable for this item
                in_records = StockTable.objects.filter(item=item, is_active=True, movement_type='IN')

                total_in_qty = 0.0
                total_in_val = 0.0

                for rec in in_records:
                    q = float(rec.quantity or 0.0)
                    r = float(rec.rate or 0.0)
                    if q > 0:
                        total_in_qty += q
                        total_in_val += (q * r)

                item_op_stock = float(item.opening_stock or 0.0)
                item_op_rate  = float(item.opening_rate or 0.0)
                item_op_val   = float(item.opening_value or (item_op_stock * item_op_rate) or 0.0)

                if total_in_qty > 0:
                    average_rate = total_in_val / total_in_qty
                elif item_op_rate > 0:
                    average_rate = item_op_rate
                elif item_op_stock > 0 and item_op_val > 0:
                    average_rate = item_op_val / item_op_stock
                else:
                    average_rate = float(item.mrp or 0.0)

                # 2. Opening Stock Quantity (Base item opening stock + movements strictly BEFORE from_date)
                op_qty = item_op_stock
                all_records = StockTable.objects.filter(item=item, is_active=True)

                if from_date:
                    for rec in all_records:
                        r_date = rec.date
                        q = float(rec.quantity or 0.0)
                        ttype = rec.transaction_type or ''
                        mtype = rec.movement_type or ''

                        if ttype == 'OPENING STOCK':
                            if (not r_date or r_date <= from_date) and item_op_stock == 0.0:
                                op_qty += q
                        else:
                            if r_date and r_date < from_date:
                                if mtype == 'IN':
                                    op_qty += q
                                elif mtype == 'OUT':
                                    op_qty -= q
                else:
                    for rec in all_records:
                        ttype = rec.transaction_type or ''
                        q = float(rec.quantity or 0.0)
                        if ttype == 'OPENING STOCK' and item_op_stock == 0.0:
                            op_qty += q

                op_qty = max(op_qty, 0.0)
                op_val = item_op_val if (op_qty == item_op_stock and item_op_val > 0) else (op_qty * average_rate)

                # 3. Closing Stock Quantity (Base item opening stock + movements ON OR BEFORE to_date)
                cl_qty = item_op_stock
                if to_date:
                    for rec in all_records:
                        r_date = rec.date
                        q = float(rec.quantity or 0.0)
                        mtype = rec.movement_type or ''

                        if not r_date or r_date <= to_date:
                            if mtype == 'IN':
                                cl_qty += q
                            elif mtype == 'OUT':
                                cl_qty -= q
                else:
                    for rec in all_records:
                        q = float(rec.quantity or 0.0)
                        mtype = rec.movement_type or ''
                        if mtype == 'IN':
                            cl_qty += q
                        elif mtype == 'OUT':
                            cl_qty -= q

                cl_qty = max(cl_qty, 0.0)
                cl_val = cl_qty * average_rate

                stock_summary_categories[cat_key]['opening_value'] += op_val
                stock_summary_categories[cat_key]['closing_value'] += cl_val
                stock_summary_categories[cat_key]['items'].append({
                    'id': item.id,
                    'name': item.name,
                    'unit': unit_str,
                    'opening_qty': round(op_qty, 3),
                    'opening_rate': round(average_rate, 2),
                    'opening_val': round(op_val, 2),
                    'closing_qty': round(cl_qty, 3),
                    'closing_rate': round(average_rate, 2),
                    'closing_val': round(cl_val, 2),
                    'is_stock_item': True,
                })
        except Exception:
            pass

        opening_stock = round(sum(cat['opening_value'] for cat in stock_summary_categories.values()), 2)
        closing_stock = round(sum(cat['closing_value'] for cat in stock_summary_categories.values()), 2)

        stock_summary = list(stock_summary_categories.values())

        opening_stock_items = [
            {'name': cat['category'], 'amount': round(cat['opening_value'], 2), 'items': cat['items']}
            for cat in stock_summary
            if round(cat['opening_value'], 2) > 0 or round(cat['closing_value'], 2) > 0 or len(cat['items']) > 0
        ]
        closing_stock_items = [
            {'name': cat['category'], 'amount': round(cat['closing_value'], 2), 'items': cat['items']}
            for cat in stock_summary
            if round(cat['opening_value'], 2) > 0 or round(cat['closing_value'], 2) > 0 or len(cat['items']) > 0
        ]

        # ── 9. Aggregate totals ───────────────────────────────────────────────
        def _sum(lst):
            return round(sum(e['amount'] for e in lst), 2)

        purchases_total    = _sum(purchases)
        direct_exp_total   = _sum(direct_expenses)
        sales_total        = _sum(sales_accounts)
        direct_inc_total   = _sum(direct_incomes)
        indirect_exp_total = _sum(indirect_expenses)
        indirect_inc_total = _sum(indirect_incomes)

        # ── 10. Trading Account ───────────────────────────────────────────────
        trading_dr = round(opening_stock + purchases_total + direct_exp_total, 2)
        trading_cr = round(sales_total + direct_inc_total + closing_stock, 2)

        gross_diff   = round(trading_cr - trading_dr, 2)
        gross_profit = round(gross_diff, 2)  if gross_diff > 0 else 0.0
        gross_loss   = round(abs(gross_diff), 2) if gross_diff < 0 else 0.0

        # Balance the lower side with Gross Profit c/o or Gross Loss c/o
        trading_dr_total = round(trading_dr + gross_profit, 2)  # Gross Profit appears on Dr side
        trading_cr_total = round(trading_cr + gross_loss,   2)  # Gross Loss appears on Cr side
        trading_grand    = max(trading_dr_total, trading_cr_total)

        # ── 11. P&L Account ───────────────────────────────────────────────────
        pnl_dr = round(gross_loss   + indirect_exp_total, 2)
        pnl_cr = round(gross_profit + indirect_inc_total, 2)

        net_diff   = round(pnl_cr - pnl_dr, 2)
        net_profit = round(net_diff, 2)      if net_diff > 0 else 0.0
        net_loss   = round(abs(net_diff), 2) if net_diff < 0 else 0.0

        pnl_dr_total = round(pnl_dr + net_profit, 2)
        pnl_cr_total = round(pnl_cr + net_loss,   2)
        pnl_grand    = max(pnl_dr_total, pnl_cr_total)

        # ── 12. Fetch Company Name & Address from Company Table ───────────────
        company_name, company_address = get_company_name_and_address()

        # ── 13. Build response ────────────────────────────────────────────────
        data = {
            'company_name':    company_name,
            'company_address': company_address,
            'from_date':    from_date_str,
            'to_date':      to_date_str,
            'trading': {
                'opening_stock':       opening_stock,
                'opening_stock_items': opening_stock_items,
                'closing_stock':       closing_stock,
                'closing_stock_items': closing_stock_items,
                'stock_summary':       stock_summary,
                'purchases':           {'items': purchases,       'total': purchases_total},
                'direct_expenses':     {'items': direct_expenses, 'total': direct_exp_total},
                'sales':               {'items': sales_accounts,  'total': sales_total},
                'direct_incomes':      {'items': direct_incomes,  'total': direct_inc_total},
                'gross_profit':        gross_profit,
                'gross_loss':          gross_loss,
                'dr_total':            trading_dr_total,
                'cr_total':            trading_cr_total,
                'grand_total':         trading_grand,
            },
            'pnl': {
                'gross_profit_bf':   gross_profit,
                'gross_loss_bf':     gross_loss,
                'indirect_expenses': {'items': indirect_expenses, 'total': indirect_exp_total},
                'indirect_incomes':  {'items': indirect_incomes,  'total': indirect_inc_total},
                'net_profit':  net_profit,
                'net_loss':    net_loss,
                'dr_total':    pnl_dr_total,
                'cr_total':    pnl_cr_total,
                'grand_total': pnl_grand,
            }
        }

        return Response(data, status=status.HTTP_200_OK)


class ReceivablesAPIView(views.APIView):
    """
    Bills Receivable Report (Outstandings for Sundry Debtors / Customers)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from datetime import date
        from django.db.models import Sum
        from .models import Ledger, BillAllocation, ServiceInvoice

        today = date.today()
        search_query = request.query_params.get('search', '').lower()

        # Map settled amounts per sales invoice from BillAllocation
        alloc_map = {}
        for ba in BillAllocation.objects.filter(against_sales_invoice__isnull=False):
            inv_id = ba.against_sales_invoice_id
            alloc_map[inv_id] = alloc_map.get(inv_id, 0.0) + float(ba.amount or 0.0)

        ledger_map = {}

        # 1. Process SalesInvoices
        try:
            from sales_app.models import SalesInvoice
            sales_qs = SalesInvoice.objects.select_related('customer_ledger').all()
            for inv in sales_qs:
                if not inv.customer_ledger:
                    continue
                clid = inv.customer_ledger.id
                cname = inv.customer_ledger.name
                gname = inv.customer_ledger.accountGroup.name if inv.customer_ledger.accountGroup else 'Sundry Debtors'

                if search_query and search_query not in cname.lower() and search_query not in (inv.invoice_no or '').lower():
                    continue

                total_amt   = float(inv.total_amount or 0.0)
                settled_amt = alloc_map.get(inv.id, 0.0)
                pending     = round(total_amt - settled_amt, 2)

                if pending <= 0.01:
                    continue

                entry_dt = inv.entry_date
                days = (today - entry_dt).days if entry_dt else 0

                bill_item = {
                    'id': inv.id,
                    'bill_type': 'Sales Invoice',
                    'bill_no': inv.invoice_no,
                    'bill_date': str(entry_dt) if entry_dt else '',
                    'total_amount': total_amt,
                    'settled_amount': round(settled_amt, 2),
                    'pending_amount': pending,
                    'overdue_days': max(0, days),
                }

                if clid not in ledger_map:
                    ledger_map[clid] = {
                        'ledger_id': clid,
                        'party_name': cname,
                        'account_group': gname,
                        'total_pending': 0.0,
                        'bills': [],
                    }

                ledger_map[clid]['bills'].append(bill_item)
                ledger_map[clid]['total_pending'] = round(ledger_map[clid]['total_pending'] + pending, 2)
        except Exception as e:
            print("Receivables SalesInvoice error:", e)

        # 2. Process ServiceInvoices
        try:
            for inv in ServiceInvoice.objects.select_related('customer').all():
                if not inv.customer:
                    continue
                cid   = inv.customer.id
                cname = inv.customer.name
                gname = inv.customer.accountGroup.name if inv.customer.accountGroup else 'Sundry Debtors'

                if search_query and search_query not in cname.lower() and search_query not in (inv.invoice_no or '').lower():
                    continue

                total_amt   = float(inv.net_amount or 0.0)
                settled_amt = 0.0  # ServiceInvoices
                pending     = round(total_amt - settled_amt, 2)

                if pending <= 0.01:
                    continue

                entry_dt = inv.invoice_date
                days = (today - entry_dt).days if entry_dt else 0

                bill_item = {
                    'id': inv.id,
                    'bill_type': 'Service Invoice',
                    'bill_no': inv.invoice_no,
                    'bill_date': str(entry_dt) if entry_dt else '',
                    'total_amount': total_amt,
                    'settled_amount': 0.0,
                    'pending_amount': pending,
                    'overdue_days': max(0, days),
                }

                if cid not in ledger_map:
                    ledger_map[cid] = {
                        'ledger_id': cid,
                        'party_name': cname,
                        'account_group': gname,
                        'total_pending': 0.0,
                        'bills': [],
                    }

                ledger_map[cid]['bills'].append(bill_item)
                ledger_map[cid]['total_pending'] = round(ledger_map[cid]['total_pending'] + pending, 2)
        except Exception as e:
            print("Receivables ServiceInvoice error:", e)

        ledgers_list = list(ledger_map.values())
        ledgers_list.sort(key=lambda x: x['party_name'])
        total_outstanding = round(sum(l['total_pending'] for l in ledgers_list), 2)

        return Response({
            'total_outstanding': total_outstanding,
            'total_parties': len(ledgers_list),
            'ledgers': ledgers_list
        }, status=status.HTTP_200_OK)


class PayablesAPIView(views.APIView):
    """
    Bills Payable Report (Outstandings for Sundry Creditors / Suppliers)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from datetime import date
        from .models import BillAllocation

        today = date.today()
        search_query = request.query_params.get('search', '').lower()

        # Map settled amounts per purchase invoice from BillAllocation
        alloc_map = {}
        for ba in BillAllocation.objects.filter(against_purchase_invoice__isnull=False):
            inv_id = ba.against_purchase_invoice_id
            alloc_map[inv_id] = alloc_map.get(inv_id, 0.0) + float(ba.amount or 0.0)

        ledger_map = {}

        try:
            from purchase_app.models import PurchaseInvoice
            purchase_qs = PurchaseInvoice.objects.select_related('supplier_ledger').all()
            for inv in purchase_qs:
                if not inv.supplier_ledger:
                    continue
                slid = inv.supplier_ledger.id
                sname = inv.supplier_ledger.name
                gname = inv.supplier_ledger.accountGroup.name if inv.supplier_ledger.accountGroup else 'Sundry Creditors'

                if search_query and search_query not in sname.lower() and search_query not in (inv.invoice_no or '').lower():
                    continue

                total_amt   = float(inv.total_amount or 0.0)
                settled_amt = alloc_map.get(inv.id, 0.0)
                pending     = round(total_amt - settled_amt, 2)

                if pending <= 0.01:
                    continue

                entry_dt = inv.entry_date
                days = (today - entry_dt).days if entry_dt else 0

                bill_item = {
                    'id': inv.id,
                    'bill_type': 'Purchase Invoice',
                    'bill_no': inv.invoice_no,
                    'bill_date': str(entry_dt) if entry_dt else '',
                    'total_amount': total_amt,
                    'settled_amount': round(settled_amt, 2),
                    'pending_amount': pending,
                    'overdue_days': max(0, days),
                }

                if slid not in ledger_map:
                    ledger_map[slid] = {
                        'ledger_id': slid,
                        'party_name': sname,
                        'account_group': gname,
                        'total_pending': 0.0,
                        'bills': [],
                    }

                ledger_map[slid]['bills'].append(bill_item)
                ledger_map[slid]['total_pending'] = round(ledger_map[slid]['total_pending'] + pending, 2)
        except Exception as e:
            print("Payables PurchaseInvoice error:", e)

        ledgers_list = list(ledger_map.values())
        ledgers_list.sort(key=lambda x: x['party_name'])
        total_outstanding = round(sum(l['total_pending'] for l in ledgers_list), 2)

        return Response({
            'total_outstanding': total_outstanding,
            'total_parties': len(ledgers_list),
            'ledgers': ledgers_list
        }, status=status.HTTP_200_OK)


class BalanceSheetAPIView(views.APIView):
    """
    Balance Sheet Report — Assets vs Liabilities as on a given date.
    Uses the same ledger-metrics pipeline as TrialBalanceAPIView but
    buckets groups into Assets / Liabilities and injects Net Profit/Loss
    from the P&L into the Capital Account.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            ensure_default_account_groups()
        except Exception:
            pass

        from datetime import datetime, date as date_type
        from .models import (
            AccountGroup, Ledger, JournalVoucherDetail, ReceiptVoucherDetail,
            PaymentVoucherDetail, ContraVoucherDetail, ServiceInvoice
        )

        as_on_date_str = request.query_params.get('as_on_date', None) or request.query_params.get('to_date', None)
        from_date_str  = request.query_params.get('from_date', None)
        show_zero     = request.query_params.get('show_zero', 'false').lower() == 'true'

        as_on_date = None
        if as_on_date_str:
            try:
                as_on_date = datetime.strptime(as_on_date_str, '%Y-%m-%d').date()
            except ValueError:
                pass
        if not as_on_date:
            as_on_date = date_type.today()

        to_date = as_on_date

        groups = AccountGroup.objects.all().order_by('sort_order', 'name')
        ledgers = Ledger.objects.select_related('accountGroup').all()

        # ── Build ledger_metrics ───────────────────────────────────────────────
        ledger_metrics = {}
        for l in ledgers:
            nature = (l.accountGroup.nature if l.accountGroup else 'Asset').capitalize()
            init_op = float(l.opening_balance or 0.0)
            op_type = l.opening_balance_type or ('Dr' if nature in ['Asset', 'Expense'] else 'Cr')
            ledger_metrics[l.id] = {
                'id': l.id,
                'name': l.name,
                'group_id': l.accountGroup_id,
                'group_name': l.accountGroup.name if l.accountGroup else 'Unassigned',
                'nature': nature,
                'opening_dr': init_op if op_type == 'Dr' else 0.0,
                'opening_cr': init_op if op_type == 'Cr' else 0.0,
                'period_dr': 0.0,
                'period_cr': 0.0,
            }

        def add_detail(detail_model):
            for d in detail_model.objects.select_related('voucher').all():
                lid = d.ledger_id
                if lid not in ledger_metrics:
                    continue
                vdate = parse_date_obj(getattr(d.voucher, 'voucher_date', None))
                if not vdate or vdate > to_date:
                    continue
                ledger_metrics[lid]['period_dr'] += float(d.debit_amount or 0.0)
                ledger_metrics[lid]['period_cr'] += float(d.credit_amount or 0.0)

        add_detail(JournalVoucherDetail)
        add_detail(ReceiptVoucherDetail)
        add_detail(PaymentVoucherDetail)
        add_detail(ContraVoucherDetail)

        for inv in ServiceInvoice.objects.prefetch_related('details').all():
            vdate = parse_date_obj(inv.invoice_date)
            if not vdate or vdate > to_date:
                continue
            if inv.customer_id in ledger_metrics:
                ledger_metrics[inv.customer_id]['period_dr'] += float(inv.net_amount or 0.0)
            for d in inv.details.all():
                if d.service_ledger_id in ledger_metrics:
                    ledger_metrics[d.service_ledger_id]['period_cr'] += float(d.amount or d.gross or 0.0)
            if inv.gst_ledger_1_id and inv.gst_ledger_1_id in ledger_metrics:
                ledger_metrics[inv.gst_ledger_1_id]['period_cr'] += float(inv.cgst or 0.0) + float(inv.igst or 0.0)
            if inv.gst_ledger_2_id and inv.gst_ledger_2_id in ledger_metrics:
                ledger_metrics[inv.gst_ledger_2_id]['period_cr'] += float(inv.sgst or 0.0)

        try:
            from purchase_app.models import PurchaseInvoice
            for inv in PurchaseInvoice.objects.select_related('purchase_ledger', 'supplier_ledger').all():
                vdate = parse_date_obj(inv.entry_date)
                if not vdate or vdate > to_date:
                    continue
                amt = float(inv.total_amount or 0.0)
                if inv.purchase_ledger_id and inv.purchase_ledger_id in ledger_metrics:
                    ledger_metrics[inv.purchase_ledger_id]['period_dr'] += amt
                if inv.supplier_ledger_id and inv.supplier_ledger_id in ledger_metrics:
                    ledger_metrics[inv.supplier_ledger_id]['period_cr'] += amt
        except Exception as e:
            print("BalanceSheet purchase_app PurchaseInvoice error:", e)

        try:
            from purchase_app.models import PurchaseReturn
            for ret in PurchaseReturn.objects.select_related('purchase_ledger', 'supplier_ledger').all():
                vdate = parse_date_obj(ret.entry_date)
                if not vdate or vdate > to_date:
                    continue
                amt = float(ret.total_amount or 0.0)
                if ret.purchase_ledger_id and ret.purchase_ledger_id in ledger_metrics:
                    ledger_metrics[ret.purchase_ledger_id]['period_cr'] += amt
                if ret.supplier_ledger_id and ret.supplier_ledger_id in ledger_metrics:
                    ledger_metrics[ret.supplier_ledger_id]['period_dr'] += amt
        except Exception as e:
            print("BalanceSheet purchase_app PurchaseReturn error:", e)

        try:
            from sales_app.models import SalesInvoice
            for inv in SalesInvoice.objects.select_related('sales_ledger', 'customer_ledger').all():
                vdate = parse_date_obj(inv.entry_date)
                if not vdate or vdate > to_date:
                    continue
                amt = float(inv.total_amount or 0.0)
                if inv.sales_ledger_id and inv.sales_ledger_id in ledger_metrics:
                    ledger_metrics[inv.sales_ledger_id]['period_cr'] += amt
                if inv.customer_ledger_id and inv.customer_ledger_id in ledger_metrics:
                    ledger_metrics[inv.customer_ledger_id]['period_dr'] += amt
        except Exception as e:
            print("BalanceSheet sales_app SalesInvoice error:", e)

        try:
            from sales_app.models import SalesReturn
            for ret in SalesReturn.objects.select_related('sales_ledger', 'customer_ledger').all():
                vdate = parse_date_obj(ret.entry_date)
                if not vdate or vdate > to_date:
                    continue
                amt = float(ret.total_amount or 0.0)
                if ret.sales_ledger_id and ret.sales_ledger_id in ledger_metrics:
                    ledger_metrics[ret.sales_ledger_id]['period_dr'] += amt
                if ret.customer_ledger_id and ret.customer_ledger_id in ledger_metrics:
                    ledger_metrics[ret.customer_ledger_id]['period_cr'] += amt
        except Exception as e:
            print("BalanceSheet sales_app SalesReturn error:", e)

        # ── Compute closing balances ───────────────────────────────────────────
        for m in ledger_metrics.values():
            net_op = m['opening_dr'] - m['opening_cr']
            m['opening_dr'] = round(max(net_op, 0.0), 2)
            m['opening_cr'] = round(max(-net_op, 0.0), 2)
            net_closing = (m['opening_dr'] - m['opening_cr']) + (m['period_dr'] - m['period_cr'])
            m['closing_dr'] = round(max(net_closing, 0.0), 2)
            m['closing_cr'] = round(max(-net_closing, 0.0), 2)
            m['period_dr'] = round(m['period_dr'], 2)
            m['period_cr'] = round(m['period_cr'], 2)

        # ── Compute Inventory Closing Stock Valuation ──────────────────────────
        closing_stock_val = 0.0
        try:
            from inventory_app.models import StockItem, StockTable
            for item in StockItem.objects.all():
                in_records = StockTable.objects.filter(item=item, is_active=True, movement_type='IN')
                total_in_qty = sum(float(r.quantity or 0.0) for r in in_records if float(r.quantity or 0.0) > 0)
                total_in_val = sum(float(r.quantity or 0.0) * float(r.rate or 0.0) for r in in_records if float(r.quantity or 0.0) > 0)
                avg_rate = (total_in_val / total_in_qty) if total_in_qty > 0 else float(item.opening_rate or item.mrp or 0.0)

                all_records = StockTable.objects.filter(item=item, is_active=True)
                cl_qty = 0.0
                for rec in all_records:
                    vdate = parse_date_obj(rec.date)
                    if not vdate or vdate <= to_date:
                        q = float(rec.quantity or 0.0)
                        if rec.movement_type == 'IN':
                            cl_qty += q
                        elif rec.movement_type == 'OUT':
                            cl_qty -= q
                cl_qty = max(cl_qty, 0.0)
                closing_stock_val += (cl_qty * avg_rate)
            closing_stock_val = round(closing_stock_val, 2)
        except Exception as e:
            print("BalanceSheet closing_stock calculation error:", e)

        # ── Determine Net Profit / Net Loss from income/expense ledgers ────────
        total_income = 0.0
        total_expense = 0.0
        for m in ledger_metrics.values():
            nature = m['nature'].lower()
            gname = m['group_name'].lower()
            if nature in ('income',) or 'income' in gname or 'sales' in gname:
                total_income += (m['closing_cr'] - m['closing_dr'])
            elif nature in ('expense',) or 'expense' in gname or 'purchase' in gname:
                total_expense += (m['closing_dr'] - m['closing_cr'])

        total_income += closing_stock_val

        net_profit = round(max(total_income - total_expense, 0.0), 2)
        net_loss = round(max(total_expense - total_income, 0.0), 2)

        # ── Build group tree (top-level only, Assets vs Liabilities) ──────────
        group_map = {}
        for g in groups:
            group_map[g.id] = {
                'id': g.id,
                'name': g.name,
                'parent_id': g.parent_id,
                'nature': g.nature,
                'amount': 0.0,
                'ledgers': [],
                'subgroups': [],
            }

        for m in ledger_metrics.values():
            gid = m['group_id']
            if gid and gid in group_map:
                ledger_entry = {
                    'id': m['id'],
                    'name': m['name'],
                    'closing_dr': m['closing_dr'],
                    'closing_cr': m['closing_cr'],
                    'amount': round(abs(m['closing_dr'] - m['closing_cr']), 2),
                }
                group_map[gid]['ledgers'].append(ledger_entry)

        # ── Attach subgroups ──────────────────────────────────────────────────
        for gid, gdict in list(group_map.items()):
            pid = gdict['parent_id']
            if pid and pid in group_map:
                group_map[pid]['subgroups'].append(gdict)

        def compute_group_totals(node):
            nname = (node['name'] or '').lower()
            if ('stock-in-hand' in nname or 'stock in hand' in nname) and closing_stock_val > 0:
                node['closing_dr'] = closing_stock_val
                node['closing_cr'] = 0.0
                node['net_balance'] = closing_stock_val
                node['amount'] = closing_stock_val
                return closing_stock_val, 0.0

            dr = sum(l['closing_dr'] for l in node['ledgers'])
            cr = sum(l['closing_cr'] for l in node['ledgers'])
            for sub in node['subgroups']:
                sub_dr, sub_cr = compute_group_totals(sub)
                dr += sub_dr
                cr += sub_cr
            node['closing_dr'] = round(dr, 2)
            node['closing_cr'] = round(cr, 2)
            node['net_balance'] = round(dr - cr, 2) # positive = Debit balance, negative = Credit balance
            node['amount'] = round(abs(dr - cr), 2)
            return dr, cr

        ALWAYS_KEEP_GROUPS = ['stock-in-hand', 'stock in hand', 'bank accounts', 'cash-in-hand', 'sundry debtors', 'sundry creditors']

        def filter_zero_nodes(node):
            if not show_zero:
                n_name = (node['name'] or '').lower()
                is_always_keep = any(k in n_name for k in ALWAYS_KEEP_GROUPS)

                # Filter zero-amount ledgers unless this node is an always-keep group
                if not is_always_keep:
                    node['ledgers'] = [l for l in node['ledgers'] if l['amount'] != 0.0 or l['closing_dr'] != 0.0 or l['closing_cr'] != 0.0]

                # Filter zero-amount subgroups recursively
                filtered_subs = []
                for sub in node['subgroups']:
                    filter_zero_nodes(sub)
                    s_name = (sub['name'] or '').lower()
                    sub_keep = any(k in s_name for k in ALWAYS_KEEP_GROUPS)
                    if sub['amount'] != 0.0 or sub['ledgers'] or sub['subgroups'] or sub_keep:
                        filtered_subs.append(sub)
                node['subgroups'] = filtered_subs

        for gdict in group_map.values():
            if gdict['parent_id'] is None:
                compute_group_totals(gdict)
                filter_zero_nodes(gdict)

        # ── Bucket into Assets / Liabilities per Dynamic Balance Rules ──────────
        # If Credit side is greater (net_balance < 0) -> Liabilities
        # If Debit side is greater (net_balance > 0) -> Assets
        liabilities = []
        assets = []

        OFFICIAL_BS_HEADS = [
            'capital account', 'loans (liability)', 'current liabilities', 
            'fixed assets', 'investments', 'current assets', 
            'misc. expenses (asset)', 'suspense a/c', 'cash and cash equivalents',
            'non current assets', 'non-current liabilities', 'branch / divisions'
        ]

        for gdict in group_map.values():
            if gdict['parent_id'] is not None:
                continue
            
            nature = (gdict['nature'] or '').lower()
            gname = (gdict['name'] or '').lower()
            
            # Exclude P&L groups (their net result is in net_profit / net_loss)
            if nature in ('income', 'expense') or any(k in gname for k in ['income', 'expense', 'sales accounts', 'purchase accounts', 'direct expenses', 'indirect expenses', 'direct incomes', 'indirect incomes']):
                continue

            # Must match standard Tally BS head
            if not any(h in gname for h in OFFICIAL_BS_HEADS):
                continue

            if not show_zero and gdict['amount'] == 0.0 and not gdict['ledgers'] and not gdict['subgroups']:
                continue
            
            # Dynamic Head Placement (Exact Tally Prime Behavior):
            # If Credit side is greater (net_balance < 0 / closing_cr > closing_dr) -> Liabilities side
            # If Debit side is greater (net_balance > 0 / closing_dr > closing_cr) -> Assets side
            if gdict['net_balance'] < 0:
                liabilities.append(gdict)
            elif gdict['net_balance'] > 0:
                assets.append(gdict)
            else:
                # If net_balance == 0, fallback to nature or group definition
                if nature == 'liability' or any(l in gname for l in ['capital account', 'loans (liability)', 'current liabilities', 'non-current liabilities']):
                    liabilities.append(gdict)
                else:
                    assets.append(gdict)

        LIABILITY_ORDER = ['capital account', 'loans (liability)', 'current liabilities', 'suspense a/c', 'branch / divisions', 'non-current liabilities']
        ASSET_ORDER = ['fixed assets', 'investments', 'current assets', 'misc. expenses (asset)', 'suspense a/c', 'branch / divisions', 'cash and cash equivalents', 'non current assets']

        def order_groups(lst, order):
            def key(g):
                n = g['name'].lower()
                for i, o in enumerate(order):
                    if o in n:
                        return i
                return 99
            return sorted(lst, key=key)

        liabilities = order_groups(liabilities, LIABILITY_ORDER)
        assets = order_groups(assets, ASSET_ORDER)

        # ── Compute Difference in Opening Balances (Tally Rule) ───────────────
        opening_diff = 0.0
        opening_diff_liab = 0.0
        opening_diff_asset = 0.0

        # On Liabilities side, Credit is positive (+), Debit is negative (-).
        # g['net_balance'] = Dr - Cr, so Credit amount = -g['net_balance'].
        liab_group_sum = sum(-g['net_balance'] for g in liabilities)

        # On Assets side, Debit is positive (+), Credit is negative (-).
        # g['net_balance'] = Dr - Cr, so Debit amount = g['net_balance'].
        asset_group_sum = sum(g['net_balance'] for g in assets)

        total_liabilities = round(liab_group_sum + net_profit, 2)
        total_assets = round(asset_group_sum + net_loss, 2)
        diff = round(abs(total_liabilities - total_assets), 2)
        is_balanced = diff <= 1.0

        company_name, company_address = get_company_name_and_address()

        return Response({
            'company_name': company_name,
            'company_address': company_address,
            'as_on_date': str(as_on_date),
            'liabilities': liabilities,
            'assets': assets,
            'net_profit': net_profit,
            'net_loss': net_loss,
            'opening_diff': opening_diff,
            'opening_diff_liab': opening_diff_liab,
            'opening_diff_asset': opening_diff_asset,
            'total_liabilities': total_liabilities,
            'total_assets': total_assets,
            'difference': diff,
            'is_balanced': is_balanced,
        }, status=status.HTTP_200_OK)


class DayBookAPIView(APIView):
    """
    Day Book API View
    Fetches all financial voucher transactions across all transaction models
    for a given date range (from_date to to_date).
    Fields returned: date, particulars, voucher_type, voucher_no, debit, credit
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from_date_str = request.query_params.get('from_date')
        to_date_str = request.query_params.get('to_date')
        voucher_type_filter = request.query_params.get('voucher_type')
        search_query = (request.query_params.get('search') or '').strip().lower()

        # Parse dates
        from_date = parse_date_obj(from_date_str) if from_date_str else None
        to_date = parse_date_obj(to_date_str) if to_date_str else None

        # If no dates provided, default to today
        if not from_date and not to_date:
            from_date = datetime.date.today()
            to_date = datetime.date.today()
        elif from_date and not to_date:
            to_date = from_date
        elif to_date and not from_date:
            from_date = to_date

        entries = []

        # Helper to check date range
        def in_date_range(v_date):
            if not v_date:
                return False
            d = parse_date_obj(v_date)
            if not d:
                return False
            if from_date and d < from_date:
                return False
            if to_date and d > to_date:
                return False
            return True

        # Helper to format date
        def fmt_date(v_date):
            d = parse_date_obj(v_date)
            return d.strftime('%Y-%m-%d') if d else ''

        # 1. Sales Invoices
        try:
            from sales_app.models import SalesInvoice
            qs = SalesInvoice.objects.select_related('customer_ledger').all()
            for inv in qs:
                vdate = getattr(inv, 'entry_date', None) or getattr(inv, 'date', None)
                if not in_date_range(vdate):
                    continue
                vtype = 'Sales Invoice'
                if voucher_type_filter and voucher_type_filter.lower() != 'all' and voucher_type_filter.lower() != vtype.lower():
                    continue
                vno = getattr(inv, 'invoice_no', None) or getattr(inv, 'invoice_number', None) or getattr(inv, 'voucher_number', None) or str(inv.id)
                particulars = inv.customer_ledger.name if inv.customer_ledger else 'Sales Party'
                amt = float(getattr(inv, 'grand_total', 0.0) or getattr(inv, 'total_amount', 0.0) or 0.0)
                
                entries.append({
                    'id': f'sales_inv_{inv.id}',
                    'date': fmt_date(vdate),
                    'particulars': particulars,
                    'voucher_type': vtype,
                    'voucher_no': vno,
                    'debit': round(amt, 2),
                    'credit': 0.0,
                })
        except Exception as e:
            logger.error(f"DayBook SalesInvoice error: {e}")

        # 2. Sales Returns
        try:
            from sales_app.models import SalesReturn
            qs = SalesReturn.objects.select_related('customer_ledger').all()
            for ret in qs:
                vdate = getattr(ret, 'entry_date', None) or getattr(ret, 'date', None)
                if not in_date_range(vdate):
                    continue
                vtype = 'Sales Return'
                if voucher_type_filter and voucher_type_filter.lower() != 'all' and voucher_type_filter.lower() != vtype.lower():
                    continue
                vno = getattr(ret, 'return_no', None) or getattr(ret, 'return_number', None) or getattr(ret, 'voucher_number', None) or str(ret.id)
                particulars = ret.customer_ledger.name if ret.customer_ledger else 'Sales Return Party'
                amt = float(getattr(ret, 'grand_total', 0.0) or getattr(ret, 'total_amount', 0.0) or 0.0)

                entries.append({
                    'id': f'sales_ret_{ret.id}',
                    'date': fmt_date(vdate),
                    'particulars': particulars,
                    'voucher_type': vtype,
                    'voucher_no': vno,
                    'debit': 0.0,
                    'credit': round(amt, 2),
                })
        except Exception as e:
            logger.error(f"DayBook SalesReturn error: {e}")

        # 3. Purchase Invoices
        try:
            from purchase_app.models import PurchaseInvoice
            qs = PurchaseInvoice.objects.select_related('supplier_ledger').all()
            for inv in qs:
                vdate = getattr(inv, 'invoice_date', None) or getattr(inv, 'entry_date', None) or getattr(inv, 'date', None)
                if not in_date_range(vdate):
                    continue
                vtype = 'Purchase Invoice'
                if voucher_type_filter and voucher_type_filter.lower() != 'all' and voucher_type_filter.lower() != vtype.lower():
                    continue
                vno = getattr(inv, 'invoice_no', None) or getattr(inv, 'invoice_number', None) or getattr(inv, 'voucher_number', None) or str(inv.id)
                particulars = inv.supplier_ledger.name if inv.supplier_ledger else 'Supplier Party'
                amt = float(getattr(inv, 'grand_total', 0.0) or getattr(inv, 'total_amount', 0.0) or 0.0)

                entries.append({
                    'id': f'purch_inv_{inv.id}',
                    'date': fmt_date(vdate),
                    'particulars': particulars,
                    'voucher_type': vtype,
                    'voucher_no': vno,
                    'debit': 0.0,
                    'credit': round(amt, 2),
                })
        except Exception as e:
            logger.error(f"DayBook PurchaseInvoice error: {e}")

        # 4. Purchase Returns
        try:
            from purchase_app.models import PurchaseReturn
            qs = PurchaseReturn.objects.select_related('supplier_ledger').all()
            for ret in qs:
                vdate = getattr(ret, 'return_date', None) or getattr(ret, 'entry_date', None) or getattr(ret, 'date', None)
                if not in_date_range(vdate):
                    continue
                vtype = 'Purchase Return'
                if voucher_type_filter and voucher_type_filter.lower() != 'all' and voucher_type_filter.lower() != vtype.lower():
                    continue
                vno = getattr(ret, 'return_no', None) or getattr(ret, 'return_number', None) or getattr(ret, 'voucher_number', None) or str(ret.id)
                particulars = ret.supplier_ledger.name if ret.supplier_ledger else 'Purchase Return Supplier'
                amt = float(getattr(ret, 'grand_total', 0.0) or getattr(ret, 'total_amount', 0.0) or 0.0)

                entries.append({
                    'id': f'purch_ret_{ret.id}',
                    'date': fmt_date(vdate),
                    'particulars': particulars,
                    'voucher_type': vtype,
                    'voucher_no': vno,
                    'debit': round(amt, 2),
                    'credit': 0.0,
                })
        except Exception as e:
            logger.error(f"DayBook PurchaseReturn error: {e}")

        # 5. Service Invoices
        try:
            qs = ServiceInvoice.objects.select_related('customer').all()
            for inv in qs:
                vdate = getattr(inv, 'invoice_date', None) or getattr(inv, 'entry_date', None)
                if not in_date_range(vdate):
                    continue
                vtype = 'Service Invoice'
                if voucher_type_filter and voucher_type_filter.lower() != 'all' and voucher_type_filter.lower() != vtype.lower():
                    continue
                vno = getattr(inv, 'invoice_no', None) or getattr(inv, 'invoice_number', None) or str(inv.id)
                particulars = inv.customer.name if inv.customer else 'Service Customer'
                amt = float(getattr(inv, 'total_amount', 0.0) or 0.0)

                entries.append({
                    'id': f'serv_inv_{inv.id}',
                    'date': fmt_date(vdate),
                    'particulars': particulars,
                    'voucher_type': vtype,
                    'voucher_no': vno,
                    'debit': round(amt, 2),
                    'credit': 0.0,
                })
        except Exception as e:
            logger.error(f"DayBook ServiceInvoice error: {e}")

        # 6. Journal Vouchers
        try:
            from finance_app.models import JournalVoucherDetail
            qs = JournalVoucherDetail.objects.select_related('voucher', 'ledger').all()
            for d in qs:
                jv = d.voucher
                if not jv:
                    continue
                vdate = getattr(jv, 'voucher_date', None) or getattr(jv, 'entry_date', None)
                if not in_date_range(vdate):
                    continue
                vtype = 'Journal'
                if voucher_type_filter and voucher_type_filter.lower() != 'all' and voucher_type_filter.lower() != vtype.lower():
                    continue
                vno = getattr(jv, 'voucher_no', None) or getattr(jv, 'voucher_number', None) or str(jv.id)
                particulars = d.ledger.name if d.ledger else 'Journal Ledger'
                dr_amt = float(d.debit_amount or 0.0)
                cr_amt = float(d.credit_amount or 0.0)

                entries.append({
                    'id': f'jv_{d.id}',
                    'date': fmt_date(vdate),
                    'particulars': particulars,
                    'voucher_type': vtype,
                    'voucher_no': vno,
                    'debit': round(dr_amt, 2),
                    'credit': round(cr_amt, 2),
                })
        except Exception as e:
            logger.error(f"DayBook JournalVoucher error: {e}")

        # 7. Receipt Vouchers
        try:
            from finance_app.models import ReceiptVoucherDetail
            qs = ReceiptVoucherDetail.objects.select_related('voucher', 'ledger').all()
            for d in qs:
                rv = d.voucher
                if not rv:
                    continue
                vdate = getattr(rv, 'voucher_date', None) or getattr(rv, 'entry_date', None)
                if not in_date_range(vdate):
                    continue
                vtype = 'Receipt'
                if voucher_type_filter and voucher_type_filter.lower() != 'all' and voucher_type_filter.lower() != vtype.lower():
                    continue
                vno = getattr(rv, 'voucher_no', None) or getattr(rv, 'voucher_number', None) or str(rv.id)
                particulars = d.ledger.name if d.ledger else (rv.cash_bank_ledger.name if getattr(rv, 'cash_bank_ledger', None) else 'Receipt Party')
                amt = float(getattr(d, 'amount', 0.0) or 0.0)

                entries.append({
                    'id': f'rv_{d.id}',
                    'date': fmt_date(vdate),
                    'particulars': particulars,
                    'voucher_type': vtype,
                    'voucher_no': vno,
                    'debit': 0.0,
                    'credit': round(amt, 2),
                })
        except Exception as e:
            logger.error(f"DayBook ReceiptVoucher error: {e}")

        # 8. Payment Vouchers
        try:
            from finance_app.models import PaymentVoucherDetail
            qs = PaymentVoucherDetail.objects.select_related('voucher', 'ledger').all()
            for d in qs:
                pv = d.voucher
                if not pv:
                    continue
                vdate = getattr(pv, 'voucher_date', None) or getattr(pv, 'entry_date', None)
                if not in_date_range(vdate):
                    continue
                vtype = 'Payment'
                if voucher_type_filter and voucher_type_filter.lower() != 'all' and voucher_type_filter.lower() != vtype.lower():
                    continue
                vno = getattr(pv, 'voucher_no', None) or getattr(pv, 'voucher_number', None) or str(pv.id)
                particulars = d.ledger.name if d.ledger else (pv.cash_bank_ledger.name if getattr(pv, 'cash_bank_ledger', None) else 'Payment Party')
                amt = float(getattr(d, 'amount', 0.0) or 0.0)

                entries.append({
                    'id': f'pv_{d.id}',
                    'date': fmt_date(vdate),
                    'particulars': particulars,
                    'voucher_type': vtype,
                    'voucher_no': vno,
                    'debit': round(amt, 2),
                    'credit': 0.0,
                })
        except Exception as e:
            logger.error(f"DayBook PaymentVoucher error: {e}")

        # 9. Contra Vouchers
        try:
            from finance_app.models import ContraVoucherDetail
            qs = ContraVoucherDetail.objects.select_related('voucher', 'ledger').all()
            for d in qs:
                cv = d.voucher
                if not cv:
                    continue
                vdate = getattr(cv, 'voucher_date', None) or getattr(cv, 'entry_date', None)
                if not in_date_range(vdate):
                    continue
                vtype = 'Contra'
                if voucher_type_filter and voucher_type_filter.lower() != 'all' and voucher_type_filter.lower() != vtype.lower():
                    continue
                vno = getattr(cv, 'voucher_no', None) or getattr(cv, 'voucher_number', None) or str(cv.id)
                particulars = d.ledger.name if d.ledger else 'Contra Account'
                dr_amt = float(getattr(d, 'debit_amount', 0.0) or 0.0)
                cr_amt = float(getattr(d, 'credit_amount', 0.0) or 0.0)
                
                if dr_amt == 0.0 and cr_amt == 0.0:
                    amt = float(getattr(d, 'amount', 0.0) or 0.0)
                    dr_amt = amt

                entries.append({
                    'id': f'cv_{d.id}',
                    'date': fmt_date(vdate),
                    'particulars': particulars,
                    'voucher_type': vtype,
                    'voucher_no': vno,
                    'debit': round(dr_amt, 2),
                    'credit': round(cr_amt, 2),
                })
        except Exception as e:
            logger.error(f"DayBook ContraVoucher error: {e}")

        # 10. Manufactural Journals
        try:
            from finance_app.models import ManufacturalJournal
            qs = ManufacturalJournal.objects.select_related('manufactural_journal_type').prefetch_related('details__stock_item').all()
            for mj in qs:
                vdate = getattr(mj, 'journal_date', None) or getattr(mj, 'entry_date', None)
                if not in_date_range(vdate):
                    continue
                vtype = 'Manufactural Journal'
                if voucher_type_filter and voucher_type_filter.lower() != 'all' and voucher_type_filter.lower() != vtype.lower():
                    continue
                vno = getattr(mj, 'journal_no', None) or str(mj.id)

                details_list = list(mj.details.all())
                prod_items = [d.stock_item.name for d in details_list if d.stock_item and d.entry_type == 'IN']
                cons_items = [d.stock_item.name for d in details_list if d.stock_item and d.entry_type == 'OUT']

                type_name = mj.manufactural_journal_type.manufactural_journal_type if mj.manufactural_journal_type else ''
                if prod_items:
                    particulars = f"{', '.join(prod_items)} ({type_name})" if type_name else ', '.join(prod_items)
                elif cons_items:
                    particulars = f"{', '.join(cons_items)} ({type_name})" if type_name else ', '.join(cons_items)
                else:
                    particulars = type_name or 'Manufactural Journal'

                dr_amt = sum(float(d.amount or 0.0) for d in details_list if d.entry_type == 'IN')
                cr_amt = sum(float(d.amount or 0.0) for d in details_list if d.entry_type == 'OUT')
                if dr_amt == 0.0 and cr_amt == 0.0:
                    dr_amt = sum(float(d.amount or 0.0) for d in details_list)

                entries.append({
                    'id': f'mj_{mj.id}',
                    'date': fmt_date(vdate),
                    'particulars': particulars,
                    'voucher_type': vtype,
                    'voucher_no': vno,
                    'debit': round(dr_amt, 2),
                    'credit': round(cr_amt, 2),
                })
        except Exception as e:
            logger.error(f"DayBook ManufacturalJournal error: {e}")

        # 11. Stock Journals
        try:
            from finance_app.models import StockJournal
            qs = StockJournal.objects.select_related('stock_journal_type').prefetch_related('details__stock_item').all()
            for sj in qs:
                vdate = getattr(sj, 'journal_date', None) or getattr(sj, 'entry_date', None)
                if not in_date_range(vdate):
                    continue
                vtype = 'Stock Journal'
                if voucher_type_filter and voucher_type_filter.lower() != 'all' and voucher_type_filter.lower() != vtype.lower():
                    continue
                vno = getattr(sj, 'journal_no', None) or str(sj.id)

                details_list = list(sj.details.all())
                prod_items = [d.stock_item.name for d in details_list if d.stock_item and d.entry_type == 'IN']
                cons_items = [d.stock_item.name for d in details_list if d.stock_item and d.entry_type == 'OUT']

                type_name = sj.stock_journal_type.stock_journal_type if sj.stock_journal_type else ''
                if prod_items:
                    particulars = f"{', '.join(prod_items)} ({type_name})" if type_name else ', '.join(prod_items)
                elif cons_items:
                    particulars = f"{', '.join(cons_items)} ({type_name})" if type_name else ', '.join(cons_items)
                else:
                    particulars = type_name or 'Stock Journal'

                dr_amt = sum(float(d.amount or 0.0) for d in details_list if d.entry_type == 'IN')
                cr_amt = sum(float(d.amount or 0.0) for d in details_list if d.entry_type == 'OUT')
                if dr_amt == 0.0 and cr_amt == 0.0:
                    dr_amt = sum(float(d.amount or 0.0) for d in details_list)

                entries.append({
                    'id': f'sj_{sj.id}',
                    'date': fmt_date(vdate),
                    'particulars': particulars,
                    'voucher_type': vtype,
                    'voucher_no': vno,
                    'debit': round(dr_amt, 2),
                    'credit': round(cr_amt, 2),
                })
        except Exception as e:
            logger.error(f"DayBook StockJournal error: {e}")

        # Apply search filter if provided
        if search_query:
            entries = [
                e for e in entries
                if search_query in str(e.get('particulars') or '').lower()
                or search_query in str(e.get('voucher_no') or '').lower()
                or search_query in str(e.get('voucher_type') or '').lower()
                or search_query in str(e.get('date') or '').lower()
            ]

        # Sort entries by date descending, then voucher_no
        entries.sort(key=lambda x: (x['date'], x['voucher_no']), reverse=True)

        total_debit = round(sum(e['debit'] for e in entries), 2)
        total_credit = round(sum(e['credit'] for e in entries), 2)

        company_info = {
            'name': '',
            'display_name': '',
            'address': '',
            'phone': '',
            'email': '',
            'gst_no': '',
            'pan_no': '',
            'website': '',
        }
        try:
            from settings_app.models import Company, CompanyAddress, CompanyContact
            comp = Company.objects.first()
            if comp:
                company_info['name'] = comp.name or ''
                company_info['display_name'] = comp.display_name or comp.name or ''
                company_info['gst_no'] = comp.gst_no or ''
                company_info['pan_no'] = getattr(comp, 'pan_no', '') or ''
                company_info['website'] = getattr(comp, 'website', '') or ''
                
                addr = CompanyAddress.objects.filter(company=comp).first()
                if addr:
                    lines = [l for l in [addr.address_line_1, addr.address_line_2, addr.city, addr.state, addr.pincode, addr.country] if l]
                    company_info['address'] = ', '.join(lines)
                    
                contact = CompanyContact.objects.filter(company=comp).first()
                if contact:
                    company_info['phone'] = contact.phone or contact.mobile or ''
                    company_info['email'] = contact.email or contact.support_email or ''
        except Exception as e:
            logger.error(f"Error fetching company details: {e}")

        total_entries = len(entries)

        # Pagination support if query param 'page' is provided
        page_param = request.query_params.get('page')
        page_size_param = request.query_params.get('page_size')

        response_entries = entries
        extra_pagination_data = {}

        if page_param:
            try:
                page = max(1, int(page_param))
                page_size = max(1, int(page_size_param or 25))
                total_pages = (total_entries + page_size - 1) // page_size if total_entries > 0 else 1
                start_idx = (page - 1) * page_size
                end_idx = start_idx + page_size
                response_entries = entries[start_idx:end_idx]

                extra_pagination_data = {
                    'page': page,
                    'page_size': page_size,
                    'total_pages': total_pages,
                }
            except (ValueError, TypeError):
                pass

        return Response({
            'company_name': company_info['display_name'],
            'company': company_info,
            'from_date': str(from_date),
            'to_date': str(to_date),
            'total_entries': total_entries,
            'total_debit': total_debit,
            'total_credit': total_credit,
            'entries': response_entries,
            **extra_pagination_data
        }, status=status.HTTP_200_OK)



class DashboardAPIView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Sum
        from django.utils import timezone
        from datetime import timedelta
        from decimal import Decimal
        from .models import Ledger, JournalVoucher, ReceiptVoucher, PaymentVoucher, ContraVoucher, ServiceInvoice, ReceiptVoucherDetail, PaymentVoucherDetail, JournalVoucherDetail, ContraVoucherDetail

        today = timezone.now().date()

        # 1. KPIs
        income_ledgers = Ledger.objects.filter(accountGroup__nature='Income')
        expense_ledgers = Ledger.objects.filter(accountGroup__nature='Expense')
        
        total_income = sum(-l.closing_balance for l in income_ledgers)
        total_expense = sum(l.closing_balance for l in expense_ledgers)
        
        # Sales / Capital Expenditure
        sales_ledgers = Ledger.objects.filter(accountGroup__name='Sales Accounts')
        total_sale = sum(-l.closing_balance for l in sales_ledgers)
        
        capex_ledgers = Ledger.objects.filter(accountGroup__name='Fixed Assets')
        total_capex = sum(l.closing_balance for l in capex_ledgers)

        # 2. Operating Accounts (Bank Accounts & Cash)
        operating_ledgers = Ledger.objects.filter(
            accountGroup__name__in=['Bank Accounts', 'Cash-in-hand']
        )
        operating_accounts = []
        total_liquid = 0
        for l in operating_ledgers:
            total_liquid += l.closing_balance
            bank_detail = l.bank_details.first()
            acct_info = f"Bank Account" if l.accountGroup.name == 'Bank Accounts' else "Cash Account"
            if bank_detail and bank_detail.bank_account_no:
                acct_info = f"{bank_detail.bank_name or 'Bank'} •••• {str(bank_detail.bank_account_no)[-4:]}"
            
            operating_accounts.append({
                'id': l.id,
                'name': l.name,
                'type': acct_info,
                'balance': float(l.closing_balance)
            })

        expense_days = request.query_params.get('expenseDays', 'all')
        
        if expense_days != 'all':
            try:
                days = int(expense_days)
                start_date = today - timedelta(days=days)
            except ValueError:
                days = None
                start_date = None
        else:
            days = None
            start_date = None

        # 3. Expense Breakdown
        expense_breakdown = []
        groups = {}
        
        if start_date:
            # Aggregate from payment vouchers for expense ledgers
            expenses_qs = PaymentVoucherDetail.objects.filter(
                voucher__voucher_date__gte=start_date,
                ledger__in=expense_ledgers
            ).values('ledger__accountGroup__name').annotate(total=Sum('debit_amount'))
            
            for e in expenses_qs:
                g_name = e['ledger__accountGroup__name'] or 'Other'
                groups[g_name] = groups.get(g_name, 0) + (e['total'] or 0)
        else:
            for l in expense_ledgers:
                g_name = l.accountGroup.name if l.accountGroup else 'Other'
                groups[g_name] = groups.get(g_name, 0) + l.closing_balance
        
        for k, v in groups.items():
            if v > 0:
                expense_breakdown.append({'name': k, 'value': float(v)})
        expense_breakdown = sorted(expense_breakdown, key=lambda x: x['value'], reverse=True)[:4]

        # 3b. Income Breakdown
        income_breakdown = []
        inc_groups = {}
        
        if start_date:
            incomes_qs = ReceiptVoucherDetail.objects.filter(
                voucher__voucher_date__gte=start_date,
                ledger__in=income_ledgers
            ).values('ledger__accountGroup__name').annotate(total=Sum('credit_amount'))
            
            for e in incomes_qs:
                g_name = e['ledger__accountGroup__name'] or 'Other'
                inc_groups[g_name] = inc_groups.get(g_name, 0) + (e['total'] or 0)
        else:
            for l in income_ledgers:
                g_name = l.accountGroup.name if l.accountGroup else 'Other'
                inc_groups[g_name] = inc_groups.get(g_name, 0) + (-l.closing_balance)
        
        for k, v in inc_groups.items():
            if v > 0:
                income_breakdown.append({'name': k, 'value': float(v)})
        income_breakdown = sorted(income_breakdown, key=lambda x: x['value'], reverse=True)[:4]

        # 3c. Receivables and Payables
        receivables_ledgers = Ledger.objects.filter(accountGroup__name__icontains='Debtor')
        payables_ledgers = Ledger.objects.filter(accountGroup__name__icontains='Creditor')
        
        total_receivables = sum(l.closing_balance for l in receivables_ledgers)
        total_payables = sum(-l.closing_balance for l in payables_ledgers)

        top_debtors = [{'name': l.name, 'value': float(l.closing_balance)} for l in receivables_ledgers.order_by('-closing_balance')[:5]]
        top_creditors = [{'name': l.name, 'value': float(-l.closing_balance)} for l in payables_ledgers.order_by('closing_balance')[:5]]

        # 4. Cashflow Trends
        cashflow = {'dates': [], 'inflow': [], 'outflow': [], 'net_profit': []}
        
        days_filter = int(request.query_params.get('days', 7))
        cf_start_date = today - timedelta(days=days_filter - 1)
        
        target_groups = ['Bank Accounts', 'Cash-in-hand']
        voucher_models = [ReceiptVoucherDetail, PaymentVoucherDetail, JournalVoucherDetail, ContraVoucherDetail]
        
        for i in range(days_filter):
            d = cf_start_date + timedelta(days=i)
            date_label = d.strftime('%d %b') if days_filter > 7 else d.strftime('%a')
            cashflow['dates'].append(date_label)
            
            inflow = 0
            outflow = 0
            
            for model in voucher_models:
                qs = model.objects.filter(
                    voucher__voucher_date=d,
                    ledger__accountGroup__name__in=target_groups
                ).aggregate(total_debit=Sum('debit_amount'), total_credit=Sum('credit_amount'))
                
                inflow += qs['total_debit'] or 0
                outflow += qs['total_credit'] or 0
            
            cashflow['inflow'].append(float(inflow))
            cashflow['outflow'].append(float(outflow))
            cashflow['net_profit'].append(float(inflow) - float(outflow))

        # 5. Recent Activities
        recent_activities = []
        recent_receipts = ReceiptVoucher.objects.order_by('-created_at')[:3]
        recent_payments = PaymentVoucher.objects.order_by('-created_at')[:3]
        recent_journals = JournalVoucher.objects.order_by('-created_at')[:3]
        
        all_recent = sorted(
            list(recent_receipts) + list(recent_payments) + list(recent_journals),
            key=lambda x: x.created_at,
            reverse=True
        )[:5]
        
        for v in all_recent:
            v_type = 'Receipt' if isinstance(v, ReceiptVoucher) else ('Payment' if isinstance(v, PaymentVoucher) else 'Journal')
            amt = 0
            if v_type == 'Receipt':
                amt = v.details.aggregate(Sum('credit_amount'))['credit_amount__sum'] or 0
            elif v_type == 'Payment':
                amt = v.details.aggregate(Sum('debit_amount'))['debit_amount__sum'] or 0
            elif v_type == 'Journal':
                amt = v.details.aggregate(Sum('debit_amount'))['debit_amount__sum'] or 0
                
            recent_activities.append({
                'id': v.id,
                'type': v_type,
                'desc': f"{v_type} Voucher {v.voucher_no}",
                'date': v.created_at.strftime('%Y-%m-%d %H:%M'),
                'amount': float(amt)
            })

        data = {
            'kpis': {
                'income': float(total_income),
                'expense': float(total_expense),
                'sale': float(total_sale),
                'capex': float(total_capex)
            },
            'cashflow': cashflow,
            'expenseBreakdown': expense_breakdown,
            'incomeBreakdown': income_breakdown,
            'operatingAccounts': operating_accounts,
            'totalLiquid': float(total_liquid),
            'recentActivities': recent_activities,
            'totalReceivables': float(total_receivables),
            'totalPayables': float(total_payables),
            'topDebtors': top_debtors,
            'topCreditors': top_creditors,
        }

        return Response(data, status=status.HTTP_200_OK)

