import uuid
from django.test import TestCase
from django.contrib.auth import get_user_model
from finance_app.models import Ledger, AccountGroup
from sales_app.models import SalesOrder, SalesOrderItem, DeliveryLocation
from sales_app.serializers import SalesOrderSerializer
from inventory_app.models import StockItem, StockGroup, Unit
from settings_app.models import Warehouse

User = get_user_model()

class SalesOrderDeliveryLocationTests(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username='salesuser',
            email='salesuser@example.com',
            password='password123'
        )
        self.group = AccountGroup.objects.create(name="Sundry Debtors", nature="Asset")
        self.ledger = Ledger.objects.create(name="Customer A", accountGroup=self.group)
        
        # Additional fields needed for SalesOrderItem
        self.unit = Unit.objects.create(name="Box", uqc_code="BOX")
        self.stock_group = StockGroup.objects.create(name="General Goods")
        self.product = StockItem.objects.create(
            name="Product X",
            stock_group=self.stock_group,
            base_unit=self.unit,
            opening_stock=100
        )
        self.warehouse = Warehouse.objects.create(
            name="Main Warehouse",
            code="WH-001",
            total_capacity=1000.00,
            capacity_unit="units"
        )

    def test_create_sales_order_autosaves_new_delivery_location(self):
        # Initial delivery location count for self.ledger should be 0
        self.assertEqual(DeliveryLocation.objects.filter(customer=self.ledger).count(), 0)

        data = {
            'order_type': 'STATE',
            'entry_date': '2026-06-18',
            'customer_ledger': self.ledger.id,
            'dispatch_through': 'V-1234',
            'driver': '',  # Not strictly validating this in serializer if nullable, but we'll see
            'delivery_location': 'Mannuthy Warehouse',
            'preferred_delivery_date': '2026-06-20T10:00:00Z',
            'items': [
                {
                    'product': self.product.id,
                    'warehouse': self.warehouse.id,
                    'quantity': '10.00',
                    'rate': '15.00',
                    'discount_percent': '0.00',
                    'gst_percent': '18.00',
                    'amount': '150.00'
                }
            ]
        }

        # Bypass driver foreign key validation or create a dummy driver if serializer validation demands it
        # Let's check serializer validation for Driver and preferred_delivery_date
        # Oh, in SalesOrderSerializer:
        # validate() checks:
        # - customer_ledger is required
        # - dispatch_through is required
        # - delivery_location is required
        # - driver is required (if not update)
        # - preferred_delivery_date is required (if not update)
        # So we need to create/provide a driver
        from logistics_app.models import Driver
        self.driver = Driver.objects.create(license_number="DL-12345")
        data['driver'] = self.driver.id

        serializer = SalesOrderSerializer(data=data, context={'request': type('Request', (), {'user': self.user})})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        sales_order = serializer.save()

        # Check if DeliveryLocation record was created
        self.assertEqual(DeliveryLocation.objects.filter(customer=self.ledger).count(), 1)
        loc = DeliveryLocation.objects.get(customer=self.ledger)
        self.assertEqual(loc.location_name, 'Mannuthy Warehouse')

        # Check that creating another SalesOrder with the same location (case insensitive) does not create duplicate
        data2 = data.copy()
        data2['so_no'] = 'SO-002'  # Avoid duplicate key if so_no defaults to something else
        data2['delivery_location'] = '  mannuthy warehouse  '  # different casing and spaces
        serializer2 = SalesOrderSerializer(data=data2, context={'request': type('Request', (), {'user': self.user})})
        self.assertTrue(serializer2.is_valid(), serializer2.errors)
        serializer2.save()

        # Count should still be 1
        self.assertEqual(DeliveryLocation.objects.filter(customer=self.ledger).count(), 1)

    def test_sales_order_item_autosaves_applicable_hsn(self):
        from inventory_app.models import StockItemHSN
        from logistics_app.models import Driver
        driver = Driver.objects.create(license_number="DL-12345")

        # Create multiple HSN records for self.product with different applicable dates
        StockItemHSN.objects.create(stock_item=self.product, hsn_number="HSN-OLD", applicable_date="2026-06-01")
        StockItemHSN.objects.create(stock_item=self.product, hsn_number="HSN-NEW", applicable_date="2026-06-15")

        # Test Case 1: Order date is "2026-06-10" (should select "HSN-OLD" because HSN-NEW is not applicable yet)
        data = {
            'order_type': 'STATE',
            'entry_date': '2026-06-10',
            'customer_ledger': self.ledger.id,
            'dispatch_through': 'V-1234',
            'driver': driver.id,
            'delivery_location': 'Mannuthy Warehouse',
            'preferred_delivery_date': '2026-06-20T10:00:00Z',
            'items': [
                {
                    'product': self.product.id,
                    'warehouse': self.warehouse.id,
                    'quantity': '10.00',
                    'rate': '15.00',
                    'discount_percent': '0.00',
                    'gst_percent': '18.00',
                    'amount': '150.00'
                }
            ]
        }

        serializer = SalesOrderSerializer(data=data, context={'request': type('Request', (), {'user': self.user})})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        order1 = serializer.save()
        item1 = order1.items.first()
        self.assertEqual(item1.hsn, "HSN-OLD")

        # Test Case 2: Order date is "2026-06-20" (should select "HSN-NEW" as it is the latest applicable HSN)
        data['entry_date'] = '2026-06-20'
        serializer2 = SalesOrderSerializer(data=data, context={'request': type('Request', (), {'user': self.user})})
        self.assertTrue(serializer2.is_valid(), serializer2.errors)
        order2 = serializer2.save()
        item2 = order2.items.first()
        self.assertEqual(item2.hsn, "HSN-NEW")

    def test_sales_order_item_autosaves_hsn_fallback_group_and_category(self):
        from inventory_app.models import StockGroupHSN, StockCategoryHSN, StockCategory
        from logistics_app.models import Driver
        driver = Driver.objects.create(license_number="DL-12345")

        # 1. Clear any item-specific HSN records to force fallback
        from inventory_app.models import StockItemHSN
        StockItemHSN.objects.filter(stock_item=self.product).delete()

        # 2. Setup category and assign it to product
        category = StockCategory.objects.create(name="Electronics")
        self.product.stock_category = category
        self.product.save()

        # 3. Configure StockGroupHSN and StockCategoryHSN
        if self.product.stock_group:
            StockGroupHSN.objects.create(stock_group=self.product.stock_group, hsn_number="HSN-GROUP", applicable_date="2026-06-01")
        StockCategoryHSN.objects.create(stock_category=category, hsn_number="HSN-CAT", applicable_date="2026-06-01")

        data = {
            'order_type': 'STATE',
            'entry_date': '2026-06-10',
            'customer_ledger': self.ledger.id,
            'dispatch_through': 'V-1234',
            'driver': driver.id,
            'delivery_location': 'Mannuthy Warehouse',
            'preferred_delivery_date': '2026-06-20T10:00:00Z',
            'items': [
                {
                    'product': self.product.id,
                    'warehouse': self.warehouse.id,
                    'quantity': '10.00',
                    'rate': '15.00',
                    'discount_percent': '0.00',
                    'gst_percent': '18.00',
                    'amount': '150.00'
                }
            ]
        }

        # Save order, should fallback to Group HSN
        serializer = SalesOrderSerializer(data=data, context={'request': type('Request', (), {'user': self.user})})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        order = serializer.save()
        item = order.items.first()
        self.assertEqual(item.hsn, "HSN-GROUP")

        # Remove group HSN to test category HSN fallback
        if self.product.stock_group:
            StockGroupHSN.objects.filter(stock_group=self.product.stock_group).delete()

        serializer2 = SalesOrderSerializer(data=data, context={'request': type('Request', (), {'user': self.user})})
        self.assertTrue(serializer2.is_valid(), serializer2.errors)
        order2 = serializer2.save()
        item2 = order2.items.first()
        self.assertEqual(item2.hsn, "HSN-CAT")


