from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import views, status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import (
    File, FileAllocation, StorageRoom, AssetType, Shelf, Rack, Key, KeyAllocation,
    Asset, AssetAllocation, AssetAllocationItem
)
from .serializers import (
    FileSerializer, FileAllocationSerializer, StorageRoomSerializer, 
    AssetTypeSerializer, ShelfSerializer, RackSerializer,
    KeySerializer, KeyAllocationSerializer, AssetSerializer,
    AssetAllocationSerializer, AssetAllocationItemSerializer
)
from rest_framework import viewsets
from rest_framework.decorators import action
import datetime
from django.contrib.auth import get_user_model
from register_app.permissions_utils import get_user_permissions

User = get_user_model()

class DashboardStatsView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = self.request.user
        if user.is_superuser:
            files_qs = File.objects.all()
            allocations_qs = FileAllocation.objects.all()
            keys_qs = Key.objects.all()
            it_assets_qs = Asset.objects.all()
        else:
            files_qs = File.objects.filter(current_holder=user)
            allocations_qs = FileAllocation.objects.filter(assigned_to=user)
            keys_qs = Key.objects.filter(current_holder=user)
            it_assets_qs = Asset.objects.filter(incharge=user)

        total_files = files_qs.count()
        available = files_qs.filter(status='Available').count()
        allocated = files_qs.filter(status__in=['Allocated', 'In Use']).count()
        overdue = allocations_qs.filter(status='Overdue').count()
        
        total_keys = keys_qs.count()
        available_keys = keys_qs.filter(status='Available').count()
        allocated_keys = keys_qs.filter(status__in=['Allocated', 'In Use']).count()

        total_it = it_assets_qs.count()
        available_it = it_assets_qs.filter(status='available').count()
        allocated_it = it_assets_qs.filter(status='allocated').count()

        first_day_of_month = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        new_this_month = files_qs.filter(created_at__gte=first_day_of_month).count()

        return Response({
            'total_assets': total_files,
            'available': available,
            'allocated': allocated,
            'overdue': overdue,
            'this_month_new': new_this_month,
            'total_keys': total_keys,
            'available_keys': available_keys,
            'allocated_keys': allocated_keys,
            'total_it_assets': total_it,
            'available_it_assets': available_it,
            'allocated_it_assets': allocated_it,
        })

class RecentAllocationsView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = self.request.user
        if user.is_superuser:
            file_allocs = FileAllocation.objects.all().order_by('-allocated_at')[:5]
            key_allocs = KeyAllocation.objects.all().order_by('-allocated_at')[:5]
            it_allocs = AssetAllocation.objects.all().order_by('-allocated_at')[:5]
        else:
            file_allocs = FileAllocation.objects.filter(assigned_to=user).order_by('-allocated_at')[:5]
            key_allocs = KeyAllocation.objects.filter(assigned_to=user).order_by('-allocated_at')[:5]
            it_allocs = AssetAllocation.objects.filter(allocated_to_user=user).order_by('-allocated_at')[:5]
            
        file_data = FileAllocationSerializer(file_allocs, many=True).data
        for d in file_data: d['asset_type_category'] = 'File'
        
        key_data = KeyAllocationSerializer(key_allocs, many=True).data
        for d in key_data: d['asset_type_category'] = 'Key'
        
        it_data = AssetAllocationSerializer(it_allocs, many=True).data
        for d in it_data: d['asset_type_category'] = 'IT Asset'
        
        combined = file_data + key_data + it_data
        combined.sort(key=lambda x: x['allocated_at'] if x['allocated_at'] else '', reverse=True)
        return Response(combined[:10])

class AssetSplitView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = self.request.user
        if user.is_superuser:
            files_qs = File.objects.all()
        else:
            files_qs = File.objects.filter(current_holder=user)
        
        stats = files_qs.values('file_type__name').annotate(count=Count('id'))
        return Response(stats)

