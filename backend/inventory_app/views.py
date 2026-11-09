from rest_framework import viewsets, views, status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action

from django.db.models import ProtectedError, Q

from register_app.permissions import module_permission
from .models import Unit, StockGroup, StockCategory, StockItem, ProductConfiguration
from .serializers import UnitSerializer, StockGroupSerializer, StockCategorySerializer, StockItemSerializer, ProductConfigurationSerializer
from finance_app.models import Ledger
from rarenett_app.models import Employee

from .models import (
    PriceList,
    StockItem,
    StockGroup,
    ProductConfiguration,
    LedgerPriceListMapping,
    Unit,
    StockCategory,
    BillOfEntry,
    StockItemHSN,
    StockItemGST,
)

from .serializers import (
    StockTableSerializer,
    PriceListSerializer,
    StockItemSerializer,
    StockGroupSerializer,
    ProductConfigurationSerializer,
    LedgerPriceListMappingSerializer,
    UnitSerializer,
    StockCategorySerializer,
    StockItemSimpleSerializer,
    BillOfEntrySerializer,
)

def ensure_default_units():
    """
    Ensures standard inventory/GST unit of measurements (UQC) exist in database.
    If database changes or is empty, restores default units automatically.
    """
    default_units = [
        {'name': 'Numbers', 'uqc_code': 'NOS', 'decimal_places': 0},
        {'name': 'Pieces', 'uqc_code': 'PCS', 'decimal_places': 0},
        {'name': 'Kilograms', 'uqc_code': 'KGS', 'decimal_places': 2},
        {'name': 'Litres', 'uqc_code': 'LTR', 'decimal_places': 2},
        {'name': 'Meters', 'uqc_code': 'MTR', 'decimal_places': 2},
        {'name': 'Box', 'uqc_code': 'BOX', 'decimal_places': 0},
        {'name': 'Bottles', 'uqc_code': 'BTL', 'decimal_places': 0},
        {'name': 'Cartons', 'uqc_code': 'CTN', 'decimal_places': 0},
        {'name': 'Bags', 'uqc_code': 'BAG', 'decimal_places': 0},
        {'name': 'Packs', 'uqc_code': 'PAC', 'decimal_places': 0},
        {'name': 'Sets', 'uqc_code': 'SET', 'decimal_places': 0},
        {'name': 'Grams', 'uqc_code': 'GMS', 'decimal_places': 2},
        {'name': 'Rolls', 'uqc_code': 'ROL', 'decimal_places': 0},
        {'name': 'Drums', 'uqc_code': 'DRM', 'decimal_places': 0},
        {'name': 'Cans', 'uqc_code': 'CAN', 'decimal_places': 0},
    ]
    for u_data in default_units:
        try:
            exists = Unit.objects.filter(
                models.Q(name__iexact=u_data['name']) | models.Q(uqc_code__iexact=u_data['uqc_code'])
            ).exists()
            if not exists:
                Unit.objects.create(**u_data)
        except Exception:
            pass

class UnitViewSet(viewsets.ModelViewSet):
    """
    ViewSet to list, create, edit, and delete inventory units.
    """
    queryset = Unit.objects.all()
    serializer_class = UnitSerializer
    permission_classes = [module_permission('units')]

    def get_queryset(self):
        try:
            ensure_default_units()
        except Exception:
            pass
        return super().get_queryset()

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "Cannot delete this unit as it is linked to stock items or other records."},
                status=status.HTTP_400_BAD_REQUEST
            )

FIXED_SYSTEM_STOCK_GROUPS = [
    'Machinery',
    'Spare Parts',
    'Vehicle',
    'Equipments'
]

def ensure_fixed_stock_groups_and_definitions():
    """
    Ensures the 4 fixed system stock groups exist in StockGroup table,
    and links all 4 groups into StockDefinition table as foreign key with status=True.
    Even if database changes, this automatically creates them and manages their StockDefinition entries.
    """
    from .models import StockGroup, StockDefinition
    for name in FIXED_SYSTEM_STOCK_GROUPS:
        group = StockGroup.objects.filter(name__iexact=name).first()
        if not group:
            if name == 'Vehicle':
                group = StockGroup.objects.filter(name__iexact='vechicle').first()
            elif name == 'Equipments':
                group = StockGroup.objects.filter(name__iexact='equipment').first()
        if not group:
            group = StockGroup.objects.create(name=name)

        # Ensure foreign key link exists in StockDefinition table with status=True
        StockDefinition.objects.get_or_create(
            stock_group=group,
            defaults={'status': True}
        )

