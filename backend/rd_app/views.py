from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q

from production_app.models import PostProductionEntry
from .models import RnDEntry, ExtraQuantity
from .serializers import (
    RnDEntrySerializer,
    PostProductionRnDListingSerializer,
    ExtraQuantitySerializer,
)


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_paginated_response(self, data):
        try:
            next_link = self.get_next_link()
        except Exception:
            next_link = None
        try:
            prev_link = self.get_previous_link()
        except Exception:
            prev_link = None

        return Response({
            'count': self.page.paginator.count,
            'total_pages': self.page.paginator.num_pages,
            'current_page': self.page.number,
            'next': next_link,
            'previous': prev_link,
            'results': data
        })


class RnDEntryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for RnDEntry operations.
    Follows existing Post Production API architecture and permissions.
    """
    queryset = RnDEntry.objects.select_related(
        'post_production_entry__production_line__shift_day',
        'post_production_entry__production_line__production_line',
        'post_production_entry__production_line__stock_item',
        'post_production_entry__stock_item',
        'post_production_entry__stock_item__base_unit',
    ).prefetch_related('manufactural_journals').all()
    serializer_class = RnDEntrySerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def paginate_queryset(self, queryset):
        if self.request.query_params.get('no_pagination') == 'true' or self.request.query_params.get('all') == 'true':
            return None
        return super().paginate_queryset(queryset)

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Date filtering
        from_date = self.request.query_params.get('from_date')
        to_date = self.request.query_params.get('to_date')
        date = self.request.query_params.get('date')

        if date:
            queryset = queryset.filter(
                Q(post_production_entry__production_line__shift_day__plan_date=date) |
                Q(post_production_entry__production_type='ADJUSTMENT', post_production_entry__created_at__date=date)
            )
        else:
            if from_date:
                queryset = queryset.filter(
                    Q(post_production_entry__production_line__shift_day__plan_date__gte=from_date) |
                    Q(post_production_entry__production_type='ADJUSTMENT', post_production_entry__created_at__date__gte=from_date)
                )
            if to_date:
                queryset = queryset.filter(
                    Q(post_production_entry__production_line__shift_day__plan_date__lte=to_date) |
                    Q(post_production_entry__production_type='ADJUSTMENT', post_production_entry__created_at__date__lte=to_date)
                )

        # Production Line or Post Production filtering
        post_production_entry_id = self.request.query_params.get('post_production_entry_id')
        if post_production_entry_id:
            queryset = queryset.filter(post_production_entry_id=post_production_entry_id)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(post_production_entry__production_line__production_line__name__icontains=search) |
                Q(post_production_entry__production_line__stock_item__name__icontains=search) |
                Q(post_production_entry__stock_item__name__icontains=search)
            )

        has_mj = self.request.query_params.get('has_manufacture_journal')
        if has_mj == 'false':
            queryset = queryset.filter(manufactural_journals__isnull=True)
        elif has_mj == 'true':
            queryset = queryset.filter(manufactural_journals__isnull=False)

        return queryset

    def create(self, request, *args, **kwargs):
        """
        Create a new RnDEntry.
        If an R&D entry for the given PostProductionEntry already exists,
        update it instead to prevent duplicate records.
        """
        post_prod_id = request.data.get('post_production_entry')
        if post_prod_id:
            existing = RnDEntry.objects.filter(post_production_entry_id=post_prod_id).first()
            if existing:
                serializer = self.get_serializer(existing, data=request.data, partial=True)
                serializer.is_valid(raise_exception=True)
                self.perform_update(serializer)
                return Response(serializer.data, status=status.HTTP_200_OK)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=['get'], url_path='post-production-entries')
    def post_production_entries(self, request):
        """
        List PostProduction entries with their R&D entry status (COMPLETED / PENDING).
        Supports production_type ('REGULAR', 'ADJUSTMENT', 'ALL'), date filters, search, and pagination.
        """
        prod_type = request.query_params.get('production_type', 'REGULAR').upper()

        if prod_type == 'ADJUSTMENT':
            queryset = PostProductionEntry.objects.filter(
                production_type='ADJUSTMENT'
            ).select_related(
                'stock_item',
                'stock_item__base_unit',
                'stock_item__alternate_unit',
                'rnd_entry'
            ).order_by('-created_at', '-id')

            date = request.query_params.get('date')
            from_date = request.query_params.get('from_date')
            to_date = request.query_params.get('to_date')

            if date:
                queryset = queryset.filter(created_at__date=date)
            else:
                if from_date:
                    queryset = queryset.filter(created_at__date__gte=from_date)
                if to_date:
                    queryset = queryset.filter(created_at__date__lte=to_date)

            search = request.query_params.get('search')
            if search:
                queryset = queryset.filter(
                    Q(stock_item__name__icontains=search) |
                    Q(stock_item__item_code__icontains=search)
                )
        elif prod_type == 'ALL':
            queryset = PostProductionEntry.objects.select_related(
                'production_line__shift_day__shift_plan__factory',
                'production_line__shift_day__shift',
                'production_line__production_line',
                'production_line__stock_item',
                'stock_item',
                'stock_item__base_unit',
                'stock_item__alternate_unit',
                'rnd_entry'
            ).order_by('-id')

            date = request.query_params.get('date')
            from_date = request.query_params.get('from_date')
            to_date = request.query_params.get('to_date')

            if date:
                queryset = queryset.filter(
                    Q(production_line__shift_day__plan_date=date) |
                    Q(production_type='ADJUSTMENT', created_at__date=date)
                )
            else:
                if from_date:
                    queryset = queryset.filter(
                        Q(production_line__shift_day__plan_date__gte=from_date) |
                        Q(production_type='ADJUSTMENT', created_at__date__gte=from_date)
                    )
                if to_date:
                    queryset = queryset.filter(
                        Q(production_line__shift_day__plan_date__lte=to_date) |
                        Q(production_type='ADJUSTMENT', created_at__date__lte=to_date)
                    )

            factory_id = request.query_params.get('factory_id')
            if factory_id:
                queryset = queryset.filter(
                    Q(production_line__shift_day__shift_plan__factory_id=factory_id) |
                    Q(production_type='ADJUSTMENT')
                )

            search = request.query_params.get('search')
            if search:
                queryset = queryset.filter(
                    Q(production_line__production_line__name__icontains=search) |
                    Q(production_line__stock_item__name__icontains=search) |
                    Q(stock_item__name__icontains=search)
                )
        else:
            # Default: REGULAR production entries
            queryset = PostProductionEntry.objects.filter(
                production_type='REGULAR'
            ).select_related(
                'production_line__shift_day__shift_plan__factory',
                'production_line__shift_day__shift',
                'production_line__production_line',
                'production_line__stock_item',
                'stock_item',
                'rnd_entry'
            ).order_by('-production_line__shift_day__plan_date', '-id')

            from_date = request.query_params.get('from_date')
            to_date = request.query_params.get('to_date')
            date = request.query_params.get('date')
            factory_id = request.query_params.get('factory_id')

            if date:
                queryset = queryset.filter(production_line__shift_day__plan_date=date)
            else:
                if from_date:
                    queryset = queryset.filter(production_line__shift_day__plan_date__gte=from_date)
                if to_date:
                    queryset = queryset.filter(production_line__shift_day__plan_date__lte=to_date)

            if factory_id:
                queryset = queryset.filter(production_line__shift_day__shift_plan__factory_id=factory_id)

            search = request.query_params.get('search')
            if search:
                queryset = queryset.filter(
                    Q(production_line__production_line__name__icontains=search) |
                    Q(production_line__stock_item__name__icontains=search)
                )

        status_param = request.query_params.get('status')
        if status_param == 'PENDING':
            queryset = queryset.filter(rnd_entry__isnull=True)
        elif status_param == 'COMPLETED':
            queryset = queryset.filter(rnd_entry__isnull=False)

        # Pagination
        no_page = request.query_params.get('no_page')
        if no_page and no_page.lower() == 'true':
            serializer = PostProductionRnDListingSerializer(queryset, many=True)
            return Response(serializer.data)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = PostProductionRnDListingSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = PostProductionRnDListingSerializer(queryset, many=True)
        return Response(serializer.data)


class ExtraQuantityViewSet(viewsets.ModelViewSet):
    """
    ViewSet for ExtraQuantity operations.
    Tracks extra quantity (balance alternate) with IN, OUT, and post_production link.
    """
    queryset = ExtraQuantity.objects.select_related(
        'post_production__production_line__shift_day__shift_plan__factory',
        'post_production__production_line__shift_day__shift',
        'post_production__production_line__production_line',
        'post_production__production_line__stock_item'
    ).all()
    serializer_class = ExtraQuantitySerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        post_prod_id = self.request.query_params.get('post_production_id')
        if post_prod_id:
            queryset = queryset.filter(post_production_id=post_prod_id)
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(post_production__production_line__production_line__name__icontains=search) |
                Q(post_production__production_line__stock_item__name__icontains=search)
            )
        return queryset