class AllocationTrendView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = self.request.user
        if user.is_superuser:
            file_alloc_qs = FileAllocation.objects.all()
            key_alloc_qs = KeyAllocation.objects.all()
        else:
            file_alloc_qs = FileAllocation.objects.filter(assigned_to=user)
            key_alloc_qs = KeyAllocation.objects.filter(assigned_to=user)

        # Last 15 days trend
        today = timezone.now().date()
        date_list = [today - datetime.timedelta(days=i) for i in range(14, -1, -1)]
        
        data = []
        for date in date_list:
            display_date = date.strftime('%d %b')
            files_count = file_alloc_qs.filter(allocated_at__date=date).count()
            keys_count = key_alloc_qs.filter(allocated_at__date=date).count()
            
            data.append({
                'date': display_date,
                'files': files_count,
                'keys': keys_count
            })
            
        return Response(data)


class RoomDistributionView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = self.request.user
        if user.is_superuser:
            files_qs = File.objects.all()
            keys_qs = Key.objects.all()
        else:
            files_qs = File.objects.filter(current_holder=user)
            keys_qs = Key.objects.filter(current_holder=user)

        # Get file counts per room
        file_counts = files_qs.values('rack__shelf__room__name').annotate(count=Count('id'))
        # Get key counts per room
        key_counts = keys_qs.values('rack__shelf__room__name').annotate(count=Count('id'))

        # Combine logic
        combined_stats = {}
        for item in file_counts:
            room_name = item['rack__shelf__room__name'] or 'Unassigned'
            combined_stats[room_name] = combined_stats.get(room_name, 0) + item['count']
        
        for item in key_counts:
            room_name = item['rack__shelf__room__name'] or 'Unassigned'
            combined_stats[room_name] = combined_stats.get(room_name, 0) + item['count']

        # Format for response
        response_data = [
            {'room_name': name, 'count': count}
            for name, count in combined_stats.items()
        ]
        
        return Response(response_data)


class StorageRoomListView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = StorageRoomSerializer

    def get_queryset(self):
        return StorageRoom.objects.all()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class StorageRoomDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = StorageRoomSerializer
    def get_queryset(self):
        return StorageRoom.objects.all()

class ShelfListView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ShelfSerializer

    def get_queryset(self):
        return Shelf.objects.all()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class ShelfDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ShelfSerializer
    def get_queryset(self):
        return Shelf.objects.all()

class RackListView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = RackSerializer

    def get_queryset(self):
        return Rack.objects.all()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class RackDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = RackSerializer
    def get_queryset(self):
        return Rack.objects.all()

class AssetTypeListView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = AssetTypeSerializer

    def get_queryset(self):
        return AssetType.objects.all()

    def perform_create(self, serializer):
        serializer.save()

class AssetTypeDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = AssetTypeSerializer
    def get_queryset(self):
        return AssetType.objects.all()

class FileListView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FileSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return File.objects.all().order_by('-created_at')
            
        perms = get_user_permissions(user)
        if perms.get('files', {}).get('view', False):
            return File.objects.all().order_by('-created_at')
            
        return File.objects.filter(Q(current_holder=user) | Q(rack__custodian=user)).distinct().order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class FileDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FileSerializer
    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return File.objects.all()
            
        perms = get_user_permissions(user)
        if perms.get('files', {}).get('view', False):
            return File.objects.all()
            
        return File.objects.filter(Q(current_holder=user) | Q(rack__custodian=user)).distinct()


class FileAllocationListView(generics.ListAPIView):
    """List allocations visible to the current user (Own or Admin)"""
    permission_classes = [IsAuthenticated]
    serializer_class = FileAllocationSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = FileAllocation.objects.all()
        if user.is_superuser or user.is_staff:
            return queryset.order_by('-allocated_at')
        return queryset.filter(Q(assigned_to=user) | Q(file__rack__custodian=user) | Q(allocated_by=user)).distinct().order_by('-allocated_at')