class StockGroupViewSet(viewsets.ModelViewSet):
    """
    ViewSet to list, create, edit, and delete stock groups.
    """
    queryset = StockGroup.objects.all()
    serializer_class = StockGroupSerializer
    permission_classes = [module_permission('group')]

    def _ensure_default_groups(self):
        ensure_fixed_stock_groups_and_definitions()
        

    def get_queryset(self):
        try:
            self._ensure_default_groups()
        except Exception:
            pass

        queryset = super().get_queryset()
        
        # If user is a superuser, show all stock groups
        if getattr(self.request.user, 'is_superuser', False):
            return queryset
            
        # For normal users, filter by their branch or global default
        employee = Employee.objects.filter(user=self.request.user).first()
        if employee and employee.branch:
            return queryset.filter(Q(branch=employee.branch) | Q(branch__isnull=True))
            
        return queryset

    def perform_create(self, serializer):
        # Default kwargs
        kwargs = {}
        
        # Auto-assign company, branch, and factory from employee profile
        employee = Employee.objects.filter(user=self.request.user).select_related('branch', 'factory').first()
        if employee:
            company = employee.company
            if not company and employee.branch:
                company = employee.branch.company
            
            if company:
                kwargs['company'] = company
            if employee.branch:
                kwargs['branch'] = employee.branch
            if employee.factory:
                kwargs['factory'] = employee.factory
                
        serializer.save(**kwargs)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_parent_group:
            return Response(
                {"detail": "This stock group is marked as a Parent Group and cannot be edited."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_parent_group:
            return Response(
                {"detail": "This stock group is marked as a Parent Group and cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "Cannot delete this stock group as it is linked to stock items or other records."},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def download_template(self, request):
        import openpyxl
        from django.http import HttpResponse
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Stock Groups"
        ws.append(["Name", "Parent Group", "Is Parent Group"])
        
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename="StockGroup_Template.xlsx"'
        wb.save(response)
        return response

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def import_excel(self, request):
        import openpyxl
        file = request.FILES.get('file')
        if not file:
            return Response({"detail": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            wb = openpyxl.load_workbook(file)
            if "Stock Groups" not in wb.sheetnames:
                ws = wb.active
            else:
                ws = wb["Stock Groups"]

            rows = list(ws.rows)
            if not rows:
                return Response({"detail": "The Excel sheet is empty."}, status=status.HTTP_400_BAD_REQUEST)

            headers = [str(cell.value).strip() if cell.value else "" for cell in rows[0]]
            
            if "Name" not in headers:
                return Response({"detail": "Column 'Name' is required."}, status=status.HTTP_400_BAD_REQUEST)

            name_idx = headers.index("Name")
            parent_idx = headers.index("Parent Group") if "Parent Group" in headers else -1
            is_parent_idx = headers.index("Is Parent Group") if "Is Parent Group" in headers else -1

            added = 0
            updated = 0
            errors = []
            
            # Fetch employee info once outside the loop
            employee = Employee.objects.filter(user=request.user).select_related('branch', 'factory').first()
            base_kwargs = {}
            if employee:
                company = employee.company
                if not company and employee.branch:
                    company = employee.branch.company
                if company:
                    base_kwargs['company'] = company
                if employee.branch:
                    base_kwargs['branch'] = employee.branch
                if employee.factory:
                    base_kwargs['factory'] = employee.factory

            for i, row in enumerate(rows[1:], start=2):
                name_val = row[name_idx].value
                if not name_val:
                    continue
                name_val = str(name_val).strip()
                
                parent_val = row[parent_idx].value if parent_idx != -1 else None
                is_parent_val = row[is_parent_idx].value if is_parent_idx != -1 else None
                
                is_parent_group = False
                if is_parent_val:
                    val_str = str(is_parent_val).strip().lower()
                    if val_str in ['yes', 'true', '1', 'y']:
                        is_parent_group = True
                
                parent_group_obj = None
                if parent_val:
                    parent_name = str(parent_val).strip()
                    parent_group_obj = StockGroup.objects.filter(name__iexact=parent_name).first()
                    if not parent_group_obj:
                        # Auto-create missing parent group
                        parent_kwargs = base_kwargs.copy()
                        parent_kwargs['name'] = parent_name
                        parent_kwargs['is_parent_group'] = True # It's acting as a parent
                        parent_group_obj = StockGroup.objects.create(**parent_kwargs)
                        added += 1
                        
                # kwargs for current row
                kwargs = base_kwargs.copy()
                kwargs['name'] = name_val
                kwargs['parent_group'] = parent_group_obj
                kwargs['is_parent_group'] = is_parent_group
                        
                group = StockGroup.objects.filter(name__iexact=name_val).first()
                if group:
                    # Update
                    group.parent_group = parent_group_obj
                    group.is_parent_group = is_parent_group
                    group.save()
                    updated += 1
                else:
                    # Create
                    StockGroup.objects.create(**kwargs)
                    added += 1
                    
            if errors:
                return Response({
                    "detail": "Import completed with errors.", 
                    "added": added, 
                    "updated": updated, 
                    "errors": errors
                }, status=status.HTTP_207_MULTI_STATUS)
                
            return Response({"detail": "Import successful.", "added": added, "updated": updated}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"detail": f"Error parsing Excel file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

class StockCategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet to list, create, edit, and delete stock categories.
    """
    queryset = StockCategory.objects.all()
    serializer_class = StockCategorySerializer
    permission_classes = [module_permission('category')]

    def _ensure_default_categories(self):
        default_categories = [
            'Raw Materials',
            'Semi-Finished Goods (WIP)',
            'Finished Goods',
            'Machinery & Vehicles',
            'Equipments',
            'Spare Parts'
        ]
        for name in default_categories:
            StockCategory.objects.get_or_create(name=name)

    def get_queryset(self):
        try:
            self._ensure_default_categories()
        except Exception:
            pass
        return super().get_queryset()

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "Cannot delete this stock category as it is linked to stock items or other records."},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def download_template(self, request):
        import openpyxl
        from django.http import HttpResponse
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Stock Categories"
        ws.append(["Name", "Parent Category"])
        
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename="StockCategory_Template.xlsx"'
        wb.save(response)
        return response

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def import_excel(self, request):
        import openpyxl
        file = request.FILES.get('file')
        if not file:
            return Response({"detail": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            wb = openpyxl.load_workbook(file)
            if "Stock Categories" not in wb.sheetnames:
                ws = wb.active
            else:
                ws = wb["Stock Categories"]

            rows = list(ws.rows)
            if not rows:
                return Response({"detail": "The Excel sheet is empty."}, status=status.HTTP_400_BAD_REQUEST)

            headers = [str(cell.value).strip() if cell.value else "" for cell in rows[0]]
            
            if "Name" not in headers:
                return Response({"detail": "Column 'Name' is required."}, status=status.HTTP_400_BAD_REQUEST)

            name_idx = headers.index("Name")
            parent_idx = headers.index("Parent Category") if "Parent Category" in headers else -1

            added = 0
            updated = 0
            errors = []

            for i, row in enumerate(rows[1:], start=2):
                name_val = row[name_idx].value
                if not name_val:
                    continue
                name_val = str(name_val).strip()
                
                parent_val = row[parent_idx].value if parent_idx != -1 else None
                
                parent_category_obj = None
                if parent_val:
                    parent_name = str(parent_val).strip()
                    parent_category_obj = StockCategory.objects.filter(name__iexact=parent_name).first()
                    if not parent_category_obj:
                        # Auto-create missing parent category
                        parent_category_obj = StockCategory.objects.create(name=parent_name)
                        added += 1
                        
                category = StockCategory.objects.filter(name__iexact=name_val).first()
                if category:
                    # Update
                    category.parent_category = parent_category_obj
                    category.save()
                    updated += 1
                else:
                    # Create
                    StockCategory.objects.create(name=name_val, parent_category=parent_category_obj)
                    added += 1
                    
            if errors:
                return Response({
                    "detail": "Import completed with errors.", 
                    "added": added, 
                    "updated": updated, 
                    "errors": errors
                }, status=status.HTTP_207_MULTI_STATUS)
                
            return Response({"detail": "Import successful.", "added": added, "updated": updated}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"detail": f"Error parsing Excel file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

class StockItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet to list, create, edit, and delete stock items.
    Accepts multipart/form-data (for image uploads) as well as JSON.
    """
    queryset = StockItem.objects.all().select_related(
        'stock_group',
        'stock_category',
        'base_unit',
        'alternate_unit'
    ).prefetch_related('hsn_codes', 'item_gst_rates')

    serializer_class = StockItemSerializer
    
    def get_permissions(self):
        if self.request.method in ['GET', 'OPTIONS', 'HEAD']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), module_permission('items')()]
    pagination_class = None
    # Accept both multipart (image uploads) and plain JSON
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        queryset = super().get_queryset()
        stock_group_id = self.request.query_params.get('stock_group_id')
        if stock_group_id:
            queryset = queryset.filter(stock_group_id=stock_group_id)
        has_bom = self.request.query_params.get('has_bom')
        if has_bom is not None:
            queryset = queryset.filter(has_bom=(has_bom.lower() == 'true' or has_bom == '1'))
            
        from_stock_definition = self.request.query_params.get('from_stock_definition')
        if from_stock_definition and from_stock_definition.lower() == 'true':
            from .models import StockDefinition, StockGroup
            initial_group_ids = list(StockDefinition.objects.filter(status=True).values_list('stock_group_id', flat=True))
            
            all_group_ids = set(initial_group_ids)
            groups_to_check = list(initial_group_ids)
            
            while groups_to_check:
                subgroups = StockGroup.objects.filter(parent_group_id__in=groups_to_check).values_list('id', flat=True)
                new_groups = [g_id for g_id in subgroups if g_id not in all_group_ids]
                all_group_ids.update(new_groups)
                groups_to_check = new_groups
                
            queryset = queryset.filter(stock_group_id__in=all_group_ids)
            
        return queryset

    def get_serializer_context(self):
        # Pass request into serializer so image_url can build absolute URIs
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "Cannot delete this stock item as it is linked to transactions or other records."},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def download_template(self, request):
        import openpyxl
        from django.http import HttpResponse
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Stock Items"
        ws.append([
            "Name*", "Item Code", "Stock Group*", "Stock Category", "Base Unit*", "Alternate Unit",
            "Conversion Value", "Opening Stock", "Opening Rate", "Opening Value", "MRP",
            "Standard Buying Rate", "Standard Selling Rate", "Maintain Mfg. Date", 
            "Maintain Expiry Date", "Has BOM", "Maintain Batch",
            "HSN Code", "HSN Applicable Date", "GST Type", "IGST %", "CGST %", "SGST %", "CESS %", "GST Applicable Date"
        ])
        
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename="StockItem_Template.xlsx"'
        wb.save(response)
        return response

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def import_excel(self, request):
        import openpyxl
        import datetime
        from django.utils.timezone import make_aware
        file = request.FILES.get('file')
        if not file:
            return Response({"detail": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            wb = openpyxl.load_workbook(file)
            if "Stock Items" not in wb.sheetnames:
                ws = wb.active
            else:
                ws = wb["Stock Items"]

            rows = list(ws.rows)
            if not rows:
                return Response({"detail": "The Excel sheet is empty."}, status=status.HTTP_400_BAD_REQUEST)

            # Strip '*' from headers for easier mapping
            headers = [str(cell.value).replace('*', '').strip() if cell.value else "" for cell in rows[0]]
            
            # Helper to safely get index
            def get_idx(name):
                return headers.index(name) if name in headers else -1

            name_idx = get_idx("Name")
            code_idx = get_idx("Item Code")
            group_idx = get_idx("Stock Group")
            category_idx = get_idx("Stock Category")
            bunit_idx = get_idx("Base Unit")
            aunit_idx = get_idx("Alternate Unit")
            conv_idx = get_idx("Conversion Value")
            os_idx = get_idx("Opening Stock")
            or_idx = get_idx("Opening Rate")
            ov_idx = get_idx("Opening Value")
            mrp_idx = get_idx("MRP")
            sbr_idx = get_idx("Standard Buying Rate")
            ssr_idx = get_idx("Standard Selling Rate")
            mfg_idx = get_idx("Maintain Mfg. Date")
            exp_idx = get_idx("Maintain Expiry Date")
            bom_idx = get_idx("Has BOM")
            batch_idx = get_idx("Maintain Batch")
            
            hsn_idx = get_idx("HSN Code")
            hsn_date_idx = get_idx("HSN Applicable Date")
            gst_type_idx = get_idx("GST Type")
            igst_idx = get_idx("IGST %")
            cgst_idx = get_idx("CGST %")
            sgst_idx = get_idx("SGST %")
            cess_idx = get_idx("CESS %")
            gst_date_idx = get_idx("GST Applicable Date")

            if name_idx == -1 or group_idx == -1 or bunit_idx == -1:
                return Response({"detail": "Columns 'Name', 'Stock Group', and 'Base Unit' are mandatory."}, status=status.HTTP_400_BAD_REQUEST)

            added = 0
            updated = 0
            errors = []

            # Cache units to avoid querying the DB in a loop
            units_cache = {u.name.lower(): u for u in Unit.objects.all()}
            
            def get_or_create_unit(unit_name):
                if not unit_name: return None
                name_str = str(unit_name).strip()
                s_lower = name_str.lower()
                if s_lower not in units_cache:
                    uqc_str = name_str.upper()[:10]  # uqc_code max_length=10
                    u = Unit.objects.create(name=name_str, uqc_code=uqc_str)
                    units_cache[s_lower] = u
                return units_cache[s_lower]

            def parse_bool(val):
                if not val: return False
                return str(val).strip().lower() in ['yes', 'true', '1', 'y']
                
            def parse_decimal(val, default=0.0):
                if not val: return default
                try:
                    return float(val)
                except:
                    return default

            # Get Employee config for group creation
            employee = Employee.objects.filter(user=request.user).select_related('branch', 'factory').first()
            base_group_kwargs = {}
            if employee:
                company = employee.company
                if not company and employee.branch:
                    company = employee.branch.company
                if company: base_group_kwargs['company'] = company
                if employee.branch: base_group_kwargs['branch'] = employee.branch
                if employee.factory: base_group_kwargs['factory'] = employee.factory

            for i, row in enumerate(rows[1:], start=2):
                name_val = row[name_idx].value
                if not name_val: continue
                name_val = str(name_val).strip()

                group_val = row[group_idx].value
                bunit_val = row[bunit_idx].value
                
                if not group_val:
                    errors.append(f"Row {i}: Missing Stock Group")
                    continue
                if not bunit_val:
                    errors.append(f"Row {i}: Missing Base Unit")
                    continue
                    
                group_name = str(group_val).strip()
                group_obj = StockGroup.objects.filter(name__iexact=group_name).first()
                if not group_obj:
                    g_kwargs = base_group_kwargs.copy()
                    g_kwargs['name'] = group_name
                    group_obj = StockGroup.objects.create(**g_kwargs)
                    
                category_obj = None
                if category_idx != -1 and row[category_idx].value:
                    cat_name = str(row[category_idx].value).strip()
                    category_obj = StockCategory.objects.filter(name__iexact=cat_name).first()
                    if not category_obj:
                        category_obj = StockCategory.objects.create(name=cat_name)

                bunit_obj = get_or_create_unit(bunit_val)
                aunit_obj = None
                if aunit_idx != -1 and row[aunit_idx].value:
                    aunit_obj = get_or_create_unit(row[aunit_idx].value)

                item_code = row[code_idx].value if code_idx != -1 else None
                item_code = str(item_code).strip() if item_code else None

                kwargs = {
                    'name': name_val,
                    'item_code': item_code,
                    'stock_group': group_obj,
                    'stock_category': category_obj,
                    'base_unit': bunit_obj,
                    'alternate_unit': aunit_obj,
                    'conversion_value': parse_decimal(row[conv_idx].value if conv_idx != -1 else None, 1.0),
                    'opening_stock': parse_decimal(row[os_idx].value if os_idx != -1 else None),
                    'opening_rate': parse_decimal(row[or_idx].value if or_idx != -1 else None),
                    'opening_value': parse_decimal(row[ov_idx].value if ov_idx != -1 else None),
                    'mrp': parse_decimal(row[mrp_idx].value if mrp_idx != -1 else None),
                    'sb_rate': parse_decimal(row[sbr_idx].value if sbr_idx != -1 else None),
                    'ss_rate': parse_decimal(row[ssr_idx].value if ssr_idx != -1 else None),
                    'maintain_manufacture_date': parse_bool(row[mfg_idx].value if mfg_idx != -1 else None),
                    'maintain_expiry_date': parse_bool(row[exp_idx].value if exp_idx != -1 else None),
                    'has_bom': parse_bool(row[bom_idx].value if bom_idx != -1 else None),
                    'maintain_batch': parse_bool(row[batch_idx].value if batch_idx != -1 else None),
                }

                item = StockItem.objects.filter(name__iexact=name_val).first()
                if item:
                    for k, v in kwargs.items():
                        setattr(item, k, v)
                    item.save()
                    updated += 1
                else:
                    item = StockItem.objects.create(**kwargs)
                    added += 1

                def parse_date(val):
                    if not val: return datetime.date.today()
                    if isinstance(val, datetime.datetime):
                        return val.date()
                    if isinstance(val, datetime.date):
                        return val
                    try:
                        from dateutil.parser import parse
                        return parse(str(val)).date()
                    except:
                        return datetime.date.today()

                hsn_val = row[hsn_idx].value if hsn_idx != -1 else None
                if hsn_val:
                    hsn_date = parse_date(row[hsn_date_idx].value if hsn_date_idx != -1 else None)
                    StockItemHSN.objects.update_or_create(
                        stock_item=item,
                        hsn_number=str(hsn_val).strip(),
                        applicable_date=hsn_date
                    )

                igst_val = parse_decimal(row[igst_idx].value if igst_idx != -1 else None)
                cgst_val = parse_decimal(row[cgst_idx].value if cgst_idx != -1 else None)
                sgst_val = parse_decimal(row[sgst_idx].value if sgst_idx != -1 else None)
                cess_val = parse_decimal(row[cess_idx].value if cess_idx != -1 else None)
                gst_type_val = row[gst_type_idx].value if gst_type_idx != -1 else None

                if igst_val > 0 or cgst_val > 0 or sgst_val > 0 or cess_val > 0 or gst_type_val:
                    gst_date = parse_date(row[gst_date_idx].value if gst_date_idx != -1 else None)
                    gst_type = str(gst_type_val).strip().lower() if gst_type_val else 'goods'
                    valid_gst_types = dict(StockItemGST.GST_TYPE_CHOICES).keys()
                    if gst_type not in valid_gst_types:
                        gst_type = 'goods'
                        
                    StockItemGST.objects.update_or_create(
                        stock_item=item,
                        tax_gst_type=gst_type,
                        applicable_date=gst_date,
                        defaults={
                            'igst_percent': igst_val,
                            'cgst_percent': cgst_val,
                            'sgst_percent': sgst_val,
                            'cess_percent': cess_val,
                        }
                    )
            if errors:
                return Response({
                    "detail": "Import completed with errors.", 
                    "added": added, 
                    "updated": updated, 
                    "errors": errors
                }, status=status.HTTP_207_MULTI_STATUS)
                
            return Response({"detail": "Import successful.", "added": added, "updated": updated}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"detail": f"Error parsing Excel file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='import-tally')
    def import_tally(self, request):
        """
        Queue a 'fetch_stock' command for the Tally Agent running on the client PC.
        If the agent is not connected, falls back to the direct pyodbc path (local dev only).
        """
        from django.utils import timezone
        from sales_app.models import TallySyncConfig

        # Check if Tally Agent is connected (seen within the last 90 seconds)
        config = TallySyncConfig.objects.first()
        agent_connected = (
            config and config.agent_last_seen and
            (timezone.now() - config.agent_last_seen).total_seconds() < 90
        )

        if agent_connected:
            TallySyncConfig.objects.update(
                pending_import_command='fetch_stock',
                import_command_status='pending',
                import_command_error=None,
                import_command_result=None,
            )
            return Response({
                'queued': True,
                'message': 'Fetch request sent to Tally Agent. Stock items will be imported in a few seconds.',
            })

        # ── Fallback: Direct pyodbc (only works when Django runs on same machine as Tally) ──
        try:
            import pyodbc
        except ImportError:
            return Response(
                {"error": "Tally Agent is not connected. "
                           "Please make sure the Tally Sync Agent (Start_Tally_Agent.bat) is running on the client PC."},
                status=status.HTTP_400_BAD_REQUEST
            )

        import datetime
        from inventory_app.models import StockGroup, StockCategory, Unit, StockItem, StockItemHSN, StockItemGST

        conn = None
        for dsn in ['TallyODBC64_9000', 'TallyODBC_9000']:
            try:
                conn = pyodbc.connect(f'DSN={dsn}', timeout=5)
                break
            except Exception:
                continue

        if not conn:
            return Response(
                {"error": "Could not connect to Tally ODBC and no Tally Agent is running. "
                           "Please start the Tally Sync Agent (Start_Tally_Agent.bat) on the client PC."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            cursor = conn.cursor()
            query = "SELECT $Name, $Parent, $BaseUnits, $OpeningBalance, $OpeningValue, $OpeningRate, $Category, $AdditionalUnits, $Conversion, $_HSNCode, $_IntegratedTax FROM StockItem"
            cursor.execute(query)
            rows = cursor.fetchall()

            existing_items = {i.name.lower(): i for i in StockItem.objects.select_related('stock_group', 'stock_category', 'base_unit').all()}

            # Pre-fetch and cache units/groups for performance
            groups_cache = {g.name.lower(): g for g in StockGroup.objects.all()}
            categories_cache = {c.name.lower(): c for c in StockCategory.objects.all()}
            units_cache = {u.name.lower(): u for u in Unit.objects.all()}

            new_count = 0
            update_count = 0
            today = datetime.date.today()

            for row in rows:
                name = row[0]
                if not name or not str(name).strip(): continue
                name = str(name).strip()

                parent = row[1]
                base_units = row[2]
                opening_balance = row[3]
                opening_value = row[4]
                opening_rate = row[5]
                stock_category = row[6]
                add_units = row[7]
                conversion = row[8]
                hsn_code = row[9]
                integrated_tax = row[10]

                group_obj = None
                if parent:
                    parent_str = str(parent).strip()
                    parent_lower = parent_str.lower()
                    if parent_lower not in groups_cache:
                        new_g, _ = StockGroup.objects.get_or_create(name=parent_str)
                        groups_cache[parent_lower] = new_g
                    group_obj = groups_cache[parent_lower]

                category_obj = None
                if stock_category:
                    cat_str = str(stock_category).strip()
                    if cat_str and cat_str != 'None' and '\x04' not in cat_str and 'Not Applicable' not in cat_str:
                        cat_lower = cat_str.lower()
                        if cat_lower not in categories_cache:
                            new_c, _ = StockCategory.objects.get_or_create(name=cat_str)
                            categories_cache[cat_lower] = new_c
                        category_obj = categories_cache[cat_lower]

                unit_obj = None
                if base_units:
                    unit_str = str(base_units).strip()
                    unit_lower = unit_str.lower()
                    if unit_lower not in units_cache:
                        new_u, _ = Unit.objects.get_or_create(
                            name=unit_str,
                            defaults={'uqc_code': unit_str[:10].upper(), 'decimal_places': 2}
                        )
                        units_cache[unit_lower] = new_u
                    unit_obj = units_cache[unit_lower]
                else:
                    if 'nos' not in units_cache:
                        new_u, _ = Unit.objects.get_or_create(name='Nos', defaults={'uqc_code': 'NOS'})
                        units_cache['nos'] = new_u
                    unit_obj = units_cache['nos']

                alt_unit_obj = None
                if add_units:
                    alt_unit_str = str(add_units).strip()
                    if alt_unit_str and alt_unit_str != 'None' and '\x04' not in alt_unit_str and 'Not Applicable' not in alt_unit_str:
                        alt_unit_lower = alt_unit_str.lower()
                        if alt_unit_lower not in units_cache:
                            new_u, _ = Unit.objects.get_or_create(
                                name=alt_unit_str,
                                defaults={'uqc_code': alt_unit_str[:10].upper(), 'decimal_places': 2}
                            )
                            units_cache[alt_unit_lower] = new_u
                        alt_unit_obj = units_cache[alt_unit_lower]

                try:
                    ob = abs(float(opening_balance)) if opening_balance else 0.0
                except:
                    ob = 0.0

                try:
                    ov = abs(float(opening_value)) if opening_value else 0.0
                except:
                    ov = 0.0

                try:
                    or_ = abs(float(opening_rate)) if opening_rate else 0.0
                except:
                    or_ = 0.0

                try:
                    conv_val = float(conversion) if conversion else 1.0
                except:
                    conv_val = 1.0

                name_lower = name.lower()
                if name_lower in existing_items:
                    item = existing_items[name_lower]
                    updated = False

                    if item.stock_group != group_obj:
                        item.stock_group = group_obj
                        updated = True
                    if item.stock_category != category_obj:
                        item.stock_category = category_obj
                        updated = True
                    if item.base_unit != unit_obj:
                        item.base_unit = unit_obj
                        updated = True
                    if item.alternate_unit != alt_unit_obj:
                        item.alternate_unit = alt_unit_obj
                        updated = True
                    if float(item.conversion_value or 1) != conv_val:
                        item.conversion_value = conv_val
                        updated = True
                    if float(item.opening_stock or 0) != ob:
                        item.opening_stock = ob
                        updated = True
                    if float(item.opening_value or 0) != ov:
                        item.opening_value = ov
                        updated = True
                    if float(item.opening_rate or 0) != or_:
                        item.opening_rate = or_
                        updated = True

                    if updated:
                        item.save()
                        update_count += 1
                else:
                    if not group_obj:
                        if 'primary' not in groups_cache:
                            new_g, _ = StockGroup.objects.get_or_create(name='Primary')
                            groups_cache['primary'] = new_g
                        group_obj = groups_cache['primary']

                    item = StockItem(
                        name=name,
                        stock_group=group_obj,
                        stock_category=category_obj,
                        base_unit=unit_obj,
                        alternate_unit=alt_unit_obj,
                        conversion_value=conv_val,
                        opening_stock=ob,
                        opening_value=ov,
                        opening_rate=or_
                    )
                    item.save()
                    new_count += 1

                # Save HSN and GST
                if hsn_code:
                    hsn_str = str(hsn_code).strip()
                    if hsn_str and hsn_str != 'None':
                        StockItemHSN.objects.update_or_create(
                            stock_item=item,
                            applicable_date=today,
                            defaults={'hsn_number': hsn_str}
                        )

                if integrated_tax:
                    try:
                        igst_rate = float(integrated_tax)
                    except:
                        igst_rate = 0.0

                    if igst_rate > 0:
                        StockItemGST.objects.update_or_create(
                            stock_item=item,
                            tax_gst_type='goods',
                            applicable_date=today,
                            defaults={
                                'igst_percent': igst_rate,
                                'cgst_percent': igst_rate / 2,
                                'sgst_percent': igst_rate / 2
                            }
                        )

            cursor.close()
            conn.close()
            return Response({"message": f"Successfully imported {new_count} new stock items and updated {update_count} existing items from Tally"})

        except Exception as e:
            if conn:
                conn.close()
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='import-tally-status')
    def import_tally_status(self, request):
        """Poll for the result of a queued fetch_stock import command."""
        from sales_app.models import TallySyncConfig
        config = TallySyncConfig.objects.filter(pending_import_command='fetch_stock').first() \
            or TallySyncConfig.objects.first()
        if not config:
            return Response({'status': 'idle'})
        return Response({
            'status': config.import_command_status,
            'message': config.import_command_result,
            'error': config.import_command_error,
            'last_updated': config.import_command_at,
        })
class PriceListViewSet(viewsets.ModelViewSet):
    queryset = PriceList.objects.all()
    serializer_class = PriceListSerializer

    @action(detail=False, methods=['get'], url_path='applicable-for-ledger')
    def applicable_for_ledger(self, request):
        ledger_id = request.query_params.get('ledger_id') or request.query_params.get('customer_ledger')
        target_date = request.query_params.get('date') or request.query_params.get('entry_date')

        if not ledger_id:
            return Response({"detail": "ledger_id query parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Find active mapping for this ledger where applicable_date <= target_date
        mappings_query = LedgerPriceListMapping.objects.filter(ledger_id=ledger_id)
        if target_date:
            mappings_query = mappings_query.filter(applicable_date__lte=target_date)
        mappings = mappings_query.order_by('-applicable_date')

        active_mapping = mappings.first()
        if not active_mapping:
            return Response({
                "price_list": None,
                "message": "No price list mapping found for this ledger on the specified date."
            }, status=status.HTTP_200_OK)

        serializer = self.get_serializer(active_mapping.price_list)
        return Response({
            "price_list": serializer.data,
            "mapping_applicable_date": active_mapping.applicable_date,
            "price_list_applicable_date": active_mapping.price_list.applicable_date,
            "price_list_name": active_mapping.price_list.name
        }, status=status.HTTP_200_OK)

class BillOfEntryViewSet(viewsets.ModelViewSet):
    """
    ViewSet to list, create, edit, and delete Recipes (BOM).
    """
    queryset = BillOfEntry.objects.all().order_by('-applicable_date')
    serializer_class = BillOfEntrySerializer
    permission_classes = [module_permission('recipes')]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        stock_item_id = self.request.query_params.get('stock_item_id')
        if stock_item_id:
            queryset = queryset.filter(stock_item_id=stock_item_id)
        return queryset

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        stock_item = instance.stock_item
        try:
            response = super().destroy(request, *args, **kwargs)
            # Check if there are any remaining recipes for this item
            if stock_item and not BillOfEntry.objects.filter(stock_item=stock_item).exists():
                stock_item.has_bom = False
                stock_item.save(update_fields=['has_bom'])
            return response
        except ProtectedError:
            return Response(
                {"detail": "Cannot delete this recipe as it is linked to other records."},
                status=status.HTTP_400_BAD_REQUEST
            )

class UnitListView(views.APIView):
    """
    GET /api/inventory/units/  → list all inventory units
    """
    ##permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            ensure_default_units()
        except Exception:
            pass
        units = Unit.objects.all().order_by('name')
        serializer = UnitSerializer(units, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class StockItemListView(views.APIView):
    """
    GET /api/inventory/stock-items/simple/  → list all stock items with GST details + current quantity
    """
    ##permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import StockTable
        # Fetch all active stock ledger entries in one query
        dup_rows = StockTable.objects.filter(is_active=True).values('item_id', 'movement_type', 'quantity')
        # Aggregate IN - OUT per item
        qty_map = {}
        for row in dup_rows:
            item_id = row['item_id']
            qty = float(row['quantity'] or 0)
            if item_id not in qty_map:
                qty_map[item_id] = 0.0
            if row['movement_type'] == 'IN':
                qty_map[item_id] += qty
            elif row['movement_type'] == 'OUT':
                qty_map[item_id] -= qty

        items = StockItem.objects.select_related('stock_group', 'base_unit').all().order_by('name')

        group_filter = request.query_params.get('group_name') or request.query_params.get('stock_group_name')
        if group_filter:
            items = items.filter(stock_group__name__icontains=group_filter)

        group_id = request.query_params.get('stock_group') or request.query_params.get('stock_group_id')
        if group_id:
            items = items.filter(stock_group_id=group_id)

        from_stock_definition = request.query_params.get('from_stock_definition')
        if from_stock_definition and from_stock_definition.lower() == 'true':
            from .models import StockDefinition, StockGroup
            initial_group_ids = list(StockDefinition.objects.filter(status=True).values_list('stock_group_id', flat=True))
            all_group_ids = set(initial_group_ids)
            groups_to_check = list(initial_group_ids)
            while groups_to_check:
                subgroups = StockGroup.objects.filter(parent_group_id__in=groups_to_check).values_list('id', flat=True)
                new_groups = [g_id for g_id in subgroups if g_id not in all_group_ids]
                all_group_ids.update(new_groups)
                groups_to_check = new_groups
            items = items.filter(stock_group_id__in=all_group_ids)

        serializer = StockItemSimpleSerializer(items, many=True)
        data = serializer.data
        for item_data in data:
            raw_qty = qty_map.get(item_data['id'], 0.0)
            item_data['current_quantity'] = round(raw_qty, 3)
        return Response(data, status=status.HTTP_200_OK)


class ProductConfigurationListCreateView(views.APIView):
    """
    GET  /api/inventory/product-configurations/  → list all product configurations
    POST /api/inventory/product-configurations/  → create a new configuration
    """
    ##permission_classes = [IsAuthenticated]

    def get(self, request):
        configs = ProductConfiguration.objects.select_related('voucher_type').all()
        serializer = ProductConfigurationSerializer(configs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = ProductConfigurationSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ProductConfigurationDetailView(views.APIView):
    """
    GET    /api/inventory/product-configurations/<pk>/  → retrieve single config
    PUT    /api/inventory/product-configurations/<pk>/  → full update
    PATCH  /api/inventory/product-configurations/<pk>/  → partial update
    DELETE /api/inventory/product-configurations/<pk>/  → delete
    """
    ##permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return ProductConfiguration.objects.select_related('voucher_type').get(pk=pk)
        except ProductConfiguration.DoesNotExist:
            return None

    def get(self, request, pk):
        config = self.get_object(pk)
        if not config:
            return Response(
                {'detail': 'Product configuration not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = ProductConfigurationSerializer(config)
        return Response(serializer.data)

    def put(self, request, pk):
        config = self.get_object(pk)
        if not config:
            return Response(
                {'detail': 'Product configuration not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = ProductConfigurationSerializer(config, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        config = self.get_object(pk)
        if not config:
            return Response(
                {'detail': 'Product configuration not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = ProductConfigurationSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        config = self.get_object(pk)
        if not config:
            return Response(
                {'detail': 'Product configuration not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        config.delete()
        return Response(
            {'detail': 'Product configuration deleted successfully.'},
            status=status.HTTP_204_NO_CONTENT
        )


class StockTableDuplicateBatchesView(views.APIView):
    """
    GET /api/inventory/stock-items/batches/?item_id=<id>  → list unique active batches for an item from StockTable,
    including unbatched / primary stock if unbatched stock is available in warehouse.
    """
    ##permission_classes = [IsAuthenticated]

    def get(self, request):
        item_id = request.query_params.get('item_id')
        warehouse_id = request.query_params.get('warehouse_id')
        if not item_id:
            return Response({'detail': 'item_id query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        from .models import StockTable

        filters = {'item_id': item_id, 'is_active': True}
        if warehouse_id:
            filters['warehouse_id'] = warehouse_id

        queryset = StockTable.objects.filter(**filters).order_by('date', 'id')
        
        batches = {}
        unbatched_stock = {}  # warehouse_id -> total unbatched net stock (IN - OUT)

        for row in queryset:
            w_id = row.warehouse_id
            b_num = (row.batch_number or '').strip()

            if b_num:
                key = (w_id, b_num)
                if key not in batches:
                    batches[key] = {
                        'warehouse_id': w_id,
                        'batch_number': b_num,
                        'expiry_date': row.expiry_date.strftime('%Y-%m-%d') if row.expiry_date else '',
                        'manufacture_date': row.manufacture_date.strftime('%Y-%m-%d') if row.manufacture_date else '',
                        'available_quantity': 0.0,
                    }
                if row.movement_type == 'IN':
                    batches[key]['available_quantity'] += float(row.quantity or 0)
                elif row.movement_type == 'OUT':
                    batches[key]['available_quantity'] -= float(row.quantity or 0)
            else:
                if w_id not in unbatched_stock:
                    unbatched_stock[w_id] = 0.0
                if row.movement_type == 'IN':
                    unbatched_stock[w_id] += float(row.quantity or 0)
                elif row.movement_type == 'OUT':
                    unbatched_stock[w_id] -= float(row.quantity or 0)

        result = []
        negative_batch_totals = {}

        for b in batches.values():
            b['available_quantity'] = round(b['available_quantity'], 3)
            if b['available_quantity'] > 0:
                result.append(b)
            elif b['available_quantity'] < 0:
                w_id = b['warehouse_id']
                negative_batch_totals[w_id] = negative_batch_totals.get(w_id, 0.0) + b['available_quantity']

        # Include unbatched stock entry for warehouses if unbatched stock > 0 (adjusted for any negative batch stock)
        for w_id, unbatched_qty in unbatched_stock.items():
            adj_unbatched = round(unbatched_qty + negative_batch_totals.get(w_id, 0.0), 3)
            if adj_unbatched > 0:
                result.append({
                    'warehouse_id': w_id,
                    'batch_number': 'Primary / Unbatched',
                    'expiry_date': '',
                    'manufacture_date': '',
                    'available_quantity': adj_unbatched,
                })

        result.sort(key=lambda x: (x['batch_number'] or ''))
        return Response(result, status=status.HTTP_200_OK)
class PriceListMappingView(views.APIView):
    def get_permissions(self):
        if self.request.method in ['GET', 'OPTIONS', 'HEAD']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), module_permission('pricelist_mapping')()]

    def get(self, request):
        print("PriceListMappingView GET request received! Query params:", request.query_params)
        queryset = LedgerPriceListMapping.objects.all().order_by('-applicable_date', 'ledger__name')
        price_list_id = request.query_params.get('price_list_id')
        applicable_date = request.query_params.get('applicable_date')
        
        if price_list_id:
            queryset = queryset.filter(price_list_id=price_list_id)
        if applicable_date:
            queryset = queryset.filter(applicable_date=applicable_date)
        
        ledger_id = request.query_params.get('ledger_id')
        if ledger_id:
            queryset = queryset.filter(ledger_id=ledger_id)
            
        serializer = LedgerPriceListMappingSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        price_list_id = request.data.get('price_list_id')
        applicable_date = request.data.get('applicable_date')
        ledger_ids = request.data.get('ledger_ids', [])
        unmap_ledger_ids = request.data.get('unmap_ledger_ids', [])

        if not price_list_id or not applicable_date:
            return Response({'detail': 'Price List and Applicable Date are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            price_list = PriceList.objects.get(pk=price_list_id)
        except PriceList.DoesNotExist:
            return Response({'detail': 'Price List not found'}, status=status.HTTP_404_NOT_FOUND)

        # Bulk map ledgers to the price list on this date
        for ledger_id in ledger_ids:
            LedgerPriceListMapping.objects.update_or_create(
                ledger_id=ledger_id,
                applicable_date=applicable_date,
                defaults={'price_list': price_list}
            )

        # Unmap specific ledgers on this date
        if unmap_ledger_ids:
            LedgerPriceListMapping.objects.filter(
                ledger_id__in=unmap_ledger_ids,
                applicable_date=applicable_date
            ).delete()

        return Response({'detail': 'Mappings updated successfully.'}, status=status.HTTP_200_OK)

    def delete(self, request, pk=None):
        if pk is not None:
            try:
                mapping = LedgerPriceListMapping.objects.get(pk=pk)
                mapping.delete()
                return Response({'detail': 'Mapping deleted successfully.'}, status=status.HTTP_200_OK)
            except LedgerPriceListMapping.DoesNotExist:
                return Response({'detail': 'Mapping not found.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            price_list_id = request.data.get('price_list_id') or request.query_params.get('price_list_id')
            applicable_date = request.data.get('applicable_date') or request.query_params.get('applicable_date')

            if not price_list_id or not applicable_date:
                return Response({'detail': 'Price List and Applicable Date are required.'}, status=status.HTTP_400_BAD_REQUEST)

            deleted_count, _ = LedgerPriceListMapping.objects.filter(
                price_list_id=price_list_id,
                applicable_date=applicable_date
            ).delete()

            return Response({'detail': f'Successfully deleted {deleted_count} mappings.'}, status=status.HTTP_200_OK)

    def put(self, request, pk=None):
        if pk is not None:
            try:
                mapping = LedgerPriceListMapping.objects.get(pk=pk)
            except LedgerPriceListMapping.DoesNotExist:
                return Response({'detail': 'Mapping not found.'}, status=status.HTTP_404_NOT_FOUND)

            price_list_id = request.data.get('price_list_id')
            applicable_date = request.data.get('applicable_date')

            if not price_list_id or not applicable_date:
                return Response({'detail': 'Price List and Applicable Date are required.'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                price_list = PriceList.objects.get(pk=price_list_id)
            except PriceList.DoesNotExist:
                return Response({'detail': 'Price List not found.'}, status=status.HTTP_404_NOT_FOUND)

            # Check if the date is changing and if a mapping already exists for this ledger and date
            if str(mapping.applicable_date) != str(applicable_date):
                exists = LedgerPriceListMapping.objects.filter(
                    ledger=mapping.ledger,
                    applicable_date=applicable_date
                ).exclude(pk=pk).exists()
                if exists:
                    return Response({'detail': 'A mapping for this ledger on this date already exists.'}, status=status.HTTP_400_BAD_REQUEST)

            mapping.price_list = price_list
            mapping.applicable_date = applicable_date
            mapping.save()

            serializer = LedgerPriceListMappingSerializer(mapping)
            return Response(serializer.data, status=status.HTTP_200_OK)
        else:
            # Bulk update mappings from old price_list/date to new price_list/date
            old_price_list_id = request.data.get('old_price_list_id')
            old_applicable_date = request.data.get('old_applicable_date')
            new_price_list_id = request.data.get('new_price_list_id')
            new_applicable_date = request.data.get('new_applicable_date')
            ledger_ids = request.data.get('ledger_ids', [])

            if not old_price_list_id or not old_applicable_date or not new_price_list_id or not new_applicable_date:
                return Response({'detail': 'Old and New Price List and Applicable Date are required.'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                new_price_list = PriceList.objects.get(pk=new_price_list_id)
            except PriceList.DoesNotExist:
                return Response({'detail': 'New Price List not found.'}, status=status.HTTP_404_NOT_FOUND)

            # Check for date collisions: if a ledger in ledger_ids already has a mapping on new_applicable_date
            # (excluding mappings that were part of the old mapping set we are moving)
            for ledger_id in ledger_ids:
                collision_exists = LedgerPriceListMapping.objects.filter(
                    ledger_id=ledger_id,
                    applicable_date=new_applicable_date
                ).exclude(
                    price_list_id=old_price_list_id,
                    applicable_date=old_applicable_date
                ).exists()

                if collision_exists:
                    ledger_name = Ledger.objects.filter(pk=ledger_id).values_list('name', flat=True).first() or f"ID {ledger_id}"
                    return Response({'detail': f'A mapping for ledger "{ledger_name}" on date {new_applicable_date} already exists.'}, status=status.HTTP_400_BAD_REQUEST)

            # Perform the updates
            # 1. Get the existing old mappings
            old_mappings = LedgerPriceListMapping.objects.filter(
                price_list_id=old_price_list_id,
                applicable_date=old_applicable_date
            )

            # 2. Delete the ones that are not in the new checked list
            old_mappings.exclude(ledger_id__in=ledger_ids).delete()

            # 3. Create or update mapping for each ledger in the list on new date
            for ledger_id in ledger_ids:
                LedgerPriceListMapping.objects.update_or_create(
                    ledger_id=ledger_id,
                    applicable_date=new_applicable_date,
                    defaults={'price_list': new_price_list}
                )

            # 4. Clean up leftover old mappings if the date/price list changed
            if str(old_applicable_date) != str(new_applicable_date) or str(old_price_list_id) != str(new_price_list_id):
                LedgerPriceListMapping.objects.filter(
                    price_list_id=old_price_list_id,
                    applicable_date=old_applicable_date
                ).delete()

            return Response({'detail': 'Bulk mappings updated successfully.'}, status=status.HTTP_200_OK)

class StockItemWarehousesView(views.APIView):
    """
    GET /api/inventory/warehouses/?item_id=<id>  → list unique active warehouses for an item
    with available_quantity (IN - OUT) per warehouse.
    GET /api/inventory/warehouses/?item_id=<id>&all=true  → list ALL active warehouses,
    including those with no stock for this item (available_quantity defaults to 0).
    """
    ##permission_classes = [IsAuthenticated]

    def get(self, request):
        item_id = request.query_params.get('item_id')
        if not item_id:
            return Response({'detail': 'item_id query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

        fetch_all = request.query_params.get('all', '').lower() in ('true', '1', 'yes')

        from .models import StockTableDuplicate
        from settings_app.models import Warehouse as WarehouseModel

        # Build per-warehouse stock summary from transaction history
        queryset = StockTable.objects.filter(
            item_id=item_id,
            is_active=True,
            warehouse__isnull=False
        ).select_related('warehouse').order_by('warehouse__name')

        warehouses = {}
        for row in queryset:
            w_id = row.warehouse_id
            if w_id not in warehouses:
                warehouses[w_id] = {
                    'id': w_id,
                    'name': row.warehouse.name,
                    'available_quantity': 0.0,
                }
            if row.movement_type == 'IN':
                warehouses[w_id]['available_quantity'] += float(row.quantity or 0)
            elif row.movement_type == 'OUT':
                warehouses[w_id]['available_quantity'] -= float(row.quantity or 0)

        if fetch_all:
            # Merge with all active warehouses so every warehouse appears
            all_active = WarehouseModel.objects.filter(is_active=True).order_by('name')
            for wh in all_active:
                if wh.id not in warehouses:
                    warehouses[wh.id] = {
                        'id': wh.id,
                        'name': wh.name,
                        'available_quantity': 0.0,
                    }

        result = []
        for w in warehouses.values():
            w['available_quantity'] = round(w['available_quantity'], 3)
            result.append(w)

        # Sort by warehouse name
        result.sort(key=lambda x: x['name'])

        return Response(result, status=status.HTTP_200_OK)

from .models import PhysicalStock, PhysicalStockItem, StockTable, StockTableDuplicate
from .serializers import PhysicalStockSerializer
from django.db import transaction
from decimal import Decimal

from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status

class PhysicalStockViewSet(viewsets.ModelViewSet):
    queryset = PhysicalStock.objects.all().prefetch_related('items', 'items__item', 'items__warehouse')
    serializer_class = PhysicalStockSerializer
    ##permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'], url_path='next-no')
    def next_voucher_no(self, request):
        last_stock = PhysicalStock.objects.all().order_by('-id').first()
        if last_stock and last_stock.voucher_no and last_stock.voucher_no.startswith('PS-'):
            try:
                num = int(last_stock.voucher_no.split('-')[1])
                next_no = f"PS-{num + 1:03d}"
            except:
                next_no = "PS-001"
        else:
            next_no = "PS-001"
        return Response({'next_no': next_no})

    def perform_create(self, serializer):
        with transaction.atomic():
            physical_stock = serializer.save(created_by=self.request.user)
            self._update_stock(physical_stock)

    def perform_update(self, serializer):
        with transaction.atomic():
            # Before updating, revert the old stock adjustments
            self._revert_stock(serializer.instance)
            physical_stock = serializer.save()
            self._update_stock(physical_stock)

    def perform_destroy(self, instance):
        with transaction.atomic():
            self._revert_stock(instance)
            instance.delete()

    def _update_stock(self, physical_stock):
        for item in physical_stock.items.all():
            # Calculate system quantity for this specific item, warehouse, and batch
            qs = StockTable.objects.filter(
                item=item.item,
                is_active=True
            )
            if item.warehouse:
                qs = qs.filter(warehouse=item.warehouse)
            else:
                qs = qs.filter(warehouse__isnull=True)
                
            if item.batch_number:
                qs = qs.filter(batch_number=item.batch_number)
            else:
                from django.db.models import Q
                qs = qs.filter(Q(batch_number__isnull=True) | Q(batch_number=''))
                
            in_qty = sum(row.quantity for row in qs if row.movement_type == 'IN')
            out_qty = sum(row.quantity for row in qs if row.movement_type == 'OUT')
            calculated_system_qty = Decimal(in_qty) - Decimal(out_qty)
            
            # Save the calculated system quantity to the item
            item.system_quantity = calculated_system_qty
            item.save(update_fields=['system_quantity'])

            diff = item.quantity - calculated_system_qty
            if diff == 0:
                continue

            movement_type = 'IN' if diff > 0 else 'OUT'
            quantity_to_adjust = abs(diff)

            # Create StockTable entry
            StockTable.objects.create(
                item=item.item,
                transaction_type='PHYSICAL_STOCK',
                movement_type=movement_type,
                quantity=quantity_to_adjust,
                rate=item.item.opening_rate, # or avg rate, falling back to opening rate
                batch_number=item.batch_number,
                manufacture_date=item.manufacture_date,
                expiry_date=item.expiry_date,
                warehouse=item.warehouse,
                date=physical_stock.date,
                is_active=True,
                reference_id=physical_stock.id
            )

            # Create StockTableDuplicate entry
            StockTableDuplicate.objects.create(
                item=item.item,
                transaction_type='PHYSICAL_STOCK',
                movement_type=movement_type,
                quantity=quantity_to_adjust,
                rate=item.item.opening_rate,
                batch_number=item.batch_number,
                manufacture_date=item.manufacture_date,
                expiry_date=item.expiry_date,
                warehouse=item.warehouse,
                date=physical_stock.date,
                is_active=True,
                reference_id=physical_stock.id
            )

    def _revert_stock(self, physical_stock):
        # Delete the StockTable entries created for this PhysicalStock
        StockTable.objects.filter(transaction_type='PHYSICAL_STOCK', reference_id=physical_stock.id).delete()
        StockTableDuplicate.objects.filter(transaction_type='PHYSICAL_STOCK', reference_id=physical_stock.id).delete()


from .models import WarehouseTransfer, WarehouseTransferItem, WarehouseTransferItemSplit
from .serializers import WarehouseTransferSerializer

class WarehouseTransferViewSet(viewsets.ModelViewSet):
    queryset = WarehouseTransfer.objects.all().prefetch_related(
        'items', 'items__item', 'items__splits', 'items__splits__source_warehouse'
    )
    serializer_class = WarehouseTransferSerializer
    ##permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'], url_path='next-no')
    def next_voucher_no(self, request):
        last_wt = WarehouseTransfer.objects.all().order_by('-id').first()
        if last_wt and last_wt.wt_no and last_wt.wt_no.startswith('WT-'):
            try:
                num = int(last_wt.wt_no.split('-')[1])
                next_no = f"WT-{num + 1:03d}"
            except:
                next_no = "WT-001"
        else:
            next_no = "WT-001"
        return Response({'next_no': next_no})

    def perform_create(self, serializer):
        with transaction.atomic():
            transfer = serializer.save(created_by=self.request.user)
            self._update_stock(transfer)

    def perform_update(self, serializer):
        with transaction.atomic():
            self._revert_stock(serializer.instance)
            transfer = serializer.save()
            self._update_stock(transfer)

    def perform_destroy(self, instance):
        with transaction.atomic():
            self._revert_stock(instance)
            instance.delete()

    def _update_stock(self, transfer):
        from inventory_app.models import StockTable, StockTableDuplicate
        from django.utils import timezone
        
        for item in transfer.items.all():
            for split in item.splits.all():
                qty = split.quantity
                if not qty or qty <= 0:
                    continue
                
                common_data = {
                    'item': item.item,
                    'transaction_type': 'WAREHOUSE_TRANSFER',
                    'reference_id': transfer.id,
                    'quantity': qty,
                    'rate': split.rate,
                    'batch_number': split.batch_number,
                    'manufacture_date': split.manufacture_date,
                    'expiry_date': split.expiry_date,
                    'verified_by': transfer.created_by,
                    'date': transfer.entry_date,
                    'time': timezone.now().time(),
                    'is_active': True,
                }
                
                # Out from Source
                StockTable.objects.create(
                    movement_type='OUT',
                    warehouse=split.source_warehouse,
                    **common_data
                )
                StockTableDuplicate.objects.create(
                    movement_type='OUT',
                    warehouse=split.source_warehouse,
                    **common_data
                )
                
                # In to Destination
                StockTable.objects.create(
                    movement_type='IN',
                    warehouse=transfer.destination_warehouse,
                    **common_data
                )
                StockTableDuplicate.objects.create(
                    movement_type='IN',
                    warehouse=transfer.destination_warehouse,
                    **common_data
                )

    def _revert_stock(self, transfer):
        from inventory_app.models import StockTable, StockTableDuplicate
        StockTable.objects.filter(
            transaction_type='WAREHOUSE_TRANSFER',
            reference_id=transfer.id
        ).delete()
        StockTableDuplicate.objects.filter(
            transaction_type='WAREHOUSE_TRANSFER',
            reference_id=transfer.id
        ).delete()

class ItemMovementAPIView(views.APIView):
    ##permission_classes = [IsAuthenticated]

    def get(self, request, item_id):
        try:
            # We fetch all active stock table entries for the given item, ordered by date and time
            # We don't strictly require module_permission here since it's a sub-feature, or we can assume if they can view items or reports they can view this.
            movements = StockTable.objects.filter(item_id=item_id, is_active=True).order_by('date', 'time', 'id')
            serializer = StockTableSerializer(movements, many=True)
            return Response({'status': True, 'data': serializer.data}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'status': False, 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ItemReportAPIView(views.APIView):
    # permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import StockTable, StockItem
        from django.db.models import Prefetch

        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')

        # Filter StockTable entries
        queryset = StockTable.objects.filter(is_active=True)
        if from_date:
            queryset = queryset.filter(date__gte=from_date)
        if to_date:
            queryset = queryset.filter(date__lte=to_date)

        # Optimize by selecting related item and warehouse
        queryset = queryset.select_related('item', 'warehouse')

        # Dictionary to build the hierarchical structure
        # items_map[item_id] = { 'item_name': '...', 'total_quantity': 0, 'godowns': { warehouse_id: { 'godown_name': '...', 'total_quantity': 0, 'batches': { 'batch_number': qty } } } }
        items_map = {}

        for row in queryset:
            if not row.item:
                continue
            item_id = row.item_id
            item_name = row.item.name
            w_id = row.warehouse_id
            w_name = row.warehouse.name if row.warehouse else ''
            b_number = row.batch_number or ''
            
            qty = float(row.quantity or 0)
            if row.movement_type == 'OUT':
                qty = -qty

            if item_id not in items_map:
                items_map[item_id] = {
                    'item_id': item_id,
                    'item_name': item_name,
                    'total_quantity': 0.0,
                    'godowns': {}
                }
            
            items_map[item_id]['total_quantity'] += qty

            if w_id or b_number or w_name:
                godown_key = w_name if w_name else ''
                if godown_key not in items_map[item_id]['godowns']:
                    items_map[item_id]['godowns'][godown_key] = {
                        'godown_name': godown_key,
                        'total_quantity': 0.0,
                        'batches': {}
                    }
                items_map[item_id]['godowns'][godown_key]['total_quantity'] += qty
                
                batch_key = b_number if b_number else ''
                if batch_key not in items_map[item_id]['godowns'][godown_key]['batches']:
                    items_map[item_id]['godowns'][godown_key]['batches'][batch_key] = 0.0
                items_map[item_id]['godowns'][godown_key]['batches'][batch_key] += qty

        # Format into list
        result = []
        for i_id, i_data in items_map.items():
            if round(i_data['total_quantity'], 3) == 0:
                continue # Skip items with 0 balance for the period? Actually we should probably show them if they have movements, or skip 0 total qty items. Usually 0 balance is skipped in balance reports unless they want to see it. Let's include it if there's movement.
            
            godowns_list = []
            for g_key, g_data in i_data['godowns'].items():
                batches_list = []
                for b_key, b_qty in g_data['batches'].items():
                    if round(b_qty, 3) != 0:
                        batches_list.append({
                            'batch_number': b_key,
                            'quantity': round(b_qty, 3)
                        })
                
                if batches_list or round(g_data['total_quantity'], 3) != 0:
                    godowns_list.append({
                        'godown_name': g_data['godown_name'],
                        'total_quantity': round(g_data['total_quantity'], 3),
                        'batches': sorted(batches_list, key=lambda x: x['batch_number'])
                    })

            godowns_list.sort(key=lambda x: x['godown_name'])
            result.append({
                'item_id': i_id,
                'item_name': i_data['item_name'],
                'total_quantity': round(i_data['total_quantity'], 3),
                'godowns': godowns_list
            })

        result.sort(key=lambda x: x['item_name'])
        return Response(result, status=status.HTTP_200_OK)

class GodownReportAPIView(views.APIView):
    # permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import StockTable, StockItem, Warehouse
        from django.db.models import Prefetch

        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')

        # Filter StockTable entries
        queryset = StockTable.objects.filter(is_active=True)
        if from_date:
            queryset = queryset.filter(date__gte=from_date)
        if to_date:
            queryset = queryset.filter(date__lte=to_date)

        # Optimize by selecting related item and warehouse
        queryset = queryset.select_related('item', 'warehouse')

        # Dictionary to build the hierarchical structure
        godowns_map = {}

        for row in queryset:
            if not row.item:
                continue
            item_id = row.item_id
            item_name = row.item.name
            w_id = row.warehouse_id
            w_name = row.warehouse.name if row.warehouse else ''
            b_number = row.batch_number or ''
            
            qty = float(row.quantity or 0)
            if row.movement_type == 'OUT':
                qty = -qty

            g_key = w_id if w_id else 'unknown'
            g_name = w_name if w_name else 'Unknown'

            if g_key not in godowns_map:
                godowns_map[g_key] = {
                    'godown_id': g_key,
                    'godown_name': g_name,
                    'total_quantity': 0.0,
                    'items': {}
                }
            
            godowns_map[g_key]['total_quantity'] += qty

            if item_id not in godowns_map[g_key]['items']:
                godowns_map[g_key]['items'][item_id] = {
                    'item_name': item_name,
                    'total_quantity': 0.0,
                    'batches': {}
                }
            godowns_map[g_key]['items'][item_id]['total_quantity'] += qty
            
            batch_key = b_number if b_number else ''
            if batch_key not in godowns_map[g_key]['items'][item_id]['batches']:
                godowns_map[g_key]['items'][item_id]['batches'][batch_key] = 0.0
            godowns_map[g_key]['items'][item_id]['batches'][batch_key] += qty

        # Format into list
        result = []
        for g_key, g_data in godowns_map.items():
            if round(g_data['total_quantity'], 3) == 0:
                continue 
            
            items_list = []
            for i_id, i_data in g_data['items'].items():
                batches_list = []
                for b_key, b_qty in i_data['batches'].items():
                    if round(b_qty, 3) != 0:
                        batches_list.append({
                            'batch_number': b_key,
                            'quantity': round(b_qty, 3)
                        })
                
                if batches_list or round(i_data['total_quantity'], 3) != 0:
                    items_list.append({
                        'item_name': i_data['item_name'],
                        'total_quantity': round(i_data['total_quantity'], 3),
                        'batches': sorted(batches_list, key=lambda x: x['batch_number'])
                    })

            if items_list:
                items_list.sort(key=lambda x: x['item_name'])
                result.append({
                    'godown_id': g_data['godown_id'],
                    'godown_name': g_data['godown_name'],
                    'total_quantity': round(g_data['total_quantity'], 3),
                    'items': items_list
                })

        result.sort(key=lambda x: x['godown_name'])
        return Response(result, status=status.HTTP_200_OK)

class BatchwiseStockReportAPIView(views.APIView):
    # permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import StockTable
        
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')

        queryset = StockTable.objects.filter(is_active=True).select_related('item')
        if from_date:
            queryset = queryset.filter(date__gte=from_date)
        if to_date:
            queryset = queryset.filter(date__lte=to_date)

        # Dictionary to build the hierarchical structure
        # items_map[item_id] = { 'item_name': '...', 'total_quantity': 0, 'batches': { 'batch_number': qty } }
        items_map = {}

        for row in queryset:
            if not row.item:
                continue
            
            item_id = row.item_id
            item_name = row.item.name
            b_number = row.batch_number or ''
            
            qty = float(row.quantity or 0)
            if row.movement_type == 'OUT':
                qty = -qty

            if item_id not in items_map:
                items_map[item_id] = {
                    'item_id': item_id,
                    'item_name': item_name,
                    'total_quantity': 0.0,
                    'batches': {}
                }
            
            items_map[item_id]['total_quantity'] += qty

            batch_key = b_number if b_number else ''
            if batch_key not in items_map[item_id]['batches']:
                items_map[item_id]['batches'][batch_key] = 0.0
            items_map[item_id]['batches'][batch_key] += qty

        # Format into list
        result = []
        for i_id, i_data in items_map.items():
            if round(i_data['total_quantity'], 3) == 0:
                continue
            
            batches_list = []
            for b_key, b_qty in i_data['batches'].items():
                if round(b_qty, 3) != 0:
                    batches_list.append({
                        'batch_number': b_key,
                        'quantity': round(b_qty, 3)
                    })
            
            if batches_list or round(i_data['total_quantity'], 3) != 0:
                result.append({
                    'item_id': i_data['item_id'],
                    'item_name': i_data['item_name'],
                    'total_quantity': round(i_data['total_quantity'], 3),
                    'batches': sorted(batches_list, key=lambda x: x['batch_number'])
                })

        result.sort(key=lambda x: x['item_name'])
        return Response(result, status=status.HTTP_200_OK)


class StockItemBookAPIView(views.APIView):
    # permission_classes = [IsAuthenticated]

    def get(self, request, item_id=None):
        from .models import StockTable, StockItem, Warehouse
        from settings_app.models import Company, CompanyAddress, CompanyContact
        import logging
        logger = logging.getLogger(__name__)

        selected_item_id = item_id or request.query_params.get('item_id')
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')

        # Company details
        company_info = {
            'name': '',
            'display_name': '',
            'address': '',
            'phone': '',
            'email': '',
            'gst_no': '',
            'pan_no': '',
            'website': '',
        }
        try:
            comp = Company.objects.first()
            if comp:
                company_info['name'] = comp.name or ''
                company_info['display_name'] = comp.display_name or comp.name or ''
                company_info['gst_no'] = getattr(comp, 'gst_no', '') or ''
                company_info['pan_no'] = getattr(comp, 'pan_no', '') or ''
                company_info['website'] = getattr(comp, 'website', '') or ''
                
                addr = CompanyAddress.objects.filter(company=comp).first()
                if addr:
                    lines = [l for l in [addr.address_line_1, addr.address_line_2, addr.city, addr.state, addr.pincode, addr.country] if l]
                    company_info['address'] = ', '.join(lines)
                    
                contact = CompanyContact.objects.filter(company=comp).first()
                if contact:
                    company_info['phone'] = getattr(contact, 'phone', '') or getattr(contact, 'mobile', '') or ''
                    company_info['email'] = getattr(contact, 'email', '') or getattr(contact, 'support_email', '') or ''
        except Exception as e:
            logger.error(f"Error fetching company details: {e}")

        # Item info if single item selected
        item_info = None
        if selected_item_id and str(selected_item_id).lower() != 'all':
            try:
                stock_item = StockItem.objects.select_related('base_unit', 'stock_group', 'stock_category').get(id=selected_item_id)
                item_info = {
                    'id': stock_item.id,
                    'name': stock_item.name,
                    'unit': stock_item.base_unit.name if stock_item.base_unit else (getattr(stock_item, 'unit_name', '') or ''),
                    'group': stock_item.stock_group.name if stock_item.stock_group else '',
                    'category': stock_item.stock_category.name if stock_item.stock_category else '',
                    'opening_stock': float(getattr(stock_item, 'opening_stock', 0.0) or 0.0),
                    'rate': float(getattr(stock_item, 'rate', 0.0) or getattr(stock_item, 'sales_price', 0.0) or 0.0),
                }
            except StockItem.DoesNotExist:
                pass

        # Calculate opening balance prior to from_date
        opening_qs = StockTable.objects.filter(is_active=True)
        if selected_item_id and str(selected_item_id).lower() != 'all':
            opening_qs = opening_qs.filter(item_id=selected_item_id)
        if from_date and from_date.strip() and from_date != 'null':
            opening_qs = opening_qs.filter(date__lt=from_date)

        opening_qty = 0.0
        opening_val = 0.0

        for row in opening_qs:
            qty = float(row.quantity or 0.0)
            rate = float(row.rate or 0.0)
            val = qty * rate
            if row.movement_type == 'IN':
                opening_qty += qty
                opening_val += val
            elif row.movement_type == 'OUT':
                opening_qty -= qty
                opening_val -= val

        opening_rate = (opening_val / opening_qty) if opening_qty != 0 else 0.0

        # Filter period entries
        period_qs = StockTable.objects.filter(is_active=True).select_related('item', 'item__base_unit', 'warehouse')
        if selected_item_id and str(selected_item_id).lower() != 'all':
            period_qs = period_qs.filter(item_id=selected_item_id)
        if from_date and from_date.strip() and from_date != 'null':
            period_qs = period_qs.filter(date__gte=from_date)
        if to_date and to_date.strip() and to_date != 'null':
            period_qs = period_qs.filter(date__lte=to_date)

        period_qs = period_qs.order_by('date', 'time', 'id')

        # Cache voucher info to avoid N+1 queries
        sales_invoices = {}
        purchase_invoices = {}
        sales_returns = {}
        purchase_returns = {}

        entries = []
        for row in period_qs:
            item_obj = row.item
            item_name = item_obj.name if item_obj else 'Unknown Item'
            unit_name = (item_obj.base_unit.name or getattr(item_obj.base_unit, 'symbol', '')) if (item_obj and item_obj.base_unit) else ''
            
            ref_id = row.reference_id
            t_type = (row.transaction_type or '').upper()
            
            particulars = ''
            voucher_no = str(ref_id or '')
            voucher_type_name = t_type.replace('_', ' ').title()

            if ('SALES_INVOICE' in t_type or t_type == 'SALES') and ref_id:
                if ref_id not in sales_invoices:
                    try:
                        from sales_app.models import SalesInvoice
                        inv = SalesInvoice.objects.select_related('customer_ledger', 'voucher_type').get(id=ref_id)
                        sales_invoices[ref_id] = {
                            'party': getattr(inv.customer_ledger, 'name', 'Sales Customer') if inv.customer_ledger else 'Sales Customer',
                            'v_no': getattr(inv, 'invoice_no', None) or getattr(inv, 'voucher_no', None) or str(inv.id),
                            'v_type': getattr(inv.voucher_type, 'name', 'Sales Invoice') if inv.voucher_type else 'Sales Invoice'
                        }
                    except Exception as e:
                        print('StockItemBookAPIView sales invoice error:', e)
                        sales_invoices[ref_id] = {'party': 'Sales Customer', 'v_no': str(ref_id), 'v_type': 'Sales Invoice'}
                info = sales_invoices[ref_id]
                particulars = info['party']
                voucher_no = info['v_no']
                voucher_type_name = info['v_type']

            elif ('PURCHASE_INVOICE' in t_type or t_type == 'PURCHASE') and ref_id:
                if ref_id not in purchase_invoices:
                    try:
                        from purchase_app.models import PurchaseInvoice
                        inv = PurchaseInvoice.objects.select_related('supplier_ledger', 'voucher_type').get(id=ref_id)
                        purchase_invoices[ref_id] = {
                            'party': getattr(inv.supplier_ledger, 'name', 'Supplier') if inv.supplier_ledger else 'Supplier',
                            'v_no': getattr(inv, 'invoice_no', None) or getattr(inv, 'supplier_invoice_no', None) or str(inv.id),
                            'v_type': getattr(inv.voucher_type, 'name', 'Purchase Invoice') if inv.voucher_type else 'Purchase Invoice'
                        }
                    except Exception as e:
                        print('StockItemBookAPIView purchase invoice error:', e)
                        purchase_invoices[ref_id] = {'party': 'Supplier', 'v_no': str(ref_id), 'v_type': 'Purchase Invoice'}
                info = purchase_invoices[ref_id]
                particulars = info['party']
                voucher_no = info['v_no']
                voucher_type_name = info['v_type']

            elif 'SALES_RETURN' in t_type and ref_id:
                if ref_id not in sales_returns:
                    try:
                        from sales_app.models import SalesReturn
                        ret = SalesReturn.objects.select_related('customer_ledger', 'voucher_type').get(id=ref_id)
                        sales_returns[ref_id] = {
                            'party': getattr(ret.customer_ledger, 'name', 'Customer Return') if ret.customer_ledger else 'Customer Return',
                            'v_no': getattr(ret, 'return_number', None) or getattr(ret, 'return_no', None) or str(ret.id),
                            'v_type': getattr(ret.voucher_type, 'name', 'Sales Return') if ret.voucher_type else 'Sales Return'
                        }
                    except Exception as e:
                        print('StockItemBookAPIView sales return error:', e)
                        sales_returns[ref_id] = {'party': 'Customer Return', 'v_no': str(ref_id), 'v_type': 'Sales Return'}
                info = sales_returns[ref_id]
                particulars = info['party']
                voucher_no = info['v_no']
                voucher_type_name = info['v_type']

            elif 'PURCHASE_RETURN' in t_type and ref_id:
                if ref_id not in purchase_returns:
                    try:
                        from purchase_app.models import PurchaseReturn
                        ret = PurchaseReturn.objects.select_related('supplier_ledger', 'voucher_type').get(id=ref_id)
                        purchase_returns[ref_id] = {
                            'party': getattr(ret.supplier_ledger, 'name', 'Supplier Return') if ret.supplier_ledger else 'Supplier Return',
                            'v_no': getattr(ret, 'return_number', None) or getattr(ret, 'return_no', None) or str(ret.id),
                            'v_type': getattr(ret.voucher_type, 'name', 'Purchase Return') if ret.voucher_type else 'Purchase Return'
                        }
                    except Exception as e:
                        print('StockItemBookAPIView purchase return error:', e)
                        purchase_returns[ref_id] = {'party': 'Supplier Return', 'v_no': str(ref_id), 'v_type': 'Purchase Return'}
                info = purchase_returns[ref_id]
                particulars = info['party']
                voucher_no = info['v_no']
                voucher_type_name = info['v_type']

            elif t_type == 'STOCK_JOURNAL':
                particulars = 'Stock Journal Entry'
                voucher_type_name = 'Stock Journal'
            elif t_type == 'MANUFACTURING_JOURNAL':
                particulars = 'Manufacturing Journal Entry'
                voucher_type_name = 'Manufacturing Journal'
            elif t_type == 'PHYSICAL_STOCK':
                particulars = 'Physical Stock Adjustment'
                voucher_type_name = 'Physical Stock'
            elif t_type == 'WAREHOUSE_TRANSFER':
                particulars = f"Transfer ({row.warehouse.name if row.warehouse else ''})"
                voucher_type_name = 'Warehouse Transfer'
            elif t_type == 'OPENING STOCK':
                particulars = 'Opening Balance Entry'
                voucher_type_name = 'Opening Stock'
            else:
                particulars = particulars or item_name

            qty = float(row.quantity or 0.0)
            rate = float(row.rate or 0.0)
            val = qty * rate

            inward_qty = qty if row.movement_type == 'IN' else 0.0
            inward_rate = rate if row.movement_type == 'IN' else 0.0
            inward_val = val if row.movement_type == 'IN' else 0.0

            outward_qty = qty if row.movement_type == 'OUT' else 0.0
            outward_rate = rate if row.movement_type == 'OUT' else 0.0
            outward_val = val if row.movement_type == 'OUT' else 0.0

            entries.append({
                'id': row.id,
                'date': row.date.strftime('%Y-%m-%d') if row.date else '',
                'time': row.time.strftime('%H:%M:%S') if row.time else '',
                'item_id': row.item_id,
                'item_name': item_name,
                'unit_name': unit_name,
                'particulars': particulars,
                'voucher_type': voucher_type_name,
                'transaction_type': t_type,
                'voucher_no': voucher_no,
                'reference_id': ref_id,
                'movement_type': row.movement_type,
                'warehouse_name': row.warehouse.name if row.warehouse else '',
                'batch_number': row.batch_number or '',
                'inward_qty': inward_qty,
                'inward_rate': inward_rate,
                'inward_val': inward_val,
                'outward_qty': outward_qty,
                'outward_rate': outward_rate,
                'outward_val': outward_val,
            })

        return Response({
            'status': True,
            'company': company_info,
            'item': item_info,
            'opening_qty': round(opening_qty, 3),
            'opening_val': round(opening_val, 2),
            'opening_rate': round(opening_rate, 2),
            'entries': entries
        }, status=status.HTTP_200_OK)


