from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.utils import timezone
import re

from .models import (
    LeadSource, CrmService, LeadCategory, Industry, Lead, LeadAttachment,
    LeadImage, CrmLeadFollowUp, CrmPurpose, LeadImportBatch, LeadImportStaging, CrmOffer
)
from .serializers import (
    LeadSourceSerializer, CrmServiceSerializer, LeadCategorySerializer,
    IndustrySerializer, LeadSerializer, LeadAttachmentSerializer, LeadImageSerializer,
    CrmLeadFollowUpSerializer, CrmPurposeSerializer,
    LeadImportBatchSerializer, LeadImportBatchListSerializer, LeadImportStagingSerializer,
    CrmOfferSerializer
)
from project_app.models import MarketingLead

class CrmOfferViewSet(viewsets.ModelViewSet):
    queryset = CrmOffer.objects.all().select_related('created_by', 'category')
    serializer_class = CrmOfferSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'status', 'offer_type', 'criteria_type', 'category']
    search_fields = ['title', 'code', 'description', 'terms_and_conditions']
    ordering_fields = ['title', 'created_at', 'start_date', 'end_date', 'discount_percent', 'discount_amount', 'status', 'criteria_type']
    ordering = ['-created_at']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user if self.request.user and self.request.user.is_authenticated else None)

    @action(detail=False, methods=['get'])
    def active_offers(self, request):
        today = timezone.now().date()
        from django.db.models import Q
        qs = self.get_queryset().filter(is_active=True, status='Active')
        qs = qs.filter(
            Q(start_date__isnull=True) | Q(start_date__lte=today)
        ).filter(
            Q(end_date__isnull=True) | Q(end_date__gte=today)
        )
        category_id = request.query_params.get('category')
        if category_id:
            qs = qs.filter(Q(category_id=category_id) | Q(category__isnull=True))
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

class CrmPurposeViewSet(viewsets.ModelViewSet):
    queryset = CrmPurpose.objects.all()
    serializer_class = CrmPurposeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']


class LeadSourceViewSet(viewsets.ModelViewSet):
    queryset = LeadSource.objects.all()
    serializer_class = LeadSourceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']


class CrmServiceViewSet(viewsets.ModelViewSet):
    queryset = CrmService.objects.all()
    serializer_class = CrmServiceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']


class LeadCategoryViewSet(viewsets.ModelViewSet):
    queryset = LeadCategory.objects.all()
    serializer_class = LeadCategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']


class IndustryViewSet(viewsets.ModelViewSet):
    queryset = Industry.objects.all()
    serializer_class = IndustrySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']


def normalize_phone(value):
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        s = str(int(value)).strip()
    else:
        s = str(value).strip()

    if s.startswith('+91'):
        s = s[3:]
    elif s.startswith('+'):
        s = s[1:]

    digits = re.sub(r'\D', '', s)
    digits = digits.lstrip('0')
    if len(digits) == 12 and digits.startswith('91'):
        digits = digits[2:]
        digits = digits.lstrip('0')
    return digits


def validate_batch(batch):
    """
    Validates all staging rows for a given LeadImportBatch instance in database.
    - Normalizes phone numbers and checks requirement
    - Matches category / source / industry case-insensitively and trimmed
    - Flags in-file duplicate phones (later rows get is_duplicate_in_file=True)
    - Matches existing leads in crm_lead by normalized phone
    - Sets validation_status ('VALID' or 'INVALID') and error_messages
    - Updates batch counters (total_rows, valid_rows, invalid_rows) and status ('HAS_ISSUES' or 'READY')
    Returns summary dict.
    """
    rows = list(batch.rows.all().order_by('row_number'))

    categories_cache = {c.name.strip().lower(): c for c in LeadCategory.objects.all()}
    sources_cache = {s.name.strip().lower(): s for s in LeadSource.objects.all()}
    industries_cache = {ind.name.strip().lower(): ind for ind in Industry.objects.all()}

    # Map existing leads by normalized phone
    existing_leads_map = {}
    for lead in Lead.objects.all():
        np = normalize_phone(lead.phone)
        if np and np not in existing_leads_map:
            existing_leads_map[np] = lead
        nm = normalize_phone(lead.mobile)
        if nm and nm not in existing_leads_map:
            existing_leads_map[nm] = lead

    seen_file_phones = {}  # norm_phone -> first_row_number
    missing_categories = {}   # name -> list of row numbers
    missing_sources = {}      # name -> list of row numbers
    missing_industries = {}   # name -> list of row numbers

    valid_rows_count = 0
    invalid_rows_count = 0

    for row in rows:
        row_errors = []
        raw_phone = (row.phone or '').strip()
        if not raw_phone and row.mobile:
            raw_phone = (row.mobile or '').strip()

        norm_phone = normalize_phone(raw_phone)
        row.normalized_phone = norm_phone
        row.is_duplicate_in_file = False

        if not raw_phone or not norm_phone:
            row_errors.append("Phone number is required.")
        elif norm_phone in seen_file_phones:
            row.is_duplicate_in_file = True
            first_row_num = seen_file_phones[norm_phone]
            row_errors.append(f"Duplicate phone in file (same as row {first_row_num}).")
        else:
            seen_file_phones[norm_phone] = row.row_number

        # Category check
        cat_name = (row.category_name or '').strip()
        if cat_name:
            cat_obj = categories_cache.get(cat_name.lower())
            if cat_obj:
                row.category = cat_obj
            else:
                row.category = None
                missing_categories.setdefault(cat_name, []).append(row.row_number)
                row_errors.append(f"Category '{cat_name}' not found in database.")
        else:
            row.category = None

        # Source check
        src_name = (row.source_name or '').strip()
        if src_name:
            src_obj = sources_cache.get(src_name.lower())
            if src_obj:
                row.lead_source = src_obj
            else:
                row.lead_source = None
                missing_sources.setdefault(src_name, []).append(row.row_number)
                row_errors.append(f"Source '{src_name}' not found in database.")
        else:
            row.lead_source = None

        # Industry check
        ind_name = (row.industry_name or '').strip()
        if ind_name:
            ind_obj = industries_cache.get(ind_name.lower())
            if ind_obj:
                row.industry = ind_obj
            else:
                row.industry = None
                missing_industries.setdefault(ind_name, []).append(row.row_number)
                row_errors.append(f"Industry '{ind_name}' not found in database.")
        else:
            row.industry = None

        # Check existing lead match
        if norm_phone and norm_phone in existing_leads_map:
            row.existing_lead = existing_leads_map[norm_phone]
        else:
            row.existing_lead = None

        # Set validation status
        if row_errors:
            row.validation_status = 'INVALID'
            row.error_messages = row_errors
            invalid_rows_count += 1
        else:
            row.validation_status = 'VALID'
            row.error_messages = []
            valid_rows_count += 1

    # Bulk update staging rows
    LeadImportStaging.objects.bulk_update(
        rows,
        ['normalized_phone', 'category', 'lead_source', 'industry', 'validation_status', 'error_messages', 'is_duplicate_in_file', 'existing_lead']
    )

    batch.total_rows = len(rows)
    batch.valid_rows = valid_rows_count
    batch.invalid_rows = invalid_rows_count
    if invalid_rows_count > 0:
        batch.status = 'HAS_ISSUES'
    else:
        batch.status = 'READY'
    batch.save(update_fields=['total_rows', 'valid_rows', 'invalid_rows', 'status'])

    has_missing_masters = bool(missing_categories or missing_sources or missing_industries)

    return {
        "batch_id": batch.id,
        "status": batch.status,
        "total_rows": batch.total_rows,
        "valid_rows_count": batch.valid_rows,
        "invalid_rows_count": batch.invalid_rows,
        "has_missing_masters": has_missing_masters,
        "missing_masters": {
            "categories": [{"name": k, "rows": sorted(list(set(v)))} for k, v in sorted(missing_categories.items())],
            "sources": [{"name": k, "rows": sorted(list(set(v)))} for k, v in sorted(missing_sources.items())],
            "industries": [{"name": k, "rows": sorted(list(set(v)))} for k, v in sorted(missing_industries.items())]
        }
    }


def parse_excel_and_create_staging(file, user=None):
    """
    Parses uploaded Excel file and creates a LeadImportBatch with LeadImportStaging rows.
    Then executes validate_batch(batch).
    """
    import openpyxl
    wb = openpyxl.load_workbook(file, data_only=True)
    if "Leads" in wb.sheetnames:
        ws = wb["Leads"]
    else:
        ws = wb.active

    rows = list(ws.rows)
    if not rows or len(rows) < 2:
        raise ValueError("The Excel sheet is empty or contains no data rows.")

    def clean_header(val):
        if not val:
            return ""
        return re.sub(r'[^a-z0-9]', '', str(val).lower())

    headers = [clean_header(cell.value) for cell in rows[0]]

    def get_col_idx(aliases):
        for alias in aliases:
            cleaned_alias = clean_header(alias)
            if cleaned_alias in headers:
                return headers.index(cleaned_alias)
        return -1

    phone_idx = get_col_idx(["phone", "phonenumber", "contact", "contactnumber", "mobile", "mobilenumber"])
    first_name_idx = get_col_idx(["firstname", "first", "name"])
    last_name_idx = get_col_idx(["lastname", "last"])
    company_idx = get_col_idx(["company", "companyname", "organization", "business"])
    email_idx = get_col_idx(["email", "emailaddress", "mail"])
    mobile_idx = get_col_idx(["mobile", "mobilenumber", "secondaryphone"])
    title_idx = get_col_idx(["title", "designation", "position", "role"])
    category_idx = get_col_idx(["category", "leadcategory"])
    source_idx = get_col_idx(["source", "leadsource"])
    industry_idx = get_col_idx(["industry", "leadindustry"])
    status_idx = get_col_idx(["status", "leadstatus"])
    rating_idx = get_col_idx(["rating"])
    priority_idx = get_col_idx(["priority"])
    estimated_value_idx = get_col_idx(["estimatedvalue", "value", "amount", "dealvalue"])
    employees_idx = get_col_idx(["noofemployees", "numberofemployees", "employees"])
    revenue_idx = get_col_idx(["annualrevenue", "revenue"])
    website_idx = get_col_idx(["website", "web", "url"])
    country_idx = get_col_idx(["country"])
    state_idx = get_col_idx(["state", "stateprovince", "province"])
    city_idx = get_col_idx(["city"])
    street_idx = get_col_idx(["streetaddress", "address", "street", "flathouseno"])
    pincode_idx = get_col_idx(["pincode", "zipcode", "postalcode", "zip", "zippostalcode"])
    description_idx = get_col_idx(["description", "notes", "remarks"])

    if phone_idx == -1 and mobile_idx == -1:
        raise ValueError("A column for 'Phone' or 'Mobile' is required in header.")

    def clean_cell_str(row_cells, idx):
        if idx == -1 or idx >= len(row_cells):
            return ""
        val = row_cells[idx].value
        if val is None:
            return ""
        if isinstance(val, float) and val.is_integer():
            return str(int(val)).strip()
        return str(val).strip()

    staging_objs = []
    with transaction.atomic():
        batch = LeadImportBatch.objects.create(
            file_name=getattr(file, 'name', 'leads_import.xlsx'),
            uploaded_by=user if (user and getattr(user, 'is_authenticated', False)) else None,
            status='UPLOADED'
        )

        for row_idx, row in enumerate(rows[1:], start=2):
            if not any(cell.value is not None and str(cell.value).strip() != "" for cell in row):
                continue

            raw_phone = clean_cell_str(row, phone_idx) if phone_idx != -1 else ""
            if not raw_phone and mobile_idx != -1:
                raw_phone = clean_cell_str(row, mobile_idx)

            staging_objs.append(LeadImportStaging(
                batch=batch,
                row_number=row_idx,
                phone=raw_phone,
                first_name=clean_cell_str(row, first_name_idx),
                last_name=clean_cell_str(row, last_name_idx),
                company=clean_cell_str(row, company_idx),
                email=clean_cell_str(row, email_idx),
                mobile=clean_cell_str(row, mobile_idx),
                title=clean_cell_str(row, title_idx),
                category_name=clean_cell_str(row, category_idx),
                source_name=clean_cell_str(row, source_idx),
                industry_name=clean_cell_str(row, industry_idx),
                lead_status=clean_cell_str(row, status_idx),
                rating=clean_cell_str(row, rating_idx),
                priority=clean_cell_str(row, priority_idx),
                estimated_value=clean_cell_str(row, estimated_value_idx),
                no_of_employees=clean_cell_str(row, employees_idx),
                annual_revenue=clean_cell_str(row, revenue_idx),
                website=clean_cell_str(row, website_idx),
                country=clean_cell_str(row, country_idx),
                state_province=clean_cell_str(row, state_idx),
                city=clean_cell_str(row, city_idx),
                street_address=clean_cell_str(row, street_idx),
                zip_postal_code=clean_cell_str(row, pincode_idx),
                description=clean_cell_str(row, description_idx)
            ))

        LeadImportStaging.objects.bulk_create(staging_objs)

    validation_summary = validate_batch(batch)
    return batch, validation_summary


def push_batch_to_leads(batch, skip_invalid=False, user=None):
    """
    Pushes rows from database staging table (LeadImportStaging) to original Lead table.
    - If skip_invalid is False and invalid rows exist, raises ValueError.
    - Atomic transaction: rolls back completely on any error.
    - Matches by normalized phone to prevent duplicates (updates existing leads).
    - Sets row validation_status='PUSHED', batch status='PUSHED' and pushed_at.
    """
    if batch.status in ['PUSHED', 'CANCELLED']:
        raise ValueError(f"Batch is already {batch.status} and cannot be pushed again.")

    if not skip_invalid and batch.invalid_rows > 0:
        raise ValueError(f"Cannot push batch: {batch.invalid_rows} invalid row(s) found. Resolve issues or confirm skip_invalid.")

    if skip_invalid:
        rows_to_push = list(batch.rows.filter(validation_status='VALID').order_by('row_number'))
    else:
        rows_to_push = list(batch.rows.all().order_by('row_number'))
        invalid = [r for r in rows_to_push if r.validation_status != 'VALID']
        if invalid:
            raise ValueError(f"Cannot push batch: row {invalid[0].row_number} is not valid ({invalid[0].error_messages}).")

    if not rows_to_push:
        raise ValueError("No valid rows to push.")

    valid_statuses = dict(Lead.LEAD_STATUS_CHOICES)
    status_map = {k.lower(): k for k in valid_statuses.keys()}

    valid_ratings = dict(Lead.RATING_CHOICES)
    rating_map = {k.lower(): k for k in valid_ratings.keys()}

    valid_priorities = dict(Lead.PRIORITY_CHOICES)
    priority_map = {k.lower(): k for k in valid_priorities.keys()}

    def parse_float(val):
        if val is None or val == "":
            return None
        try:
            return float(val)
        except (ValueError, TypeError):
            return None

    def parse_int(val):
        if val is None or val == "":
            return None
        try:
            return int(float(val))
        except (ValueError, TypeError):
            return None

    added = 0
    updated = 0

    with transaction.atomic():
        leads_by_norm_phone = {}
        for lead in Lead.objects.all():
            np = normalize_phone(lead.phone)
            if np and np not in leads_by_norm_phone:
                leads_by_norm_phone[np] = lead
            nm = normalize_phone(lead.mobile)
            if nm and nm not in leads_by_norm_phone:
                leads_by_norm_phone[nm] = lead

        for row in rows_to_push:
            norm_phone = row.normalized_phone or normalize_phone(row.phone)
            if not norm_phone:
                raise ValueError(f"Row {row.row_number}: Valid phone number is required.")

            lead_status = status_map.get((row.lead_status or '').strip().lower(), 'Not Contacted')
            rating = rating_map.get((row.rating or '').strip().lower(), 'Warm')
            priority = priority_map.get((row.priority or '').strip().lower(), 'Medium')

            existing_lead = leads_by_norm_phone.get(norm_phone)
            if existing_lead:
                if row.first_name is not None:
                    existing_lead.first_name = row.first_name
                if row.last_name is not None:
                    existing_lead.last_name = row.last_name
                if row.company is not None:
                    existing_lead.company = row.company
                if row.email is not None:
                    existing_lead.email = row.email
                if row.mobile is not None:
                    existing_lead.mobile = row.mobile
                if row.title is not None:
                    existing_lead.title = row.title
                if row.category:
                    existing_lead.category = row.category
                if row.lead_source:
                    existing_lead.lead_source = row.lead_source
                if row.industry:
                    existing_lead.industry = row.industry
                existing_lead.lead_status = lead_status
                existing_lead.rating = rating
                existing_lead.priority = priority
                if row.estimated_value is not None:
                    existing_lead.estimated_value = parse_float(row.estimated_value)
                if row.no_of_employees is not None:
                    existing_lead.no_of_employees = parse_int(row.no_of_employees)
                if row.annual_revenue is not None:
                    existing_lead.annual_revenue = parse_float(row.annual_revenue)
                if row.website is not None:
                    existing_lead.website = row.website
                if row.country is not None:
                    existing_lead.country = row.country
                if row.state_province is not None:
                    existing_lead.state_province = row.state_province
                if row.city is not None:
                    existing_lead.city = row.city
                if row.street_address is not None:
                    existing_lead.street_address = row.street_address
                if row.zip_postal_code is not None:
                    existing_lead.zip_postal_code = row.zip_postal_code
                if row.description is not None:
                    existing_lead.description = row.description

                existing_lead.save()
                updated += 1
            else:
                lead_owner = user if (user and getattr(user, 'is_authenticated', False)) else batch.uploaded_by
                new_lead = Lead(
                    lead_owner=lead_owner,
                    phone=row.phone or '',
                    first_name=row.first_name or '',
                    last_name=row.last_name or '',
                    company=row.company or '',
                    email=row.email or '',
                    mobile=row.mobile or '',
                    title=row.title or '',
                    category=row.category,
                    lead_source=row.lead_source,
                    industry=row.industry,
                    lead_status=lead_status,
                    rating=rating,
                    priority=priority,
                    estimated_value=parse_float(row.estimated_value),
                    no_of_employees=parse_int(row.no_of_employees),
                    annual_revenue=parse_float(row.annual_revenue),
                    website=row.website or '',
                    country=row.country or '',
                    state_province=row.state_province or '',
                    city=row.city or '',
                    street_address=row.street_address or '',
                    zip_postal_code=row.zip_postal_code or '',
                    description=row.description or ''
                )
                new_lead.save()
                leads_by_norm_phone[norm_phone] = new_lead
                added += 1

            row.validation_status = 'PUSHED'
            row.save(update_fields=['validation_status'])

        batch.status = 'PUSHED'
        batch.pushed_at = timezone.now()
        batch.save(update_fields=['status', 'pushed_at'])

    skipped = batch.total_rows - (added + updated)
    return {
        "added": added,
        "updated": updated,
        "skipped": max(0, skipped),
        "total": batch.total_rows,
        "batch_id": batch.id
    }


