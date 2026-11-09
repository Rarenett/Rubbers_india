from django.db import models

from production_app.models import PostProductionEntry

# Create your models here.


class RnDEntry(models.Model):
    post_production_entry = models.OneToOneField(
        PostProductionEntry,
        on_delete=models.CASCADE,
        related_name="rnd_entry"
    )
    manufactured_quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )
    damaged_quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )
    balance_quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"R&D Entry #{self.id} (Post Production #{self.post_production_entry_id})"


class ExtraQuantity(models.Model):
    post_production = models.ForeignKey(
        PostProductionEntry,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="extra_quantities",
        db_column="post_production_id"
    )
    stock_item = models.ForeignKey(
        'inventory_app.StockItem',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="extra_quantities"
    )
    production_line = models.ForeignKey(
        'production_app.ShiftProductionLine',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="extra_quantities"
    )
    unit = models.ForeignKey(
        'inventory_app.Unit',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        help_text="Unit of the extra quantity (balance alternate unit / product alternate unit)"
    )
    in_quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        db_column="IN",
        help_text="IN quantity (balance alternate)"
    )
    out_quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        db_column="OUT",
        help_text="OUT quantity"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "extra_quantity"
        ordering = ['-created_at']
        verbose_name = "Extra Quantity"
        verbose_name_plural = "Extra Quantities"

    def __str__(self):
        post_prod_str = f"Post Production #{self.post_production_id}" if self.post_production_id else "Unallocated"
        stock_str = f" [{self.stock_item.name}]" if self.stock_item else ""
        unit_str = f" {self.unit.name}" if self.unit else ""
        return f"Extra Quantity #{self.id}{stock_str} ({post_prod_str}): IN={self.in_quantity}, OUT={self.out_quantity}{unit_str}"

    @property
    def IN(self):
        return self.in_quantity

    @IN.setter
    def IN(self, value):
        self.in_quantity = value

    @property
    def OUT(self):
        return self.out_quantity

    @OUT.setter
    def OUT(self, value):
        self.out_quantity = value


from django.db.models.signals import post_save
from django.dispatch import receiver
from decimal import Decimal


@receiver(post_save, sender=PostProductionEntry)
def sync_post_production_extra_quantity(sender, instance, **kwargs):
    if instance.production_type == 'ADJUSTMENT':
        return
    bal_alt = Decimal(str(instance.balance_alternate or 0))
    if bal_alt > 0:
        if getattr(instance, '_extra_quantity_synced', False):
            return
        instance._extra_quantity_synced = True

        alt_unit = None
        stock_item = None
        production_line = instance.production_line
        try:
            if instance.production_line:
                stock_item = instance.production_line.stock_item
                alt_unit = stock_item.alternate_unit
            elif instance.stock_item:
                stock_item = instance.stock_item
                alt_unit = stock_item.alternate_unit
        except AttributeError:
            pass

        ExtraQuantity.objects.create(
            post_production=None,
            stock_item=stock_item,
            production_line=production_line,
            unit=alt_unit,
            in_quantity=bal_alt,
            out_quantity=Decimal('0.00'),
        )

