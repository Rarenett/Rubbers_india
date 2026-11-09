from django.test import TestCase
from django.contrib.auth import get_user_model
from finance_app.models import Ledger, AccountGroup
from purchase_app.models import PurchaseOrder, PurchaseOrderItem
from purchase_app.serializers import PurchaseOrderSerializer
from inventory_app.models import StockItem, StockGroup, Unit
from settings_app.models import Warehouse

User = get_user_model()

class PurchaseOrderItemHSNTests(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username='purchaseuser',
            email='purchaseuser@example.com',
            password='password123'
        )
        self.group = AccountGroup.objects.create(name="Sundry Creditors", nature="Liability")
        self.ledger = Ledger.objects.create(name="Supplier A", accountGroup=self.group)
        
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

    def test_purchase_order_item_autosaves_applicable_hsn(self):
        from inventory_app.models import StockItemHSN

        # Create multiple HSN records for self.product with different applicable dates
        StockItemHSN.objects.create(stock_item=self.product, hsn_number="HSN-OLD", applicable_date="2026-06-01")
        StockItemHSN.objects.create(stock_item=self.product, hsn_number="HSN-NEW", applicable_date="2026-06-15")

        # Test Case 1: Order date is "2026-06-10" (should select "HSN-OLD")
        data = {
            'po_no': 'PO-00001',
            'order_type': 'STATE',
            'entry_date': '2026-06-10',
            'supplier_ledger': self.ledger.id,
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

        serializer = PurchaseOrderSerializer(data=data, context={'request': type('Request', (), {'user': self.user})})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        order1 = serializer.save()
        item1 = order1.items.first()
        self.assertEqual(item1.hsn, "HSN-OLD")

        # Test Case 2: Order date is "2026-06-20" (should select "HSN-NEW")
        data2 = data.copy()
        data2['po_no'] = 'PO-00002'
        data2['entry_date'] = '2026-06-20'
        serializer2 = PurchaseOrderSerializer(data=data2, context={'request': type('Request', (), {'user': self.user})})
        self.assertTrue(serializer2.is_valid(), serializer2.errors)
        order2 = serializer2.save()
        item2 = order2.items.first()
        self.assertEqual(item2.hsn, "HSN-NEW")

    def test_purchase_order_item_autosaves_hsn_fallback_group_and_category(self):
        from inventory_app.models import StockGroupHSN, StockCategoryHSN, StockCategory
        from inventory_app.models import StockItemHSN
        
        # 1. Clear any item-specific HSN records to force fallback
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
            'po_no': 'PO-00003',
            'order_type': 'STATE',
            'entry_date': '2026-06-10',
            'supplier_ledger': self.ledger.id,
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
        serializer = PurchaseOrderSerializer(data=data, context={'request': type('Request', (), {'user': self.user})})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        order = serializer.save()
        item = order.items.first()
        self.assertEqual(item.hsn, "HSN-GROUP")

        # Remove group HSN to test category HSN fallback
        if self.product.stock_group:
            StockGroupHSN.objects.filter(stock_group=self.product.stock_group).delete()

        data2 = data.copy()
        data2['po_no'] = 'PO-00004'
        serializer2 = PurchaseOrderSerializer(data=data2, context={'request': type('Request', (), {'user': self.user})})
        self.assertTrue(serializer2.is_valid(), serializer2.errors)
        order2 = serializer2.save()
        item2 = order2.items.first()
        self.assertEqual(item2.hsn, "HSN-CAT")

    def test_purchase_order_resolve_gst_hsn_view(self):
        from inventory_app.models import StockGroupGST, StockGroupHSN, StockCategoryGST, StockCategoryHSN, StockCategory
        from inventory_app.models import StockItemGST, StockItemHSN
        from django.urls import reverse

        # Setup category
        category = StockCategory.objects.create(name="Electronics-Resolve")
        self.product.stock_category = category
        self.product.save()

        # Clear item/group specific GST and HSN to force category fallback
        StockItemGST.objects.filter(stock_item=self.product).delete()
        StockItemHSN.objects.filter(stock_item=self.product).delete()
        if self.product.stock_group:
            StockGroupGST.objects.filter(stock_group=self.product.stock_group).delete()
            StockGroupHSN.objects.filter(stock_group=self.product.stock_group).delete()

        # Category GST active 2026-06-01 (12%) and HSN
        StockCategoryGST.objects.create(stock_category=category, tax_gst_type="goods", igst_percent=12.00, applicable_date="2026-06-01")
        StockCategoryHSN.objects.create(stock_category=category, hsn_number="HSN-CAT-TEST", applicable_date="2026-06-01")

        # Query endpoint
        from rest_framework_simplejwt.tokens import AccessToken
        token = AccessToken.for_user(self.user)
        auth_headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
        url = reverse('resolve-gst-hsn')
        
        # Test 1: Date is before applicable_date (should return fallback overall)
        response = self.client.get(url, {'product_id': self.product.id, 'date': '2026-05-15'}, **auth_headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['gst_percent'], 12.00)
        self.assertEqual(response.json()['hsn'], "HSN-CAT-TEST")

        # Test 2: Date is on/after applicable_date
        response2 = self.client.get(url, {'product_id': self.product.id, 'date': '2026-06-10'}, **auth_headers)
        self.assertEqual(response2.status_code, 200)
        self.assertEqual(response2.json()['gst_percent'], 12.00)
        self.assertEqual(response2.json()['hsn'], "HSN-CAT-TEST")


class PurchaseInvoiceValidationTests(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username='purchaseuser2',
            email='purchaseuser2@example.com',
            password='password123'
        )
        self.group = AccountGroup.objects.create(name="Sundry Creditors", nature="Liability")
        self.ledger = Ledger.objects.create(name="Supplier B", accountGroup=self.group)
        self.purchase_group = AccountGroup.objects.create(name="Purchase Accounts", nature="Expense")
        self.purchase_ledger = Ledger.objects.create(name="Purchase Ledger", accountGroup=self.purchase_group)
        self.unit = Unit.objects.create(name="Box", uqc_code="BOX")
        self.stock_group = StockGroup.objects.create(name="General Goods")
        self.product = StockItem.objects.create(
            name="Product Y",
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
        self.cgst_ledger = Ledger.objects.create(name="CGST Ledger", accountGroup=self.purchase_group)
        self.sgst_ledger = Ledger.objects.create(name="SGST Ledger", accountGroup=self.purchase_group)
        self.igst_ledger = Ledger.objects.create(name="IGST Ledger", accountGroup=self.purchase_group)

    def test_missing_supplier_invoice_no_raises_validation_error(self):
        from purchase_app.serializers import PurchaseInvoiceSerializer
        data = {
            'invoice_no': 'PI-00001',
            'entry_date': '2026-06-22',
            'supplier_ledger': self.ledger.id,
            'purchase_ledger': self.purchase_ledger.id,
            'supplier_invoice_date': '2026-06-20',
            'gst_ledger_1': self.cgst_ledger.id,
            'gst_ledger_2': self.sgst_ledger.id,
            'items': [
                {
                    'product': self.product.id,
                    'godown': self.warehouse.id,
                    'quantity': '10.00',
                    'rate': '15.00',
                    'discount_percent': '0.00',
                    'gst_percent': '18.00',
                    'amount': '150.00'
                }
            ]
        }
        
        # Missing supplier_invoice_no
        serializer = PurchaseInvoiceSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('supplier_invoice_no', serializer.errors)

    def test_missing_supplier_invoice_date_raises_validation_error(self):
        from purchase_app.serializers import PurchaseInvoiceSerializer
        data = {
            'invoice_no': 'PI-00002',
            'entry_date': '2026-06-22',
            'supplier_ledger': self.ledger.id,
            'purchase_ledger': self.purchase_ledger.id,
            'supplier_invoice_no': 'SUP-INV-001',
            'gst_ledger_1': self.cgst_ledger.id,
            'gst_ledger_2': self.sgst_ledger.id,
            'items': [
                {
                    'product': self.product.id,
                    'godown': self.warehouse.id,
                    'quantity': '10.00',
                    'rate': '15.00',
                    'discount_percent': '0.00',
                    'gst_percent': '18.00',
                    'amount': '150.00'
                }
            ]
        }
        
        # Missing supplier_invoice_date
        serializer = PurchaseInvoiceSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('supplier_invoice_date', serializer.errors)

    def test_valid_supplier_invoice_succeeds(self):
        from purchase_app.serializers import PurchaseInvoiceSerializer
        data = {
            'invoice_no': 'PI-00003',
            'entry_date': '2026-06-22',
            'supplier_ledger': self.ledger.id,
            'purchase_ledger': self.purchase_ledger.id,
            'supplier_invoice_no': 'SUP-INV-002',
            'supplier_invoice_date': '2026-06-20',
            'gst_ledger_1': self.cgst_ledger.id,
            'gst_ledger_2': self.sgst_ledger.id,
            'items': [
                {
                    'product': self.product.id,
                    'godown': self.warehouse.id,
                    'quantity': '10.00',
                    'rate': '15.00',
                    'discount_percent': '0.00',
                    'gst_percent': '18.00',
                    'amount': '150.00'
                }
            ]
        }
        
        serializer = PurchaseInvoiceSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
#######
    def test_stock_tables_synced_on_create(self):
        from purchase_app.serializers import PurchaseInvoiceSerializer
        from inventory_app.models import StockTable, StockTableDuplicate
        
        data = {
            'invoice_no': 'PI-00004',
            'entry_date': '2026-06-22',
            'supplier_ledger': self.ledger.id,
            'purchase_ledger': self.purchase_ledger.id,
            'supplier_invoice_no': 'SUP-INV-004',
            'supplier_invoice_date': '2026-06-20',
            'gst_ledger_1': self.cgst_ledger.id,
            'gst_ledger_2': self.sgst_ledger.id,
            'items': [
                {
                    'product': self.product.id,
                    'godown': self.warehouse.id,
                    'quantity': '12.50',
                    'rate': '15.00',
                    'discount_percent': '0.00',
                    'gst_percent': '18.00',
                    'amount': '187.50',
                    'batch_number': 'BATCH-004',
                    'manufacture_date': '2026-06-01',
                    'expiry_date': '2027-06-01'
                }
            ]
        }
        
        serializer = PurchaseInvoiceSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        invoice = serializer.save()
        
        # Verify entries exist in StockTable
        stock_entries = StockTable.objects.filter(transaction_type='PURCHASE_INVOICE', reference_id=invoice.id)
        self.assertEqual(stock_entries.count(), 1)
        entry = stock_entries.first()
        self.assertEqual(entry.item, self.product)
        self.assertEqual(float(entry.quantity), 12.50)
        self.assertEqual(float(entry.rate), 15.00)
        self.assertEqual(entry.batch_number, 'BATCH-004')
        self.assertEqual(entry.warehouse, self.warehouse)
        self.assertEqual(str(entry.date), '2026-06-22')
        
        # Verify entries exist in StockTableDuplicate
        dup_entries = StockTableDuplicate.objects.filter(transaction_type='PURCHASE_INVOICE', reference_id=invoice.id)
        self.assertEqual(dup_entries.count(), 1)
        dup_entry = dup_entries.first()
        self.assertEqual(dup_entry.item, self.product)
        self.assertEqual(float(dup_entry.quantity), 12.50)
        self.assertEqual(float(dup_entry.rate), 15.00)

    def test_stock_tables_synced_on_update(self):
        from purchase_app.serializers import PurchaseInvoiceSerializer
        from inventory_app.models import StockTable, StockTableDuplicate
        
        data = {
            'invoice_no': 'PI-00005',
            'entry_date': '2026-06-22',
            'supplier_ledger': self.ledger.id,
            'purchase_ledger': self.purchase_ledger.id,
            'supplier_invoice_no': 'SUP-INV-005',
            'supplier_invoice_date': '2026-06-20',
            'gst_ledger_1': self.cgst_ledger.id,
            'gst_ledger_2': self.sgst_ledger.id,
            'items': [
                {
                    'product': self.product.id,
                    'godown': self.warehouse.id,
                    'quantity': '10.00',
                    'rate': '15.00',
                    'discount_percent': '0.00',
                    'gst_percent': '18.00',
                    'amount': '150.00',
                    'batch_number': 'BATCH-005'
                }
            ]
        }
        
        serializer = PurchaseInvoiceSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        invoice = serializer.save()
        
        # Now update the quantity and batch
        update_data = {
            'invoice_no': 'PI-00005',
            'entry_date': '2026-06-22',
            'supplier_ledger': self.ledger.id,
            'purchase_ledger': self.purchase_ledger.id,
            'supplier_invoice_no': 'SUP-INV-005',
            'supplier_invoice_date': '2026-06-20',
            'gst_ledger_1': self.cgst_ledger.id,
            'gst_ledger_2': self.sgst_ledger.id,
            'items': [
                {
                    'product': self.product.id,
                    'godown': self.warehouse.id,
                    'quantity': '20.00',
                    'rate': '15.00',
                    'discount_percent': '0.00',
                    'gst_percent': '18.00',
                    'amount': '300.00',
                    'batch_number': 'BATCH-005-NEW'
                }
            ]
        }
        
        serializer_update = PurchaseInvoiceSerializer(instance=invoice, data=update_data)
        self.assertTrue(serializer_update.is_valid(), serializer_update.errors)
        updated_invoice = serializer_update.save()
        
        # Verify updated entry in StockTable
        stock_entries = StockTable.objects.filter(transaction_type='PURCHASE_INVOICE', reference_id=updated_invoice.id)
        self.assertEqual(stock_entries.count(), 1)
        entry = stock_entries.first()
        self.assertEqual(float(entry.quantity), 20.00)
        self.assertEqual(entry.batch_number, 'BATCH-005-NEW')
        
        # Verify updated entry in StockTableDuplicate
        dup_entries = StockTableDuplicate.objects.filter(transaction_type='PURCHASE_INVOICE', reference_id=updated_invoice.id)
        self.assertEqual(dup_entries.count(), 1)
        dup_entry = dup_entries.first()
        self.assertEqual(float(dup_entry.quantity), 20.00)
        self.assertEqual(dup_entry.batch_number, 'BATCH-005-NEW')

    def test_stock_tables_deleted_on_invoice_delete(self):
        from purchase_app.serializers import PurchaseInvoiceSerializer
        from inventory_app.models import StockTable, StockTableDuplicate
        
        data = {
            'invoice_no': 'PI-00006',
            'entry_date': '2026-06-22',
            'supplier_ledger': self.ledger.id,
            'purchase_ledger': self.purchase_ledger.id,
            'supplier_invoice_no': 'SUP-INV-006',
            'supplier_invoice_date': '2026-06-20',
            'gst_ledger_1': self.cgst_ledger.id,
            'gst_ledger_2': self.sgst_ledger.id,
            'items': [
                {
                    'product': self.product.id,
                    'godown': self.warehouse.id,
                    'quantity': '10.00',
                    'rate': '15.00',
                    'discount_percent': '0.00',
                    'gst_percent': '18.00',
                    'amount': '150.00',
                    'batch_number': 'BATCH-006'
                }
            ]
        }
        
        serializer = PurchaseInvoiceSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        invoice = serializer.save()
        
        # Verify entries exist
        self.assertEqual(StockTable.objects.filter(transaction_type='PURCHASE_INVOICE', reference_id=invoice.id).count(), 1)
        self.assertEqual(StockTableDuplicate.objects.filter(transaction_type='PURCHASE_INVOICE', reference_id=invoice.id).count(), 1)
        
        # Delete invoice
        invoice.delete()
        
        # Verify entries are deleted
        self.assertEqual(StockTable.objects.filter(transaction_type='PURCHASE_INVOICE', reference_id=invoice.id).count(), 0)
        self.assertEqual(StockTableDuplicate.objects.filter(transaction_type='PURCHASE_INVOICE', reference_id=invoice.id).count(), 0)

    def test_missing_gst_ledgers_local_transaction_fails(self):
        from purchase_app.serializers import PurchaseInvoiceSerializer
        data = {
            'invoice_no': 'PI-00007',
            'entry_date': '2026-06-22',
            'supplier_ledger': self.ledger.id,
            'purchase_ledger': self.purchase_ledger.id,
            'supplier_invoice_no': 'SUP-INV-007',
            'supplier_invoice_date': '2026-06-20',
            'gst_type': 'STATE',
            'items': [
                {
                    'product': self.product.id,
                    'godown': self.warehouse.id,
                    'quantity': '10.00',
                    'rate': '15.00',
                    'discount_percent': '0.00',
                    'gst_percent': '18.00',
                    'amount': '150.00'
                }
            ]
        }
        
        # Missing gst_ledger_1 and gst_ledger_2 for a local transaction
        serializer = PurchaseInvoiceSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('gst_ledger_1', serializer.errors)
        self.assertIn('gst_ledger_2', serializer.errors)

    def test_missing_igst_ledger_interstate_transaction_fails(self):
        from purchase_app.serializers import PurchaseInvoiceSerializer
        data = {
            'invoice_no': 'PI-00008',
            'entry_date': '2026-06-22',
            'supplier_ledger': self.ledger.id,
            'purchase_ledger': self.purchase_ledger.id,
            'supplier_invoice_no': 'SUP-INV-008',
            'supplier_invoice_date': '2026-06-20',
            'gst_type': 'INTER_STATE',
            'items': [
                {
                    'product': self.product.id,
                    'godown': self.warehouse.id,
                    'quantity': '10.00',
                    'rate': '15.00',
                    'discount_percent': '0.00',
                    'gst_percent': '18.00',
                    'amount': '150.00'
                }
            ]
        }
        
        # Missing gst_ledger_1 (IGST) for an inter-state transaction
        serializer = PurchaseInvoiceSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('gst_ledger_1', serializer.errors)
        # gst_ledger_2 (SGST) is not required for inter-state
        self.assertNotIn('gst_ledger_2', serializer.errors)

    def test_valid_gst_ledgers_succeed(self):
        from purchase_app.serializers import PurchaseInvoiceSerializer
        
        # Local transaction with both CGST and SGST ledgers
        data_local = {
            'invoice_no': 'PI-00009',
            'entry_date': '2026-06-22',
            'supplier_ledger': self.ledger.id,
            'purchase_ledger': self.purchase_ledger.id,
            'supplier_invoice_no': 'SUP-INV-009',
            'supplier_invoice_date': '2026-06-20',
            'gst_type': 'STATE',
            'gst_ledger_1': self.cgst_ledger.id,
            'gst_ledger_2': self.sgst_ledger.id,
            'items': [
                {
                    'product': self.product.id,
                    'godown': self.warehouse.id,
                    'quantity': '10.00',
                    'rate': '15.00',
                    'discount_percent': '0.00',
                    'gst_percent': '18.00',
                    'amount': '150.00'
                }
            ]
        }
        serializer_local = PurchaseInvoiceSerializer(data=data_local)
        self.assertTrue(serializer_local.is_valid(), serializer_local.errors)
        
        # Inter-State transaction with IGST ledger
        data_inter = {
            'invoice_no': 'PI-00010',
            'entry_date': '2026-06-22',
            'supplier_ledger': self.ledger.id,
            'purchase_ledger': self.purchase_ledger.id,
            'supplier_invoice_no': 'SUP-INV-010',
            'supplier_invoice_date': '2026-06-20',
            'gst_type': 'INTER_STATE',
            'gst_ledger_1': self.igst_ledger.id,
            'items': [
                {
                    'product': self.product.id,
                    'godown': self.warehouse.id,
                    'quantity': '10.00',
                    'rate': '15.00',
                    'discount_percent': '0.00',
                    'gst_percent': '18.00',
                    'amount': '150.00'
                }
            ]
        }
        serializer_inter = PurchaseInvoiceSerializer(data=data_inter)
        self.assertTrue(serializer_inter.is_valid(), serializer_inter.errors)


class PurchaseReturnStockTests(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username='purchaseuser_pr',
            email='purchaseuser_pr@example.com',
            password='password123'
        )
        self.group = AccountGroup.objects.create(name="Sundry Creditors", nature="Liability")
        self.ledger = Ledger.objects.create(name="Supplier PR", accountGroup=self.group)
        self.purchase_group = AccountGroup.objects.create(name="Purchase Accounts", nature="Expense")
        self.purchase_ledger = Ledger.objects.create(name="Purchase Ledger PR", accountGroup=self.purchase_group)
        self.unit = Unit.objects.create(name="Box", uqc_code="BOX")
        self.stock_group = StockGroup.objects.create(name="General Goods")
        self.product = StockItem.objects.create(
            name="Product PR",
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
        self.cgst_ledger = Ledger.objects.create(name="CGST Ledger PR", accountGroup=self.purchase_group)
        self.sgst_ledger = Ledger.objects.create(name="SGST Ledger PR", accountGroup=self.purchase_group)

    def test_stock_tables_synced_on_create(self):
        from purchase_app.serializers import PurchaseReturnSerializer
        from inventory_app.models import StockTable, StockTableDuplicate
        
        data = {
            'return_no': 'PR-00001',
            'entry_date': '2026-06-22',
            'supplier_ledger': self.ledger.id,
            'purchase_ledger': self.purchase_ledger.id,
            'supplier_invoice_no': 'SUP-INV-004',
            'supplier_invoice_date': '2026-06-20',
            'gst_ledger_1': self.cgst_ledger.id,
            'gst_ledger_2': self.sgst_ledger.id,
            'items': [
                {
                    'product': self.product.id,
                    'godown': self.warehouse.id,
                    'quantity': '12.50',
                    'rate': '15.00',
                    'discount_percent': '0.00',
                    'gst_percent': '18.00',
                    'amount': '187.50',
                    'batch_number': 'BATCH-004',
                    'manufacture_date': '2026-06-01',
                    'expiry_date': '2027-06-01'
                }
            ]
        }
        
        serializer = PurchaseReturnSerializer(data=data, context={'request': type('Request', (), {'user': self.user})})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        purchase_return = serializer.save()
        
        # Verify entries exist in StockTable
        stock_entries = StockTable.objects.filter(transaction_type='PURCHASE_RETURN', reference_id=purchase_return.id)
        self.assertEqual(stock_entries.count(), 1)
        entry = stock_entries.first()
        self.assertEqual(entry.item, self.product)
        self.assertEqual(float(entry.quantity), 12.50)
        self.assertEqual(float(entry.rate), 15.00)
        self.assertEqual(entry.batch_number, 'BATCH-004')
        self.assertEqual(entry.warehouse, self.warehouse)
        self.assertEqual(str(entry.date), '2026-06-22')
        self.assertEqual(entry.movement_type, 'OUT')
        
        # Verify entries exist in StockTableDuplicate
        dup_entries = StockTableDuplicate.objects.filter(transaction_type='PURCHASE_RETURN', reference_id=purchase_return.id)
        self.assertEqual(dup_entries.count(), 1)
        dup_entry = dup_entries.first()
        self.assertEqual(dup_entry.item, self.product)
        self.assertEqual(float(dup_entry.quantity), 12.50)
        self.assertEqual(float(dup_entry.rate), 15.00)
        self.assertEqual(dup_entry.movement_type, 'OUT')

    def test_stock_tables_synced_on_update(self):
        from purchase_app.serializers import PurchaseReturnSerializer
        from inventory_app.models import StockTable, StockTableDuplicate
        
        data = {
            'return_no': 'PR-00002',
            'entry_date': '2026-06-22',
            'supplier_ledger': self.ledger.id,
            'purchase_ledger': self.purchase_ledger.id,
            'supplier_invoice_no': 'SUP-INV-005',
            'supplier_invoice_date': '2026-06-20',
            'gst_ledger_1': self.cgst_ledger.id,
            'gst_ledger_2': self.sgst_ledger.id,
            'items': [
                {
                    'product': self.product.id,
                    'godown': self.warehouse.id,
                    'quantity': '10.00',
                    'rate': '15.00',
                    'discount_percent': '0.00',
                    'gst_percent': '18.00',
                    'amount': '150.00',
                    'batch_number': 'BATCH-005'
                }
            ]
        }
        
        serializer = PurchaseReturnSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        purchase_return = serializer.save()
        
        # Now update the quantity and batch
        update_data = {
            'return_no': 'PR-00002',
            'entry_date': '2026-06-22',
            'supplier_ledger': self.ledger.id,
            'purchase_ledger': self.purchase_ledger.id,
            'supplier_invoice_no': 'SUP-INV-005',
            'supplier_invoice_date': '2026-06-20',
            'gst_ledger_1': self.cgst_ledger.id,
            'gst_ledger_2': self.sgst_ledger.id,
            'items': [
                {
                    'product': self.product.id,
                    'godown': self.warehouse.id,
                    'quantity': '20.00',
                    'rate': '15.00',
                    'discount_percent': '0.00',
                    'gst_percent': '18.00',
                    'amount': '300.00',
                    'batch_number': 'BATCH-005-NEW'
                }
            ]
        }
        
        serializer_update = PurchaseReturnSerializer(instance=purchase_return, data=update_data)
        self.assertTrue(serializer_update.is_valid(), serializer_update.errors)
        updated_return = serializer_update.save()
        
        # Verify updated entry in StockTable
        stock_entries = StockTable.objects.filter(transaction_type='PURCHASE_RETURN', reference_id=updated_return.id)
        self.assertEqual(stock_entries.count(), 1)
        entry = stock_entries.first()
        self.assertEqual(float(entry.quantity), 20.00)
        self.assertEqual(entry.batch_number, 'BATCH-005-NEW')
        self.assertEqual(entry.movement_type, 'OUT')
        
        # Verify updated entry in StockTableDuplicate
        dup_entries = StockTableDuplicate.objects.filter(transaction_type='PURCHASE_RETURN', reference_id=updated_return.id)
        self.assertEqual(dup_entries.count(), 1)
        dup_entry = dup_entries.first()
        self.assertEqual(float(dup_entry.quantity), 20.00)
        self.assertEqual(dup_entry.batch_number, 'BATCH-005-NEW')
        self.assertEqual(dup_entry.movement_type, 'OUT')

    def test_stock_tables_deleted_on_return_delete(self):
        from purchase_app.serializers import PurchaseReturnSerializer
        from inventory_app.models import StockTable, StockTableDuplicate
        
        data = {
            'return_no': 'PR-00003',
            'entry_date': '2026-06-22',
            'supplier_ledger': self.ledger.id,
            'purchase_ledger': self.purchase_ledger.id,
            'supplier_invoice_no': 'SUP-INV-006',
            'supplier_invoice_date': '2026-06-20',
            'gst_ledger_1': self.cgst_ledger.id,
            'gst_ledger_2': self.sgst_ledger.id,
            'items': [
                {
                    'product': self.product.id,
                    'godown': self.warehouse.id,
                    'quantity': '10.00',
                    'rate': '15.00',
                    'discount_percent': '0.00',
                    'gst_percent': '18.00',
                    'amount': '150.00',
                    'batch_number': 'BATCH-006'
                }
            ]
        }
        
        serializer = PurchaseReturnSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        purchase_return = serializer.save()
        
        # Verify entries exist
        self.assertEqual(StockTable.objects.filter(transaction_type='PURCHASE_RETURN', reference_id=purchase_return.id).count(), 1)
        self.assertEqual(StockTableDuplicate.objects.filter(transaction_type='PURCHASE_RETURN', reference_id=purchase_return.id).count(), 1)
        
        # Delete return
        purchase_return.delete()
        
        # Verify entries are deleted
        self.assertEqual(StockTable.objects.filter(transaction_type='PURCHASE_RETURN', reference_id=purchase_return.id).count(), 0)
        self.assertEqual(StockTableDuplicate.objects.filter(transaction_type='PURCHASE_RETURN', reference_id=purchase_return.id).count(), 0)


class PurchaseInvoiceLookupTests(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username='lookupuser',
            email='lookupuser@example.com',
            password='password123'
        )
        self.group = AccountGroup.objects.create(name="Sundry Creditors", nature="Liability")
        self.ledger = Ledger.objects.create(name="Supplier Lookup", accountGroup=self.group)
        self.purchase_group = AccountGroup.objects.create(name="Purchase Accounts", nature="Expense")
        self.purchase_ledger = Ledger.objects.create(name="Purchase Ledger Lookup", accountGroup=self.purchase_group)
        self.unit = Unit.objects.create(name="Box", uqc_code="BOX")
        self.stock_group = StockGroup.objects.create(name="General Goods")
        self.product = StockItem.objects.create(
            name="Product Lookup",
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
        self.cgst_ledger = Ledger.objects.create(name="CGST Ledger Lookup", accountGroup=self.purchase_group)
        self.sgst_ledger = Ledger.objects.create(name="SGST Ledger Lookup", accountGroup=self.purchase_group)

        # Create a sample purchase invoice
        from purchase_app.models import PurchaseInvoice, PurchaseInvoiceItem
        from decimal import Decimal
        self.invoice = PurchaseInvoice.objects.create(
            invoice_no='PI-LOOKUP-001',
            entry_date='2026-06-22',
            supplier_ledger=self.ledger,
            purchase_ledger=self.purchase_ledger,
            supplier_invoice_no='SUP-INV-999',
            supplier_invoice_date='2026-06-20',
            gst_ledger_1=self.cgst_ledger,
            gst_ledger_2=self.sgst_ledger,
            total_amount=Decimal('150.00'),
            is_posted=False,
            created_by=self.user
        )
        self.invoice_item = PurchaseInvoiceItem.objects.create(
            invoice=self.invoice,
            product=self.product,
            godown=self.warehouse,
            quantity=Decimal('10.00'),
            rate=Decimal('15.00'),
            amount=Decimal('150.00')
        )

    def test_lookup_missing_parameters_fails(self):
        from django.urls import reverse
        url = reverse('purchase-invoice-lookup')
        from rest_framework_simplejwt.tokens import AccessToken
        token = AccessToken.for_user(self.user)
        auth_headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}

        response = self.client.get(url, {}, **auth_headers)
        self.assertEqual(response.status_code, 400)

    def test_lookup_not_found_returns_404(self):
        from django.urls import reverse
        url = reverse('purchase-invoice-lookup')
        from rest_framework_simplejwt.tokens import AccessToken
        token = AccessToken.for_user(self.user)
        auth_headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}

        response = self.client.get(
            url,
            {
                'supplier_ledger': self.ledger.id,
                'supplier_invoice_no': 'NON-EXISTENT',
                'supplier_invoice_date': '2026-06-20'
            },
            **auth_headers
        )
        self.assertEqual(response.status_code, 404)

    def test_lookup_success_returns_200(self):
        from django.urls import reverse
        url = reverse('purchase-invoice-lookup')
        from rest_framework_simplejwt.tokens import AccessToken
        token = AccessToken.for_user(self.user)
        auth_headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'}

        response = self.client.get(
            url,
            {
                'supplier_ledger': self.ledger.id,
                'supplier_invoice_no': 'SUP-INV-999',
                'supplier_invoice_date': '2026-06-20'
            },
            **auth_headers
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['invoice_no'], 'PI-LOOKUP-001')
        self.assertEqual(len(data['items']), 1)
        self.assertEqual(data['items'][0]['product'], self.product.id)