class SalesReturnStockTests(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username='salesuser',
            email='salesuser@example.com',
            password='password123'
        )
        self.group = AccountGroup.objects.create(name="Sundry Debtors", nature="Asset")
        self.ledger = Ledger.objects.create(name="Customer A", accountGroup=self.group)
        self.sales_group = AccountGroup.objects.create(name="Sales Accounts", nature="Revenue")
        self.sales_ledger = Ledger.objects.create(name="Sales Ledger", accountGroup=self.sales_group)
        
        self.unit = Unit.objects.create(name="Box", uqc_code="BOX")
        self.stock_group = StockGroup.objects.create(name="General Goods")
        self.product = StockItem.objects.create(
            name="Product X",
            stock_group=self.stock_group,
            base_unit=self.unit,
            opening_stock=100
        )
        self.warehouse = Warehouse.objects.create(
            name="Main Warehouse",
            code="WH-001",
            total_capacity=1000.00,
            capacity_unit="units"
        )

    def test_create_sales_return_creates_stock_entries(self):
        from sales_app.serializers import SalesReturnSerializer
        from inventory_app.models import StockTable, StockTableDuplicate

        data = {
            'voucher_type': 'B2B Sales',
            'return_type': 'STATE',
            'entry_date': '2026-06-18',
            'customer_ledger': self.ledger.id,
            'sales_ledger': self.sales_ledger.id,
            'sales_invoice_no': 'INV-1234',
            'sales_invoice_date': '2026-06-10',
            'items': [
                {
                    'product': self.product.id,
                    'warehouse': self.warehouse.id,
                    'quantity': '10.00',
                    'rate': '15.00',
                    'amount': '150.00'
                }
            ]
        }

        serializer = SalesReturnSerializer(data=data, context={'request': type('Request', (), {'user': self.user})})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        sales_return = serializer.save()

        # Verify entries exist in StockTable
        stock_entries = StockTable.objects.filter(transaction_type='SALES_RETURN', reference_id=sales_return.id)
        self.assertEqual(stock_entries.count(), 1)
        stock_entry = stock_entries.first()
        self.assertEqual(stock_entry.item, self.product)
        self.assertEqual(stock_entry.movement_type, 'OUT')
        self.assertEqual(float(stock_entry.quantity), 10.00)
        self.assertEqual(float(stock_entry.rate), 15.00)
        self.assertEqual(stock_entry.warehouse, self.warehouse)
        self.assertEqual(stock_entry.verified_by, self.user)
        self.assertTrue(stock_entry.is_active)

        # Verify entries exist in StockTableDuplicate
        dup_entries = StockTableDuplicate.objects.filter(transaction_type='SALES_RETURN', reference_id=sales_return.id)
        self.assertEqual(dup_entries.count(), 1)
        dup_entry = dup_entries.first()
        self.assertEqual(dup_entry.item, self.product)
        self.assertEqual(dup_entry.movement_type, 'OUT')
        self.assertEqual(float(dup_entry.quantity), 10.00)
        self.assertEqual(float(dup_entry.rate), 15.00)
        self.assertEqual(dup_entry.warehouse, self.warehouse)
        self.assertTrue(dup_entry.is_active)

    def test_update_sales_return_updates_stock_entries(self):
        from sales_app.serializers import SalesReturnSerializer
        from inventory_app.models import StockTable, StockTableDuplicate

        data = {
            'voucher_type': 'B2B Sales',
            'return_type': 'STATE',
            'entry_date': '2026-06-18',
            'customer_ledger': self.ledger.id,
            'sales_ledger': self.sales_ledger.id,
            'sales_invoice_no': 'INV-1234',
            'sales_invoice_date': '2026-06-10',
            'items': [
                {
                    'product': self.product.id,
                    'warehouse': self.warehouse.id,
                    'quantity': '10.00',
                    'rate': '15.00',
                    'amount': '150.00'
                }
            ]
        }

        serializer = SalesReturnSerializer(data=data, context={'request': type('Request', (), {'user': self.user})})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        sales_return = serializer.save()

        # Update the quantity and rate
        update_data = {
            'customer_ledger': self.ledger.id,
            'sales_ledger': self.sales_ledger.id,
            'sales_invoice_no': 'INV-1234',
            'sales_invoice_date': '2026-06-10',
            'items': [
                {
                    'id': sales_return.items.first().id,
                    'product': self.product.id,
                    'warehouse': self.warehouse.id,
                    'quantity': '20.00',
                    'rate': '18.00',
                    'amount': '360.00'
                }
            ]
        }

        serializer2 = SalesReturnSerializer(sales_return, data=update_data, context={'request': type('Request', (), {'user': self.user})})
        self.assertTrue(serializer2.is_valid(), serializer2.errors)
        updated_return = serializer2.save()

        # Verify updated entry in StockTable
        stock_entries = StockTable.objects.filter(transaction_type='SALES_RETURN', reference_id=updated_return.id)
        self.assertEqual(stock_entries.count(), 1)
        self.assertEqual(float(stock_entries.first().quantity), 20.00)
        self.assertEqual(float(stock_entries.first().rate), 18.00)

        # Verify updated entry in StockTableDuplicate
        dup_entries = StockTableDuplicate.objects.filter(transaction_type='SALES_RETURN', reference_id=updated_return.id)
        self.assertEqual(dup_entries.count(), 1)
        self.assertEqual(float(dup_entries.first().quantity), 20.00)
        self.assertEqual(float(dup_entries.first().rate), 18.00)

    def test_delete_sales_return_deletes_stock_entries(self):
        from sales_app.serializers import SalesReturnSerializer
        from inventory_app.models import StockTable, StockTableDuplicate

        data = {
            'voucher_type': 'B2B Sales',
            'return_type': 'STATE',
            'entry_date': '2026-06-18',
            'customer_ledger': self.ledger.id,
            'sales_ledger': self.sales_ledger.id,
            'sales_invoice_no': 'INV-1234',
            'sales_invoice_date': '2026-06-10',
            'items': [
                {
                    'product': self.product.id,
                    'warehouse': self.warehouse.id,
                    'quantity': '10.00',
                    'rate': '15.00',
                    'amount': '150.00'
                }
            ]
        }

        serializer = SalesReturnSerializer(data=data, context={'request': type('Request', (), {'user': self.user})})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        sales_return = serializer.save()

        # Verify entries exist first
        self.assertEqual(StockTable.objects.filter(transaction_type='SALES_RETURN', reference_id=sales_return.id).count(), 1)
        self.assertEqual(StockTableDuplicate.objects.filter(transaction_type='SALES_RETURN', reference_id=sales_return.id).count(), 1)

        # Delete sales return
        sales_return.delete()

        # Verify entries are deleted from StockTable and StockTableDuplicate
        self.assertEqual(StockTable.objects.filter(transaction_type='SALES_RETURN', reference_id=sales_return.id).count(), 0)
        self.assertEqual(StockTableDuplicate.objects.filter(transaction_type='SALES_RETURN', reference_id=sales_return.id).count(), 0)


