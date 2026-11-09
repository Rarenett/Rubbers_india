from rest_framework import viewsets, filters, status, permissions
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from register_app.permissions import module_permission
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import (
    ExitCard,
    Gate, GateCategory, GateSubCategory, EntryTag, GeneratedTag, Visitor, 
    GateEntry, VehicleType, Vehicle, VehicleEntry, GateEntryVehicle, GateEntryReallocation,
    EmployeeGateEntry, ApprovelessEntryConfig, Equipment
)
from .serializers import (
    ExitCardSerializer,
    GateSerializer, GateCategorySerializer, GateSubCategorySerializer,
    EntryTagSerializer, GeneratedTagSerializer, VisitorSerializer, GateEntrySerializer,
    VehicleTypeSerializer, VehicleSerializer, VehicleEntrySerializer, GateEntryReallocationSerializer,
    EmployeeGateEntrySerializer, ApprovelessEntryConfigSerializer, EquipmentSerializer
)

class GateViewSet(viewsets.ModelViewSet):
    queryset = Gate.objects.all()
    serializer_class = GateSerializer
    permission_classes = [module_permission('gates')]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'gate_no', 'location']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class GateCategoryViewSet(viewsets.ModelViewSet):
    queryset = GateCategory.objects.all()
    serializer_class = GateCategorySerializer
    permission_classes = [module_permission('access-point-categories')]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'category_no']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class GateSubCategoryViewSet(viewsets.ModelViewSet):
    queryset = GateSubCategory.objects.all()
    serializer_class = GateSubCategorySerializer
    permission_classes = [module_permission('access-point-subcategories')]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['category']
    search_fields = ['name', 'subcategory_no']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class EntryTagViewSet(viewsets.ModelViewSet):
    queryset = EntryTag.objects.all()
    serializer_class = EntryTagSerializer
    permission_classes = [module_permission('entry-tags')]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['category', 'subcategory', 'tag_type']
    search_fields = ['tag_code', 'tag_type']

    def perform_create(self, serializer):
        entry_tag = serializer.save(created_by=self.request.user)
        # Automatically generate individual tags based on range
        if entry_tag.sl_no_from and entry_tag.sl_no_to:
            tags_to_create = []
            for i in range(entry_tag.sl_no_from, entry_tag.sl_no_to + 1):
                tags_to_create.append(GeneratedTag(
                    entry_tag=entry_tag,
                    tag_number=str(i),
                    status='Available'
                ))
            GeneratedTag.objects.bulk_create(tags_to_create)

class GeneratedTagViewSet(viewsets.ModelViewSet):
    queryset = GeneratedTag.objects.all()
    serializer_class = GeneratedTagSerializer
    permission_classes = [module_permission('entry-tags')]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['entry_tag', 'status']
    search_fields = ['tag_number']

    def get_queryset(self):
        # Auto-reconcile orphaned unavailable tags:
        # If a tag is marked 'Unavailable', but has no active visitor or vehicle entry,
        # restore it to 'Available' so it never disappears from the security booth's tag list.
        try:
            active_tag_ids = set()
            active_ge = GateEntry.objects.filter(exit_time__isnull=True)
            for ge in active_ge.iterator():
                if ge.generated_tag_id:
                    active_tag_ids.add(ge.generated_tag_id)
                for tid in ge.generated_tags.values_list('id', flat=True):
                    active_tag_ids.add(tid)
            for ve in VehicleEntry.objects.filter(exit_time__isnull=True).iterator():
                if ve.vehicle_pass_id:
                    active_tag_ids.add(ve.vehicle_pass_id)

            GeneratedTag.objects.filter(status='Unavailable').exclude(id__in=active_tag_ids).update(status='Available')
        except Exception as e:
            pass

        return super().get_queryset()

