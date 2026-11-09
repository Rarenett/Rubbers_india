from datetime import date, datetime
from decimal import Decimal
from django.db import models, transaction
from django.utils import timezone
from rest_framework import viewsets, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action

from .models import (
    WalletMaster,
    WalletTransaction,
    WalletOwnerType,
    WalletScheme,
    WalletSchemeCriteria,
    WalletCriteriaValue,
    WalletReason,
    WalletPointsEntry,
    WalletWorkingSettings,
    EmployeeWorkingStatus,
    WorkingStatusHistory,
    WorkingSession,
    WorkingBreak,
    InactivityEvent,
    ScreenshotSchedule,
    ScreenshotExecution,
    ScreenshotAgentHeartbeat,
    get_wallet_local_date,
    get_wallet_local_time,
    get_wallet_local_datetime,
)
from .serializers import (
    WalletMasterSerializer,
    WalletTransactionSerializer,
    WalletOwnerTypeSerializer,
    WalletSchemeSerializer,
    WalletSchemeCriteriaSerializer,
    WalletCriteriaValueSerializer,
    WalletReasonSerializer,
    WalletPointsEntrySerializer,
    WalletWorkingSettingsSerializer,
    EmployeeWorkingStatusSerializer,
    WorkingStatusHistorySerializer,
    WorkingBreakSerializer,
    WorkingSessionSerializer,
    InactivityEventSerializer,
    ScreenshotScheduleSerializer,
    ScreenshotExecutionSerializer,
    ApplyAllSerializer,
)


class WalletMasterViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for Wallet Master records.
    """
    queryset = WalletMaster.objects.all().order_by('-id')
    serializer_class = WalletMasterSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['wallet_code', 'wallet_name', 'owner_id', 'remarks']

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param in ['Active', 'Inactive']:
            qs = qs.filter(status=status_param)
        owner_type_param = self.request.query_params.get('owner_type')
        if owner_type_param:
            qs = qs.filter(owner_type=owner_type_param)
        return qs

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(created_by=user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        
        # Protect against deletion if points entries exist
        pts_count = instance.points_entries.count()
        if pts_count > 0:
            return Response(
                {
                    "error": (
                        f"Cannot delete wallet '{instance.wallet_name}' because it is connected to "
                        f"{pts_count} Points Entry record(s). "
                        "Wallets connected to points entries cannot be deleted to preserve ledger integrity. "
                        "Please deactivate the wallet instead if it is no longer in use."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Protect against deletion if financial transactions exist
        txn_count = instance.transactions.count()
        if txn_count > 0:
            return Response(
                {
                    "error": (
                        f"Cannot delete wallet '{instance.wallet_name}' because it has "
                        f"{txn_count} associated financial transaction(s). "
                        "Please deactivate the wallet instead to preserve audit history."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            return super().destroy(request, *args, **kwargs)
        except models.ProtectedError:
            return Response(
                {
                    "error": f"Cannot delete wallet '{instance.wallet_name}' because it is referenced by other connected records."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'], url_path='active')
    def active_wallets(self, request):
        """
        Return list of active wallets for transaction dropdowns.
        Optionally filters by owner_type if provided (e.g. Employee, Vendor, Distributor).
        """
        active_qs = WalletMaster.objects.filter(status='Active')
        owner_type_param = request.query_params.get('owner_type')
        if owner_type_param:
            norm = owner_type_param.strip().lower()
            if norm in ['distributor', 'distributors']:
                active_qs = active_qs.filter(owner_type__in=['Distributor', 'Distributors'])
            elif norm in ['vendor', 'vendors']:
                active_qs = active_qs.filter(owner_type__in=['Vendor', 'Vendors'])
            elif norm in ['employee', 'employees']:
                active_qs = active_qs.filter(owner_type__in=['Employee', 'Employees'])
            else:
                active_qs = active_qs.filter(owner_type__iexact=owner_type_param.strip())
        active_qs = active_qs.order_by('wallet_name')
        serializer = self.get_serializer(active_qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='next-code')
    def next_code(self, request):
        """
        Generate next sequential unique wallet code: WLT-XXXXX (e.g. WLT-00001).
        Thread-safe check against database to prevent collisions.
        """
        prefix = 'WLT-'
        wallets = WalletMaster.objects.filter(wallet_code__startswith=prefix).values_list('wallet_code', flat=True)
        max_num = 0
        for code in wallets:
            try:
                num_part = code.split('-')[-1]
                num = int(num_part)
                if num > max_num:
                    max_num = num
            except (ValueError, IndexError):
                pass
        
        next_num = max_num + 1
        generated_code = f"{prefix}{next_num:05d}"
        while WalletMaster.objects.filter(wallet_code=generated_code).exists():
            next_num += 1
            generated_code = f"{prefix}{next_num:05d}"

        return Response({'next_code': generated_code})

    @action(detail=False, methods=['get'], url_path='owners')
    def get_owners(self, request):
        """
        Retrieve existing records for Employee, Vendor, or Distributor.
        Returns array of { id, record_id, owner_id, name, mobile, email, has_wallet }.
        """
        owner_type = request.query_params.get('owner_type', '').strip()
        owner_type_norm = owner_type.lower()
        results = []

        if owner_type_norm == 'employee':
            from rarenett_app.models import Employee
            qs = Employee.objects.select_related(
                'user',
                'candidate',
                'dept_designation__department',
                'candidate__department_applied'
            ).all().order_by('id')
            existing_wallet_owner_ids = set(
                WalletMaster.objects.filter(owner_type__iexact='Employee').values_list('owner_id', flat=True)
            )
            for emp in qs:
                # Determine display name
                if emp.user:
                    name = emp.user.get_full_name() or emp.user.username
                elif emp.candidate:
                    name = emp.candidate.first_name + (f" {emp.candidate.last_name}" if emp.candidate.last_name else "")
                else:
                    name = f"Employee #{emp.id}"
                
                # Determine Employee Code
                emp_code = None
                if emp.candidate and hasattr(emp.candidate, 'employment_details') and emp.candidate.employment_details.exists():
                    emp_code = emp.candidate.employment_details.first().employment_no
                if not emp_code:
                    emp_code = f"EMP-{emp.id:04d}"

                # Determine Department Name
                department_name = None
                if emp.dept_designation and emp.dept_designation.department:
                    department_name = emp.dept_designation.department.name
                elif emp.candidate and emp.candidate.department_applied:
                    department_name = emp.candidate.department_applied.name

                mobile = emp.phone or getattr(emp, 'mobile_number', '') or ''
                email = emp.email or (emp.user.email if emp.user else '') or ''

                results.append({
                    'record_id': emp.id,
                    'owner_id': emp_code,
                    'name': name,
                    'department': department_name,
                    'mobile': mobile,
                    'email': email,
                    'has_wallet': emp_code in existing_wallet_owner_ids,
                })

        elif owner_type_norm == 'vendor':
            from finance_app.models import Ledger
            from django.db.models import Q
            qs = Ledger.objects.filter(
                Q(accountGroup__name__iexact='Sundry Creditors') |
                Q(accountGroup__parent__name__iexact='Sundry Creditors')
            ).select_related('accountGroup').prefetch_related('contact_details').order_by('name')

            existing_wallet_owner_ids = set(
                WalletMaster.objects.filter(owner_type__iexact='Vendor').values_list('owner_id', flat=True)
            )
            for ldg in qs:
                code = f"VND-{ldg.id:04d}"
                # Contact info fallback: Ledger phone/email or first contact_details
                primary_contact = ldg.contact_details.first()
                mobile = ldg.phone or (primary_contact.primary_mobile if primary_contact else '') or (primary_contact.phone_no if primary_contact else '') or ''
                email = ldg.email or (primary_contact.email if primary_contact else '') or ''

                results.append({
                    'record_id': ldg.id,
                    'owner_id': code,
                    'name': ldg.name,
                    'company_name': ldg.accountGroup.name if ldg.accountGroup else 'Sundry Creditors',
                    'contact_person': primary_contact.contact_name if primary_contact and primary_contact.contact_name else '',
                    'mobile': mobile or '',
                    'email': email or '',
                    'has_wallet': code in existing_wallet_owner_ids,
                })

        elif owner_type_norm in ['distributor', 'distributors']:
            from finance_app.models import Ledger
            from django.db.models import Q
            qs = Ledger.objects.filter(
                Q(accountGroup__name__iexact='Sundry Debtors') |
                Q(accountGroup__parent__name__iexact='Sundry Debtors')
            ).select_related('accountGroup').prefetch_related('contact_details').order_by('name')

            existing_wallet_owner_ids = set(
                WalletMaster.objects.filter(owner_type__iregex=r'^distributor(s)?$').values_list('owner_id', flat=True)
            )
            for ldg in qs:
                code = f"DST-{ldg.id:04d}"
                # Contact info fallback: Ledger phone/email or first contact_details
                primary_contact = ldg.contact_details.first()
                mobile = ldg.phone or (primary_contact.primary_mobile if primary_contact else '') or (primary_contact.phone_no if primary_contact else '') or ''
                email = ldg.email or (primary_contact.email if primary_contact else '') or ''

                results.append({
                    'record_id': ldg.id,
                    'owner_id': code,
                    'name': ldg.name,
                    'company_name': ldg.accountGroup.name if ldg.accountGroup else 'Sundry Debtors',
                    'contact_person': primary_contact.contact_name if primary_contact and primary_contact.contact_name else '',
                    'mobile': mobile or '',
                    'email': email or '',
                    'has_wallet': code in existing_wallet_owner_ids,
                })

        elif owner_type_norm in ['customer', 'customers', 'seller', 'sellers']:
            from hr_app.models import HrOtherCustomer
            qs = HrOtherCustomer.objects.all().order_by('id')
            existing_wallet_owner_ids = set(
                WalletMaster.objects.filter(owner_type__iexact=owner_type).values_list('owner_id', flat=True)
            )
            prefix = 'CUST' if 'customer' in owner_type_norm else 'SLR'
            for c in qs:
                code = f"{prefix}-{c.id:04d}"
                display_name = c.contact_person.strip() if (c.contact_person and c.contact_person.strip()) else c.name
                results.append({
                    'record_id': c.id,
                    'owner_id': code,
                    'name': display_name,
                    'company_name': c.name,
                    'contact_person': c.contact_person or '',
                    'mobile': c.contact_number or '',
                    'email': c.email or '',
                    'has_wallet': code in existing_wallet_owner_ids,
                })

        return Response(results)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """
        Return high-level summary KPIs for Wallet Master.
        """
        total_wallets = WalletMaster.objects.count()
        active_wallets = WalletMaster.objects.filter(status='Active').count()
        inactive_wallets = total_wallets - active_wallets

        # Calculate overall system balance across all posted transactions
        credits = WalletTransaction.objects.filter(
            status='Posted',
            transaction_type='Credit'
        ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0.00')

        debits = WalletTransaction.objects.filter(
            status='Posted',
            transaction_type='Debit'
        ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0.00')

        total_balance = credits - debits

        return Response({
            'total_wallets': total_wallets,
            'active_wallets': active_wallets,
            'inactive_wallets': inactive_wallets,
            'total_balance': f"{total_balance:.2f}",
        })


class WalletTransactionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Wallet Transactions.
    Financial integrity enforced via database transactions and row-locking.
    """
    queryset = WalletTransaction.objects.select_related('wallet', 'created_by').all().order_by('-transaction_date', '-created_at')
    serializer_class = WalletTransactionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['transaction_number', 'reference_number', 'description', 'wallet__wallet_name', 'wallet__wallet_code']

    def get_queryset(self):
        qs = super().get_queryset()
        wallet_id = self.request.query_params.get('wallet')
        txn_type = self.request.query_params.get('transaction_type')
        status_param = self.request.query_params.get('status')
        from_date = self.request.query_params.get('from_date')
        to_date = self.request.query_params.get('to_date')

        if wallet_id:
            qs = qs.filter(wallet_id=wallet_id)
        if txn_type in ['Credit', 'Debit']:
            qs = qs.filter(transaction_type=txn_type)
        if status_param in ['Posted', 'Cancelled']:
            qs = qs.filter(status=status_param)
        if from_date:
            qs = qs.filter(transaction_date__gte=from_date)
        if to_date:
            qs = qs.filter(transaction_date__lte=to_date)

        return qs

    def create(self, request, *args, **kwargs):
        """
        Execute transaction creation atomically with row-locking on the target wallet
        to prevent race conditions / overdrafts.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        wallet_id = serializer.validated_data['wallet'].id
        txn_type = serializer.validated_data['transaction_type']
        amount = serializer.validated_data['amount']

        with transaction.atomic():
            # Lock the wallet row to prevent concurrent modifications
            locked_wallet = WalletMaster.objects.select_for_update().get(id=wallet_id)

            if locked_wallet.status != 'Active':
                return Response(
                    {'wallet': f"Wallet '{locked_wallet.wallet_name}' is inactive and cannot accept transactions."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if txn_type == 'Debit':
                current_balance = locked_wallet.get_balance()
                if current_balance < amount:
                    return Response(
                        {
                            'amount': (
                                f"Insufficient balance. Current available balance is Rs.{current_balance:.2f}, "
                                f"requested debit is Rs.{amount:.2f}."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

            self.perform_create(serializer)

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        """
        Prevent silent modification of posted financial transactions.
        """
        return Response(
            {"error": "Posted transactions cannot be directly modified. Use cancellation or adjustments to preserve audit trail."},
            status=status.HTTP_400_BAD_REQUEST
        )

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """
        Prevent permanent deletion of financial records.
        """
        return Response(
            {"error": "Transactions cannot be permanently deleted. Use cancellation to preserve financial audit history."},
            status=status.HTTP_400_BAD_REQUEST
        )

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel_transaction(self, request, pk=None):
        """
        Cancel a transaction safely, verifying that cancelling a Credit does not
        leave the wallet with a negative balance.
        """
        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response(
                {"reason": "A cancellation reason is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            txn = WalletTransaction.objects.select_for_update().get(pk=pk)

            if txn.status == 'Cancelled':
                return Response(
                    {"error": "Transaction is already cancelled."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Row-lock the wallet
            wallet = WalletMaster.objects.select_for_update().get(pk=txn.wallet_id)

            # If cancelling a Credit, ensure the remaining balance won't be negative
            if txn.transaction_type == 'Credit':
                current_balance = wallet.get_balance()
                if current_balance < txn.amount:
                    return Response(
                        {
                            "error": (
                                f"Cannot cancel credit transaction: The funds (Rs.{txn.amount:.2f}) have already been "
                                f"utilized. Available balance is Rs.{current_balance:.2f}. Cancelling this entry would "
                                "result in an illegal negative balance."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

            txn.status = 'Cancelled'
            txn.cancellation_reason = reason
            txn.save(update_fields=['status', 'cancellation_reason', 'updated_at'])

        serializer = self.get_serializer(txn)
        return Response(serializer.data, status=status.HTTP_200_OK)


class WalletReportView(APIView):
    """
    Dedicated reporting endpoint for Wallet Master & Wallet Transactions.
    - GET /api/wallet/report/ :
        Returns wallet-wise report summary with totals (Total Wallets, Total Credit,
        Total Debit, Net Balance, Total Transactions) and individual wallet rows
        (code, name, owner_type, total_credit, total_debit, current_balance, transaction_count).
    - GET /api/wallet/report/<int:wallet_id>/ledger/ (or ?wallet=<id>) :
        Returns detailed transaction ledger for a specific wallet, including
        Opening Balance, Total Credit, Total Debit, Closing Balance, and
        chronological transaction entries with Running Balance.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, wallet_id=None):
        if not wallet_id:
            wallet_id = request.query_params.get('wallet') or request.query_params.get('wallet_id')

        from_date_str = request.query_params.get('from_date')
        to_date_str = request.query_params.get('to_date')
        txn_type = request.query_params.get('transaction_type')
        status_param = request.query_params.get('status')
        owner_type_param = request.query_params.get('owner_type')
        search_query = request.query_params.get('search')

        # Date validation
        from_date = None
        to_date = None
        if from_date_str:
            try:
                from_date = datetime.strptime(from_date_str.strip(), '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {"error": "Invalid from_date format. Expected YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        if to_date_str:
            try:
                to_date = datetime.strptime(to_date_str.strip(), '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {"error": "Invalid to_date format. Expected YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        if from_date and to_date and from_date > to_date:
            return Response(
                {"error": "From Date cannot be later than To Date."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # -------------------------------------------------------------
        # BRANCH 1: SPECIFIC WALLET TRANSACTION LEDGER POPUP DATA
        # -------------------------------------------------------------
        if wallet_id:
            try:
                wallet = WalletMaster.objects.get(pk=wallet_id)
            except WalletMaster.DoesNotExist:
                return Response(
                    {"error": f"Wallet with ID '{wallet_id}' not found."},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 1. Opening Balance Calculation (all eligible entries before from_date)
            opening_balance = wallet.opening_points or Decimal('0.00')

            if from_date:
                # Prior WalletTransaction credits/debits
                prior_txns = wallet.transactions.filter(
                    status='Posted',
                    transaction_date__lt=from_date
                )
                prior_txn_c = prior_txns.filter(transaction_type='Credit').aggregate(
                    total=models.Sum('amount')
                )['total'] or Decimal('0.00')
                prior_txn_d = prior_txns.filter(transaction_type='Debit').aggregate(
                    total=models.Sum('amount')
                )['total'] or Decimal('0.00')

                # Prior PointsEntry additions/deductions
                prior_pts = wallet.points_entries.filter(
                    entry_date__lt=from_date
                )
                prior_pts_c = prior_pts.filter(entry_type='Addition').aggregate(
                    total=models.Sum('points')
                )['total'] or Decimal('0.00')
                prior_pts_d = prior_pts.filter(entry_type='Deduction').aggregate(
                    total=models.Sum('points')
                )['total'] or Decimal('0.00')

                opening_balance += (prior_txn_c - prior_txn_d) + (prior_pts_c - prior_pts_d)

            # 2. Collect Period Entries from WalletTransaction
            txn_qs = wallet.transactions.all()
            if from_date:
                txn_qs = txn_qs.filter(transaction_date__gte=from_date)
            if to_date:
                txn_qs = txn_qs.filter(transaction_date__lte=to_date)
            if txn_type in ['Credit', 'Debit']:
                txn_qs = txn_qs.filter(transaction_type=txn_type)
            if status_param and status_param != 'All':
                txn_qs = txn_qs.filter(status=status_param)

            # 3. Collect Period Entries from WalletPointsEntry
            pts_qs = wallet.points_entries.all()
            if from_date:
                pts_qs = pts_qs.filter(entry_date__gte=from_date)
            if to_date:
                pts_qs = pts_qs.filter(entry_date__lte=to_date)
            if txn_type == 'Credit':
                pts_qs = pts_qs.filter(entry_type='Addition')
            elif txn_type == 'Debit':
                pts_qs = pts_qs.filter(entry_type='Deduction')
            if status_param and status_param not in ['All', 'Posted']:
                pts_qs = pts_qs.none()

            ledger_items = []

            for t in txn_qs:
                is_credit = t.transaction_type == 'Credit'
                c_amt = t.amount if is_credit else Decimal('0.00')
                d_amt = Decimal('0.00') if is_credit else t.amount
                ledger_items.append({
                    'id': f"txn-{t.id}",
                    'raw_id': t.id,
                    'date': t.transaction_date.strftime('%Y-%m-%d'),
                    'transaction_number': t.transaction_number,
                    'reference_number': t.reference_number or '-',
                    'description': t.description or 'Wallet Transaction',
                    'transaction_type': t.transaction_type,
                    'credit': c_amt,
                    'debit': d_amt,
                    'status': t.status,
                    'source_type': 'Transaction',
                    'created_at': t.created_at,
                })

            for p in pts_qs:
                is_add = p.entry_type == 'Addition'
                c_amt = p.points if is_add else Decimal('0.00')
                d_amt = Decimal('0.00') if is_add else p.points
                desc = p.reason or 'Points Entry'
                if p.remarks:
                    desc = f"{desc} - {p.remarks}"
                ledger_items.append({
                    'id': f"pts-{p.id}",
                    'raw_id': p.id,
                    'date': p.entry_date.strftime('%Y-%m-%d'),
                    'transaction_number': p.entry_number or f"PE-{p.id:05d}",
                    'reference_number': p.reference_no or '-',
                    'description': desc,
                    'transaction_type': 'Credit' if is_add else 'Debit',
                    'credit': c_amt,
                    'debit': d_amt,
                    'status': 'Posted',
                    'source_type': 'PointsEntry',
                    'created_at': p.created_at,
                })

            # Sort chronologically ascending to compute running balances correctly
            ledger_items.sort(key=lambda x: (x['date'], x['created_at']))

            current_running = opening_balance
            period_total_credit = Decimal('0.00')
            period_total_debit = Decimal('0.00')

            for item in ledger_items:
                if item['status'] == 'Posted':
                    current_running += (item['credit'] - item['debit'])
                    period_total_credit += item['credit']
                    period_total_debit += item['debit']
                item['running_balance'] = f"{current_running:.2f}"
                item['credit'] = f"{item['credit']:.2f}"
                item['debit'] = f"{item['debit']:.2f}"
                item['created_at'] = item['created_at'].isoformat() if item['created_at'] else None

            closing_balance = current_running

            return Response({
                'wallet': {
                    'id': wallet.id,
                    'wallet_code': wallet.wallet_code,
                    'wallet_name': wallet.wallet_name,
                    'owner_type': wallet.owner_type,
                    'owner_id': wallet.owner_id or '-',
                    'mobile': wallet.mobile or '-',
                    'email': wallet.email or '-',
                    'opening_points': f"{(wallet.opening_points or Decimal('0.00')):.2f}",
                    'current_balance': f"{wallet.get_balance():.2f}",
                    'status': wallet.status,
                },
                'summary': {
                    'from_date': from_date_str or None,
                    'to_date': to_date_str or None,
                    'opening_balance': f"{opening_balance:.2f}",
                    'total_credit': f"{period_total_credit:.2f}",
                    'total_debit': f"{period_total_debit:.2f}",
                    'closing_balance': f"{closing_balance:.2f}",
                    'total_transactions': len(ledger_items),
                },
                'ledger': ledger_items
            }, status=status.HTTP_200_OK)

        # -------------------------------------------------------------
        # BRANCH 2: WALLET-WISE SUMMARY REPORT FOR MAIN REPORT PAGE
        # -------------------------------------------------------------
        wallets_qs = WalletMaster.objects.all().order_by('wallet_name')

        if owner_type_param and owner_type_param != 'All':
            wallets_qs = wallets_qs.filter(owner_type=owner_type_param)

        if status_param in ['Active', 'Inactive']:
            wallets_qs = wallets_qs.filter(status=status_param)

        if search_query:
            sq = search_query.strip()
            wallets_qs = wallets_qs.filter(
                models.Q(wallet_code__icontains=sq) |
                models.Q(wallet_name__icontains=sq) |
                models.Q(owner_id__icontains=sq) |
                models.Q(email__icontains=sq) |
                models.Q(mobile__icontains=sq)
            )

        wallet_report_rows = []
        overall_credit = Decimal('0.00')
        overall_debit = Decimal('0.00')
        overall_balance = Decimal('0.00')
        overall_txn_count = 0

        for w in wallets_qs:
            current_bal = w.get_balance()
            overall_balance += current_bal

            # Filter period transactions for this wallet
            tx_filter = {'wallet': w}
            if from_date:
                tx_filter['transaction_date__gte'] = from_date
            if to_date:
                tx_filter['transaction_date__lte'] = to_date
            if status_param and status_param != 'All':
                tx_filter['status'] = status_param
            else:
                tx_filter['status'] = 'Posted'

            if txn_type in ['Credit', 'Debit']:
                tx_filter['transaction_type'] = txn_type

            tx_qs = WalletTransaction.objects.filter(**tx_filter)
            c_tx = tx_qs.filter(transaction_type='Credit').aggregate(total=models.Sum('amount'))['total'] or Decimal('0.00')
            d_tx = tx_qs.filter(transaction_type='Debit').aggregate(total=models.Sum('amount'))['total'] or Decimal('0.00')
            tx_count = tx_qs.count()

            # Filter period points entries for this wallet
            pts_filter = {'wallet': w}
            if from_date:
                pts_filter['entry_date__gte'] = from_date
            if to_date:
                pts_filter['entry_date__lte'] = to_date

            if txn_type == 'Credit':
                pts_filter['entry_type'] = 'Addition'
            elif txn_type == 'Debit':
                pts_filter['entry_type'] = 'Deduction'

            if status_param and status_param not in ['All', 'Posted']:
                pts_qs = WalletPointsEntry.objects.none()
            else:
                pts_qs = WalletPointsEntry.objects.filter(**pts_filter)

            c_pts = pts_qs.filter(entry_type='Addition').aggregate(total=models.Sum('points'))['total'] or Decimal('0.00')
            d_pts = pts_qs.filter(entry_type='Deduction').aggregate(total=models.Sum('points'))['total'] or Decimal('0.00')
            pts_count = pts_qs.count()

            w_credit = c_tx + c_pts
            w_debit = d_tx + d_pts
            w_count = tx_count + pts_count

            overall_credit += w_credit
            overall_debit += w_debit
            overall_txn_count += w_count

            wallet_report_rows.append({
                'id': w.id,
                'wallet_code': w.wallet_code,
                'wallet_name': w.wallet_name,
                'owner_type': w.owner_type,
                'owner_id': w.owner_id or '-',
                'mobile': w.mobile or '-',
                'email': w.email or '-',
                'status': w.status,
                'opening_points': f"{(w.opening_points or Decimal('0.00')):.2f}",
                'total_credit': f"{w_credit:.2f}",
                'total_debit': f"{w_debit:.2f}",
                'current_balance': f"{current_bal:.2f}",
                'transaction_count': w_count,
            })

        return Response({
            'summary': {
                'from_date': from_date_str or None,
                'to_date': to_date_str or None,
                'total_wallets': len(wallet_report_rows),
                'total_credit': f"{overall_credit:.2f}",
                'total_debit': f"{overall_debit:.2f}",
                'net_balance': f"{overall_balance:.2f}",
                'total_transactions': overall_txn_count,
            },
            'wallets': wallet_report_rows
        }, status=status.HTTP_200_OK)


class WalletOwnerTypeViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for Wallet Owner Types (wallet_ownertype).
    """
    queryset = WalletOwnerType.objects.all().order_by('owner_type')
    serializer_class = WalletOwnerTypeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['owner_type', 'description']

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param in ['Active', 'Inactive']:
            qs = qs.filter(status=status_param)
        return qs

    @action(detail=False, methods=['get'], url_path='active')
    def active_owner_types(self, request):
        """
        Return list of active owner types for dropdowns.
        """
        active_qs = WalletOwnerType.objects.filter(status='Active').order_by('owner_type')
        serializer = self.get_serializer(active_qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['patch', 'post'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        """
        Toggle owner type status between Active and Inactive.
        """
        owner_type = self.get_object()
        owner_type.status = 'Inactive' if owner_type.status == 'Active' else 'Active'
        owner_type.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(owner_type).data)

    def destroy(self, request, *args, **kwargs):
        owner_type_obj = self.get_object()
        from .models import WalletPointsEntry, WalletMaster
        pts_count = WalletPointsEntry.objects.filter(wallet__owner_type__iexact=owner_type_obj.owner_type).count()
        if pts_count > 0:
            return Response(
                {
                    "error": (
                        f"Cannot delete Owner Type '{owner_type_obj.owner_type}'. "
                        f"It is already associated with {pts_count} point {'entry' if pts_count == 1 else 'entries'}. "
                        "Owner Types used in points entry transactions cannot be deleted."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        wallets_count = WalletMaster.objects.filter(owner_type__iexact=owner_type_obj.owner_type).count()
        if wallets_count > 0:
            return Response(
                {
                    "error": (
                        f"Cannot delete Owner Type '{owner_type_obj.owner_type}'. "
                        f"It is assigned to {wallets_count} {'wallet' if wallets_count == 1 else 'wallets'}. "
                        "Please reassign or remove the associated wallets first."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)


class WalletSchemeViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for Wallet Schemes (wallet_schemes).
    """
    queryset = WalletScheme.objects.all().prefetch_related('criteria_rows__product', 'criteria_values__product').order_by('-created_at')
    serializer_class = WalletSchemeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'remarks', 'criteria']

    def get_queryset(self):
        # Synchronize any expired schemes before returning queryset
        WalletScheme.deactivate_expired()

        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param in ['Active', 'Inactive']:
            qs = qs.filter(status=status_param)

        active_only = self.request.query_params.get('active_only')
        if active_only == 'true':
            today = get_wallet_local_date()
            qs = qs.filter(status='Active', start_date__lte=today, end_date__gte=today)

        from_date = self.request.query_params.get('from_date')
        to_date = self.request.query_params.get('to_date')
        if from_date:
            qs = qs.filter(start_date__gte=from_date)
        if to_date:
            qs = qs.filter(end_date__lte=to_date)
        return qs

    def destroy(self, request, *args, **kwargs):
        scheme = self.get_object()
        entries_count = scheme.points_entries.count()
        if entries_count > 0:
            return Response(
                {
                    "error": (
                        f"Cannot delete scheme '{scheme.name}'. It has already been used for "
                        f"{entries_count} point {'entry' if entries_count == 1 else 'entries'}. "
                        "Schemes with existing point entries cannot be deleted."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'], url_path='active')
    def active_schemes(self, request):
        """
        Return list of currently active, valid schemes for Points Entry dropdowns.
        Ensures:
        - status == 'Active'
        - start_date <= today
        - end_date >= today
        """
        WalletScheme.deactivate_expired()
        today = get_wallet_local_date()
        active_qs = WalletScheme.objects.filter(
            status='Active',
            start_date__lte=today,
            end_date__gte=today
        ).order_by('name')
        serializer = self.get_serializer(active_qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['patch', 'post'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        """
        Toggle scheme status between Active and Inactive.
        Strict rule: An expired scheme CANNOT be activated without extending its end_date.
        """
        scheme = self.get_object()
        new_status = 'Inactive' if scheme.status == 'Active' else 'Active'
        if new_status == 'Active':
            today = get_wallet_local_date()
            if scheme.end_date and scheme.end_date < today:
                return Response(
                    {
                        "error": (
                            f"Cannot activate expired scheme '{scheme.name}'. "
                            f"Its End Date ({scheme.end_date.strftime('%d-%m-%Y')}) has passed. "
                            "Please extend the End Date first to activate this scheme."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
        scheme.status = new_status
        scheme.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(scheme).data)

    @action(detail=True, methods=['get', 'post'], url_path='criteria')
    def criteria(self, request, pk=None):
        """
        GET /api/wallet/schemes/{id}/criteria/ - Retrieve criteria rows for a scheme
        Query param 'group': 'criteria', 'criteria_2', or 'values'
        POST /api/wallet/schemes/{id}/criteria/ - Add a criterion row to a scheme
        """
        scheme = self.get_object()
        if request.method == 'GET':
            group = request.query_params.get('group')
            if group in ['criteria_2', 'values']:
                rows = scheme.criteria_values.all().select_related('product')
                serializer = WalletCriteriaValueSerializer(rows, many=True)
                return Response(serializer.data)
            else:
                rows = scheme.criteria_rows.filter(criteria_group='criteria').select_related('product')
                serializer = WalletSchemeCriteriaSerializer(rows, many=True)
                return Response(serializer.data)
        elif request.method == 'POST':
            group = request.data.get('group', request.query_params.get('group'))
            if group in ['criteria_2', 'values']:
                serializer = WalletCriteriaValueSerializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                serializer.save(scheme=scheme)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                serializer = WalletSchemeCriteriaSerializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                serializer.save(scheme=scheme)
                return Response(serializer.data, status=status.HTTP_201_CREATED)


class WalletSchemeCriteriaViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for individual Scheme Criteria rows (wallet_scheme_criteria).
    """
    queryset = WalletSchemeCriteria.objects.all().select_related('scheme', 'product').order_by('id')
    serializer_class = WalletSchemeCriteriaSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['scheme__name', 'product__name', 'product__item_code']

    def get_queryset(self):
        qs = super().get_queryset()
        scheme_id = self.request.query_params.get('scheme')
        group = self.request.query_params.get('group')
        if scheme_id:
            qs = qs.filter(scheme_id=scheme_id)
        if group in ['criteria', 'criteria_2']:
            qs = qs.filter(criteria_group=group)
        return qs

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.scheme:
            if instance.criteria_group == 'criteria' and instance.scheme.criteria_rows.filter(criteria_group='criteria').count() <= 1:
                return Response(
                    {"error": "Cannot delete the last criteria row. A scheme must have at least one criteria row in the Quantity Based Criteria tab."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        return super().destroy(request, *args, **kwargs)


class WalletCriteriaValueViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for individual Value-based Scheme Criteria rows (wallet_criteria_values).
    """
    queryset = WalletCriteriaValue.objects.all().select_related('scheme', 'product').order_by('id')
    serializer_class = WalletCriteriaValueSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['scheme__name', 'product__name', 'product__item_code']
    ordering_fields = ['id', 'value', 'discount_percentage', 'discount_value', 'points', 'created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        scheme_id = self.request.query_params.get('scheme')
        if scheme_id:
            qs = qs.filter(scheme_id=scheme_id)
        return qs

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.scheme and instance.scheme.criteria_values.count() <= 1:
            return Response(
                {"error": "Cannot delete the last criteria row. A scheme must have at least one criteria row in the Value Based Criteria tab."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)


class WalletReasonViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for Wallet Reasons (wallet_reason).
    """
    queryset = WalletReason.objects.all().order_by('reason')
    serializer_class = WalletReasonSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['reason', 'description']

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param in ['Active', 'Inactive']:
            qs = qs.filter(status=status_param)
        return qs

    @action(detail=False, methods=['get'], url_path='active')
    def active_reasons(self, request):
        """
        Return list of active reasons for dropdowns.
        """
        active_qs = WalletReason.objects.filter(status='Active').order_by('reason')
        serializer = self.get_serializer(active_qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['patch', 'post'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        """
        Toggle reason status between Active and Inactive.
        """
        reason_obj = self.get_object()
        reason_obj.status = 'Inactive' if reason_obj.status == 'Active' else 'Active'
        reason_obj.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(reason_obj).data)

    def destroy(self, request, *args, **kwargs):
        reason_obj = self.get_object()
        from .models import WalletPointsEntry
        pts_count = WalletPointsEntry.objects.filter(reason__iexact=reason_obj.reason).count()
        if pts_count > 0:
            return Response(
                {
                    "error": (
                        f"Cannot delete Reason '{reason_obj.reason}'. "
                        f"It is already used in {pts_count} point {'entry' if pts_count == 1 else 'entries'}. "
                        "Reasons used in points entry transactions cannot be deleted."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        return qs


class WalletPointsEntryViewSet(viewsets.ModelViewSet):
    """
    Dedicated ViewSet for Wallet Points Entry transactions.
    Enforces strict row-locking, balance integrity, and duplicate protection.
    """
    queryset = WalletPointsEntry.objects.select_related('wallet', 'scheme', 'created_by').all().order_by('-entry_date', '-created_at')
    serializer_class = WalletPointsEntrySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['entry_number', 'reference_no', 'remarks', 'reason', 'wallet__wallet_name', 'wallet__wallet_code', 'scheme__name']

    def get_queryset(self):
        qs = super().get_queryset()
        wallet_id = self.request.query_params.get('wallet')
        entry_type = self.request.query_params.get('entry_type')
        reason = self.request.query_params.get('reason')
        from_date = self.request.query_params.get('from_date')
        to_date = self.request.query_params.get('to_date')

        if wallet_id:
            qs = qs.filter(wallet_id=wallet_id)
        if entry_type in ['Addition', 'Deduction']:
            qs = qs.filter(entry_type=entry_type)
        if reason:
            qs = qs.filter(reason=reason)
        if from_date:
            qs = qs.filter(entry_date__gte=from_date)
        if to_date:
            qs = qs.filter(entry_date__lte=to_date)

        return qs

    @action(detail=False, methods=['get'], url_path='next-entry-number')
    def next_entry_number(self, request):
        """
        Generate next sequential unique points entry number: PE-XXXXX (e.g. PE-00001).
        """
        prefix = 'PE-'
        entries = WalletPointsEntry.objects.filter(entry_number__startswith=prefix).values_list('entry_number', flat=True)
        max_num = 0
        for code in entries:
            try:
                num_part = code.split('-')[-1]
                num = int(num_part)
                if num > max_num:
                    max_num = num
            except (ValueError, IndexError):
                pass

        next_num = max_num + 1
        generated_code = f"{prefix}{next_num:05d}"
        while WalletPointsEntry.objects.filter(entry_number=generated_code).exists():
            next_num += 1
            generated_code = f"{prefix}{next_num:05d}"

        return Response({'next_entry_number': generated_code})

    def create(self, request, *args, **kwargs):
        """
        Execute Points Entry creation atomically with row-level locking on the target wallet.
        Calculates authoritative balance_before and balance_after on the backend,
        and generates sequential entry_number.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        wallet_obj = serializer.validated_data['wallet']
        entry_type = serializer.validated_data['entry_type']
        points = serializer.validated_data['points']
        scheme_obj = serializer.validated_data.get('scheme')

        # Additional defense-in-depth scheme validation
        if scheme_obj:
            today = get_wallet_local_date()
            entry_date = serializer.validated_data.get('entry_date') or today
            if scheme_obj.status != 'Active':
                return Response(
                    {'scheme': [f"Scheme '{scheme_obj.name}' is inactive and cannot be selected for new transactions."]},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if scheme_obj.end_date and (today > scheme_obj.end_date or entry_date > scheme_obj.end_date):
                return Response(
                    {'scheme': [f"Scheme '{scheme_obj.name}' expired on {scheme_obj.end_date.strftime('%d-%m-%Y')} and cannot be used."]},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if scheme_obj.start_date and (today < scheme_obj.start_date or entry_date < scheme_obj.start_date):
                return Response(
                    {'scheme': [f"Scheme '{scheme_obj.name}' is not yet active (starts on {scheme_obj.start_date.strftime('%d-%m-%Y')})."]},
                    status=status.HTTP_400_BAD_REQUEST
                )

        with transaction.atomic():
            # Lock the wallet row to protect against concurrent updates
            locked_wallet = WalletMaster.objects.select_for_update().get(id=wallet_obj.id)

            if locked_wallet.status != 'Active':
                return Response(
                    {'wallet': f"Wallet '{locked_wallet.wallet_name}' is inactive and cannot accept points entries."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Generate thread-safe sequential entry_number
            prefix = 'PE-'
            entries = WalletPointsEntry.objects.select_for_update().filter(
                entry_number__startswith=prefix
            ).values_list('entry_number', flat=True)
            max_num = 0
            for code in entries:
                try:
                    num_part = code.split('-')[-1]
                    num = int(num_part)
                    if num > max_num:
                        max_num = num
                except (ValueError, IndexError):
                    pass

            next_num = max_num + 1
            generated_code = f"{prefix}{next_num:05d}"
            while WalletPointsEntry.objects.filter(entry_number=generated_code).exists():
                next_num += 1
                generated_code = f"{prefix}{next_num:05d}"

            # Read latest committed authoritative balance
            balance_before = locked_wallet.get_balance()

            if entry_type == 'Addition':
                balance_after = balance_before + points
            elif entry_type == 'Deduction':
                if balance_before < points:
                    return Response(
                        {
                            'points': (
                                f"Insufficient balance. Current available balance is {balance_before:.2f} points, "
                                f"requested deduction is {points:.2f} points."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
                balance_after = balance_before - points
            else:
                return Response(
                    {'entry_type': "Invalid entry type. Must be 'Addition' or 'Deduction'."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Assign audit user, generated entry_number, and authoritative balances
            user = request.user if request.user and request.user.is_authenticated else None
            instance = serializer.save(
                entry_number=generated_code,
                balance_before=balance_before,
                balance_after=balance_after,
                created_by=user
            )

        headers = self.get_success_headers(serializer.data)
        response_data = serializer.data
        response_data['current_balance'] = f"{balance_after:.2f}"

        return Response(response_data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        """
        Update an existing points entry and recalculate balances with atomic row-locking.
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        wallet_obj = serializer.validated_data.get('wallet', instance.wallet)
        entry_type = serializer.validated_data.get('entry_type', instance.entry_type)
        points = serializer.validated_data.get('points', instance.points)

        with transaction.atomic():
            locked_wallet = WalletMaster.objects.select_for_update().get(id=wallet_obj.id)
            if locked_wallet.status != 'Active':
                return Response(
                    {'wallet': f"Wallet '{locked_wallet.wallet_name}' is inactive."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Revert old entry effect to compute base balance
            current_bal = locked_wallet.get_balance()
            if instance.entry_type == 'Addition':
                base_bal = current_bal - instance.points
            else:
                base_bal = current_bal + instance.points

            if entry_type == 'Addition':
                new_bal = base_bal + points
            else:
                if base_bal < points:
                    return Response(
                        {'points': f"Insufficient balance. Available balance is {base_bal:.2f} points, requested deduction is {points:.2f} points."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                new_bal = base_bal - points

            instance = serializer.save(
                balance_before=base_bal,
                balance_after=new_bal
            )

        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """
        Delete a points entry safely with wallet balance verification and reference integrity.
        """
        instance = self.get_object()
        wallet_obj = instance.wallet

        # Check if connected to an active Sales Invoice
        if instance.reference_no:
            try:
                from sales_app.models import SalesInvoice
                if SalesInvoice.objects.filter(invoice_no=instance.reference_no).exists():
                    return Response(
                        {
                            "error": (
                                f"Cannot delete points entry '{instance.entry_number or instance.id}' because it is connected to "
                                f"Sales Invoice '{instance.reference_no}'. "
                                "Points entries linked to sales invoices cannot be deleted directly."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except Exception:
                pass

        with transaction.atomic():
            locked_wallet = WalletMaster.objects.select_for_update().get(id=wallet_obj.id)
            # If deleting an addition, ensure remaining balance won't drop below 0
            if instance.entry_type == 'Addition':
                current_bal = locked_wallet.get_balance()
                if current_bal < instance.points:
                    return Response(
                        {
                            "error": (
                                f"Cannot delete points entry '{instance.entry_number or instance.id}' because deducting "
                                f"{instance.points} points would overdraft the wallet (current balance: {current_bal:.2f})."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
            instance.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class WalletWorkingViewSet(viewsets.ViewSet):
    """
    ViewSet for Wallet Working (Inactivity & Break Tracking).
    Handles:
    - Settings configuration (Inactivity timeout, confirmation countdown, toggles)
    - Session tracking and active break status
    - User activity confirmations
    - Break period start and resumption
    - Break history logging
    """
    permission_classes = [IsAuthenticated]

    def _is_admin(self, user):
        """Helper to determine if the user has administrative privileges."""
        if not user or not user.is_authenticated:
            return False
        if user.is_staff or user.is_superuser:
            return True
        role_name = getattr(getattr(user, 'role', None), 'name', '') or ''
        return role_name.strip().lower() in ['admin', 'administrator', 'super admin', 'manager']

    @action(detail=False, methods=['get', 'patch', 'put'], url_path='settings')
    def settings_view(self, request):
        settings_obj = WalletWorkingSettings.get_settings()

        if request.method == 'GET':
            serializer = WalletWorkingSettingsSerializer(settings_obj)
            return Response(serializer.data, status=status.HTTP_200_OK)

        # Updating settings: authorize administrators
        if not self._is_admin(request.user):
            return Response(
                {"error": "Only authorized administrators can modify Working settings."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = WalletWorkingSettingsSerializer(
            settings_obj,
            data=request.data,
            partial=request.method == 'PATCH'
        )
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return Response(
                {
                    "message": "Working settings updated successfully.",
                    "settings": serializer.data
                },
                status=status.HTTP_200_OK
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='session')
    def session_view(self, request):
        user = request.user
        settings_obj = WalletWorkingSettings.get_settings()

        # Find or create today's active session
        session = WorkingSession.objects.filter(
            user=user,
            status__in=['Active', 'On Break']
        ).order_by('-created_at').first()

        if not session:
            session = WorkingSession.objects.create(
                user=user,
                session_start=timezone.now(),
                status='Active'
            )

        active_break = WorkingBreak.objects.filter(
            user=user,
            status='Active'
        ).order_by('-created_at').first()

        # Synchronize session status with active break
        if active_break and session.status != 'On Break':
            session.status = 'On Break'
            session.save(update_fields=['status', 'updated_at'])
        elif not active_break and session.status == 'On Break':
            session.status = 'Active'
            session.save(update_fields=['status', 'updated_at'])

        return Response({
            "session": WorkingSessionSerializer(session).data,
            "active_break": WorkingBreakSerializer(active_break).data if active_break else None,
            "settings": WalletWorkingSettingsSerializer(settings_obj).data,
            "is_admin": self._is_admin(user)
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get', 'post'], url_path='idle-prompt')
    def idle_prompt_view(self, request):
        """
        GET /api/wallet/working/idle-prompt/
        Returns any active pending idle confirmation prompt for the logged-in user.
        Validates deadline and marks expired events as TIMED_OUT automatically.

        POST /api/wallet/working/idle-prompt/
        Triggered when employee status changes to IDLE or inactivity timeout occurs.
        Creates a new 30-second pending confirmation event if none currently exists.
        """
        user = request.user
        settings_obj = WalletWorkingSettings.get_settings()
        now = timezone.now()

        if request.method == 'GET':
            # Check for active pending confirmation
            pending_event = InactivityEvent.objects.filter(
                user=user,
                outcome='PENDING'
            ).order_by('-created_at').first()

            if not pending_event:
                return Response({"has_pending": False, "event": None}, status=status.HTTP_200_OK)

            # Check if deadline passed
            if pending_event.response_deadline and now > pending_event.response_deadline:
                pending_event.outcome = 'TIMED_OUT'
                pending_event.response_time = pending_event.response_deadline
                pending_event.save(update_fields=['outcome', 'response_time'])
                return Response({
                    "has_pending": False,
                    "event": InactivityEventSerializer(pending_event).data,
                    "message": "Confirmation has timed out."
                }, status=status.HTTP_200_OK)

            return Response({
                "has_pending": True,
                "event": InactivityEventSerializer(pending_event).data,
                "countdown_seconds": max(0, int((pending_event.response_deadline - now).total_seconds())) if pending_event.response_deadline else 30
            }, status=status.HTTP_200_OK)

        elif request.method == 'POST':
            if not settings_obj.monitoring_enabled:
                return Response(
                    {"error": "Inactivity monitoring is currently disabled."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check if there is already an active pending prompt
            with transaction.atomic():
                existing = InactivityEvent.objects.select_for_update().filter(
                    user=user,
                    outcome='PENDING'
                ).order_by('-created_at').first()

                if existing:
                    # If deadline expired, mark it TIMED_OUT
                    if existing.response_deadline and now > existing.response_deadline:
                        existing.outcome = 'TIMED_OUT'
                        existing.response_time = existing.response_deadline
                        existing.save(update_fields=['outcome', 'response_time'])
                    else:
                        # Return existing pending prompt to avoid duplicate popups
                        return Response({
                            "created": False,
                            "event": InactivityEventSerializer(existing).data,
                            "countdown_seconds": max(0, int((existing.response_deadline - now).total_seconds()))
                        }, status=status.HTTP_200_OK)

                # Duration: default 30 seconds
                countdown_seconds = int(settings_obj.confirmation_countdown_seconds or 30)
                from datetime import timedelta
                deadline = now + timedelta(seconds=countdown_seconds)

                active_session = WorkingSession.objects.filter(
                    user=user,
                    status__in=['Active', 'On Break']
                ).order_by('-created_at').first()

                new_event = InactivityEvent.objects.create(
                    user=user,
                    session=active_session,
                    prompt_time=now,
                    response_deadline=deadline,
                    outcome='PENDING'
                )

            return Response({
                "created": True,
                "event": InactivityEventSerializer(new_event).data,
                "countdown_seconds": countdown_seconds
            }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='confirm')
    def confirm_working(self, request):
        """
        POST /api/wallet/working/confirm/
        Employee clicks "Yes, I'm Working" within the 30-second deadline.
        Validates deadline on backend:
        - If within deadline: marks CONFIRMED, restores EmployeeWorkingStatus to ACTIVE, logs history.
        - If expired: rejects confirmation, marks TIMED_OUT, leaves status as IDLE.
        """
        user = request.user
        event_id = request.data.get('event_id')
        now = timezone.now()

        settings_obj = WalletWorkingSettings.get_settings()

        with transaction.atomic():
            if event_id:
                event = InactivityEvent.objects.select_for_update().filter(id=event_id, user=user).first()
            else:
                event = InactivityEvent.objects.select_for_update().filter(
                    user=user,
                    outcome='PENDING'
                ).order_by('-created_at').first()

            if not event:
                # If no pending event found, create confirmed record directly (e.g. manual activity)
                active_session = WorkingSession.objects.filter(
                    user=user,
                    status__in=['Active', 'On Break']
                ).order_by('-created_at').first()
                event = InactivityEvent.objects.create(
                    user=user,
                    session=active_session,
                    prompt_time=now,
                    response_deadline=now,
                    response_time=now,
                    outcome='CONFIRMED'
                )

            # Check if event was already marked TIMED_OUT or deadline expired
            if event.outcome == 'TIMED_OUT' or (event.response_deadline and now > event.response_deadline):
                if event.outcome != 'TIMED_OUT':
                    event.outcome = 'TIMED_OUT'
                    event.response_time = now
                    event.save(update_fields=['outcome', 'response_time'])
                return Response({
                    "success": False,
                    "timed_out": True,
                    "message": "Confirmation deadline has expired (30 seconds elapsed). Status remains IDLE.",
                    "event": InactivityEventSerializer(event).data
                }, status=status.HTTP_400_BAD_REQUEST)

            # Response is on time! Mark CONFIRMED
            event.outcome = 'CONFIRMED'
            event.response_time = now
            event.save(update_fields=['outcome', 'response_time'])

            # Restore status to ACTIVE
            status_obj, created = EmployeeWorkingStatus.objects.select_for_update().get_or_create(
                user=user,
                defaults={
                    'status': 'ACTIVE',
                    'last_change': now,
                    'last_activity_at': now,
                    'last_heartbeat_at': now,
                }
            )

            status_changed = (status_obj.status != 'ACTIVE')
            if status_changed:
                status_obj.status = 'ACTIVE'
                status_obj.last_change = now
                # Append transition history
                WorkingStatusHistory.objects.create(
                    user=user,
                    status='ACTIVE',
                    changed_at=now,
                    last_activity_at=now,
                    device_identifier=status_obj.device_identifier or 'Manual Confirmation',
                )

            status_obj.last_activity_at = now
            status_obj.save(update_fields=['status', 'last_change', 'last_activity_at', 'updated_at'])

        return Response({
            "success": True,
            "message": "Working activity confirmed successfully. Status set to ACTIVE.",
            "status": "ACTIVE",
            "event": InactivityEventSerializer(event).data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='idle-timeout')
    def idle_timeout_view(self, request):
        """
        POST /api/wallet/working/idle-timeout/
        Called when the 30-second countdown expires without response:
        - Marks InactivityEvent as TIMED_OUT.
        - Keeps EmployeeWorkingStatus as IDLE.
        - Prevents duplicate timeout records.
        """
        user = request.user
        event_id = request.data.get('event_id')
        now = timezone.now()

        with transaction.atomic():
            if event_id:
                event = InactivityEvent.objects.select_for_update().filter(id=event_id, user=user).first()
            else:
                event = InactivityEvent.objects.select_for_update().filter(
                    user=user,
                    outcome='PENDING'
                ).order_by('-created_at').first()

            if not event:
                return Response({
                    "success": True,
                    "message": "No active pending confirmation to time out."
                }, status=status.HTTP_200_OK)

            if event.outcome != 'TIMED_OUT':
                event.outcome = 'TIMED_OUT'
                event.response_time = now
                event.save(update_fields=['outcome', 'response_time'])

            # Ensure EmployeeWorkingStatus remains IDLE
            status_obj = EmployeeWorkingStatus.objects.select_for_update().filter(user=user).first()
            if status_obj and status_obj.status != 'IDLE':
                status_obj.status = 'IDLE'
                status_obj.last_change = now
                status_obj.save(update_fields=['status', 'last_change', 'updated_at'])
                WorkingStatusHistory.objects.create(
                    user=user,
                    status='IDLE',
                    changed_at=now,
                    last_activity_at=status_obj.last_activity_at,
                    device_identifier=status_obj.device_identifier,
                )

        return Response({
            "success": True,
            "message": "Confirmation marked as Timed Out. Status remains IDLE.",
            "event": InactivityEventSerializer(event).data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='start-break')
    def start_break(self, request):
        user = request.user
        settings_obj = WalletWorkingSettings.get_settings()

        if not settings_obj.monitoring_enabled:
            return Response(
                {"error": "Inactivity monitoring is currently disabled."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not settings_obj.break_tracking_enabled:
            return Response(
                {"error": "Break tracking is currently disabled."},
                status=status.HTTP_400_BAD_REQUEST
            )

        break_source = request.data.get('break_source') or 'INACTIVITY_TIMEOUT'
        prompt_time = request.data.get('prompt_time') or timezone.now()

        with transaction.atomic():
            # Check for existing active break (prevents duplicate breaks across multiple tabs)
            existing_break = WorkingBreak.objects.select_for_update().filter(
                user=user,
                status='Active'
            ).first()

            if existing_break:
                return Response({
                    "success": True,
                    "message": "Employee is already on break.",
                    "break": WorkingBreakSerializer(existing_break).data
                }, status=status.HTTP_200_OK)

            # Get or create active session
            session = WorkingSession.objects.select_for_update().filter(
                user=user,
                status__in=['Active', 'On Break']
            ).order_by('-created_at').first()

            if not session:
                session = WorkingSession.objects.create(
                    user=user,
                    session_start=timezone.now(),
                    status='On Break'
                )
            else:
                session.status = 'On Break'
                session.save(update_fields=['status', 'updated_at'])

            # Resolve employee specific threshold
            status_obj = EmployeeWorkingStatus.objects.filter(user=user).first()
            emp_threshold = (status_obj.custom_idle_threshold_minutes if status_obj else None) or settings_obj.idle_threshold_minutes

            # Create break record
            new_break = WorkingBreak.objects.create(
                user=user,
                session=session,
                break_start=timezone.now(),
                break_source=break_source,
                threshold_minutes=emp_threshold,
                status='Active'
            )

            # Create InactivityEvent record
            InactivityEvent.objects.create(
                user=user,
                session=session,
                prompt_time=prompt_time,
                response_deadline=timezone.now(),
                response_time=timezone.now(),
                outcome='TIMED_OUT',
                related_break=new_break
            )

        return Response({
            "success": True,
            "message": "Break period started automatically.",
            "break": WorkingBreakSerializer(new_break).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='end-break')
    def end_break(self, request):
        user = request.user

        with transaction.atomic():
            active_breaks = WorkingBreak.objects.select_for_update().filter(
                user=user,
                status='Active'
            )

            if not active_breaks.exists():
                return Response({
                    "success": True,
                    "message": "No active break found to resume from."
                }, status=status.HTTP_200_OK)

            now = timezone.now()
            completed_breaks = []
            for b in active_breaks:
                b.break_end = now
                if b.break_start:
                    b.duration_seconds = max(0, int((now - b.break_start).total_seconds()))
                b.status = 'Completed'
                b.save(update_fields=['break_end', 'duration_seconds', 'status', 'updated_at'])
                completed_breaks.append(b)

            # Mark session as active
            session = WorkingSession.objects.select_for_update().filter(
                user=user,
                status='On Break'
            ).order_by('-created_at').first()

            if session:
                session.status = 'Active'
                session.save(update_fields=['status', 'updated_at'])

        last_break = completed_breaks[-1] if completed_breaks else None
        return Response({
            "success": True,
            "message": "Welcome back! Work resumed successfully.",
            "break": WorkingBreakSerializer(last_break).data if last_break else None
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='breaks')
    def break_history(self, request):
        user = request.user
        qs = WorkingBreak.objects.all().select_related('user', 'session').order_by('-created_at')

        # Filter by employee if not admin or if user_id specified
        user_id_param = request.query_params.get('user_id')
        if not self._is_admin(user):
            qs = qs.filter(user=user)
        elif user_id_param:
            qs = qs.filter(user_id=user_id_param)

        status_param = request.query_params.get('status')
        if status_param and status_param != 'All':
            qs = qs.filter(status=status_param)

        source_param = request.query_params.get('source')
        if source_param and source_param != 'All':
            qs = qs.filter(break_source=source_param)

        # Date range filter
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')
        if from_date:
            qs = qs.filter(break_start__date__gte=from_date)
        if to_date:
            qs = qs.filter(break_start__date__lte=to_date)

        # Search by employee name or email
        search = request.query_params.get('search')
        if search:
            search = search.strip()
            qs = qs.filter(
                models.Q(user__first_name__icontains=search) |
                models.Q(user__last_name__icontains=search) |
                models.Q(user__email__icontains=search) |
                models.Q(user__username__icontains=search) |
                models.Q(break_source__icontains=search)
            )

        breaks = list(qs[:100])
        settings_obj = WalletWorkingSettings.get_settings()
        # Ensure breaks have a resolved threshold_minutes if null
        user_ids = {b.user_id for b in breaks if b.user_id}
        custom_map = dict(
            EmployeeWorkingStatus.objects.filter(user_id__in=user_ids)
            .values_list('user_id', 'custom_idle_threshold_minutes')
        )
        for b in breaks:
            if b.threshold_minutes is None:
                b.threshold_minutes = custom_map.get(b.user_id) or settings_obj.idle_threshold_minutes

        serializer = WorkingBreakSerializer(breaks, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['patch', 'post'], url_path='breaks/(?P<break_id>[^/.]+)/threshold')
    def update_break_threshold(self, request, break_id=None):
        """
        PATCH /api/wallet/working/breaks/<id>/threshold/
        Update the threshold specifically for a break record and optionally update that employee's default threshold.
        """
        threshold = request.data.get('threshold_minutes') or request.data.get('threshold')
        try:
            threshold = int(threshold)
            if threshold < 1:
                return Response({"error": "Threshold must be at least 1 minute."}, status=status.HTTP_400_BAD_REQUEST)
        except (TypeError, ValueError):
            return Response({"error": "Invalid threshold value."}, status=status.HTTP_400_BAD_REQUEST)

        break_obj = WorkingBreak.objects.filter(id=break_id).first()
        if not break_obj:
            return Response({"error": "Break record not found."}, status=status.HTTP_404_NOT_FOUND)

        break_obj.threshold_minutes = threshold
        break_obj.save(update_fields=['threshold_minutes', 'updated_at'])

        # Also set this employee's custom threshold so their future breaks and agent adhere to it without altering global settings
        if break_obj.user_id:
            EmployeeWorkingStatus.objects.filter(user_id=break_obj.user_id).update(
                custom_idle_threshold_minutes=threshold
            )

        return Response({
            "success": True,
            "message": f"Threshold for {break_obj.user.email if break_obj.user else 'employee'} updated to {threshold} minutes.",
            "break": WorkingBreakSerializer(break_obj).data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['patch', 'post'], url_path='employee-threshold')
    def update_employee_threshold(self, request):
        """
        PATCH /api/wallet/working/employee-threshold/
        Set custom idle threshold for an individual employee without affecting other employees or global settings.
        Payload: { "user_id": 106, "threshold_minutes": 15 }
        """
        user_id = request.data.get('user_id')
        threshold = request.data.get('threshold_minutes')
        if not user_id:
            return Response({"error": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            threshold = int(threshold)
            if threshold < 1:
                return Response({"error": "Threshold must be at least 1 minute."}, status=status.HTTP_400_BAD_REQUEST)
        except (TypeError, ValueError):
            return Response({"error": "Invalid threshold value."}, status=status.HTTP_400_BAD_REQUEST)

        status_obj, _ = EmployeeWorkingStatus.objects.get_or_create(
            user_id=user_id,
            defaults={'status': 'ACTIVE', 'last_change': timezone.now(), 'last_activity_at': timezone.now()}
        )
        status_obj.custom_idle_threshold_minutes = threshold
        status_obj.save(update_fields=['custom_idle_threshold_minutes', 'updated_at'])

        # Also update any active break for this user
        WorkingBreak.objects.filter(user_id=user_id, status='Active').update(threshold_minutes=threshold)

        return Response({
            "success": True,
            "message": "Employee threshold updated successfully.",
            "user_id": user_id,
            "custom_idle_threshold_minutes": threshold
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get', 'post'], url_path='status')
    def status_view(self, request):
        """
        GET /api/wallet/working/status/ — retrieve current working idle/active status.
        POST /api/wallet/working/status/ — submit an activity status change from agent or client.
        """
        settings_obj = WalletWorkingSettings.get_settings()

        if request.method == 'GET':
            user = request.user
            # If admin and user_id is passed, get that employee's status; otherwise get current user's
            target_user = user
            target_user_id = request.query_params.get('user_id')
            all_users = request.query_params.get('all') == 'true'

            if self._is_admin(user) and all_users:
                statuses = EmployeeWorkingStatus.objects.select_related('user').all()
                serializer = EmployeeWorkingStatusSerializer(statuses, many=True, context={'settings': settings_obj})
                return Response(serializer.data, status=status.HTTP_200_OK)

            if self._is_admin(user) and target_user_id:
                from register_app.models import CustomUser
                target_user = CustomUser.objects.filter(id=target_user_id).first() or user

            status_obj, created = EmployeeWorkingStatus.objects.get_or_create(
                user=target_user,
                defaults={
                    'status': 'ACTIVE',
                    'last_change': timezone.now(),
                    'last_activity_at': timezone.now(),
                    'last_heartbeat_at': timezone.now(),
                }
            )

            serializer = EmployeeWorkingStatusSerializer(status_obj, context={'settings': settings_obj})
            return Response(serializer.data, status=status.HTTP_200_OK)

        elif request.method == 'POST':
            # Submitting status change
            user = request.user
            new_status = request.data.get('status')
            if new_status not in ['ACTIVE', 'IDLE']:
                return Response(
                    {"error": "Invalid status. Must be ACTIVE or IDLE."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            device_identifier = (request.data.get('device_identifier') or '').strip()
            agent_version = (request.data.get('agent_version') or '').strip()
            last_activity_str = request.data.get('last_activity_at')

            now = timezone.now()
            if timezone.is_aware(now):
                now = timezone.make_naive(now)

            if last_activity_str:
                from django.utils.dateparse import parse_datetime
                parsed_time = parse_datetime(last_activity_str)
                if parsed_time:
                    if timezone.is_aware(parsed_time):
                        parsed_time = timezone.make_naive(parsed_time)
                    last_activity_at = parsed_time
                else:
                    last_activity_at = now
            else:
                last_activity_at = now

            with transaction.atomic():
                status_obj, created = EmployeeWorkingStatus.objects.select_for_update().get_or_create(
                    user=user,
                    defaults={
                        'status': new_status,
                        'last_change': now,
                        'last_activity_at': last_activity_at,
                        'last_heartbeat_at': now,
                        'device_identifier': device_identifier,
                        'agent_version': agent_version,
                    }
                )

                status_changed = (status_obj.status != new_status) or created

                if status_changed:
                    status_obj.status = new_status
                    status_obj.last_change = now
                    # Only append history when status ACTUALLY changes
                    WorkingStatusHistory.objects.create(
                        user=user,
                        status=new_status,
                        changed_at=now,
                        last_activity_at=last_activity_at,
                        device_identifier=device_identifier,
                    )

                    # When status transitions to IDLE, initiate the 30-second confirmation event if monitoring is enabled
                    if new_status == 'IDLE' and settings_obj.monitoring_enabled:
                        from datetime import timedelta
                        countdown_seconds = int(settings_obj.confirmation_countdown_seconds or 30)
                        deadline = now + timedelta(seconds=countdown_seconds)
                        active_session = WorkingSession.objects.filter(
                            user=user,
                            status__in=['Active', 'On Break']
                        ).order_by('-created_at').first()

                        # Only create if there isn't already a pending event
                        has_pending = InactivityEvent.objects.filter(user=user, outcome='PENDING').exists()
                        if not has_pending:
                            InactivityEvent.objects.create(
                                user=user,
                                session=active_session,
                                prompt_time=now,
                                response_deadline=deadline,
                                outcome='PENDING'
                            )

                status_obj.last_activity_at = last_activity_at
                status_obj.last_heartbeat_at = now
                if device_identifier:
                    status_obj.device_identifier = device_identifier
                if agent_version:
                    status_obj.agent_version = agent_version
                status_obj.save()

            serializer = EmployeeWorkingStatusSerializer(status_obj, context={'settings': settings_obj})
            return Response({
                "message": f"Status updated to {new_status}" if status_changed else "Status unchanged (refreshed timestamps).",
                "status_changed": status_changed,
                "data": serializer.data
            }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='heartbeat')
    def heartbeat_view(self, request):
        """
        POST /api/wallet/working/heartbeat/ — report that the tracking agent is connected and running.
        Updates last_heartbeat_at without creating duplicate status history records.
        """
        user = request.user
        device_identifier = (request.data.get('device_identifier') or '').strip()
        agent_version = (request.data.get('agent_version') or '').strip()
        now = timezone.now()

        settings_obj = WalletWorkingSettings.get_settings()

        status_obj, created = EmployeeWorkingStatus.objects.get_or_create(
            user=user,
            defaults={
                'status': 'ACTIVE',
                'last_change': now,
                'last_activity_at': now,
                'last_heartbeat_at': now,
                'device_identifier': device_identifier,
                'agent_version': agent_version,
            }
        )

        status_obj.last_heartbeat_at = now
        if device_identifier:
            status_obj.device_identifier = device_identifier
        if agent_version:
            status_obj.agent_version = agent_version
        status_obj.save(update_fields=['last_heartbeat_at', 'device_identifier', 'agent_version', 'updated_at'])

        effective_idle_threshold = status_obj.custom_idle_threshold_minutes or settings_obj.idle_threshold_minutes

        return Response({
            "success": True,
            "status": status_obj.status,
            "connection_status": "ONLINE",
            "idle_threshold_minutes": effective_idle_threshold,
            "global_idle_threshold_minutes": settings_obj.idle_threshold_minutes,
            "custom_idle_threshold_minutes": status_obj.custom_idle_threshold_minutes,
            "check_interval_seconds": settings_obj.check_interval_seconds,
            "heartbeat_timeout_minutes": settings_obj.heartbeat_timeout_minutes,
            "monitoring_enabled": settings_obj.monitoring_enabled,
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='history')
    def history_view(self, request):
        """
        GET /api/wallet/working/history/ — retrieve status history with date filters and pagination.
        """
        user = request.user
        qs = WorkingStatusHistory.objects.all().select_related('user').order_by('-changed_at')

        # Permission check: regular employees only see their own history
        if not self._is_admin(user):
            qs = qs.filter(user=user)
        else:
            user_id = request.query_params.get('user_id')
            if user_id:
                qs = qs.filter(user_id=user_id)

        status_param = request.query_params.get('status')
        if status_param and status_param != 'All':
            qs = qs.filter(status=status_param)

        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')
        if from_date:
            qs = qs.filter(changed_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(changed_at__date__lte=to_date)

        search = (request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                models.Q(user__first_name__icontains=search) |
                models.Q(user__last_name__icontains=search) |
                models.Q(user__email__icontains=search) |
                models.Q(user__username__icontains=search) |
                models.Q(device_identifier__icontains=search)
            )

        # Pagination
        try:
            page = int(request.query_params.get('page', 1))
            page_size = int(request.query_params.get('page_size', 20))
        except (ValueError, TypeError):
            page = 1
            page_size = 20

        total_count = qs.count()
        start = (page - 1) * page_size
        end = start + page_size

        serializer = WorkingStatusHistorySerializer(qs[start:end], many=True)

        return Response({
            "count": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": (total_count + page_size - 1) // page_size if page_size > 0 else 1,
            "results": serializer.data
        }, status=status.HTTP_200_OK)


class WalletCalendarViewSet(viewsets.ModelViewSet):
    """
    CRUD and orchestration ViewSet for Wallet Calendar & Scheduled Screenshot System.
    Handles:
    - Calendar date schedules (query by month/year/range)
    - Adding, editing, and deleting screenshot capture times per date
    - Apply All functionality (bulk copy with month/year/future scope, merge/replace conflict modes)
    - Recording screen capture outcomes (Captured, Permission Required, Failed, Missed)
    - Uploading authorized screen capture images
    - Querying schedule execution history
    """
    queryset = ScreenshotSchedule.objects.all().order_by('scheduled_date', 'scheduled_time')
    serializer_class = ScreenshotScheduleSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['scheduled_date', 'user__first_name', 'user__last_name', 'user__username', 'user__email']

    def _is_admin(self, user):
        if not user or not user.is_authenticated:
            return False
        if user.is_staff or user.is_superuser:
            return True
        role_name = getattr(getattr(user, 'role', None), 'name', '') or ''
        return role_name.strip().lower() in ['admin', 'administrator', 'super admin', 'manager']

    def get_queryset(self):
        user = self.request.user
        qs = ScreenshotSchedule.objects.filter(is_active=True).select_related('user', 'created_by').prefetch_related('executions')

        # Admin can view all or filter by user; regular user views their own schedules
        user_id_param = self.request.query_params.get('user_id')
        if not self._is_admin(user):
            qs = qs.filter(user=user)
        elif user_id_param:
            qs = qs.filter(user_id=user_id_param)

        # Date range filtering
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            qs = qs.filter(scheduled_date__gte=start_date)
        if end_date:
            qs = qs.filter(scheduled_date__lte=end_date)

        # Month and Year filtering
        year = self.request.query_params.get('year')
        month = self.request.query_params.get('month')
        if year:
            qs = qs.filter(scheduled_date__year=int(year))
        if month:
            qs = qs.filter(scheduled_date__month=int(month))

        # Single date filtering
        date_param = self.request.query_params.get('date')
        if date_param:
            qs = qs.filter(scheduled_date=date_param)

        return qs

    def perform_create(self, serializer):
        user = serializer.validated_data.get('user') or self.request.user
        serializer.save(user=user, created_by=self.request.user)

    def perform_destroy(self, instance):
        from rest_framework import exceptions
        if not self._is_admin(self.request.user) and instance.user != self.request.user:
            raise exceptions.PermissionDenied("You are not authorized to delete this schedule.")
        # Historical executions remain preserved (on_delete=SET_NULL)
        instance.delete()

    @action(detail=False, methods=['post'], url_path='apply-all')
    def apply_all(self, request):
        """
        Applies a source date's screenshot schedule times to all target dates within the specified scope.
        Scopes:
          - 'month': all dates in the selected month
          - 'year': all dates in the selected year
          - 'future': all future dates (from source_date + 1 through 90 days)
        Conflict modes:
          - 'merge': adds source times to target dates without removing existing times
          - 'replace': removes existing future schedules on target dates before applying new times
        """
        serializer = ApplyAllSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        source_date = serializer.validated_data['source_date']
        scope = serializer.validated_data['scope']
        conflict_mode = serializer.validated_data['conflict_mode']
        target_month = serializer.validated_data.get('target_month') or source_date.month
        target_year = serializer.validated_data.get('target_year') or source_date.year

        user = request.user
        target_user_id = request.data.get('user_id')
        target_user = user
        if self._is_admin(user) and target_user_id:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            target_user = User.objects.filter(id=target_user_id).first() or user

        # Retrieve active schedules for source date
        source_schedules = ScreenshotSchedule.objects.filter(
            user=target_user,
            scheduled_date=source_date,
            is_active=True
        ).order_by('scheduled_time')

        if not source_schedules.exists():
            return Response(
                {"error": f"No active screenshot schedules found on source date {source_date} to apply."},
                status=status.HTTP_400_BAD_REQUEST
            )

        source_times = [s.scheduled_time for s in source_schedules]

        # Determine target date range
        import calendar
        from datetime import date, timedelta
        target_dates = []

        if scope == 'month':
            _, num_days = calendar.monthrange(target_year, target_month)
            target_dates = [date(target_year, target_month, day) for day in range(1, num_days + 1)]
        elif scope == 'year':
            curr = date(target_year, 1, 1)
            end_of_year = date(target_year, 12, 31)
            while curr <= end_of_year:
                target_dates.append(curr)
                curr += timedelta(days=1)
        elif scope == 'future':
            curr = source_date + timedelta(days=1)
            max_future = curr + timedelta(days=90)
            while curr <= max_future:
                target_dates.append(curr)
                curr += timedelta(days=1)

        dates_affected = 0
        schedules_created = 0
        schedules_skipped = 0

        with transaction.atomic():
            for t_date in target_dates:
                # If target date is source date, preserve it as is
                if t_date == source_date:
                    continue

                if conflict_mode == 'replace':
                    # Delete existing schedules for this date so new ones replace them
                    # (completed executions remain preserved due to SET_NULL)
                    ScreenshotSchedule.objects.filter(
                        user=target_user,
                        scheduled_date=t_date,
                        is_active=True
                    ).delete()

                date_had_creation = False
                for s_time in source_times:
                    obj, created = ScreenshotSchedule.objects.get_or_create(
                        user=target_user,
                        scheduled_date=t_date,
                        scheduled_time=s_time,
                        defaults={
                            'is_active': True,
                            'created_by': request.user
                        }
                    )
                    if created:
                        schedules_created += 1
                        date_had_creation = True
                    else:
                        schedules_skipped += 1

                if date_had_creation or conflict_mode == 'replace':
                    dates_affected += 1

        return Response({
            "success": True,
            "message": f"Successfully applied {len(source_times)} schedule time(s) to {dates_affected} date(s).",
            "dates_affected": dates_affected,
            "schedules_created": schedules_created,
            "schedules_skipped": schedules_skipped,
            "scope": scope,
            "conflict_mode": conflict_mode
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='capture')
    def record_capture(self, request):
        """
        Receives captured screenshot (file/blob) from authorized capture mechanism (browser session or agent),
        saves the file and records execution state.
        """
        user = request.user
        schedule_id = request.data.get('schedule_id')
        scheduled_date_str = request.data.get('scheduled_date')
        scheduled_time_str = request.data.get('scheduled_time')
        capture_source = request.data.get('capture_source') or 'Browser Session'
        status_val = request.data.get('status') or 'Captured'
        error_message = request.data.get('error_message') or ''
        screenshot_file = request.FILES.get('screenshot_file')

        schedule = None
        if schedule_id:
            schedule = ScreenshotSchedule.objects.filter(id=schedule_id).first()

        scheduled_date = schedule.scheduled_date if schedule else None
        scheduled_time = schedule.scheduled_time if schedule else None

        if not scheduled_date and scheduled_date_str:
            from datetime import datetime
            try:
                scheduled_date = datetime.strptime(scheduled_date_str, '%Y-%m-%d').date()
            except Exception:
                pass

        if not scheduled_time and scheduled_time_str:
            from datetime import datetime
            for fmt in ('%H:%M:%S', '%H:%M', '%I:%M %p', '%I:%M%p'):
                try:
                    scheduled_time = datetime.strptime(scheduled_time_str, fmt).time()
                    break
                except Exception:
                    pass

        if not scheduled_date:
            scheduled_date = get_wallet_local_date()
        if not scheduled_time:
            scheduled_time = get_wallet_local_time()

        from datetime import datetime
        scheduled_datetime = datetime.combine(scheduled_date, scheduled_time)
        if timezone.is_aware(timezone.now()):
            scheduled_datetime = timezone.make_aware(scheduled_datetime)

        # Deduplication check: if an execution already captured this schedule on this date, return existing
        if schedule:
            existing_captured = ScreenshotExecution.objects.filter(
                schedule=schedule,
                scheduled_date=scheduled_date,
                status='Captured'
            ).first()
            if existing_captured:
                return Response({
                    "success": True,
                    "message": "Screenshot already captured and recorded for this scheduled occurrence.",
                    "execution": ScreenshotExecutionSerializer(existing_captured, context={'request': request}).data
                }, status=status.HTTP_200_OK)

        execution = ScreenshotExecution.objects.create(
            schedule=schedule,
            user=schedule.user if schedule else user,
            scheduled_date=scheduled_date,
            scheduled_time=scheduled_time,
            scheduled_datetime=scheduled_datetime,
            executed_at=timezone.now() if status_val == 'Captured' else None,
            status=status_val,
            screenshot_file=screenshot_file,
            error_message=error_message,
            capture_source=capture_source
        )

        # If successfully captured, remove any prior 'Missed' audit executions for this schedule occurrence
        if status_val == 'Captured' and schedule:
            ScreenshotExecution.objects.filter(
                schedule=schedule,
                scheduled_date=scheduled_date,
                status='Missed'
            ).exclude(id=execution.id).delete()

        serializer = ScreenshotExecutionSerializer(execution, context={'request': request})
        return Response({
            "success": True,
            "message": f"Screenshot execution recorded with status: {status_val}.",
            "execution": serializer.data
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='record-status')
    def record_status(self, request):
        """
        Records a non-file execution state (e.g. Permission Required, Missed, Failed).
        """
        schedule_id = request.data.get('schedule_id')
        status_val = request.data.get('status') or 'Permission Required'
        error_msg = request.data.get('error_message') or ''
        capture_source = request.data.get('capture_source') or 'Browser Session'

        schedule = ScreenshotSchedule.objects.filter(id=schedule_id).first()
        if not schedule:
            return Response({"error": "Schedule not found."}, status=status.HTTP_404_NOT_FOUND)

        from datetime import datetime
        scheduled_datetime = datetime.combine(schedule.scheduled_date, schedule.scheduled_time)
        if timezone.is_aware(timezone.now()):
            scheduled_datetime = timezone.make_aware(scheduled_datetime)

        execution = ScreenshotExecution.objects.create(
            schedule=schedule,
            user=schedule.user,
            scheduled_date=schedule.scheduled_date,
            scheduled_time=schedule.scheduled_time,
            scheduled_datetime=scheduled_datetime,
            executed_at=timezone.now(),
            status=status_val,
            error_message=error_msg,
            capture_source=capture_source
        )

        serializer = ScreenshotExecutionSerializer(execution, context={'request': request})
        return Response({
            "success": True,
            "execution": serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='executions')
    def list_executions(self, request):
        user = request.user
        qs = ScreenshotExecution.objects.all().select_related('user', 'schedule').order_by('-scheduled_datetime', '-created_at')

        if not self._is_admin(user):
            qs = qs.filter(user=user)
        else:
            user_id_param = request.query_params.get('user_id')
            if user_id_param:
                qs = qs.filter(user_id=user_id_param)

        date_param = request.query_params.get('date')
        if date_param:
            qs = qs.filter(scheduled_date=date_param)

        status_param = request.query_params.get('status')
        if status_param and status_param != 'All':
            qs = qs.filter(status=status_param)

        serializer = ScreenshotExecutionSerializer(qs[:200], many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='executions')
    def schedule_executions(self, request, pk=None):
        schedule = self.get_object()
        executions = schedule.executions.all().order_by('-executed_at', '-created_at')
        serializer = ScreenshotExecutionSerializer(executions, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='check-missed')
    def check_missed(self, request):
        """
        Evaluates schedules from today or past dates that have passed without execution and records them as Missed.
        """
        today = get_wallet_local_date()
        now_time = get_wallet_local_time()

        from datetime import datetime, timedelta
        # Past dates:
        past_schedules = ScreenshotSchedule.objects.filter(
            scheduled_date__lt=today,
            is_active=True
        ).exclude(executions__status='Captured')

        # Today's elapsed schedules (past by > 15 mins):
        cur_dt = datetime.combine(today, now_time)
        today_schedules = ScreenshotSchedule.objects.filter(
            scheduled_date=today,
            is_active=True
        ).exclude(executions__status='Captured')

        missed_count = 0
        for sched in past_schedules:
            if not sched.executions.filter(status='Missed').exists():
                sched_dt = datetime.combine(sched.scheduled_date, sched.scheduled_time)
                if timezone.is_aware(timezone.now()):
                    sched_dt = timezone.make_aware(sched_dt)
                ScreenshotExecution.objects.create(
                    schedule=sched,
                    user=sched.user,
                    scheduled_date=sched.scheduled_date,
                    scheduled_time=sched.scheduled_time,
                    scheduled_datetime=sched_dt,
                    status='Missed',
                    error_message='Scheduled time elapsed while capture session or user was offline.'
                )
                missed_count += 1

        for sched in today_schedules:
            sched_dt = datetime.combine(today, sched.scheduled_time)
            if cur_dt > sched_dt + timedelta(minutes=15):
                if not sched.executions.filter(status='Missed').exists():
                    if timezone.is_aware(timezone.now()):
                        sched_dt = timezone.make_aware(sched_dt)
                    ScreenshotExecution.objects.create(
                        schedule=sched,
                        user=sched.user,
                        scheduled_date=sched.scheduled_date,
                        scheduled_time=sched.scheduled_time,
                        scheduled_datetime=sched_dt,
                        status='Missed',
                        error_message='Scheduled time elapsed while capture session or user was offline.'
                    )
                    missed_count += 1

        return Response({
            "success": True,
            "message": f"Processed schedules: {missed_count} marked as missed.",
            "missed_count": missed_count
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='pending-captures')
    def pending_captures(self, request):
        """
        Endpoint for automated capture agents (Windows Desktop Agent or background session).
        Returns active schedules for today that need to be captured and have not yet been captured.
        """
        user = request.user
        today = get_wallet_local_date()
        now_time = get_wallet_local_time()

        qs = ScreenshotSchedule.objects.filter(
            user=user,
            scheduled_date=today,
            is_active=True
        ).exclude(
            executions__status='Captured',
            executions__scheduled_date=today
        ).order_by('scheduled_time')

        from datetime import datetime
        pending_list = []
        cur_dt = datetime.combine(today, now_time)

        for sched in qs:
            sched_dt = datetime.combine(today, sched.scheduled_time)
            diff_seconds = (cur_dt - sched_dt).total_seconds()
            # Due if current time is within [scheduled_time - 30 seconds, scheduled_time + 15 minutes]
            is_due = -30 <= diff_seconds <= 900

            pending_list.append({
                "id": sched.id,
                "scheduled_date": str(sched.scheduled_date),
                "scheduled_time": sched.scheduled_time.strftime("%H:%M:%S"),
                "is_due": is_due,
                "diff_seconds": diff_seconds,
                "user_id": sched.user.id,
                "user_email": sched.user.email,
                "user_name": f"{sched.user.first_name} {sched.user.last_name}".strip() or sched.user.username
            })

        return Response({
            "today": str(today),
            "current_time": now_time.strftime("%H:%M:%S"),
            "pending_count": len(pending_list),
            "pending_schedules": pending_list
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='agent-heartbeat')
    def agent_heartbeat(self, request):
        """
        Heartbeat endpoint for the background Windows Desktop Capture Agent.
        Persists to database for cross-process, reliable agent liveness tracking.
        """
        user = request.user
        agent_version = request.data.get('version', '1.2.0')
        hostname = request.data.get('hostname', 'Windows Workstation')
        now_dt = timezone.now()

        hb, _ = ScreenshotAgentHeartbeat.objects.update_or_create(
            user=user,
            defaults={
                'hostname': hostname,
                'version': agent_version,
                'status': 'online',
                'last_seen': now_dt
            }
        )

        data = {
            'last_seen': get_wallet_local_datetime().isoformat(),
            'version': agent_version,
            'hostname': hostname,
            'status': 'online'
        }
        return Response({"success": True, "data": data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='agent-status')
    def agent_status(self, request):
        """
        Retrieves the online status of the automated screenshot capture agent for the user.
        An agent is considered online if a heartbeat was recorded within the last 45 seconds.
        """
        user = request.user
        hb = ScreenshotAgentHeartbeat.objects.filter(user=user).first()
        is_online = False
        agent_info = None

        if hb:
            from datetime import timedelta
            elapsed_seconds = (timezone.now() - hb.last_seen).total_seconds()
            if elapsed_seconds <= 45:
                is_online = True
                agent_info = {
                    'last_seen': hb.last_seen.isoformat(),
                    'version': hb.version,
                    'hostname': hb.hostname,
                    'status': 'online'
                }
            else:
                agent_info = {
                    'last_seen': hb.last_seen.isoformat(),
                    'version': hb.version,
                    'hostname': hb.hostname,
                    'status': 'offline'
                }

        return Response({
            "is_online": is_online,
            "agent_info": agent_info
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='view-screenshot', permission_classes=[AllowAny])
    def view_screenshot(self, request, pk=None):
        """
        Securely serves the captured screenshot image file with authentication checks.
        Prevents unauthorized users from accessing screenshots through public URLs.
        Supports both Authorization header and ?token=<jwt> parameter for <img> tags.
        """
        user = request.user
        if not user or not user.is_authenticated:
            token = request.query_params.get('token')
            if token:
                try:
                    from register_app.authentication import SingleSessionJWTAuthentication
                    auth = SingleSessionJWTAuthentication()
                    validated = auth.get_validated_token(token)
                    user = auth.get_user(validated)
                except Exception:
                    user = None

        if not user or not user.is_authenticated:
            return Response(
                {"error": "Authentication credentials were not provided or are invalid."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        execution = ScreenshotExecution.objects.filter(id=pk).first()
        if not execution:
            sched = ScreenshotSchedule.objects.filter(id=pk).first()
            if sched:
                execution = sched.executions.filter(status='Captured').exclude(screenshot_file='').order_by('-executed_at', '-created_at').first()

        if not execution or not execution.screenshot_file:
            return Response({"error": "Screenshot file not found."}, status=status.HTTP_404_NOT_FOUND)

        if not self._is_admin(user) and execution.user != user:
            return Response({"error": "You are not authorized to view this screenshot."}, status=status.HTTP_403_FORBIDDEN)

        import os
        from django.http import FileResponse, Http404
        try:
            file_path = execution.screenshot_file.path
            if not os.path.exists(file_path):
                raise Http404("File does not exist on disk.")

            content_type = 'image/png' if file_path.lower().endswith('.png') else 'image/jpeg'
            response = FileResponse(open(file_path, 'rb'), content_type=content_type)
            response['Content-Disposition'] = f'inline; filename="{os.path.basename(file_path)}"'
            return response
        except Exception as e:
            return Response({"error": f"Error accessing screenshot: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