# ---------------------------------------------------------------------------
# Tally GUID Persistence Tests
# ---------------------------------------------------------------------------
# These tests verify the full lifecycle that fixes the "duplicate entry" bug:
#
#   1. First push (Create) → tally_guid is saved on the model after success.
#   2. Edit resets sync_status → second push must still produce ACTION="Alter"
#      using the SAME original tally_guid (not a freshly derived one).
#   3. Legacy row (no tally_guid, but has a success sync_log) → fallback
#      resolves a guid AND backfills tally_guid so the path runs only once.
#
# No real Tally server is required; requests.post is mocked throughout.
# ---------------------------------------------------------------------------

from unittest.mock import patch, MagicMock
from sales_app.utils.tally_xml import resolve_voucher_sync_context


class _FakeSyncLog:
    """Minimal stand-in for a SalesOrder/Invoice/Return SyncLog instance."""
    def __init__(self, tally_response="", status="success"):
        self.tally_response = tally_response
        self.status = status
        self.attempted_at = None


class _FakeSyncLogsManager:
    """Mimics the .sync_logs reverse relation on a voucher object."""
    def __init__(self, logs=None):
        self._logs = logs or []

    def filter(self, **kwargs):
        status = kwargs.get("status")
        if status:
            filtered = [l for l in self._logs if l.status == status]
        else:
            filtered = self._logs
        return _FakeSyncLogsManager(filtered)

    def order_by(self, *args):
        return self

    def first(self):
        return self._logs[0] if self._logs else None


