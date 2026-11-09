from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from finance_app.models import Ledger, AccountGroup
from inventory_app.models import PriceList, LedgerPriceListMapping

from .models import (
    StockGroup, StockGroupHSN, StockGroupGST,
    StockCategory, StockCategoryHSN, StockCategoryGST
)
from .serializers import StockGroupSerializer, StockCategorySerializer

User = get_user_model()

class PriceListMappingTests(APITestCase):

    def setUp(self):
        # Create superuser to bypass custom permissions
        self.user = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='password123'
        )
        self.client.force_authenticate(user=self.user)

        # Create account group and ledgers
        self.group = AccountGroup.objects.create(name="Test Group", nature="Asset")
        self.ledger1 = Ledger.objects.create(name="Ledger 1", accountGroup=self.group)
        self.ledger2 = Ledger.objects.create(name="Ledger 2", accountGroup=self.group)

        # Create price lists
        self.price_list1 = PriceList.objects.create(name="Price List A", applicable_date="2026-06-01")
        self.price_list2 = PriceList.objects.create(name="Price List B", applicable_date="2026-06-15")

    def test_get_mappings(self):
        # Create a mapping
        mapping = LedgerPriceListMapping.objects.create(
            ledger=self.ledger1,
            price_list=self.price_list1,
            applicable_date="2026-06-01"
        )
        
        url = reverse('price_list_mapping_api')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['ledger_name'], "Ledger 1")
        self.assertEqual(response.data[0]['price_list_name'], "Price List A")

    def test_post_bulk_mappings(self):
        url = reverse('price_list_mapping_api')
        data = {
            'price_list_id': self.price_list1.id,
            'applicable_date': '2026-06-10',
            'ledger_ids': [self.ledger1.id, self.ledger2.id]
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify both ledgers are mapped on this date
        self.assertEqual(LedgerPriceListMapping.objects.filter(applicable_date='2026-06-10').count(), 2)

        # Verify bulk POST updates mapping and handles unmapping
        data2 = {
            'price_list_id': self.price_list2.id,
            'applicable_date': '2026-06-10',
            'ledger_ids': [self.ledger1.id],
            'unmap_ledger_ids': [self.ledger2.id]
        }
        response2 = self.client.post(url, data2, format='json')
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        
        # Ledger 1 should now be updated to price_list2, Ledger 2 should be deleted (unmapped)
        mapping1 = LedgerPriceListMapping.objects.get(ledger=self.ledger1, applicable_date='2026-06-10')
        self.assertEqual(mapping1.price_list, self.price_list2)
        self.assertFalse(LedgerPriceListMapping.objects.filter(ledger=self.ledger2, applicable_date='2026-06-10').exists())

    def test_put_single_mapping_success(self):
        mapping = LedgerPriceListMapping.objects.create(
            ledger=self.ledger1,
            price_list=self.price_list1,
            applicable_date="2026-06-01"
        )
        
        url = reverse('price_list_mapping_detail_api', kwargs={'pk': mapping.pk})
        data = {
            'price_list_id': self.price_list2.id,
            'applicable_date': '2026-06-12'
        }
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        mapping.refresh_from_db()
        self.assertEqual(mapping.price_list, self.price_list2)
        self.assertEqual(str(mapping.applicable_date), '2026-06-12')

    def test_put_single_mapping_collision_prevented(self):
        # Create mapping 1
        mapping1 = LedgerPriceListMapping.objects.create(
            ledger=self.ledger1,
            price_list=self.price_list1,
            applicable_date="2026-06-01"
        )
        # Create mapping 2 on a different date for the same ledger
        mapping2 = LedgerPriceListMapping.objects.create(
            ledger=self.ledger1,
            price_list=self.price_list2,
            applicable_date="2026-06-15"
        )
        
        # Try to update mapping 1 to have the same date as mapping 2
        url = reverse('price_list_mapping_detail_api', kwargs={'pk': mapping1.pk})
        data = {
            'price_list_id': self.price_list1.id,
            'applicable_date': '2026-06-15'
        }
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already exists', response.data['detail'])

    def test_delete_single_mapping(self):
        mapping = LedgerPriceListMapping.objects.create(
            ledger=self.ledger1,
            price_list=self.price_list1,
            applicable_date="2026-06-01"
        )
        
        url = reverse('price_list_mapping_detail_api', kwargs={'pk': mapping.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(LedgerPriceListMapping.objects.filter(pk=mapping.pk).exists())

    def test_put_bulk_mappings_success(self):
        # Create mapping for ledger1 and ledger2
        LedgerPriceListMapping.objects.create(
            ledger=self.ledger1,
            price_list=self.price_list1,
            applicable_date="2026-06-01"
        )
        LedgerPriceListMapping.objects.create(
            ledger=self.ledger2,
            price_list=self.price_list1,
            applicable_date="2026-06-01"
        )

        url = reverse('price_list_mapping_api')
        # We change date to 2026-06-12, uncheck ledger2, and change price list to price_list2
        data = {
            'old_price_list_id': self.price_list1.id,
            'old_applicable_date': '2026-06-01',
            'new_price_list_id': self.price_list2.id,
            'new_applicable_date': '2026-06-12',
            'ledger_ids': [self.ledger1.id]
        }
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Old mappings should be deleted
        self.assertFalse(LedgerPriceListMapping.objects.filter(applicable_date='2026-06-01').exists())
        # Ledger 1 should be mapped to price_list2 on new date
        self.assertTrue(LedgerPriceListMapping.objects.filter(ledger=self.ledger1, price_list=self.price_list2, applicable_date='2026-06-12').exists())
        # Ledger 2 should not be mapped anywhere
        self.assertFalse(LedgerPriceListMapping.objects.filter(ledger=self.ledger2).exists())

    def test_delete_bulk_mappings_success(self):
        # Create mapping for ledger1 and ledger2
        LedgerPriceListMapping.objects.create(
            ledger=self.ledger1,
            price_list=self.price_list1,
            applicable_date="2026-06-01"
        )
        LedgerPriceListMapping.objects.create(
            ledger=self.ledger2,
            price_list=self.price_list1,
            applicable_date="2026-06-01"
        )

        url = reverse('price_list_mapping_api')
        # We perform DELETE by passing price_list_id and applicable_date in query parameters
        response = self.client.delete(f"{url}?price_list_id={self.price_list1.id}&applicable_date=2026-06-01")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Mappings should be deleted
        self.assertFalse(LedgerPriceListMapping.objects.filter(price_list=self.price_list1, applicable_date='2026-06-01').exists())


class StockGroupSerializerTest(TestCase):
    def test_create_stock_group_with_nested_data(self):
        data = {
            "name": "Electronics",
            "hsn_codes": [
                {"hsn_number": "8517", "applicable_date": "2026-06-01"}
            ],
            "gst_rates": [
                {
                    "tax_gst_type": "goods",
                    "igst_percent": "18.00",
                    "cgst_percent": "9.00",
                    "sgst_percent": "9.00",
                    "cess_percent": "0.00",
                    "applicable_date": "2026-06-01"
                }
            ]
        }
        
        serializer = StockGroupSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        stock_group = serializer.save()
        
        self.assertEqual(stock_group.name, "Electronics")
        self.assertEqual(stock_group.hsn_codes.count(), 1)
        self.assertEqual(stock_group.gst_rates.count(), 1)
        
        hsn = stock_group.hsn_codes.first()
        self.assertEqual(hsn.hsn_number, "8517")
        self.assertEqual(str(hsn.applicable_date), "2026-06-01")
        
        gst = stock_group.gst_rates.first()
        self.assertEqual(gst.tax_gst_type, "goods")
        self.assertEqual(float(gst.igst_percent), 18.00)
        self.assertEqual(float(gst.cgst_percent), 9.00)
        self.assertEqual(float(gst.sgst_percent), 9.00)
        self.assertEqual(str(gst.applicable_date), "2026-06-01")

    def test_create_stock_group_with_include_in_definition(self):
        data = {
            "name": "Hardware",
            "include_in_definition": True
        }
        serializer = StockGroupSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        stock_group = serializer.save()
        self.assertTrue(stock_group.stock_definitions.exists())

    def test_update_stock_group_with_nested_data(self):
        # Create initial group
        stock_group = StockGroup.objects.create(name="Furniture")
        StockGroupHSN.objects.create(stock_group=stock_group, hsn_number="9403", applicable_date="2026-06-01")
        StockGroupGST.objects.create(
            stock_group=stock_group,
            tax_gst_type="goods",
            igst_percent="12.00",
            cgst_percent="6.00",
            sgst_percent="6.00",
            applicable_date="2026-06-01"
        )
        
        update_data = {
            "name": "Furniture Modified",
            "hsn_codes": [
                {"hsn_number": "9404", "applicable_date": "2026-06-10"}
            ],
            "gst_rates": [
                {
                    "tax_gst_type": "goods",
                    "igst_percent": "18.00",
                    "cgst_percent": "9.00",
                    "sgst_percent": "9.00",
                    "cess_percent": "2.00",
                    "applicable_date": "2026-06-10"
                }
            ]
        }
        
        serializer = StockGroupSerializer(stock_group, data=update_data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated_group = serializer.save()
        
        self.assertEqual(updated_group.name, "Furniture Modified")
        self.assertEqual(updated_group.hsn_codes.count(), 1)
        self.assertEqual(updated_group.gst_rates.count(), 1)
        
        hsn = updated_group.hsn_codes.first()
        self.assertEqual(hsn.hsn_number, "9404")
        self.assertEqual(str(hsn.applicable_date), "2026-06-10")
        
        gst = updated_group.gst_rates.first()
        self.assertEqual(float(gst.igst_percent), 18.00)
        self.assertEqual(float(gst.cgst_percent), 9.00)
        self.assertEqual(float(gst.sgst_percent), 9.00)
        self.assertEqual(float(gst.cess_percent), 2.00)

    def test_parent_group_assignment(self):
        parent = StockGroup.objects.create(name="Parent Group")
        data = {
            "name": "Sub Group",
            "parent_group": parent.id
        }
        serializer = StockGroupSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        subgroup = serializer.save()
        self.assertEqual(subgroup.parent_group, parent)

    def test_circular_dependency(self):
        group1 = StockGroup.objects.create(name="G1")
        group2 = StockGroup.objects.create(name="G2", parent_group=group1)
        
        # Test self-reference
        data = {"name": "G1", "parent_group": group1.id}
        serializer = StockGroupSerializer(group1, data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("parent_group", serializer.errors)
        
        # Test indirect circular reference
        data = {"name": "G1", "parent_group": group2.id}
        serializer = StockGroupSerializer(group1, data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("parent_group", serializer.errors)


from rest_framework_simplejwt.tokens import RefreshToken

class StockGroupAPITest(APITestCase):
    def setUp(self):
        # Create user
        self.user = User.objects.create_superuser(
            username="testuser",
            email="testuser@example.com",
            password="password123"
        )
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
        
    def test_create_and_retrieve_stock_group_api(self):
        url = reverse('stock-group-list')
        data = {
            "name": "Hardware Devices",
            "hsn_codes": [
                {"hsn_number": "8471", "applicable_date": "2026-06-12"}
            ],
            "gst_rates": [
                {
                    "tax_gst_type": "goods",
                    "igst_percent": "18.00",
                    "cgst_percent": "9.00",
                    "sgst_percent": "9.00",
                    "cess_percent": "0.00",
                    "applicable_date": "2026-06-12"
                }
            ]
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify group exists in DB
        group_id = response.data['id']
        group = StockGroup.objects.get(id=group_id)
        self.assertEqual(group.name, "Hardware Devices")
        self.assertEqual(group.hsn_codes.first().hsn_number, "8471")
        self.assertEqual(float(group.gst_rates.first().igst_percent), 18.0)
        
        # Get list
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check that hsn_codes and gst_rates are returned in the response
        group_data = [item for item in response.data if item['id'] == group_id][0]
        self.assertEqual(len(group_data['hsn_codes']), 1)
        self.assertEqual(group_data['hsn_codes'][0]['hsn_number'], "8471")
        self.assertEqual(len(group_data['gst_rates']), 1)
        self.assertEqual(float(group_data['gst_rates'][0]['igst_percent']), 18.0)


class StockCategorySerializerTest(TestCase):
    def test_create_stock_category_with_nested_data(self):
        data = {
            "name": "Heavy Machinery",
            "hsn_codes": [
                {"hsn_number": "8429", "applicable_date": "2026-06-01"}
            ],
            "gst_rates": [
                {
                    "tax_gst_type": "goods",
                    "igst_percent": "18.00",
                    "cgst_percent": "9.00",
                    "sgst_percent": "9.00",
                    "cess_percent": "0.00",
                    "applicable_date": "2026-06-01"
                }
            ]
        }
        
        serializer = StockCategorySerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        category = serializer.save()
        
        self.assertEqual(category.name, "Heavy Machinery")
        self.assertEqual(category.hsn_codes.count(), 1)
        self.assertEqual(category.gst_rates.count(), 1)
        
        hsn = category.hsn_codes.first()
        self.assertEqual(hsn.hsn_number, "8429")
        self.assertEqual(str(hsn.applicable_date), "2026-06-01")
        
        gst = category.gst_rates.first()
        self.assertEqual(gst.tax_gst_type, "goods")
        self.assertEqual(float(gst.igst_percent), 18.00)
        self.assertEqual(float(gst.cgst_percent), 9.00)
        self.assertEqual(float(gst.sgst_percent), 9.00)

    def test_update_stock_category_with_nested_data(self):
        category = StockCategory.objects.create(name="Plastics")
        StockCategoryHSN.objects.create(stock_category=category, hsn_number="3926", applicable_date="2026-06-01")
        StockCategoryGST.objects.create(
            stock_category=category,
            tax_gst_type="goods",
            igst_percent="18.00",
            cgst_percent="9.00",
            sgst_percent="9.00",
            applicable_date="2026-06-01"
        )
        
        update_data = {
            "name": "Plastics Modified",
            "hsn_codes": [
                {"hsn_number": "3927", "applicable_date": "2026-06-10"}
            ],
            "gst_rates": [
                {
                    "tax_gst_type": "goods",
                    "igst_percent": "28.00",
                    "cgst_percent": "14.00",
                    "sgst_percent": "14.00",
                    "cess_percent": "0.00",
                    "applicable_date": "2026-06-10"
                }
            ]
        }
        
        serializer = StockCategorySerializer(category, data=update_data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated_category = serializer.save()
        
        self.assertEqual(updated_category.name, "Plastics Modified")
        self.assertEqual(updated_category.hsn_codes.count(), 1)
        self.assertEqual(updated_category.gst_rates.count(), 1)
        
        hsn = updated_category.hsn_codes.first()
        self.assertEqual(hsn.hsn_number, "3927")
        self.assertEqual(float(updated_category.gst_rates.first().igst_percent), 28.00)

    def test_parent_category_assignment(self):
        parent = StockCategory.objects.create(name="Parent Category")
        data = {
            "name": "Sub Category",
            "parent_category": parent.id
        }
        serializer = StockCategorySerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        subcategory = serializer.save()
        self.assertEqual(subcategory.parent_category, parent)

    def test_circular_dependency_category(self):
        cat1 = StockCategory.objects.create(name="C1")
        cat2 = StockCategory.objects.create(name="C2", parent_category=cat1)
        
        # Test self-reference
        data = {"name": "C1", "parent_category": cat1.id}
        serializer = StockCategorySerializer(cat1, data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("parent_category", serializer.errors)
        
        # Test indirect circular reference
        data = {"name": "C1", "parent_category": cat2.id}
        serializer = StockCategorySerializer(cat1, data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("parent_category", serializer.errors)


class StockCategoryAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            username="testuser",
            email="testuser@example.com",
            password="password123"
        )
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
        
    def test_create_and_retrieve_stock_category_api(self):
        url = reverse('stock-category-list')
        data = {
            "name": "Textiles",
            "hsn_codes": [
                {"hsn_number": "6203", "applicable_date": "2026-06-12"}
            ],
            "gst_rates": [
                {
                    "tax_gst_type": "goods",
                    "igst_percent": "5.00",
                    "cgst_percent": "2.50",
                    "sgst_percent": "2.50",
                    "cess_percent": "0.00",
                    "applicable_date": "2026-06-12"
                }
            ]
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        category_id = response.data['id']
        category = StockCategory.objects.get(id=category_id)
        self.assertEqual(category.name, "Textiles")
        self.assertEqual(category.hsn_codes.first().hsn_number, "6203")
        self.assertEqual(float(category.gst_rates.first().igst_percent), 5.0)
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        category_data = [item for item in response.data if item['id'] == category_id][0]
        self.assertEqual(len(category_data['hsn_codes']), 1)
        self.assertEqual(category_data['hsn_codes'][0]['hsn_number'], "6203")
        self.assertEqual(float(category_data['gst_rates'][0]['igst_percent']), 5.0)


from settings_app.models import Warehouse, Company
from inventory_app.models import StockItem, Unit, StockTable, StockTableDuplicate

class WarehouseDefaultTestCase(TestCase):
    def setUp(self):
        self.company = Company.objects.create(
            name="Test Company",
            company_code="TC01"
        )
        self.unit = Unit.objects.create(
            name="Nos",
            uqc_code="NOS",
            decimal_places=0
        )
        self.group = StockGroup.objects.create(
            name="Test Group"
        )
        
    def test_single_default_warehouse(self):
        # Create warehouse 1 as default
        wh1 = Warehouse.objects.create(
            company=self.company,
            name="Warehouse 1",
            code="WH1",
            total_capacity=1000,
            capacity_unit="units",
            is_default=True
        )
        self.assertTrue(wh1.is_default)

        # Create warehouse 2 as default
        wh2 = Warehouse.objects.create(
            company=self.company,
            name="Warehouse 2",
            code="WH2",
            total_capacity=2000,
            capacity_unit="units",
            is_default=True
        )
        wh1.refresh_from_db()
        wh2.refresh_from_db()
        self.assertFalse(wh1.is_default)
        self.assertTrue(wh2.is_default)

        # Update warehouse 1 to be default again
        wh1.is_default = True
        wh1.save()
        wh1.refresh_from_db()
        wh2.refresh_from_db()
        self.assertTrue(wh1.is_default)
        self.assertFalse(wh2.is_default)

    def test_opening_stock_warehouse_assignment(self):
        # Setup default warehouse
        default_wh = Warehouse.objects.create(
            company=self.company,
            name="Default Warehouse",
            code="DWH",
            total_capacity=5000,
            capacity_unit="units",
            is_default=True
        )

        # Create stock item with opening stock and maintain_batch=False
        item = StockItem.objects.create(
            name="Test Item 1",
            stock_group=self.group,
            base_unit=self.unit,
            maintain_batch=False,
            opening_stock=100,
            opening_rate=10,
            opening_value=1000
        )

        # Check stock table entries
        st_entries = StockTable.objects.filter(item=item, transaction_type='OPENING STOCK')
        std_entries = StockTableDuplicate.objects.filter(item=item, transaction_type='OPENING STOCK')
        self.assertEqual(st_entries.count(), 1)
        self.assertEqual(std_entries.count(), 1)
        
        self.assertEqual(st_entries.first().warehouse, default_wh)
        self.assertEqual(std_entries.first().warehouse, default_wh)