class LeadImportBatchViewSet(viewsets.ModelViewSet):
    queryset = LeadImportBatch.objects.all().order_by('-created_at')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status']
    search_fields = ['file_name']
    ordering_fields = ['created_at', 'total_rows', 'status']

    def get_serializer_class(self):
        if self.action == 'list':
            return LeadImportBatchListSerializer
        return LeadImportBatchSerializer

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_excel(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({"detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            batch, summary = parse_excel_and_create_staging(file, request.user)
            serializer = LeadImportBatchSerializer(batch)
            res_data = serializer.data
            res_data.update(summary)
            return Response(res_data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def revalidate(self, request, pk=None):
        batch = self.get_object()
        if batch.status in ['PUSHED', 'CANCELLED']:
            return Response({"detail": f"Cannot revalidate a {batch.status} batch."}, status=status.HTTP_400_BAD_REQUEST)

        summary = validate_batch(batch)
        serializer = LeadImportBatchSerializer(batch)
        res_data = serializer.data
        res_data.update(summary)
        return Response(res_data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def push(self, request, pk=None):
        batch = self.get_object()
        skip_invalid = request.data.get('skip_invalid', False)
        if isinstance(skip_invalid, str):
            skip_invalid = skip_invalid.lower() in ['true', '1', 'yes']

        try:
            result = push_batch_to_leads(batch, skip_invalid=skip_invalid, user=request.user)
            return Response({
                "message": f"Successfully pushed {result['added'] + result['updated']} leads.",
                "added": result['added'],
                "updated": result['updated'],
                "skipped": result['skipped'],
                "batch_id": batch.id
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post', 'delete'])
    def cancel(self, request, pk=None):
        batch = self.get_object()
        batch.status = 'CANCELLED'
        batch.save(update_fields=['status'])
        return Response({"message": f"Batch #{batch.id} has been cancelled.", "status": "CANCELLED"}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def cleanup(self, request):
        batches = LeadImportBatch.objects.filter(status__in=['PUSHED', 'CANCELLED'])
        deleted_count = batches.count()
        batches.delete()
        return Response({"message": f"Deleted {deleted_count} completed/cancelled batches.", "deleted_count": deleted_count}, status=status.HTTP_200_OK)



class LeadImportStagingViewSet(viewsets.ModelViewSet):
    queryset = LeadImportStaging.objects.all().select_related('batch', 'category', 'lead_source', 'industry', 'existing_lead')
    serializer_class = LeadImportStagingSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['batch', 'validation_status', 'is_duplicate_in_file']
    search_fields = ['phone', 'first_name', 'last_name', 'company', 'category_name', 'source_name', 'industry_name']

    def perform_update(self, serializer):
        row = serializer.save()
        validate_batch(row.batch)


class LeadViewSet(viewsets.ModelViewSet):
    queryset = Lead.objects.all().select_related('lead_owner', 'category', 'lead_source', 'industry').prefetch_related('attachments', 'images', 'products', 'services')
    serializer_class = LeadSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['lead_status', 'category', 'lead_source', 'industry', 'priority', 'rating', 'has_product_interest', 'has_service_interest']
    search_fields = ['first_name', 'last_name', 'company', 'phone', 'email', 'other_owner_name', 'assigned_sales_employees']
    ordering_fields = ['created_at', 'company', 'first_name', 'estimated_value', 'priority']

    def perform_create(self, serializer):
        lead = serializer.save()
        self._handle_attachments(lead)
        self._handle_images(lead)

    def perform_update(self, serializer):
        lead = serializer.save()
        self._handle_attachments(lead)
        self._handle_images(lead)

    def _handle_attachments(self, lead):
        files = self.request.FILES.getlist('attachments') or self.request.FILES.getlist('files')
        for f in files:
            LeadAttachment.objects.create(
                lead=lead,
                file=f,
                file_name=f.name,
                file_size=f.size
            )

    def _handle_images(self, lead):
        files = self.request.FILES.getlist('images') or self.request.FILES.getlist('image_files')
        for f in files:
            LeadImage.objects.create(
                lead=lead,
                image=f,
                image_name=f.name,
                image_size=f.size
            )
        if not lead.image and files:
            first_img = lead.images.first()
            if first_img:
                lead.image = first_img.image
                lead.save(update_fields=['image'])

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_attachments(self, request, pk=None):
        lead = self.get_object()
        files = request.FILES.getlist('attachments') or request.FILES.getlist('files')
        if not files:
            return Response({'error': 'No files provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        created = []
        for f in files:
            att = LeadAttachment.objects.create(
                lead=lead,
                file=f,
                file_name=f.name,
                file_size=f.size
            )
            created.append(LeadAttachmentSerializer(att).data)
        return Response({'message': f'{len(created)} attachments uploaded', 'attachments': created}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='delete_attachment/(?P<attachment_id>[^/.]+)')
    def delete_attachment(self, request, pk=None, attachment_id=None):
        lead = self.get_object()
        try:
            att = lead.attachments.get(id=attachment_id)
            if att.file:
                att.file.delete(save=False)
            att.delete()
            return Response({'message': 'Attachment deleted successfully'}, status=status.HTTP_200_OK)
        except LeadAttachment.DoesNotExist:
            return Response({'error': 'Attachment not found'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_images(self, request, pk=None):
        lead = self.get_object()
        files = request.FILES.getlist('images') or request.FILES.getlist('image_files')
        if not files:
            return Response({'error': 'No images provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        created = []
        for f in files:
            img = LeadImage.objects.create(
                lead=lead,
                image=f,
                image_name=f.name,
                image_size=f.size
            )
            created.append(LeadImageSerializer(img).data)
        if not lead.image and created:
            first_img = lead.images.first()
            if first_img:
                lead.image = first_img.image
                lead.save(update_fields=['image'])
        return Response({'message': f'{len(created)} images uploaded', 'images': created}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='delete_image/(?P<image_id>[^/.]+)')
    def delete_image(self, request, pk=None, image_id=None):
        lead = self.get_object()
        try:
            img = lead.images.get(id=image_id)
            if img.image:
                img.image.delete(save=False)
            img.delete()
            return Response({'message': 'Image deleted successfully'}, status=status.HTTP_200_OK)
        except LeadImage.DoesNotExist:
            return Response({'error': 'Image not found'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'])
    def download_template(self, request):
        import openpyxl
        from django.http import HttpResponse
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Leads"

        headers = [
            "Phone*", "First Name", "Last Name", "Company", "Email", "Mobile",
            "Title", "Category", "Source", "Industry", "Status",
            "Estimated Value", "No of Employees", "Annual Revenue", "Website",
            "Country", "State", "City", "Street Address", "Pincode", "Description"
        ]
        ws.append(headers)

        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename="Leads_Template.xlsx"'
        wb.save(response)
        return response

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_excel(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({"detail": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            batch, summary = parse_excel_and_create_staging(file, request.user)
            serializer = LeadImportBatchSerializer(batch)
            res_data = serializer.data
            res_data.update(summary)
            return Response(res_data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"detail": f"Failed to parse Excel file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def preview_excel(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({"detail": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            batch, summary = parse_excel_and_create_staging(file, request.user)
            serializer = LeadImportBatchSerializer(batch)
            res_data = serializer.data
            res_data.update(summary)
            return Response(res_data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": f"Failed to parse Excel file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def create_missing_masters(self, request):
        data = request.data or {}
        categories = data.get('categories', [])
        sources = data.get('sources', [])
        industries = data.get('industries', [])
        batch_id = data.get('batch_id')

        created = {"categories": [], "sources": [], "industries": []}
        existing = {"categories": [], "sources": [], "industries": []}

        def process_items(model_cls, items_list, key_name):
            for item in items_list:
                name = item.get('name') if isinstance(item, dict) else item
                if not name or not isinstance(name, str):
                    continue
                clean_name = name.strip()
                if not clean_name or len(clean_name) > 100:
                    continue

                obj = model_cls.objects.filter(name__iexact=clean_name).first()
                if obj:
                    if obj.name not in existing[key_name]:
                        existing[key_name].append(obj.name)
                else:
                    new_obj = model_cls.objects.create(name=clean_name)
                    created[key_name].append(new_obj.name)

        try:
            with transaction.atomic():
                process_items(LeadCategory, categories, "categories")
                process_items(LeadSource, sources, "sources")
                process_items(Industry, industries, "industries")

            batch_data = None
            if batch_id:
                try:
                    batch = LeadImportBatch.objects.get(id=batch_id)
                    summary = validate_batch(batch)
                    batch_serializer = LeadImportBatchSerializer(batch)
                    batch_data = batch_serializer.data
                    batch_data.update(summary)
                except LeadImportBatch.DoesNotExist:
                    pass

            return Response({
                "message": "Missing master data processed successfully.",
                "created": created,
                "existing": existing,
                "batch": batch_data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": f"Failed to create missing masters: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], parser_classes=[JSONParser, MultiPartParser, FormParser])
    def confirm_import(self, request):
        batch_id = request.data.get('batch_id')
        if batch_id:
            try:
                batch = LeadImportBatch.objects.get(id=batch_id)
                skip_invalid = request.data.get('skip_invalid', False)
                result = push_batch_to_leads(batch, skip_invalid=skip_invalid, user=request.user)
                return Response({
                    "message": f"Successfully processed {result['added'] + result['updated']} leads.",
                    "added": result['added'],
                    "updated": result['updated'],
                    "skipped": result['skipped'],
                    "batch_id": batch.id
                }, status=status.HTTP_200_OK)
            except Exception as e:
                return Response({"detail": f"Import error: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        # Fallback for raw rows payload
        rows = request.data.get('rows', [])
        if not rows or not isinstance(rows, list):
            return Response({"detail": "No rows or batch_id provided to import."}, status=status.HTTP_400_BAD_REQUEST)

        categories_cache = {c.name.strip().lower(): c for c in LeadCategory.objects.all()}
        sources_cache = {s.name.strip().lower(): s for s in LeadSource.objects.all()}
        industries_cache = {ind.name.strip().lower(): ind for ind in Industry.objects.all()}

        leads_by_norm_phone = {}
        for lead in Lead.objects.all():
            np = normalize_phone(lead.phone)
            if np and np not in leads_by_norm_phone:
                leads_by_norm_phone[np] = lead
            nm = normalize_phone(lead.mobile)
            if nm and nm not in leads_by_norm_phone:
                leads_by_norm_phone[nm] = lead

        added = 0
        updated = 0
        errors = []
        seen_import_phones = {}

        try:
            with transaction.atomic():
                for row_data in rows:
                    row_num = row_data.get('row_number', '?')
                    raw_phone = str(row_data.get('phone') or '').strip()
                    norm_phone = normalize_phone(raw_phone)

                    if not raw_phone or not norm_phone:
                        errors.append(f"Row {row_num}: Phone number is missing or invalid.")
                        continue

                    if norm_phone in seen_import_phones:
                        errors.append(f"Row {row_num}: Duplicate phone in file (same phone as row {seen_import_phones[norm_phone]}).")
                        continue
                    seen_import_phones[norm_phone] = row_num

                    category_obj = None
                    if cat_id := row_data.get('category'):
                        category_obj = LeadCategory.objects.filter(id=cat_id).first()
                    elif cat_name := row_data.get('category_name'):
                        category_obj = categories_cache.get(cat_name.strip().lower())
                        if not category_obj:
                            errors.append(f"Row {row_num}: Category '{cat_name}' not found in database.")

                    source_obj = None
                    if src_id := row_data.get('lead_source'):
                        source_obj = LeadSource.objects.filter(id=src_id).first()
                    elif src_name := row_data.get('source_name'):
                        source_obj = sources_cache.get(src_name.strip().lower())
                        if not source_obj:
                            errors.append(f"Row {row_num}: Source '{src_name}' not found in database.")

                    industry_obj = None
                    if ind_id := row_data.get('industry'):
                        industry_obj = Industry.objects.filter(id=ind_id).first()
                    elif ind_name := row_data.get('industry_name'):
                        industry_obj = industries_cache.get(ind_name.strip().lower())
                        if not industry_obj:
                            errors.append(f"Row {row_num}: Industry '{ind_name}' not found in database.")

                    if errors:
                        continue

                    existing_lead = leads_by_norm_phone.get(norm_phone)
                    if existing_lead:
                        if row_data.get('first_name') is not None:
                            existing_lead.first_name = row_data.get('first_name')
                        if row_data.get('last_name') is not None:
                            existing_lead.last_name = row_data.get('last_name')
                        if row_data.get('company') is not None:
                            existing_lead.company = row_data.get('company')
                        if row_data.get('email') is not None:
                            existing_lead.email = row_data.get('email')
                        if row_data.get('mobile') is not None:
                            existing_lead.mobile = row_data.get('mobile')
                        if row_data.get('title') is not None:
                            existing_lead.title = row_data.get('title')
                        if category_obj:
                            existing_lead.category = category_obj
                        if source_obj:
                            existing_lead.lead_source = source_obj
                        if industry_obj:
                            existing_lead.industry = industry_obj
                        if row_data.get('lead_status'):
                            existing_lead.lead_status = row_data.get('lead_status')
                        if row_data.get('rating'):
                            existing_lead.rating = row_data.get('rating')
                        if row_data.get('priority'):
                            existing_lead.priority = row_data.get('priority')
                        if row_data.get('estimated_value') is not None:
                            existing_lead.estimated_value = row_data.get('estimated_value')
                        if row_data.get('no_of_employees') is not None:
                            existing_lead.no_of_employees = row_data.get('no_of_employees')
                        if row_data.get('annual_revenue') is not None:
                            existing_lead.annual_revenue = row_data.get('annual_revenue')
                        if row_data.get('website') is not None:
                            existing_lead.website = row_data.get('website')
                        if row_data.get('country') is not None:
                            existing_lead.country = row_data.get('country')
                        if row_data.get('state_province') is not None:
                            existing_lead.state_province = row_data.get('state_province')
                        if row_data.get('city') is not None:
                            existing_lead.city = row_data.get('city')
                        if row_data.get('street_address') is not None:
                            existing_lead.street_address = row_data.get('street_address')
                        if row_data.get('zip_postal_code') is not None:
                            existing_lead.zip_postal_code = row_data.get('zip_postal_code')
                        if row_data.get('description') is not None:
                            existing_lead.description = row_data.get('description')

                        existing_lead.save()
                        updated += 1
                    else:
                        lead = Lead(
                            lead_owner=request.user if request.user.is_authenticated else None,
                            phone=raw_phone,
                            first_name=row_data.get('first_name', ''),
                            last_name=row_data.get('last_name', ''),
                            company=row_data.get('company', ''),
                            email=row_data.get('email', ''),
                            mobile=row_data.get('mobile', ''),
                            title=row_data.get('title', ''),
                            category=category_obj,
                            lead_source=source_obj,
                            industry=industry_obj,
                            lead_status=row_data.get('lead_status', 'Not Contacted'),
                            rating=row_data.get('rating', 'Warm'),
                            priority=row_data.get('priority', 'Medium'),
                            estimated_value=row_data.get('estimated_value'),
                            no_of_employees=row_data.get('no_of_employees'),
                            annual_revenue=row_data.get('annual_revenue'),
                            website=row_data.get('website', ''),
                            country=row_data.get('country', ''),
                            state_province=row_data.get('state_province', ''),
                            city=row_data.get('city', ''),
                            street_address=row_data.get('street_address', ''),
                            zip_postal_code=row_data.get('zip_postal_code', ''),
                            description=row_data.get('description', '')
                        )
                        lead.save()
                        leads_by_norm_phone[norm_phone] = lead
                        added += 1

                if errors:
                    transaction.set_rollback(True)
                    return Response({
                        "detail": "Import failed due to validation errors. No changes were saved.",
                        "errors": errors
                    }, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                "message": f"Successfully processed {added + updated} leads.",
                "added": added,
                "updated": updated,
                "errors": []
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"detail": f"Database import error: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


class CrmLeadFollowUpViewSet(viewsets.ModelViewSet):
    queryset = CrmLeadFollowUp.objects.all()
    serializer_class = CrmLeadFollowUpSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['lead', 'status', 'telecaller', 'executive', 'category']
    search_fields = ['remarks', 'purpose', 'narration', 'lead__shop_name']
    ordering_fields = ['created_at', 'visit_date', 'next_visit_date']

    def perform_create(self, serializer):
        followup = serializer.save(telecaller=self.request.user)
        self._sync_lead_status(followup)

    def perform_update(self, serializer):
        followup = serializer.save()
        self._sync_lead_status(followup)

    def _sync_lead_status(self, followup):
        if followup.status == 'Escalated':
            from crm.models import Lead
            
            # 1. Sync to the CRM Master Lead Generation table (crm_lead)
            crm_lead = None
            if followup.lead and followup.lead.mobile_number:
                crm_lead = Lead.objects.filter(phone=followup.lead.mobile_number).first()
                if not crm_lead:
                    crm_lead = Lead.objects.filter(mobile=followup.lead.mobile_number).first()
            
            if not crm_lead and followup.lead and followup.lead.shop_name:
                crm_lead = Lead.objects.filter(company=followup.lead.shop_name).first()
                
            if crm_lead:
                crm_lead.lead_status = 'Escalated'
                crm_lead.save(update_fields=['lead_status'])
            elif followup.lead:
                # If no matching CRM Lead exists, create one to reflect in the CRM Master
                Lead.objects.create(
                    first_name=followup.lead.shop_name or 'Unknown',
                    company=followup.lead.shop_name,
                    phone=followup.lead.mobile_number,
                    mobile=followup.lead.mobile_number,
                    street_address=followup.lead.address,
                    city=followup.lead.city,
                    state_province=followup.lead.state,
                    lead_status='Escalated',
                    description=followup.remarks
                )
                
            # 2. Sync to the MarketingLead itself so it disappears from 'Active' lists
            if followup.lead:
                followup.lead.status = 'Escalated'
                followup.lead.save(update_fields=['status'])

    @action(detail=False, methods=['get'])
    def locations(self, request):
        try:
            employee = request.user.employee
        except Exception:
            return Response({'locations': []})
        
        from area_app.models import SalesmanVisiting
        from django.db.models import Q

        # Fetch location names from SalesmanVisiting for the employee
        allowed_dl_names = SalesmanVisiting.objects.filter(
            salesman_mapping__employee=employee
        ).values_list('delivery_location__location_name', flat=True).distinct()
        
        if not allowed_dl_names:
            return Response({'locations': []})

        q_objects = Q()
        for dl_name in allowed_dl_names:
            if dl_name:
                q_objects |= Q(location__icontains=dl_name) | Q(city__icontains=dl_name)
        
        locations = MarketingLead.objects.exclude(location__isnull=True).exclude(location='').filter(q_objects).values_list('location', flat=True).distinct()
        return Response({'locations': list(locations)})

    @action(detail=False, methods=['get'])
    def pending_leads(self, request):
        try:
            employee = request.user.employee
        except Exception:
            return Response([])

        from area_app.models import SalesmanVisiting
        from django.db.models import Q
        
        # Fetch location names from SalesmanVisiting for the employee
        allowed_dl_names = SalesmanVisiting.objects.filter(
            salesman_mapping__employee=employee
        ).values_list('delivery_location__location_name', flat=True).distinct()
        
        if not allowed_dl_names:
            return Response([])

        pending_status = ['Active', 'Working on Deal']
        leads_query = MarketingLead.objects.filter(status__in=pending_status)

        location = request.query_params.get('location')
        if location:
            is_allowed = any(dl_name.lower() in location.lower() for dl_name in allowed_dl_names if dl_name)
            
            city_allowed = False
            for dl_name in allowed_dl_names:
                if dl_name:
                    city_match = MarketingLead.objects.filter(location=location, city__icontains=dl_name).exists()
                    if city_match:
                        city_allowed = True
                        break

            if not (is_allowed or city_allowed):
                return Response([])
                
            leads_query = leads_query.filter(location=location)
        else:
            q_objects = Q()
            for dl_name in allowed_dl_names:
                if dl_name:
                    q_objects |= Q(location__icontains=dl_name) | Q(city__icontains=dl_name)
            leads_query = leads_query.filter(q_objects)

        leads = leads_query.values(
            'id', 'lead_id', 'shop_name', 'mobile_number', 'city', 'state', 'location'
        )
        return Response(leads)

    @action(detail=False, methods=['get'])
    def history(self, request):
        from .models import CrmLeadFollowUp
        from project_app.models import MarketingLead
        from django.db.models import Q
        import re

        qs = CrmLeadFollowUp.objects.select_related('lead', 'telecaller', 'executive').order_by('-created_at')

        lead_param = request.query_params.get('lead') or request.query_params.get('lead_id')
        if lead_param:
            qs = qs.filter(Q(lead__id=lead_param) | Q(lead__lead_id=lead_param))

        search = request.query_params.get('search', '')
        if search:
            qs = qs.filter(
                Q(lead__lead_id__icontains=search) | 
                Q(lead__shop_name__icontains=search) | 
                Q(lead__mobile_number__icontains=search) |
                Q(purpose__icontains=search)
            )

        page = self.paginate_queryset(qs)
        if page is not None and not lead_param:
            followups = page
        else:
            followups = qs

        data = []
        for f in followups:
            employee_name = 'Unknown'
            if f.telecaller:
                employee_name = f.telecaller.username
                if hasattr(f.telecaller, 'employee_profile') and f.telecaller.employee_profile:
                    employee_name = f.telecaller.employee_profile.name
            elif f.executive:
                employee_name = f.executive.name

            data.append({
                'id': f.id,
                'lead_id': f.lead.lead_id if f.lead else None,
                'shop_name': f.lead.shop_name if f.lead else None,
                'location': (f.lead.location or f.lead.city) if f.lead else None,
                'mobile_number': f.lead.mobile_number if f.lead else None,
                'visit_date': f.visit_date.isoformat() if f.visit_date else (f.created_at.date().isoformat() if f.created_at else None),
                'entry_time': f.created_at.isoformat() if f.created_at else (f.visit_date.isoformat() if f.visit_date else None),
                'exit_time': None,
                'duration': None,
                'remarks': f.remarks,
                'status': f.status,
                'next_visit_date': f.next_visit_date.isoformat() if f.next_visit_date else None,
                'purpose': f.purpose,
                'employee_name': employee_name,
                'photo': request.build_absolute_uri(f.shop_photo.url) if f.shop_photo else None,
                'created_at': f.created_at.isoformat() if f.created_at else None,
            })

        if lead_param:
            lead_obj = MarketingLead.objects.filter(Q(id=lead_param) | Q(lead_id=lead_param)).first()
            if lead_obj and lead_obj.mobile_number:
                try:
                    from gate_app.models import GateEntry
                    digits = re.sub(r'\D', '', lead_obj.mobile_number)
                    if digits:
                        gate_entries = GateEntry.objects.filter(
                            Q(visitor__phone_number__endswith=digits[-10:]) |
                            Q(visitor__phone_number=lead_obj.mobile_number)
                        ).select_related('employee', 'department', 'visitor').order_by('-entry_time')[:20]

                        for g in gate_entries:
                            emp_name = 'Staff'
                            if g.employee:
                                emp_name = g.employee.get_full_name() or g.employee.username
                                if hasattr(g.employee, 'employee_profile') and g.employee.employee_profile:
                                    emp_name = g.employee.employee_profile.name

                            dur_str = None
                            if g.entry_time and g.exit_time:
                                mins = int((g.exit_time - g.entry_time).total_seconds() // 60)
                                dur_str = f"{mins}m" if mins < 60 else f"{mins // 60}h {mins % 60}m"

                            data.append({
                                'id': f"gate_{g.id}",
                                'lead_id': lead_obj.lead_id,
                                'shop_name': lead_obj.shop_name,
                                'location': lead_obj.location,
                                'mobile_number': lead_obj.mobile_number,
                                'visit_date': g.entry_time.date().isoformat() if g.entry_time else None,
                                'entry_time': g.entry_time.isoformat() if g.entry_time else None,
                                'exit_time': g.exit_time.isoformat() if g.exit_time else None,
                                'duration': dur_str,
                                'remarks': g.narration or g.purpose_of_visit,
                                'status': 'Exited' if g.exit_time else ('In Campus' if g.verification_status != 'completed' else 'Exited'),
                                'next_visit_date': None,
                                'purpose': g.purpose_of_visit,
                                'employee_name': emp_name,
                                'photo': None,
                                'created_at': g.entry_time.isoformat() if g.entry_time else None,
                            })
                except Exception as e:
                    pass
            data.sort(key=lambda x: x.get('entry_time') or x.get('created_at') or x.get('visit_date') or '', reverse=True)

        if page is not None and not lead_param:
            return self.get_paginated_response(data)
        return Response(data)

    @action(detail=False, methods=['get'])
    def report(self, request):
        from django.db.models import Q
        qs = CrmLeadFollowUp.objects.select_related(
            'lead', 'lead__employee', 'lead__employee__user', 'telecaller', 'executive', 'executive__user', 'category'
        ).order_by('-created_at', '-visit_date')

        # Filters:
        # 1. Single Date or Date Range
        date_param = request.query_params.get('date')
        if date_param:
            qs = qs.filter(Q(visit_date=date_param) | Q(created_at__date=date_param))

        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        if start_date:
            qs = qs.filter(visit_date__gte=start_date)
        if end_date:
            qs = qs.filter(visit_date__lte=end_date)

        # 2. Lead (Name or ID)
        lead_param = request.query_params.get('lead')
        if lead_param:
            qs = qs.filter(
                Q(lead__lead_id__icontains=lead_param) |
                Q(lead__shop_name__icontains=lead_param)
            )

        # 3. Assigned Employee
        employee_param = request.query_params.get('employee')
        if employee_param:
            qs = qs.filter(
                Q(lead__employee_id=employee_param) |
                Q(executive_id=employee_param) |
                Q(telecaller_id=employee_param) |
                Q(lead__employee__user__first_name__icontains=employee_param) |
                Q(lead__employee__user__last_name__icontains=employee_param) |
                Q(executive__user__first_name__icontains=employee_param) |
                Q(executive__user__last_name__icontains=employee_param) |
                Q(telecaller__username__icontains=employee_param) |
                Q(telecaller__first_name__icontains=employee_param)
            )

        # 4. Purpose
        purpose_param = request.query_params.get('purpose')
        if purpose_param:
            qs = qs.filter(purpose__iexact=purpose_param)

        # 5. Status
        status_param = request.query_params.get('status')
        if status_param:
            qs = qs.filter(status__iexact=status_param)

        # 6. Escalated
        escalated_param = request.query_params.get('escalated')
        if escalated_param and escalated_param.lower() in ['yes', 'true', '1', 'escalated']:
            qs = qs.filter(Q(status='Escalated') | Q(lead__status='Escalated'))
        elif escalated_param and escalated_param.lower() in ['no', 'false', '0']:
            qs = qs.exclude(status='Escalated').exclude(lead__status='Escalated')

        # 7. General search term
        search = request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(lead__lead_id__icontains=search) |
                Q(lead__shop_name__icontains=search) |
                Q(lead__mobile_number__icontains=search) |
                Q(lead__city__icontains=search) |
                Q(lead__location__icontains=search) |
                Q(purpose__icontains=search) |
                Q(remarks__icontains=search) |
                Q(narration__icontains=search) |
                Q(status__icontains=search)
            )

        report_data = []
        for f in qs:
            emp_name = '-'
            if f.lead and f.lead.employee:
                emp_name = str(f.lead.employee)
            elif f.executive:
                emp_name = str(f.executive)
            elif f.telecaller:
                emp_name = f.telecaller.get_full_name() or f.telecaller.username

            telecaller_name = '-'
            if f.telecaller:
                telecaller_name = f.telecaller.get_full_name() or f.telecaller.username

            is_escalated = (f.status == 'Escalated') or (f.lead and f.lead.status == 'Escalated')

            row = {
                'id': f.id,
                'lead_id': f.lead.lead_id if (f.lead and f.lead.lead_id) else (f"LD-{f.lead.id:04d}" if f.lead else '-'),
                'customer_name': f.lead.shop_name if f.lead else '-',
                'company_name': f.lead.shop_name if f.lead else '-',
                'shop_type': f.lead.shop_type if f.lead else '-',
                'category': f.category.name if f.category else (f.lead.shop_type if f.lead else '-'),
                'contact_number': f.lead.mobile_number if (f.lead and f.lead.mobile_number) else '-',
                'address': f.lead.address if f.lead else '-',
                'city': f.lead.city if f.lead else '-',
                'state': f.lead.state if f.lead else '-',
                'location': f.lead.location if (f.lead and f.lead.location) else (f.lead.city if f.lead else '-'),
                'assigned_employee': emp_name,
                'telecaller': telecaller_name,
                'followup_date': f.visit_date.strftime('%Y-%m-%d') if f.visit_date else (f.created_at.date().strftime('%Y-%m-%d') if f.created_at else '-'),
                'followup_time': f.created_at.strftime('%I:%M %p') if f.created_at else '-',
                'purpose': f.purpose or '-',
                'status': f.status or 'Active',
                'is_escalated': is_escalated,
                'escalation_status': 'Escalated' if is_escalated else 'Normal',
                'remarks': f.remarks or '-',
                'narration': f.narration or '-',
                'next_followup_date': f.next_visit_date.strftime('%Y-%m-%d') if f.next_visit_date else '-',
                'photo': request.build_absolute_uri(f.shop_photo.url) if f.shop_photo else None,
                'created_at': f.created_at.strftime('%Y-%m-%d %H:%M') if f.created_at else '-',
            }
            report_data.append(row)

        return Response(report_data)


class CrmTelecallingViewSet(viewsets.ModelViewSet):
    from .models import CrmTelecalling
    from .serializers import CrmTelecallingSerializer
    queryset = CrmTelecalling.objects.all()
    serializer_class = CrmTelecallingSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'team_leader', 'target_date']
    search_fields = ['name']
    ordering_fields = ['created_at', 'name', 'target_date']


from .models import TelecallingTeam, TelecallingLeadAssignment
from .serializers import TelecallingTeamSerializer, TelecallingLeadAssignmentSerializer
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import action
from django.db import transaction
from django.db.models import Q
from register_app.models import CustomUser

def is_telecalling_employee(user_id):
    if not user_id:
        return True
    return CustomUser.objects.filter(
        id=user_id
    ).filter(
        Q(employee__dept_designation__department__name__iexact='Tele Calling') |
        Q(employee__dept_designation__department__name__iexact='Telecalling')
    ).exists()

class TelecallingTeamViewSet(viewsets.ModelViewSet):
    queryset = TelecallingTeam.objects.all().order_by('-created_at')
    serializer_class = TelecallingTeamSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        name = request.data.get('name')
        if not name or not str(name).strip():
            return Response({'error': 'Team name is required.'}, status=status.HTTP_400_BAD_REQUEST)

        status_val = request.data.get('status', 'In Progress')
        team_leader_id = request.data.get('team_leader')
        members = request.data.get('members', [])
        leads = request.data.get('leads', [])
        
        # Backend validation: team leader must belong to Telecalling department
        if team_leader_id:
            if not is_telecalling_employee(team_leader_id):
                return Response(
                    {'error': 'Selected team leader does not belong to the Telecalling department.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if members and int(team_leader_id) not in [int(m) for m in members]:
                return Response(
                    {'error': 'Team leader must be selected from the team members.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Backend validation: all members must belong to Telecalling department
        if members:
            for member_id in members:
                if not is_telecalling_employee(member_id):
                    return Response(
                        {'error': f'Employee with ID {member_id} does not belong to the Telecalling department.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

        # Validate leads if provided (must exist in crm_lead)
        if leads:
            assigned_lead_ids = set()
            for lead in leads:
                lead_id = lead.get('id') if isinstance(lead, dict) else lead
                if lead_id in assigned_lead_ids:
                    continue
                assigned_lead_ids.add(lead_id)
                if not Lead.objects.filter(id=lead_id).exists():
                    return Response(
                        {'error': f'Lead with ID {lead_id} does not exist in the CRM system.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

        closing_date = request.data.get('closing_date')

        with transaction.atomic():
            team = TelecallingTeam.objects.create(
                name=str(name).strip(),
                status=status_val,
                team_leader_id=team_leader_id if team_leader_id else None
            )
            if members:
                team.members.set(members)
            
            # Leads are optional when creating a team
            if leads:
                seen_lead_ids = set()
                for lead in leads:
                    lead_id = lead.get('id') if isinstance(lead, dict) else lead
                    if lead_id in seen_lead_ids:
                        continue
                    seen_lead_ids.add(lead_id)
                    lead_obj = Lead.objects.filter(id=lead_id).first()
                    if not lead_obj:
                        continue
                    lead_source = (lead.get('source') if isinstance(lead, dict) else None) or (lead_obj.category.name if lead_obj and lead_obj.category else 'Direct')
                    TelecallingLeadAssignment.objects.create(
                        team=team,
                        lead_id=lead_id,
                        lead_source=lead_source,
                        closing_date=closing_date
                    )
        
        serializer = self.get_serializer(team)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        team = self.get_object()
        name = request.data.get('name')
        status_val = request.data.get('status')
        team_leader_id = request.data.get('team_leader')
        members = request.data.get('members')
        leads = request.data.get('leads')
        closing_date = request.data.get('closing_date')
        
        existing_closing_date = team.lead_assignments.exclude(closing_date__isnull=True).values_list('closing_date', flat=True).first()
        effective_closing_date = closing_date if 'closing_date' in request.data else existing_closing_date
        
        # Backend validation: team leader if updated
        if team_leader_id is not None and team_leader_id != '':
            if not is_telecalling_employee(team_leader_id):
                return Response(
                    {'error': 'Selected team leader does not belong to the Telecalling department.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            target_members = [int(m) for m in members] if members is not None else list(team.members.values_list('id', flat=True))
            if target_members and int(team_leader_id) not in target_members:
                return Response(
                    {'error': 'Team leader must be selected from the team members.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Backend validation: members if updated
        if members is not None:
            for member_id in members:
                if not is_telecalling_employee(member_id):
                    return Response(
                        {'error': f'Employee with ID {member_id} does not belong to the Telecalling department.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

        # Validate leads if updating (must exist in crm_lead)
        if leads is not None:
            assigned_lead_ids = set()
            for lead in leads:
                lead_id = lead.get('id') if isinstance(lead, dict) else lead
                if lead_id in assigned_lead_ids:
                    continue
                assigned_lead_ids.add(lead_id)
                if not Lead.objects.filter(id=lead_id).exists():
                    return Response(
                        {'error': f'Lead with ID {lead_id} does not exist in the CRM system.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

        with transaction.atomic():
            if name is not None and str(name).strip():
                team.name = str(name).strip()
            if status_val is not None:
                team.status = status_val
            if 'team_leader' in request.data:
                team.team_leader_id = team_leader_id if team_leader_id else None
            team.save()
                
            if members is not None:
                team.members.set(members)
                
            if leads is not None:
                # Update leads only when explicitly provided in the update request
                team.lead_assignments.all().delete()
                seen_lead_ids = set()
                for lead in leads:
                    lead_id = lead.get('id') if isinstance(lead, dict) else lead
                    if lead_id in seen_lead_ids:
                        continue
                    seen_lead_ids.add(lead_id)
                    lead_obj = Lead.objects.filter(id=lead_id).first()
                    if not lead_obj:
                        continue
                    lead_source = (lead.get('source') if isinstance(lead, dict) else None) or (lead_obj.category.name if lead_obj and lead_obj.category else 'Direct')
                    TelecallingLeadAssignment.objects.create(
                        team=team,
                        lead_id=lead_id,
                        lead_source=lead_source,
                        closing_date=effective_closing_date
                    )
            elif 'closing_date' in request.data:
                team.lead_assignments.all().update(closing_date=closing_date)
        
        serializer = self.get_serializer(team)
        return Response(serializer.data)
        
    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='assign-leads')
    def assign_leads(self, request, pk=None):
        team = self.get_object()
        leads = request.data.get('leads', [])
        closing_date = request.data.get('closing_date')
        
        if not leads:
            return Response({'error': 'Please provide at least one lead to assign.'}, status=status.HTTP_400_BAD_REQUEST)
        if not closing_date:
            return Response({'error': 'Closing date is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        assigned_count = 0
        for lead in leads:
            lead_id = lead.get('id') if isinstance(lead, dict) else lead
            lead_obj = Lead.objects.filter(id=lead_id).first()
            if not lead_obj:
                continue
            lead_source = (lead.get('source') if isinstance(lead, dict) else None) or (lead_obj.category.name if lead_obj and lead_obj.category else 'Direct')
            assignment, created = TelecallingLeadAssignment.objects.get_or_create(
                team=team,
                lead_id=lead_id,
                defaults={'lead_source': lead_source, 'closing_date': closing_date}
            )
            if not created and closing_date:
                assignment.closing_date = closing_date
                assignment.save()
            if created:
                assigned_count += 1
                
        serializer = self.get_serializer(team)
        return Response({'success': True, 'assigned_count': assigned_count, 'team': serializer.data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='assign-individual')
    def assign_individual(self, request):
        employee_id = request.data.get('employee_id') or request.data.get('employee')
        closing_date = request.data.get('closing_date')
        leads = request.data.get('leads', [])
        
        if not employee_id:
            return Response({'error': 'Please select a Telecalling employee.'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not is_telecalling_employee(employee_id):
            return Response({'error': 'Selected employee does not belong to the Telecalling department.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if not closing_date:
            return Response({'error': 'Closing date is required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if not leads:
            return Response({'error': 'Please provide at least one lead to assign.'}, status=status.HTTP_400_BAD_REQUEST)
            
        assigned_count = 0
        assigned_by_user = request.user if (request.user and request.user.is_authenticated) else None
        for lead in leads:
            lead_id = lead.get('id') if isinstance(lead, dict) else lead
            lead_obj = Lead.objects.filter(id=lead_id).first()
            if not lead_obj:
                continue
            lead_source = (lead.get('source') if isinstance(lead, dict) else None) or (lead_obj.category.name if lead_obj and lead_obj.category else 'Direct')
            assignment, created = TelecallingLeadAssignment.objects.get_or_create(
                employee_id=employee_id,
                lead_id=lead_id,
                defaults={'lead_source': lead_source, 'closing_date': closing_date, 'assigned_by': assigned_by_user}
            )
            update_fields = []
            if not created:
                if closing_date and assignment.closing_date != closing_date:
                    assignment.closing_date = closing_date
                    update_fields.append('closing_date')
                if not assignment.assigned_by and assigned_by_user:
                    assignment.assigned_by = assigned_by_user
                    update_fields.append('assigned_by')
                if update_fields:
                    assignment.save(update_fields=update_fields)
            if created:
                assigned_count += 1
                
        return Response({'success': True, 'assigned_count': assigned_count, 'employee_id': employee_id}, status=status.HTTP_200_OK)

class TelecallingLeadAssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = TelecallingLeadAssignmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['team', 'employee', 'lead_id']

    def get_queryset(self):
        from .models import Lead
        valid_lead_ids = Lead.objects.values_list('id', flat=True)
        return TelecallingLeadAssignment.objects.filter(lead_id__in=valid_lead_ids).order_by('-created_at')

    @action(detail=True, methods=['post'], url_path='start-call')
    def start_call(self, request, pk=None):
        assignment = self.get_object()
        user = request.user

        # 1. Check if this assignment currently has an active call by another user
        if assignment.active_caller and assignment.active_caller != user:
            if assignment.active_call_started_at and (timezone.now() - assignment.active_call_started_at).total_seconds() < 900:
                caller_name = f"{assignment.active_caller.first_name} {assignment.active_caller.last_name}".strip() or getattr(assignment.active_caller, 'name', '') or assignment.active_caller.username
                return Response({
                    'error': f'This lead is currently being called by {caller_name}.',
                    'active_caller_name': caller_name,
                    'active_caller_id': assignment.active_caller_id
                }, status=status.HTTP_400_BAD_REQUEST)

        # 2. Check if another assignment for the same lead has an active call by another user
        other_active = TelecallingLeadAssignment.objects.filter(
            lead_id=assignment.lead_id,
            active_caller__isnull=False
        ).exclude(id=assignment.id).select_related('active_caller').first()

        if other_active and other_active.active_caller != user:
            if other_active.active_call_started_at and (timezone.now() - other_active.active_call_started_at).total_seconds() < 900:
                caller_name = f"{other_active.active_caller.first_name} {other_active.active_caller.last_name}".strip() or getattr(other_active.active_caller, 'name', '') or other_active.active_caller.username
                return Response({
                    'error': f'This lead is currently being called by {caller_name}.',
                    'active_caller_name': caller_name,
                    'active_caller_id': other_active.active_caller_id
                }, status=status.HTTP_400_BAD_REQUEST)

        # 3. Check if reassigned to someone else
        if assignment.assigned_caller and assignment.assigned_caller != user:
            reassigned_name = f"{assignment.assigned_caller.first_name} {assignment.assigned_caller.last_name}".strip() or getattr(assignment.assigned_caller, 'name', '') or assignment.assigned_caller.username
            return Response({
                'error': f'This lead has been reassigned to {reassigned_name}.',
                'assigned_caller_name': reassigned_name,
                'assigned_caller_id': assignment.assigned_caller_id
            }, status=status.HTTP_400_BAD_REQUEST)

        # 4. Check if this lead has already been contacted by another team member
        # (Unless this lead was specifically reassigned to current user, OR current user is the team leader/assigner handling a reassignment)
        is_admin_user = bool(
            user.is_superuser or 
            (getattr(user, 'role', None) and user.role.name.lower() in ['admin', 'administrator', 'super admin']) or 
            (user.username and user.username.lower().startswith('admin'))
        )
        is_leader_or_assigner_handling = (
            assignment.reassignment_status == 'REQUESTED' and (
                (assignment.team and assignment.team.team_leader_id == user.id) or 
                (assignment.employee and assignment.assigned_by_id == user.id) or 
                is_admin_user
            )
        )
        # If the caller has requested reassignment and is not the leader/assigner, calling is disabled
        if assignment.reassignment_status == 'REQUESTED' and not is_leader_or_assigner_handling and assignment.reassignment_requested_by_id == user.id:
            return Response({
                'error': 'This lead is currently requested for reassignment and awaiting review.',
            }, status=status.HTTP_400_BAD_REQUEST)

        if not (assignment.assigned_caller and assignment.assigned_caller == user) and not is_leader_or_assigner_handling:
            contacted_log = CallerCallLog.objects.filter(
                assignment__lead_id=assignment.lead_id,
                call_outcome='Contacted'
            ).exclude(caller=user).select_related('caller').first()

            if contacted_log and contacted_log.caller:
                caller_name = f"{contacted_log.caller.first_name} {contacted_log.caller.last_name}".strip() or getattr(contacted_log.caller, 'name', '') or contacted_log.caller.username
                return Response({
                    'error': f'This lead has already been contacted by {caller_name}.',
                    'contacted_caller_name': caller_name,
                    'contacted_caller_id': contacted_log.caller_id
                }, status=status.HTTP_400_BAD_REQUEST)

        assignment.active_caller = user
        assignment.active_call_started_at = timezone.now()
        assignment.save(update_fields=['active_caller', 'active_call_started_at'])

        caller_name = f"{user.first_name} {user.last_name}".strip() or getattr(user, 'name', '') or user.username
        return Response({
            'success': True,
            'assignment_id': assignment.id,
            'active_caller_id': user.id,
            'active_caller_name': caller_name
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='end-call')
    def end_call(self, request, pk=None):
        assignment = self.get_object()
        user = request.user
        if assignment.active_caller == user or request.user.is_staff:
            assignment.active_caller = None
            assignment.active_call_started_at = None
            assignment.save(update_fields=['active_caller', 'active_call_started_at'])
        return Response({'success': True}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='request-reassignment')
    def request_reassignment(self, request, pk=None):
        assignment = self.get_object()
        user = request.user
        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response({'error': 'Please provide a reason for the reassignment request.'}, status=status.HTTP_400_BAD_REQUEST)

        assignment.reassignment_reason = reason
        assignment.reassignment_requested_by = user
        assignment.reassignment_requested_at = timezone.now()
        assignment.reassignment_status = 'REQUESTED'
        assignment.save(update_fields=['reassignment_reason', 'reassignment_requested_by', 'reassignment_requested_at', 'reassignment_status'])

        caller_name = f"{user.first_name} {user.last_name}".strip() or getattr(user, 'name', '') or user.username
        target_role = "team leader" if assignment.team else "original assigner"
        return Response({
            'success': True,
            'message': f'Call successfully requested for reassignment to {target_role}.',
            'reassignment_status': 'REQUESTED',
            'reassignment_reason': reason,
            'reassignment_requested_by_name': caller_name
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reassign')
    def reassign(self, request, pk=None):
        assignment = self.get_object()
        user = request.user

        is_admin_user = bool(
            user.is_superuser or 
            (getattr(user, 'role', None) and user.role.name.lower() in ['admin', 'administrator', 'super admin']) or 
            (user.username and user.username.lower().startswith('admin'))
        )
        is_leader = bool(assignment.team and assignment.team.team_leader_id == user.id)
        is_assigner = bool(assignment.employee and assignment.assigned_by_id == user.id) or (assignment.employee and assignment.assigned_by is None and is_admin_user)

        can_reassign = is_leader or is_assigner or is_admin_user
        if not can_reassign:
            return Response({'error': 'Only the team leader or original assigner can reassign calls.'}, status=status.HTTP_403_FORBIDDEN)

        new_caller_id = request.data.get('new_caller_id') or request.data.get('employee_id')
        if not new_caller_id:
            return Response({'error': 'Please select a member to reassign this call to.'}, status=status.HTTP_400_BAD_REQUEST)

        from django.contrib.auth import get_user_model
        User = get_user_model()
        new_caller = User.objects.filter(id=new_caller_id).first()
        if not new_caller:
            return Response({'error': 'Selected caller user was not found.'}, status=status.HTTP_404_NOT_FOUND)

        fields_to_update = ['assigned_caller', 'reassignment_status', 'reassignment_requested_by', 'reassignment_requested_at']

        if assignment.team:
            from .models import TelecallingTeam
            user_is_any_leader = TelecallingTeam.objects.filter(team_leader=user).exists()
            if is_admin_user:
                pass
            elif is_leader or user_is_any_leader:
                leader_teams = TelecallingTeam.objects.filter(team_leader=user)
                allowed_member_ids = set(TelecallingTeam.members.through.objects.filter(
                    telecallingteam__in=leader_teams
                ).values_list('customuser_id', flat=True))
                allowed_member_ids.update(leader_teams.values_list('team_leader_id', flat=True))
                allowed_member_ids.update(assignment.team.members.values_list('id', flat=True))
                if assignment.team.team_leader_id:
                    allowed_member_ids.add(assignment.team.team_leader_id)

                if new_caller.id not in allowed_member_ids:
                    return Response({'error': 'Selected caller is not a member of any team you lead.'}, status=status.HTTP_400_BAD_REQUEST)

                # If the new caller is in another team led by this leader, update assignment.team to that team
                curr_team_m_ids = set(assignment.team.members.values_list('id', flat=True))
                if assignment.team.team_leader_id:
                    curr_team_m_ids.add(assignment.team.team_leader_id)
                if new_caller.id not in curr_team_m_ids:
                    new_team = TelecallingTeam.objects.filter(
                        Q(members=new_caller) | Q(team_leader=new_caller),
                        team_leader=user
                    ).first()
                    if new_team:
                        assignment.team = new_team
                        fields_to_update.append('team')
            else:
                team_member_ids = set(assignment.team.members.values_list('id', flat=True))
                if assignment.team.team_leader_id:
                    team_member_ids.add(assignment.team.team_leader_id)
                if new_caller.id not in team_member_ids:
                    return Response({'error': 'Selected caller is not a member of this team.'}, status=status.HTTP_400_BAD_REQUEST)
        elif assignment.employee:
            if not is_telecalling_employee(new_caller.id) and not is_admin_user:
                return Response({'error': 'Selected caller does not belong to the Telecalling department.'}, status=status.HTTP_400_BAD_REQUEST)

        assignment.assigned_caller = new_caller
        assignment.reassignment_status = 'REASSIGNED'
        if not assignment.reassignment_requested_by:
            assignment.reassignment_requested_by = user
        if not assignment.reassignment_requested_at:
            assignment.reassignment_requested_at = timezone.now()
        notes = request.data.get('notes', '').strip()
        if notes:
            assignment.reassignment_reason = notes
            fields_to_update.append('reassignment_reason')
        assignment.save(update_fields=fields_to_update)

        new_caller_name = f"{new_caller.first_name} {new_caller.last_name}".strip() or getattr(new_caller, 'name', '') or new_caller.username
        return Response({
            'success': True,
            'message': f'Lead successfully reassigned to {new_caller_name}.',
            'assigned_caller_id': new_caller.id,
            'assigned_caller_name': new_caller_name,
            'reassignment_status': 'REASSIGNED'
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='telecalling-users')
    def telecalling_users(self, request):
        """Return all telecalling department employees for assignment/reassignment dropdowns."""
        users = CustomUser.objects.filter(
            Q(employee__dept_designation__department__name__iexact='Tele Calling') |
            Q(employee__dept_designation__department__name__iexact='Telecalling') |
            Q(is_superuser=True)
        ).distinct()
        data = []
        for u in users:
            name = f"{u.first_name} {u.last_name}".strip() or getattr(u, 'name', '') or u.username
            data.append({
                'id': u.id,
                'name': name,
                'username': u.username,
                'email': u.email or '',
            })
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='my-leads')
    def my_leads(self, request):
        """Return all individual lead assignments for the logged-in caller user, or all individual assignments if admin."""
        from .models import Lead, CallerCallLog
        user = request.user
        valid_lead_ids = Lead.objects.values_list('id', flat=True)
        is_admin = bool(
            user.is_superuser or 
            (getattr(user, 'role', None) and user.role.name.lower() in ['admin', 'administrator', 'super admin']) or 
            (user.username and user.username.lower().startswith('admin'))
        )
        if is_admin:
            assignments = TelecallingLeadAssignment.objects.filter(
                employee__isnull=False,
                lead_id__in=valid_lead_ids
            ).select_related('employee', 'active_caller', 'assigned_caller', 'reassignment_requested_by', 'assigned_by').order_by('-created_at')
        else:
            assignments = TelecallingLeadAssignment.objects.filter(
                Q(employee=user) | Q(assigned_caller=user) | Q(assigned_by=user),
                employee__isnull=False,
                lead_id__in=valid_lead_ids
            ).select_related('employee', 'active_caller', 'assigned_caller', 'reassignment_requested_by', 'assigned_by').order_by('-created_at').distinct()

        result = []
        for asgn in assignments:
            try:
                lead = Lead.objects.get(id=asgn.lead_id)
                lead_data = {
                    'id': lead.id,
                    'company': lead.company or '',
                    'first_name': lead.first_name or '',
                    'last_name': lead.last_name or '',
                    'phone': lead.phone or '',
                    'mobile': lead.mobile or '',
                    'email': lead.email or '',
                    'lead_status': lead.lead_status or '',
                    'rating': lead.rating or '',
                    'priority': lead.priority or '',
                    'city': lead.city or '',
                    'state_province': lead.state_province or '',
                    'country': lead.country or '',
                    'category_id': lead.category_id if lead.category_id else None,
                    'category_name': lead.category.name if lead.category else '',
                    'lead_source_name': lead.lead_source.name if lead.lead_source else '',
                    'industry_name': lead.industry.name if lead.industry else '',
                    'description': lead.description or '',
                    'flat_house_no': lead.flat_house_no or '',
                    'street_address': lead.street_address or '',
                    'zip_postal_code': lead.zip_postal_code or '',
                    'fax': lead.fax or '',
                    'website': lead.website or '',
                    'title': lead.title or '',
                }
            except Lead.DoesNotExist:
                lead_data = None

            # Fetch call logs for this assignment
            logs = CallerCallLog.objects.filter(assignment=asgn).select_related('caller').order_by('-called_at')
            logs_data = []
            for log in logs:
                caller_name = ''
                if log.caller:
                    caller_name = f"{log.caller.first_name} {log.caller.last_name}".strip() or getattr(log.caller, 'name', '') or log.caller.username
                duration_display = None
                if log.duration_seconds is not None:
                    mins = log.duration_seconds // 60
                    secs = log.duration_seconds % 60
                    duration_display = f"{mins}m {secs}s"
                logs_data.append({
                    'id': log.id,
                    'call_outcome': log.call_outcome,
                    'duration_seconds': log.duration_seconds,
                    'duration_display': duration_display,
                    'notes': log.notes or '',
                    'follow_up_date': str(log.follow_up_date) if log.follow_up_date else None,
                    'called_at': log.called_at.isoformat() if log.called_at else None,
                    'caller_name': caller_name,
                    'caller_id': log.caller_id,
                })

            is_in_call = False
            active_caller_name = None
            active_caller_id = None
            if asgn.active_caller:
                if asgn.active_call_started_at and (timezone.now() - asgn.active_call_started_at).total_seconds() < 900:
                    is_in_call = True
                    active_caller_id = asgn.active_caller_id
                    active_caller_name = f"{asgn.active_caller.first_name} {asgn.active_caller.last_name}".strip() or getattr(asgn.active_caller, 'name', '') or asgn.active_caller.username
                else:
                    asgn.active_caller = None
                    asgn.active_call_started_at = None
                    asgn.save(update_fields=['active_caller', 'active_call_started_at'])

            is_contacted = False
            contacted_caller_id = None
            contacted_caller_name = None
            for log_obj, log_d in zip(logs, logs_data):
                if log_obj.call_outcome == 'Contacted':
                    is_contacted = True
                    contacted_caller_id = log_obj.caller_id
                    contacted_caller_name = log_d['caller_name']
                    break

            if not is_contacted:
                other_contacted = CallerCallLog.objects.filter(
                    assignment__lead_id=asgn.lead_id,
                    call_outcome='Contacted'
                ).select_related('caller').first()
                if other_contacted:
                    is_contacted = True
                    contacted_caller_id = other_contacted.caller_id
                    if other_contacted.caller:
                        contacted_caller_name = f"{other_contacted.caller.first_name} {other_contacted.caller.last_name}".strip() or getattr(other_contacted.caller, 'name', '') or other_contacted.caller.username

            reassigned_caller_name = None
            if asgn.assigned_caller:
                reassigned_caller_name = f"{asgn.assigned_caller.first_name} {asgn.assigned_caller.last_name}".strip() or getattr(asgn.assigned_caller, 'name', '') or asgn.assigned_caller.username

            reassignment_req_by_name = None
            if asgn.reassignment_requested_by:
                reassignment_req_by_name = f"{asgn.reassignment_requested_by.first_name} {asgn.reassignment_requested_by.last_name}".strip() or getattr(asgn.reassignment_requested_by, 'name', '') or asgn.reassignment_requested_by.username
            elif asgn.reassignment_reason and asgn.reassignment_reason.startswith('Reassigned by '):
                parts = asgn.reassignment_reason.split(':', 1)
                reassignment_req_by_name = parts[0].replace('Reassigned by ', '').strip()

            assigned_by_name = None
            if asgn.assigned_by:
                assigned_by_name = f"{asgn.assigned_by.first_name} {asgn.assigned_by.last_name}".strip() or getattr(asgn.assigned_by, 'name', '') or asgn.assigned_by.username

            assigned_employee_name = None
            if asgn.employee:
                assigned_employee_name = f"{asgn.employee.first_name} {asgn.employee.last_name}".strip() or getattr(asgn.employee, 'name', '') or asgn.employee.username

            is_assigner = bool((asgn.assigned_by_id == user.id) or is_admin or (asgn.assigned_by is None and is_admin))

            if asgn.assigned_caller_id:
                is_contacted = True
                contacted_caller_id = asgn.assigned_caller_id
                contacted_caller_name = reassigned_caller_name
                contacted_by_me = (asgn.assigned_caller_id == user.id)
            elif asgn.reassignment_status == 'REQUESTED':
                contacted_by_me = is_assigner
            else:
                contacted_by_me = (contacted_caller_id == user.id) if is_contacted else True

            converted_log = None
            for log_obj in logs:
                if log_obj.call_outcome in ['Converted', 'Converted to Opportunity']:
                    converted_log = log_obj
                    break

            if not converted_log:
                converted_log = CallerCallLog.objects.filter(
                    assignment__lead_id=asgn.lead_id,
                    call_outcome__in=['Converted', 'Converted to Opportunity']
                ).select_related('caller').order_by('-called_at').first()

            converted_by_id = converted_log.caller_id if converted_log else None
            converted_by_name = None
            if converted_log and converted_log.caller:
                converted_by_name = (
                    f"{converted_log.caller.first_name} {converted_log.caller.last_name}".strip()
                    or getattr(converted_log.caller, 'name', '')
                    or converted_log.caller.username
                )
            converted_at = converted_log.called_at.isoformat() if (converted_log and converted_log.called_at) else None

            result.append({
                'assignment_id': asgn.id,
                'lead_id': asgn.lead_id,
                'lead_source': asgn.lead_source,
                'closing_date': str(asgn.closing_date) if asgn.closing_date else None,
                'created_at': asgn.created_at.isoformat() if asgn.created_at else None,
                'lead': lead_data,
                'call_logs': logs_data,
                'total_calls': len(logs_data),
                'last_outcome': logs_data[0]['call_outcome'] if logs_data else None,
                'last_caller_name': logs_data[0]['caller_name'] if logs_data else None,
                'converted_by_id': converted_by_id,
                'converted_by_name': converted_by_name,
                'converted_at': converted_at,
                'is_in_call': is_in_call,
                'active_caller_id': active_caller_id,
                'active_caller_name': active_caller_name,
                'active_call_by_me': (active_caller_id == user.id) if is_in_call else False,
                'is_contacted': is_contacted,
                'contacted_caller_id': contacted_caller_id,
                'contacted_caller_name': contacted_caller_name,
                'contacted_by_me': contacted_by_me,
                'assigned_by_id': asgn.assigned_by_id,
                'assigned_by_name': assigned_by_name,
                'is_assigner': is_assigner,
                'assigned_employee_id': asgn.employee_id,
                'assigned_employee_name': assigned_employee_name,
                'assigned_caller_id': asgn.assigned_caller_id,
                'assigned_caller_name': reassigned_caller_name,
                'reassignment_status': asgn.reassignment_status or 'NONE',
                'reassignment_reason': asgn.reassignment_reason or '',
                'reassignment_requested_by_id': asgn.reassignment_requested_by_id,
                'reassignment_requested_by_name': reassignment_req_by_name,
                'reassignment_requested_at': asgn.reassignment_requested_at.isoformat() if asgn.reassignment_requested_at else None,
            })

        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='team-leads')
    def team_leads(self, request):
        """Return all team lead assignments for teams where the logged-in user is a member or leader, or all team assignments if admin."""
        from .models import Lead, CallerCallLog, TelecallingTeam
        from django.db.models import Q
        user = request.user
        valid_lead_ids = Lead.objects.values_list('id', flat=True)
        is_admin = bool(
            user.is_superuser or 
            (getattr(user, 'role', None) and user.role.name.lower() in ['admin', 'administrator', 'super admin']) or 
            (user.username and user.username.lower().startswith('admin'))
        )
        if is_admin:
            assignments = TelecallingLeadAssignment.objects.filter(
                team__isnull=False,
                lead_id__in=valid_lead_ids
            ).select_related('team', 'team__team_leader', 'active_caller', 'assigned_caller', 'reassignment_requested_by').prefetch_related('team__members').order_by('-created_at').distinct()
        else:
            user_teams = TelecallingTeam.objects.filter(
                Q(members=user) | Q(team_leader=user)
            ).distinct()

            assignments = TelecallingLeadAssignment.objects.filter(
                Q(team__in=user_teams) | Q(assigned_caller=user),
                lead_id__in=valid_lead_ids
            ).select_related('team', 'team__team_leader', 'active_caller', 'assigned_caller', 'reassignment_requested_by').prefetch_related('team__members').order_by('-created_at').distinct()

        # Precompute all teams and their members for reassignment dropdown grouping
        all_teams_data = {}
        teams_qs = TelecallingTeam.objects.all().prefetch_related('members').select_related('team_leader').order_by('name')
        for t in teams_qs:
            cands = list(t.members.all())
            if t.team_leader and t.team_leader not in cands:
                cands.append(t.team_leader)
            seen_c_ids = set()
            m_list = []
            for c in cands:
                if c.id not in seen_c_ids:
                    seen_c_ids.add(c.id)
                    c_name = f"{c.first_name} {c.last_name}".strip() or getattr(c, 'name', '') or c.username
                    m_list.append({
                        'id': c.id,
                        'name': c_name,
                        'email': c.email or '',
                        'is_leader': (t.team_leader_id == c.id)
                    })
            all_teams_data[t.id] = {
                'team_id': t.id,
                'team_name': t.name,
                'team_leader_id': t.team_leader_id,
                'members': m_list
            }

        result = []
        for asgn in assignments:
            try:
                lead = Lead.objects.get(id=asgn.lead_id)
                lead_data = {
                    'id': lead.id,
                    'company': lead.company or '',
                    'first_name': lead.first_name or '',
                    'last_name': lead.last_name or '',
                    'phone': lead.phone or '',
                    'mobile': lead.mobile or '',
                    'email': lead.email or '',
                    'lead_status': lead.lead_status or '',
                    'rating': lead.rating or '',
                    'priority': lead.priority or '',
                    'city': lead.city or '',
                    'state_province': lead.state_province or '',
                    'country': lead.country or '',
                    'category_id': lead.category_id if lead.category_id else None,
                    'category_name': lead.category.name if lead.category else '',
                    'lead_source_name': lead.lead_source.name if lead.lead_source else '',
                    'industry_name': lead.industry.name if lead.industry else '',
                    'description': lead.description or '',
                    'flat_house_no': lead.flat_house_no or '',
                    'street_address': lead.street_address or '',
                    'zip_postal_code': lead.zip_postal_code or '',
                    'fax': lead.fax or '',
                    'website': lead.website or '',
                    'title': lead.title or '',
                }
            except Lead.DoesNotExist:
                lead_data = None

            logs = CallerCallLog.objects.filter(assignment=asgn).select_related('caller').order_by('-called_at')
            logs_data = []
            for log in logs:
                caller_name = ''
                if log.caller:
                    caller_name = f"{log.caller.first_name} {log.caller.last_name}".strip() or getattr(log.caller, 'name', '') or log.caller.username
                duration_display = None
                if log.duration_seconds is not None:
                    mins = log.duration_seconds // 60
                    secs = log.duration_seconds % 60
                    duration_display = f"{mins}m {secs}s"
                logs_data.append({
                    'id': log.id,
                    'call_outcome': log.call_outcome,
                    'duration_seconds': log.duration_seconds,
                    'duration_display': duration_display,
                    'notes': log.notes or '',
                    'follow_up_date': str(log.follow_up_date) if log.follow_up_date else None,
                    'called_at': log.called_at.isoformat() if log.called_at else None,
                    'caller_name': caller_name,
                    'caller_id': log.caller_id,
                })

            is_in_call = False
            active_caller_name = None
            active_caller_id = None
            if asgn.active_caller:
                if asgn.active_call_started_at and (timezone.now() - asgn.active_call_started_at).total_seconds() < 900:
                    is_in_call = True
                    active_caller_id = asgn.active_caller_id
                    active_caller_name = f"{asgn.active_caller.first_name} {asgn.active_caller.last_name}".strip() or getattr(asgn.active_caller, 'name', '') or asgn.active_caller.username
                else:
                    asgn.active_caller = None
                    asgn.active_call_started_at = None
                    asgn.save(update_fields=['active_caller', 'active_call_started_at'])

            is_contacted = False
            contacted_caller_id = None
            contacted_caller_name = None
            for log_obj, log_d in zip(logs, logs_data):
                if log_obj.call_outcome == 'Contacted':
                    is_contacted = True
                    contacted_caller_id = log_obj.caller_id
                    contacted_caller_name = log_d['caller_name']
                    break

            if not is_contacted:
                other_contacted = CallerCallLog.objects.filter(
                    assignment__lead_id=asgn.lead_id,
                    call_outcome='Contacted'
                ).select_related('caller').first()
                if other_contacted:
                    is_contacted = True
                    contacted_caller_id = other_contacted.caller_id
                    if other_contacted.caller:
                        contacted_caller_name = f"{other_contacted.caller.first_name} {other_contacted.caller.last_name}".strip() or getattr(other_contacted.caller, 'name', '') or other_contacted.caller.username

            is_team_leader = (asgn.team and asgn.team.team_leader_id == user.id) or is_admin

            # Build grouped teams and members for reassignment
            user_led_team_ids = [t_id for t_id, t_info in all_teams_data.items() if t_info['team_leader_id'] == user.id]
            teams_with_members_list = []
            seen_t_ids = set()

            if is_admin:
                teams_with_members_list = list(all_teams_data.values())
            elif user_led_team_ids:
                # Include all teams led by this team leader
                for t_id in user_led_team_ids:
                    if t_id not in seen_t_ids and t_id in all_teams_data:
                        seen_t_ids.add(t_id)
                        teams_with_members_list.append(all_teams_data[t_id])
                # Also include current assignment's team if not present
                if asgn.team_id and asgn.team_id not in seen_t_ids and asgn.team_id in all_teams_data:
                    seen_t_ids.add(asgn.team_id)
                    teams_with_members_list.append(all_teams_data[asgn.team_id])
            elif asgn.team and asgn.team_id in all_teams_data:
                # If team leader of this assignment leads multiple teams
                leader_id = asgn.team.team_leader_id
                lead_t_ids = [t_id for t_id, t_info in all_teams_data.items() if t_info['team_leader_id'] == leader_id]
                if lead_t_ids:
                    for t_id in lead_t_ids:
                        if t_id not in seen_t_ids and t_id in all_teams_data:
                            seen_t_ids.add(t_id)
                            teams_with_members_list.append(all_teams_data[t_id])
                else:
                    teams_with_members_list.append(all_teams_data[asgn.team_id])

            seen_flat_m_ids = set()
            team_members_list = []
            for t_grp in teams_with_members_list:
                for m in t_grp['members']:
                    if m['id'] not in seen_flat_m_ids:
                        seen_flat_m_ids.add(m['id'])
                        team_members_list.append(m)

            if not team_members_list and asgn.team_id in all_teams_data:
                team_members_list = all_teams_data[asgn.team_id]['members']

            reassigned_caller_name = None
            if asgn.assigned_caller:
                reassigned_caller_name = f"{asgn.assigned_caller.first_name} {asgn.assigned_caller.last_name}".strip() or getattr(asgn.assigned_caller, 'name', '') or asgn.assigned_caller.username

            reassignment_req_by_name = None
            if asgn.reassignment_requested_by:
                reassignment_req_by_name = f"{asgn.reassignment_requested_by.first_name} {asgn.reassignment_requested_by.last_name}".strip() or getattr(asgn.reassignment_requested_by, 'name', '') or asgn.reassignment_requested_by.username
            elif asgn.reassignment_reason and asgn.reassignment_reason.startswith('Reassigned by '):
                parts = asgn.reassignment_reason.split(':', 1)
                reassignment_req_by_name = parts[0].replace('Reassigned by ', '').strip()

            # If reassigned to a specific caller:
            # - that caller has contacted_by_me = True (can call)
            # - all other callers have contacted_by_me = False (disabled)
            if asgn.assigned_caller_id:
                is_contacted = True
                contacted_caller_id = asgn.assigned_caller_id
                contacted_caller_name = reassigned_caller_name
                contacted_by_me = (asgn.assigned_caller_id == user.id)
            elif asgn.reassignment_status == 'REQUESTED' and is_team_leader:
                contacted_by_me = True
            else:
                contacted_by_me = (contacted_caller_id == user.id) if is_contacted else False

            converted_log = None
            for log_obj in logs:
                if log_obj.call_outcome in ['Converted', 'Converted to Opportunity']:
                    converted_log = log_obj
                    break

            if not converted_log:
                converted_log = CallerCallLog.objects.filter(
                    assignment__lead_id=asgn.lead_id,
                    call_outcome__in=['Converted', 'Converted to Opportunity']
                ).select_related('caller').order_by('-called_at').first()

            converted_by_id = converted_log.caller_id if converted_log else None
            converted_by_name = None
            if converted_log and converted_log.caller:
                converted_by_name = (
                    f"{converted_log.caller.first_name} {converted_log.caller.last_name}".strip()
                    or getattr(converted_log.caller, 'name', '')
                    or converted_log.caller.username
                )
            converted_at = converted_log.called_at.isoformat() if (converted_log and converted_log.called_at) else None

            result.append({
                'assignment_id': asgn.id,
                'team_id': asgn.team_id,
                'team_name': asgn.team.name if asgn.team else '',
                'lead_id': asgn.lead_id,
                'lead_source': asgn.lead_source,
                'closing_date': str(asgn.closing_date) if asgn.closing_date else None,
                'created_at': asgn.created_at.isoformat() if asgn.created_at else None,
                'lead': lead_data,
                'call_logs': logs_data,
                'total_calls': len(logs_data),
                'last_outcome': logs_data[0]['call_outcome'] if logs_data else None,
                'last_caller_name': logs_data[0]['caller_name'] if logs_data else None,
                'converted_by_id': converted_by_id,
                'converted_by_name': converted_by_name,
                'converted_at': converted_at,
                'is_in_call': is_in_call,
                'active_caller_id': active_caller_id,
                'active_caller_name': active_caller_name,
                'active_call_by_me': (active_caller_id == user.id) if is_in_call else False,
                'is_contacted': is_contacted,
                'contacted_caller_id': contacted_caller_id,
                'contacted_caller_name': contacted_caller_name,
                'contacted_by_me': contacted_by_me,
                'assigned_caller_id': asgn.assigned_caller_id,
                'assigned_caller_name': reassigned_caller_name,
                'reassignment_status': asgn.reassignment_status or 'NONE',
                'reassignment_reason': asgn.reassignment_reason or '',
                'reassignment_requested_by_id': asgn.reassignment_requested_by_id,
                'reassignment_requested_by_name': reassignment_req_by_name,
                'reassignment_requested_at': asgn.reassignment_requested_at.isoformat() if asgn.reassignment_requested_at else None,
                'is_team_leader': is_team_leader,
                'team_leader_id': asgn.team.team_leader_id if asgn.team else None,
                'team_leader_name': (f"{asgn.team.team_leader.first_name} {asgn.team.team_leader.last_name}".strip() or getattr(asgn.team.team_leader, 'name', '') or asgn.team.team_leader.username) if (asgn.team and asgn.team.team_leader) else 'Team Leader',
                'team_members': team_members_list,
                'teams_with_members': teams_with_members_list,
            })

        return Response(result, status=status.HTTP_200_OK)


from .models import CallerCallLog
from .serializers import CallerCallLogSerializer

class CallerCallLogViewSet(viewsets.ModelViewSet):
    """ViewSet for creating and listing call logs for individual lead assignments."""
    serializer_class = CallerCallLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['assignment', 'caller', 'call_outcome']

    def get_queryset(self):
        return CallerCallLog.objects.select_related('caller', 'assignment').order_by('-called_at')

    def perform_create(self, serializer):
        log = serializer.save(caller=self.request.user)
        # Release the active call lock on the assignment upon logging
        if log.assignment:
            assignment = log.assignment
            assignment.active_caller = None
            assignment.active_call_started_at = None
            assignment.save(update_fields=['active_caller', 'active_call_started_at'])
            if log.call_outcome in ['Converted', 'Converted to Opportunity']:
                lead_id = getattr(assignment, 'lead_id', None)
                if lead_id:
                    Lead.objects.filter(id=lead_id).update(lead_status='Converted')


from rest_framework.views import APIView
from django.db.models import Count, Avg, Sum, Q
from django.contrib.auth import get_user_model
from django.utils.dateparse import parse_date

class CallerReportsView(APIView):
    """
    API endpoint for CRM Caller & Department Reports.
    - Callers see their own attended calls with the full history of each attended lead,
      along with their personal efficiency diagram/metrics.
    - Admins see all telecallers, caller summary metrics, and call histories across all telecallers,
      with full lead history for each lead.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        User = get_user_model()
        is_admin = bool(
            user.is_superuser or 
            (getattr(user, 'role', None) and user.role.name.lower() in ['admin', 'administrator', 'super admin']) or 
            (user.username and user.username.lower().startswith('admin'))
        )

        caller_param = request.query_params.get('caller') or request.query_params.get('caller_id')
        outcome_param = request.query_params.get('call_outcome') or request.query_params.get('outcome')
        search_param = request.query_params.get('search', '').strip()
        lead_param = request.query_params.get('lead_id')
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')

        # Base queryset of all valid call logs with valid assignment
        base_logs = CallerCallLog.objects.select_related('caller', 'assignment').order_by('-called_at')

        # Role-based scoping
        if not is_admin:
            selected_caller_id = user.id
            logs_qs = base_logs.filter(caller=user)
        else:
            if caller_param and caller_param not in ['all', 'ALL', '']:
                try:
                    selected_caller_id = int(caller_param)
                    logs_qs = base_logs.filter(caller_id=selected_caller_id)
                except (ValueError, TypeError):
                    selected_caller_id = None
                    logs_qs = base_logs
            else:
                selected_caller_id = None
                logs_qs = base_logs

        # Apply date filters
        if start_date_str:
            d = parse_date(start_date_str)
            if d:
                logs_qs = logs_qs.filter(called_at__date__gte=d)
        if end_date_str:
            d = parse_date(end_date_str)
            if d:
                logs_qs = logs_qs.filter(called_at__date__lte=d)

        # Apply outcome filter
        if outcome_param:
            if outcome_param in ['Converted to Opportunity', 'Converted']:
                logs_qs = logs_qs.filter(call_outcome__in=['Converted', 'Converted to Opportunity'])
            else:
                logs_qs = logs_qs.filter(call_outcome=outcome_param)

        # Apply lead_id filter
        if lead_param:
            logs_qs = logs_qs.filter(assignment__lead_id=lead_param)

        # Apply search filter (lead info or notes)
        if search_param:
            matching_lead_ids = Lead.objects.filter(
                Q(first_name__icontains=search_param) |
                Q(last_name__icontains=search_param) |
                Q(company__icontains=search_param) |
                Q(phone__icontains=search_param) |
                Q(mobile__icontains=search_param)
            ).values_list('id', flat=True)
            logs_qs = logs_qs.filter(
                Q(assignment__lead_id__in=matching_lead_ids) |
                Q(notes__icontains=search_param)
            )

        # Callers list (for admin)
        callers_list = []
        if is_admin:
            caller_ids = CallerCallLog.objects.exclude(caller__isnull=True).values_list('caller_id', flat=True).distinct()
            caller_users = User.objects.filter(id__in=caller_ids).order_by('first_name', 'username')

            for c in caller_users:
                c_logs = base_logs.filter(caller=c)
                total_c = c_logs.count()
                conv_c = c_logs.filter(call_outcome__in=['Converted', 'Converted to Opportunity']).count()
                contact_c = c_logs.filter(call_outcome__in=['Contacted', 'Interested', 'Call Back Later', 'Converted', 'Converted to Opportunity']).count()
                unique_leads_c = c_logs.values('assignment__lead_id').distinct().count()
                avg_dur_c = c_logs.filter(duration_seconds__isnull=False).aggregate(avg=Avg('duration_seconds'))['avg'] or 0
                last_log = c_logs.first()

                c_name = f"{c.first_name} {c.last_name}".strip() or getattr(c, 'name', '') or c.username
                callers_list.append({
                    'id': c.id,
                    'username': c.username,
                    'name': c_name,
                    'email': c.email or '',
                    'total_calls': total_c,
                    'unique_leads': unique_leads_c,
                    'conversions': conv_c,
                    'conversion_rate': round((conv_c / total_c * 100), 1) if total_c > 0 else 0,
                    'contact_rate': round((contact_c / total_c * 100), 1) if total_c > 0 else 0,
                    'avg_duration_seconds': round(avg_dur_c),
                    'last_call_at': last_log.called_at.isoformat() if last_log and last_log.called_at else None,
                })

        # Calculate efficiency & metrics for current view (caller or selected caller or total)
        current_metrics_qs = logs_qs
        total_calls = current_metrics_qs.count()
        unique_leads = current_metrics_qs.values('assignment__lead_id').distinct().count()
        conversions = current_metrics_qs.filter(call_outcome__in=['Converted', 'Converted to Opportunity']).count()
        contacted_calls = current_metrics_qs.filter(call_outcome__in=['Contacted', 'Interested', 'Call Back Later', 'Converted', 'Converted to Opportunity']).count()
        avg_dur = current_metrics_qs.filter(duration_seconds__isnull=False).aggregate(avg=Avg('duration_seconds'))['avg'] or 0
        total_dur = current_metrics_qs.filter(duration_seconds__isnull=False).aggregate(tot=Sum('duration_seconds'))['tot'] or 0

        # Outcome breakdown counts
        outcome_counts = {}
        for row in current_metrics_qs.values('call_outcome').annotate(count=Count('id')):
            outcome_name = row['call_outcome']
            if outcome_name == 'Converted':
                outcome_name = 'Converted to Opportunity'
            outcome_counts[outcome_name] = outcome_counts.get(outcome_name, 0) + row['count']

        outcome_breakdown = []
        ALL_OUTCOMES = [
            'Converted to Opportunity',
            'Contacted',
            'Interested',
            'Call Back Later',
            'Busy',
            'Not Answered',
            'Wrong Number',
            'Not Interested'
        ]
        for out in ALL_OUTCOMES:
            cnt = outcome_counts.get(out, 0)
            pct = round((cnt / total_calls * 100), 1) if total_calls > 0 else 0
            outcome_breakdown.append({
                'outcome': out,
                'count': cnt,
                'percentage': pct
            })

        # Daily activity trends
        daily_trends_dict = {}
        for log in current_metrics_qs.order_by('called_at')[:500]:
            if log.called_at:
                d_str = log.called_at.strftime('%Y-%m-%d')
                if d_str not in daily_trends_dict:
                    daily_trends_dict[d_str] = {'date': d_str, 'calls': 0, 'conversions': 0, 'contacted': 0}
                daily_trends_dict[d_str]['calls'] += 1
                if log.call_outcome in ['Converted', 'Converted to Opportunity']:
                    daily_trends_dict[d_str]['conversions'] += 1
                if log.call_outcome in ['Contacted', 'Interested', 'Call Back Later', 'Converted', 'Converted to Opportunity']:
                    daily_trends_dict[d_str]['contacted'] += 1
        daily_trends = sorted(daily_trends_dict.values(), key=lambda x: x['date'])

        # Now fetch the call logs payload with lead details and full lead history
        logs_list = list(logs_qs[:1000])
        lead_ids = set(l.assignment.lead_id for l in logs_list if l.assignment and l.assignment.lead_id)

        # Batch fetch Leads
        leads = Lead.objects.filter(id__in=lead_ids).select_related('category', 'lead_source')
        lead_map = {l.id: l for l in leads}

        # Also fetch Opportunity Accounts for any converted leads that were removed from Lead table
        opp_acc_map = {}
        for acc in OpportunityAccount.objects.filter(Q(lead_id__in=lead_ids) | Q(assignment__lead_id__in=lead_ids)):
            if acc.lead_id:
                opp_acc_map[acc.lead_id] = acc
            elif acc.assignment and acc.assignment.lead_id:
                opp_acc_map[acc.assignment.lead_id] = acc

        # Batch fetch Full History for all these leads across ALL callers and ALL time
        all_lead_logs = CallerCallLog.objects.filter(
            assignment__lead_id__in=lead_ids
        ).select_related('caller', 'assignment').order_by('-called_at')

        history_by_lead_id = {}
        for h_log in all_lead_logs:
            lid = h_log.assignment.lead_id if h_log.assignment else None
            if not lid:
                continue
            if lid not in history_by_lead_id:
                history_by_lead_id[lid] = []

            c_name = ''
            if h_log.caller:
                c_name = f"{h_log.caller.first_name} {h_log.caller.last_name}".strip() or getattr(h_log.caller, 'name', '') or h_log.caller.username

            mins = (h_log.duration_seconds or 0) // 60
            secs = (h_log.duration_seconds or 0) % 60
            dur_disp = f"{mins}m {secs}s" if h_log.duration_seconds is not None else '—'

            history_by_lead_id[lid].append({
                'id': h_log.id,
                'caller_id': h_log.caller_id,
                'caller_name': c_name or 'Unknown',
                'call_outcome': 'Converted to Opportunity' if h_log.call_outcome == 'Converted' else h_log.call_outcome,
                'duration_seconds': h_log.duration_seconds,
                'duration_display': dur_disp,
                'notes': h_log.notes or '',
                'follow_up_date': str(h_log.follow_up_date) if h_log.follow_up_date else None,
                'called_at': h_log.called_at.isoformat() if h_log.called_at else None,
            })

        # Format output logs: show each lead once with latest call details and entire call history
        calls_data = []
        seen_lead_keys = set()
        for log in logs_list:
            lid = log.assignment.lead_id if log.assignment else None
            lead_key = f"lead_{lid}" if lid else (f"assign_{log.assignment_id}" if log.assignment_id else f"call_{log.id}")
            if lead_key in seen_lead_keys:
                continue
            seen_lead_keys.add(lead_key)

            lead_obj = lead_map.get(lid)
            opp_acc = opp_acc_map.get(lid)
            lead_hist = history_by_lead_id.get(lid, [])

            c_name = ''
            if log.caller:
                c_name = f"{log.caller.first_name} {log.caller.last_name}".strip() or getattr(log.caller, 'name', '') or log.caller.username

            mins = (log.duration_seconds or 0) // 60
            secs = (log.duration_seconds or 0) % 60
            dur_disp = f"{mins}m {secs}s" if log.duration_seconds is not None else '—'

            lead_name = ''
            if lead_obj:
                lead_name = f"{lead_obj.first_name} {lead_obj.last_name}".strip() if (lead_obj.first_name or lead_obj.last_name) else (lead_obj.company or f"Lead #{lid}")
            elif opp_acc:
                lead_name = opp_acc.name or f"Lead #{lid}"
            else:
                lead_name = f"Lead #{lid}"

            lead_company = (lead_obj.company if lead_obj else (opp_acc.name if opp_acc else '')) or ''
            lead_phone = (lead_obj.phone or lead_obj.mobile if lead_obj else (opp_acc.phone if opp_acc else '')) or ''
            lead_mobile = (lead_obj.mobile if lead_obj else '') or ''
            lead_email = (lead_obj.email if lead_obj else (opp_acc.email if opp_acc else '')) or ''
            lead_city = (lead_obj.city if lead_obj else (opp_acc.city if opp_acc else '')) or ''
            lead_status = (lead_obj.lead_status if lead_obj else ('Converted' if opp_acc else '')) or ''
            lead_priority = (lead_obj.priority if lead_obj else 'Medium') or 'Medium'
            lead_category_name = (lead_obj.category.name if lead_obj and lead_obj.category else (opp_acc.classification if opp_acc else '')) or ''
            lead_source_name = (lead_obj.lead_source.name if lead_obj and lead_obj.lead_source else '') or ''

            lead_info = {
                'id': lead_obj.id if lead_obj else lid,
                'name': lead_name,
                'company': lead_company,
                'phone': lead_phone,
                'mobile': lead_mobile,
                'email': lead_email,
                'city': lead_city,
                'lead_status': lead_status,
                'priority': lead_priority,
                'category_name': lead_category_name,
                'source_name': lead_source_name,
            }

            if not lead_hist:
                lead_hist = [{
                    'id': log.id,
                    'caller_id': log.caller_id,
                    'caller_name': c_name or 'Unknown',
                    'call_outcome': 'Converted to Opportunity' if log.call_outcome == 'Converted' else log.call_outcome,
                    'duration_seconds': log.duration_seconds,
                    'duration_display': dur_disp,
                    'notes': log.notes or '',
                    'follow_up_date': str(log.follow_up_date) if log.follow_up_date else None,
                    'called_at': log.called_at.isoformat() if log.called_at else None,
                }]

            calls_data.append({
                'id': log.id,
                'assignment_id': log.assignment_id,
                'call_outcome': 'Converted to Opportunity' if log.call_outcome == 'Converted' else log.call_outcome,
                'duration_seconds': log.duration_seconds,
                'duration_display': dur_disp,
                'notes': log.notes or '',
                'follow_up_date': str(log.follow_up_date) if log.follow_up_date else None,
                'called_at': log.called_at.isoformat() if log.called_at else None,
                'caller': {
                    'id': log.caller_id,
                    'name': c_name or 'Unknown',
                    'username': log.caller.username if log.caller else '',
                    'email': log.caller.email if log.caller else '',
                },
                'lead': lead_info,
                'total_lead_calls': len(lead_hist),
                'lead_full_history': lead_hist,
            })

        efficiency = {
            'total_calls': total_calls,
            'unique_leads': unique_leads,
            'conversions': conversions,
            'conversion_rate': round((conversions / total_calls * 100), 1) if total_calls > 0 else 0,
            'lead_conversion_rate': round((conversions / unique_leads * 100), 1) if unique_leads > 0 else 0,
            'contact_rate': round((contacted_calls / total_calls * 100), 1) if total_calls > 0 else 0,
            'avg_duration_seconds': round(avg_dur),
            'total_duration_seconds': round(total_dur),
            'outcome_breakdown': outcome_breakdown,
            'daily_trends': daily_trends,
        }

        user_name = f"{user.first_name} {user.last_name}".strip() or getattr(user, 'name', '') or user.username
        return Response({
            'is_admin': is_admin,
            'current_user': {
                'id': user.id,
                'username': user.username,
                'name': user_name,
                'email': user.email or '',
            },
            'selected_caller_id': selected_caller_id,
            'efficiency': efficiency,
            'callers_list': callers_list,
            'calls': calls_data,
        }, status=status.HTTP_200_OK)


class LeadsReportView(APIView):
    """
    API endpoint for Leads Report.
    Returns all leads with:
    - Who called that lead (list of telecallers who have called this lead)
    - Current status of the lead (lead_status, rating, priority, latest call outcome)
    - Total calls count and complete chronological interaction history
    - Supports filtering by date range, lead status, telecaller, and search.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        User = get_user_model()
        is_admin = bool(
            user.is_superuser or 
            (getattr(user, 'role', None) and user.role.name.lower() in ['admin', 'administrator', 'super admin']) or 
            (user.username and user.username.lower().startswith('admin'))
        )

        status_param = request.query_params.get('lead_status') or request.query_params.get('status')
        caller_param = request.query_params.get('caller') or request.query_params.get('caller_id')
        search_param = request.query_params.get('search', '').strip()
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')

        # Base Lead queryset
        leads_qs = Lead.objects.all().select_related('category', 'lead_source', 'lead_owner', 'industry').order_by('-created_at')

        # Status filter
        if status_param and status_param not in ['all', 'ALL', '']:
            leads_qs = leads_qs.filter(lead_status__iexact=status_param)

        # Search filter
        if search_param:
            leads_qs = leads_qs.filter(
                Q(first_name__icontains=search_param) |
                Q(last_name__icontains=search_param) |
                Q(company__icontains=search_param) |
                Q(phone__icontains=search_param) |
                Q(mobile__icontains=search_param) |
                Q(email__icontains=search_param) |
                Q(city__icontains=search_param)
            )

        # Non-admin scoping (telecallers see their assigned leads or leads they called)
        if not is_admin:
            caller_lead_ids = set(CallerCallLog.objects.filter(caller=user).values_list('assignment__lead_id', flat=True))
            assigned_lead_ids = set(TelecallingLeadAssignment.objects.filter(
                Q(employee=user) | Q(assigned_caller=user) | Q(active_caller=user)
            ).values_list('lead_id', flat=True))
            my_lead_ids = caller_lead_ids | assigned_lead_ids
            leads_qs = leads_qs.filter(id__in=my_lead_ids)

        lead_list = list(leads_qs[:1000])
        lead_ids = [l.id for l in lead_list]

        # Fetch all call logs for these leads
        call_logs = CallerCallLog.objects.filter(
            assignment__lead_id__in=lead_ids
        ).select_related('caller').order_by('-called_at')

        logs_by_lead = {}
        for c in call_logs:
            lid = c.assignment.lead_id
            if lid not in logs_by_lead:
                logs_by_lead[lid] = []

            c_name = ''
            if c.caller:
                c_name = f"{c.caller.first_name} {c.caller.last_name}".strip() or getattr(c.caller, 'name', '') or c.caller.username

            mins = (c.duration_seconds or 0) // 60
            secs = (c.duration_seconds or 0) % 60
            dur_disp = f"{mins}m {secs}s" if c.duration_seconds is not None else '—'

            logs_by_lead[lid].append({
                'id': c.id,
                'caller_id': c.caller_id,
                'caller_name': c_name or 'Unknown',
                'call_outcome': 'Converted to Opportunity' if c.call_outcome == 'Converted' else c.call_outcome,
                'duration_seconds': c.duration_seconds,
                'duration_display': dur_disp,
                'notes': c.notes or '',
                'follow_up_date': str(c.follow_up_date) if c.follow_up_date else None,
                'called_at': c.called_at.isoformat() if c.called_at else None,
            })

        start_d = parse_date(start_date_str) if start_date_str else None
        end_d = parse_date(end_date_str) if end_date_str else None

        results = []
        for lead in lead_list:
            hist = logs_by_lead.get(lead.id, [])

            # Date filtering: check if lead created in range OR called in range
            if start_d or end_d:
                created_in_range = True
                called_in_range = False

                lead_date = lead.created_at.date() if lead.created_at else None
                if start_d and lead_date and lead_date < start_d:
                    created_in_range = False
                if end_d and lead_date and lead_date > end_d:
                    created_in_range = False

                if hist:
                    for h in hist:
                        if h.get('called_at'):
                            try:
                                h_date = parse_date(h['called_at'][:10])
                                if (not start_d or h_date >= start_d) and (not end_d or h_date <= end_d):
                                    called_in_range = True
                                    break
                            except Exception:
                                pass

                if not (created_in_range or called_in_range):
                    continue

            # Identify who called that lead
            caller_map = {}
            for h in hist:
                cid = h['caller_id']
                cname = h['caller_name']
                if cname not in caller_map:
                    caller_map[cname] = {'id': cid, 'name': cname, 'calls': 0}
                caller_map[cname]['calls'] += 1

            called_by_list = list(caller_map.values())
            called_by_names = [c['name'] for c in called_by_list]

            # Caller filter: if user filtered by telecaller
            if caller_param and caller_param not in ['all', 'ALL', '']:
                try:
                    c_id = int(caller_param)
                    has_caller = any(c['id'] == c_id for c in called_by_list)
                    if not has_caller:
                        continue
                except (ValueError, TypeError):
                    pass

            latest_call = hist[0] if hist else None
            lead_name = f"{lead.first_name or ''} {lead.last_name or ''}".strip() or lead.company or f"Lead #{lead.id}"

            results.append({
                'id': lead.id,
                'name': lead_name,
                'company': lead.company or '',
                'phone': lead.phone or (lead.mobile or '') or '',
                'mobile': lead.mobile or '',
                'email': lead.email or '',
                'city': lead.city or '',
                'state': lead.state_province or '',
                'category_name': lead.category.name if lead.category else '',
                'source_name': lead.lead_source.name if lead.lead_source else '',
                'lead_status': lead.lead_status or 'Not Contacted',
                'priority': lead.priority or 'Medium',
                'rating': lead.rating or '',
                'created_at': lead.created_at.isoformat() if lead.created_at else None,
                'called_by': called_by_list,
                'called_by_display': ", ".join(called_by_names) if called_by_names else 'Not Called Yet',
                'has_been_called': len(hist) > 0,
                'total_calls': len(hist),
                'last_called_at': latest_call['called_at'] if latest_call else None,
                'latest_call': latest_call,
                'lead_full_history': hist,
            })

        # Telecallers list for filter
        caller_ids = CallerCallLog.objects.exclude(caller__isnull=True).values_list('caller_id', flat=True).distinct()
        callers_qs = User.objects.filter(id__in=caller_ids).order_by('first_name', 'username')
        callers_list = []
        for c in callers_qs:
            c_name = f"{c.first_name} {c.last_name}".strip() or getattr(c, 'name', '') or c.username
            callers_list.append({'id': c.id, 'name': c_name})

        # Statuses list
        status_options = [
            'Not Contacted',
            'Contacted',
            'Pre Qualified',
            'Not Qualified',
            'Lost Lead',
            'Junk Lead',
            'Escalated',
            'Converted to Opportunity',
        ]

        total_leads = len(results)
        called_count = sum(1 for r in results if r['has_been_called'])
        uncalled_count = total_leads - called_count
        converted_count = sum(1 for r in results if r['lead_status'] in ['Converted', 'Converted to Opportunity', 'Pre Qualified'] or (r['latest_call'] and r['latest_call']['call_outcome'] in ['Converted', 'Converted to Opportunity']))

        return Response({
            'is_admin': is_admin,
            'summary': {
                'total_leads': total_leads,
                'called_leads': called_count,
                'uncalled_leads': uncalled_count,
                'converted_leads': converted_count,
            },
            'callers_list': callers_list,
            'status_options': status_options,
            'leads': results,
        }, status=status.HTTP_200_OK)


class ConvertedLeadsReportView(APIView):
    """
    API endpoint for Converted Leads Report.
    Returns all converted leads with:
    - Converted caller details (who achieved conversion)
    - Conversion timestamp and call outcome
    - Classification: Distributor or Vendor
    - Opportunity Account details (if created: ID, name, credit limit, opening balance)
    - Opportunity Approval details (status: ACCEPTED, PENDING, ON_HOLD, remarks, submitted by, action by)
    - Total calls, total call duration, and full interaction call logs
    - Supports filtering by date range (from/to), telecaller, classification, approval status, and search.
    - Role-based scoping (telecallers see their conversions/assigned; admins see all).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        User = get_user_model()
        is_admin = bool(
            user.is_superuser or 
            (getattr(user, 'role', None) and user.role.name.lower() in ['admin', 'administrator', 'super admin']) or 
            (user.username and user.username.lower().startswith('admin'))
        )

        caller_param = request.query_params.get('caller') or request.query_params.get('caller_id')
        classification_param = request.query_params.get('classification', '').strip()
        approval_status_param = request.query_params.get('approval_status', '').strip()
        search_param = request.query_params.get('search', '').strip()
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')

        # 1. Gather all converted lead IDs from multiple signals
        status_lead_ids = set(Lead.objects.filter(
            lead_status__in=['Converted', 'Converted to Opportunity', 'Pre Qualified']
        ).values_list('id', flat=True))

        call_log_lead_ids = set(CallerCallLog.objects.filter(
            call_outcome__in=['Converted', 'Converted to Opportunity']
        ).values_list('assignment__lead_id', flat=True))

        account_lead_ids = set(OpportunityAccount.objects.exclude(lead__isnull=True).values_list('lead_id', flat=True))
        approval_lead_ids = set(OpportunityApproval.objects.exclude(lead__isnull=True).values_list('lead_id', flat=True))

        all_converted_ids = (status_lead_ids | call_log_lead_ids | account_lead_ids | approval_lead_ids) - {None}

        # Non-admin scoping: telecallers only see their own converted or assigned leads
        if not is_admin:
            my_call_log_lead_ids = set(CallerCallLog.objects.filter(caller=user).values_list('assignment__lead_id', flat=True))
            my_assigned_lead_ids = set(TelecallingLeadAssignment.objects.filter(
                Q(employee=user) | Q(assigned_caller=user) | Q(active_caller=user)
            ).values_list('lead_id', flat=True))
            my_account_lead_ids = set(OpportunityAccount.objects.filter(created_by=user).values_list('lead_id', flat=True))
            my_approval_lead_ids = set(OpportunityApproval.objects.filter(submitted_by=user).values_list('lead_id', flat=True))
            my_accessible_ids = my_call_log_lead_ids | my_assigned_lead_ids | my_account_lead_ids | my_approval_lead_ids
            all_converted_ids = all_converted_ids & my_accessible_ids

        leads_qs = Lead.objects.filter(id__in=all_converted_ids).select_related(
            'category', 'lead_source', 'lead_owner', 'industry'
        ).order_by('-created_at')

        # Search filter
        if search_param:
            leads_qs = leads_qs.filter(
                Q(first_name__icontains=search_param) |
                Q(last_name__icontains=search_param) |
                Q(company__icontains=search_param) |
                Q(phone__icontains=search_param) |
                Q(mobile__icontains=search_param) |
                Q(email__icontains=search_param) |
                Q(city__icontains=search_param)
            )

        lead_list = list(leads_qs[:1000])
        lead_ids = [l.id for l in lead_list]

        # 2. Fetch call logs for these leads
        call_logs = CallerCallLog.objects.filter(
            assignment__lead_id__in=lead_ids
        ).select_related('caller').order_by('-called_at')

        logs_by_lead = {}
        for c in call_logs:
            lid = c.assignment.lead_id
            if lid not in logs_by_lead:
                logs_by_lead[lid] = []

            c_name = ''
            if c.caller:
                c_name = f"{c.caller.first_name} {c.caller.last_name}".strip() or getattr(c.caller, 'name', '') or c.caller.username

            mins = (c.duration_seconds or 0) // 60
            secs = (c.duration_seconds or 0) % 60
            dur_disp = f"{mins}m {secs}s" if c.duration_seconds is not None else '—'

            logs_by_lead[lid].append({
                'id': c.id,
                'caller_id': c.caller_id,
                'caller_name': c_name or 'Unknown',
                'call_outcome': 'Converted to Opportunity' if c.call_outcome == 'Converted' else c.call_outcome,
                'duration_seconds': c.duration_seconds or 0,
                'duration_display': dur_disp,
                'notes': c.notes or '',
                'follow_up_date': str(c.follow_up_date) if c.follow_up_date else None,
                'called_at': c.called_at.isoformat() if c.called_at else None,
            })

        # 3. Fetch OpportunityAccount objects for these leads
        opp_accounts_list = OpportunityAccount.objects.filter(
            Q(lead_id__in=lead_ids) | Q(assignment__lead_id__in=lead_ids)
        ).select_related('created_by')
        accounts_by_lead = {}
        for acc in opp_accounts_list:
            if acc.lead_id:
                accounts_by_lead[acc.lead_id] = acc
            elif acc.assignment and acc.assignment.lead_id:
                accounts_by_lead[acc.assignment.lead_id] = acc

        # 4. Fetch OpportunityApproval objects for these leads
        opp_approvals_list = OpportunityApproval.objects.filter(
            Q(lead_id__in=lead_ids) | Q(assignment__lead_id__in=lead_ids)
        ).select_related('submitted_by', 'action_by')
        approvals_by_lead = {}
        for appr in opp_approvals_list:
            if appr.lead_id:
                approvals_by_lead[appr.lead_id] = appr
            elif appr.assignment and appr.assignment.lead_id:
                approvals_by_lead[appr.assignment.lead_id] = appr

        start_d = parse_date(start_date_str) if start_date_str else None
        end_d = parse_date(end_date_str) if end_date_str else None

        results = []
        for lead in lead_list:
            hist = logs_by_lead.get(lead.id, [])
            opp_acc = accounts_by_lead.get(lead.id)
            opp_appr = approvals_by_lead.get(lead.id)

            # Determine conversion event (caller, timestamp, notes)
            conv_log = next(
                (h for h in hist if h['call_outcome'] in ['Converted', 'Converted to Opportunity']),
                None
            )

            converted_caller_id = None
            converted_caller_name = ''
            converted_at_iso = None
            conversion_notes = ''

            if conv_log:
                converted_caller_id = conv_log['caller_id']
                converted_caller_name = conv_log['caller_name']
                converted_at_iso = conv_log['called_at']
                conversion_notes = conv_log['notes']
            elif opp_appr and opp_appr.submitted_by:
                converted_caller_id = opp_appr.submitted_by_id
                converted_caller_name = f"{opp_appr.submitted_by.first_name} {opp_appr.submitted_by.last_name}".strip() or opp_appr.submitted_by.username
                converted_at_iso = opp_appr.submitted_at.isoformat() if opp_appr.submitted_at else None
                conversion_notes = opp_appr.remarks or ''
            elif opp_acc and opp_acc.created_by:
                converted_caller_id = opp_acc.created_by_id
                converted_caller_name = f"{opp_acc.created_by.first_name} {opp_acc.created_by.last_name}".strip() or opp_acc.created_by.username
                converted_at_iso = opp_acc.created_at.isoformat() if opp_acc.created_at else None
            elif hist:
                converted_caller_id = hist[0]['caller_id']
                converted_caller_name = hist[0]['caller_name']
                converted_at_iso = hist[0]['called_at']
                conversion_notes = hist[0]['notes']
            elif lead.lead_owner:
                converted_caller_id = lead.lead_owner_id
                converted_caller_name = f"{lead.lead_owner.first_name} {lead.lead_owner.last_name}".strip() or lead.lead_owner.username
                converted_at_iso = lead.created_at.isoformat() if lead.created_at else None

            # Date filtering by converted date (or lead created date)
            if start_d or end_d:
                conv_d = None
                if converted_at_iso:
                    try:
                        conv_d = parse_date(converted_at_iso[:10])
                    except Exception:
                        pass
                if not conv_d and lead.created_at:
                    conv_d = lead.created_at.date()

                if start_d and conv_d and conv_d < start_d:
                    continue
                if end_d and conv_d and conv_d > end_d:
                    continue

            # Telecaller filter
            if caller_param and caller_param not in ['all', 'ALL', '']:
                try:
                    c_id = int(caller_param)
                    if converted_caller_id != c_id:
                        continue
                except (ValueError, TypeError):
                    pass

            # Classification determination
            classification = 'Distributor'
            if opp_acc and opp_acc.classification:
                classification = opp_acc.classification
            elif opp_appr and opp_appr.classification:
                classification = opp_appr.classification
            else:
                combined_text = " ".join(filter(None, [
                    lead.category.name if lead.category else '',
                    lead.lead_source.name if lead.lead_source else '',
                    lead.company or '',
                    lead.description or '',
                    lead.title or ''
                ])).lower()
                if any(w in combined_text for w in ['vendor', 'supplier', 'creditor']):
                    classification = 'Vendor'

            # Classification filter
            if classification_param and classification_param not in ['all', 'ALL', '']:
                if classification.lower() != classification_param.lower():
                    continue

            # Approval status determination
            approval_status = 'NOT_SUBMITTED'
            approval_data = None
            if opp_appr:
                approval_status = opp_appr.status or 'PENDING'
                sub_name = ''
                if opp_appr.submitted_by:
                    sub_name = f"{opp_appr.submitted_by.first_name} {opp_appr.submitted_by.last_name}".strip() or opp_appr.submitted_by.username
                act_name = ''
                if opp_appr.action_by:
                    act_name = f"{opp_appr.action_by.first_name} {opp_appr.action_by.last_name}".strip() or opp_appr.action_by.username

                approval_data = {
                    'id': opp_appr.id,
                    'status': opp_appr.status,
                    'classification': opp_appr.classification,
                    'submitted_by_name': sub_name,
                    'submitted_at': opp_appr.submitted_at.isoformat() if opp_appr.submitted_at else None,
                    'action_by_name': act_name,
                    'action_at': opp_appr.action_at.isoformat() if opp_appr.action_at else None,
                    'remarks': opp_appr.remarks or '',
                }

            # Approval status filter
            if approval_status_param and approval_status_param not in ['all', 'ALL', '']:
                if approval_status.lower() != approval_status_param.lower():
                    continue

            # Opportunity Account data
            account_data = None
            if opp_acc:
                account_data = {
                    'id': opp_acc.id,
                    'name': opp_acc.name,
                    'accountGroup': opp_acc.accountGroup or '',
                    'account_group_name': opp_acc.account_group_name or '',
                    'classification': opp_acc.classification,
                    'credit_limit': float(opp_acc.credit_limit or 0),
                    'opening_balance': float(opp_acc.opening_balance or 0),
                    'city': opp_acc.city or '',
                    'phone': opp_acc.phone or '',
                    'email': opp_acc.email or '',
                    'created_at': opp_acc.created_at.isoformat() if opp_acc.created_at else None,
                }

            # Duration and call metrics
            total_duration_sec = sum(h.get('duration_seconds', 0) for h in hist)
            tot_mins = total_duration_sec // 60
            tot_secs = total_duration_sec % 60
            tot_dur_disp = f"{tot_mins}m {tot_secs}s" if total_duration_sec > 0 else '—'

            lead_name = f"{lead.first_name or ''} {lead.last_name or ''}".strip() or lead.company or f"Lead #{lead.id}"

            results.append({
                'id': lead.id,
                'name': lead_name,
                'company': lead.company or '',
                'phone': lead.phone or (lead.mobile or '') or '',
                'mobile': lead.mobile or '',
                'email': lead.email or '',
                'city': lead.city or '',
                'state': lead.state_province or '',
                'category_name': lead.category.name if lead.category else '',
                'source_name': lead.lead_source.name if lead.lead_source else '',
                'classification': classification,
                'converted_by': {
                    'id': converted_caller_id,
                    'name': converted_caller_name or 'Unknown',
                },
                'converted_at': converted_at_iso,
                'conversion_notes': conversion_notes,
                'has_account_created': opp_acc is not None,
                'opportunity_account': account_data,
                'approval_status': approval_status,
                'approval': approval_data,
                'total_calls': len(hist),
                'total_duration_seconds': total_duration_sec,
                'total_duration_display': tot_dur_disp,
                'call_logs': hist,
                'created_at': lead.created_at.isoformat() if lead.created_at else None,
            })

        total_converted = len(results)
        distributors_count = sum(1 for r in results if r['classification'] == 'Distributor')
        vendors_count = sum(1 for r in results if r['classification'] == 'Vendor')
        accounts_created_count = sum(1 for r in results if r['has_account_created'])
        approvals_accepted_count = sum(1 for r in results if r['approval_status'] == 'ACCEPTED')
        approvals_pending_count = sum(1 for r in results if r['approval_status'] == 'PENDING')
        approvals_on_hold_count = sum(1 for r in results if r['approval_status'] == 'ON_HOLD')

        # Top callers tally
        caller_counts = {}
        for r in results:
            c_name = r['converted_by']['name']
            c_id = r['converted_by']['id']
            if c_name and c_name != 'Unknown':
                if c_name not in caller_counts:
                    caller_counts[c_name] = {'id': c_id, 'name': c_name, 'count': 0}
                caller_counts[c_name]['count'] += 1

        top_callers = sorted(caller_counts.values(), key=lambda x: x['count'], reverse=True)[:5]

        # Callers list for dropdown
        caller_ids = set(r['converted_by']['id'] for r in results if r['converted_by']['id'])
        callers_qs = User.objects.filter(id__in=caller_ids).order_by('first_name', 'username')
        callers_list = []
        for c in callers_qs:
            c_name = f"{c.first_name} {c.last_name}".strip() or getattr(c, 'name', '') or c.username
            callers_list.append({'id': c.id, 'name': c_name})

        return Response({
            'is_admin': is_admin,
            'summary': {
                'total_converted': total_converted,
                'total_distributors': distributors_count,
                'total_vendors': vendors_count,
                'accounts_created': accounts_created_count,
                'approvals_accepted': approvals_accepted_count,
                'approvals_pending': approvals_pending_count,
                'approvals_on_hold': approvals_on_hold_count,
                'top_callers': top_callers,
            },
            'callers_list': callers_list,
            'leads': results,
        }, status=status.HTTP_200_OK)


from .models import OpportunityAccount
from .serializers import OpportunityAccountSerializer

class OpportunityAccountViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Converted Opportunity accounts (Distributor/Vendor profiles) stored in crm_opportunity_account."""
    queryset = OpportunityAccount.objects.select_related('lead', 'created_by').order_by('-created_at')
    serializer_class = OpportunityAccountSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['lead', 'assignment', 'classification']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], url_path='created-lead-ids')
    def created_lead_ids(self, request):
        """Returns the list of lead IDs that already have an opportunity account created."""
        lead_ids = list(OpportunityAccount.objects.exclude(lead__isnull=True).values_list('lead_id', flat=True).distinct())
        return Response({'lead_ids': lead_ids}, status=status.HTTP_200_OK)


from .models import OpportunityApproval
from .serializers import OpportunityApprovalSerializer

class OpportunityApprovalViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Converted Opportunity approvals.
    Callers can send converted leads for approval.
    Approvers can review and either Accept or put On Hold.
    """
    queryset = OpportunityApproval.objects.select_related(
        'lead', 'assignment', 'opportunity_account', 'submitted_by', 'action_by'
    ).order_by('-submitted_at')
    serializer_class = OpportunityApprovalSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'classification', 'lead']

    @action(detail=False, methods=['post'], url_path='send-for-approval')
    def send_for_approval(self, request):
        """
        Caller submits a converted opportunity for approval.
        Payload: { lead_id, assignment_id, classification }
        """
        lead_id = request.data.get('lead_id')
        assignment_id = request.data.get('assignment_id')
        classification = request.data.get('classification', 'Distributor')

        if not lead_id:
            return Response({'error': 'lead_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Look up optional existing OpportunityAccount
        opp_account = OpportunityAccount.objects.filter(lead_id=lead_id).first()
        if not opp_account and assignment_id:
            opp_account = OpportunityAccount.objects.filter(assignment_id=assignment_id).first()

        # Get or create approval record
        approval = OpportunityApproval.objects.filter(lead_id=lead_id).first()
        if approval:
            approval.assignment_id = assignment_id or approval.assignment_id
            approval.opportunity_account = opp_account or approval.opportunity_account
            approval.classification = classification or approval.classification
            approval.status = 'PENDING'
            approval.submitted_by = request.user
            approval.submitted_at = timezone.now()
            approval.action_by = None
            approval.action_at = None
            approval.remarks = ''
            approval.save()
        else:
            approval = OpportunityApproval.objects.create(
                lead_id=lead_id,
                assignment_id=assignment_id,
                opportunity_account=opp_account,
                classification=classification,
                status='PENDING',
                submitted_by=request.user,
                submitted_at=timezone.now()
            )

        serializer = self.get_serializer(approval)
        return Response({
            'message': 'Opportunity sent for approval successfully',
            'approval': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='action')
    def take_action(self, request, pk=None):
        """
        Approver accepts or puts on hold.
        Payload: { action: 'ACCEPT' | 'ON_HOLD', remarks: '...' }
        """
        approval = self.get_object()
        action_type = (request.data.get('action') or '').upper().strip()
        remarks = request.data.get('remarks', '').strip()

        if action_type not in ['ACCEPT', 'ON_HOLD', 'ACCEPTED']:
            return Response({'error': 'Invalid action. Must be ACCEPT or ON_HOLD'}, status=status.HTTP_400_BAD_REQUEST)

        target_status = 'ACCEPTED' if action_type in ['ACCEPT', 'ACCEPTED'] else 'ON_HOLD'
        approval.status = target_status
        approval.action_by = request.user
        approval.action_at = timezone.now()
        if remarks:
            approval.remarks = remarks
        approval.save()

        # When accepted, save details from OpportunityAccount into Ledger table (finance_app_ledger) & Lead table
        if target_status == 'ACCEPTED':
            opp_acc = approval.opportunity_account
            if not opp_acc and approval.lead_id:
                opp_acc = OpportunityAccount.objects.filter(lead_id=approval.lead_id).first()
            if not opp_acc and approval.assignment_id:
                opp_acc = OpportunityAccount.objects.filter(assignment_id=approval.assignment_id).first()

            if opp_acc:
                if not approval.opportunity_account:
                    approval.opportunity_account = opp_acc
                    approval.save(update_fields=['opportunity_account'])

                # 1. Save into finance_app_ledger (Ledger table)
                try:
                    from finance_app.models import Ledger, AccountGroup, LedgerGst, LedgerContactDetail, LedgerBankDetail

                    # Resolve AccountGroup
                    acc_group = None
                    if opp_acc.accountGroup:
                        try:
                            acc_group = AccountGroup.objects.filter(id=int(opp_acc.accountGroup)).first()
                        except (ValueError, TypeError):
                            acc_group = AccountGroup.objects.filter(name__iexact=str(opp_acc.accountGroup)).first()
                    if not acc_group and opp_acc.account_group_name:
                        acc_group = AccountGroup.objects.filter(name__iexact=str(opp_acc.account_group_name)).first()
                    if not acc_group:
                        is_vendor = (opp_acc.classification == 'Vendor')
                        target_id = 12 if is_vendor else 3
                        acc_group = AccountGroup.objects.filter(id=target_id).first()
                        if not acc_group:
                            acc_group = AccountGroup.objects.filter(name__icontains='creditor' if is_vendor else 'debtor').first()

                    # Resolve primary GST number and registration type if available in gst_details
                    gst_number = opp_acc.gst_number or ''
                    reg_type = opp_acc.registration_type or 'unknown'
                    if not gst_number and isinstance(opp_acc.gst_details, list) and len(opp_acc.gst_details) > 0:
                        first_gst = opp_acc.gst_details[0]
                        if isinstance(first_gst, dict):
                            gst_number = first_gst.get('gst_number') or gst_number
                            reg_type = first_gst.get('registration_type') or reg_type

                    ledger_defaults = {
                        'accountGroup': acc_group,
                        'maintain_biilwise_details': bool(opp_acc.maintain_biilwise_details),
                        'mailing_name': opp_acc.mailing_name or opp_acc.name,
                        'address1': opp_acc.address1 or '',
                        'address2': opp_acc.address2 or opp_acc.city or '',
                        'address3': opp_acc.address3 or '',
                        'address': opp_acc.address or opp_acc.address1 or '',
                        'state': opp_acc.state or 'Kerala',
                        'country': opp_acc.country or 'India',
                        'pincode': opp_acc.pincode or '',
                        'phone': opp_acc.phone or '',
                        'email': opp_acc.email or '',
                        'gst_number': gst_number,
                        'pan_number': opp_acc.pan_number or '',
                        'credit_limit': opp_acc.credit_limit or 0.00,
                        'opening_balance': opp_acc.opening_balance or 0.00,
                        'opening_balance_type': opp_acc.opening_balance_type or ('Cr' if opp_acc.classification == 'Vendor' else 'Dr'),
                        'placeofsupply': opp_acc.placeofsupply or opp_acc.state or 'Kerala',
                        'closing_balance': opp_acc.opening_balance or 0.00,
                        'registration_type': reg_type,
                        'created_by': request.user,
                        'edited_by': request.user,
                    }

                    ledger, _ = Ledger.objects.update_or_create(
                        name=opp_acc.name,
                        defaults=ledger_defaults
                    )

                    # Sync GST Details
                    if isinstance(opp_acc.gst_details, list) and opp_acc.gst_details:
                        ledger.gst_details.all().delete()
                        for g in opp_acc.gst_details:
                            if isinstance(g, dict) and any(g.values()):
                                gst_pct = 0.00
                                if g.get('gst_percentage'):
                                    try:
                                        gst_pct = float(g.get('gst_percentage'))
                                    except (ValueError, TypeError):
                                        gst_pct = 0.00
                                LedgerGst.objects.create(
                                    ledger=ledger,
                                    applicable_date=g.get('applicable_date') or None,
                                    registration_type=g.get('registration_type') or reg_type,
                                    gst_number=g.get('gst_number') or gst_number,
                                    place_of_supply=g.get('place_of_supply') or ledger.placeofsupply or 'Kerala',
                                    gst_percentage=gst_pct,
                                    hsn_code=g.get('hsn_code') or ''
                                )

                    # Sync Contact Details
                    if isinstance(opp_acc.contact_details, list) and opp_acc.contact_details:
                        ledger.contact_details.all().delete()
                        for c in opp_acc.contact_details:
                            if isinstance(c, dict) and any(c.values()):
                                LedgerContactDetail.objects.create(
                                    ledger=ledger,
                                    contact_name=c.get('contact_name') or '',
                                    phone_no=c.get('phone_no') or '',
                                    primary_mobile=c.get('primary_mobile') or '',
                                    fax_no=c.get('fax_no') or '',
                                    email=c.get('email') or '',
                                    cc=c.get('cc') or '',
                                    website=c.get('website') or '',
                                    whatsapp_no=c.get('whatsapp_no') or '',
                                    whatsapp_marketing=bool(c.get('whatsapp_marketing'))
                                )

                    # Sync Bank Details
                    if isinstance(opp_acc.bank_details, list) and opp_acc.bank_details:
                        ledger.bank_details.all().delete()
                        for b in opp_acc.bank_details:
                            if isinstance(b, dict) and any(b.values()):
                                LedgerBankDetail.objects.create(
                                    ledger=ledger,
                                    bank_account_no=b.get('bank_account_no') or '',
                                    bank_name=b.get('bank_name') or '',
                                    branch=b.get('branch') or '',
                                    ifsc_code=b.get('ifsc_code') or '',
                                    micr_code=b.get('micr_code') or '',
                                    bank_phone_no=b.get('bank_phone_no') or ''
                                )
                except Exception as ledger_err:
                    import logging
                    logging.getLogger(__name__).error(f"Failed to sync OpportunityAccount to Ledger: {ledger_err}")

                # 2. Once opportunity is approved and saved in ledger table, remove lead details from lead table
                lead_id_to_delete = approval.lead_id
                if not lead_id_to_delete and opp_acc and opp_acc.lead_id:
                    lead_id_to_delete = opp_acc.lead_id

                if lead_id_to_delete:
                    from .models import Lead
                    try:
                        Lead.objects.filter(id=lead_id_to_delete).delete()
                    except Exception as del_err:
                        import logging
                        logging.getLogger(__name__).error(f"Failed to delete Lead #{lead_id_to_delete}: {del_err}")
                approval.refresh_from_db()

        serializer = self.get_serializer(approval)
        return Response({
            'message': f"Opportunity {target_status.replace('_', ' ').title()} successfully",
            'approval': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='status-map')
    def status_map(self, request):
        """
        Returns a map of lead_id -> { status, id, submitted_at, action_at, remarks }
        for quick lookup by caller table.
        """
        approvals = OpportunityApproval.objects.all().values(
            'id', 'lead_id', 'status', 'submitted_at', 'action_at', 'remarks'
        )
        res = {}
        for a in approvals:
            if a['lead_id']:
                res[str(a['lead_id'])] = {
                    'id': a['id'],
                    'status': a['status'],
                    'submitted_at': a['submitted_at'].isoformat() if a['submitted_at'] else None,
                    'action_at': a['action_at'].isoformat() if a['action_at'] else None,
                    'remarks': a['remarks'] or ''
                }
        return Response(res, status=status.HTTP_200_OK)




