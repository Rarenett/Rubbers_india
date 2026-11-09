from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from .models import (
    WalletMaster,
    WalletTransaction,
    WalletOwnerType,
    WalletScheme,
    WalletReason,
    ScreenshotSchedule,
    ScreenshotExecution,
)

User = get_user_model()


class WalletModuleTestCase(TestCase):
    def setUp(self):
        self.client = APIClient(SERVER_NAME='localhost')
        self.user, _ = User.objects.get_or_create(
            email='wallet_test@example.com',
            defaults={
                'username': 'wallet_tester',
                'first_name': 'Wallet',
                'last_name': 'Tester'
            }
        )
        if not self.user.check_password('Password123!'):
            self.user.set_password('Password123!')
            self.user.save()
        self.client.force_authenticate(user=self.user)

    def test_wallet_master_crud(self):
        """Test Wallet Master creation, validation, update, and deactivation"""
        # 1. Create Wallet
        create_resp = self.client.post('/api/wallet/master/', {
            'wallet_code': 'WAL-TEST01',
            'wallet_name': 'Main Operating Wallet',
            'description': 'Main wallet for testing',
            'status': 'Active'
        }, format='json')
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        wallet_id = create_resp.data['id']
        self.assertEqual(create_resp.data['wallet_code'], 'WAL-TEST01')
        self.assertEqual(create_resp.data['current_balance'], '0.00')

        # 2. Reject duplicate wallet code
        dup_resp = self.client.post('/api/wallet/master/', {
            'wallet_code': 'WAL-TEST01',
            'wallet_name': 'Duplicate Wallet',
            'status': 'Active'
        }, format='json')
        self.assertEqual(dup_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('wallet_code', dup_resp.data)

        # 3. Reject missing wallet name
        invalid_resp = self.client.post('/api/wallet/master/', {
            'wallet_code': 'WAL-TEST02',
            'wallet_name': '',
            'status': 'Active'
        }, format='json')
        self.assertEqual(invalid_resp.status_code, status.HTTP_400_BAD_REQUEST)

        # 4. Edit Wallet
        update_resp = self.client.put(f'/api/wallet/master/{wallet_id}/', {
            'wallet_code': 'WAL-TEST01',
            'wallet_name': 'Main Operating Wallet Updated',
            'description': 'Updated description',
            'status': 'Active'
        }, format='json')
        self.assertEqual(update_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(update_resp.data['wallet_name'], 'Main Operating Wallet Updated')

        # 5. Deactivate Wallet
        deact_resp = self.client.patch(f'/api/wallet/master/{wallet_id}/', {
            'status': 'Inactive'
        }, format='json')
        self.assertEqual(deact_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(deact_resp.data['status'], 'Inactive')

    def test_financial_integrity_transactions(self):
        """Test Credit, Debit, Balance calculation, Overdraft protection, and row safety"""
        wallet = WalletMaster.objects.create(
            wallet_code='WAL-FIN01',
            wallet_name='Petty Cash',
            status='Active'
        )

        # 1. Reject negative or zero amount
        neg_resp = self.client.post('/api/wallet/transactions/', {
            'wallet': wallet.id,
            'transaction_type': 'Credit',
            'amount': '-50.00',
            'transaction_date': str(timezone.localdate())
        }, format='json')
        self.assertEqual(neg_resp.status_code, status.HTTP_400_BAD_REQUEST)

        zero_resp = self.client.post('/api/wallet/transactions/', {
            'wallet': wallet.id,
            'transaction_type': 'Credit',
            'amount': '0.00',
            'transaction_date': str(timezone.localdate())
        }, format='json')
        self.assertEqual(zero_resp.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Reject debit when balance is 0 (overdraft prevention)
        overdraft_resp = self.client.post('/api/wallet/transactions/', {
            'wallet': wallet.id,
            'transaction_type': 'Debit',
            'amount': '100.00',
            'transaction_date': str(timezone.localdate())
        }, format='json')
        self.assertEqual(overdraft_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('amount', overdraft_resp.data)

        # 3. Post Credit transaction of 1,000.00
        credit_resp = self.client.post('/api/wallet/transactions/', {
            'wallet': wallet.id,
            'transaction_type': 'Credit',
            'amount': '1000.00',
            'transaction_date': str(timezone.localdate()),
            'reference_number': 'DEP-1001',
            'description': 'Initial fund deposit'
        }, format='json')
        self.assertEqual(credit_resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(credit_resp.data['transaction_number'].startswith('TXN-'))

        # Verify wallet balance is now 1000.00
        wallet.refresh_from_db()
        self.assertEqual(wallet.get_balance(), Decimal('1000.00'))

        # 4. Post Debit transaction of 400.00
        debit_resp = self.client.post('/api/wallet/transactions/', {
            'wallet': wallet.id,
            'transaction_type': 'Debit',
            'amount': '400.00',
            'transaction_date': str(timezone.localdate()),
            'reference_number': 'EXP-2001',
            'description': 'Office supplies'
        }, format='json')
        self.assertEqual(debit_resp.status_code, status.HTTP_201_CREATED)

        # Verify wallet balance is now 600.00
        wallet.refresh_from_db()
        self.assertEqual(wallet.get_balance(), Decimal('600.00'))

        # 5. Reject Debit greater than remaining balance (e.g. 700.00 > 600.00)
        exceed_resp = self.client.post('/api/wallet/transactions/', {
            'wallet': wallet.id,
            'transaction_type': 'Debit',
            'amount': '700.00',
            'transaction_date': str(timezone.localdate())
        }, format='json')
        self.assertEqual(exceed_resp.status_code, status.HTTP_400_BAD_REQUEST)
        wallet.refresh_from_db()
        self.assertEqual(wallet.get_balance(), Decimal('600.00'))

        # 6. Reject transactions on Inactive wallet
        wallet.status = 'Inactive'
        wallet.save()
        inact_resp = self.client.post('/api/wallet/transactions/', {
            'wallet': wallet.id,
            'transaction_type': 'Credit',
            'amount': '200.00',
            'transaction_date': str(timezone.localdate())
        }, format='json')
        self.assertEqual(inact_resp.status_code, status.HTTP_400_BAD_REQUEST)

        # 7. Protect wallet from deletion when transactions exist
        del_wallet_resp = self.client.delete(f'/api/wallet/master/{wallet.id}/')
        self.assertEqual(del_wallet_resp.status_code, status.HTTP_400_BAD_REQUEST)

        # 8. Protect posted transactions from deletion
        del_txn_resp = self.client.delete(f"/api/wallet/transactions/{credit_resp.data['id']}/")
        self.assertEqual(del_txn_resp.status_code, status.HTTP_400_BAD_REQUEST)

        # 9. Cancel transaction: Cancelling debit of 400 restores balance to 1000
        cancel_debit_resp = self.client.post(
            f"/api/wallet/transactions/{debit_resp.data['id']}/cancel/",
            {'reason': 'Mistaken expense entry'},
            format='json'
        )
        self.assertEqual(cancel_debit_resp.status_code, status.HTTP_200_OK)
        wallet.refresh_from_db()
        self.assertEqual(wallet.get_balance(), Decimal('1000.00'))

    def test_wallet_report(self):
        """Test Wallet Report calculation: opening balance, credits, debits, closing balance"""
        wallet = WalletMaster.objects.create(
            wallet_code='WAL-REP01',
            wallet_name='Report Wallet',
            status='Active'
        )

        today = timezone.localdate()
        past_date = today.replace(day=1) if today.day > 5 else today
        prior_date = past_date - timezone.timedelta(days=10)
        current_date = today

        # 1. Historical transaction before report period (affects opening balance)
        WalletTransaction.objects.create(
            transaction_number='TXN-PRIOR-001',
            transaction_date=prior_date,
            wallet=wallet,
            transaction_type='Credit',
            amount=Decimal('500.00'),
            status='Posted',
            created_by=self.user
        )

        # 2. Transactions within period
        WalletTransaction.objects.create(
            transaction_number='TXN-PERIOD-001',
            transaction_date=current_date,
            wallet=wallet,
            transaction_type='Credit',
            amount=Decimal('300.00'),
            status='Posted',
            created_by=self.user
        )
        WalletTransaction.objects.create(
            transaction_number='TXN-PERIOD-002',
            transaction_date=current_date,
            wallet=wallet,
            transaction_type='Debit',
            amount=Decimal('150.00'),
            status='Posted',
            created_by=self.user
        )
        WalletTransaction.objects.create(
            transaction_number='TXN-PERIOD-003',
            transaction_date=current_date,
            wallet=wallet,
            transaction_type='Debit',
            amount=Decimal('50.00'),
            status='Cancelled',
            cancellation_reason='Cancelled test',
            created_by=self.user
        )

        # Call report API for period: from past_date to current_date
        report_resp = self.client.get('/api/wallet/report/', {
            'wallet': wallet.id,
            'from_date': str(past_date),
            'to_date': str(current_date),
            'status': 'Posted'
        })

        self.assertEqual(report_resp.status_code, status.HTTP_200_OK)
        summary = report_resp.data['summary']

        # Opening balance from prior_date transaction = 500.00
        self.assertEqual(Decimal(summary['opening_balance']), Decimal('500.00'))
        # Total Credit in period = 300.00
        self.assertEqual(Decimal(summary['total_credit']), Decimal('300.00'))
        # Total Debit in period = 150.00 (Cancelled 50.00 is excluded)
        self.assertEqual(Decimal(summary['total_debit']), Decimal('150.00'))
        # Net amount = 300 - 150 = 150.00
        self.assertEqual(Decimal(summary['net_amount']), Decimal('150.00'))
        # Closing balance = 500 + 150 = 650.00
        self.assertEqual(Decimal(summary['closing_balance']), Decimal('650.00'))

    def test_wallet_owner_type_crud(self):
        """Test WalletOwnerType CRUD, unique validation, trimming, and status toggle"""
        # 1. Create valid Owner Type with surrounding whitespace
        create_resp = self.client.post('/api/wallet/owner-types/', {
            'owner_type': '  Test Employee Role  ',
            'description': 'Internal company staff',
            'status': 'Active'
        }, format='json')
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        ot_id = create_resp.data['id']
        self.assertEqual(create_resp.data['owner_type'], 'Test Employee Role')  # Must be trimmed

        # 2. Reject duplicate Owner Type (case-insensitive)
        dup_resp = self.client.post('/api/wallet/owner-types/', {
            'owner_type': 'test employee role',
            'description': 'Duplicate test'
        }, format='json')
        self.assertEqual(dup_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('owner_type', dup_resp.data)

        # 3. Reject empty Owner Type
        empty_resp = self.client.post('/api/wallet/owner-types/', {
            'owner_type': '   ',
            'description': 'Empty test'
        }, format='json')
        self.assertEqual(empty_resp.status_code, status.HTTP_400_BAD_REQUEST)

        # 4. Update Owner Type
        update_resp = self.client.put(f'/api/wallet/owner-types/{ot_id}/', {
            'owner_type': 'Staff Member',
            'description': 'Updated description',
            'status': 'Active'
        }, format='json')
        self.assertEqual(update_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(update_resp.data['owner_type'], 'Staff Member')

        # 5. Toggle Status
        toggle_resp = self.client.patch(f'/api/wallet/owner-types/{ot_id}/toggle-status/')
        self.assertEqual(toggle_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(toggle_resp.data['status'], 'Inactive')

        # 6. Active list endpoint
        active_resp = self.client.get('/api/wallet/owner-types/active/')
        self.assertEqual(active_resp.status_code, status.HTTP_200_OK)
        # Inactive item should not appear in active list
        self.assertFalse(any(item['id'] == ot_id for item in active_resp.data))

        # 7. Delete Owner Type
        del_resp = self.client.delete(f'/api/wallet/owner-types/{ot_id}/')
        self.assertEqual(del_resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(WalletOwnerType.objects.filter(pk=ot_id).exists())

    def test_wallet_schemes_crud(self):
        """Test WalletScheme CRUD, validation, trimming, date consistency, search, and deletion"""
        # 1. Create valid Scheme with surrounding whitespace
        create_resp = self.client.post('/api/wallet/schemes/', {
            'name': '   Festival Cashback 2026   ',
            'start_date': '2026-10-01',
            'end_date': '2026-10-31',
            'remarks': '  Special festival promo  ',
            'criteria': '  Minimum spend of Rs. 1000 required for 10% cashback  '
        }, format='json')
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        scheme_id = create_resp.data['id']
        self.assertEqual(create_resp.data['name'], 'Festival Cashback 2026')
        self.assertEqual(create_resp.data['remarks'], 'Special festival promo')
        self.assertEqual(create_resp.data['criteria'], 'Minimum spend of Rs. 1000 required for 10% cashback')

        # 2. Reject empty Scheme name
        empty_name_resp = self.client.post('/api/wallet/schemes/', {
            'name': '   ',
            'start_date': '2026-10-01',
            'end_date': '2026-10-31',
            'criteria': 'Valid criteria'
        }, format='json')
        self.assertEqual(empty_name_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', empty_name_resp.data)

        # 3. Reject empty Criteria
        empty_crit_resp = self.client.post('/api/wallet/schemes/', {
            'name': 'Valid Scheme',
            'start_date': '2026-10-01',
            'end_date': '2026-10-31',
            'criteria': '   '
        }, format='json')
        self.assertEqual(empty_crit_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('criteria', empty_crit_resp.data)

        # 4. Reject End Date earlier than Start Date
        invalid_date_resp = self.client.post('/api/wallet/schemes/', {
            'name': 'Invalid Date Scheme',
            'start_date': '2026-10-20',
            'end_date': '2026-10-10',
            'criteria': 'Valid criteria'
        }, format='json')
        self.assertEqual(invalid_date_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('end_date', invalid_date_resp.data)

        # 5. Allow optional / empty remarks
        no_remarks_resp = self.client.post('/api/wallet/schemes/', {
            'name': 'No Remarks Scheme',
            'start_date': '2026-11-01',
            'end_date': '2026-11-30',
            'remarks': '',
            'criteria': 'Spend Rs. 500'
        }, format='json')
        self.assertEqual(no_remarks_resp.status_code, status.HTTP_201_CREATED)

        # 6. Retrieve scheme
        get_resp = self.client.get(f'/api/wallet/schemes/{scheme_id}/')
        self.assertEqual(get_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(get_resp.data['id'], scheme_id)

        # 7. Search schemes
        search_resp = self.client.get('/api/wallet/schemes/', {'search': 'Cashback'})
        self.assertEqual(search_resp.status_code, status.HTTP_200_OK)
        results = search_resp.data if isinstance(search_resp.data, list) else search_resp.data.get('results', [])
        self.assertTrue(any(s['id'] == scheme_id for s in results))

        # 8. Update scheme
        update_resp = self.client.put(f'/api/wallet/schemes/{scheme_id}/', {
            'name': 'Festival Cashback 2026 (Extended)',
            'start_date': '2026-10-01',
            'end_date': '2026-11-15',
            'remarks': 'Extended by two weeks',
            'criteria': 'Minimum spend of Rs. 1000'
        }, format='json')
        self.assertEqual(update_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(update_resp.data['name'], 'Festival Cashback 2026 (Extended)')
        self.assertEqual(update_resp.data['end_date'], '2026-11-15')

        # 9. Delete scheme
        del_resp = self.client.delete(f'/api/wallet/schemes/{scheme_id}/')
        self.assertEqual(del_resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(WalletScheme.objects.filter(pk=scheme_id).exists())

    def test_wallet_reason_crud(self):
        """Test WalletReason CRUD, unique validation, trimming, search, active endpoint, and toggle status"""
        # 1. Create valid Reason with surrounding whitespace
        create_resp = self.client.post('/api/wallet/reasons/', {
            'reason': '   Product Return by Customer   ',
            'description': 'Customer returned goods within warranty',
            'status': 'Active'
        }, format='json')
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        reason_id = create_resp.data['id']
        self.assertEqual(create_resp.data['reason'], 'Product Return by Customer')  # Must be trimmed

        # 2. Reject duplicate Reason (case-insensitive)
        dup_resp = self.client.post('/api/wallet/reasons/', {
            'reason': 'product return by customer',
            'description': 'Duplicate test'
        }, format='json')
        self.assertEqual(dup_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('reason', dup_resp.data)

        # 3. Reject empty Reason
        empty_resp = self.client.post('/api/wallet/reasons/', {
            'reason': '   ',
            'description': 'Empty test'
        }, format='json')
        self.assertEqual(empty_resp.status_code, status.HTTP_400_BAD_REQUEST)

        # 4. Update Reason
        update_resp = self.client.put(f'/api/wallet/reasons/{reason_id}/', {
            'reason': 'Defective Product Return',
            'description': 'Updated description',
            'status': 'Active'
        }, format='json')
        self.assertEqual(update_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(update_resp.data['reason'], 'Defective Product Return')

        # 5. Toggle Status
        toggle_resp = self.client.patch(f'/api/wallet/reasons/{reason_id}/toggle-status/')
        self.assertEqual(toggle_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(toggle_resp.data['status'], 'Inactive')

        # 6. Active list endpoint
        active_resp = self.client.get('/api/wallet/reasons/active/')
        self.assertEqual(active_resp.status_code, status.HTTP_200_OK)
        # Inactive item should not appear in active list
        self.assertFalse(any(item['id'] == reason_id for item in active_resp.data))

        # 7. Search Reason
        search_resp = self.client.get('/api/wallet/reasons/?search=Defective')
        self.assertEqual(search_resp.status_code, status.HTTP_200_OK)
        results = search_resp.data if isinstance(search_resp.data, list) else search_resp.data.get('results', [])
        self.assertTrue(any(item['id'] == reason_id for item in results))

        # 8. Delete Reason
        del_resp = self.client.delete(f'/api/wallet/reasons/{reason_id}/')
        self.assertEqual(del_resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(WalletReason.objects.filter(pk=reason_id).exists())

    def test_wallet_working_lifecycle(self):
        """Test Wallet Working settings, inactivity confirmation, automatic break start, multi-tab deduplication, and resumption."""
        # 1. Retrieve initial settings
        settings_resp = self.client.get('/api/wallet/working/settings/')
        self.assertEqual(settings_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(settings_resp.data['inactivity_timeout_minutes'], 5)
        self.assertEqual(settings_resp.data['confirmation_countdown_seconds'], 30)
        self.assertTrue(settings_resp.data['break_tracking_enabled'])
        self.assertTrue(settings_resp.data['monitoring_enabled'])

        # 2. Update settings with validation
        invalid_resp = self.client.patch('/api/wallet/working/settings/', {
            'inactivity_timeout_minutes': 0,
            'confirmation_countdown_seconds': 2
        }, format='json')
        self.assertEqual(invalid_resp.status_code, status.HTTP_400_BAD_REQUEST)

        valid_patch_resp = self.client.patch('/api/wallet/working/settings/', {
            'inactivity_timeout_minutes': 10,
            'confirmation_countdown_seconds': 45
        }, format='json')
        self.assertEqual(valid_patch_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(valid_patch_resp.data['settings']['inactivity_timeout_minutes'], 10)
        self.assertEqual(valid_patch_resp.data['settings']['confirmation_countdown_seconds'], 45)

        # 3. Retrieve working session
        session_resp = self.client.get('/api/wallet/working/session/')
        self.assertEqual(session_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(session_resp.data['session']['status'], 'Active')
        self.assertIsNone(session_resp.data['active_break'])

        # 4. User confirms activity ("Yes, I'm Working")
        confirm_resp = self.client.post('/api/wallet/working/confirm/', format='json')
        self.assertEqual(confirm_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(confirm_resp.data['success'])

        # 5. Start break after inactivity timeout
        start_break_resp = self.client.post('/api/wallet/working/start-break/', {
            'break_source': 'INACTIVITY_TIMEOUT'
        }, format='json')
        self.assertEqual(start_break_resp.status_code, status.HTTP_201_CREATED)
        break_id = start_break_resp.data['break']['id']
        self.assertEqual(start_break_resp.data['break']['status'], 'Active')
        self.assertEqual(start_break_resp.data['break']['break_source'], 'INACTIVITY_TIMEOUT')

        # 6. Verify session transitioned to "On Break"
        session_check = self.client.get('/api/wallet/working/session/')
        self.assertEqual(session_check.data['session']['status'], 'On Break')
        self.assertIsNotNone(session_check.data['active_break'])
        self.assertEqual(session_check.data['active_break']['id'], break_id)

        # 7. Multi-tab deduplication test: Attempt to start break again while already active
        dup_break_resp = self.client.post('/api/wallet/working/start-break/', {
            'break_source': 'INACTIVITY_TIMEOUT'
        }, format='json')
        self.assertEqual(dup_break_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(dup_break_resp.data['break']['id'], break_id)

        # 8. Resume work (end break)
        end_break_resp = self.client.post('/api/wallet/working/end-break/', format='json')
        self.assertEqual(end_break_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(end_break_resp.data['success'])
        self.assertEqual(end_break_resp.data['break']['status'], 'Completed')
        self.assertIsNotNone(end_break_resp.data['break']['break_end'])

        # 9. Verify session back to "Active"
        session_resumed = self.client.get('/api/wallet/working/session/')
        self.assertEqual(session_resumed.data['session']['status'], 'Active')
        self.assertIsNone(session_resumed.data['active_break'])

        # 10. Break history contains the completed break
        breaks_resp = self.client.get('/api/wallet/working/breaks/')
        self.assertEqual(breaks_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(any(item['id'] == break_id for item in breaks_resp.data))

    def test_wallet_report_and_ledger(self):
        """Test Wallet Report summary, filtering, and wallet ledger popup data with running balance."""
        WalletTransaction.objects.filter(transaction_number__in=['TXN-REP01', 'TXN-REP02']).delete()
        WalletMaster.objects.filter(wallet_code='WLT-REP01').delete()

        # 1. Create a wallet for testing report
        wallet = WalletMaster.objects.create(
            wallet_code='WLT-REP01',
            wallet_name='Report Test Wallet',
            owner_type='Employee',
            owner_id='EMP-REP01',
            opening_points=Decimal('100.00'),
            status='Active'
        )

        # 2. Create transactions: 1 Credit, 1 Debit
        WalletTransaction.objects.create(
            transaction_number='TXN-REP01',
            transaction_date='2026-10-10',
            wallet=wallet,
            transaction_type='Credit',
            amount=Decimal('50.00'),
            description='Test Inflow',
            status='Posted'
        )
        WalletTransaction.objects.create(
            transaction_number='TXN-REP02',
            transaction_date='2026-10-15',
            wallet=wallet,
            transaction_type='Debit',
            amount=Decimal('30.00'),
            description='Test Outflow',
            status='Posted'
        )

        # 3. Main report endpoint test
        report_resp = self.client.get('/api/wallet/report/')
        self.assertEqual(report_resp.status_code, status.HTTP_200_OK)
        self.assertIn('summary', report_resp.data)
        self.assertIn('wallets', report_resp.data)
        wallet_entry = next((w for w in report_resp.data['wallets'] if w['id'] == wallet.id), None)
        self.assertIsNotNone(wallet_entry)
        self.assertEqual(wallet_entry['wallet_code'], 'WLT-REP01')
        self.assertEqual(wallet_entry['current_balance'], '120.00') # 100 + 50 - 30

        # 4. Date validation error test (from_date > to_date)
        invalid_resp = self.client.get('/api/wallet/report/?from_date=2026-10-20&to_date=2026-10-10')
        self.assertEqual(invalid_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(invalid_resp.data['error'], 'From Date cannot be later than To Date.')

        # 5. Wallet ledger popup endpoint test
        ledger_resp = self.client.get(f'/api/wallet/report/{wallet.id}/ledger/')
        self.assertEqual(ledger_resp.status_code, status.HTTP_200_OK)
        self.assertIn('wallet', ledger_resp.data)
        self.assertIn('summary', ledger_resp.data)
        self.assertIn('ledger', ledger_resp.data)
        self.assertEqual(ledger_resp.data['summary']['opening_balance'], '100.00')
        self.assertEqual(ledger_resp.data['summary']['closing_balance'], '120.00')
        self.assertEqual(len(ledger_resp.data['ledger']), 2)

        # Verify running balance
        item1 = ledger_resp.data['ledger'][0] # TXN-REP01 (+50)
        item2 = ledger_resp.data['ledger'][1] # TXN-REP02 (-30)
        self.assertEqual(item1['running_balance'], '150.00')
        self.assertEqual(item2['running_balance'], '120.00')

        # 6. Non-existent wallet ledger returns 404
        not_found_resp = self.client.get('/api/wallet/report/999999/ledger/')
        self.assertEqual(not_found_resp.status_code, status.HTTP_404_NOT_FOUND)

        # Cleanup
        WalletTransaction.objects.filter(transaction_number__in=['TXN-REP01', 'TXN-REP02']).delete()
        WalletMaster.objects.filter(wallet_code='WLT-REP01').delete()

    def test_wallet_calendar_schedule_crud(self):
        """Test creating, editing, deduplicating, and deleting calendar screenshot schedules."""
        # 1. Create schedule on 2026-10-20 at 10:00 AM
        resp1 = self.client.post('/api/wallet/calendar/', {
            'scheduled_date': '2026-10-20',
            'scheduled_time': '10:00:00'
        }, format='json')
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED)
        sched_id = resp1.data['id']
        self.assertEqual(resp1.data['scheduled_date'], '2026-10-20')
        self.assertEqual(resp1.data['scheduled_time'], '10:00:00')

        # 2. Add second schedule on same date at 1:00 PM (13:00)
        resp2 = self.client.post('/api/wallet/calendar/', {
            'scheduled_date': '2026-10-20',
            'scheduled_time': '13:00:00'
        }, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_201_CREATED)

        # 3. Add third schedule on same date at 4:30 PM (16:30)
        resp3 = self.client.post('/api/wallet/calendar/', {
            'scheduled_date': '2026-10-20',
            'scheduled_time': '16:30:00'
        }, format='json')
        self.assertEqual(resp3.status_code, status.HTTP_201_CREATED)

        # 4. Reject duplicate schedule on same date and time
        dup_resp = self.client.post('/api/wallet/calendar/', {
            'scheduled_date': '2026-10-20',
            'scheduled_time': '10:00:00'
        }, format='json')
        self.assertEqual(dup_resp.status_code, status.HTTP_400_BAD_REQUEST)

        # 5. Query calendar schedules for October 2026
        list_resp = self.client.get('/api/wallet/calendar/?year=2026&month=10')
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        oct20_schedules = [s for s in list_resp.data if s['scheduled_date'] == '2026-10-20']
        self.assertEqual(len(oct20_schedules), 3)

        # 6. Edit schedule time
        edit_resp = self.client.patch(f'/api/wallet/calendar/{sched_id}/', {
            'scheduled_time': '10:15:00'
        }, format='json')
        self.assertEqual(edit_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(edit_resp.data['scheduled_time'], '10:15:00')

        # 7. Delete schedule
        del_resp = self.client.delete(f'/api/wallet/calendar/{sched_id}/')
        self.assertEqual(del_resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ScreenshotSchedule.objects.filter(id=sched_id).exists())

        # Cleanup remaining
        ScreenshotSchedule.objects.filter(user=self.user).delete()

    def test_wallet_calendar_apply_all(self):
        """Test Apply All functionality across month, year, and future scopes with merge & replace modes."""
        # 1. Setup 3 times on source date 2026-10-20
        source_date = '2026-10-20'
        for t in ['10:00:00', '13:00:00', '16:30:00']:
            ScreenshotSchedule.objects.create(
                user=self.user,
                scheduled_date=source_date,
                scheduled_time=t,
                is_active=True
            )

        # 2. Apply All to October 2026 (month scope) with merge
        apply_resp = self.client.post('/api/wallet/calendar/apply-all/', {
            'source_date': source_date,
            'scope': 'month',
            'conflict_mode': 'merge',
            'target_month': 10,
            'target_year': 2026
        }, format='json')
        self.assertEqual(apply_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(apply_resp.data['success'])
        self.assertEqual(apply_resp.data['dates_affected'], 30) # 31 days in October - 1 source date

        # Verify target date 2026-10-25 has the 3 times
        oct25_schedules = ScreenshotSchedule.objects.filter(
            user=self.user,
            scheduled_date='2026-10-25',
            is_active=True
        ).order_by('scheduled_time')
        self.assertEqual(oct25_schedules.count(), 3)
        self.assertEqual(str(oct25_schedules[0].scheduled_time), '10:00:00')
        self.assertEqual(str(oct25_schedules[1].scheduled_time), '13:00:00')
        self.assertEqual(str(oct25_schedules[2].scheduled_time), '16:30:00')

        # 3. Test duplicate prevention on repeated Apply All (merge mode)
        repeat_resp = self.client.post('/api/wallet/calendar/apply-all/', {
            'source_date': source_date,
            'scope': 'month',
            'conflict_mode': 'merge',
            'target_month': 10,
            'target_year': 2026
        }, format='json')
        self.assertEqual(repeat_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(repeat_resp.data['schedules_created'], 0)
        self.assertGreater(repeat_resp.data['schedules_skipped'], 0)

        # 4. Cleanup
        ScreenshotSchedule.objects.filter(user=self.user).delete()

    def test_wallet_calendar_capture_and_executions(self):
        """Test screenshot capture upload, status tracking, and execution history retention."""
        from django.core.files.uploadedfile import SimpleUploadedFile

        # 1. Create a schedule
        sched = ScreenshotSchedule.objects.create(
            user=self.user,
            scheduled_date='2026-10-20',
            scheduled_time='10:00:00',
            is_active=True
        )

        # 2. Record capture with a dummy image file
        dummy_png = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82'
        upload_file = SimpleUploadedFile("screenshot.png", dummy_png, content_type="image/png")

        capture_resp = self.client.post('/api/wallet/calendar/capture/', {
            'schedule_id': sched.id,
            'scheduled_date': '2026-10-20',
            'scheduled_time': '10:00:00',
            'status': 'Captured',
            'capture_source': 'Browser Session',
            'screenshot_file': upload_file
        }, format='multipart')
        self.assertEqual(capture_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(capture_resp.data['execution']['status'], 'Captured')
        exec_id = capture_resp.data['execution']['id']

        # 3. Verify schedule status is updated to Captured
        list_resp = self.client.get(f'/api/wallet/calendar/?date=2026-10-20')
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(list_resp.data[0]['status'], 'Captured')

        # 4. Deleting schedule does NOT delete execution history (retained for audit)
        sched.delete()
        self.assertTrue(ScreenshotExecution.objects.filter(id=exec_id).exists())
        retained_exec = ScreenshotExecution.objects.get(id=exec_id)
        self.assertIsNone(retained_exec.schedule)
        self.assertEqual(retained_exec.status, 'Captured')

        # 5. Record status without file (Permission Required)
        sched2 = ScreenshotSchedule.objects.create(
            user=self.user,
            scheduled_date='2026-10-21',
            scheduled_time='14:00:00',
            is_active=True
        )
        status_resp = self.client.post('/api/wallet/calendar/record-status/', {
            'schedule_id': sched2.id,
            'status': 'Permission Required',
            'error_message': 'User did not grant screen capture permission.'
        }, format='json')
        self.assertEqual(status_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(status_resp.data['execution']['status'], 'Permission Required')

        # Cleanup
        ScreenshotExecution.objects.filter(user=self.user).delete()
        ScreenshotSchedule.objects.filter(user=self.user).delete()

    def test_wallet_calendar_agent_and_security(self):
        """Test pending-captures, agent heartbeat & status, deduplication, and secure screenshot serving."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        from .models import get_wallet_local_date, get_wallet_local_time

        today = get_wallet_local_date()
        sched_time = get_wallet_local_time()

        # 1. Create a schedule for today
        sched = ScreenshotSchedule.objects.create(
            user=self.user,
            scheduled_date=today,
            scheduled_time=sched_time,
            is_active=True
        )

        # 2. Check pending-captures endpoint
        pending_resp = self.client.get('/api/wallet/calendar/pending-captures/')
        self.assertEqual(pending_resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(pending_resp.data['pending_count'], 1)
        pending_item = next((item for item in pending_resp.data['pending_schedules'] if item['id'] == sched.id), None)
        self.assertIsNotNone(pending_item)
        self.assertTrue(pending_item['is_due'])

        # 3. Agent heartbeat & status
        heartbeat_resp = self.client.post('/api/wallet/calendar/agent-heartbeat/', {
            'version': '1.2.0',
            'hostname': 'TEST-WORKSTATION'
        }, format='json')
        self.assertEqual(heartbeat_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(heartbeat_resp.data['success'])

        status_resp = self.client.get('/api/wallet/calendar/agent-status/')
        self.assertEqual(status_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(status_resp.data['is_online'])
        self.assertEqual(status_resp.data['agent_info']['hostname'], 'TEST-WORKSTATION')

        # 4. Upload screenshot and test deduplication
        dummy_png = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82'
        file1 = SimpleUploadedFile("shot1.png", dummy_png, content_type="image/png")
        cap1 = self.client.post('/api/wallet/calendar/capture/', {
            'schedule_id': sched.id,
            'scheduled_date': str(today),
            'scheduled_time': sched_time.strftime("%H:%M:%S"),
            'status': 'Captured',
            'capture_source': 'Windows Desktop Agent',
            'screenshot_file': file1
        }, format='multipart')
        self.assertEqual(cap1.status_code, status.HTTP_201_CREATED)
        exec_id = cap1.data['execution']['id']

        # Duplicate capture should be prevented
        file2 = SimpleUploadedFile("shot2.png", dummy_png, content_type="image/png")
        cap2 = self.client.post('/api/wallet/calendar/capture/', {
            'schedule_id': sched.id,
            'scheduled_date': str(today),
            'scheduled_time': sched_time.strftime("%H:%M:%S"),
            'status': 'Captured',
            'capture_source': 'Windows Desktop Agent',
            'screenshot_file': file2
        }, format='multipart')
        self.assertEqual(cap2.status_code, status.HTTP_200_OK)
        self.assertIn("already captured", cap2.data['message'].lower())

        # 5. Pending captures should now exclude the captured schedule
        pending_resp_after = self.client.get('/api/wallet/calendar/pending-captures/')
        self.assertFalse(any(item['id'] == sched.id for item in pending_resp_after.data['pending_schedules']))

        # 6. Secure screenshot viewing
        view_resp = self.client.get(f'/api/wallet/calendar/{exec_id}/view-screenshot/')
        self.assertEqual(view_resp.status_code, status.HTTP_200_OK)

        # Unauthorized user cannot view screenshot
        other_user = User.objects.create_user(email='other_user@example.com', username='other_user', password='password')
        other_client = APIClient(SERVER_NAME='localhost')
        other_client.force_authenticate(user=other_user)
        unauth_resp = other_client.get(f'/api/wallet/calendar/{exec_id}/view-screenshot/')
        self.assertEqual(unauth_resp.status_code, status.HTTP_403_FORBIDDEN)

        # Unauthenticated user cannot view without token
        anon_client = APIClient(SERVER_NAME='localhost')
        anon_resp = anon_client.get(f'/api/wallet/calendar/{exec_id}/view-screenshot/')
        self.assertEqual(anon_resp.status_code, status.HTTP_401_UNAUTHORIZED)

        # Cleanup
        ScreenshotExecution.objects.filter(user=self.user).delete()
        ScreenshotSchedule.objects.filter(user=self.user).delete()
        other_user.delete()




