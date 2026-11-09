from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
# pyrefly: ignore [missing-import]
from .models import SparePart, SparePartImage, lifespan, TypeName, CategoryName, SubCategoryName, ProcessName, MachineDataCollection, RepairRequest, RepairRequestImage, MachineProductMapping, MachineOutput, MachineDataCollectionConfiguration, RepairPart, RepairRequestFeedback

from rarenett_app.models import Employee
# pyrefly: ignore [missing-import]
from .serializers import (
    SparePartSerializer,
    LifespanSerializer,
    TypeNameSerializer,
    CategoryNameSerializer,
    SubCategoryNameSerializer,
    ProcessNameSerializer,
    MachineDataCollectionSerializer,
    RepairRequestSerializer,
    MachineProductMappingSerializer,
    MachineOutputSerializer,
    RepairPartSerializer,
)

class RepairRequestViewSet(viewsets.ModelViewSet):
    queryset = RepairRequest.objects.all().order_by('-id')
    serializer_class = RepairRequestSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='delete-image')
    def delete_image(self, request, pk=None):
        image_id = request.data.get('image_id')
        if not image_id:
            return Response({'error': 'image_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            image_obj = RepairRequestImage.objects.get(id=image_id, repair_request_id=pk)
            image_obj.image.delete()
            image_obj.delete()
            return Response({'status': 'Image deleted successfully'}, status=status.HTTP_200_OK)
        except RepairRequestImage.DoesNotExist:
            return Response({'error': 'Image not found'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'])
    def received(self, request):
        user = request.user
        defined_part_ids = RepairPart.objects.values_list('machine_id', flat=True)
        
        if user.is_superuser:
            queryset = RepairRequest.objects.filter(part_id__in=defined_part_ids).order_by('-id')
        else:
            employee = getattr(user, 'employee', None)
            if not employee:
                return Response([])
            
            all_requests = RepairRequest.objects.filter(part_id__in=defined_part_ids)
            received_requests = []
            
            dept = employee.dept_designation.department if employee.dept_designation else None
            desig = employee.dept_designation.designation if employee.dept_designation else None
            
            for req in all_requests:
                matching_parts = RepairPart.objects.filter(machine=req.part)
                
                routed = False
                for rp in matching_parts:
                    pattern = rp.pattern_type
                    
                    if pattern in ['Single', 'Multiple', 'Assign']:
                        if rp.employees.filter(id=employee.id).exists():
                            routed = True
                            break
                    elif pattern == 'HOD':
                        if dept and rp.targeted_departments.filter(id=dept.id).exists():
                            if desig and 'HOD' in desig.name.upper():
                                routed = True
                                break
                    elif pattern == 'BOD':
                        if desig and 'BOD' in desig.name.upper():
                            routed = True
                            break
                
                if routed:
                    received_requests.append(req)
                    
            queryset = received_requests
            
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='update-status')
    def update_status(self, request, pk=None):
        repair_request = self.get_object()
        status_val = request.data.get('status')
        remarks_val = request.data.get('remarks', '')
        
        if not status_val or status_val not in ['Pending', 'Hold', 'Accepted', 'Rejected']:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)
            
        repair_request.status = status_val
        if remarks_val:
            repair_request.remarks = remarks_val
        repair_request.save()
        
        return Response({'status': 'Status updated successfully', 'data': self.get_serializer(repair_request).data})

    @action(detail=True, methods=['post'], url_path='submit-decision')
    def submit_decision(self, request, pk=None):
        repair_request = self.get_object()
        
        decision_val = request.data.get('decision')
        pos_feed = request.data.get('positive_feedback')
        neg_feed = request.data.get('negative_feedback')
        dec_notes = request.data.get('decision_notes')
        
        if not decision_val or decision_val not in ['YES', 'NO', 'NEUTRAL']:
            return Response({'error': 'Invalid or missing decision'}, status=status.HTTP_400_BAD_REQUEST)
            
        feedback_obj, created = RepairRequestFeedback.objects.get_or_create(
            repair_request=repair_request,
            user=request.user
        )
        
        feedback_obj.decision = decision_val
        if pos_feed is not None:
            feedback_obj.positive_feedback = pos_feed
        if neg_feed is not None:
            feedback_obj.negative_feedback = neg_feed
        if dec_notes is not None:
            feedback_obj.decision_notes = dec_notes
            
        if 'supporting_document' in request.FILES:
            feedback_obj.supporting_document = request.FILES['supporting_document']
            
        feedback_obj.save()
        return Response({'status': 'Decision submitted successfully', 'data': self.get_serializer(repair_request).data})

    @action(detail=True, methods=['post'], url_path='admin-update-status')
    def admin_update_status(self, request, pk=None):
        repair_request = self.get_object()
        status_val = request.data.get('status')
        if not status_val or status_val not in ['Pending', 'Hold', 'Accepted', 'Rejected']:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)
        repair_request.status = status_val
        decision_notes = request.data.get('decision_notes')
        if decision_notes is not None:
            repair_request.decision_notes = decision_notes
        repair_request.save()
        return Response({'status': 'Status updated successfully', 'data': self.get_serializer(repair_request).data})


class LifespanViewSet(viewsets.ModelViewSet):
    queryset = lifespan.objects.all()
    serializer_class = LifespanSerializer


class SparePartViewSet(viewsets.ModelViewSet):
    queryset = SparePart.objects.all()
    serializer_class = SparePartSerializer

    @action(detail=True, methods=['post'], url_path='delete-image')
    def delete_image(self, request, pk=None):
        image_id = request.data.get('image_id')
        if not image_id:
            return Response({'error': 'image_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            image_obj = SparePartImage.objects.get(id=image_id, spare_part_id=pk)
            image_obj.image.delete()  # delete actual file
            image_obj.delete()        # delete DB record
            return Response({'status': 'Image deleted successfully'}, status=status.HTTP_200_OK)
        except SparePartImage.DoesNotExist:
            return Response({'error': 'Image not found'}, status=status.HTTP_404_NOT_FOUND)


class TypeNameViewSet(viewsets.ModelViewSet):
    queryset = TypeName.objects.all()
    serializer_class = TypeNameSerializer


class CategoryNameViewSet(viewsets.ModelViewSet):
    queryset = CategoryName.objects.all()
    serializer_class = CategoryNameSerializer


class SubCategoryNameViewSet(viewsets.ModelViewSet):
    queryset = SubCategoryName.objects.all()
    serializer_class = SubCategoryNameSerializer


class ProcessNameViewSet(viewsets.ModelViewSet):
    queryset = ProcessName.objects.all()
    serializer_class = ProcessNameSerializer


class MachineDataCollectionViewSet(viewsets.ModelViewSet):
    queryset = MachineDataCollection.objects.all()
    serializer_class = MachineDataCollectionSerializer

class MachineProductMappingViewSet(viewsets.ModelViewSet):
    queryset = MachineProductMapping.objects.all()
    serializer_class = MachineProductMappingSerializer

class MachineOutputViewSet(viewsets.ModelViewSet):
    queryset = MachineOutput.objects.all()
    serializer_class = MachineOutputSerializer
from rest_framework.views import APIView
from rest_framework.response import Response
from .serializers import MachineDataCollectionConfigurationSerializer

class MachineDataCollectionFieldsView(APIView):
    def get(self, request):
        fields = []
        for field in MachineDataCollection._meta.get_fields():
            if field.is_relation and field.auto_created:
                continue
            fields.append({
                "name": field.name,
                "label": getattr(field, 'verbose_name', field.name).title()
            })
        return Response(fields)

class MachineDataCollectionConfigurationViewSet(viewsets.ModelViewSet):
    queryset = MachineDataCollectionConfiguration.objects.all()
    serializer_class = MachineDataCollectionConfigurationSerializer

    def list(self, request, *args, **kwargs):
        stock_item_id = request.query_params.get('stock_item_id')
        if stock_item_id and stock_item_id.strip():
            config, created = MachineDataCollectionConfiguration.objects.get_or_create(stock_item_id=stock_item_id)
        else:
            # Fallback to a default configuration
            config = MachineDataCollectionConfiguration.objects.filter(stock_item__isnull=True).first()
            if not config:
                config = MachineDataCollectionConfiguration.objects.create()
        serializer = self.get_serializer(config)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def all_configs(self, request):
        configs = self.get_queryset()
        serializer = self.get_serializer(configs, many=True)
        return Response(serializer.data)


from rarenett_app.models import Employee

class RepairPartViewSet(viewsets.ModelViewSet):
    queryset = RepairPart.objects.all().order_by('-id')
    serializer_class = RepairPartSerializer

    @action(detail=False, methods=['get'], url_path='employees-by-department')
    def employees_by_department(self, request):
        department_id = request.query_params.get('department_id')
        pattern_type = request.query_params.get('pattern_type')

        if pattern_type in ['Assign', 'HOD', 'BOD']:
            # Fetch employees across all departments for these pattern types
            employees = Employee.objects.all().select_related('user', 'dept_designation__department', 'dept_designation__designation')
            if pattern_type == 'HOD':
                employees = employees.filter(dept_designation__designation__name__icontains=pattern_type)
            elif pattern_type == 'BOD':
                # "BOD" is a Department (not a designation), so filter by department name instead
                employees = employees.filter(dept_designation__department__name__icontains=pattern_type)
        else:
            if not department_id:
                return Response({'error': 'department_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            department_ids = [d for d in department_id.split(',') if d]
            employees = Employee.objects.filter(dept_designation__department_id__in=department_ids).select_related('user', 'dept_designation__department', 'dept_designation__designation')
        
        # format data for frontend dropdowns
        data = []
        for emp in employees:
            name = ""
            if emp.user:
                name = emp.user.get_full_name() or emp.user.email
            
            department_name = emp.dept_designation.department.name if emp.dept_designation and emp.dept_designation.department else 'No Department'
            label = f"{name or f'Employee #{emp.id}'} ({department_name})"
            
            level = emp.dept_designation.level if emp.dept_designation else None
            data.append({
                'value': str(emp.id), 
                'label': label, 
                'user_id': str(emp.user.id) if emp.user else None,
                'level': level,
                'designation_level': level
            })
        return Response(data, status=status.HTTP_200_OK)
