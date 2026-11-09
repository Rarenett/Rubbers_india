from rest_framework import serializers
from django.http import request
from django.shortcuts import render
from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Vehicle_category, Vehicle,Driver,ServiceType,VehicleHistory,DriverAuditLog,VehicleAuditLog,VehicleHistoryAuditLog, FineAndToken, DriverJourney, DriverRoute, RouteLog, ServiceRequest, RouteMaster, TripMaster, PackageType, ItemSpecification
from .serializers import VehicleCategorySerializer, VehicleSerializer,DriverSerializer,ServiceTypeSerializer,VehicleHistorySerializer,DriverAuditLogSerializer,VehicleAuditLogSerializer,VehicleHistoryAuditLogSerializer, FineAndTokenSerializer, DriverJourneySerializer, DriverRouteSerializer, ServiceRequestSerializer, RouteMasterSerializer, TripMasterSerializer, PackageTypeSerializer, ItemSpecificationSerializer
from .utils import check_model_dependencies


class VehicleCategoryListView(views.APIView):
    """
    GET  /api/logistics/vehicle-categories/  → list all vehicle categories
    POST /api/logistics/vehicle-categories/  → create a new vehicle category
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        categories = Vehicle_category.objects.all().order_by('category_name')
        serializer = VehicleCategorySerializer(categories, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = VehicleCategorySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VehicleCategoryDetailView(views.APIView):
    """
    GET    /api/logistics/vehicle-categories/<pk>/  → retrieve single category
    PUT    /api/logistics/vehicle-categories/<pk>/  → full update
    PATCH  /api/logistics/vehicle-categories/<pk>/  → partial update
    DELETE /api/logistics/vehicle-categories/<pk>/  → delete
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return Vehicle_category.objects.get(pk=pk)
        except Vehicle_category.DoesNotExist:
            return None

    def get(self, request, pk):
        category = self.get_object(pk)
        if not category:
            return Response(
                {'detail': 'Vehicle category not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = VehicleCategorySerializer(category)
        return Response(serializer.data)

    def put(self, request, pk):
        category = self.get_object(pk)
        if not category:
            return Response(
                {'detail': 'Vehicle category not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = VehicleCategorySerializer(category, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        category = self.get_object(pk)
        if not category:
            return Response(
                {'detail': 'Vehicle category not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = VehicleCategorySerializer(
            category, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        category = self.get_object(pk)
        if not category:
            return Response(
                {'detail': 'Vehicle category not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        dep_check = check_model_dependencies(category)
        if dep_check['is_referenced']:
            return Response(
                {'detail': dep_check['message']},
                status=status.HTTP_400_BAD_REQUEST
            )
        category.delete()
        return Response(
            {'detail': 'Vehicle category deleted successfully.'},
            status=status.HTTP_204_NO_CONTENT
        )


class VehicleListView(views.APIView):
    """
    GET  /api/logistics/vehicles/  → list all vehicles
    POST /api/logistics/vehicles/  → create a new vehicle
    """
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def get(self, request):
        vehicles = Vehicle.objects.all().order_by('-created_at')
        serializer = VehicleSerializer(vehicles, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = VehicleSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            vehicle = serializer.save(created_by=request.user)
            VehicleAuditLog.objects.create(
            vehicle=vehicle,
            vehicle_name=vehicle.vehicle_name,
            vehicle_number=vehicle.vehicle_number,
            action='CREATE',
            modified_by=request.user,
            remarks='Vehicle Created'
        )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    

class VehicleDetailView(views.APIView):
    """
    GET    /api/logistics/vehicles/<pk>/  → retrieve single vehicle
    PUT    /api/logistics/vehicles/<pk>/  → full update
    PATCH  /api/logistics/vehicles/<pk>/  → partial update
    DELETE /api/logistics/vehicles/<pk>/  → delete
    """
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def get_object(self, pk):
        try:
            return Vehicle.objects.get(pk=pk)
        except Vehicle.DoesNotExist:
            return None

    def get(self, request, pk):
        vehicle = self.get_object(pk)
        if not vehicle:
            return Response(
                {'detail': 'Vehicle not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = VehicleSerializer(vehicle, context={'request': request})
        return Response(serializer.data)

    def put(self, request, pk):
        vehicle = self.get_object(pk)
        if not vehicle:
            return Response({'detail': 'Vehicle not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Snapshot before update
        old = {
        'vehicle_name':             vehicle.vehicle_name,
        'vehicle_number':           vehicle.vehicle_number,
        'vehicle_status':           vehicle.vehicle_status,
        'fuel_type':                vehicle.fuel_type,
        'driver':                   str(vehicle.driver) if vehicle.driver else None,
        'vehicle_insurance_date':   str(vehicle.vehicle_insurance_date),
        'vehicle_taxes_date':       str(vehicle.vehicle_taxes_date),
        'vehicle_pollution_date':   str(vehicle.vehicle_pollution_date),
        'next_service_date':        str(vehicle.next_service_date),
        'next_retest_date':         str(vehicle.next_retest_date),
        'tonnage':                  str(vehicle.tonnage),
        'volume':                   str(vehicle.volume),
        'mileage':                  str(vehicle.mileage),
        'rate':                     str(vehicle.rate),
    }

        serializer = VehicleSerializer(vehicle, data=request.data, context={'request': request})
        if serializer.is_valid():
            vehicle = serializer.save()

        changes = []
        new = {
            'vehicle_name':             vehicle.vehicle_name,
            'vehicle_number':           vehicle.vehicle_number,
            'vehicle_status':           vehicle.vehicle_status,
            'fuel_type':                vehicle.fuel_type,
            'driver':                   str(vehicle.driver) if vehicle.driver else None,
            'vehicle_insurance_date':   str(vehicle.vehicle_insurance_date),
            'vehicle_taxes_date':       str(vehicle.vehicle_taxes_date),
            'vehicle_pollution_date':   str(vehicle.vehicle_pollution_date),
            'next_service_date':        str(vehicle.next_service_date),
            'next_retest_date':         str(vehicle.next_retest_date),
            'tonnage':                  str(vehicle.tonnage),
            'volume':                   str(vehicle.volume),
            'mileage':                  str(vehicle.mileage),
            'rate':                     str(vehicle.rate),
        }

        labels = {
            'vehicle_name': 'Vehicle Name', 'vehicle_number': 'Vehicle Number',
            'vehicle_status': 'Status', 'fuel_type': 'Fuel Type', 'driver': 'Driver',
            'vehicle_insurance_date': 'Insurance Date', 'vehicle_taxes_date': 'Tax Date',
            'vehicle_pollution_date': 'Pollution Date', 'next_service_date': 'Next Service',
            'next_retest_date': 'Next Retest', 'tonnage': 'Tonnage',
            'volume': 'Volume', 'mileage': 'Mileage', 'rate': 'Rate',
        }

        for field, label in labels.items():
            if old[field] != new[field]:
                changes.append(f"{label} changed from '{old[field]}' to '{new[field]}'")

        VehicleAuditLog.objects.create(
            vehicle=vehicle,
            vehicle_name=vehicle.vehicle_name,
            vehicle_number=vehicle.vehicle_number,
            action='EDIT',
            modified_by=request.user,
            remarks=' | '.join(changes) if changes else 'Vehicle Updated'
        )
        return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        vehicle = self.get_object(pk)
        if not vehicle:
            return Response({'detail': 'Vehicle not found.'}, status=status.HTTP_404_NOT_FOUND)

        old = {
        'vehicle_name':           vehicle.vehicle_name,
        'vehicle_number':         vehicle.vehicle_number,
        'vehicle_status':         vehicle.vehicle_status,
        'fuel_type':              vehicle.fuel_type,
        'driver':                 str(vehicle.driver) if vehicle.driver else None,
        'vehicle_insurance_date': str(vehicle.vehicle_insurance_date),
        'vehicle_taxes_date':     str(vehicle.vehicle_taxes_date),
        'vehicle_pollution_date': str(vehicle.vehicle_pollution_date),
        'next_service_date':      str(vehicle.next_service_date),
        'next_retest_date':       str(vehicle.next_retest_date),
        'tonnage':                str(vehicle.tonnage),
        'volume':                 str(vehicle.volume),
        'mileage':                str(vehicle.mileage),
        'rate':                   str(vehicle.rate),
    }

        serializer = VehicleSerializer(vehicle, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            vehicle = serializer.save()

            changes = []
            new = {
            'vehicle_name':           vehicle.vehicle_name,
            'vehicle_number':         vehicle.vehicle_number,
            'vehicle_status':         vehicle.vehicle_status,
            'fuel_type':              vehicle.fuel_type,
            'driver':                 str(vehicle.driver) if vehicle.driver else None,
            'vehicle_insurance_date': str(vehicle.vehicle_insurance_date),
            'vehicle_taxes_date':     str(vehicle.vehicle_taxes_date),
            'vehicle_pollution_date': str(vehicle.vehicle_pollution_date),
            'next_service_date':      str(vehicle.next_service_date),
            'next_retest_date':       str(vehicle.next_retest_date),
            'tonnage':                str(vehicle.tonnage),
            'volume':                 str(vehicle.volume),
            'mileage':                str(vehicle.mileage),
            'rate':                   str(vehicle.rate),
            }

            labels = {
            'vehicle_name': 'Vehicle Name', 'vehicle_number': 'Vehicle Number',
            'vehicle_status': 'Status', 'fuel_type': 'Fuel Type', 'driver': 'Driver',
            'vehicle_insurance_date': 'Insurance Date', 'vehicle_taxes_date': 'Tax Date',
            'vehicle_pollution_date': 'Pollution Date', 'next_service_date': 'Next Service',
            'next_retest_date': 'Next Retest', 'tonnage': 'Tonnage',
            'volume': 'Volume', 'mileage': 'Mileage', 'rate': 'Rate',
            }

            for field, label in labels.items():
                if old[field] != new[field]:
                    changes.append(f"{label} changed from '{old[field]}' to '{new[field]}'")

            VehicleAuditLog.objects.create(
                vehicle=vehicle,
                vehicle_name=vehicle.vehicle_name,
                vehicle_number=vehicle.vehicle_number,
                action='EDIT',
                modified_by=request.user,
                remarks=' | '.join(changes) if changes else 'Vehicle Updated'
            )
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        vehicle = self.get_object(pk)
        if not vehicle:
            return Response({'detail': 'Vehicle not found.'}, status=status.HTTP_404_NOT_FOUND)

        dep_check = check_model_dependencies(vehicle)
        if dep_check['is_referenced']:
            return Response(
                {'detail': dep_check['message']},
                status=status.HTTP_400_BAD_REQUEST
            )

        VehicleAuditLog.objects.create(
            vehicle_name=vehicle.vehicle_name,
            vehicle_number=vehicle.vehicle_number,
            action='DELETE',
            modified_by=request.user,
            remarks=f"Vehicle Deleted: {vehicle.vehicle_name} (No: {vehicle.vehicle_number})"
        )
        vehicle.delete()
        return Response({'detail': 'Vehicle deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)

################### Vehicle Log #####################

class VehicleAuditLogListView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        logs = VehicleAuditLog.objects.all()
        serializer = VehicleAuditLogSerializer(logs, many=True)
        return Response(serializer.data)

class DriverListCreateView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        drivers = Driver.objects.all().order_by('-id')
        serializer = DriverSerializer(drivers, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = DriverSerializer(data=request.data)

        if serializer.is_valid():
            # serializer.save(created_by=request.user)
            driver = serializer.save(
                created_by=request.user
            )

            DriverAuditLog.objects.create(
    driver=driver,
    driver_name=driver.user.get_full_name()
        or driver.user.name
        or driver.user.username,
    action='CREATE',
    modified_by=request.user,
    remarks='Driver Created'
)
            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

class DriverDetailView(views.APIView):
    """
    GET    /api/logistics/drivers/<pk>/  → retrieve single driver
    PUT    /api/logistics/drivers/<pk>/  → full update
    PATCH  /api/logistics/drivers/<pk>/  → partial update
    DELETE /api/logistics/drivers/<pk>/  → delete
    """

    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def get_object(self, pk):
        try:
            return Driver.objects.get(pk=pk)
        except Driver.DoesNotExist:
            return None

    def get(self, request, pk):
        driver = self.get_object(pk)

        if not driver:
            return Response(
                {'detail': 'Driver not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = DriverSerializer(driver)
        return Response(serializer.data)

    def put(self, request, pk):
        driver = self.get_object(pk)

        if not driver:
            return Response(
                {'detail': 'Driver not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        old_phone = driver.phone_number
        old_status = driver.driver_status
        old_license = driver.license_number
        old_aadhaar = driver.aadhaar_number
        old_license_exp = driver.license_exp_date
        serializer = DriverSerializer(
            driver,
            data=request.data
        )

        if serializer.is_valid():
            driver = serializer.save()

            changes = []
            if old_phone != driver.phone_number:
                changes.append(
                    f"Phone Number changed from '{old_phone}' to '{driver.phone_number}'"
                )

            if old_status != driver.driver_status:
                changes.append(
                    f"Status changed from '{old_status}' to '{driver.driver_status}'"
                )

            if old_license != driver.license_number:
                changes.append(
                    f"License Number changed from '{old_license}' to '{driver.license_number}'"
                )

            if old_aadhaar != driver.aadhaar_number:
                changes.append(
                    f"Aadhaar Number changed from '{old_aadhaar}' to '{driver.aadhaar_number}'"
                )

            if str(old_license_exp) != str(driver.license_exp_date):
                changes.append(
                    f"License Expiry Date changed from '{old_license_exp}' to '{driver.license_exp_date}'"
                )

            remarks = (
                " | ".join(changes)
                if changes else "Driver Updated"
            )

            DriverAuditLog.objects.create(
                driver=driver,
                driver_name=(
                    driver.user.get_full_name()
                    or driver.user.name
                    or driver.user.username
                ) if driver.user else '',
                action='EDIT',
                modified_by=request.user,
                remarks=remarks
            )

            return Response(
                serializer.data
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    def patch(self, request, pk):
        driver = self.get_object(pk)
        if not driver:
            return Response(
                {'detail': 'Driver not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        old_phone = driver.phone_number
        old_status = driver.driver_status
        old_license = driver.license_number
        old_aadhaar = driver.aadhaar_number
        old_license_exp = driver.license_exp_date

        serializer = DriverSerializer(
            driver,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():
            driver = serializer.save()
            changes = []

            if old_phone != driver.phone_number:
                changes.append(
                    f"Phone Number changed from '{old_phone}' to '{driver.phone_number}'"
                )

            if old_status != driver.driver_status:
                changes.append(
                    f"Status changed from '{old_status}' to '{driver.driver_status}'"
                )

            if old_license != driver.license_number:
                changes.append(
                    f"License Number changed from '{old_license}' to '{driver.license_number}'"
                )

            if old_aadhaar != driver.aadhaar_number:
                changes.append(
                    f"Aadhaar Number changed from '{old_aadhaar}' to '{driver.aadhaar_number}'"
                )

            if str(old_license_exp) != str(driver.license_exp_date):
                changes.append(
                    f"License Expiry Date changed from '{old_license_exp}' to '{driver.license_exp_date}'"
                )

            remarks = (
                " | ".join(changes)
                if changes else "Driver Updated"
            )

            DriverAuditLog.objects.create(
                driver=driver,
                driver_name=(
                    driver.user.get_full_name()
                    or driver.user.name
                    or driver.user.username
                ) if driver.user else '',
                action='EDIT',
                modified_by=request.user,
                remarks=remarks
            )

            return Response(serializer.data)

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    def delete(self, request, pk):
        driver = self.get_object(pk)

        if not driver:
            return Response(
                {'detail': 'Driver not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        dep_check = check_model_dependencies(driver)
        if dep_check['is_referenced']:
            return Response(
                {'detail': dep_check['message']},
                status=status.HTTP_400_BAD_REQUEST
            )

        driver_name = (
            driver.user.get_full_name()
            or driver.user.name
            or driver.user.username
        ) if driver.user else ''
        DriverAuditLog.objects.create(
            driver_name=driver_name,
            action='DELETE',
            modified_by=request.user,
            remarks=f"Driver Deleted: {driver_name} (Mobile: {driver.phone_number})"
        )
        driver.delete()

        return Response(
            {'detail': 'Driver deleted successfully.'},
            status=status.HTTP_204_NO_CONTENT
        )

################### Driver Log #######################

class DriverAuditLogListView(views.APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        logs = DriverAuditLog.objects.all()

        serializer = DriverAuditLogSerializer(
            logs,
            many=True
        )

        return Response(serializer.data)



# ── Service Type ─────────────────────────────────────────────────────────────
class ServiceTypeListView(views.APIView):
    """
    GET  /api/logistics/service-types/  → list all service types
    POST /api/logistics/service-types/  → create a new service type
    """
    permission_classes = [IsAuthenticated]
 
    def get(self, request):
        service_types = ServiceType.objects.all().order_by('service_type')
        serializer = ServiceTypeSerializer(service_types, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
 
    def post(self, request):
        serializer = ServiceTypeSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
 
 
class ServiceTypeDetailView(views.APIView):
    """
    GET    /api/logistics/service-types/<pk>/
    PUT    /api/logistics/service-types/<pk>/
    PATCH  /api/logistics/service-types/<pk>/
    DELETE /api/logistics/service-types/<pk>/
    """
    permission_classes = [IsAuthenticated]
 
    def get_object(self, pk):
        try:
            return ServiceType.objects.get(pk=pk)
        except ServiceType.DoesNotExist:
            return None
 
    def get(self, request, pk):
        obj = self.get_object(pk)
        if not obj:
            return Response({'detail': 'Service type not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ServiceTypeSerializer(obj).data)
 
    def put(self, request, pk):
        obj = self.get_object(pk)
        if not obj:
            return Response({'detail': 'Service type not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ServiceTypeSerializer(obj, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
 
    def patch(self, request, pk):
        obj = self.get_object(pk)
        if not obj:
            return Response({'detail': 'Service type not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ServiceTypeSerializer(obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
 
    def delete(self, request, pk):
        obj = self.get_object(pk)
        if not obj:
            return Response({'detail': 'Service type not found.'}, status=status.HTTP_404_NOT_FOUND)

        dep_check = check_model_dependencies(obj)
        if dep_check['is_referenced']:
            return Response(
                {'detail': dep_check['message']},
                status=status.HTTP_400_BAD_REQUEST
            )

        obj.delete()
        return Response({'detail': 'Service type deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)


# ── Vehicle History ───────────────────────────────────────────────────────────
class VehicleHistoryListView(views.APIView):
    """
    GET  /api/logistics/vehicle-history/   → list all records
    POST /api/logistics/vehicle-history/   → create new record
    Optional query param: ?vehicle=<id>    → filter by vehicle
    """
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)
 
    def get(self, request):
        qs = VehicleHistory.objects.select_related(
            'vehicle', 'default_driver', 'default_driver__user',
            'service_type', 'created_by',
        ).all()
        vehicle_id = request.query_params.get('vehicle')
        if vehicle_id:
            qs = qs.filter(vehicle_id=vehicle_id)
        return Response(
            VehicleHistorySerializer(qs, many=True, context={'request': request}).data
        )
 
    def post(self, request):
        s = VehicleHistorySerializer(data=request.data, context={'request': request})
        if s.is_valid():
            obj = s.save(created_by=request.user)

            VehicleHistoryAuditLog.objects.create(
            vehicle_history=obj,
            trans_no=obj.trans_no,
            vehicle_name=obj.vehicle.vehicle_name if obj.vehicle else '',
            vehicle_number=obj.vehicle.vehicle_number if obj.vehicle else '',
            action='CREATE',
            modified_by=request.user,
            remarks='Vehicle History Created'
        )

            return Response(s.data, status=status.HTTP_201_CREATED)
        return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)
 
 
class VehicleHistoryDetailView(views.APIView):
    """
    GET    /api/logistics/vehicle-history/<pk>/
    PUT    /api/logistics/vehicle-history/<pk>/
    PATCH  /api/logistics/vehicle-history/<pk>/
    DELETE /api/logistics/vehicle-history/<pk>/
    """
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)
 
    def get_object(self, pk):
        try:
            return VehicleHistory.objects.select_related(
                'vehicle', 'default_driver', 'default_driver__user',
                'service_type', 'created_by',
            ).get(pk=pk)
        except VehicleHistory.DoesNotExist:
            return None
 
    def get(self, request, pk):
        obj = self.get_object(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(VehicleHistorySerializer(obj, context={'request': request}).data)
 
    def put(self, request, pk):
        obj = self.get_object(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        old = {
        'vehicle':        str(obj.vehicle) if obj.vehicle else None,
        'trans_date':     str(obj.trans_date),
        'default_driver': str(obj.default_driver) if obj.default_driver else None,
        'actual_km':      str(obj.actual_km),
        'service_type':   str(obj.service_type) if obj.service_type else None,
        'cost':           str(obj.cost),
        'narration':      obj.narration or '',
        }

        s = VehicleHistorySerializer(obj, data=request.data, context={'request': request})
        if s.is_valid():
            obj = s.save()

            new = {
            'vehicle':        str(obj.vehicle) if obj.vehicle else None,
            'trans_date':     str(obj.trans_date),
            'default_driver': str(obj.default_driver) if obj.default_driver else None,
            'actual_km':      str(obj.actual_km),
            'service_type':   str(obj.service_type) if obj.service_type else None,
            'cost':           str(obj.cost),
            'narration':      obj.narration or '',
            }

            labels = {
            'vehicle':        'Vehicle',
            'trans_date':     'Transaction Date',
            'default_driver': 'Driver',
            'actual_km':      'Actual KM',
            'service_type':   'Service Type',
            'cost':           'Cost',
            'narration':      'Narration',
            }

            changes = [
            f"{labels[f]} changed from '{old[f]}' to '{new[f]}'"
            for f in labels if old[f] != new[f]
            ]

            VehicleHistoryAuditLog.objects.create(
            vehicle_history=obj,
            trans_no=obj.trans_no,
            vehicle_name=obj.vehicle.vehicle_name if obj.vehicle else '',
            vehicle_number=obj.vehicle.vehicle_number if obj.vehicle else '',
            action='EDIT',
            modified_by=request.user,
            remarks=' | '.join(changes) if changes else 'Vehicle History Updated'
            )

            return Response(s.data)
        return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)
 
    def patch(self, request, pk):
        obj = self.get_object(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        old = {
        'vehicle':        str(obj.vehicle) if obj.vehicle else None,
        'trans_date':     str(obj.trans_date),
        'default_driver': str(obj.default_driver) if obj.default_driver else None,
        'actual_km':      str(obj.actual_km),
        'service_type':   str(obj.service_type) if obj.service_type else None,
        'cost':           str(obj.cost),
        'narration':      obj.narration or '',
    }

        s = VehicleHistorySerializer(obj, data=request.data, partial=True, context={'request': request})
        if s.is_valid():
            obj = s.save()

            new = {
            'vehicle':        str(obj.vehicle) if obj.vehicle else None,
            'trans_date':     str(obj.trans_date),
            'default_driver': str(obj.default_driver) if obj.default_driver else None,
            'actual_km':      str(obj.actual_km),
            'service_type':   str(obj.service_type) if obj.service_type else None,
            'cost':           str(obj.cost),
            'narration':      obj.narration or '',
            }

            labels = {
            'vehicle':        'Vehicle',
            'trans_date':     'Transaction Date',
            'default_driver': 'Driver',
            'actual_km':      'Actual KM',
            'service_type':   'Service Type',
            'cost':           'Cost',
            'narration':      'Narration',
            }

            changes = [
            f"{labels[f]} changed from '{old[f]}' to '{new[f]}'"
            for f in labels if old[f] != new[f]
            ]

            VehicleHistoryAuditLog.objects.create(
            vehicle_history=obj,
            trans_no=obj.trans_no,
            vehicle_name=obj.vehicle.vehicle_name if obj.vehicle else '',
            vehicle_number=obj.vehicle.vehicle_number if obj.vehicle else '',
            action='EDIT',
            modified_by=request.user,
            remarks=' | '.join(changes) if changes else 'Vehicle History Updated'
            )

            return Response(s.data)
        return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)
 
    def delete(self, request, pk):
        obj = self.get_object(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        dep_check = check_model_dependencies(obj)
        if dep_check['is_referenced']:
            return Response(
                {'detail': dep_check['message']},
                status=status.HTTP_400_BAD_REQUEST
            )

        VehicleHistoryAuditLog.objects.create(
            trans_no=obj.trans_no,
            vehicle_name=obj.vehicle.vehicle_name if obj.vehicle else '',
            vehicle_number=obj.vehicle.vehicle_number if obj.vehicle else '',
            action='DELETE',
            modified_by=request.user,
            remarks=f"Vehicle History Deleted: Trans No {obj.trans_no} (Vehicle: {obj.vehicle.vehicle_number if obj.vehicle else ''})"
        )

        obj.delete()
        return Response({'detail': 'Vehicle history record deleted.'}, status=status.HTTP_204_NO_CONTENT)


############ VehicleHistory Log ############# 
class VehicleHistoryAuditLogListView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        logs = VehicleHistoryAuditLog.objects.all()
        serializer = VehicleHistoryAuditLogSerializer(logs, many=True)
        return Response(serializer.data)
 
 
# ── Vehicle Lookup (auto-fill helper) ────────────────────────────────────────
class VehicleLookupView(views.APIView):
    """
    GET /api/logistics/vehicle-lookup/<pk>/
 
    Returns vehicle_name, vehicle_number, and the default driver
    for that vehicle so the frontend can auto-fill those fields instantly.
 
    Driver resolution order:
      1. Most recent VehicleHistory record for this vehicle (last used driver)
      2. First available Driver in the system (fallback so field is never blank)
    """
    permission_classes = [IsAuthenticated]
 
    def get(self, request, pk):
        try:
            vehicle = Vehicle.objects.get(pk=pk)
        except Vehicle.DoesNotExist:
            return Response({'detail': 'Vehicle not found.'}, status=status.HTTP_404_NOT_FOUND)
 
        driver_id   = None
        driver_name = None
 
        # 1. Check most recent history record for this vehicle
        try:
            last = VehicleHistory.objects.filter(
                vehicle=vehicle,
                default_driver__isnull=False,
            ).select_related('default_driver__user').order_by('-trans_date', '-id').first()
 
            if last and last.default_driver:
                d = last.default_driver
                driver_id = d.id
                if d.user:
                    driver_name = (
                        d.user.get_full_name()
                        or d.user.username
                        or d.user.email
                    )
                else:
                    driver_name = f"Driver #{d.id}"
        except Exception:
            pass
 
        # 2. Fallback — first available driver in the system
        if not driver_id:
            try:
                fallback = Driver.objects.select_related('user').filter(
                    driver_status='available'
                ).order_by('id').first()
 
                if fallback:
                    driver_id = fallback.id
                    if fallback.user:
                        driver_name = (
                            fallback.user.get_full_name()
                            or fallback.user.username
                            or fallback.user.email
                        )
                    else:
                        driver_name = f"Driver #{fallback.id}"
            except Exception:
                pass
 
        return Response({
            'id':                  vehicle.id,
            'vehicle_name':        vehicle.vehicle_name,
            'vehicle_number':      vehicle.vehicle_number,
            'vehicle_code':        vehicle.vehicle_code,
            'default_driver_id':   driver_id,
            'default_driver_name': driver_name,
        })


class VehicleHistoryNextNumberView(views.APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        last = VehicleHistory.objects.order_by('-id').first()

        if last and last.trans_no:
            try:
                last_num = int(last.trans_no.split('-')[1])
                next_no = f"VHT-{last_num + 1:05d}"
            except:
                next_no = "VHT-00001"
        else:
            next_no = "VHT-00001"

        return Response({
            'trans_no': next_no
        })

# ── Fines And Tokens ───────────────────────────────────────────────────────────
class FineAndTokenListView(views.APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def get(self, request):
        fines = FineAndToken.objects.all().order_by('-fine_date')
        driver_id = request.query_params.get('driver')
        if driver_id:
            fines = fines.filter(driver_id=driver_id)
        
        serializer = FineAndTokenSerializer(fines, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = FineAndTokenSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class FineAndTokenDetailView(views.APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def get_object(self, pk):
        try:
            return FineAndToken.objects.get(pk=pk)
        except FineAndToken.DoesNotExist:
            return None

    def get(self, request, pk):
        fine = self.get_object(pk)
        if not fine:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(FineAndTokenSerializer(fine, context={'request': request}).data)

    def put(self, request, pk):
        fine = self.get_object(pk)
        if not fine:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = FineAndTokenSerializer(fine, data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        fine = self.get_object(pk)
        if not fine:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = FineAndTokenSerializer(fine, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        fine = self.get_object(pk)
        if not fine:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        fine.delete()
        return Response({'detail': 'Fine deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)

class DriverJourneyListCreateView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        driver_id = request.query_params.get('driver_id')
        status_filter = request.query_params.get('status')
        date_filter = request.query_params.get('date')

        journeys = DriverJourney.objects.all()
        if driver_id:
            journeys = journeys.filter(driver_id=driver_id)
        if status_filter:
            journeys = journeys.filter(status=status_filter)
        if date_filter:
            journeys = journeys.filter(date=date_filter)

        serializer = DriverJourneySerializer(journeys, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = DriverJourneySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DriverJourneyDetailView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return DriverJourney.objects.get(pk=pk)
        except DriverJourney.DoesNotExist:
            return None

    def get(self, request, pk):
        journey = self.get_object(pk)
        if not journey:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = DriverJourneySerializer(journey)
        return Response(serializer.data)

    def patch(self, request, pk):
        journey = self.get_object(pk)
        if not journey:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = DriverJourneySerializer(journey, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        journey = self.get_object(pk)
        # 1. Check most recent history record for this vehicle
        try:
            last = VehicleHistory.objects.filter(
                vehicle=vehicle,
                default_driver__isnull=False,
            ).select_related('default_driver__user').order_by('-trans_date', '-id').first()
 
            if last and last.default_driver:
                d = last.default_driver
                driver_id = d.id
                if d.user:
                    driver_name = (
                        d.user.get_full_name()
                        or d.user.username
                        or d.user.email
                    )
                else:
                    driver_name = f"Driver #{d.id}"
        except Exception:
            pass
 
        # 2. Fallback — first available driver in the system
        if not driver_id:
            try:
                fallback = Driver.objects.select_related('user').filter(
                    driver_status='available'
                ).order_by('id').first()
 
                if fallback:
                    driver_id = fallback.id
                    if fallback.user:
                        driver_name = (
                            fallback.user.get_full_name()
                            or fallback.user.username
                            or fallback.user.email
                        )
                    else:
                        driver_name = f"Driver #{fallback.id}"
            except Exception:
                pass
 
        return Response({
            'id':                  vehicle.id,
            'vehicle_name':        vehicle.vehicle_name,
            'vehicle_number':      vehicle.vehicle_number,
            'vehicle_code':        vehicle.vehicle_code,
            'default_driver_id':   driver_id,
            'default_driver_name': driver_name,
        })


class VehicleHistoryNextNumberView(views.APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        last = VehicleHistory.objects.order_by('-id').first()

        if last and last.trans_no:
            try:
                last_num = int(last.trans_no.split('-')[1])
                next_no = f"VHT-{last_num + 1:05d}"
            except:
                next_no = "VHT-00001"
        else:
            next_no = "VHT-00001"

        return Response({
            'trans_no': next_no
        })

# ── Fines And Tokens ───────────────────────────────────────────────────────────
class FineAndTokenListView(views.APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def get(self, request):
        fines = FineAndToken.objects.all().order_by('-fine_date')
        driver_id = request.query_params.get('driver')
        if driver_id:
            fines = fines.filter(driver_id=driver_id)
        
        serializer = FineAndTokenSerializer(fines, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = FineAndTokenSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class FineAndTokenDetailView(views.APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def get_object(self, pk):
        try:
            return FineAndToken.objects.get(pk=pk)
        except FineAndToken.DoesNotExist:
            return None

    def get(self, request, pk):
        fine = self.get_object(pk)
        if not fine:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(FineAndTokenSerializer(fine, context={'request': request}).data)

    def put(self, request, pk):
        fine = self.get_object(pk)
        if not fine:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = FineAndTokenSerializer(fine, data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        fine = self.get_object(pk)
        if not fine:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = FineAndTokenSerializer(fine, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        fine = self.get_object(pk)
        if not fine:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        fine.delete()
        return Response({'detail': 'Fine deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)

class DriverJourneyListCreateView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        driver_id = request.query_params.get('driver_id')
        status_filter = request.query_params.get('status')
        date_filter = request.query_params.get('date')

        journeys = DriverJourney.objects.all()
        if driver_id:
            journeys = journeys.filter(driver_id=driver_id)
        if status_filter:
            journeys = journeys.filter(status=status_filter)
        if date_filter:
            journeys = journeys.filter(date=date_filter)

        serializer = DriverJourneySerializer(journeys, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = DriverJourneySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DriverJourneyDetailView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return DriverJourney.objects.get(pk=pk)
        except DriverJourney.DoesNotExist:
            return None

    def get(self, request, pk):
        journey = self.get_object(pk)
        if not journey:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = DriverJourneySerializer(journey)
        return Response(serializer.data)

    def patch(self, request, pk):
        journey = self.get_object(pk)
        if not journey:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = DriverJourneySerializer(journey, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        journey = self.get_object(pk)
        if not journey:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        journey.delete()
        return Response({'detail': 'Journey deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)

class DriverRouteListCreateView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        routes = DriverRoute.objects.all().order_by('-date', '-id')
        serializer = DriverRouteSerializer(routes, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = DriverRouteSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DriverRouteDetailView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return DriverRoute.objects.get(pk=pk)
        except DriverRoute.DoesNotExist:
            return None

    def get(self, request, pk):
        route = self.get_object(pk)
        if not route:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = DriverRouteSerializer(route)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        route = self.get_object(pk)
        if not route:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = DriverRouteSerializer(route, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        route = self.get_object(pk)
        if not route:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        route.delete()
        return Response({'detail': 'Route deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)

class ServiceRequestListCreateView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        service_requests = ServiceRequest.objects.all().order_by('-date', '-id')
        serializer = ServiceRequestSerializer(service_requests, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = ServiceRequestSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ServiceRequestDetailView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return ServiceRequest.objects.get(pk=pk)
        except ServiceRequest.DoesNotExist:
            return None

    def get(self, request, pk):
        service_request = self.get_object(pk)
        if not service_request:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ServiceRequestSerializer(service_request)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        service_request = self.get_object(pk)
        if not service_request:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ServiceRequestSerializer(service_request, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        service_request = self.get_object(pk)
        if not service_request:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ServiceRequestSerializer(service_request, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        service_request = self.get_object(pk)
        if not service_request:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        service_request.delete()
        return Response({'detail': 'Deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)

class RouteMasterListView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        routes = RouteMaster.objects.all().order_by('-id')
        serializer = RouteMasterSerializer(routes, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = RouteMasterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class RouteMasterDetailView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return RouteMaster.objects.get(pk=pk)
        except RouteMaster.DoesNotExist:
            return None

    def get(self, request, pk):
        route = self.get_object(pk)
        if not route:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = RouteMasterSerializer(route)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        route = self.get_object(pk)
        if not route:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = RouteMasterSerializer(route, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        route = self.get_object(pk)
        if not route:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = RouteMasterSerializer(route, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        route = self.get_object(pk)
        if not route:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        route.delete()
        return Response({'detail': 'Deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)

class TripMasterListView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        trips = TripMaster.objects.all().order_by('-id')
        serializer = TripMasterSerializer(trips, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = TripMasterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class TripMasterDetailView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return TripMaster.objects.get(pk=pk)
        except TripMaster.DoesNotExist:
            return None

    def get(self, request, pk):
        trip = self.get_object(pk)
        if not trip:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = TripMasterSerializer(trip)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        trip = self.get_object(pk)
        if not trip:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = TripMasterSerializer(trip, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        trip = self.get_object(pk)
        if not trip:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = TripMasterSerializer(trip, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        trip = self.get_object(pk)
        if not trip:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        trip.delete()
        return Response({'detail': 'Deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)

class PackageTypeListView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        package_types = PackageType.objects.all().order_by('-created_at')
        serializer = PackageTypeSerializer(package_types, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = PackageTypeSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PackageTypeDetailView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return PackageType.objects.get(pk=pk)
        except PackageType.DoesNotExist:
            return None

    def get(self, request, pk):
        package_type = self.get_object(pk)
        if not package_type:
            return Response({'error': 'Package Type not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = PackageTypeSerializer(package_type)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        package_type = self.get_object(pk)
        if not package_type:
            return Response({'error': 'Package Type not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = PackageTypeSerializer(package_type, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        package_type = self.get_object(pk)
        if not package_type:
            return Response({'error': 'Package Type not found'}, status=status.HTTP_404_NOT_FOUND)
        package_type.delete()
        return Response({'message': 'Package Type deleted successfully'}, status=status.HTTP_204_NO_CONTENT)

class ItemSpecificationListView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        specs = ItemSpecification.objects.all().order_by('-created_at')
        serializer = ItemSpecificationSerializer(specs, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = ItemSpecificationSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ItemSpecificationDetailView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return ItemSpecification.objects.get(pk=pk)
        except ItemSpecification.DoesNotExist:
            return None

    def get(self, request, pk):
        spec = self.get_object(pk)
        if not spec:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ItemSpecificationSerializer(spec)
        return Response(serializer.data)

    def put(self, request, pk):
        spec = self.get_object(pk)
        if not spec:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ItemSpecificationSerializer(spec, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        spec = self.get_object(pk)
        if not spec:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        spec.delete()
        return Response({'message': 'Item Specification deleted successfully'}, status=status.HTTP_204_NO_CONTENT)


from sales_app.models import SalesOrder, SalesOrderItem
from django.db.models import Sum, F, DecimalField
from django.db.models.functions import Coalesce

class TripLoadingDataView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            trip = TripMaster.objects.get(pk=pk)
        except TripMaster.DoesNotExist:
            return Response({'error': 'Trip not found'}, status=status.HTTP_404_NOT_FOUND)

        vehicle_vol = float(trip.vehicle.volume) if trip.vehicle and trip.vehicle.volume else 0.0

        # Get unique SalesOrders that have a TripLoadedItem for this trip
        loaded_orders = SalesOrder.objects.filter(trip_loaded_items__trip=trip).distinct()
        loaded_vol = 0.0
        loaded_orders_data = []
        product_summary = {}

        route_stops = trip.route.stops if trip.route and trip.route.stops else []
        route_stops_lower = [stop.lower() for stop in route_stops]

        for order in loaded_orders:
            order_vol = 0.0
            order_items_summary = []
            items_details = []
            loaded_items = trip.loaded_items.filter(sales_order=order)
            for loaded_item in loaded_items:
                item = loaded_item.sales_order_item
                product_name = item.product.name if item.product else 'Unknown Product'
                qty = float(loaded_item.loaded_quantity)
                
                # Add to global summary
                if product_name in product_summary:
                    product_summary[product_name] += qty
                else:
                    product_summary[product_name] = qty
                    
                # Add to order summary
                order_items_summary.append(f"{product_name}: {qty:.2f}")
                
                spec = ItemSpecification.objects.filter(stock_item=item.product).first()
                if spec and spec.items_per_case and spec.volume_per_case:
                    cases = qty / float(spec.items_per_case)
                    order_vol += cases * float(spec.volume_per_case)
                
                items_details.append({
                    'id': item.id,
                    'product_name': product_name,
                    'quantity': qty
                })
            loaded_vol += order_vol
            
            items_str = ", ".join(order_items_summary)
            
            # get location logic
            order_loc = None
            if order.delivery_location:
                order_loc = order.delivery_location.stop_name
            elif order.customer_ledger:
                first_loc = order.customer_ledger.delivery_locations.first()
                if first_loc and first_loc.delivery_location:
                    order_loc = first_loc.delivery_location.stop_name
            
            stop_dist = 0.0
            if order_loc:
                loc_lower = order_loc.lower().strip()
                rsm = RouteStopMaster.objects.filter(stop_name__iexact=loc_lower).first()
                if rsm and rsm.distance_km:
                    stop_dist = float(rsm.distance_km)
            
            loaded_orders_data.append({
                'id': order.id,
                'so_no': order.so_no,
                'customer_name': order.customer_ledger.name if order.customer_ledger else 'Unknown',
                'delivery_location': order_loc or 'N/A',
                'volume': round(order_vol, 2),
                'status': order.status,
                'items_summary': items_str,
                'items_details': items_details,
                'stop_dist': stop_dist
            })

        # Sort loaded_orders_data by stop_dist descending, then by customer_name
        loaded_orders_data.sort(key=lambda x: (-x['stop_dist'], x['customer_name']))

        return Response({
            'trip_id': trip.trip_id,
            'trip_date': trip.trip_date,
            'vehicle': trip.vehicle.vehicle_name if trip.vehicle else 'N/A',
            'vehicle_number': trip.vehicle.vehicle_number if trip.vehicle else 'N/A',
            'driver': f"{trip.driver.user.first_name} {trip.driver.user.last_name}".strip() if trip.driver and trip.driver.user else 'N/A',
            'route': trip.route.route_name if trip.route else 'N/A',
            'vehicle_volume': vehicle_vol,
            'loaded_volume': round(loaded_vol, 2),
            'loaded_orders': loaded_orders_data,
            'product_summary': [{'product': k, 'total_qty': v} for k, v in product_summary.items()]
        }, status=status.HTTP_200_OK)


class TripAvailableOrdersView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            trip = TripMaster.objects.get(pk=pk)
        except TripMaster.DoesNotExist:
            return Response({'error': 'Trip not found'}, status=status.HTTP_404_NOT_FOUND)

        route_stops = trip.route.stops if trip.route and trip.route.stops else []
        
        from_date_str = request.query_params.get('from_date')
        to_date_str = request.query_params.get('to_date')
        
        available_orders = SalesOrder.objects.filter(
            status__in=['Pending', 'Confirmed', 'Partially Loaded'],
            approval_status='Approved'
        )
        
        if from_date_str and to_date_str:
            from datetime import datetime
            
            def parse_date(date_str):
                try:
                    return datetime.strptime(date_str, '%Y-%m-%d').date()
                except ValueError:
                    try:
                        return datetime.strptime(date_str, '%d-%m-%Y').date()
                    except ValueError:
                        raise ValueError("Invalid date format")

            try:
                from_date = parse_date(from_date_str)
                to_date = parse_date(to_date_str)
                available_orders = available_orders.filter(
                    preferred_delivery_date__date__range=[from_date, to_date]
                )
            except ValueError:
                available_orders = available_orders.filter(preferred_delivery_date__date=trip.trip_date)
        else:
            available_orders = available_orders.filter(preferred_delivery_date__date=trip.trip_date)
        
        # Filter by vehicle if the trip has one assigned
        if trip.vehicle and trip.vehicle.vehicle_number:
            available_orders = available_orders.filter(
                dispatch_through=trip.vehicle.vehicle_number
            )
            
        print("DEBUG LOGISTICS: from_date_str=", from_date_str, "to_date_str=", to_date_str)
        print("DEBUG LOGISTICS: available_orders count before route filter=", available_orders.count())
        
        route_stops_lower = [stop.lower() for stop in route_stops]
        
        filtered_orders = []
        for order in available_orders:
            # Check delivery location
            order_loc = None
            if order.delivery_location:
                order_loc = order.delivery_location.stop_name
            elif order.customer_ledger:
                first_loc = order.customer_ledger.delivery_locations.first()
                if first_loc and first_loc.delivery_location:
                    order_loc = first_loc.delivery_location.stop_name
            
            if order_loc:
                loc_lower = order_loc.lower()
                if loc_lower in route_stops_lower:
                    from logistics_app.models import RouteStopMaster
                    rsm = RouteStopMaster.objects.filter(stop_name__iexact=loc_lower).first()
                    stop_dist = float(rsm.distance_km) if rsm and rsm.distance_km else 0.0
                    
                    order_vol = 0.0
                    items = SalesOrderItem.objects.filter(sales_order=order)
                    has_remaining = False
                    for item in items:
                        # Calculate remaining quantity
                        loaded_sum = sum(float(li.loaded_quantity) for li in item.trip_loaded_items.all())
                        rem_qty = float(item.quantity) - loaded_sum
                        
                        if rem_qty > 0:
                            has_remaining = True
                            spec = ItemSpecification.objects.filter(stock_item=item.product).first()
                            if spec and spec.items_per_case and spec.volume_per_case:
                                cases = rem_qty / float(spec.items_per_case)
                                order_vol += cases * float(spec.volume_per_case)
                            
                    if has_remaining:
                        filtered_orders.append({
                            'id': order.id,
                            'so_no': order.so_no,
                            'customer_name': order.customer_ledger.name if order.customer_ledger else 'Unknown',
                            'delivery_location': order_loc,
                            'volume': round(order_vol, 2),
                            'status': order.status,
                            'stop_dist': stop_dist,
                            'delivery_date': order.preferred_delivery_date.strftime('%d-%m-%Y') if order.preferred_delivery_date else ''
                        })

        # Sort filtered_orders by stop_dist descending, then by customer_name
        filtered_orders.sort(key=lambda x: (-x['stop_dist'], x['customer_name']))

        return Response(filtered_orders, status=status.HTTP_200_OK)


class TripLoadOrderView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            trip = TripMaster.objects.get(pk=pk)
        except TripMaster.DoesNotExist:
            return Response({'error': 'Trip not found'}, status=status.HTTP_404_NOT_FOUND)
            
        order_id = request.data.get('order_id')
        if not order_id:
            return Response({'error': 'Order ID required'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            order = SalesOrder.objects.get(pk=order_id)
        except SalesOrder.DoesNotExist:
            return Response({'error': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
            
        from logistics_app.models import TripLoadedItem
        
        # Load the remaining quantities for all items of this order
        items = SalesOrderItem.objects.filter(sales_order=order)
        for item in items:
            loaded_sum = sum(float(li.loaded_quantity) for li in item.trip_loaded_items.all())
            rem_qty = float(item.quantity) - loaded_sum
            if rem_qty > 0:
                li, created = TripLoadedItem.objects.get_or_create(
                    trip=trip,
                    sales_order=order,
                    sales_order_item=item,
                    defaults={'loaded_quantity': 0}
                )
                li.loaded_quantity = float(li.loaded_quantity) + rem_qty
                li.save()
                
        # Recalculate status across all items
        total_ordered = sum(float(i.quantity) for i in items)
        total_loaded = sum(float(li.loaded_quantity) for i in items for li in i.trip_loaded_items.all())
        
        if total_loaded >= total_ordered:
            order.status = 'Loaded'
        elif total_loaded > 0:
            order.status = 'Partially Loaded'
        else:
            order.status = 'Pending'
        order.save()
        
        return Response({'message': 'Order loaded successfully'}, status=status.HTTP_200_OK)


class TripUnloadOrderView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            trip = TripMaster.objects.get(pk=pk)
        except TripMaster.DoesNotExist:
            return Response({'error': 'Trip not found'}, status=status.HTTP_404_NOT_FOUND)
            
        order_id = request.data.get('order_id')
        if not order_id:
            return Response({'error': 'Order ID required'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            order = SalesOrder.objects.get(pk=order_id)
        except SalesOrder.DoesNotExist:
            return Response({'error': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
            
        from logistics_app.models import TripLoadedItem
        
        # Delete loaded items for this trip and order
        deleted_count, _ = TripLoadedItem.objects.filter(trip=trip, sales_order=order).delete()
        if deleted_count == 0:
            return Response({'error': 'Order is not loaded in this trip'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Recalculate status
        items = SalesOrderItem.objects.filter(sales_order=order)
        total_ordered = sum(float(i.quantity) for i in items)
        total_loaded = sum(float(li.loaded_quantity) for i in items for li in i.trip_loaded_items.all())
        
        if total_loaded >= total_ordered:
            order.status = 'Loaded'
        elif total_loaded > 0:
            order.status = 'Partially Loaded'
        else:
            order.status = 'Pending'
        order.save()
        
        return Response({'message': 'Order unloaded successfully'}, status=status.HTTP_200_OK)


from django.db import transaction

class TripEditLoadedOrderView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            trip = TripMaster.objects.get(pk=pk)
        except TripMaster.DoesNotExist:
            return Response({'error': 'Trip not found'}, status=status.HTTP_404_NOT_FOUND)
            
        order_id = request.data.get('order_id')
        adjusted_items = request.data.get('items', {}) # dict of {item_id: new_quantity}
        
        if not order_id:
            return Response({'error': 'Order ID required'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            order = SalesOrder.objects.get(pk=order_id)
        except SalesOrder.DoesNotExist:
            return Response({'error': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
            
        from logistics_app.models import TripLoadedItem
        
        if not TripLoadedItem.objects.filter(trip=trip, sales_order=order).exists():
            return Response({'error': 'Order is not loaded in this trip'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            order_items = list(SalesOrderItem.objects.filter(sales_order=order))
            for item in order_items:
                item_id_str = str(item.id)
                if item_id_str in adjusted_items:
                    new_qty = float(adjusted_items[item_id_str])
                    # Ensure we don't set loaded quantity higher than remaining quantity across all OTHER trips
                    other_trips_loaded = sum(float(li.loaded_quantity) for li in item.trip_loaded_items.exclude(trip=trip))
                    max_allowed = float(item.quantity) - other_trips_loaded
                    
                    if new_qty > max_allowed:
                        return Response({'error': f'Cannot load {new_qty} for item {item.product.name} (max allowed {max_allowed})'}, status=status.HTTP_400_BAD_REQUEST)
                        
                    if new_qty == 0:
                        # Remove if quantity is set to 0
                        TripLoadedItem.objects.filter(trip=trip, sales_order=order, sales_order_item=item).delete()
                    else:
                        # Update or create the TripLoadedItem for this trip
                        trip_loaded_item, _ = TripLoadedItem.objects.get_or_create(
                            trip=trip,
                            sales_order=order,
                            sales_order_item=item,
                            defaults={'loaded_quantity': new_qty}
                        )
                        
                        if float(trip_loaded_item.loaded_quantity) != new_qty:
                            trip_loaded_item.loaded_quantity = new_qty
                            trip_loaded_item.save()
                            
            # Recalculate SalesOrder status
            total_ordered = sum(float(i.quantity) for i in order_items)
            total_loaded = sum(float(li.loaded_quantity) for i in order_items for li in i.trip_loaded_items.all())
            
            if total_loaded >= total_ordered:
                order.status = 'Loaded'
            elif total_loaded > 0:
                order.status = 'Partially Loaded'
            else:
                order.status = 'Pending'
            order.save(update_fields=['status'])
            
            # If nothing is loaded on this trip anymore, just in case
            if not TripLoadedItem.objects.filter(trip=trip, sales_order=order).exists():
                # We don't delete the order, just it won't show in the trip anymore
                pass
                
            return Response({'message': 'Order quantities updated successfully'}, status=status.HTTP_200_OK)
from rest_framework import viewsets
from .models import TyreSize
from .serializers import TyreSizeSerializer

class TyreSizeViewSet(viewsets.ModelViewSet):
    queryset = TyreSize.objects.all().order_by('-created_at')
    serializer_class = TyreSizeSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

from rest_framework import generics
from .models import RouteStopMaster
from .serializers import RouteStopMasterSerializer

class RouteStopMasterListView(generics.ListCreateAPIView):
    queryset = RouteStopMaster.objects.prefetch_related("area_delivery_locations").all()
    serializer_class = RouteStopMasterSerializer
    permission_classes = [IsAuthenticated]

class RouteStopMasterDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = RouteStopMaster.objects.prefetch_related("area_delivery_locations").all()
    serializer_class = RouteStopMasterSerializer
    permission_classes = [IsAuthenticated]





from rest_framework import permissions