class AllocateFileView(views.APIView):
    """Allocate an available file to a user."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.user.is_staff:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        
        file_id = request.data.get('file')
        assigned_to_id = request.data.get('assigned_to')
        due_date = request.data.get('due_date')
        remarks = request.data.get('remarks', '')
        allow_reallocation = request.data.get('allow_reallocation', True)
        if isinstance(allow_reallocation, str):
            allow_reallocation = allow_reallocation.lower() == 'true'
        else:
            allow_reallocation = bool(allow_reallocation)

        if not file_id or not assigned_to_id or not due_date:
            return Response({'error': 'file, assigned_to, and due_date are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            file_obj = File.objects.get(id=file_id)
        except File.DoesNotExist:
            return Response({'error': 'File not found.'}, status=status.HTTP_404_NOT_FOUND)

        if file_obj.status != 'Available':
            return Response({'error': f'File is not available (current status: {file_obj.status}).'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            assigned_to = User.objects.get(id=assigned_to_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        allocation = FileAllocation.objects.create(
            file=file_obj,
            assigned_to=assigned_to,
            allocated_by=request.user,
            due_date=due_date,
            remarks=remarks,
            status='Allocated',
            holder_response='Pending',
            allow_reallocation=allow_reallocation
        )

        # Update the file's status and current holder
        file_obj.status = 'Allocated'
        file_obj.current_holder = assigned_to
        file_obj.holder_response = 'Pending'
        file_obj.save()

        serializer = FileAllocationSerializer(allocation)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class UpdateAllocationResponseView(views.APIView):
    """Admin or Assigned person updates holder response (Accepted/Rejected)."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            allocation = FileAllocation.objects.get(id=pk)
        except FileAllocation.DoesNotExist:
            return Response({'error': 'Allocation not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Check permission: Admin or Assigned To
        if not (request.user.is_staff or request.user == allocation.assigned_to):
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        # Guard: Immutable once set and only for active allocations
        if allocation.status != 'Allocated':
            return Response({'error': 'Response can only be updated for active allocations.'}, status=status.HTTP_400_BAD_REQUEST)
        if allocation.holder_response != 'Pending':
            return Response({'error': 'Response already updated and cannot be changed.'}, status=status.HTTP_400_BAD_REQUEST)

        response_status = request.data.get('holder_response')
        if response_status not in ['Accepted', 'Rejected']:
            return Response({'error': 'Invalid response status.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check if this is an accepted return to stock
        file_obj = allocation.file
        is_return_to_stock = False
        if response_status == 'Accepted' and allocation.remarks and allocation.remarks.startswith('Returned from'):
            if request.user.is_staff or (file_obj.rack and file_obj.rack.custodian == request.user):
                is_return_to_stock = True

        allocation.holder_response = response_status
        if response_status == 'Accepted':
            allocation.status = 'Returned' if is_return_to_stock else 'In Use'
        else:
            allocation.status = 'Rejected'
        allocation.save()

        # Update File status
        if is_return_to_stock:
            file_obj.status = 'Available'
            file_obj.current_holder = None
            file_obj.holder_response = None
        else:
            file_obj.holder_response = response_status
            if response_status == 'Accepted':
                file_obj.status = 'In Use'
            else:
                # If rejected, file becomes available again
                file_obj.status = 'Available'
                file_obj.current_holder = None
        file_obj.save()

        serializer = FileAllocationSerializer(allocation)
        return Response(serializer.data)


class ReturnFileView(views.APIView):
    """Mark a file allocation as returned."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            allocation = FileAllocation.objects.get(id=pk)
        except FileAllocation.DoesNotExist:
            return Response({'error': 'Allocation not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Check permission: Admin or Assigned To
        if not (request.user.is_staff or request.user == allocation.assigned_to):
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        return_remarks = request.data.get('return_remarks', '')
        return_to = request.data.get('return_to', 'admin')  # 'admin' or 'previous_holder'

        allocation.status = 'Returned'
        allocation.returned_at = timezone.now()
        allocation.return_remarks = return_remarks
        allocation.save()

        file_obj = allocation.file

        if return_to == 'previous_holder':
            # Find the previous holder (the person who reallocated to the current user)
            prev_alloc = FileAllocation.objects.filter(
                file=file_obj,
                reallocated_to=allocation.assigned_to,
                status='Reallocated'
            ).order_by('-returned_at').first()

            prev_holder = prev_alloc.assigned_to if prev_alloc else allocation.allocated_by
            due_date = prev_alloc.due_date if prev_alloc else timezone.now()

            if prev_holder:
                # Re-allocate the file back to the previous holder
                new_alloc = FileAllocation.objects.create(
                    file=file_obj,
                    assigned_to=prev_holder,
                    allocated_by=request.user,
                    due_date=due_date,
                    remarks=f'Returned from {allocation.assigned_to.email}',
                    status='Allocated',
                    holder_response='Pending'
                )
                file_obj.current_holder = prev_holder
                file_obj.status = 'In Use'
                file_obj.holder_response = 'Pending'
                file_obj.save()
                serializer = FileAllocationSerializer(allocation)
                return Response(serializer.data)

        # Default: return to admin/custodian
        custodian = file_obj.rack.custodian if (file_obj.rack and file_obj.rack.custodian) else allocation.allocated_by
        if custodian:
            new_alloc = FileAllocation.objects.create(
                file=file_obj,
                assigned_to=custodian,
                allocated_by=request.user,
                due_date=timezone.now(),
                remarks=f'Returned from {allocation.assigned_to.email}',
                status='Allocated',
                holder_response='Pending'
            )
            file_obj.current_holder = custodian
            file_obj.status = 'In Use'
            file_obj.holder_response = 'Pending'
        else:
            file_obj.status = 'Available'
            file_obj.current_holder = None
        file_obj.save()

        serializer = FileAllocationSerializer(allocation)
        return Response(serializer.data)
class ReallocateFileView(views.APIView):
    """Reallocate an already-allocated file to a different user."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            old_allocation = FileAllocation.objects.get(id=pk)
        except FileAllocation.DoesNotExist:
            return Response({'error': 'Allocation not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Permission check: Staff OR currently assigned user
        if not (request.user.is_staff or request.user == old_allocation.assigned_to):
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        new_user_id = request.data.get('assigned_to')
        due_date = request.data.get('due_date')
        remarks = request.data.get('remarks', '')
        allow_reallocation = request.data.get('allow_reallocation', True)
        if isinstance(allow_reallocation, str):
            allow_reallocation = allow_reallocation.lower() == 'true'
        else:
            allow_reallocation = bool(allow_reallocation)

        if not new_user_id or not due_date:
            return Response({'error': 'assigned_to and due_date are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_user = User.objects.get(id=new_user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Close the old allocation
        old_allocation.status = 'Reallocated'
        old_allocation.returned_at = timezone.now()
        old_allocation.reallocated_to = new_user
        old_allocation.return_remarks = f'Reallocated to {new_user.email}'
        old_allocation.save()

        # Create a new allocation
        new_allocation = FileAllocation.objects.create(
            file=old_allocation.file,
            assigned_to=new_user,
            allocated_by=request.user,
            due_date=due_date,
            remarks=remarks,
            status='Allocated',
            holder_response='Pending',
            allow_reallocation=allow_reallocation
        )

        # Update the file's current holder
        file_obj = old_allocation.file
        file_obj.current_holder = new_user
        file_obj.holder_response = 'Pending'
        file_obj.save()

        serializer = FileAllocationSerializer(new_allocation)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class FileAllocationReportView(generics.ListAPIView):
    """View to see historical file allocations (Returned or Reallocated)."""
    serializer_class = FileAllocationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Base queryset for history
        queryset = FileAllocation.objects.filter(status__in=['Returned', 'Reallocated'])
        
        if user.is_superuser:
            return queryset
            
        perms = get_user_permissions(user)
        if perms.get('files', {}).get('view', False):
            return queryset
            
        # Regular users (including staff) only see their own history
        queryset = queryset.filter(assigned_to=user)
            
        return queryset


class FileAllocationHistoryView(views.APIView):
    """Retrieve full allocation and reallocation history for a specific file."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        allocations = FileAllocation.objects.filter(file_id=pk).order_by('-allocated_at')
        serializer = FileAllocationSerializer(allocations, many=True)
        return Response(serializer.data)


class KeyListView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = KeySerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Key.objects.all().order_by('-created_at')
            
        perms = get_user_permissions(user)
        if perms.get('keys', {}).get('view', False):
            return Key.objects.all().order_by('-created_at')
            
        return Key.objects.filter(Q(current_holder=user) | Q(rack__custodian=user)).distinct().order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class KeyDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = KeySerializer
    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Key.objects.all()
            
        perms = get_user_permissions(user)
        if perms.get('keys', {}).get('view', False):
            return Key.objects.all()
            
        return Key.objects.filter(Q(current_holder=user) | Q(rack__custodian=user)).distinct()

class KeyAllocationListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = KeyAllocationSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = KeyAllocation.objects.all()
        if user.is_superuser or user.is_staff:
            return queryset.order_by('-allocated_at')
        return queryset.filter(Q(assigned_to=user) | Q(key__rack__custodian=user) | Q(allocated_by=user)).distinct().order_by('-allocated_at')

class AllocateKeyView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.user.is_staff:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        
        key_id = request.data.get('key')
        assigned_to_id = request.data.get('assigned_to')
        due_date = request.data.get('due_date')
        remarks = request.data.get('remarks', '')
        allow_reallocation = request.data.get('allow_reallocation', True)
        if isinstance(allow_reallocation, str):
            allow_reallocation = allow_reallocation.lower() == 'true'
        else:
            allow_reallocation = bool(allow_reallocation)

        if not key_id or not assigned_to_id or not due_date:
            return Response({'error': 'key, assigned_to, and due_date are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            key_obj = Key.objects.get(id=key_id)
        except Key.DoesNotExist:
            return Response({'error': 'Key not found.'}, status=status.HTTP_404_NOT_FOUND)

        if key_obj.status != 'Available':
            return Response({'error': f'Key is not available (current status: {key_obj.status}).'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            assigned_to = User.objects.get(id=assigned_to_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        allocation = KeyAllocation.objects.create(
            key=key_obj,
            assigned_to=assigned_to,
            allocated_by=request.user,
            due_date=due_date,
            remarks=remarks,
            status='Allocated',
            holder_response='Pending',
            allow_reallocation=allow_reallocation
        )

        key_obj.status = 'In Use'
        key_obj.current_holder = assigned_to
        key_obj.holder_response = 'Pending'
        key_obj.save()

        serializer = KeyAllocationSerializer(allocation)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class UpdateKeyAllocationResponseView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            allocation = KeyAllocation.objects.get(id=pk)
        except KeyAllocation.DoesNotExist:
            return Response({'error': 'Allocation not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not (request.user.is_staff or request.user == allocation.assigned_to):
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        if allocation.status != 'Allocated':
            return Response({'error': 'Response can only be updated for active allocations.'}, status=status.HTTP_400_BAD_REQUEST)
        if allocation.holder_response != 'Pending':
            return Response({'error': 'Response already updated and cannot be changed.'}, status=status.HTTP_400_BAD_REQUEST)

        response_status = request.data.get('holder_response')
        if response_status not in ['Accepted', 'Rejected']:
            return Response({'error': 'Invalid response status.'}, status=status.HTTP_400_BAD_REQUEST)

        key_obj = allocation.key
        is_return_to_stock = False
        if response_status == 'Accepted' and allocation.remarks and allocation.remarks.startswith('Returned from'):
            if request.user.is_staff or (key_obj.rack and key_obj.rack.custodian == request.user):
                is_return_to_stock = True

        allocation.holder_response = response_status
        if response_status == 'Accepted':
            allocation.status = 'Returned' if is_return_to_stock else 'In Use'
        else:
            allocation.status = 'Rejected'
        allocation.save()

        if is_return_to_stock:
            key_obj.status = 'Available'
            key_obj.current_holder = None
            key_obj.holder_response = None
        else:
            key_obj.holder_response = response_status
            if response_status == 'Accepted':
                key_obj.status = 'In Use'
            else:
                key_obj.status = 'Available'
                key_obj.current_holder = None
        key_obj.save()

        serializer = KeyAllocationSerializer(allocation)
        return Response(serializer.data)

class ReturnKeyView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            allocation = KeyAllocation.objects.get(id=pk)
        except KeyAllocation.DoesNotExist:
            return Response({'error': 'Allocation not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not (request.user.is_staff or request.user == allocation.assigned_to):
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        return_remarks = request.data.get('return_remarks', '')
        return_to = request.data.get('return_to', 'admin')  # 'admin' or 'previous_holder'

        allocation.status = 'Returned'
        allocation.returned_at = timezone.now()
        allocation.return_remarks = return_remarks
        allocation.save()

        key_obj = allocation.key

        if return_to == 'previous_holder':
            prev_alloc = KeyAllocation.objects.filter(
                key=key_obj,
                reallocated_to=allocation.assigned_to,
                status='Reallocated'
            ).order_by('-returned_at').first()

            prev_holder = prev_alloc.assigned_to if prev_alloc else allocation.allocated_by
            due_date = prev_alloc.due_date if prev_alloc else None

            if prev_holder:
                KeyAllocation.objects.create(
                    key=key_obj,
                    assigned_to=prev_holder,
                    allocated_by=request.user,
                    due_date=due_date,
                    remarks=f'Returned from {allocation.assigned_to.email}',
                    status='Allocated',
                    holder_response='Pending'
                )
                key_obj.current_holder = prev_holder
                key_obj.status = 'In Use'
                key_obj.holder_response = 'Pending'
                key_obj.save()
                serializer = KeyAllocationSerializer(allocation)
                return Response(serializer.data)

        # Default: return to admin/custodian
        custodian = key_obj.rack.custodian if (key_obj.rack and key_obj.rack.custodian) else allocation.allocated_by
        if custodian:
            KeyAllocation.objects.create(
                key=key_obj,
                assigned_to=custodian,
                allocated_by=request.user,
                due_date=None,
                remarks=f'Returned from {allocation.assigned_to.email}',
                status='Allocated',
                holder_response='Pending'
            )
            key_obj.current_holder = custodian
            key_obj.status = 'In Use'
            key_obj.holder_response = 'Pending'
        else:
            key_obj.status = 'Available'
            key_obj.current_holder = None
        key_obj.save()

        serializer = KeyAllocationSerializer(allocation)
        return Response(serializer.data)

class ReallocateKeyView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            old_allocation = KeyAllocation.objects.get(id=pk)
        except KeyAllocation.DoesNotExist:
            return Response({'error': 'Allocation not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not (request.user.is_staff or request.user == old_allocation.assigned_to):
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        new_user_id = request.data.get('assigned_to')
        due_date = request.data.get('due_date')
        remarks = request.data.get('remarks', '')
        allow_reallocation = request.data.get('allow_reallocation', True)
        if isinstance(allow_reallocation, str):
            allow_reallocation = allow_reallocation.lower() == 'true'
        else:
            allow_reallocation = bool(allow_reallocation)

        if not new_user_id or not due_date:
            return Response({'error': 'assigned_to and due_date are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_user = User.objects.get(id=new_user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        old_allocation.status = 'Reallocated'
        old_allocation.returned_at = timezone.now()
        old_allocation.reallocated_to = new_user
        old_allocation.return_remarks = f'Reallocated to {new_user.email}'
        old_allocation.save()

        new_allocation = KeyAllocation.objects.create(
            key=old_allocation.key,
            assigned_to=new_user,
            allocated_by=request.user,
            due_date=due_date,
            remarks=remarks,
            status='Allocated',
            holder_response='Pending',
            allow_reallocation=allow_reallocation
        )

        key_obj = old_allocation.key
        key_obj.current_holder = new_user
        key_obj.holder_response = 'Pending'
        key_obj.save()

        serializer = KeyAllocationSerializer(new_allocation)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class KeyAllocationReportView(generics.ListAPIView):
    serializer_class = KeyAllocationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = KeyAllocation.objects.filter(status__in=['Returned', 'Reallocated'])
        
        if user.is_superuser:
            return queryset
            
        perms = get_user_permissions(user)
        if perms.get('keys', {}).get('view', False):
            return queryset
            
        return queryset.filter(assigned_to=user)


class KeyAllocationHistoryView(views.APIView):
    """Retrieve full allocation and reallocation history for a specific key."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        allocations = KeyAllocation.objects.filter(key_id=pk).order_by('-allocated_at')
        serializer = KeyAllocationSerializer(allocations, many=True)
        return Response(serializer.data)

# ==========================================
# IT / Infrastructure Asset ViewSets
# ==========================================

from rest_framework import viewsets
from .models import (
    AssetCategory, AssetAttributeDefinition, AssetAttributeValue, 
    AssetDocument, AssetMaintenance, Asset, AssetAllocation, 
    AssetAllocationItem, AssetTransfer
)
from .serializers import (
    AssetCategorySerializer, AssetAttributeDefinitionSerializer, 
    AssetAttributeValueSerializer, AssetDocumentSerializer, 
    AssetMaintenanceSerializer, AssetSerializer, AssetAllocationSerializer, 
    AssetAllocationItemSerializer, AssetTransferSerializer
)

class AssetCategoryViewSet(viewsets.ModelViewSet):
    queryset = AssetCategory.objects.all()
    serializer_class = AssetCategorySerializer
    permission_classes = [IsAuthenticated]

class AssetAttributeDefinitionViewSet(viewsets.ModelViewSet):
    queryset = AssetAttributeDefinition.objects.all()
    serializer_class = AssetAttributeDefinitionSerializer
    permission_classes = [IsAuthenticated]

class AssetAttributeValueViewSet(viewsets.ModelViewSet):
    queryset = AssetAttributeValue.objects.all()
    serializer_class = AssetAttributeValueSerializer
    permission_classes = [IsAuthenticated]

class AssetDocumentViewSet(viewsets.ModelViewSet):
    queryset = AssetDocument.objects.all()
    serializer_class = AssetDocumentSerializer
    permission_classes = [IsAuthenticated]

class AssetMaintenanceViewSet(viewsets.ModelViewSet):
    queryset = AssetMaintenance.objects.all()
    serializer_class = AssetMaintenanceSerializer
    permission_classes = [IsAuthenticated]

class AssetViewSet(viewsets.ModelViewSet):
    queryset = Asset.objects.all()
    serializer_class = AssetSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        maintenance_type = self.request.data.get('maintenance_type')
        scheduled_date = self.request.data.get('scheduled_date')
        technician_id = self.request.data.get('technician')
        attribute_values = self.request.data.get('attribute_values', {})

        asset = serializer.save(created_by=self.request.user)

        # Create maintenance record if data provided
        if maintenance_type or scheduled_date:
            AssetMaintenance.objects.create(
                asset=asset,
                maintenance_type=maintenance_type,
                scheduled_date=scheduled_date,
                technician_id=technician_id if technician_id else None
            )

        # Create attribute values
        if isinstance(attribute_values, dict):
            for attr_id, value in attribute_values.items():
                if value is None or value == '': continue
                try:
                    attr_def = AssetAttributeDefinition.objects.get(id=attr_id)
                    val_obj = AssetAttributeValue(asset=asset, attribute=attr_def)
                    if attr_def.field_type == 'number':
                        val_obj.value_number = float(value) if value else None
                    elif attr_def.field_type == 'date':
                        val_obj.value_date = value if value else None
                    elif attr_def.field_type == 'boolean':
                        val_obj.value_boolean = bool(value)
                    else:
                        val_obj.value_text = str(value)
                    val_obj.save()
                except (AssetAttributeDefinition.DoesNotExist, ValueError):
                    continue

    def perform_update(self, serializer):
        maintenance_type = self.request.data.get('maintenance_type')
        scheduled_date = self.request.data.get('scheduled_date')
        technician_id = self.request.data.get('technician')
        attribute_values = self.request.data.get('attribute_values', {})

        asset = serializer.save()

        # Update or create maintenance record
        if maintenance_type or scheduled_date:
            maintenance, created = AssetMaintenance.objects.get_or_create(
                asset=asset,
                defaults={
                    'maintenance_type': maintenance_type,
                    'scheduled_date': scheduled_date,
                    'technician_id': technician_id if technician_id else None
                }
            )
            if not created:
                maintenance.maintenance_type = maintenance_type
                maintenance.scheduled_date = scheduled_date
                maintenance.technician_id = technician_id if technician_id else None
                maintenance.save()

        # Update attribute values
        if isinstance(attribute_values, dict):
            # Option 1: Clear and recreate (simpler)
            # Option 2: Selective update (better for history but more complex)
            # Given the current implementation in perform_create, recreating is consistent.
            
            for attr_id, value in attribute_values.items():
                if value is None or value == '':
                    AssetAttributeValue.objects.filter(asset=asset, attribute_id=attr_id).delete()
                    continue
                
                try:
                    attr_def = AssetAttributeDefinition.objects.get(id=attr_id)
                    val_obj, created = AssetAttributeValue.objects.get_or_create(asset=asset, attribute=attr_def)
                    
                    if attr_def.field_type == 'number':
                        val_obj.value_number = float(value) if value else None
                    elif attr_def.field_type == 'date':
                        val_obj.value_date = value if value else None
                    elif attr_def.field_type == 'boolean':
                        val_obj.value_boolean = bool(value)
                    else:
                        val_obj.value_text = str(value)
                    val_obj.save()
                except (AssetAttributeDefinition.DoesNotExist, ValueError):
                    continue

class AssetAllocationViewSet(viewsets.ModelViewSet):
    queryset = AssetAllocation.objects.all()
    serializer_class = AssetAllocationSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        asset_ids = self.request.data.get('assets', [])
        # If single asset ID is provided instead of list
        if self.request.data.get('asset') and not asset_ids:
            asset_ids = [self.request.data.get('asset')]
            
        allocation = serializer.save(allocated_by=self.request.user)
        
        for asset_id in asset_ids:
            try:
                asset = Asset.objects.get(id=asset_id)
                AssetAllocationItem.objects.create(
                    allocation=allocation,
                    asset=asset,
                    condition_when_allocated=asset.condition
                )
                # Update asset status and incharge
                asset.status = 'allocated'
                asset.incharge = allocation.allocated_to_user
                asset.department = allocation.allocated_to_department
                asset.save()
            except Asset.DoesNotExist:
                continue

    @action(detail=True, methods=['post'])
    def return_asset(self, request, pk=None):
        allocation = self.get_object()
        item_id = request.data.get('item_id') # Specific item in the allocation
        condition = request.data.get('condition', 'good')
        remarks = request.data.get('remarks', '')

        try:
            if item_id:
                items = allocation.items.filter(id=item_id)
            else:
                items = allocation.items.filter(returned_at__isnull=True)

            for item in items:
                item.returned_at = timezone.now()
                item.condition_when_returned = condition
                item.save()

                # Update the asset status
                asset = item.asset
                asset.status = 'available'
                asset.save()

            # If all items are returned, mark allocation as returned
            if not allocation.items.filter(returned_at__isnull=True).exists():
                allocation.status = 'Returned'
                allocation.returned_at = timezone.now()
                allocation.save()

            return Response({'status': 'Asset(s) returned successfully'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class AssetAllocationItemViewSet(viewsets.ModelViewSet):
    queryset = AssetAllocationItem.objects.all()
    serializer_class = AssetAllocationItemSerializer
    permission_classes = [IsAuthenticated]

class AssetTransferViewSet(viewsets.ModelViewSet):
    queryset = AssetTransfer.objects.all()
    serializer_class = AssetTransferSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(transferred_by=self.request.user)