class _FakeVoucher:
    """Minimal stand-in for a SalesOrder / SalesInvoice / SalesReturn instance."""
    def __init__(self, tally_guid=None, is_synced=False, sync_status="pending", sync_logs=None):
        self.id = 1
        self.tally_guid = tally_guid
        self.is_synced = is_synced
        self.sync_status = sync_status
        self.sync_logs = _FakeSyncLogsManager(sync_logs or [])
        self._saved_fields = None

    def save(self, update_fields=None):
        self._saved_fields = update_fields


class TallyGuidPersistenceTests(TestCase):
    """
    Verifies resolve_voucher_sync_context() and tally_service GUID persistence.
    """

    DEFAULT_PREFIX = "703950cb-0cfb-4a51-8739-10166bf72dc0"

    # ------------------------------------------------------------------
    # resolve_voucher_sync_context tests (unit-level, no DB, no network)
    # ------------------------------------------------------------------

    def _ctx(self, obj, voucher_number="SO-001", voucher_type_name="Sales Order"):
        """Helper that calls resolve_voucher_sync_context with network stubbed out."""
        with patch("sales_app.utils.tally_xml.get_tally_existing_voucher_info",
                   return_value={"exists": False, "remote_id": None, "guid": None}):
            return resolve_voucher_sync_context(
                obj=obj,
                voucher_number=voucher_number,
                voucher_type_name=voucher_type_name,
                default_prefix=self.DEFAULT_PREFIX,
            )

    def test_fresh_voucher_produces_create(self):
        """A brand-new voucher with no history should produce ACTION=Create."""
        obj = _FakeVoucher(tally_guid=None, is_synced=False, sync_status="pending")
        ctx = self._ctx(obj)
        self.assertEqual(ctx["action"], "Create")
        self.assertIsNotNone(ctx["guid"])

    def test_fresh_create_guid_is_deterministic(self):
        """Same voucher number always generates the same deterministic GUID."""
        obj1 = _FakeVoucher()
        obj2 = _FakeVoucher()
        ctx1 = self._ctx(obj1, voucher_number="SO-001")
        ctx2 = self._ctx(obj2, voucher_number="SO-001")
        self.assertEqual(ctx1["guid"], ctx2["guid"])

    def test_persisted_tally_guid_short_circuits_to_alter(self):
        """
        Fast path: if obj.tally_guid is set, resolve_voucher_sync_context must
        return Alter with that exact GUID — no DB or network needed.
        """
        persisted = "703950cb-0cfb-4a51-8739-10166bf72dc0-00000001"
        obj = _FakeVoucher(tally_guid=persisted, is_synced=False, sync_status="pending")
        # Even if Tally says "doesn't exist", the persisted GUID wins.
        with patch("sales_app.utils.tally_xml.get_tally_existing_voucher_info") as mock_tally:
            ctx = resolve_voucher_sync_context(
                obj=obj,
                voucher_number="SO-001",
                voucher_type_name="Sales Order",
                default_prefix=self.DEFAULT_PREFIX,
            )
            # Network call must NOT be made when tally_guid is already set.
            mock_tally.assert_not_called()

        self.assertEqual(ctx["action"], "Alter")
        self.assertEqual(ctx["guid"], persisted)
        self.assertEqual(ctx["remote_id"], persisted)
        self.assertTrue(ctx["is_existing"])

    def test_edited_voucher_reuses_original_tally_guid(self):
        """
        The core regression test:
        After an edit resets sync_status to 'pending' / is_synced to False,
        the NEXT push must still produce Alter with the ORIGINAL tally_guid.
        """
        original_guid = "703950cb-0cfb-4a51-8739-10166bf72dc0-00000001"

        # Simulate the state after edit: sync_status reset, is_synced False,
        # but tally_guid still holds the original value.
        obj = _FakeVoucher(
            tally_guid=original_guid,
            is_synced=False,
            sync_status="pending",
        )
        with patch("sales_app.utils.tally_xml.get_tally_existing_voucher_info") as mock_tally:
            ctx = resolve_voucher_sync_context(
                obj=obj,
                voucher_number="SO-001",
                voucher_type_name="Sales Order",
                default_prefix=self.DEFAULT_PREFIX,
            )
            mock_tally.assert_not_called()

        self.assertEqual(ctx["action"], "Alter",
            "Expected ACTION=Alter after edit but got Create — "
            "this is the duplicate-entry bug!")
        self.assertEqual(ctx["guid"], original_guid,
            "GUID must be the original persisted value, not freshly derived!")

    def test_legacy_row_backfills_tally_guid(self):
        """
        Legacy row: tally_guid is empty but there is a successful sync_log.
        The fallback must resolve a GUID AND backfill obj.tally_guid.
        """
        obj = _FakeVoucher(
            tally_guid=None,
            is_synced=False,
            sync_status="pending",
            sync_logs=[_FakeSyncLog(
                tally_response="<RESPONSE><CREATED>1</CREATED></RESPONSE>",
                status="success",
            )],
        )
        with patch("sales_app.utils.tally_xml.get_tally_existing_voucher_info",
                   return_value={"exists": False, "remote_id": None, "guid": None}):
            ctx = resolve_voucher_sync_context(
                obj=obj,
                voucher_number="SO-001",
                voucher_type_name="Sales Order",
                default_prefix=self.DEFAULT_PREFIX,
            )

        # sync_log detected → is_existing=True → Alter
        self.assertTrue(ctx["is_existing"])
        self.assertEqual(ctx["action"], "Alter")
        # tally_guid must have been backfilled
        self.assertIsNotNone(obj.tally_guid,
            "tally_guid should have been backfilled for legacy row!")
        self.assertEqual(obj.tally_guid, ctx["guid"])
        self.assertIn("tally_guid", (obj._saved_fields or []))

    def test_order_by_uses_newest_log(self):
        """
        Regression: old code used order_by('attempted_at') which picked the
        OLDEST log (often the very first, possibly a failed attempt with no GUID).
        New code uses order_by('-attempted_at') — verify newest log wins.
        """
        from datetime import datetime, timedelta
        import django.utils.timezone as tz

        old_log = _FakeSyncLog(
            tally_response="<OLD><CREATED>1</CREATED></OLD>",
            status="success",
        )
        # Newest log has a recognisable GUID tag that we can check for.
        new_log = _FakeSyncLog(
            tally_response="<NEW><GUID>NEWEST-GUID-VALUE</GUID><CREATED>1</CREATED></NEW>",
            status="success",
        )

        # Our _FakeSyncLogsManager.first() returns the first element of the
        # internal list — so we put the newest one first, mimicking -attempted_at.
        obj = _FakeVoucher(
            tally_guid=None,
            sync_logs=[new_log, old_log],  # newest first (correct order after fix)
        )
        with patch("sales_app.utils.tally_xml.get_tally_existing_voucher_info",
                   return_value={"exists": False, "remote_id": None, "guid": None}):
            ctx = resolve_voucher_sync_context(
                obj=obj,
                voucher_number="SO-001",
                voucher_type_name="Sales Order",
                default_prefix=self.DEFAULT_PREFIX,
            )

        self.assertEqual(ctx["guid"], "NEWEST-GUID-VALUE",
            "resolve_voucher_sync_context must use the NEWEST success log, not the oldest!")

    # ------------------------------------------------------------------
    # tally_service GUID persistence tests (mock requests.post)
    # ------------------------------------------------------------------

    def _make_tally_success_response(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "<RESPONSE><CREATED>1</CREATED><ALTERED>0</ALTERED></RESPONSE>"
        return mock_resp

    def test_push_sales_order_saves_tally_guid_on_success(self):
        """
        After a successful push of a new SalesOrder, tally_guid must be saved
        to the model so future Alter pushes can bypass re-derivation.
        """
        from sales_app.models import SalesOrder, SalesOrderSyncLog
        from finance_app.models import Ledger, AccountGroup
        from sales_app.services.tally_service import push_sales_order_to_tally

        grp, _ = AccountGroup.objects.get_or_create(name="Debtors", defaults={"nature": "Asset"})
        ledger, _ = Ledger.objects.get_or_create(name="Test Customer Test SO", defaults={"accountGroup": grp})
        order = SalesOrder.objects.create(
            so_no=f"SO-TEST-{uuid.uuid4().hex[:6]}",
            customer_ledger=ledger,
            total_amount=100,
        )
        self.assertIsNone(order.tally_guid)

        mock_resp = self._make_tally_success_response()

        with patch("sales_app.services.tally_service.requests.post", return_value=mock_resp), \
             patch("sales_app.utils.tally_xml.requests.post", return_value=mock_resp), \
             patch("sales_app.utils.tally_xml.get_tally_active_company", return_value=None), \
             patch("sales_app.utils.tally_xml.get_tally_existing_voucher_info",
                   return_value={"exists": False, "remote_id": None, "guid": None}):
            result = push_sales_order_to_tally(order, tally_url="http://localhost:9000")

        self.assertTrue(result["success"], result.get("message"))
        order.refresh_from_db()
        self.assertIsNotNone(order.tally_guid,
            "tally_guid must be set after a successful Create push!")

    def test_push_sales_order_second_push_produces_alter(self):
        """
        After a successful first push (tally_guid saved), editing the order
        (sync_status reset to pending) and pushing again must produce Alter,
        not Create — verifying the core bug fix.
        """
        from sales_app.models import SalesOrder
        from finance_app.models import Ledger, AccountGroup
        from sales_app.utils.tally_xml import generate_sales_order_xml

        grp = AccountGroup.objects.create(name="Debtors2", nature="Asset")
        ledger = Ledger.objects.create(name="Test Customer 2", accountGroup=grp)

        known_guid = "703950cb-0cfb-4a51-8739-10166bf72dc0-00000042"
        order = SalesOrder.objects.create(
            so_no="SO-TEST-002",
            customer_ledger=ledger,
            total_amount=200,
            is_synced=False,
            sync_status="pending",
            tally_guid=known_guid,  # already persisted from first push
        )

        with patch("sales_app.utils.tally_xml.get_tally_active_company", return_value=None), \
             patch("sales_app.utils.tally_xml.get_tally_existing_voucher_info",
                   return_value={"exists": False, "remote_id": None, "guid": None}):
            xml = generate_sales_order_xml(order)

        self.assertIn('ACTION="Alter"', xml,
            "Second push must use ACTION=Alter, not Create!")
        self.assertIn(f'REMOTEID="{known_guid}"', xml,
            "Second push must embed the original tally_guid as REMOTEID!")

    def test_push_does_not_overwrite_existing_tally_guid(self):
        """
        If tally_guid is already set and the push succeeds again (e.g. Alter
        succeeded), the existing tally_guid must NOT be overwritten.
        """
        from sales_app.models import SalesOrder
        from finance_app.models import Ledger, AccountGroup
        from sales_app.services.tally_service import push_sales_order_to_tally

        grp, _ = AccountGroup.objects.get_or_create(name="Debtors3", defaults={"nature": "Asset"})
        ledger, _ = Ledger.objects.get_or_create(name="Test Customer 3", defaults={"accountGroup": grp})

        original_guid = "703950cb-0cfb-4a51-8739-10166bf72dc0-ORIGINAL"
        order = SalesOrder.objects.create(
            so_no=f"SO-TEST-{uuid.uuid4().hex[:6]}",
            customer_ledger=ledger,
            total_amount=300,
            tally_guid=original_guid,
        )

        mock_resp = self._make_tally_success_response()

        with patch("sales_app.services.tally_service.requests.post", return_value=mock_resp), \
             patch("sales_app.utils.tally_xml.requests.post", return_value=mock_resp), \
             patch("sales_app.utils.tally_xml.get_tally_active_company", return_value=None), \
             patch("sales_app.utils.tally_xml.get_tally_existing_voucher_info",
                   return_value={"exists": False, "remote_id": None, "guid": None}):
            result = push_sales_order_to_tally(order, tally_url="http://localhost:9000")

        self.assertTrue(result["success"], result.get("message"))
        order.refresh_from_db()
        self.assertEqual(order.tally_guid, original_guid,
            "tally_guid must NEVER be overwritten once set!")

    def test_push_auto_recovers_when_tally_exceptions_returned(self):
        """
        When first push attempt fails with EXCEPTIONS (duplicate voucher),
        retry logic must query Tally live for the actual REMOTEID, update
        tally_guid on the model, and Alter the voucher successfully.
        """
        from sales_app.models import SalesOrder
        from finance_app.models import Ledger, AccountGroup
        from sales_app.services.tally_service import push_sales_order_to_tally
        from unittest.mock import MagicMock

        grp, _ = AccountGroup.objects.get_or_create(name="DebtorsRecovery", defaults={"nature": "Asset"})
        ledger, _ = Ledger.objects.get_or_create(name="Customer Recovery", defaults={"accountGroup": grp})

        order = SalesOrder.objects.create(
            so_no=f"SO-REC-{uuid.uuid4().hex[:6]}",
            customer_ledger=ledger,
            total_amount=500,
            tally_guid="phantom-wrong-guid",
        )

        # First push response: EXCEPTIONS
        first_resp = MagicMock()
        first_resp.status_code = 200
        first_resp.text = "<RESPONSE><CREATED>0</CREATED><ALTERED>0</ALTERED><EXCEPTIONS>1</EXCEPTIONS></RESPONSE>"

        # Retry push response: ALTERED=1
        retry_resp = MagicMock()
        retry_resp.status_code = 200
        retry_resp.text = "<RESPONSE><CREATED>0</CREATED><ALTERED>1</ALTERED><EXCEPTIONS>0</EXCEPTIONS></RESPONSE>"

        tally_true_id = "real-tally-guid-12345"

        with patch("sales_app.utils.tally_xml.get_tally_sales_ledgers", return_value={}), \
             patch("sales_app.utils.tally_xml.get_tally_active_company", return_value=None), \
             patch("sales_app.services.tally_service.get_tally_existing_voucher_info",
                   return_value={"exists": True, "remote_id": tally_true_id, "guid": tally_true_id}), \
             patch("requests.post", side_effect=[first_resp, retry_resp]):
            result = push_sales_order_to_tally(order, tally_url="http://localhost:9000")

        self.assertTrue(result["success"], result.get("message"))
        order.refresh_from_db()
        self.assertEqual(order.tally_guid, tally_true_id,
            "tally_guid must be updated to the true REMOTEID discovered from Tally!")
        self.assertEqual(order.sync_status, "synced")


class TallyAgentEndpointsTests(TestCase):
    """
    Unit tests for Tally Agent pull/queue endpoints:
    - /api/sales/tally/agent/heartbeat/
    - /api/sales/tally/agent/poll/
    - /api/sales/tally/agent/result/
    """
    def setUp(self):
        from django.test import Client
        self.client = Client(HTTP_HOST='localhost')
        from sales_app.models import TallySyncConfig
        TallySyncConfig.objects.all().delete()
        self.config = TallySyncConfig.objects.create(
            voucher_type='Sales Order',
            agent_key='test-secret-key',
            tally_url='http://localhost:9000'
        )

    def test_heartbeat_unauthorized_without_key(self):
        resp = self.client.post('/api/sales/tally/agent/heartbeat/', {'company_name': 'Test Co'}, content_type='application/json')
        self.assertEqual(resp.status_code, 401)

    def test_heartbeat_success_updates_config(self):
        resp = self.client.post(
            '/api/sales/tally/agent/heartbeat/',
            {'company_name': 'My Client Co', 'agent_key': 'test-secret-key'},
            content_type='application/json'
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['status'], 'ok')
        self.config.refresh_from_db()
        self.assertEqual(self.config.agent_company, 'My Client Co')
        self.assertIsNotNone(self.config.agent_last_seen)

    def test_poll_returns_empty_when_no_pending(self):
        resp = self.client.get('/api/sales/tally/agent/poll/?agent_key=test-secret-key')
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.json()['has_item'])

    def test_poll_and_result_workflow(self):
        from sales_app.models import SalesOrder
        ledger = LedgerMaster.objects.create(name=f"Customer-{uuid.uuid4().hex[:6]}")
        order = SalesOrder.objects.create(
            so_no=f"SO-POLL-{uuid.uuid4().hex[:6]}",
            customer_ledger=ledger,
            total_amount=1200,
            sync_status='pending',
            is_synced=False
        )

        with patch("sales_app.utils.tally_xml.get_tally_sales_ledgers", return_value={}), \
             patch("sales_app.utils.tally_xml.get_tally_active_company", return_value=None):
            poll_resp = self.client.get('/api/sales/tally/agent/poll/?agent_key=test-secret-key')

        self.assertEqual(poll_resp.status_code, 200)
        poll_data = poll_resp.json()
        self.assertTrue(poll_data['has_item'])
        self.assertEqual(poll_data['voucher_type'], 'Sales Order')
        self.assertEqual(poll_data['voucher_id'], order.id)
        self.assertIn('<ENVELOPE>', poll_data['xml_payload'])

        # Now simulate agent posting to Tally and submitting success result
        tally_success_xml = (
            "<RESPONSE>"
            "<CREATED>1</CREATED>"
            "<ALTERED>0</ALTERED>"
            "<EXCEPTIONS>0</EXCEPTIONS>"
            "<LASTVCHID>100</LASTVCHID>"
            "</RESPONSE>"
        )

        result_resp = self.client.post(
            '/api/sales/tally/agent/result/',
            {
                'agent_key': 'test-secret-key',
                'voucher_type': 'Sales Order',
                'voucher_id': order.id,
                'tally_response': tally_success_xml,
                'xml_payload': poll_data['xml_payload']
            },
            content_type='application/json'
        )

        self.assertEqual(result_resp.status_code, 200)
        self.assertEqual(result_resp.json()['status'], 'synced')

        order.refresh_from_db()
        self.assertTrue(order.is_synced)
        self.assertEqual(order.sync_status, 'synced')
        self.assertIsNotNone(order.tally_guid)
