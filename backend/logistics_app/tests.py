from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from register_app.models import CustomUser
from .models import Vehicle_category, Vehicle, Driver, ServiceType, VehicleHistory
from .utils import check_model_dependencies
from django.utils import timezone

class SafeDeleteTestCase(APITestCase):

    def setUp(self):
        # Create user
        self.user = CustomUser.objects.create_user(
            email='testuser@example.com',
            username='testuser',
            password='testpassword',
            first_name='Test',
            last_name='User'
        )
        self.client.force_authenticate(user=self.user)

        # Create category
        self.category = Vehicle_category.objects.create(
            category_name="Heavy Truck",
            created_by=self.user
        )

        # Create driver
        self.driver = Driver.objects.create(
            user=self.user,
            license_number="DL-12345",
            aadhaar_number="1234-5678-9012",
            phone_number="9876543210",
            license_exp_date=timezone.now().date() + timezone.timedelta(days=365),
            created_by=self.user
        )

        # Create vehicle
        self.vehicle = Vehicle.objects.create(
            category=self.category,
            driver=self.driver,
            vehicle_name="Volvo Multi-Axle",
            vehicle_number="KA-01-ME-1234",
            fuel_type="diesel",
            mileage=8.5,
            tonnage=16.0,
            volume=30.0,
            vehicle_insurance_date=timezone.now().date(),
            vehicle_taxes_date=timezone.now().date(),
            vehicle_pollution_date=timezone.now().date(),
            vehicle_fasttag="FT-12345",
            created_by=self.user
        )

        # Create service type
        self.service_type = ServiceType.objects.create(
            service_type="Routine Maintenance",
            description="Regular maintenance check",
            created_by=self.user
        )

        # Create vehicle history
        self.vehicle_history = VehicleHistory.objects.create(
            trans_date=timezone.now().date(),
            vehicle=self.vehicle,
            default_driver=self.driver,
            actual_km=15000.0,
            service_type=self.service_type,
            cost=500.0,
            narration="Oil change and tyre rotation",
            created_by=self.user
        )

    def test_delete_vehicle_category_blocked(self):
        """
        Verify that a vehicle category cannot be deleted if a vehicle references it.
        """
        # Count vehicles in category
        count = self.category.vehicles.count()
        url = reverse('vehicle_category_detail', kwargs={'pk': self.category.pk})
        
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data['detail'],
            f"Cannot delete Vehicle Category. Referenced by {count} Vehicle records (Volvo Multi-Axle (KA-01-ME-1234))."
        )

    def test_delete_driver_blocked(self):
        """
        Verify that a driver cannot be deleted if a vehicle or history record references it.
        """
        url = reverse('driver-detail', kwargs={'pk': self.driver.pk})
        
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data['detail'],
            "Cannot delete Driver. Referenced in Vehicle records (Volvo Multi-Axle (KA-01-ME-1234))."
        )

    def test_delete_vehicle_blocked(self):
        """
        Verify that a vehicle cannot be deleted if a history record references it.
        """
        url = reverse('vehicle_detail', kwargs={'pk': self.vehicle.pk})
        
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data['detail'],
            "Cannot delete Vehicle. Referenced by Vehicle History records (VHT-00001 — Volvo Multi-Axle (KA-01-ME-1234))."
        )

    def test_delete_service_type_blocked(self):
        """
        Verify that a service type cannot be deleted if a history record references it.
        """
        url = reverse('service_type_detail', kwargs={'pk': self.service_type.pk})
        
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data['detail'],
            "Cannot delete Service Type. Referenced by Vehicle History records (VHT-00001 — Volvo Multi-Axle (KA-01-ME-1234))."
        )

    def test_delete_vehicle_history_allowed(self):
        """
        Verify that a vehicle history record can be deleted as it is not referenced
        by any business tables (audit logs are ignored).
        """
        url = reverse('vehicle_history_detail', kwargs={'pk': self.vehicle_history.pk})
        
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(VehicleHistory.objects.filter(pk=self.vehicle_history.pk).exists())

    def test_successful_deletions_after_removing_dependencies(self):
        """
        Verify that deletion succeeds when the dependencies are removed.
        """
        # Delete vehicle history record first
        self.vehicle_history.delete()
        
        # Vehicle category still blocked because of vehicle
        url_cat = reverse('vehicle_category_detail', kwargs={'pk': self.category.pk})
        response = self.client.delete(url_cat)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Delete vehicle (driver is set null or CASCADE, category is CASCADE in model definition)
        # Note: in models.py, Vehicle has category CASCADE, driver SET_NULL.
        # Once vehicle is deleted, both driver and service type can be deleted safely.
        url_veh = reverse('vehicle_detail', kwargs={'pk': self.vehicle.pk})
        response = self.client.delete(url_veh)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        
        # Now driver should be deletable
        url_drv = reverse('driver-detail', kwargs={'pk': self.driver.pk})
        response = self.client.delete(url_drv)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Service type should be deletable
        url_srv = reverse('service_type_detail', kwargs={'pk': self.service_type.pk})
        response = self.client.delete(url_srv)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_utility_returns_correct_data(self):
        """
        Direct test of the utility function's return structure and correct detection.
        """
        res = check_model_dependencies(self.driver)
        self.assertTrue(res['is_referenced'])
        self.assertEqual(res['message'], "Cannot delete Driver. Referenced in Vehicle records (Volvo Multi-Axle (KA-01-ME-1234)).")
        self.assertTrue(len(res['dependencies']) > 0)