class VisitorViewSet(viewsets.ModelViewSet):
    queryset = Visitor.objects.all()
    serializer_class = VisitorSerializer
    permission_classes = [module_permission('visitors')]
    filter_backends = [filters.SearchFilter]
    search_fields = ['mobile_no', 'visitor_name', 'company_name']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def search_by_mobile(self, request):
        mobile_no = request.query_params.get('mobile_no', None)
        if mobile_no is not None:
            # Try exact match first
            visitors = Visitor.objects.filter(mobile_no=mobile_no)
            
            # If not found, try icontains
            if not visitors.exists():
                visitors = Visitor.objects.filter(mobile_no__icontains=mobile_no)
                
            if visitors.exists():
                serializer = self.get_serializer(visitors, many=True)
                return Response(serializer.data)
            return Response({"detail": "Visitor not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"detail": "Mobile number is required"}, status=status.HTTP_400_BAD_REQUEST)

def resolve_park_area_for_vehicle_type(vehicle_type_name_or_obj):
    """
    Automatically maps vehicle type to its designated ParkArea:
    - Employee Vehicle -> 'Employee Park Area'
    - Owner Vehicle -> 'Owners Park Area'
    - Company Vehicle -> 'Company Vehicle Park Area'
    """
    if not vehicle_type_name_or_obj:
        return None
    from .models import ParkArea
    type_str = str(getattr(vehicle_type_name_or_obj, 'name', vehicle_type_name_or_obj)).strip().lower()

    target_name = None
    default_slots = 10
    if 'employee' in type_str:
        target_name = 'Employee Park Area'
        default_slots = 20
        area = ParkArea.objects.filter(name__icontains='employee').first()
    elif 'owner' in type_str:
        target_name = 'Owners Park Area'
        default_slots = 10
        area = ParkArea.objects.filter(name__icontains='owner').first()
    elif 'company' in type_str:
        target_name = 'Company Vehicle Park Area'
        default_slots = 10
        area = ParkArea.objects.filter(name__icontains='company').first()
    else:
        area = None

    if not area and target_name:
        area = ParkArea.objects.create(name=target_name, number_of_slots=default_slots)

    return area

def allocate_parking_slot_for_entry(entry, park_area=None, vehicle_type_name=None):
    """
    Finds the first available slot in the assigned park_area, marks it Occupied,
    and links it to the entry (both VehicleEntry and EmployeeGateEntry supported).
    If park_area is not provided, resolves it automatically from vehicle_type_name
    or the entry's associated vehicles/vehicle types.
    """
    if not entry:
        return None
    from .models import ParkingSlot, ParkArea

    if not park_area:
        if vehicle_type_name:
            park_area = resolve_park_area_for_vehicle_type(vehicle_type_name)
        elif getattr(entry, 'park_area', None):
            park_area = entry.park_area
        elif hasattr(entry, 'vehicle') and entry.vehicle and entry.vehicle.vehicle_type:
            park_area = resolve_park_area_for_vehicle_type(entry.vehicle.vehicle_type.name)
        elif hasattr(entry, 'employee') and entry.employee:
            park_area = resolve_park_area_for_vehicle_type('Employee Vehicle')
        elif hasattr(entry, 'vehicles') and entry.vehicles.exists():
            v = entry.vehicles.first()
            if v and v.vehicle_type:
                park_area = resolve_park_area_for_vehicle_type(v.vehicle_type.name)

    if not park_area:
        return None

    # Ensure slot records exist up to number_of_slots
    num_slots = park_area.number_of_slots or 10
    existing_count = ParkingSlot.objects.filter(park_area=park_area).count()
    if existing_count < num_slots:
        for i in range(1, num_slots + 1):
            ParkingSlot.objects.get_or_create(park_area=park_area, slot_number=i)

    # Find first available slot
    slot = ParkingSlot.objects.filter(park_area=park_area, status='Available').order_by('slot_number').first()
    if not slot:
        max_slot = ParkingSlot.objects.filter(park_area=park_area).order_by('-slot_number').first()
        next_num = (max_slot.slot_number + 1) if max_slot else 1
        slot = ParkingSlot.objects.create(park_area=park_area, slot_number=next_num, status='Available')
        if park_area.number_of_slots and park_area.number_of_slots < next_num:
            park_area.number_of_slots = next_num
            park_area.save(update_fields=['number_of_slots'])

    if slot:
        slot.status = 'Occupied'
        slot.save(update_fields=['status'])
        entry.parking_slot = slot
        update_fields = ['parking_slot']
        if hasattr(entry, 'park_area') and not getattr(entry, 'park_area', None):
            entry.park_area = park_area
            update_fields.append('park_area')
        entry.save(update_fields=update_fields)

    return slot

def release_parking_slot_for_entry(entry):
    """
    Releases the parking slot linked to an entry back to Available.
    Cascades to linked vehicle_entry if applicable.
    Preserves parking_slot ForeignKey for historical reports.
    """
    if not entry:
        return
    slot = getattr(entry, 'parking_slot', None)
    if slot:
        slot.status = 'Available'
        slot.save(update_fields=['status'])
    ve = getattr(entry, 'vehicle_entry', None)
    if ve and ve != entry:
        ve_slot = getattr(ve, 'parking_slot', None)
        if ve_slot:
            ve_slot.status = 'Available'
            ve_slot.save(update_fields=['status'])

def sync_active_parking_allocations():
    """
    Scans all active (inside campus) entries (EmployeeGateEntry and VehicleEntry)
    and ensures they are strictly allocated to their designated ParkArea and ParkingSlot:
    - Employee Vehicles / Employee Entries with vehicles -> 'Employee Park Area'
    - Owner Vehicles -> 'Owners Park Area'
    - Company Vehicles -> 'Company Vehicle Park Area'
    Any misallocated entry is moved to its correct ParkArea, releasing the wrong slot.
    Any unallocated active entry is allocated a fresh slot in its designated area.
    """
    from .models import ParkArea, ParkingSlot, VehicleEntry, EmployeeGateEntry

    emp_area = resolve_park_area_for_vehicle_type('Employee Vehicle')
    owner_area = resolve_park_area_for_vehicle_type('Owner Vehicle')
    company_area = resolve_park_area_for_vehicle_type('Company Vehicle')

    # 1. Active EmployeeGateEntry records
    active_ees = EmployeeGateEntry.objects.filter(
        exit_time__isnull=True,
        status='inside'
    ).select_related('vehicle', 'vehicle_entry', 'park_area', 'parking_slot', 'employee')

    for ee in active_ees:
        has_vehicle = bool(ee.vehicle or ee.vehicle_entry)
        if has_vehicle and emp_area:
            if ee.park_area != emp_area or (ee.parking_slot and ee.parking_slot.park_area != emp_area):
                if ee.parking_slot:
                    slot = ee.parking_slot
                    slot.status = 'Available'
                    slot.save(update_fields=['status'])
                ee.park_area = emp_area
                ee.parking_slot = None
                ee.save(update_fields=['park_area', 'parking_slot'])

            if not ee.parking_slot:
                allocate_parking_slot_for_entry(ee, park_area=emp_area)

            if ee.vehicle_entry:
                ve = ee.vehicle_entry
                if ve.park_area != emp_area or ve.parking_slot != ee.parking_slot:
                    ve.park_area = emp_area
                    ve.parking_slot = ee.parking_slot
                    ve.save(update_fields=['park_area', 'parking_slot'])

    # 2. Active VehicleEntry records
    active_ves = VehicleEntry.objects.filter(
        exit_time__isnull=True,
        status='pending'
    ).select_related('park_area', 'parking_slot').prefetch_related('vehicles__vehicle_type')

    for ve in active_ves:
        first_v = ve.vehicles.first()
        vtype_name = first_v.vehicle_type.name if (first_v and first_v.vehicle_type) else ''

        if not vtype_name:
            if ve.company and 'owner' in ve.company.lower():
                vtype_name = 'Owner Vehicle'
            elif ve.company and 'fleet' in ve.company.lower():
                vtype_name = 'Company Vehicle'
            elif ve.company and 'employee' in ve.company.lower():
                vtype_name = 'Employee Vehicle'
            elif ve.purpose and 'employee' in ve.purpose.lower():
                vtype_name = 'Employee Vehicle'

        target_area = None
        if 'owner' in vtype_name.lower():
            target_area = owner_area
        elif 'company' in vtype_name.lower():
            target_area = company_area
        elif 'employee' in vtype_name.lower():
            target_area = emp_area

        if target_area:
            if ve.park_area != target_area or (ve.parking_slot and ve.parking_slot.park_area != target_area):
                if ve.parking_slot:
                    old_slot = ve.parking_slot
                    old_slot.status = 'Available'
                    old_slot.save(update_fields=['status'])
                ve.park_area = target_area
                ve.parking_slot = None
                ve.save(update_fields=['park_area', 'parking_slot'])

            if not ve.parking_slot or ve.parking_slot.status != 'Occupied':
                allocate_parking_slot_for_entry(ve, park_area=target_area)

def calculate_parking_fee_for_duration(entry_time, exit_time):
    """
    Calculates parking fee based on active ParkingFee configuration slabs.
    """
    if not entry_time or not exit_time or exit_time < entry_time:
        return 0
    duration = exit_time - entry_time
    total_minutes = duration.total_seconds() / 60.0
    from .models import ParkingFee
    active_rules = ParkingFee.objects.filter(is_active=True).order_by('min_minutes')
    fee = 0
    for rule in active_rules:
        if rule.min_minutes == 0:
            condition = total_minutes >= 0 and (rule.max_minutes is None or total_minutes <= rule.max_minutes)
        else:
            condition = total_minutes > rule.min_minutes and (rule.max_minutes is None or total_minutes <= rule.max_minutes)
        if condition:
            fee = rule.fee
            break
    return fee

def sync_entry_cards_for_gate_entry(gate_entry):
    """
    Ensures an EntryCard exists for every vehicle registered with the gate_entry.
    If no vehicle is registered (e.g., pedestrian visitor), creates an EntryCard
    under visitor name / ID.
    """
    from .models import EntryCard
    vehs = gate_entry.vehicles.all()
    created_cards = []
    if vehs.exists():
        for v in vehs:
            v_num = v.vehicle_number.strip().upper() if v.vehicle_number else ''
            if not v_num:
                continue
            card, created = EntryCard.objects.get_or_create(
                gate_entry=gate_entry,
                vehicle_number=v_num,
                defaults={
                    'entry_time': gate_entry.entry_time,
                    'park_area': gate_entry.park_area,
                    'parking_slot': gate_entry.parking_slot,
                }
            )
            if not created:
                updated = False
                if gate_entry.park_area and card.park_area != gate_entry.park_area:
                    card.park_area = gate_entry.park_area
                    updated = True
                if gate_entry.parking_slot and card.parking_slot != gate_entry.parking_slot:
                    card.parking_slot = gate_entry.parking_slot
                    updated = True
                if updated:
                    card.save(update_fields=['park_area', 'parking_slot'])
            created_cards.append(card)
    else:
        v_name = (gate_entry.visitor.visitor_name if gate_entry.visitor else '') or f"Visitor #{gate_entry.id}"
        v_num = v_name.strip()[:50]
        card, created = EntryCard.objects.get_or_create(
            gate_entry=gate_entry,
            defaults={
                'vehicle_number': v_num,
                'entry_time': gate_entry.entry_time,
                'park_area': gate_entry.park_area,
                'parking_slot': gate_entry.parking_slot,
            }
        )
        created_cards.append(card)
    return created_cards

def sync_entry_card_for_vehicle_entry(vehicle_entry):
    """
    Ensures an EntryCard exists for the dedicated VehicleEntry.
    """
    from .models import EntryCard
    first_v = vehicle_entry.vehicles.first() if vehicle_entry.vehicles.exists() else None
    v_num = ((first_v.vehicle_number if first_v else None) or getattr(vehicle_entry, 'vehicle_number', '') or '').strip().upper()
    if not v_num:
        return None
    card, created = EntryCard.objects.get_or_create(
        vehicle_entry=vehicle_entry,
        defaults={
            'vehicle_number': v_num,
            'entry_time': vehicle_entry.entry_time,
            'park_area': vehicle_entry.park_area,
            'parking_slot': vehicle_entry.parking_slot,
        }
    )
    if not created:
        updated = False
        if vehicle_entry.park_area and card.park_area != vehicle_entry.park_area:
            card.park_area = vehicle_entry.park_area
            updated = True
        if vehicle_entry.parking_slot and card.parking_slot != vehicle_entry.parking_slot:
            card.parking_slot = vehicle_entry.parking_slot
            updated = True
        if updated:
            card.save(update_fields=['park_area', 'parking_slot'])
    return card

def sync_exit_cards_for_gate_entry(gate_entry, exit_time=None, exiting_vehs=None):
    """
    Creates an ExitCard with calculated parking fee for exiting vehicles in a GateEntry.
    """
    from .models import ExitCard, EntryCard
    from django.utils import timezone
    now_dt = exit_time or gate_entry.exit_time or timezone.now()
    
    sync_entry_cards_for_gate_entry(gate_entry)
    
    ec_qs = EntryCard.objects.filter(gate_entry=gate_entry)
    if exiting_vehs:
        norm_vehs = [str(x).strip().upper() for x in exiting_vehs]
        ec_qs = ec_qs.filter(vehicle_number__in=norm_vehs)
    
    created_exit_cards = []
    for ec in ec_qs:
        if not ec.exit_cards.exists():
            fee = calculate_parking_fee_for_duration(ec.entry_time, now_dt)
            xc = ExitCard.objects.create(
                entry_card=ec,
                exit_time=now_dt,
                parking_fee=fee,
                gate_entry=gate_entry
            )
            created_exit_cards.append(xc)
    return created_exit_cards

def sync_exit_card_for_vehicle_entry(vehicle_entry, exit_time=None):
    """
    Creates an ExitCard with calculated parking fee for a VehicleEntry.
    """
    from .models import ExitCard, EntryCard
    from django.utils import timezone
    now_dt = exit_time or vehicle_entry.exit_time or timezone.now()
    
    ec = EntryCard.objects.filter(vehicle_entry=vehicle_entry).first()
    if not ec:
        ec = sync_entry_card_for_vehicle_entry(vehicle_entry)
    if ec and not ec.exit_cards.exists():
        fee = calculate_parking_fee_for_duration(ec.entry_time, now_dt)
        xc = ExitCard.objects.create(
            entry_card=ec,
            exit_time=now_dt,
            parking_fee=fee,
            vehicle_entry=vehicle_entry
        )
        return xc
    return ec.exit_cards.first() if ec else None

class GateEntryViewSet(viewsets.ModelViewSet):
    queryset = GateEntry.objects.all().order_by('-entry_time')
    serializer_class = GateEntrySerializer
    permission_classes = [module_permission('gate-entry')]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['verification_status', 'entry_gate', 'exit_gate', 'department', 'visitor']
    search_fields = ['visitor__visitor_name', 'visitor__mobile_no', 'tag_number']

    def list(self, request, *args, **kwargs):
        print("====== API GATE ENTRY LIST CALLED ======")
        print("QUERY PARAMS:", request.query_params)
        with open("debug_params.txt", "a") as f:
            f.write(f"GATE ENTRY LIST PARAMS: {request.query_params}\n")
        return super().list(request, *args, **kwargs)

    def _save_vehicles(self, gate_entry, request):
        vehicles_raw = request.data.get('vehicles_data', None)
        if not vehicles_raw:
            return
        
        import json
        if isinstance(vehicles_raw, str):
            try:
                vehicles_list = json.loads(vehicles_raw)
            except Exception:
                vehicles_list = []
        elif isinstance(vehicles_raw, list):
            vehicles_list = vehicles_raw
        else:
            vehicles_list = []

        for idx, item in enumerate(vehicles_list):
            if not isinstance(item, dict):
                continue
            v_num = item.get('vehicle_number', '').strip().upper()
            if not v_num:
                continue
            d_name = item.get('driver_name', '').strip()
            
            photo_key = item.get('photo_key', f'vehicle_photo_{idx}')
            photo_file = request.FILES.get(photo_key)
            if not photo_file:
                photo_file = request.FILES.get(f'vehicle_photo_{idx}') or request.FILES.get('vehicle_photo')

            existing_v = GateEntryVehicle.objects.filter(gate_entry=gate_entry, vehicle_number__iexact=v_num).first()
            if not existing_v:
                GateEntryVehicle.objects.create(
                    gate_entry=gate_entry,
                    vehicle_number=v_num,
                    driver_name=d_name if d_name else None,
                    vehicle_photo=photo_file if photo_file else None
                )

            # Also ensure vehicle exists in master for reference
            try:
                vehicle_obj, _ = Vehicle.objects.get_or_create(
                    vehicle_number=v_num,
                    defaults={'driver': d_name, 'created_by': request.user if request.user.is_authenticated else None}
                )
                if photo_file and not vehicle_obj.vehicle_photo:
                    vehicle_obj.vehicle_photo = photo_file
                    vehicle_obj.save(update_fields=['vehicle_photo'])
            except Exception:
                pass

    def _save_equipments(self, gate_entry, request):
        equipments_raw = request.data.get('equipments_data', None)
        if equipments_raw is None:
            if hasattr(request.data, 'getlist'):
                eq_list = request.data.getlist('equipments')
                if not eq_list:
                    eq_list = request.data.get('equipments')
            else:
                eq_list = request.data.get('equipments')
        else:
            eq_list = equipments_raw

        if eq_list is None:
            return

        import json
        if isinstance(eq_list, str):
            try:
                eq_list = json.loads(eq_list)
            except Exception:
                eq_list = [x.strip() for x in eq_list.split(',') if x.strip()]

        if not isinstance(eq_list, list):
            eq_list = [eq_list]

        ids = []
        for item in eq_list:
            if isinstance(item, dict) and 'id' in item:
                ids.append(item['id'])
            elif isinstance(item, (int, str)) and str(item).isdigit():
                ids.append(int(item))

        gate_entry.equipments.set(ids)

    def _save_generated_tags(self, gate_entry, request):
        """Accept generated_tags from request, set M2M, and mark each tag Unavailable."""
        import json
        raw = None
        if hasattr(request.data, 'getlist'):
            gt_list = request.data.getlist('generated_tags_ids') or request.data.getlist('generated_tags')
            if len(gt_list) > 1 or (len(gt_list) == 1 and not str(gt_list[0]).startswith('[')):
                raw = gt_list
        if raw is None:
            raw = request.data.get('generated_tags') or request.data.get('generated_tags_ids')
        if raw is None:
            # Fallback to single generated_tag
            if gate_entry.generated_tag:
                gate_entry.generated_tags.set([gate_entry.generated_tag])
                gate_entry.generated_tag.status = 'Unavailable'
                gate_entry.generated_tag.save(update_fields=['status'])
            return
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except Exception:
                raw = [r.strip() for r in raw.split(',') if r.strip()]
        if not isinstance(raw, list):
            raw = [raw]
        tag_ids = []
        for item in raw:
            if isinstance(item, (int, str)) and str(item).isdigit():
                tag_ids.append(int(item))
        if tag_ids:
            tags = GeneratedTag.objects.filter(id__in=tag_ids)
            gate_entry.generated_tags.set(tags)
            tags.update(status='Unavailable')

    def perform_create(self, serializer):
        num_persons = serializer.validated_data.get('number_of_persons', 1)
        generated_tag = serializer.validated_data.get('generated_tag')
        tag_number = serializer.validated_data.get('tag_number') or self.request.data.get('tag_number')

        # Validate 1:1 physical tag count if physical tags are used and num_persons > 1
        is_na = str(tag_number).strip().upper() == 'N/A' or (generated_tag is None and str(self.request.data.get('generated_tag')).strip().upper() == 'N/A')
        if not is_na and num_persons > 1:
            raw_tags = None
            if hasattr(self.request.data, 'getlist'):
                gt_list = self.request.data.getlist('generated_tags_ids') or self.request.data.getlist('generated_tags')
                if len(gt_list) > 1 or (len(gt_list) == 1 and not str(gt_list[0]).startswith('[')):
                    raw_tags = gt_list
            if raw_tags is None:
                raw_tags = self.request.data.get('generated_tags') or self.request.data.get('generated_tags_ids')
            tag_ids = []
            if raw_tags:
                if isinstance(raw_tags, str):
                    try:
                        import json as _json
                        tag_ids = _json.loads(raw_tags)
                    except Exception:
                        tag_ids = [r.strip() for r in raw_tags.split(',') if r.strip()]
                elif isinstance(raw_tags, list):
                    tag_ids = raw_tags
            elif generated_tag:
                tag_ids = [generated_tag.id]
            valid_tag_ids = [t for t in tag_ids if str(t).strip().isdigit()]
            if len(valid_tag_ids) != num_persons:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({"generated_tags": f"{num_persons} persons entering campus require exactly {num_persons} tags ({len(valid_tag_ids)} provided)."})

        extra_kwargs = {'created_by': self.request.user, 'persons_inside': num_persons}
        if generated_tag:
            extra_kwargs['tag_number'] = str(generated_tag.tag_number)
            extra_kwargs['entry_tag'] = generated_tag.entry_tag
        elif tag_number:
            extra_kwargs['tag_number'] = tag_number
        gate_entry = serializer.save(**extra_kwargs)
        self._save_vehicles(gate_entry, self.request)
        self._save_equipments(gate_entry, self.request)
        self._save_generated_tags(gate_entry, self.request)
        
        # Check if linked to an approved appointment OR host employee has approveless clearance configured
        has_approveless = False
        if gate_entry.employee and gate_entry.department:
            has_approveless = ApprovelessEntryConfig.objects.filter(
                department=gate_entry.department,
                employee=gate_entry.employee,
                is_active=True
            ).exists()

        if has_approveless or (gate_entry.appointment and gate_entry.appointment.status == 'approved'):
            gate_entry.is_permission_required = False
            gate_entry.permission_status = 'approved'
            gate_entry.save(update_fields=['is_permission_required', 'permission_status'])
        # Set permission status if required
        elif gate_entry.is_permission_required:
            gate_entry.permission_status = 'pending'
            gate_entry.save(update_fields=['permission_status'])
            
        # If a tag is assigned, mark it as Unavailable
        if gate_entry.generated_tag:
            tag = gate_entry.generated_tag
            tag.status = 'Unavailable'
            tag.save()
            
        # If linked to an appointment, mark appointment as completed
        if gate_entry.appointment:
            app = gate_entry.appointment
            app.status = 'completed'
            app.save(update_fields=['status'])

        # Allocate and mark parking slot as Occupied if assigned
        if gate_entry.park_area and not gate_entry.parking_slot:
            allocate_parking_slot_for_entry(gate_entry, gate_entry.park_area)
        elif gate_entry.parking_slot:
            gate_entry.parking_slot.status = 'Occupied'
            gate_entry.parking_slot.save(update_fields=['status'])

        # Synchronize EntryCard records for registered vehicles
        sync_entry_cards_for_gate_entry(gate_entry)

    def perform_update(self, serializer):
        old_instance = self.get_object()
        old_tag = old_instance.generated_tag
        old_num = old_instance.number_of_persons
        gate_entry = serializer.save()

        # Handle N/A tag_number or updated tag
        req_tag_number = self.request.data.get('tag_number')
        req_generated_tag = self.request.data.get('generated_tag')
        if gate_entry.generated_tag:
            if not gate_entry.tag_number or not gate_entry.entry_tag or gate_entry.tag_number == 'N/A':
                gate_entry.tag_number = str(gate_entry.generated_tag.tag_number)
                gate_entry.entry_tag = gate_entry.generated_tag.entry_tag
                gate_entry.save(update_fields=['tag_number', 'entry_tag'])
        elif req_tag_number == 'N/A' or req_generated_tag in ['N/A', 'n/a', 'NA']:
            gate_entry.tag_number = 'N/A'
            gate_entry.generated_tag = None
            gate_entry.entry_tag = None
            gate_entry.save(update_fields=['tag_number', 'generated_tag', 'entry_tag'])

        # If previous physical tag was released or changed, restore old tag to Available
        if old_tag and old_tag != gate_entry.generated_tag:
            old_tag.status = 'Available'
            old_tag.save()
        # If a new physical tag is assigned, set to Unavailable
        if gate_entry.generated_tag and gate_entry.generated_tag != old_tag:
            gate_entry.generated_tag.status = 'Unavailable'
            gate_entry.generated_tag.save()

        # Handle multi-tag update
        if 'generated_tags' in self.request.data or 'generated_tags_ids' in self.request.data:
            # Release old multi-tags before re-assigning
            old_multi_tags = list(gate_entry.generated_tags.all())
            self._save_generated_tags(gate_entry, self.request)
            new_multi_tag_ids = set(gate_entry.generated_tags.values_list('id', flat=True))
            for old_mt in old_multi_tags:
                if old_mt.id not in new_multi_tag_ids:
                    old_mt.status = 'Available'
                    old_mt.save()

        # Keep persons_inside in sync if not partially exited or if changed
        if not gate_entry.partial_exit_logs or gate_entry.persons_inside is None:
            gate_entry.persons_inside = gate_entry.number_of_persons or 1
            gate_entry.save(update_fields=['persons_inside'])
        elif gate_entry.partial_exit_logs and gate_entry.partial_exit_logs[-1].get('action') in ['re_entered', 'reentry'] and gate_entry.exit_time is None:
            # Active on campus on a re-entered visit: sync persons_inside with updated number_of_persons
            gate_entry.persons_inside = gate_entry.number_of_persons or 1
            gate_entry.save(update_fields=['persons_inside'])
        elif gate_entry.number_of_persons != old_num:
            diff = (gate_entry.number_of_persons or 1) - (old_num or 1)
            gate_entry.persons_inside = max(0, (gate_entry.persons_inside or 0) + diff)
            gate_entry.save(update_fields=['persons_inside'])

        if 'vehicles_data' in self.request.data:
            existing_vehicles = {v.id: v for v in gate_entry.vehicles.all()}
            vehicles_raw = self.request.data.get('vehicles_data')
            import json
            if isinstance(vehicles_raw, str):
                try:
                    vehicles_list = json.loads(vehicles_raw)
                except Exception:
                    vehicles_list = []
            elif isinstance(vehicles_raw, list):
                vehicles_list = vehicles_raw
            else:
                vehicles_list = []

            keep_ids = []
            for idx, item in enumerate(vehicles_list):
                if not isinstance(item, dict):
                    continue
                v_num = item.get('vehicle_number', '').strip().upper()
                if not v_num:
                    continue
                d_name = item.get('driver_name', '').strip()
                v_id = item.get('id')
                photo_key = item.get('photo_key', f'vehicle_photo_{idx}')
                photo_file = self.request.FILES.get(photo_key) or self.request.FILES.get(f'vehicle_photo_{idx}')

                if v_id and int(v_id) in existing_vehicles:
                    v_obj = existing_vehicles[int(v_id)]
                    v_obj.vehicle_number = v_num
                    v_obj.driver_name = d_name or None
                    if photo_file:
                        v_obj.vehicle_photo = photo_file
                    v_obj.save()
                    keep_ids.append(v_obj.id)
                else:
                    new_v = GateEntryVehicle.objects.create(
                        gate_entry=gate_entry,
                        vehicle_number=v_num,
                        driver_name=d_name if d_name else None,
                        vehicle_photo=photo_file if photo_file else None
                    )
                    keep_ids.append(new_v.id)

            gate_entry.vehicles.exclude(id__in=keep_ids).delete()

        self._save_equipments(gate_entry, self.request)

        # If entry has re-entered and is active, ensure the latest re-entry timeline milestone reflects updated details
        if gate_entry.partial_exit_logs and gate_entry.partial_exit_logs[-1].get('action') in ['re_entered', 'reentry'] and gate_entry.exit_time is None:
            logs = list(gate_entry.partial_exit_logs)
            last_reentry = dict(logs[-1])
            last_reentry['entered_count'] = gate_entry.number_of_persons or 1
            last_reentry['persons_inside'] = gate_entry.persons_inside or gate_entry.number_of_persons or 1
            all_tags = [str(t.tag_number) for t in gate_entry.generated_tags.all() if t.tag_number]
            if all_tags:
                tag_str = ", ".join(all_tags)
                last_reentry['tag_number'] = tag_str
                last_reentry['new_tag_issued'] = tag_str
            all_vehs = [v.vehicle_number for v in gate_entry.vehicles.all() if v.vehicle_number]
            if all_vehs:
                last_reentry['vehicle_number'] = ", ".join(all_vehs)
                last_reentry['vehicle_numbers'] = all_vehs
            logs[-1] = last_reentry
            gate_entry.partial_exit_logs = logs
            gate_entry.save(update_fields=['partial_exit_logs'])

        # If exit_time is being set, mark the tag as Available again
        if gate_entry.exit_time and gate_entry.generated_tag:
            tag = gate_entry.generated_tag
            tag.status = 'Available'
            tag.save()

        # Handle parking slot status on update
        old_slot = old_instance.parking_slot
        if old_slot and old_slot != gate_entry.parking_slot:
            old_slot.status = 'Available'
            old_slot.save(update_fields=['status'])
        if gate_entry.parking_slot:
            gate_entry.parking_slot.status = 'Occupied'
            gate_entry.parking_slot.save(update_fields=['status'])

        sync_entry_cards_for_gate_entry(gate_entry)

    def _get_remaining_equipments(self, gate_entry, excluding_ids=None):
        excluding = set()
        if excluding_ids:
            for eq_id in excluding_ids:
                if eq_id is not None and str(eq_id).strip():
                    try:
                        excluding.add(int(eq_id))
                    except (ValueError, TypeError):
                        pass
        for log in (gate_entry.partial_exit_logs or []):
            for eq_id in (log.get('exiting_equipments') or []):
                if eq_id is not None and str(eq_id).strip():
                    try:
                        excluding.add(int(eq_id))
                    except (ValueError, TypeError):
                        pass

        remaining = []
        for eq in gate_entry.equipments.all():
            if eq.id not in excluding:
                remaining.append({
                    'id': eq.id,
                    'name': eq.name,
                    'code': eq.code
                })
        return remaining

    def _get_remaining_vehicles(self, gate_entry, excluding_numbers=None):
        excluding = set()
        if excluding_numbers:
            for num in excluding_numbers:
                if num and str(num).strip():
                    excluding.add(str(num).strip().upper())
        for log in (gate_entry.partial_exit_logs or []):
            v_num = log.get('vehicle_number', '')
            if v_num:
                for v in str(v_num).split(','):
                    if v.strip():
                        excluding.add(v.strip().upper())
            for v in (log.get('vehicle_numbers') or []):
                if v and str(v).strip():
                    excluding.add(str(v).strip().upper())

        all_entry_vehicles = []
        for gv in gate_entry.vehicles.all():
            if gv.vehicle_number:
                all_entry_vehicles.append(gv.vehicle_number.strip().upper())
        if hasattr(gate_entry, 'vehicle_number') and gate_entry.vehicle_number:
            for v in str(gate_entry.vehicle_number).split(','):
                if v.strip():
                    all_entry_vehicles.append(v.strip().upper())

        remaining = []
        for v in all_entry_vehicles:
            if v not in excluding and v not in remaining:
                remaining.append(v)
        return remaining

    @action(detail=True, methods=['post'])
    def mark_exit(self, request, pk=None):
        from django.utils import timezone
        gate_entry = self.get_object()
        if gate_entry.exit_time:
            return Response({"detail": "Visitor has already fully exited."}, status=status.HTTP_400_BAD_REQUEST)

        # Require host employee to complete movement first before gate checkout
        if gate_entry.visitor and gate_entry.verification_status != 'completed' and not gate_entry.movement_completed_at:
            official_name = ""
            if gate_entry.employee:
                official_name = f" ({gate_entry.employee.get_full_name() or gate_entry.employee.username})"
            return Response(
                {"detail": f"Cannot check out: The host employee{official_name} must complete the visitor's campus movement first."},
                status=status.HTTP_400_BAD_REQUEST
            )

        is_partial = request.data.get('is_partial', False)
        
        # Ensure persons_inside is initialized
        if gate_entry.persons_inside is None:
            gate_entry.persons_inside = gate_entry.number_of_persons or 1

        if is_partial:
            is_vehicle_only = request.data.get('is_vehicle_only', False)
            try:
                exiting_count = int(request.data.get('exiting_count', 0 if is_vehicle_only else 1))
            except (ValueError, TypeError):
                exiting_count = 0 if is_vehicle_only else 1

            vehicle_number = request.data.get('vehicle_number', '').strip()
            vehicle_numbers = request.data.get('vehicle_numbers', [])
            exiting_vehs = []
            if isinstance(vehicle_numbers, list):
                for v in vehicle_numbers:
                    if v and str(v).strip():
                        exiting_vehs.append(str(v).strip().upper())
            if vehicle_number:
                for v in str(vehicle_number).split(','):
                    v_clean = v.strip().upper()
                    if v_clean and v_clean not in exiting_vehs:
                        exiting_vehs.append(v_clean)

            # Equipment exiting in this request
            exiting_equipments_raw = request.data.get('exiting_equipments', [])
            if isinstance(exiting_equipments_raw, str):
                try:
                    import json as _json
                    exiting_equipments_raw = _json.loads(exiting_equipments_raw)
                except Exception:
                    exiting_equipments_raw = [x.strip() for x in exiting_equipments_raw.split(',') if x.strip()]
            if not isinstance(exiting_equipments_raw, list):
                exiting_equipments_raw = [exiting_equipments_raw]
            exiting_eq_ids = []
            for eq_id in exiting_equipments_raw:
                if eq_id is not None and str(eq_id).strip().isdigit():
                    exiting_eq_ids.append(int(eq_id))

            if is_vehicle_only or exiting_count == 0:
                is_vehicle_only = True
                exiting_count = 0
                if not exiting_vehs and not exiting_eq_ids:
                    return Response({"detail": "Please specify at least one vehicle or tool/equipment to exit."}, status=status.HTTP_400_BAD_REQUEST)
                # If 0 persons are inside and no remaining vehicles or equipment remain on campus, this completes full exit
                if gate_entry.persons_inside == 0:
                    remaining_vehs = self._get_remaining_vehicles(gate_entry, excluding_numbers=exiting_vehs)
                    remaining_eqs = self._get_remaining_equipments(gate_entry, excluding_ids=exiting_eq_ids)
                    if not remaining_vehs and not remaining_eqs:
                        is_partial = False
            else:
                if exiting_count <= 0:
                    return Response({"detail": "Exiting count must be at least 1."}, status=status.HTTP_400_BAD_REQUEST)

                # Strict validation: require returned physical tags to match exiting count if entry has active tags
                total_active_tags = gate_entry.generated_tags.count()
                if gate_entry.generated_tag and not gate_entry.generated_tags.filter(id=gate_entry.generated_tag.id).exists():
                    total_active_tags += 1

                if total_active_tags > 0:
                    expected_tag_count = min(exiting_count, total_active_tags)
                    returned_tag_ids_raw = request.data.get('returned_tag_ids', [])
                    if isinstance(returned_tag_ids_raw, str):
                        try:
                            import json as _json
                            returned_tag_ids_raw = _json.loads(returned_tag_ids_raw)
                        except Exception:
                            returned_tag_ids_raw = []
                    returned_tag_ids = [int(x) for x in returned_tag_ids_raw if str(x).isdigit()]
                    if len(returned_tag_ids) != expected_tag_count:
                        return Response({
                            "detail": f"Physical tag surrender required: Exactly {expected_tag_count} physical tag(s) must be ticked and surrendered for {exiting_count} departing person(s) (received {len(returned_tag_ids)})."
                        }, status=status.HTTP_400_BAD_REQUEST)

                remaining_vehs = self._get_remaining_vehicles(gate_entry, excluding_numbers=exiting_vehs)
                remaining_eqs = self._get_remaining_equipments(gate_entry, excluding_ids=exiting_eq_ids)

                if exiting_count >= gate_entry.persons_inside:
                    if remaining_vehs or remaining_eqs:
                        # All persons leaving, but vehicles or tools/equipment remain on campus (Unclosed Entry)
                        gate_entry.persons_inside = 0
                    else:
                        # All persons leaving AND no vehicles remaining AND no equipment remaining -> execute Full Exit
                        is_partial = False
                else:
                    gate_entry.persons_inside = gate_entry.persons_inside - exiting_count

                # If all vehicles have left the campus, release allocated parking slot
                if len(remaining_vehs) == 0 and gate_entry.parking_slot:
                    release_parking_slot_for_entry(gate_entry)

                # Generate ExitCard for departing vehicles in partial checkout
                if exiting_vehs:
                    sync_exit_cards_for_gate_entry(gate_entry, exit_time=timezone.now(), exiting_vehs=exiting_vehs)

            if is_partial:
                surrendered_tags = []

                if gate_entry.persons_inside == 0:
                    # All persons leaving (leaving vehicle or equipment on campus).
                    # Physical tags must be surrendered to the gate and set to Available!
                    if gate_entry.generated_tag:
                        surrendered_tags.append(str(gate_entry.generated_tag.tag_number))
                        tag = gate_entry.generated_tag
                        tag.status = 'Available'
                        tag.save(update_fields=['status'])
                        gate_entry.generated_tag = None

                    for mt in gate_entry.generated_tags.all():
                        t_num = str(mt.tag_number)
                        if t_num not in surrendered_tags:
                            surrendered_tags.append(t_num)
                        mt.status = 'Available'
                        mt.save(update_fields=['status'])
                    gate_entry.generated_tags.clear()
                    gate_entry.tag_number = None
                else:
                    # Partial departure (some persons remain inside)
                    returned_tag_ids_raw = request.data.get('returned_tag_ids', [])
                    if isinstance(returned_tag_ids_raw, str):
                        try:
                            import json as _json
                            returned_tag_ids_raw = _json.loads(returned_tag_ids_raw)
                        except Exception:
                            returned_tag_ids_raw = []
                    returned_tag_ids = [int(x) for x in returned_tag_ids_raw if str(x).isdigit()]

                    # Check if primary generated_tag was returned
                    if gate_entry.generated_tag and (gate_entry.generated_tag.id in returned_tag_ids or (request.data.get('tag_received', False) and not returned_tag_ids)):
                        p_tag = gate_entry.generated_tag
                        if str(p_tag.tag_number) not in surrendered_tags:
                            surrendered_tags.append(str(p_tag.tag_number))
                        p_tag.status = 'Available'
                        p_tag.save(update_fields=['status'])
                        gate_entry.generated_tags.remove(p_tag)
                        gate_entry.generated_tag = None

                    # Check any remaining tags in returned_tag_ids from generated_tags
                    if returned_tag_ids:
                        for mt in gate_entry.generated_tags.filter(id__in=returned_tag_ids):
                            t_num = str(mt.tag_number)
                            if t_num not in surrendered_tags:
                                surrendered_tags.append(t_num)
                            mt.status = 'Available'
                            mt.save(update_fields=['status'])
                            gate_entry.generated_tags.remove(mt)

                    # If primary generated_tag was surrendered but other tags remain in generated_tags,
                    # promote the first remaining tag to generated_tag
                    remaining_tags = gate_entry.generated_tags.all()
                    if not gate_entry.generated_tag and remaining_tags.exists():
                        first_rem = remaining_tags.first()
                        gate_entry.generated_tag = first_rem
                        gate_entry.tag_number = str(first_rem.tag_number)
                    elif not remaining_tags.exists() and not gate_entry.generated_tag:
                        gate_entry.tag_number = None

                # Record in partial_exit_logs
                recorder_name = f"{request.user.first_name} {request.user.last_name}".strip() if request.user.is_authenticated else "Gate Security"
                exit_gate_val = request.data.get('exit_gate')
                exit_gate_name = None
                if exit_gate_val:
                    try:
                        eg_obj = Gate.objects.get(id=exit_gate_val)
                        gate_entry.exit_gate = eg_obj
                        exit_gate_name = eg_obj.name
                    except (Gate.DoesNotExist, ValueError):
                        pass
                elif gate_entry.exit_gate:
                    exit_gate_name = gate_entry.exit_gate.name
                elif gate_entry.entry_gate:
                    exit_gate_name = gate_entry.entry_gate.name

                remaining_vehs_now = self._get_remaining_vehicles(gate_entry, excluding_numbers=exiting_vehs)
                remaining_eqs_now = self._get_remaining_equipments(gate_entry, excluding_ids=exiting_eq_ids)
                log_item = {
                    "exited_count": exiting_count,
                    "vehicle_number": ', '.join(exiting_vehs) if exiting_vehs else '',
                    "vehicle_numbers": exiting_vehs,
                    "exiting_equipments": exiting_eq_ids,
                    "exiting_equipment_names": request.data.get('exiting_equipment_names', []),
                    "remaining_count": gate_entry.persons_inside,
                    "remaining_vehicles": remaining_vehs_now if gate_entry.persons_inside == 0 else None,
                    "remaining_equipments": [eq['name'] for eq in remaining_eqs_now] if gate_entry.persons_inside == 0 else None,
                    "surrendered_tags": surrendered_tags,
                    "tags_surrendered": len(surrendered_tags) > 0,
                    "timestamp": timezone.now().isoformat(),
                    "notes": request.data.get('notes', ''),
                    "recorded_by": recorder_name,
                    "exit_gate": exit_gate_name
                }
                if gate_entry.partial_exit_logs is None:
                    gate_entry.partial_exit_logs = []
                gate_entry.partial_exit_logs.append(log_item)
                gate_entry.save()

                return Response(self.get_serializer(gate_entry).data)

        # Full Exit
        exit_gate_val = request.data.get('exit_gate')
        if exit_gate_val:
            try:
                gate_entry.exit_gate = Gate.objects.get(id=exit_gate_val)
            except (Gate.DoesNotExist, ValueError):
                pass
        elif not gate_entry.exit_gate and gate_entry.entry_gate:
            gate_entry.exit_gate = gate_entry.entry_gate

        exit_gate_name = gate_entry.exit_gate.name if gate_entry.exit_gate else None
        recorder_name = f"{request.user.first_name} {request.user.last_name}".strip() if request.user.is_authenticated else "Gate Security"
        now_dt = timezone.now()

        prior_persons_inside = gate_entry.persons_inside if gate_entry.persons_inside is not None else (gate_entry.number_of_persons or 1)
        gate_entry.exit_time = now_dt
        gate_entry.persons_inside = 0
        gate_entry.verification_status = 'completed'

        # Record this final exit in partial_exit_logs if prior partial exits existed
        # or if specific vehicles/tools/notes were submitted during this final exit
        has_prior_logs = bool(gate_entry.partial_exit_logs and len(gate_entry.partial_exit_logs) > 0)
        has_custom_items = bool(
            ('exiting_vehs' in locals() and exiting_vehs) or 
            ('exiting_eq_ids' in locals() and exiting_eq_ids) or
            request.data.get('vehicle_number') or
            request.data.get('vehicle_numbers') or
            request.data.get('exiting_equipments')
        )

        if has_prior_logs or has_custom_items:
            final_exiting_vehs = exiting_vehs if 'exiting_vehs' in locals() else []
            if not final_exiting_vehs:
                final_exiting_vehs = self._get_remaining_vehicles(gate_entry)
            
            final_exiting_eqs = exiting_eq_ids if 'exiting_eq_ids' in locals() else []
            final_exiting_eq_names = request.data.get('exiting_equipment_names', [])
            if not final_exiting_eqs:
                rem_eqs = self._get_remaining_equipments(gate_entry)
                final_exiting_eqs = [eq['id'] for eq in rem_eqs]
                if not final_exiting_eq_names:
                    final_exiting_eq_names = [eq['name'] for eq in rem_eqs]

            notes_val = request.data.get('notes', '').strip()
            if not notes_val:
                if prior_persons_inside == 0:
                    if final_exiting_vehs:
                        notes_val = f"Vehicle Departure ({', '.join(final_exiting_vehs)}) — All persons had previously departed campus"
                    elif final_exiting_eq_names:
                        notes_val = f"Tool(s) Departure ({', '.join(final_exiting_eq_names)}) — All persons had previously departed campus"
                    else:
                        notes_val = "Final campus checkout completed"

            final_log_item = {
                "action": "full_checkout",
                "exited_count": exiting_count if 'exiting_count' in locals() else prior_persons_inside,
                "vehicle_number": ', '.join(final_exiting_vehs) if final_exiting_vehs else '',
                "vehicle_numbers": final_exiting_vehs,
                "exiting_equipments": final_exiting_eqs,
                "exiting_equipment_names": final_exiting_eq_names,
                "remaining_count": 0,
                "remaining_vehicles": [],
                "remaining_equipments": [],
                "surrendered_tags": surrendered_tags if 'surrendered_tags' in locals() else [],
                "tags_surrendered": True,
                "timestamp": now_dt.isoformat(),
                "notes": notes_val,
                "recorded_by": recorder_name,
                "exit_gate": exit_gate_name
            }
            if gate_entry.partial_exit_logs is None:
                gate_entry.partial_exit_logs = []
            gate_entry.partial_exit_logs.append(final_log_item)

        gate_entry.save()
        
        # Release single FK tag
        if gate_entry.generated_tag:
            tag = gate_entry.generated_tag
            tag.status = 'Available'
            tag.save()
            gate_entry.generated_tag = None

        # Release all multi-tags
        gate_entry.generated_tags.all().update(status='Available')
        gate_entry.generated_tags.clear()

        # Release parking slot back to Available
        release_parking_slot_for_entry(gate_entry)

        # Generate ExitCard records for all vehicles of this gate entry
        sync_exit_cards_for_gate_entry(gate_entry, exit_time=now_dt)

        return Response(self.get_serializer(gate_entry).data)

    @action(detail=True, methods=['post'])
    def resume_entry(self, request, pk=None):
        """
        Re-ingress / resume campus occupancy for an unclosed GateEntry that has outstanding vehicles/equipments on campus.
        Restores persons_inside to the returning count and records a re-entry audit log with newly issued tag.
        """
        from django.utils import timezone
        gate_entry = self.get_object()
        if gate_entry.exit_time is not None:
            return Response({"detail": "This gate entry has already been fully completed and exited."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            returning_count = int(request.data.get('number_of_persons') or request.data.get('returning_persons') or 1)
            if returning_count < 1:
                returning_count = 1
        except (ValueError, TypeError):
            returning_count = 1

        # Strict validation: if returning_count > 1 and physical tags are used, tag count must match returning_count
        tag_id = request.data.get('generated_tag') or request.data.get('tag_id')
        tag_number = request.data.get('tag_number')
        is_na = (str(tag_id).strip().upper() in ['N/A', 'NA']) or (str(tag_number).strip().upper() in ['N/A', 'NA'])

        if not is_na and returning_count > 1:
            raw_tags = None
            if hasattr(request.data, 'getlist'):
                gt_list = request.data.getlist('generated_tags_ids') or request.data.getlist('generated_tags')
                if len(gt_list) > 1 or (len(gt_list) == 1 and not str(gt_list[0]).startswith('[')):
                    raw_tags = gt_list
            if raw_tags is None:
                raw_tags = request.data.get('generated_tags') or request.data.get('generated_tags_ids')
            tag_ids = []
            if raw_tags:
                if isinstance(raw_tags, str):
                    try:
                        import json as _json
                        tag_ids = _json.loads(raw_tags)
                    except Exception:
                        tag_ids = [r.strip() for r in raw_tags.split(',') if r.strip()]
                elif isinstance(raw_tags, list):
                    tag_ids = raw_tags
            elif tag_id:
                tag_ids = [tag_id]
            valid_tag_ids = [t for t in tag_ids if str(t).strip().isdigit()]
            if len(valid_tag_ids) != returning_count:
                return Response(
                    {"detail": f"{returning_count} persons are re-entering campus, but {len(valid_tag_ids)} tag(s) were selected. Exactly 1 physical tag is required per person ({returning_count} tags required)."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Update persons count
        current_inside = gate_entry.persons_inside or 0
        gate_entry.persons_inside = returning_count
        gate_entry.number_of_persons = max(gate_entry.number_of_persons or 1, gate_entry.persons_inside)
        gate_entry.movement_completed_at = None
        gate_entry.movement_completed_by = None
        gate_entry.verification_status = 'pending'
        
        # Handle new tag assignment if provided
        tag_id = request.data.get('generated_tag') or request.data.get('tag_id')
        tag_number = request.data.get('tag_number')
        assigned_tag_number = None

        if tag_id and str(tag_id).strip() not in ['N/A', 'n/a', 'NA', '', 'null', 'None']:
            try:
                tag_obj = GeneratedTag.objects.get(id=int(tag_id))
                tag_obj.status = 'Unavailable'
                tag_obj.save(update_fields=['status'])
                gate_entry.generated_tag = tag_obj
                gate_entry.tag_number = str(tag_obj.tag_number)
                gate_entry.entry_tag = tag_obj.entry_tag
                assigned_tag_number = str(tag_obj.tag_number)
            except (GeneratedTag.DoesNotExist, ValueError):
                pass
        elif tag_number and tag_number != 'N/A':
            gate_entry.tag_number = tag_number
            assigned_tag_number = tag_number

        # Handle multi-tag re-assignment on re-entry
        self._save_generated_tags(gate_entry, request)
        if gate_entry.generated_tags.exists():
            tags_list = [str(t.tag_number) for t in gate_entry.generated_tags.all() if t.tag_number]
            if tags_list:
                assigned_tag_number = ", ".join(tags_list)
                gate_entry.tag_number = assigned_tag_number

        # Update entry gate if provided
        entry_gate_val = request.data.get('entry_gate')
        entry_gate_name = None
        if entry_gate_val:
            try:
                eg_obj = Gate.objects.get(id=entry_gate_val)
                entry_gate_name = eg_obj.name
                gate_entry.entry_gate = eg_obj
            except (Gate.DoesNotExist, ValueError):
                pass

        dept_val = request.data.get('department')
        if dept_val:
            try:
                gate_entry.department_id = int(dept_val)
            except (ValueError, TypeError):
                pass

        emp_val = request.data.get('employee')
        if emp_val:
            try:
                gate_entry.employee_id = int(emp_val)
            except (ValueError, TypeError):
                pass

        purpose_val = request.data.get('purpose_of_visit')
        if purpose_val:
            gate_entry.purpose_of_visit = purpose_val

        # Handle accompanied vehicles on re-entry
        self._save_vehicles(gate_entry, request)
        new_veh_nums = []
        if 'vehicles_data' in request.data:
            try:
                import json as _json
                vd_raw = request.data.get('vehicles_data')
                if isinstance(vd_raw, str):
                    vd_list = _json.loads(vd_raw)
                elif isinstance(vd_raw, list):
                    vd_list = vd_raw
                else:
                    vd_list = []
                for item in vd_list:
                    if isinstance(item, dict) and item.get('vehicle_number'):
                        new_veh_nums.append(item['vehicle_number'].strip().upper())
            except Exception:
                pass
        elif request.data.get('vehicle_number'):
            new_veh_nums = [request.data.get('vehicle_number').strip().upper()]

        recorder_name = f"{request.user.first_name} {request.user.last_name}".strip() if request.user.is_authenticated else "Gate Security"
        reentry_log = {
            "action": "re_entered",
            "entered_count": returning_count,
            "persons_inside": gate_entry.persons_inside,  # total after re-entry
            "vehicle_number": ', '.join(new_veh_nums) if new_veh_nums else None,
            "vehicle_numbers": new_veh_nums,
            "notes": request.data.get('notes', 'Visitor re-entered campus (resumed unclosed entry)'),
            "timestamp": timezone.now().isoformat(),
            "recorded_by": recorder_name,
            "entry_gate": entry_gate_name,
            "tag_number": assigned_tag_number or gate_entry.tag_number,
            "new_tag_issued": assigned_tag_number,
            "department_name": gate_entry.department.name if gate_entry.department else None,
            "employee_name": (gate_entry.employee.get_full_name() or gate_entry.employee.username) if gate_entry.employee else None,
            "purpose_of_visit": gate_entry.purpose_of_visit,
        }
        if gate_entry.partial_exit_logs is None:
            gate_entry.partial_exit_logs = []
        gate_entry.partial_exit_logs.append(reentry_log)
        gate_entry.save()

        if 'equipments' in request.data or 'equipments_data' in request.data:
            self._save_equipments(gate_entry, request)
        return Response(self.get_serializer(gate_entry).data)

    @action(detail=False, methods=['get'])
    def check_unclosed_entry(self, request):
        """
        Check if a visitor has an active unclosed GateEntry on campus with 0 persons inside,
        or outstanding vehicles / equipments on campus.
        If the visitor is currently inside (persons_inside > 0), return is_currently_inside=True.
        """
        mobile = request.query_params.get('mobile', '').strip()
        visitor_id = request.query_params.get('visitor_id', '').strip()
        if not mobile and not visitor_id:
            return Response({"unclosed_entry": None, "is_currently_inside": False})

        from django.db.models import Q
        q = Q(exit_time__isnull=True)
        if visitor_id:
            try:
                q &= Q(visitor_id=int(visitor_id))
            except ValueError:
                pass
        elif mobile:
            q &= Q(visitor__mobile_no__iexact=mobile)

        entry = GateEntry.objects.filter(q).select_related(
            'visitor', 'department', 'employee', 'generated_tag', 'entry_gate'
        ).prefetch_related('equipments', 'generated_tags', 'vehicles').order_by('-id').first()

        if entry:
            persons_in = entry.persons_inside if entry.persons_inside is not None else (entry.number_of_persons or 1)

            # Case A: Visitor is CURRENTLY ON CAMPUS (persons_inside > 0)
            if persons_in > 0:
                tags_m2m = [t.tag_number for t in entry.generated_tags.all()]
                tag_code = ", ".join(tags_m2m) if tags_m2m else (entry.generated_tag.tag_number if entry.generated_tag else entry.tag_number)
                return Response({
                    "unclosed_entry": None,
                    "is_currently_inside": True,
                    "has_outstandings": False,
                    "active_entry": {
                        "id": entry.id,
                        "tag_code": tag_code,
                        "tag_number": tag_code,
                        "persons_inside": persons_in,
                        "number_of_persons": entry.number_of_persons or 1,
                        "entry_time": entry.entry_time.isoformat() if entry.entry_time else "",
                        "entry_gate_id": entry.entry_gate.id if entry.entry_gate else None,
                        "entry_gate_name": entry.entry_gate.name if entry.entry_gate else "",
                        "visitor_id": entry.visitor.id if entry.visitor else None,
                        "visitor_name": entry.visitor.visitor_name if entry.visitor else (getattr(entry, 'visitor_name', '') or "Visitor"),
                        "visitor_mobile": entry.visitor.mobile_no if entry.visitor else mobile,
                        "department_name": entry.department.name if entry.department else "",
                        "employee_name": entry.employee.get_full_name() if entry.employee else "",
                    }
                })

            # Case B: All persons departed (persons_inside == 0). Check if vehicles / equipments remain.
            remaining_vehs = self._get_remaining_vehicles(entry)
            
            equipments_list = []
            eq_names = []
            for eq in entry.equipments.all():
                eq_names.append(eq.name)
                equipments_list.append({
                    "id": eq.id,
                    "value": eq.id,
                    "name": eq.name,
                    "label": eq.name,
                    "code": eq.code,
                    "image": eq.image.url if eq.image else None,
                    "description": eq.description
                })
            
            equipment_display = ", ".join(eq_names) if eq_names else (getattr(entry, 'material_details', None) or entry.narration or '')

            # If no vehicles and no equipments remain on campus, this is not an unclosed entry
            if not remaining_vehs and not equipments_list:
                return Response({"unclosed_entry": None, "is_currently_inside": False})

            # Vehicles remaining
            vehicles_list = []
            for v in entry.vehicles.all():
                if not remaining_vehs or v.vehicle_number in remaining_vehs:
                    vehicles_list.append({
                        "id": v.id,
                        "vehicle_number": v.vehicle_number,
                        "vehicle_type": getattr(v, 'vehicle_type', None),
                        "driver_name": getattr(v, 'driver_name', None),
                        "driver_mobile": getattr(v, 'driver_mobile', None),
                    })
            if not vehicles_list and remaining_vehs:
                for v_num in remaining_vehs:
                    vehicles_list.append({"vehicle_number": v_num})

            # Notice: Tags were surrendered at departure!
            # The visitor does NOT have a tag and tags are NOT on campus.
            # A new tag must be issued upon re-entry.
            data = {
                "id": entry.id,
                "visitor_id": entry.visitor.id if entry.visitor else None,
                "visitor_name": entry.visitor.visitor_name if entry.visitor else (getattr(entry, 'visitor_name', '') or "Visitor"),
                "visitor_mobile": entry.visitor.mobile_no if entry.visitor else mobile,
                "company_name": entry.visitor.company_name if (entry.visitor and entry.visitor.company_name) else (getattr(entry, 'company_name', '') or ""),
                "department_id": entry.department.id if entry.department else None,
                "department_name": entry.department.name if entry.department else "",
                "employee_id": entry.employee.id if entry.employee else None,
                "employee_name": entry.employee.get_full_name() if entry.employee else "",
                "entry_time": entry.entry_time.isoformat() if entry.entry_time else "",
                "entry_gate_id": entry.entry_gate.id if entry.entry_gate else None,
                "entry_gate_name": entry.entry_gate.name if entry.entry_gate else "",
                "remaining_vehicles": remaining_vehs,
                "vehicles": remaining_vehs,
                "vehicles_list": vehicles_list,
                "equipments": equipment_display,
                "equipments_list": equipments_list,
                "equipment_ids": [eq["id"] for eq in equipments_list],
                "material_details": getattr(entry, 'material_details', None) or entry.narration or "",
                "tag_code": None,
                "tag_id": None,
                "tag_ids": [],
                "tags_list": [],
                "tag_category_id": None,
                "tag_category_name": None,
                "purpose_of_visit": entry.purpose_of_visit or "",
                "narration": entry.narration or "",
                "number_of_persons": 1,
                "persons_inside": 0,
                "has_outstandings": True
            }
            return Response({"unclosed_entry": data, "is_currently_inside": False})

        return Response({"unclosed_entry": None, "is_currently_inside": False})

    @action(detail=True, methods=['post'])
    def approve_entry(self, request, pk=None):
        gate_entry = self.get_object()
        gate_entry.permission_status = 'approved'
        gate_entry.save(update_fields=['permission_status'])
        return Response(self.get_serializer(gate_entry).data)
        
    @action(detail=True, methods=['post'])
    def reject_entry(self, request, pk=None):
        gate_entry = self.get_object()
        gate_entry.permission_status = 'rejected'
        gate_entry.save(update_fields=['permission_status'])
        return Response(self.get_serializer(gate_entry).data)
        
    @action(detail=False, methods=['get'])
    def my_pending_approvals(self, request):
        queryset = GateEntry.objects.filter(
            employee=request.user,
            is_permission_required=True,
            permission_status='pending'
        )
        date_param = request.query_params.get('date', 'today')
        if date_param and date_param != 'all':
            if date_param == 'today':
                from django.utils import timezone
                queryset = queryset.filter(entry_time__date=timezone.now().date())
            else:
                queryset = queryset.filter(entry_time__date=date_param)

        entries = queryset.order_by('-entry_time')
        serializer = self.get_serializer(entries, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def allocated_visitors(self, request):
        """
        List visitors & vehicles allocated to an employee.
        Supports filtering by employee, status ('active', 'completed', 'reassigned', 'all'), and search.
        """
        from django.db.models import Q
        gate_qs = GateEntry.objects.all().select_related(
            'visitor', 'employee', 'department', 'entry_gate', 'exit_gate', 'generated_tag'
        ).prefetch_related('vehicles', 'reallocations')

        veh_qs = VehicleEntry.objects.all().select_related(
            'employee', 'department', 'entry_gate', 'exit_gate', 'vehicle_pass', 'appointment'
        ).prefetch_related('vehicles', 'reallocations')

        department_id = request.query_params.get('department', None)
        if department_id:
            gate_qs = gate_qs.filter(department_id=department_id)
            veh_qs = veh_qs.filter(department_id=department_id)

        employee_id = request.query_params.get('employee', None)
        view_all = request.query_params.get('all', 'false').lower() == 'true'
        status_param = request.query_params.get('status', 'active').lower()

        if employee_id:
            gate_qs = gate_qs.filter(employee_id=employee_id)
            veh_qs = veh_qs.filter(employee_id=employee_id)
        elif not view_all:
            if request.user.is_authenticated:
                if status_param == 'reassigned':
                    gate_qs = gate_qs.filter(
                        Q(employee=request.user, verification_status='reassigned') |
                        Q(reallocations__from_employee=request.user, reallocations__status='approved')
                    ).distinct()
                    veh_qs = veh_qs.filter(
                        Q(employee=request.user, verification_status='reassigned') |
                        Q(reallocations__from_employee=request.user, reallocations__status='approved')
                    ).distinct()
                elif status_param == 'pending_approval':
                    gate_qs = gate_qs.filter(
                        reallocations__to_employee=request.user,
                        reallocations__status='pending',
                        exit_time__isnull=True
                    ).distinct()
                    veh_qs = veh_qs.filter(
                        reallocations__to_employee=request.user,
                        reallocations__status='pending',
                        exit_time__isnull=True
                    ).distinct()
                else:
                    gate_qs = gate_qs.filter(employee=request.user)
                    veh_qs = veh_qs.filter(employee=request.user)

        if status_param == 'active':
            gate_qs = gate_qs.filter(exit_time__isnull=True).exclude(verification_status='completed')
            veh_qs = veh_qs.filter(exit_time__isnull=True).exclude(verification_status='completed')
        elif status_param == 'completed':
            gate_qs = gate_qs.filter(verification_status='completed')
            veh_qs = veh_qs.filter(verification_status='completed')
        elif status_param == 'reassigned':
            gate_qs = gate_qs.filter(Q(verification_status='reassigned') | Q(reallocations__status='approved')).distinct()
            veh_qs = veh_qs.filter(Q(verification_status='reassigned') | Q(reallocations__status='approved')).distinct()
        elif status_param == 'pending_approval':
            gate_qs = gate_qs.filter(reallocations__status='pending', exit_time__isnull=True).distinct()
            veh_qs = veh_qs.filter(reallocations__status='pending', exit_time__isnull=True).distinct()
        elif status_param == 'inside':
            gate_qs = gate_qs.filter(exit_time__isnull=True)
            veh_qs = veh_qs.filter(exit_time__isnull=True)

        search_query = request.query_params.get('search', '').strip()
        if search_query:
            gate_qs = gate_qs.filter(
                Q(visitor__visitor_name__icontains=search_query) |
                Q(visitor__mobile_no__icontains=search_query) |
                Q(visitor__company_name__icontains=search_query) |
                Q(vehicles__vehicle_number__icontains=search_query) |
                Q(generated_tag__tag_number__icontains=search_query) |
                Q(tag_number__icontains=search_query)
            ).distinct()
            veh_qs = veh_qs.filter(
                Q(vehicles__vehicle_number__icontains=search_query) |
                Q(driver__icontains=search_query) |
                Q(company__icontains=search_query) |
                Q(vehicle_pass__tag_number__icontains=search_query) |
                Q(purpose__icontains=search_query)
            ).distinct()

        gate_serializer = self.get_serializer(gate_qs.order_by('-entry_time'), many=True)
        gate_data = []
        for item in gate_serializer.data:
            item_dict = dict(item)
            item_dict['entry_type'] = 'visitor'
            gate_data.append(item_dict)

        veh_serializer = VehicleEntrySerializer(veh_qs.order_by('-entry_time'), many=True, context={'request': request})
        veh_data = []
        for v in veh_serializer.data:
            v_dict = dict(v)
            v_dict['entry_type'] = 'vehicle'
            driver_display = v_dict.get('driver')
            company_display = v_dict.get('company')
            v_dict['visitor_name'] = f"{driver_display} (Driver)" if driver_display else (company_display or "Vehicle Visitor")
            v_dict['visitor_mobile'] = v_dict.get('contact_number') or '—'
            v_dict['company_name'] = company_display
            vehicles_list = []
            for v_obj in v_dict.get('vehicles_data', []):
                vehicles_list.append({
                    'id': v_obj.get('id'),
                    'vehicle_number': v_obj.get('vehicle_number'),
                    'driver_name': driver_display or v_obj.get('driver'),
                    'vehicle_photo': v_obj.get('vehicle_photo')
                })
            v_dict['vehicles'] = vehicles_list
            v_dict['tag_number'] = v_dict.get('tag_code')
            v_dict['purpose_of_visit'] = v_dict.get('purpose')
            v_dict['narration'] = v_dict.get('material_details')
            veh_data.append(v_dict)

        combined = gate_data + veh_data
        combined.sort(key=lambda x: str(x.get('entry_time') or ''), reverse=True)
        return Response(combined)

    @action(detail=True, methods=['post'])
    def reallocate(self, request, pk=None):
        """
        Reallocate a visitor from current employee to a new employee.
        Only the last allocated (current host) employee can reallocate.
        """
        from django.contrib.auth import get_user_model
        from rarenett_app.models import Department, Employee
        User = get_user_model()

        gate_entry = self.get_object()
        if gate_entry.exit_time:
            return Response(
                {"detail": "Cannot reallocate a visitor who has already exited."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if gate_entry.verification_status == 'completed' or gate_entry.movement_completed_at:
            return Response(
                {"detail": "Cannot reallocate: Campus movement has already been completed."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Only the last allocated employee (or superuser/staff) can reallocate
        if request.user.is_authenticated and not (request.user.is_superuser or request.user.is_staff):
            if gate_entry.employee_id and gate_entry.employee_id != request.user.id:
                host_name = (
                    f"{gate_entry.employee.first_name} {gate_entry.employee.last_name}".strip()
                    or gate_entry.employee.username
                    if gate_entry.employee else "the assigned employee"
                )
                return Response(
                    {"detail": f"Permission denied. Only the currently allocated employee ({host_name}) can reallocate this visitor."},
                    status=status.HTTP_403_FORBIDDEN
                )

        to_employee_id = request.data.get('to_employee')
        if not to_employee_id:
            return Response(
                {"detail": "Target employee is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            to_employee = User.objects.get(id=to_employee_id)
        except User.DoesNotExist:
            return Response(
                {"detail": "Target employee not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        to_dept_id = request.data.get('to_department')
        to_department = None
        if to_dept_id:
            try:
                to_department = Department.objects.get(id=to_dept_id)
            except (Department.DoesNotExist, ValueError):
                to_department = None

        if not to_department:
            emp_profile = Employee.objects.filter(user=to_employee).first()
            if emp_profile and emp_profile.dept_designation and emp_profile.dept_designation.department:
                to_department = emp_profile.dept_designation.department

        reason = request.data.get('reason', '').strip()

        # Check if already a pending reallocation exists
        pending_realloc = gate_entry.reallocations.filter(status='pending').first()
        if pending_realloc:
            to_name = (
                f"{pending_realloc.to_employee.first_name} {pending_realloc.to_employee.last_name}".strip()
                if pending_realloc.to_employee else "another employee"
            )
            return Response(
                {"detail": f"A reallocation request to {to_name} is already pending approval."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if gate_entry.employee_id == to_employee.id:
            return Response(
                {"detail": "Cannot reallocate to the current host."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Record in audit log with status='pending'
        realloc = GateEntryReallocation.objects.create(
            gate_entry=gate_entry,
            from_employee=gate_entry.employee,
            to_employee=to_employee,
            from_department=gate_entry.department,
            to_department=to_department or gate_entry.department,
            reason=reason,
            status='pending',
            reallocated_by=request.user if request.user.is_authenticated else None
        )

        serializer = self.get_serializer(gate_entry)
        to_name = f"{to_employee.first_name} {to_employee.last_name}".strip() or to_employee.username
        return Response({
            "detail": f"Reallocation request sent to {to_name}. Awaiting their approval.",
            "reallocation_id": realloc.id,
            "gate_entry": serializer.data
        })

    @action(detail=True, methods=['post'])
    def complete_movement(self, request, pk=None):
        """
        Mark visitor's internal movement as completed by the host employee,
        releasing them to return to the gate for checkout.
        Only the last allocated (current host) employee can complete movement.
        """
        from django.utils import timezone
        gate_entry = self.get_object()
        if gate_entry.exit_time:
            return Response(
                {"detail": "Visitor has already exited."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if gate_entry.verification_status == 'completed' or gate_entry.movement_completed_at:
            return Response(
                {"detail": "Campus movement has already been completed for this visitor."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Only the last allocated employee (or superuser/staff) can complete movement
        if request.user.is_authenticated and not (request.user.is_superuser or request.user.is_staff):
            if gate_entry.employee_id and gate_entry.employee_id != request.user.id:
                host_name = (
                    f"{gate_entry.employee.first_name} {gate_entry.employee.last_name}".strip()
                    or gate_entry.employee.username
                    if gate_entry.employee else "the assigned employee"
                )
                return Response(
                    {"detail": f"Permission denied. Only the currently allocated employee ({host_name}) can complete this visitor's movement."},
                    status=status.HTTP_403_FORBIDDEN
                )

        notes = request.data.get('notes', '').strip()

        # If any pending reallocation exists, cancel it because movement is concluded
        gate_entry.reallocations.filter(status='pending').update(
            status='cancelled',
            response_notes='Campus movement concluded by host employee.'
        )

        gate_entry.verification_status = 'completed'
        gate_entry.movement_completed_at = timezone.now()
        gate_entry.movement_completed_by = request.user if request.user.is_authenticated else None
        if notes:
            gate_entry.movement_notes = notes
        gate_entry.save(update_fields=['verification_status', 'movement_completed_at', 'movement_completed_by', 'movement_notes'])

        serializer = self.get_serializer(gate_entry)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def reallocation_history(self, request, pk=None):
        gate_entry = self.get_object()
        reallocations = gate_entry.reallocations.all()
        serializer = GateEntryReallocationSerializer(reallocations, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def live_status_report(self, request):
        """
        Live Gate Status and Comprehensive Entry Report.
        Categorizes records across the 8 live status categories:
        1. Employees Inside
        2. Visitors Inside
        3. Contract Labour Inside
        4. VVIP Inside
        5. Vehicles Inside
        6. Expected Visitors
        7. Pending Approvals
        8. Overstayed Visitors
        Plus 'all' for complete log history.
        """
        from django.utils import timezone
        from appointment_app.models import Appointment
        from datetime import datetime
        now = timezone.now()
        today = now.date()

        date_from_param = request.query_params.get('date_from')
        date_to_param = request.query_params.get('date_to')
        date_param = request.query_params.get('date')
        tab_param = request.query_params.get('tab', 'all')
        search_param = request.query_params.get('search', '').strip().lower()

        # Parse date filters if provided
        filter_start = None
        filter_end = None
        if date_param:
            if date_param == 'today':
                filter_start = today
                filter_end = today
            elif date_param != 'all':
                try:
                    d = datetime.strptime(date_param, '%Y-%m-%d').date()
                    filter_start = d
                    filter_end = d
                except ValueError:
                    pass
        elif date_from_param or date_to_param:
            if date_from_param:
                try:
                    filter_start = datetime.strptime(date_from_param, '%Y-%m-%d').date()
                except ValueError:
                    pass
            if date_to_param:
                try:
                    filter_end = datetime.strptime(date_to_param, '%Y-%m-%d').date()
                except ValueError:
                    pass

        # 1. Gate Entries
        gate_qs = GateEntry.objects.all().select_related(
            'visitor', 'employee', 'department', 'entry_gate', 'exit_gate',
            'entry_tag__category', 'entry_tag__subcategory', 'generated_tag__entry_tag__category'
        ).prefetch_related(
            'vehicles',
            'reallocations__to_employee',
            'reallocations__from_employee',
            'reallocations__to_department',
            'reallocations__from_department'
        )

        # 2. Vehicle Entries
        veh_qs = VehicleEntry.objects.all().select_related(
            'employee', 'department', 'entry_gate', 'exit_gate', 'vehicle_pass__entry_tag__category', 'appointment'
        ).prefetch_related(
            'vehicles',
            'reallocations__to_employee',
            'reallocations__from_employee',
            'reallocations__to_department',
            'reallocations__from_department'
        )

        # 3. Appointments
        app_qs = Appointment.objects.all().select_related(
            'visitor', 'vehicle', 'concerned_staff', 'department', 'visitor_category'
        )

        # 4. Employee Gate Entries
        emp_qs = EmployeeGateEntry.objects.all().select_related(
            'employment_detail__user__department_applied',
            'employment_detail__user__position_applied',
            'employee__dept_designation__department',
            'employee__dept_designation__designation',
            'entry_gate', 'exit_gate'
        )

        counts = {
            'all': 0,
            'employees_inside': 0,
            'visitors_inside': 0,
            'contract_labour_inside': 0,
            'vvip_inside': 0,
            'vehicles_inside': 0,
            'expected_visitors': 0,
            'pending_approvals': 0,
            'overstayed_visitors': 0,
        }

        all_items = []

        # Process Gate Entries
        for ge in gate_qs:
            cat_name = (ge.entry_tag.category.name if ge.entry_tag and ge.entry_tag.category else '').strip()
            subcat_name = (ge.entry_tag.subcategory.name if ge.entry_tag and ge.entry_tag.subcategory else '').strip()
            tag_type = (ge.entry_tag.tag_type if ge.entry_tag and ge.entry_tag.tag_type else '').strip()
            purpose = (ge.purpose_of_visit or '').strip()
            cat_color = ge.entry_tag.category.colour_code if ge.entry_tag and ge.entry_tag.category and ge.entry_tag.category.colour_code else '#2ece8a'
            combined_cat_text = f"{cat_name} {subcat_name} {tag_type} {purpose}".lower()

            is_inside = ge.exit_time is None
            is_emp = any(k in combined_cat_text for k in ['employee', 'staff'])
            is_labour = any(k in combined_cat_text for k in ['contract', 'labour', 'labor', 'contractor', 'worker'])
            is_vvip = any(k in combined_cat_text for k in ['vvip', 'vip', 'director'])

            is_overstayed = False
            if is_inside:
                if ge.expected_time_of_exit:
                    if ge.entry_time.date() < today or (ge.entry_time.date() == today and now.time() > ge.expected_time_of_exit):
                        is_overstayed = True
                elif ge.entry_time.date() < today:
                    is_overstayed = True

            is_pending = (ge.is_permission_required and ge.permission_status == 'pending') or (ge.verification_status == 'pending' and is_inside)

            matched_tabs = ['all']
            if is_inside:
                if is_emp:
                    matched_tabs.append('employees_inside')
                    counts['employees_inside'] += 1
                elif is_labour:
                    matched_tabs.append('contract_labour_inside')
                    counts['contract_labour_inside'] += 1
                elif is_vvip:
                    matched_tabs.append('vvip_inside')
                    counts['vvip_inside'] += 1
                else:
                    matched_tabs.append('visitors_inside')
                    counts['visitors_inside'] += 1

                if is_overstayed:
                    matched_tabs.append('overstayed_visitors')
                    counts['overstayed_visitors'] += 1

                if ge.vehicles.exists():
                    matched_tabs.append('vehicles_inside')
                    counts['vehicles_inside'] += ge.vehicles.count()

            if is_pending:
                matched_tabs.append('pending_approvals')
                counts['pending_approvals'] += 1

            counts['all'] += 1

            vehicle_numbers = [v.vehicle_number for v in ge.vehicles.all() if v.vehicle_number]
            # Real physical tag from Tag Master only
            tag_no = ge.generated_tag.tag_number if ge.generated_tag else None
            tag_color = ge.generated_tag.entry_tag.category.colour_code if (ge.generated_tag and ge.generated_tag.entry_tag and ge.generated_tag.entry_tag and ge.generated_tag.entry_tag.category) else None

            # Reallocation history
            realloc_list = []
            approved_reallocs = [r for r in ge.reallocations.all() if r.status != 'cancelled']
            approved_reallocs.sort(key=lambda r: r.created_at)
            first_realloc_time = approved_reallocs[0].created_at if approved_reallocs else None

            # Initial host and department
            initial_host = ge.employee
            initial_dept = ge.department
            if approved_reallocs and approved_reallocs[0].from_employee:
                initial_host = approved_reallocs[0].from_employee
            if approved_reallocs and approved_reallocs[0].from_department:
                initial_dept = approved_reallocs[0].from_department

            host_name = f"{initial_host.first_name} {initial_host.last_name}".strip() if initial_host else (initial_host.username if initial_host else '—')
            dept_name = initial_dept.name if initial_dept else '—'

            for idx, r in enumerate(approved_reallocs):
                r_in = r.created_at.isoformat() if r.created_at else None
                if idx + 1 < len(approved_reallocs):
                    r_out = approved_reallocs[idx + 1].created_at.isoformat() if approved_reallocs[idx + 1].created_at else None
                else:
                    r_out = ge.exit_time.isoformat() if ge.exit_time else (ge.movement_completed_at.isoformat() if ge.movement_completed_at else None)

                to_emp = f"{r.to_employee.first_name} {r.to_employee.last_name}".strip() if r.to_employee else (r.to_employee.username if r.to_employee else '—')
                from_emp = f"{r.from_employee.first_name} {r.from_employee.last_name}".strip() if r.from_employee else (r.from_employee.username if r.from_employee else '—')
                to_dept = r.to_department.name if r.to_department else '—'
                from_dept = r.from_department.name if r.from_department else '—'

                realloc_list.append({
                    'id': r.id,
                    'from_employee': from_emp,
                    'to_employee': to_emp,
                    'host_employee': to_emp,
                    'from_department': from_dept,
                    'to_department': to_dept,
                    'department': to_dept,
                    'in_time': r_in,
                    'out_time': r_out,
                    'status': r.status,
                    'reason': r.reason or r.response_notes or 'Department Handover',
                })

            visitor_name = ge.visitor.visitor_name if ge.visitor else 'Unknown Visitor'
            visitor_mobile = ge.visitor.mobile_no if ge.visitor else '—'
            company_name = ge.visitor.company_name if (ge.visitor and ge.visitor.company_name) else '—'

            status_display = 'Inside' if is_inside else 'Exited'
            if is_overstayed:
                status_display = 'Overstayed'
            elif is_pending:
                status_display = 'Pending Approval'

            category_display = cat_name or ('Employee' if is_emp else ('Contract Labour' if is_labour else ('VVIP' if is_vvip else 'Visitor')))

            all_items.append({
                'id': f"ge_{ge.id}",
                'raw_id': ge.id,
                'entry_type': 'visitor',
                'entry_code': f"GE-{ge.id:04d}",
                'pass_number': tag_no,
                'tag_number': tag_no,
                'tag_color': tag_color,
                'name': visitor_name,
                'mobile': visitor_mobile,
                'category': category_display,
                'category_color': cat_color,
                'company': company_name,
                'host_employee': host_name,
                'department': dept_name,
                'number_of_persons': ge.number_of_persons or 1,
                'vehicle_number': ', '.join(vehicle_numbers) if vehicle_numbers else '—',
                'entry_gate': ge.entry_gate.name if ge.entry_gate else 'Main Gate',
                'exit_gate': ge.exit_gate.name if ge.exit_gate else ('—' if is_inside else 'Main Gate'),
                'entry_time': ge.entry_time.isoformat() if ge.entry_time else None,
                'exit_time': ge.exit_time.isoformat() if ge.exit_time else None,
                'initial_out_time': first_realloc_time.isoformat() if first_realloc_time else None,
                'expected_exit_time': str(ge.expected_time_of_exit) if ge.expected_time_of_exit else None,
                'status': status_display,
                'purpose': purpose or ge.narration or 'General Visit',
                'reallocations': realloc_list,
                'matched_tabs': matched_tabs,
            })

        # Process Vehicle Entries
        for ve in veh_qs:
            is_inside = ve.exit_time is None
            is_overstayed = False
            if is_inside:
                if ve.expected_time_of_exit:
                    if ve.entry_time.date() < today or (ve.entry_time.date() == today and now.time() > ve.expected_time_of_exit):
                        is_overstayed = True
                elif ve.entry_time.date() < today:
                    is_overstayed = True

            is_pending = ve.verification_status == 'pending'

            matched_tabs = ['all']
            if is_inside:
                matched_tabs.append('vehicles_inside')
                counts['vehicles_inside'] += max(ve.vehicles.count(), 1)
                if is_overstayed:
                    matched_tabs.append('overstayed_visitors')
                    counts['overstayed_visitors'] += 1

            if is_pending:
                matched_tabs.append('pending_approvals')
                counts['pending_approvals'] += 1

            counts['all'] += 1

            v_nums = [v.vehicle_number for v in ve.vehicles.all() if v.vehicle_number]
            # Real physical tag from Tag Master only
            tag_no = ve.vehicle_pass.tag_number if ve.vehicle_pass else None
            tag_color = ve.vehicle_pass.entry_tag.category.colour_code if (ve.vehicle_pass and ve.vehicle_pass.entry_tag and ve.vehicle_pass.entry_tag.category) else None
            
            # Reallocations for vehicle entry
            veh_realloc_list = []
            veh_approved_reallocs = [r for r in ve.reallocations.all() if r.status != 'cancelled']
            veh_approved_reallocs.sort(key=lambda r: r.created_at)
            veh_first_realloc_time = veh_approved_reallocs[0].created_at if veh_approved_reallocs else None

            veh_initial_host = ve.employee
            veh_initial_dept = ve.department
            if veh_approved_reallocs and veh_approved_reallocs[0].from_employee:
                veh_initial_host = veh_approved_reallocs[0].from_employee
            if veh_approved_reallocs and veh_approved_reallocs[0].from_department:
                veh_initial_dept = veh_approved_reallocs[0].from_department

            veh_host_name = f"{veh_initial_host.first_name} {veh_initial_host.last_name}".strip() if veh_initial_host else (veh_initial_host.username if veh_initial_host else '—')
            veh_dept_name = veh_initial_dept.name if veh_initial_dept else '—'

            for idx, r in enumerate(veh_approved_reallocs):
                r_in = r.created_at.isoformat() if r.created_at else None
                if idx + 1 < len(veh_approved_reallocs):
                    r_out = veh_approved_reallocs[idx + 1].created_at.isoformat() if veh_approved_reallocs[idx + 1].created_at else None
                else:
                    r_out = ve.exit_time.isoformat() if ve.exit_time else (ve.movement_completed_at.isoformat() if ve.movement_completed_at else None)

                to_emp = f"{r.to_employee.first_name} {r.to_employee.last_name}".strip() if r.to_employee else (r.to_employee.username if r.to_employee else '—')
                from_emp = f"{r.from_employee.first_name} {r.from_employee.last_name}".strip() if r.from_employee else (r.from_employee.username if r.from_employee else '—')
                to_dept = r.to_department.name if r.to_department else '—'
                from_dept = r.from_department.name if r.from_department else '—'

                veh_realloc_list.append({
                    'id': r.id,
                    'from_employee': from_emp,
                    'to_employee': to_emp,
                    'host_employee': to_emp,
                    'from_department': from_dept,
                    'to_department': to_dept,
                    'department': to_dept,
                    'in_time': r_in,
                    'out_time': r_out,
                    'status': r.status,
                    'reason': r.reason or r.response_notes or 'Department Handover',
                })

            status_display = 'Inside' if is_inside else 'Exited'
            if is_overstayed:
                status_display = 'Overstayed'
            elif is_pending:
                status_display = 'Pending Approval'

            first_v = ve.vehicles.first()
            first_vtype = first_v.vehicle_type.name if (first_v and first_v.vehicle_type) else None
            
            cat_display = 'Vehicle Entry'
            cat_color = '#3b82f6'
            entry_name = f"{ve.driver} (Driver)" if ve.driver else (ve.company or 'Commercial Vehicle')

            if first_vtype == 'Owner Vehicle':
                cat_display = 'Owner Vehicle'
                cat_color = '#d97706'
                entry_name = f"Owner ({', '.join(v_nums) if v_nums else 'Vehicle'})"
            elif first_vtype == 'Company Vehicle':
                cat_display = 'Company Vehicle'
                cat_color = '#0891b2'
                entry_name = f"Company ({ve.driver or (', '.join(v_nums) if v_nums else 'Fleet')})"
            elif first_vtype:
                cat_display = first_vtype

            all_items.append({
                'id': f"ve_{ve.id}",
                'raw_id': ve.id,
                'entry_type': 'vehicle',
                'entry_code': f"VE-{ve.id:04d}",
                'pass_number': tag_no,
                'tag_number': tag_no,
                'tag_color': tag_color,
                'name': entry_name,
                'mobile': '—',
                'category': cat_display,
                'category_color': cat_color,
                'company': ve.company or '—',
                'host_employee': veh_host_name,
                'department': veh_dept_name,
                'number_of_persons': ve.number_of_persons or 1,
                'vehicle_number': ', '.join(v_nums) if v_nums else '—',
                'entry_gate': ve.entry_gate.name if ve.entry_gate else 'Vehicle Gate',
                'exit_gate': ve.exit_gate.name if ve.exit_gate else ('—' if is_inside else 'Vehicle Gate'),
                'entry_time': ve.entry_time.isoformat() if ve.entry_time else None,
                'exit_time': ve.exit_time.isoformat() if ve.exit_time else None,
                'initial_out_time': veh_first_realloc_time.isoformat() if veh_first_realloc_time else None,
                'expected_exit_time': str(ve.expected_time_of_exit) if ve.expected_time_of_exit else None,
                'status': status_display,
                'purpose': ve.purpose or ve.material_details or 'Transport / Delivery',
                'reallocations': veh_realloc_list,
                'matched_tabs': matched_tabs,
            })

        # Process Appointments (Expected Visitors & Pending Approvals)
        for ap in app_qs:
            has_entered = hasattr(ap, 'gate_entry') and ap.gate_entry is not None
            is_expected = not has_entered and ap.appointment_date >= today and ap.status in ['approved', 'pending']
            is_pending = ap.status == 'pending'

            matched_tabs = []
            if is_expected:
                matched_tabs.append('expected_visitors')
                counts['expected_visitors'] += 1

            if is_pending:
                matched_tabs.append('pending_approvals')
                counts['pending_approvals'] += 1

            if matched_tabs:
                matched_tabs.append('all')
                counts['all'] += 1
                v_name = ap.visitor_name or (ap.visitor.visitor_name if ap.visitor else (ap.vehicle_number or 'Scheduled Visitor'))
                v_phone = ap.visitor_phone or (ap.visitor.mobile_no if ap.visitor else (ap.contact_number or '—'))
                host_name = f"{ap.concerned_staff.first_name} {ap.concerned_staff.last_name}".strip() if ap.concerned_staff else (ap.concerned_staff.username if ap.concerned_staff else '—')
                cat_name = ap.visitor_category.name if ap.visitor_category else 'Appointment'
                cat_color = ap.visitor_category.colour_code if ap.visitor_category and ap.visitor_category.colour_code else '#8b5cf6'

                entry_dt_str = f"{ap.appointment_date}T{ap.appointment_time}" if ap.appointment_date and ap.appointment_time else None

                all_items.append({
                    'id': f"app_{ap.id}",
                    'raw_id': ap.id,
                    'entry_type': 'appointment',
                    'entry_code': f"APT-{ap.id:04d}",
                    'pass_number': None,
                    'tag_number': None,
                    'tag_color': None,
                    'name': v_name,
                    'mobile': v_phone,
                    'category': cat_name,
                    'category_color': cat_color,
                    'company': ap.visitor.company_name if (ap.visitor and ap.visitor.company_name) else '—',
                    'host_employee': host_name,
                    'department': ap.department.name if ap.department else '—',
                    'vehicle_number': ap.vehicle_number or (ap.vehicle.vehicle_number if ap.vehicle else '—'),
                    'entry_gate': '—',
                    'exit_gate': '—',
                    'entry_time': entry_dt_str,
                    'exit_time': None,
                    'expected_exit_time': None,
                    'status': 'Expected' if is_expected else f"Appt ({ap.status.title()})",
                    'purpose': ap.purpose_of_visit or 'Scheduled Appointment',
                    'number_of_persons': 1,
                    'reallocations': [],
                    'matched_tabs': matched_tabs,
                })

        # Process Employee Gate Entries
        for ege in emp_qs:
            is_inside = ege.exit_time is None and ege.status == 'inside'
            matched_tabs = ['all']
            if is_inside:
                matched_tabs.append('employees_inside')
                counts['employees_inside'] += 1

            counts['all'] += 1

            candidate = ege.employment_detail.user if ege.employment_detail else None
            emp_profile = ege.employee
            emp_name = candidate.full_name if candidate else (emp_profile.full_name if emp_profile else "Unknown Employee")
            emp_mobile = (emp_profile.phone if emp_profile else None) or (candidate.mobile_number if candidate else "—")
            
            dept_name = "—"
            if emp_profile and emp_profile.dept_designation and emp_profile.dept_designation.department:
                dept_name = emp_profile.dept_designation.department.name
            elif candidate and candidate.department_applied:
                dept_name = candidate.department_applied.name

            all_items.append({
                'id': f"emp_{ege.id}",
                'raw_id': ege.id,
                'entry_type': 'employee',
                'entry_code': f"EMP-{ege.id:04d}",
                'pass_number': ege.employment_detail.employment_no if ege.employment_detail else None,
                'tag_number': ege.employment_detail.employment_no if ege.employment_detail else None,
                'tag_color': '#10b981',
                'name': emp_name,
                'mobile': emp_mobile,
                'category': 'Employee',
                'category_color': '#10b981',
                'company': ege.employment_detail.office_location if (ege.employment_detail and ege.employment_detail.office_location) else 'Internal Staff',
                'host_employee': '— (Staff Member)',
                'department': dept_name,
                'number_of_persons': 1,
                'vehicle_number': '—',
                'entry_gate': ege.entry_gate.name if ege.entry_gate else 'Main Gate',
                'exit_gate': ege.exit_gate.name if ege.exit_gate else ('—' if is_inside else 'Main Gate'),
                'entry_time': ege.entry_time.isoformat() if ege.entry_time else None,
                'exit_time': ege.exit_time.isoformat() if ege.exit_time else None,
                'expected_exit_time': None,
                'status': 'Inside' if is_inside else 'Exited',
                'purpose': ege.remarks or 'Company Duty / Shift',
                'reallocations': [],
                'matched_tabs': matched_tabs,
            })

        # Sort all items by entry_time descending
        all_items.sort(key=lambda x: str(x.get('entry_time') or ''), reverse=True)

        # Apply filtering if requested via params
        filtered_items = all_items

        if tab_param and tab_param != 'all':
            filtered_items = [it for it in filtered_items if tab_param in it.get('matched_tabs', [])]

        if filter_start or filter_end:
            def matches_date(item):
                et = item.get('entry_time')
                if not et:
                    return False
                try:
                    item_d = datetime.fromisoformat(et).date()
                    if filter_start and item_d < filter_start:
                        return False
                    if filter_end and item_d > filter_end:
                        return False
                    return True
                except Exception:
                    return True
            filtered_items = [it for it in filtered_items if matches_date(it)]

        if search_param:
            filtered_items = [
                it for it in filtered_items
                if search_param in str(it.get('name') or '').lower()
                or search_param in str(it.get('mobile') or '').lower()
                or search_param in str(it.get('pass_number') or '').lower()
                or search_param in str(it.get('vehicle_number') or '').lower()
                or search_param in str(it.get('company') or '').lower()
                or search_param in str(it.get('host_employee') or '').lower()
                or search_param in str(it.get('purpose') or '').lower()
                or search_param in str(it.get('category') or '').lower()
            ]

        return Response({
            'counts': counts,
            'results': filtered_items,
            'all_results': all_items,
        })


class GateEntryReallocationViewSet(viewsets.ModelViewSet):
    queryset = GateEntryReallocation.objects.all().select_related(
        'from_employee', 'to_employee', 'from_department', 'to_department',
        'gate_entry__visitor', 'gate_entry__entry_tag', 'gate_entry__generated_tag',
        'vehicle_entry__vehicle_pass'
    )
    serializer_class = GateEntryReallocationSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def my_pending_reallocations(self, request):
        """
        List pending reallocation requests directed to the logged-in user.
        Excludes visits that have already exited or completed movement.
        """
        from django.db.models import Q
        user = request.user
        qs = GateEntryReallocation.objects.filter(
            to_employee=user,
            status='pending'
        ).filter(
            Q(gate_entry__isnull=True) | Q(gate_entry__exit_time__isnull=True, gate_entry__movement_completed_at__isnull=True),
            Q(vehicle_entry__isnull=True) | Q(vehicle_entry__exit_time__isnull=True, vehicle_entry__movement_completed_at__isnull=True)
        ).select_related(
            'from_employee', 'to_employee', 'from_department', 'to_department',
            'gate_entry__visitor', 'gate_entry__generated_tag', 'vehicle_entry'
        ).order_by('-created_at')

        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_sent_reallocations(self, request):
        """
        List pending reallocation requests sent by the logged-in user.
        """
        user = request.user
        qs = GateEntryReallocation.objects.filter(
            from_employee=user,
            status='pending'
        ).select_related(
            'from_employee', 'to_employee', 'from_department', 'to_department',
            'gate_entry__visitor', 'gate_entry__generated_tag', 'vehicle_entry'
        ).order_by('-created_at')

        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def respond(self, request, pk=None):
        """
        Approve or reject a reallocation request.
        Only the recipient (to_employee) or superuser/staff can respond.
        """
        from django.utils import timezone
        realloc = self.get_object()

        if realloc.status != 'pending':
            return Response(
                {"detail": f"This reallocation request has already been {realloc.status}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check permissions: only to_employee or superuser/staff
        if request.user != realloc.to_employee and not (request.user.is_superuser or request.user.is_staff):
            return Response(
                {"detail": "Only the designated recipient employee can approve or reject this reallocation."},
                status=status.HTTP_403_FORBIDDEN
            )

        action_type = request.data.get('action', '').lower().strip()
        notes = request.data.get('notes', '').strip()

        if action_type not in ['approve', 'reject']:
            return Response(
                {"detail": "Invalid action. Must be 'approve' or 'reject'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if action_type == 'approve':
            realloc.status = 'approved'
            realloc.responded_at = timezone.now()
            realloc.response_notes = notes
            realloc.save()

            # Transfer visitor / vehicle to new host
            if realloc.gate_entry:
                gate_entry = realloc.gate_entry
                gate_entry.employee = realloc.to_employee
                if realloc.to_department:
                    gate_entry.department = realloc.to_department
                gate_entry.verification_status = 'reassigned'
                gate_entry.save(update_fields=['employee', 'department', 'verification_status'])

            if realloc.vehicle_entry:
                veh_entry = realloc.vehicle_entry
                veh_entry.employee = realloc.to_employee
                if realloc.to_department:
                    veh_entry.department = realloc.to_department
                veh_entry.verification_status = 'reassigned'
                veh_entry.save(update_fields=['employee', 'department', 'verification_status'])

            to_name = realloc.to_employee.get_full_name() or realloc.to_employee.username
            return Response({
                "detail": f"Reallocation approved. {to_name} is now the responsible host.",
                "status": "approved",
                "reallocation": self.get_serializer(realloc).data
            })

        else: # reject
            realloc.status = 'rejected'
            realloc.responded_at = timezone.now()
            realloc.response_notes = notes
            realloc.save()

            # Visitor remains with the current host (from_employee)
            from_name = (
                realloc.from_employee.get_full_name() or realloc.from_employee.username
                if realloc.from_employee else "the current host"
            )
            return Response({
                "detail": f"Reallocation rejected. The visitor remains {from_name}'s responsibility.",
                "status": "rejected",
                "reallocation": self.get_serializer(realloc).data
            })

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """
        Cancel a pending reallocation request.
        Only the sender (from_employee / reallocated_by) or superuser/staff can cancel.
        """
        realloc = self.get_object()
        if realloc.status != 'pending':
            return Response(
                {"detail": f"Cannot cancel a request that is already {realloc.status}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if request.user != realloc.from_employee and request.user != realloc.reallocated_by and not (request.user.is_superuser or request.user.is_staff):
            return Response(
                {"detail": "Only the host who initiated the reallocation can cancel it."},
                status=status.HTTP_403_FORBIDDEN
            )

        realloc.status = 'cancelled'
        realloc.response_notes = request.data.get('notes', 'Cancelled by host.').strip()
        realloc.save(update_fields=['status', 'response_notes'])

        return Response({
            "detail": "Reallocation request cancelled. Visitor remains under your management.",
            "status": "cancelled"
        })


class VehicleTypeViewSet(viewsets.ModelViewSet):
    queryset = VehicleType.objects.all()
    serializer_class = VehicleTypeSerializer
    permission_classes = [module_permission('gates')]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer
    permission_classes = [module_permission('gates')]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['vehicle_type', 'employee', 'is_preferred']
    search_fields = ['vehicle_number', 'company', 'driver']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def search_by_number(self, request):
        vehicle_number = request.query_params.get('vehicle_number', None)
        if vehicle_number is not None:
            vehicles = Vehicle.objects.filter(vehicle_number__icontains=vehicle_number)
            if vehicles.exists():
                serializer = self.get_serializer(vehicles, many=True)
                return Response(serializer.data)
            return Response({"detail": "Vehicle not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"detail": "Vehicle number is required"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='set-preferred')
    def set_preferred(self, request, pk=None):
        vehicle = self.get_object()
        if not vehicle.employee:
            emp_id = request.data.get('employee_id') or request.data.get('employee')
            if emp_id:
                from rarenett_app.models import Employee
                emp = Employee.objects.filter(id=emp_id).first()
                if emp:
                    vehicle.employee = emp
            else:
                return Response(
                    {"error": "Vehicle is not linked to any employee."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        vehicle.is_preferred = True
        vehicle.save()
        return Response({
            "success": True,
            "message": f"Vehicle {vehicle.vehicle_number} is now marked as preferred.",
            "vehicle": self.get_serializer(vehicle).data
        })

    @action(detail=False, methods=['get'], url_path='employee-directory')
    def employee_directory(self, request):
        from rarenett_app.models import Employee
        from .models import EmployeeGateEntry

        employees = Employee.objects.select_related(
            'user', 'candidate',
            'dept_designation__department',
            'dept_designation__designation'
        ).prefetch_related('vehicles__vehicle_type').order_by('id')

        dept_id = request.query_params.get('department')
        if dept_id:
            employees = employees.filter(dept_designation__department_id=dept_id)

        search = request.query_params.get('search', '').strip().lower()

        # Active inside entries map: employee_id -> latest active EmployeeGateEntry
        active_entries_map = {}
        for ee in EmployeeGateEntry.objects.filter(status='inside').select_related('vehicle'):
            if ee.employee_id:
                active_entries_map[ee.employee_id] = ee

        results = []
        for emp in employees:
            ed = None
            if emp.candidate and hasattr(emp.candidate, 'employment_details'):
                ed = emp.candidate.employment_details.first()
            emp_no = (ed.employment_no if ed else None) or f"EMP{emp.id:03d}"

            emp_name = ""
            if emp.candidate and emp.candidate.full_name:
                emp_name = emp.candidate.full_name
            elif emp.user:
                emp_name = emp.user.get_full_name() or emp.user.username
            else:
                emp_name = f"Employee {emp_no}"

            dept_name = "—"
            if emp.dept_designation and emp.dept_designation.department:
                dept_name = emp.dept_designation.department.name
            elif emp.candidate and emp.candidate.department_applied:
                dept_name = emp.candidate.department_applied.name

            desig_name = "—"
            if emp.dept_designation and emp.dept_designation.designation:
                desig_name = emp.dept_designation.designation.name
            elif emp.candidate and emp.candidate.position_applied:
                desig_name = emp.candidate.position_applied.name

            vehicles_data = []
            pref_vehicle_data = None
            for v in emp.vehicles.all():
                v_dict = {
                    "id": v.id,
                    "vehicle_number": v.vehicle_number,
                    "vehicle_type": v.vehicle_type.id if v.vehicle_type else None,
                    "vehicle_type_name": v.vehicle_type.name if v.vehicle_type else "Vehicle",
                    "is_preferred": v.is_preferred,
                    "vehicle_photo": request.build_absolute_uri(v.vehicle_photo.url) if v.vehicle_photo else None,
                    "company": v.company or "",
                    "driver": v.driver or ""
                }
                vehicles_data.append(v_dict)
                if v.is_preferred:
                    pref_vehicle_data = v_dict

            if not pref_vehicle_data and vehicles_data:
                pref_vehicle_data = vehicles_data[0]

            photo_url = None
            photo_obj = emp.profile_picture or (emp.candidate.photo if emp.candidate else None)
            if photo_obj:
                try:
                    url = photo_obj.url
                    photo_url = request.build_absolute_uri(url) if not url.startswith('http') else url
                except Exception:
                    pass

            active_ee = active_entries_map.get(emp.id)

            item = {
                "id": emp.id,
                "employment_no": emp_no,
                "name": emp_name,
                "department": dept_name,
                "department_id": emp.dept_designation.department_id if (emp.dept_designation and emp.dept_designation.department) else None,
                "designation": desig_name,
                "phone": emp.phone or (emp.candidate.mobile_number if emp.candidate else "—"),
                "email": emp.email or (emp.candidate.email if emp.candidate else "—"),
                "photo": photo_url,
                "is_inside": active_ee is not None,
                "active_entry_id": active_ee.id if active_ee else None,
                "active_vehicle_number": active_ee.vehicle.vehicle_number if (active_ee and active_ee.vehicle) else None,
                "preferred_vehicle": pref_vehicle_data,
                "vehicles": vehicles_data,
                "total_vehicles": len(vehicles_data)
            }

            if search:
                matched = (
                    search in emp_name.lower() or
                    search in emp_no.lower() or
                    search in dept_name.lower() or
                    any(search in v['vehicle_number'].lower() for v in vehicles_data)
                )
                if not matched:
                    continue

            results.append(item)

        return Response(results)


class VehicleEntryViewSet(viewsets.ModelViewSet):
    queryset = VehicleEntry.objects.all().order_by('-entry_time')
    serializer_class = VehicleEntrySerializer
    permission_classes = [module_permission('gates')]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'entry_gate', 'exit_gate']
    search_fields = ['vehicles__vehicle_number', 'driver', 'company']

    def get_queryset(self):
        qs = super().get_queryset()
        params = getattr(self.request, 'query_params', getattr(self.request, 'GET', {}))
        vehicle_id = params.get('vehicle') or params.get('vehicles')
        if vehicle_id:
            qs = qs.filter(vehicles__id=vehicle_id)
        vehicle_type = params.get('vehicle__vehicle_type') or params.get('vehicles__vehicle_type')
        if vehicle_type:
            qs = qs.filter(vehicles__vehicle_type=vehicle_type)
        return qs

    def list(self, request, *args, **kwargs):
        sync_active_parking_allocations()
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        num_persons = serializer.validated_data.get('number_of_persons', 1)
        vehicle_entry = serializer.save(
            created_by=self.request.user,
            persons_inside=num_persons
        )
        if vehicle_entry.vehicle_pass:
            tag = vehicle_entry.vehicle_pass
            tag.status = 'Unavailable'
            tag.save()

        # Automatically assign park_area based on vehicle type for Owner, Company, Employee vehicles
        if not vehicle_entry.park_area and vehicle_entry.vehicles.exists():
            first_v = vehicle_entry.vehicles.first()
            if first_v and first_v.vehicle_type:
                auto_area = resolve_park_area_for_vehicle_type(first_v.vehicle_type.name)
                if auto_area:
                    vehicle_entry.park_area = auto_area
                    vehicle_entry.save(update_fields=['park_area'])

        # Allocate and mark parking slot as Occupied if assigned
        if vehicle_entry.park_area and not vehicle_entry.parking_slot:
            allocate_parking_slot_for_entry(vehicle_entry, vehicle_entry.park_area)
        elif vehicle_entry.parking_slot:
            vehicle_entry.parking_slot.status = 'Occupied'
            vehicle_entry.parking_slot.save(update_fields=['status'])

        # Handle multiple uploaded supporting documents
        from .models import ExitCard, VehicleEntryDocument
        doc_files = list(self.request.FILES.getlist('document_photos')) + list(self.request.FILES.getlist('document_photo'))
        for key in self.request.FILES:
            if key.startswith('document_photo_') or key.startswith('document_'):
                for f in self.request.FILES.getlist(key):
                    if f not in doc_files:
                        doc_files.append(f)

        for f in doc_files:
            VehicleEntryDocument.objects.create(vehicle_entry=vehicle_entry, document_photo=f)

        if doc_files and not vehicle_entry.document_photo:
            vehicle_entry.document_photo = doc_files[0]
            vehicle_entry.save(update_fields=['document_photo'])

        if vehicle_entry.appointment:
            app = vehicle_entry.appointment
            app.status = 'completed'
            app.save(update_fields=['status'])

        # Synchronize EntryCard record for vehicle entry
        sync_entry_card_for_vehicle_entry(vehicle_entry)

    def perform_update(self, serializer):
        old_instance = self.get_object()
        old_tag = old_instance.vehicle_pass
        old_num = old_instance.number_of_persons
        vehicle_entry = serializer.save()

        # Release old tag if changed or removed
        if old_tag and old_tag != vehicle_entry.vehicle_pass:
            old_tag.status = 'Available'
            old_tag.save()
        if vehicle_entry.vehicle_pass and vehicle_entry.vehicle_pass != old_tag:
            vehicle_entry.vehicle_pass.status = 'Unavailable'
            vehicle_entry.vehicle_pass.save()

        # Handle parking slot status on update
        old_veh_slot = old_instance.parking_slot
        if old_veh_slot and old_veh_slot != vehicle_entry.parking_slot:
            old_veh_slot.status = 'Available'
            old_veh_slot.save(update_fields=['status'])
        if vehicle_entry.parking_slot:
            vehicle_entry.parking_slot.status = 'Occupied'
            vehicle_entry.parking_slot.save(update_fields=['status'])

        sync_entry_card_for_vehicle_entry(vehicle_entry)

        # Keep persons_inside in sync if not partially exited or if changed
        if not vehicle_entry.partial_exit_logs or vehicle_entry.persons_inside is None:
            vehicle_entry.persons_inside = vehicle_entry.number_of_persons or 1
            vehicle_entry.save(update_fields=['persons_inside'])
        elif vehicle_entry.number_of_persons != old_num:
            diff = (vehicle_entry.number_of_persons or 1) - (old_num or 1)
            vehicle_entry.persons_inside = max(0, (vehicle_entry.persons_inside or 0) + diff)
            vehicle_entry.save(update_fields=['persons_inside'])

        if vehicle_entry.exit_time and vehicle_entry.vehicle_pass:
            tag = vehicle_entry.vehicle_pass
            tag.status = 'Available'
            tag.save()

    @action(detail=True, methods=['post'])
    def mark_exit(self, request, pk=None):
        from django.utils import timezone
        vehicle_entry = self.get_object()
        if vehicle_entry.exit_time:
            return Response({"detail": "Vehicle has already fully exited."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Block checkout if vehicle has an assigned host employee or appointment and movement is not completed
        has_host = bool(vehicle_entry.employee or vehicle_entry.appointment)
        if has_host and vehicle_entry.verification_status != 'completed' and not vehicle_entry.movement_completed_at:
            official_name = ""
            if vehicle_entry.employee:
                official_name = f" ({vehicle_entry.employee.get_full_name() or vehicle_entry.employee.username})"
            return Response(
                {"detail": f"Cannot check out: The host employee{official_name} must complete the vehicle's campus movement first."},
                status=status.HTTP_400_BAD_REQUEST
            )

        is_partial = request.data.get('is_partial', False)
        
        # Ensure persons_inside is initialized
        if vehicle_entry.persons_inside is None:
            vehicle_entry.persons_inside = vehicle_entry.number_of_persons or 1

        if is_partial:
            is_vehicle_only = request.data.get('is_vehicle_only', False)
            try:
                exiting_count = int(request.data.get('exiting_count', 0 if is_vehicle_only else 1))
            except (ValueError, TypeError):
                exiting_count = 0 if is_vehicle_only else 1

            if is_vehicle_only or exiting_count == 0:
                is_vehicle_only = True
                exiting_count = 0
                vehicle_number = request.data.get('vehicle_number', '').strip()
                vehicle_numbers = request.data.get('vehicle_numbers', [])
                if not vehicle_numbers and vehicle_number:
                    vehicle_numbers = [v.strip() for v in vehicle_number.split(',') if v.strip()]
                if not vehicle_number and not vehicle_numbers:
                    return Response({"detail": "Please specify at least one vehicle number for vehicle-only exit."}, status=status.HTTP_400_BAD_REQUEST)
                if vehicle_entry.persons_inside == 0:
                    is_partial = False
            else:
                if exiting_count <= 0:
                    return Response({"detail": "Exiting count must be at least 1."}, status=status.HTTP_400_BAD_REQUEST)

                if exiting_count >= vehicle_entry.persons_inside:
                    return Response({
                        "detail": f"For partial exit, exiting count must be less than current persons inside ({vehicle_entry.persons_inside}). Choose full exit to check out all persons."
                    }, status=status.HTTP_400_BAD_REQUEST)

                vehicle_entry.persons_inside = vehicle_entry.persons_inside - exiting_count
            vehicle_number = request.data.get('vehicle_number', '').strip()
            vehicle_numbers = request.data.get('vehicle_numbers', [])
            if not vehicle_numbers and vehicle_number:
                vehicle_numbers = [v.strip() for v in vehicle_number.split(',') if v.strip()]
            
            # Record in partial_exit_logs
            recorder_name = f"{request.user.first_name} {request.user.last_name}".strip() if request.user.is_authenticated else "Gate Security"
            exit_gate_val = request.data.get('exit_gate')
            exit_gate_name = None
            if exit_gate_val:
                try:
                    eg_obj = Gate.objects.get(id=exit_gate_val)
                    vehicle_entry.exit_gate = eg_obj
                    exit_gate_name = eg_obj.name
                except (Gate.DoesNotExist, ValueError):
                    pass
            elif vehicle_entry.exit_gate:
                exit_gate_name = vehicle_entry.exit_gate.name
            elif vehicle_entry.entry_gate:
                exit_gate_name = vehicle_entry.entry_gate.name

            log_item = {
                "exited_count": exiting_count,
                "vehicle_number": vehicle_number,
                "vehicle_numbers": vehicle_numbers,
                "remaining_count": vehicle_entry.persons_inside,
                "timestamp": timezone.now().isoformat(),
                "notes": request.data.get('notes', ''),
                "recorded_by": recorder_name,
                "exit_gate": exit_gate_name
            }
            if vehicle_entry.partial_exit_logs is None:
                vehicle_entry.partial_exit_logs = []
            vehicle_entry.partial_exit_logs.append(log_item)
            vehicle_entry.save()

            return Response(self.get_serializer(vehicle_entry).data)

        # Full Exit
        exit_gate_val = request.data.get('exit_gate')
        if exit_gate_val:
            try:
                vehicle_entry.exit_gate = Gate.objects.get(id=exit_gate_val)
            except (Gate.DoesNotExist, ValueError):
                pass
        elif not vehicle_entry.exit_gate and vehicle_entry.entry_gate:
            vehicle_entry.exit_gate = vehicle_entry.entry_gate

        vehicle_entry.exit_time = timezone.now()
        vehicle_entry.persons_inside = 0
        vehicle_entry.status = 'completed'
        vehicle_entry.verification_status = 'completed'

        checkout_purpose = request.data.get('checkout_purpose')
        if checkout_purpose:
            vehicle_entry.checkout_purpose = checkout_purpose.strip().lower()

        purpose_note = request.data.get('purpose_note')
        if purpose_note:
            vehicle_entry.purpose_note = purpose_note.strip()
            if not vehicle_entry.movement_notes:
                vehicle_entry.movement_notes = purpose_note.strip()

        delivery_note_number = request.data.get('delivery_note_number')
        if delivery_note_number:
            vehicle_entry.delivery_note_number = delivery_note_number.strip()
            dn_note = f"Delivery Note #{delivery_note_number.strip()}"
            if vehicle_entry.material_details:
                vehicle_entry.material_details = f"{vehicle_entry.material_details} | {dn_note}"
            else:
                vehicle_entry.material_details = dn_note

        delivery_note_photo = request.FILES.get('delivery_note_photo')
        if not delivery_note_photo and 'delivery_note_photo' in request.data:
            val = request.data.get('delivery_note_photo')
            if hasattr(val, 'read'):
                delivery_note_photo = val
        if delivery_note_photo:
            vehicle_entry.delivery_note_photo = delivery_note_photo

        if vehicle_entry.partial_exit_logs and len(vehicle_entry.partial_exit_logs) > 0:
            recorder_name = f"{request.user.first_name} {request.user.last_name}".strip() if request.user.is_authenticated else "Gate Security"
            exit_gate_name = vehicle_entry.exit_gate.name if vehicle_entry.exit_gate else None
            veh_num = request.data.get('vehicle_number', '') or (vehicle_entry.vehicles.first().vehicle_number if vehicle_entry.vehicles.exists() else '')
            veh_nums = request.data.get('vehicle_numbers', []) or ([v.vehicle_number for v in vehicle_entry.vehicles.all()] if vehicle_entry.vehicles.exists() else [])
            final_log_item = {
                "action": "full_checkout",
                "exited_count": vehicle_entry.persons_inside or 0,
                "vehicle_number": veh_num,
                "vehicle_numbers": veh_nums,
                "remaining_count": 0,
                "timestamp": vehicle_entry.exit_time.isoformat(),
                "notes": request.data.get('notes', '') or "Final vehicle entry checkout completed",
                "recorded_by": recorder_name,
                "exit_gate": exit_gate_name
            }
            vehicle_entry.partial_exit_logs.append(final_log_item)

        vehicle_entry.save()
        
        if vehicle_entry.vehicle_pass:
            tag = vehicle_entry.vehicle_pass
            tag.status = 'Available'
            tag.save()

        # Release parking slot back to Available
        release_parking_slot_for_entry(vehicle_entry)

        # Generate ExitCard record for vehicle entry
        sync_exit_card_for_vehicle_entry(vehicle_entry, exit_time=vehicle_entry.exit_time)
            
        return Response(self.get_serializer(vehicle_entry).data)

    @action(detail=True, methods=['post'])
    def reallocate(self, request, pk=None):
        """
        Reallocate a vehicle from current employee to a new employee.
        """
        from django.contrib.auth import get_user_model
        from rarenett_app.models import Department, Employee
        User = get_user_model()

        vehicle_entry = self.get_object()
        if vehicle_entry.exit_time:
            return Response(
                {"detail": "Cannot reallocate a vehicle that has already exited."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if vehicle_entry.verification_status == 'completed' or vehicle_entry.movement_completed_at:
            return Response(
                {"detail": "Cannot reallocate: Campus movement has already been completed."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if request.user.is_authenticated and not (request.user.is_superuser or request.user.is_staff):
            if vehicle_entry.employee_id and vehicle_entry.employee_id != request.user.id:
                host_name = (
                    f"{vehicle_entry.employee.first_name} {vehicle_entry.employee.last_name}".strip()
                    or vehicle_entry.employee.username
                    if vehicle_entry.employee else "the assigned employee"
                )
                return Response(
                    {"detail": f"Permission denied. Only the currently allocated employee ({host_name}) can reallocate this vehicle."},
                    status=status.HTTP_403_FORBIDDEN
                )

        to_employee_id = request.data.get('to_employee')
        if not to_employee_id:
            return Response(
                {"detail": "Target employee is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            to_employee = User.objects.get(id=to_employee_id)
        except User.DoesNotExist:
            return Response(
                {"detail": "Target employee not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        to_dept_id = request.data.get('to_department')
        to_department = None
        if to_dept_id:
            try:
                to_department = Department.objects.get(id=to_dept_id)
            except (Department.DoesNotExist, ValueError):
                to_department = None

        if not to_department:
            emp_profile = Employee.objects.filter(user=to_employee).first()
            if emp_profile and emp_profile.dept_designation and emp_profile.dept_designation.department:
                to_department = emp_profile.dept_designation.department

        reason = request.data.get('reason', '').strip()

        # Check if already a pending reallocation exists
        pending_realloc = vehicle_entry.reallocations.filter(status='pending').first()
        if pending_realloc:
            to_name = (
                f"{pending_realloc.to_employee.first_name} {pending_realloc.to_employee.last_name}".strip()
                if pending_realloc.to_employee else "another employee"
            )
            return Response(
                {"detail": f"A reallocation request to {to_name} is already pending approval."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if vehicle_entry.employee_id == to_employee.id:
            return Response(
                {"detail": "Cannot reallocate to the current host."},
                status=status.HTTP_400_BAD_REQUEST
            )

        realloc = GateEntryReallocation.objects.create(
            vehicle_entry=vehicle_entry,
            from_employee=vehicle_entry.employee,
            to_employee=to_employee,
            from_department=vehicle_entry.department,
            to_department=to_department or vehicle_entry.department,
            reason=reason,
            status='pending',
            reallocated_by=request.user if request.user.is_authenticated else None
        )

        serializer = self.get_serializer(vehicle_entry)
        to_name = f"{to_employee.first_name} {to_employee.last_name}".strip() or to_employee.username
        return Response({
            "detail": f"Reallocation request sent to {to_name}. Awaiting their approval.",
            "reallocation_id": realloc.id,
            "vehicle_entry": serializer.data
        })

    @action(detail=True, methods=['post'])
    def complete_movement(self, request, pk=None):
        """
        Mark vehicle's internal movement as completed by the host employee,
        releasing them to return to the gate for checkout.
        """
        from django.utils import timezone
        vehicle_entry = self.get_object()
        if vehicle_entry.exit_time:
            return Response(
                {"detail": "Vehicle has already exited."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if vehicle_entry.verification_status == 'completed' or vehicle_entry.movement_completed_at:
            return Response(
                {"detail": "Campus movement has already been completed for this vehicle."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if request.user.is_authenticated and not (request.user.is_superuser or request.user.is_staff):
            if vehicle_entry.employee_id and vehicle_entry.employee_id != request.user.id:
                host_name = (
                    f"{vehicle_entry.employee.first_name} {vehicle_entry.employee.last_name}".strip()
                    or vehicle_entry.employee.username
                    if vehicle_entry.employee else "the assigned employee"
                )
                return Response(
                    {"detail": f"Permission denied. Only the currently allocated employee ({host_name}) can complete this vehicle's movement."},
                    status=status.HTTP_403_FORBIDDEN
                )

        notes = request.data.get('notes', '').strip()

        # If any pending reallocation exists, cancel it because movement is concluded
        vehicle_entry.reallocations.filter(status='pending').update(
            status='cancelled',
            response_notes='Campus movement concluded by host employee.'
        )

        vehicle_entry.verification_status = 'completed'
        vehicle_entry.movement_completed_at = timezone.now()
        vehicle_entry.movement_completed_by = request.user if request.user.is_authenticated else None
        if notes:
            vehicle_entry.movement_notes = notes
        vehicle_entry.save(update_fields=['verification_status', 'movement_completed_at', 'movement_completed_by', 'movement_notes'])

        serializer = self.get_serializer(vehicle_entry)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def reallocation_history(self, request, pk=None):
        vehicle_entry = self.get_object()
        reallocations = vehicle_entry.reallocations.all()
        serializer = GateEntryReallocationSerializer(reallocations, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='fast-pass-scan', permission_classes=[permissions.IsAuthenticated])
    def fast_pass_scan(self, request):
        """
        Zero-form-filling instant Check-In / Check-Out for Owner and Company vehicles.
        Automatically auto-creates unsaved vehicles under the appropriate vehicle type.
        Toggles Check-In or Check-Out based on whether the vehicle is currently inside campus.
        """
        from django.utils import timezone
        raw_number = request.data.get('vehicle_number', '')
        if not raw_number or not str(raw_number).strip():
            return Response({"detail": "Vehicle number is required."}, status=status.HTTP_400_BAD_REQUEST)

        vehicle_num = str(raw_number).strip().upper()
        vehicle_num = " ".join(vehicle_num.split())
        
        vehicle_type_name = request.data.get('vehicle_type_name', 'Owner Vehicle').strip()
        if vehicle_type_name not in ['Owner Vehicle', 'Company Vehicle']:
            vehicle_type_name = 'Owner Vehicle'

        gate_id = request.data.get('gate_id')
        driver_name = request.data.get('driver_name', '').strip()
        force_action = request.data.get('force_action') # 'CHECK_IN', 'CHECK_OUT', or None

        # 1. Resolve VehicleType
        vtype, _ = VehicleType.objects.get_or_create(name=vehicle_type_name)

        # 2. Get or auto-create Vehicle (no master form needed!)
        vehicle = Vehicle.objects.filter(vehicle_number__iexact=vehicle_num).first()
        if not vehicle:
            vehicle = Vehicle.objects.create(
                vehicle_number=vehicle_num,
                vehicle_type=vtype,
                company="Company Fleet" if vehicle_type_name == "Company Vehicle" else "Executive / Owner",
                driver=driver_name or ("Fleet Driver" if vehicle_type_name == "Company Vehicle" else "Owner / Self"),
                created_by=request.user if request.user.is_authenticated else None
            )
        else:
            # Sync vehicle_type if scanning under Owner or Company
            if vehicle.vehicle_type != vtype:
                vehicle.vehicle_type = vtype
                vehicle.save(update_fields=['vehicle_type'])

        # 3. Resolve Gate
        gate_obj = None
        if gate_id:
            try:
                gate_obj = Gate.objects.get(id=gate_id)
            except (Gate.DoesNotExist, ValueError):
                gate_obj = Gate.objects.first()
        if not gate_obj:
            gate_obj = Gate.objects.first()

        # 4. Check for active inside entry
        active_entry = VehicleEntry.objects.filter(
            vehicles=vehicle,
            exit_time__isnull=True,
            status='pending'
        ).order_by('-entry_time').first()

        is_checking_out = (force_action == 'CHECK_OUT') or (active_entry is not None and force_action != 'CHECK_IN')

        if is_checking_out and active_entry:
            # CHECK OUT
            now = timezone.now()
            active_entry.exit_time = now
            if gate_obj:
                active_entry.exit_gate = gate_obj
            elif not active_entry.exit_gate and active_entry.entry_gate:
                active_entry.exit_gate = active_entry.entry_gate
            active_entry.status = 'completed'
            active_entry.verification_status = 'completed'
            active_entry.persons_inside = 0

            checkout_purpose = request.data.get('checkout_purpose')
            if checkout_purpose:
                active_entry.checkout_purpose = checkout_purpose.strip().lower()

            purpose_note = request.data.get('purpose_note')
            if purpose_note:
                active_entry.purpose_note = purpose_note.strip()
                if not active_entry.movement_notes:
                    active_entry.movement_notes = purpose_note.strip()

            delivery_note_number = request.data.get('delivery_note_number')
            if delivery_note_number:
                active_entry.delivery_note_number = delivery_note_number.strip()
                dn_note = f"Delivery Note #{delivery_note_number.strip()}"
                if active_entry.material_details:
                    active_entry.material_details = f"{active_entry.material_details} | {dn_note}"
                else:
                    active_entry.material_details = dn_note

            delivery_note_photo = request.FILES.get('delivery_note_photo')
            if delivery_note_photo:
                active_entry.delivery_note_photo = delivery_note_photo

            update_fields = ['exit_time', 'exit_gate', 'status', 'verification_status', 'persons_inside']
            if checkout_purpose:
                update_fields.append('checkout_purpose')
            if purpose_note:
                update_fields.extend(['purpose_note', 'movement_notes'])
            if delivery_note_number:
                update_fields.extend(['delivery_note_number', 'material_details'])
            if delivery_note_photo:
                update_fields.append('delivery_note_photo')

            active_entry.save(update_fields=update_fields)

            # Release parking slot back to Available
            release_parking_slot_for_entry(active_entry)
            xc = sync_exit_card_for_vehicle_entry(active_entry, exit_time=now)

            # Calculate stay duration
            duration_str = ""
            if active_entry.entry_time:
                delta = now - active_entry.entry_time
                total_mins = max(1, int(delta.total_seconds() // 60))
                hours = total_mins // 60
                mins = total_mins % 60
                if hours > 0:
                    duration_str = f"{hours} hr{'s' if hours > 1 else ''} {mins} min{'s' if mins != 1 else ''}"
                else:
                    duration_str = f"{mins} min{'s' if mins != 1 else ''}"

            entry_data = self.get_serializer(active_entry).data
            entry_data['stay_duration'] = duration_str

            checkout_msg = f"{vtype.name} {vehicle.vehicle_number} checked OUT successfully."
            if active_entry.delivery_note_number:
                checkout_msg = f"{vtype.name} {vehicle.vehicle_number} checked OUT (Delivery Note: #{active_entry.delivery_note_number})."
            elif active_entry.checkout_purpose == 'other':
                checkout_msg = f"{vtype.name} {vehicle.vehicle_number} checked OUT (Purpose: Other Purpose)."
            elif active_entry.checkout_purpose == 'servicing':
                checkout_msg = f"{vtype.name} {vehicle.vehicle_number} checked OUT for Servicing."

            return Response({
                "action": "CHECK_OUT",
                "message": checkout_msg,
                "stay_duration": duration_str,
                "vehicle_number": vehicle.vehicle_number,
                "vehicle_type": vtype.name,
                "checkout_purpose": active_entry.checkout_purpose,
                "purpose_note": active_entry.purpose_note,
                "delivery_note_number": active_entry.delivery_note_number,
                "exit_card": ExitCardSerializer(xc).data if xc else None,
                "entry": entry_data
            }, status=status.HTTP_200_OK)
        else:
            # CHECK IN
            designated_park_area = resolve_park_area_for_vehicle_type(vtype.name)
            new_entry = VehicleEntry.objects.create(
                entry_gate=gate_obj,
                status='pending',
                verification_status='completed',
                number_of_persons=1,
                persons_inside=1,
                purpose=f"{vtype.name} Movement",
                company="Company Fleet" if vehicle_type_name == "Company Vehicle" else "Executive / Owner",
                driver=driver_name or ("Fleet Driver" if vehicle_type_name == "Company Vehicle" else "Owner / Self"),
                park_area=designated_park_area,
                created_by=request.user if request.user.is_authenticated else None
            )
            new_entry.vehicles.add(vehicle)

            allocated_slot = None
            if designated_park_area:
                allocated_slot = allocate_parking_slot_for_entry(new_entry, park_area=designated_park_area)
            card = sync_entry_card_for_vehicle_entry(new_entry)

            entry_data = self.get_serializer(new_entry).data
            slot_msg = f" (Parking: {designated_park_area.name} - Slot #{allocated_slot.slot_number})" if (allocated_slot and designated_park_area) else ""
            return Response({
                "action": "CHECK_IN",
                "message": f"{vtype.name} {vehicle.vehicle_number} checked IN successfully{slot_msg}.",
                "vehicle_number": vehicle.vehicle_number,
                "vehicle_type": vtype.name,
                "entry_card": EntryCardSerializer(card).data if card else None,
                "entry": entry_data
            }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='fast-pass-status', permission_classes=[permissions.IsAuthenticated])
    def fast_pass_status(self, request):
        """
        Returns active owner and company vehicles inside campus and registered fleet vehicles
        for 1-click exit and quick-access chips.
        """
        from django.utils import timezone
        now = timezone.now()

        # Active inside entries for Owner, Company, and Employee Vehicles
        inside_entries = VehicleEntry.objects.filter(
            exit_time__isnull=True,
            status='pending',
            vehicles__vehicle_type__name__in=['Owner Vehicle', 'Company Vehicle', 'Employee Vehicle']
        ).distinct().order_by('-entry_time')[:50]

        inside_list = []
        for ve in inside_entries:
            first_v = ve.vehicles.first()
            if not first_v:
                continue
            vt_name = first_v.vehicle_type.name if first_v.vehicle_type else 'Owner Vehicle'
            
            # Duration inside
            duration_str = "Just now"
            if ve.entry_time:
                delta = now - ve.entry_time
                total_mins = max(1, int(delta.total_seconds() // 60))
                hours = total_mins // 60
                mins = total_mins % 60
                if hours > 0:
                    duration_str = f"{hours}h {mins}m"
                else:
                    duration_str = f"{mins}m"

            inside_list.append({
                'entry_id': ve.id,
                'vehicle_id': first_v.id,
                'vehicle_number': first_v.vehicle_number,
                'vehicle_type': vt_name,
                'driver': ve.driver or first_v.driver or '—',
                'company': ve.company or first_v.company or '—',
                'entry_gate_name': ve.entry_gate.name if ve.entry_gate else 'Gate 1',
                'entry_time': ve.entry_time.isoformat() if ve.entry_time else None,
                'time_inside': duration_str,
                'park_area_name': ve.park_area.name if ve.park_area else None,
                'parking_slot_number': ve.parking_slot.slot_number if ve.parking_slot else None,
                'parking_location_display': f"{ve.park_area.name} - Slot #{ve.parking_slot.slot_number}" if (ve.park_area and ve.parking_slot) else (ve.park_area.name if ve.park_area else None)
            })

        # Registered company vehicles for quick 1-click selection
        company_vehicles = Vehicle.objects.filter(
            vehicle_type__name='Company Vehicle'
        ).order_by('vehicle_number').values('id', 'vehicle_number', 'driver', 'company')[:30]

        # Recent owner vehicles for quick 1-click selection
        recent_owner_vehicles = Vehicle.objects.filter(
            vehicle_type__name='Owner Vehicle'
        ).order_by('-date').values('id', 'vehicle_number', 'driver', 'company')[:20]

        return Response({
            "inside_vehicles": inside_list,
            "company_vehicles": list(company_vehicles),
            "recent_owner_vehicles": list(recent_owner_vehicles)
        }, status=status.HTTP_200_OK)


class EmployeeGateEntryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing employee campus entry and exit logs.
    Supports barcode / employment_no scanning for zero-form-filling check-in / check-out.
    """
    queryset = EmployeeGateEntry.objects.all().select_related(
        'employment_detail__user', 'employee__dept_designation__department',
        'employee__dept_designation__designation', 'entry_gate', 'exit_gate', 'recorded_by'
    )
    serializer_class = EmployeeGateEntrySerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'entry_gate', 'exit_gate', 'employment_detail']
    search_fields = [
        'employment_detail__employment_no',
        'employment_detail__user__first_name',
        'employment_detail__user__last_name',
        'employee__user__first_name',
        'employee__user__last_name'
    ]
    ordering_fields = ['entry_time', 'exit_time']
    ordering = ['-entry_time']

    def list(self, request, *args, **kwargs):
        sync_active_parking_allocations()
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def lookup(self, request):
        """
        Fast lookup of employee details by employment_no.
        Returns basic info, current status (inside / outside), preferred vehicle, and active entry if any.
        """
        employment_no = request.query_params.get('employment_no', '').strip()
        if not employment_no:
            return Response({"error": "employment_no query parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        from rarenett_app.models import EmploymentDetails, Employee
        from django.db.models import Q
        from gate_app.models import Vehicle

        ed = EmploymentDetails.objects.filter(employment_no__iexact=employment_no).select_related(
            'user__position_applied', 'user__department_applied'
        ).first()

        candidate = ed.user if ed else None
        emp_profile = getattr(candidate, 'employee_profile', None) if candidate else None
        if not emp_profile and candidate:
            emp_profile = Employee.objects.filter(candidate=candidate).first()
        if not emp_profile and candidate and getattr(candidate, 'email', None):
            emp_profile = Employee.objects.filter(user__email=candidate.email).first()

        if not ed and not emp_profile:
            # Check by EMP ID (e.g. EMP006, EMP6, 6)
            clean_no = employment_no.strip()
            emp_id = None
            if clean_no.upper().startswith('EMP'):
                try:
                    emp_id = int(clean_no[3:])
                except ValueError:
                    pass
            elif clean_no.isdigit():
                emp_id = int(clean_no)

            if emp_id:
                emp_profile = Employee.objects.filter(id=emp_id).first()
                if emp_profile:
                    candidate = getattr(emp_profile, 'candidate', None)
                    if candidate and hasattr(candidate, 'employment_details'):
                        ed = candidate.employment_details.first()

        if not ed and not emp_profile:
            return Response({"error": f"No employee found with ID '{employment_no}'."}, status=status.HTTP_404_NOT_FOUND)

        filter_q = Q()
        if ed:
            filter_q |= Q(employment_detail=ed)
        if emp_profile:
            filter_q |= Q(employee=emp_profile)
        active_entry = EmployeeGateEntry.objects.filter(filter_q, status='inside').order_by('-entry_time').first()

        # Preferred vehicle lookup
        pref_vehicle = None
        if emp_profile:
            pref_vehicle = Vehicle.objects.filter(employee=emp_profile, is_preferred=True).first()
            if not pref_vehicle:
                pref_vehicle = Vehicle.objects.filter(employee=emp_profile).first()

        dept_name = "—"
        if emp_profile and emp_profile.dept_designation and emp_profile.dept_designation.department:
            dept_name = emp_profile.dept_designation.department.name
        elif candidate and candidate.department_applied:
            dept_name = candidate.department_applied.name

        desig_name = "—"
        if emp_profile and emp_profile.dept_designation and emp_profile.dept_designation.designation:
            desig_name = emp_profile.dept_designation.designation.name
        elif candidate and candidate.position_applied:
            desig_name = candidate.position_applied.name

        photo_url = None
        photo_obj = (emp_profile.profile_picture if emp_profile and emp_profile.profile_picture else None) or (candidate.photo if candidate and candidate.photo else None)
        if photo_obj:
            try:
                url = photo_obj.url
                photo_url = request.build_absolute_uri(url) if not url.startswith('http') else url
            except Exception:
                pass

        emp_no_val = (ed.employment_no if ed else None) or (f"EMP{emp_profile.id:03d}" if emp_profile else employment_no)
        emp_name_val = candidate.full_name if candidate else (
            emp_profile.full_name if hasattr(emp_profile, 'full_name') and emp_profile.full_name else (
                emp_profile.user.get_full_name() if emp_profile and emp_profile.user else f"Employee {emp_no_val}"
            )
        )

        return Response({
            "employment_no": emp_no_val,
            "name": emp_name_val,
            "department": dept_name,
            "designation": desig_name,
            "photo": photo_url,
            "phone": (emp_profile.phone if emp_profile else None) or (candidate.mobile_number if candidate else "—"),
            "email": (emp_profile.email if emp_profile else None) or (candidate.email if candidate else "—"),
            "is_inside": active_entry is not None,
            "preferred_vehicle": pref_vehicle.vehicle_number if pref_vehicle else None,
            "preferred_vehicle_id": pref_vehicle.id if pref_vehicle else None,
            "preferred_vehicle_type": pref_vehicle.vehicle_type.name if (pref_vehicle and pref_vehicle.vehicle_type) else None,
            "active_entry": EmployeeGateEntrySerializer(active_entry, context={'request': request}).data if active_entry else None
        })

    @action(detail=False, methods=['post'])
    def scan(self, request):
        """
        Barcode / ID scan endpoint.
        Toggles check-in and check-out for the given employment_no with zero form filling.
        Automatically links and checks in/out employee's preferred vehicle as inside vehicle.
        """
        employment_no = request.data.get('employment_no', '').strip()
        gate_id = request.data.get('gate_id')

        if not employment_no:
            return Response({"error": "Employee ID (employment_no) is required."}, status=status.HTTP_400_BAD_REQUEST)

        from rarenett_app.models import EmploymentDetails, Employee
        from django.utils import timezone
        from django.db.models import Q
        from gate_app.models import Vehicle

        ed = EmploymentDetails.objects.filter(employment_no__iexact=employment_no).select_related(
            'user__position_applied', 'user__department_applied'
        ).first()

        candidate = ed.user if ed else None
        emp_profile = getattr(candidate, 'employee_profile', None) if candidate else None
        if not emp_profile and candidate:
            emp_profile = Employee.objects.filter(candidate=candidate).first()
        if not emp_profile and candidate and getattr(candidate, 'email', None):
            emp_profile = Employee.objects.filter(user__email=candidate.email).first()

        if not ed and not emp_profile:
            clean_no = employment_no.strip()
            emp_id = None
            if clean_no.upper().startswith('EMP'):
                try:
                    emp_id = int(clean_no[3:])
                except ValueError:
                    pass
            elif clean_no.isdigit():
                emp_id = int(clean_no)

            if emp_id:
                emp_profile = Employee.objects.filter(id=emp_id).first()
                if emp_profile:
                    candidate = getattr(emp_profile, 'candidate', None)
                    if candidate and hasattr(candidate, 'employment_details'):
                        ed = candidate.employment_details.first()

        if not ed and not emp_profile:
            return Response(
                {"error": f"Invalid Employee ID. No employee record found matching '{employment_no}'."},
                status=status.HTTP_404_NOT_FOUND
            )

        emp_no_display = (ed.employment_no if ed else None) or (f"EMP{emp_profile.id:03d}" if emp_profile else employment_no)
        emp_name = candidate.full_name if candidate else (
            emp_profile.full_name if hasattr(emp_profile, 'full_name') and emp_profile.full_name else (
                emp_profile.user.get_full_name() if emp_profile and emp_profile.user else f"Employee {emp_no_display}"
            )
        )

        gate_obj = None
        if gate_id:
            gate_obj = Gate.objects.filter(id=gate_id).first()
        if not gate_obj:
            gate_obj = Gate.objects.first()

        # Check for active inside entry
        filter_q = Q()
        if ed:
            filter_q |= Q(employment_detail=ed)
        if emp_profile:
            filter_q |= Q(employee=emp_profile)
        active_entry = EmployeeGateEntry.objects.filter(filter_q, status='inside').order_by('-entry_time').first()

        if active_entry:
            # CHECK OUT
            now = timezone.now()
            active_entry.exit_time = now
            if gate_obj:
                active_entry.exit_gate = gate_obj
            elif not active_entry.exit_gate and active_entry.entry_gate:
                active_entry.exit_gate = active_entry.entry_gate
            active_entry.status = 'exited'
            active_entry.verification_method = 'barcode'

            employee_only = request.data.get('employee_only')
            if employee_only is None:
                exit_mode = request.data.get('exit_mode', '')
                if exit_mode == 'employee_only':
                    employee_only = True
                elif 'include_vehicle' in request.data:
                    employee_only = not request.data.get('include_vehicle')
                else:
                    employee_only = False
            else:
                employee_only = bool(employee_only)

            remarks = request.data.get('remarks', '').strip()
            if remarks:
                active_entry.remarks = remarks
            elif employee_only and (active_entry.vehicle or active_entry.vehicle_entry):
                active_entry.remarks = "Pedestrian exit (vehicle remains parked on campus)"

            active_entry.save(update_fields=['exit_time', 'exit_gate', 'status', 'verification_method', 'remarks', 'updated_at'])

            # Automatically check out associated inside vehicle
            veh_checkout_msg = ""
            if not employee_only:
                if active_entry.vehicle_entry and active_entry.vehicle_entry.status == 'pending':
                    ve = active_entry.vehicle_entry
                    ve.exit_time = now
                    if gate_obj:
                        ve.exit_gate = gate_obj
                    elif not ve.exit_gate and ve.entry_gate:
                        ve.exit_gate = ve.entry_gate
                    ve.status = 'completed'
                    ve.verification_status = 'completed'
                    ve.persons_inside = 0
                    ve.save(update_fields=['exit_time', 'exit_gate', 'status', 'verification_status', 'persons_inside'])
                    sync_exit_card_for_vehicle_entry(ve, exit_time=now)
                    first_v = ve.vehicles.first()
                    if first_v:
                        veh_checkout_msg = f" (Vehicle {first_v.vehicle_number} checked OUT)"
                elif active_entry.vehicle:
                    VehicleEntry.objects.filter(
                        vehicles=active_entry.vehicle,
                        status='pending',
                        exit_time__isnull=True
                    ).update(
                        exit_time=now,
                        exit_gate=gate_obj or active_entry.entry_gate,
                        status='completed',
                        verification_status='completed',
                        persons_inside=0
                    )
                    veh_checkout_msg = f" (Vehicle {active_entry.vehicle.vehicle_number} checked OUT)"

                # Release parking slot for employee and vehicle
                release_parking_slot_for_entry(active_entry)
                if active_entry.vehicle_entry:
                    release_parking_slot_for_entry(active_entry.vehicle_entry)
            else:
                veh_num = active_entry.vehicle.vehicle_number if active_entry.vehicle else (active_entry.vehicle_entry.vehicles.first().vehicle_number if (active_entry.vehicle_entry and active_entry.vehicle_entry.vehicles.exists()) else "")
                veh_checkout_msg = f" (Vehicle {veh_num} remains parked on campus)" if veh_num else ""

            serializer = self.get_serializer(active_entry, context={'request': request})
            return Response({
                "action": "CHECK_OUT",
                "message": f"Employee {emp_name} ({emp_no_display}) checked OUT successfully{veh_checkout_msg}.",
                "entry": serializer.data
            }, status=status.HTTP_200_OK)
        else:
            # CHECK IN
            # Resolve preferred vehicle for this employee
            pref_vehicle = None
            if emp_profile:
                pref_vehicle = Vehicle.objects.filter(employee=emp_profile, is_preferred=True).first()
                if not pref_vehicle:
                    pref_vehicle = Vehicle.objects.filter(employee=emp_profile).first()

            v_entry = None
            emp_park_area = None
            allocated_slot = None

            if pref_vehicle:
                # 1. Resolve designated Employee Park Area
                emp_park_area = resolve_park_area_for_vehicle_type('Employee Vehicle')

                # Check if there is already an active inside VehicleEntry for this vehicle
                v_entry = VehicleEntry.objects.filter(
                    vehicles=pref_vehicle,
                    status='pending',
                    exit_time__isnull=True
                ).order_by('-entry_time').first()

                if not v_entry:
                    company_val = "Company Employee"
                    if emp_profile and emp_profile.dept_designation and emp_profile.dept_designation.department:
                        company_val = f"Employee ({emp_profile.dept_designation.department.name})"
                    elif pref_vehicle.company:
                        company_val = pref_vehicle.company

                    v_entry = VehicleEntry.objects.create(
                        entry_gate=gate_obj,
                        status='pending',
                        verification_status='completed',
                        number_of_persons=1,
                        persons_inside=1,
                        purpose="Employee Vehicle Entry",
                        company=company_val,
                        driver=emp_name or pref_vehicle.driver or "Employee",
                        park_area=emp_park_area,
                        created_by=request.user if request.user.is_authenticated else None
                    )
                    v_entry.vehicles.add(pref_vehicle)
                    sync_entry_card_for_vehicle_entry(v_entry)
                elif not v_entry.park_area and emp_park_area:
                    v_entry.park_area = emp_park_area
                    v_entry.save(update_fields=['park_area'])

                # Automatically allocate parking slot in Employee Park Area
                if emp_park_area:
                    allocated_slot = (v_entry.parking_slot if (v_entry and v_entry.parking_slot and v_entry.parking_slot.status == 'Occupied') else allocate_parking_slot_for_entry(v_entry, park_area=emp_park_area))

            new_entry = EmployeeGateEntry.objects.create(
                employment_detail=ed,
                employee=emp_profile,
                vehicle=pref_vehicle,
                vehicle_entry=v_entry,
                park_area=emp_park_area,
                parking_slot=allocated_slot,
                entry_gate=gate_obj,
                status='inside',
                verification_method='barcode',
                recorded_by=request.user if request.user.is_authenticated else None
            )

            serializer = self.get_serializer(new_entry, context={'request': request})
            veh_msg = f" with preferred vehicle {pref_vehicle.vehicle_number}" if pref_vehicle else ""
            slot_msg = f" (Parking: {emp_park_area.name} - Slot #{allocated_slot.slot_number})" if (allocated_slot and emp_park_area) else ""
            return Response({
                "action": "CHECK_IN",
                "message": f"Employee {emp_name} ({emp_no_display}) checked IN successfully{veh_msg}{slot_msg}.",
                "entry": serializer.data
            }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def checkout(self, request, pk=None):
        """
        Custom checkout endpoint for an active EmployeeGateEntry by ID.
        Supports employee_only exit (pedestrian out, vehicle stays parked on campus)
        and full exit with vehicle (both employee and vehicle exit, slot released).
        """
        entry = self.get_object()
        if entry.status != 'inside' and entry.exit_time:
            return Response({"error": "Employee has already exited campus."}, status=status.HTTP_400_BAD_REQUEST)

        from django.utils import timezone
        now = timezone.now()

        gate_id = request.data.get('gate_id') or request.data.get('exit_gate')
        gate_obj = None
        if gate_id:
            gate_obj = Gate.objects.filter(id=gate_id).first()
        if not gate_obj and entry.entry_gate:
            gate_obj = entry.entry_gate
        if not gate_obj:
            gate_obj = Gate.objects.first()

        employee_only = request.data.get('employee_only')
        if employee_only is None:
            exit_mode = request.data.get('exit_mode', '')
            if exit_mode == 'employee_only':
                employee_only = True
            elif 'include_vehicle' in request.data:
                employee_only = not request.data.get('include_vehicle')
            else:
                employee_only = False
        else:
            employee_only = bool(employee_only)

        remarks = request.data.get('remarks', '').strip()
        entry.exit_time = now
        entry.exit_gate = gate_obj
        entry.status = 'exited'
        entry.verification_method = request.data.get('verification_method', 'manual')
        if remarks:
            entry.remarks = remarks
        elif employee_only and (entry.vehicle or entry.vehicle_entry):
            entry.remarks = "Pedestrian exit (vehicle remains parked on campus)"

        entry.save(update_fields=['exit_time', 'exit_gate', 'status', 'verification_method', 'remarks', 'updated_at'])

        veh_checkout_msg = ""
        if not employee_only:
            # Full exit: check out associated inside vehicle
            if entry.vehicle_entry and entry.vehicle_entry.status == 'pending':
                ve = entry.vehicle_entry
                ve.exit_time = now
                ve.exit_gate = gate_obj or ve.entry_gate
                ve.status = 'completed'
                ve.verification_status = 'completed'
                ve.persons_inside = 0
                ve.save(update_fields=['exit_time', 'exit_gate', 'status', 'verification_status', 'persons_inside'])
                sync_exit_card_for_vehicle_entry(ve, exit_time=now)
                first_v = ve.vehicles.first()
                if first_v:
                    veh_checkout_msg = f" (Vehicle {first_v.vehicle_number} checked OUT)"
            elif entry.vehicle:
                VehicleEntry.objects.filter(
                    vehicles=entry.vehicle,
                    status='pending',
                    exit_time__isnull=True
                ).update(
                    exit_time=now,
                    exit_gate=gate_obj or entry.entry_gate,
                    status='completed',
                    verification_status='completed',
                    persons_inside=0
                )
                veh_checkout_msg = f" (Vehicle {entry.vehicle.vehicle_number} checked OUT)"

            # Release parking slot for both employee entry and vehicle entry
            release_parking_slot_for_entry(entry)
            if entry.vehicle_entry:
                release_parking_slot_for_entry(entry.vehicle_entry)
        else:
            # Employee only exit: vehicle remains parked on campus in assigned slot
            veh_num = entry.vehicle.vehicle_number if entry.vehicle else (entry.vehicle_entry.vehicles.first().vehicle_number if (entry.vehicle_entry and entry.vehicle_entry.vehicles.exists()) else "")
            veh_checkout_msg = f" (Vehicle {veh_num} remains parked on campus)" if veh_num else ""

        serializer = self.get_serializer(entry, context={'request': request})
        emp_name = serializer.data.get('employee_name') or 'Employee'
        emp_no = serializer.data.get('employment_no') or ''
        return Response({
            "action": "CHECK_OUT",
            "message": f"Employee {emp_name} ({emp_no}) checked OUT successfully{veh_checkout_msg}.",
            "entry": serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='face-scan')
    def face_scan(self, request):
        """
        Face Recognition endpoint for Employee Gate Entry.
        Compares live 128-d descriptor against enrolled EmployeeFaceProfile descriptors,
        identifies the employee, and toggles check-in / check-out.
        """
        import json
        import math
        from project_app.models import EmployeeFaceProfile
        from rarenett_app.models import Employee, EmploymentDetails
        from django.utils import timezone
        from django.db.models import Q

        live_descriptor_raw = request.data.get('face_descriptor')
        if not live_descriptor_raw:
            return Response({"error": "face_descriptor is required."}, status=status.HTTP_400_BAD_REQUEST)

        if isinstance(live_descriptor_raw, str):
            try:
                live_descriptor = json.loads(live_descriptor_raw)
            except Exception as e:
                return Response({"error": f"Invalid JSON face descriptor: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        elif isinstance(live_descriptor_raw, list):
            live_descriptor = live_descriptor_raw
        else:
            return Response({"error": "face_descriptor must be a 128-dimensional array or JSON string."}, status=status.HTTP_400_BAD_REQUEST)

        if not isinstance(live_descriptor, list) or len(live_descriptor) != 128:
            return Response({"error": "Invalid face descriptor format. Expected 128 float values."}, status=status.HTTP_400_BAD_REQUEST)

        profiles = EmployeeFaceProfile.objects.select_related(
            'employee__user', 'employee__candidate',
            'employee__dept_designation__department',
            'employee__dept_designation__designation'
        ).all()

        if not profiles.exists():
            return Response({
                "match_found": False,
                "error": "No enrolled employee face data found in the system. Please enroll employee faces first."
            }, status=status.HTTP_404_NOT_FOUND)

        min_dist = float('inf')
        best_profile = None

        for prof in profiles:
            enrolled_desc = prof.face_descriptor
            if isinstance(enrolled_desc, str):
                try:
                    enrolled_desc = json.loads(enrolled_desc)
                except Exception:
                    continue
            if not isinstance(enrolled_desc, list) or len(enrolled_desc) != 128:
                continue

            dist = math.sqrt(sum((a - b) ** 2 for a, b in zip(live_descriptor, enrolled_desc)))
            if dist < min_dist:
                min_dist = dist
                best_profile = prof

        MATCH_THRESHOLD = 0.55
        if min_dist > MATCH_THRESHOLD or not best_profile:
            return Response({
                "match_found": False,
                "distance": round(min_dist, 4) if min_dist != float('inf') else None,
                "error": "Face not recognized. No enrolled employee matched within verification threshold."
            }, status=status.HTTP_404_NOT_FOUND)

        emp = best_profile.employee
        candidate = getattr(emp, 'candidate', None)
        ed = None
        if candidate and hasattr(candidate, 'employment_details'):
            ed = candidate.employment_details.first()
        elif hasattr(emp, 'employment_details'):
            ed = getattr(emp, 'employment_details', None)

        emp_name = (candidate.full_name if candidate else None) or (
            emp.user.get_full_name() or emp.user.username if emp.user else f"Employee #{emp.id}"
        )
        emp_no = ed.employment_no if ed else f"EMP{emp.id:03d}"
        confidence = max(0.0, round((1.0 - (min_dist / MATCH_THRESHOLD)) * 100, 1))

        gate_obj = None
        gate_id = request.data.get('gate_id')
        if gate_id:
            gate_obj = Gate.objects.filter(id=gate_id).first()
        if not gate_obj:
            gate_obj = Gate.objects.first()

        snapshot_file = request.FILES.get('snapshot') or request.FILES.get('snapshot_image')

        # Check for active inside entry
        filter_q = Q(employee=emp)
        if ed:
            filter_q |= Q(employment_detail=ed)
        active_entry = EmployeeGateEntry.objects.filter(filter_q, status='inside').order_by('-entry_time').first()

        if active_entry:
            # CHECK OUT
            now = timezone.now()
            active_entry.exit_time = now
            if gate_obj:
                active_entry.exit_gate = gate_obj
            elif not active_entry.exit_gate and active_entry.entry_gate:
                active_entry.exit_gate = active_entry.entry_gate
            active_entry.status = 'exited'
            active_entry.verification_method = 'face'
            active_entry.face_match_score = min_dist
            if snapshot_file:
                active_entry.snapshot_image = snapshot_file
            active_entry.save()

            # Automatically check out associated inside vehicle
            veh_checkout_msg = ""
            if active_entry.vehicle_entry and active_entry.vehicle_entry.status == 'pending':
                ve = active_entry.vehicle_entry
                ve.exit_time = now
                if gate_obj:
                    ve.exit_gate = gate_obj
                elif not ve.exit_gate and ve.entry_gate:
                    ve.exit_gate = ve.entry_gate
                ve.status = 'completed'
                ve.verification_status = 'completed'
                ve.persons_inside = 0
                ve.save(update_fields=['exit_time', 'exit_gate', 'status', 'verification_status', 'persons_inside'])
                first_v = ve.vehicles.first()
                if first_v:
                    veh_checkout_msg = f" (Vehicle {first_v.vehicle_number} checked OUT)"
            elif active_entry.vehicle:
                VehicleEntry.objects.filter(
                    vehicles=active_entry.vehicle,
                    status='pending',
                    exit_time__isnull=True
                ).update(
                    exit_time=now,
                    exit_gate=gate_obj or active_entry.entry_gate,
                    status='completed',
                    verification_status='completed',
                    persons_inside=0
                )
                veh_checkout_msg = f" (Vehicle {active_entry.vehicle.vehicle_number} checked OUT)"

            # Release parking slot for employee and vehicle
            release_parking_slot_for_entry(active_entry)
            if active_entry.vehicle_entry:
                release_parking_slot_for_entry(active_entry.vehicle_entry)
                sync_exit_card_for_vehicle_entry(active_entry.vehicle_entry, exit_time=now)

            serializer = self.get_serializer(active_entry, context={'request': request})
            return Response({
                "action": "CHECK_OUT",
                "match_found": True,
                "employee_id": emp.id,
                "employee_name": emp_name,
                "employment_no": emp_no,
                "confidence": confidence,
                "match_distance": round(min_dist, 4),
                "message": f"Employee {emp_name} ({emp_no}) verified via Face Recognition and checked OUT{veh_checkout_msg}.",
                "entry": serializer.data
            }, status=status.HTTP_200_OK)
        else:
            # CHECK IN
            from gate_app.models import Vehicle

            # Resolve preferred vehicle for this employee
            pref_vehicle = None
            if emp:
                pref_vehicle = Vehicle.objects.filter(employee=emp, is_preferred=True).first()
                if not pref_vehicle:
                    pref_vehicle = Vehicle.objects.filter(employee=emp).first()

            v_entry = None
            emp_park_area = None
            allocated_slot = None

            if pref_vehicle:
                # 1. Resolve designated Employee Park Area
                emp_park_area = resolve_park_area_for_vehicle_type('Employee Vehicle')

                v_entry = VehicleEntry.objects.filter(
                    vehicles=pref_vehicle,
                    status='pending',
                    exit_time__isnull=True
                ).order_by('-entry_time').first()

                if not v_entry:
                    company_val = "Company Employee"
                    if emp and emp.dept_designation and emp.dept_designation.department:
                        company_val = f"Employee ({emp.dept_designation.department.name})"
                    elif pref_vehicle.company:
                        company_val = pref_vehicle.company

                    v_entry = VehicleEntry.objects.create(
                        entry_gate=gate_obj,
                        status='pending',
                        verification_status='completed',
                        number_of_persons=1,
                        persons_inside=1,
                        purpose="Employee Vehicle Entry",
                        company=company_val,
                        driver=emp_name or pref_vehicle.driver or "Employee",
                        park_area=emp_park_area,
                        created_by=request.user if request.user.is_authenticated else None
                    )
                    v_entry.vehicles.add(pref_vehicle)
                    sync_entry_card_for_vehicle_entry(v_entry)
                elif not v_entry.park_area and emp_park_area:
                    v_entry.park_area = emp_park_area
                    v_entry.save(update_fields=['park_area'])

                # Automatically allocate parking slot in Employee Park Area
                if emp_park_area:
                    allocated_slot = allocate_parking_slot_for_entry(v_entry, park_area=emp_park_area)

            new_entry = EmployeeGateEntry.objects.create(
                employment_detail=ed,
                employee=emp,
                vehicle=pref_vehicle,
                vehicle_entry=v_entry,
                park_area=emp_park_area,
                parking_slot=allocated_slot,
                entry_gate=gate_obj,
                status='inside',
                verification_method='face',
                face_match_score=min_dist,
                snapshot_image=snapshot_file if snapshot_file else None,
                recorded_by=request.user if request.user.is_authenticated else None
            )

            serializer = self.get_serializer(new_entry, context={'request': request})
            veh_msg = f" with preferred vehicle {pref_vehicle.vehicle_number}" if pref_vehicle else ""
            slot_msg = f" (Parking: {emp_park_area.name} - Slot #{allocated_slot.slot_number})" if (allocated_slot and emp_park_area) else ""
            return Response({
                "action": "CHECK_IN",
                "match_found": True,
                "employee_id": emp.id,
                "employee_name": emp_name,
                "employment_no": emp_no,
                "confidence": confidence,
                "match_distance": round(min_dist, 4),
                "message": f"Employee {emp_name} ({emp_no}) verified via Face Recognition and checked IN{veh_msg}{slot_msg}.",
                "entry": serializer.data
            }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='enroll-face')
    def enroll_face(self, request):
        """
        Enrolls or updates facial recognition descriptor for an employee from Gate Management.
        Accepts employee_id or employment_no, face_descriptor, and enrolled_image.
        """
        import json
        from rarenett_app.models import Employee, EmploymentDetails
        from project_app.models import EmployeeFaceProfile

        employee_id = request.data.get('employee_id')
        employment_no = request.data.get('employment_no', '').strip()
        face_descriptor_raw = request.data.get('face_descriptor')
        enrolled_image = request.FILES.get('enrolled_image')

        if not face_descriptor_raw:
            return Response({"error": "face_descriptor is required."}, status=status.HTTP_400_BAD_REQUEST)

        employee = None
        if employee_id:
            employee = Employee.objects.filter(id=employee_id).first()
        elif employment_no:
            ed = EmploymentDetails.objects.filter(employment_no__iexact=employment_no).first()
            if ed and ed.user and hasattr(ed.user, 'employee_profile'):
                employee = ed.user.employee_profile

        if not employee:
            return Response({"error": "Employee not found. Please provide valid employee_id or employment_no."}, status=status.HTTP_404_NOT_FOUND)

        if isinstance(face_descriptor_raw, list):
            descriptor_str = json.dumps(face_descriptor_raw)
        else:
            descriptor_str = str(face_descriptor_raw)

        face_profile, _ = EmployeeFaceProfile.objects.get_or_create(
            employee=employee,
            defaults={'face_descriptor': descriptor_str}
        )
        face_profile.face_descriptor = descriptor_str
        if enrolled_image:
            face_profile.enrolled_image = enrolled_image
        face_profile.save()

        emp_name = (employee.candidate.full_name if employee.candidate else None) or (
            employee.user.get_full_name() or employee.user.username if employee.user else f"Employee #{employee.id}"
        )

        return Response({
            "message": f"Face data enrolled successfully for {emp_name}.",
            "employee_id": employee.id,
            "employee_name": emp_name
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='enrolled-employees')
    def enrolled_employees(self, request):
        """
        Returns a list of all active employees with their face enrollment status.
        Useful for the guard terminal to select employees for enrollment.
        """
        from rarenett_app.models import Employee
        employees = Employee.objects.select_related(
            'user', 'candidate', 'dept_designation__department', 'dept_designation__designation'
        ).prefetch_related('candidate__employment_details').all()

        data = []
        for emp in employees:
            cand = getattr(emp, 'candidate', None)
            ed = cand.employment_details.first() if cand and cand.employment_details.exists() else None
            name = (cand.full_name if cand else None) or (
                emp.user.get_full_name() or emp.user.username if emp.user else f"Employee #{emp.id}"
            )
            dept = emp.dept_designation.department.name if emp.dept_designation and emp.dept_designation.department else (
                cand.department_applied.name if cand and cand.department_applied else "—"
            )
            desig = emp.dept_designation.designation.name if emp.dept_designation and emp.dept_designation.designation else (
                cand.position_applied.name if cand and cand.position_applied else "—"
            )
            has_face = hasattr(emp, 'face_profile') and bool(emp.face_profile.face_descriptor)

            data.append({
                "id": emp.id,
                "name": name,
                "employment_no": ed.employment_no if ed else f"EMP{emp.id:03d}",
                "department": dept,
                "designation": desig,
                "is_enrolled": has_face
            })

        data.sort(key=lambda x: x['name'])
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='switch-vehicle')
    def switch_vehicle(self, request, pk=None):
        """
        Switches the vehicle assigned to an active employee gate entry.
        Supports choosing an existing registered vehicle or adding a new vehicle on the fly.
        Optionally sets the chosen vehicle as the employee's new preferred vehicle.
        Synchronizes the inside VehicleEntry and parking slot allocation.
        """
        entry = self.get_object()
        if entry.status != 'inside':
            return Response(
                {"error": "Vehicle can only be modified for active entries (status='inside')."},
                status=status.HTTP_400_BAD_REQUEST
            )

        from rarenett_app.models import Employee
        from .models import Vehicle, VehicleType, VehicleEntry

        emp_profile = entry.employee
        if not emp_profile and entry.employment_detail and hasattr(entry.employment_detail, 'user'):
            emp_profile = getattr(entry.employment_detail.user, 'employee_profile', None)

        vehicle_id = request.data.get('vehicle_id')
        vehicle_number = request.data.get('vehicle_number', '').strip().upper()
        vehicle_type_id = request.data.get('vehicle_type')
        set_as_preferred = request.data.get('set_as_preferred', True)
        if isinstance(set_as_preferred, str):
            set_as_preferred = set_as_preferred.lower() in ['true', '1', 'yes']

        target_vehicle = None

        if vehicle_id:
            target_vehicle = Vehicle.objects.filter(id=vehicle_id).first()
            if not target_vehicle:
                return Response({"error": f"Vehicle with ID {vehicle_id} not found."}, status=status.HTTP_404_NOT_FOUND)
            if emp_profile and not target_vehicle.employee:
                target_vehicle.employee = emp_profile
                target_vehicle.save()
        elif vehicle_number:
            target_vehicle = Vehicle.objects.filter(vehicle_number__iexact=vehicle_number).first()
            vt_obj = None
            if vehicle_type_id:
                vt_obj = VehicleType.objects.filter(id=vehicle_type_id).first()

            if not target_vehicle:
                target_vehicle = Vehicle.objects.create(
                    vehicle_number=vehicle_number,
                    vehicle_type=vt_obj,
                    employee=emp_profile,
                    driver=entry.employee_name if hasattr(entry, 'employee_name') else "Employee",
                    created_by=request.user if request.user.is_authenticated else None
                )
            else:
                if emp_profile and target_vehicle.employee != emp_profile:
                    target_vehicle.employee = emp_profile
                if vt_obj:
                    target_vehicle.vehicle_type = vt_obj
                target_vehicle.save()
        else:
            return Response(
                {"error": "Either vehicle_id or vehicle_number is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update preferred vehicle status if requested
        if set_as_preferred:
            target_vehicle.is_preferred = True
            target_vehicle.save()

        # Update the active EmployeeGateEntry
        old_vehicle = entry.vehicle
        entry.vehicle = target_vehicle

        # Update the active inside VehicleEntry
        if entry.vehicle_entry and entry.vehicle_entry.status == 'pending':
            ve = entry.vehicle_entry
            if old_vehicle:
                ve.vehicles.remove(old_vehicle)
            ve.vehicles.add(target_vehicle)
            sync_entry_card_for_vehicle_entry(ve)
        else:
            # Check if there's any pending vehicle entry for target vehicle or create one
            ve = VehicleEntry.objects.filter(
                vehicles=target_vehicle,
                status='pending',
                exit_time__isnull=True
            ).first()
            if not ve:
                emp_park_area = entry.park_area or resolve_park_area_for_vehicle_type('Employee Vehicle')
                emp_name = ""
                if emp_profile and hasattr(emp_profile, 'full_name') and emp_profile.full_name:
                    emp_name = emp_profile.full_name
                elif emp_profile and emp_profile.user:
                    emp_name = emp_profile.user.get_full_name() or emp_profile.user.username

                company_val = "Company Employee"
                if emp_profile and emp_profile.dept_designation and emp_profile.dept_designation.department:
                    company_val = f"Employee ({emp_profile.dept_designation.department.name})"

                ve = VehicleEntry.objects.create(
                    entry_gate=entry.entry_gate,
                    status='pending',
                    verification_status='completed',
                    number_of_persons=1,
                    persons_inside=1,
                    purpose="Employee Vehicle Entry",
                    company=company_val,
                    driver=emp_name or "Employee",
                    park_area=emp_park_area,
                    parking_slot=entry.parking_slot,
                    created_by=request.user if request.user.is_authenticated else None
                )
                ve.vehicles.add(target_vehicle)
                sync_entry_card_for_vehicle_entry(ve)
            entry.vehicle_entry = ve

        entry.save()

        serializer = self.get_serializer(entry, context={'request': request})
        pref_msg = " and marked as preferred" if set_as_preferred else ""
        return Response({
            "success": True,
            "message": f"Entry vehicle switched to {target_vehicle.vehicle_number}{pref_msg}.",
            "entry": serializer.data
        }, status=status.HTTP_200_OK)


class ApprovelessEntryConfigViewSet(viewsets.ModelViewSet):
    """
    CRUD API for Approveless Entry Configurations.
    Allows pre-authorizing visitors/vehicles for designated employees within specific departments.
    """
    queryset = ApprovelessEntryConfig.objects.all().select_related('department', 'employee', 'created_by')
    serializer_class = ApprovelessEntryConfigSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['department', 'employee', 'is_active']
    search_fields = [
        'employee__first_name', 'employee__last_name', 'employee__username',
        'employee__email', 'department__name', 'notes'
    ]
    ordering_fields = ['created_at', 'updated_at', 'employee__first_name', 'department__name']
    ordering = ['-created_at']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def check(self, request):
        """
        Check if a given employee has approveless entry clearance active.
        Pass ?employee_id=X and optionally ?department_id=Y
        """
        employee_id = request.query_params.get('employee_id')
        department_id = request.query_params.get('department_id')

        if not employee_id:
            return Response(
                {"error": "employee_id parameter is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        qs = ApprovelessEntryConfig.objects.filter(employee_id=employee_id, is_active=True)
        if department_id:
            qs = qs.filter(department_id=department_id)

        is_allowed = qs.exists()
        config_obj = qs.first()

        return Response({
            "is_approveless_allowed": is_allowed,
            "config": ApprovelessEntryConfigSerializer(config_obj).data if config_obj else None
        })

    @action(detail=True, methods=['patch'])
    def toggle_active(self, request, pk=None):
        config = self.get_object()
        config.is_active = not config.is_active
        config.save(update_fields=['is_active', 'updated_at'])
        return Response({
            "status": "success",
            "is_active": config.is_active,
            "message": f"Approveless entry {'enabled' if config.is_active else 'disabled'} successfully"
        })


class EquipmentViewSet(viewsets.ModelViewSet):
    """
    CRUD API for Equipments / Tools Master.
    Supports multipart form-data for image uploads.
    """
    queryset = Equipment.objects.all()
    serializer_class = EquipmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'code', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['-created_at']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['patch'])
    def toggle_active(self, request, pk=None):
        equipment = self.get_object()
        equipment.is_active = not equipment.is_active
        equipment.save(update_fields=['is_active', 'updated_at'])
        return Response({
            "status": "success",
            "is_active": equipment.is_active,
            "message": f"Equipment {'activated' if equipment.is_active else 'deactivated'} successfully"
        })


from .models import ExitCard, ParkArea
from .serializers import ExitCardSerializer, ParkAreaSerializer
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import ParkingSlot

class ParkAreaViewSet(viewsets.ModelViewSet):
    queryset = ParkArea.objects.all().order_by('-created_at')
    serializer_class = ParkAreaSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['is_main_area']
    search_fields = ['name']

    def perform_create(self, serializer):
        park_area = serializer.save()
        if park_area.is_main_area and park_area.number_of_slots:
            for i in range(1, park_area.number_of_slots + 1):
                ParkingSlot.objects.create(park_area=park_area, slot_number=i)

    def perform_update(self, serializer):
        park_area = serializer.save()
        if park_area.is_main_area and park_area.number_of_slots:
            current_slots = ParkingSlot.objects.filter(park_area=park_area).count()
            target_slots = park_area.number_of_slots
            if target_slots > current_slots:
                for i in range(current_slots + 1, target_slots + 1):
                    ParkingSlot.objects.create(park_area=park_area, slot_number=i)
            elif target_slots < current_slots:
                for i in range(current_slots, target_slots, -1):
                    slot = ParkingSlot.objects.filter(park_area=park_area, slot_number=i, status='Available').first()
                    if slot:
                        slot.delete()

    def list(self, request, *args, **kwargs):
        sync_active_parking_allocations()
        return super().list(request, *args, **kwargs)

    @action(detail=True, methods=['get'])
    def slots(self, request, pk=None):
        sync_active_parking_allocations()
        park_area = self.get_object()
        if park_area.number_of_slots:
            for i in range(1, park_area.number_of_slots + 1):
                ParkingSlot.objects.get_or_create(park_area=park_area, slot_number=i)

        # 1. Active gate entries, vehicle entries, and employee entries currently inside this park area (exit_time is null)
        active_ge = GateEntry.objects.filter(exit_time__isnull=True, park_area=park_area)
        active_ve = VehicleEntry.objects.filter(exit_time__isnull=True, park_area=park_area)
        active_ee = EmployeeGateEntry.objects.filter(exit_time__isnull=True, park_area=park_area)

        # 2. Auto-allocate slots to any active entries that lack a slot
        for ge in active_ge.filter(parking_slot__isnull=True):
            avail_slot = park_area.slots.filter(status='Available').order_by('slot_number').first()
            if avail_slot:
                avail_slot.status = 'Occupied'
                avail_slot.save(update_fields=['status'])
                ge.parking_slot = avail_slot
                ge.save(update_fields=['parking_slot'])

        for ve in active_ve.filter(parking_slot__isnull=True):
            avail_slot = park_area.slots.filter(status='Available').order_by('slot_number').first()
            if avail_slot:
                avail_slot.status = 'Occupied'
                avail_slot.save(update_fields=['status'])
                ve.parking_slot = avail_slot
                ve.save(update_fields=['parking_slot'])

        for ee in active_ee.filter(parking_slot__isnull=True):
            if ee.vehicle or ee.vehicle_entry:
                avail_slot = park_area.slots.filter(status='Available').order_by('slot_number').first()
                if avail_slot:
                    avail_slot.status = 'Occupied'
                    avail_slot.save(update_fields=['status'])
                    ee.parking_slot = avail_slot
                    ee.save(update_fields=['parking_slot'])

        # 3. Collect active slot IDs and build occupancy detail map
        active_slot_info = {}
        for ge in active_ge.exclude(parking_slot__isnull=True).select_related('parking_slot', 'visitor'):
            veh_nums = [v.vehicle_number for v in ge.vehicles.all() if v.vehicle_number]
            info = ", ".join(veh_nums) if veh_nums else (ge.visitor.visitor_name if ge.visitor else f"Entry #{ge.id}")
            active_slot_info[ge.parking_slot_id] = info

        for ve in active_ve.exclude(parking_slot__isnull=True).select_related('parking_slot'):
            first_v = ve.vehicles.first()
            v_num = first_v.vehicle_number if first_v else ve.vehicle_number
            driver_str = f" ({ve.driver})" if ve.driver else ""
            info = f"{v_num}{driver_str}" if v_num else (ve.driver or f"Vehicle #{ve.id}")
            active_slot_info[ve.parking_slot_id] = info

        for ee in active_ee.exclude(parking_slot__isnull=True).select_related('parking_slot', 'employee', 'vehicle'):
            v_num = ee.vehicle.vehicle_number if ee.vehicle else (
                ee.vehicle_entry.vehicles.first().vehicle_number if ee.vehicle_entry and ee.vehicle_entry.vehicles.exists() else None
            )
            emp_name = ee.employee.full_name if (ee.employee and hasattr(ee.employee, 'full_name') and ee.employee.full_name) else (
                ee.employee.user.get_full_name() if (ee.employee and ee.employee.user) else f"Emp #{ee.id}"
            )
            info = f"{v_num} ({emp_name})" if v_num else emp_name
            active_slot_info[ee.parking_slot_id] = info

        active_slot_ids = set(active_slot_info.keys())

        # 4. Synchronize slot statuses: mark active slots Occupied, orphaned slots Available
        park_area.slots.filter(id__in=active_slot_ids).update(status='Occupied')
        park_area.slots.exclude(id__in=active_slot_ids).update(status='Available')

        data = []
        for slot in park_area.slots.all().order_by('slot_number'):
            data.append({
                'id': slot.id,
                'slot_number': slot.slot_number,
                'status': 'Occupied' if slot.id in active_slot_ids else 'Available',
                'occupied_by': active_slot_info.get(slot.id, None)
            })
        return Response(data)


from .models import ExitCard, EntryCard
from .serializers import ExitCardSerializer, EntryCardSerializer

class EntryCardViewSet(viewsets.ModelViewSet):
    queryset = EntryCard.objects.all().order_by('-created_at')
    serializer_class = EntryCardSerializer
    # permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['vehicle_number']

class ExitCardViewSet(viewsets.ModelViewSet):
    queryset = ExitCard.objects.all().order_by('-created_at')
    serializer_class = ExitCardSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        exit_card = serializer.save()

from .models import ParkingFee
from .serializers import ParkingFeeSerializer

class ParkingFeeViewSet(viewsets.ModelViewSet):
    queryset = ParkingFee.objects.all().order_by('min_minutes')
    serializer_class = ParkingFeeSerializer
    permission_classes = [permissions.IsAuthenticated]
