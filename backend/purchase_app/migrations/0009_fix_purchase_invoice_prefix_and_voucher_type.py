"""
Migration: Fix Purchase Invoice voucher numbering per category.

Two-part fix:
  1. Give B2C (id=18) and IGST (id=33) PrefixConfiguration rows their own
     distinct prefixes so B2B / B2C / IGST never share a number space:
       B2B  id=17  PI  (unchanged)
       B2C  id=18  Pi -> PC
       IGST id=33  Pi -> PG

  2. Backfill the 13 legacy PurchaseInvoice records whose voucher_type was
     saved as a human-readable label ('B2B Purchase', 'B2C Purchase',
     'IGST Purchase') instead of the PrefixConfiguration id string.
     These records are invisible to the per-category filter and must be
     corrected so the sequence logic works against the right subset.
"""
from django.db import migrations


def fix_prefixes_and_backfill_voucher_type(apps, schema_editor):
    PrefixConfiguration = apps.get_model('settings_app', 'PrefixConfiguration')
    PurchaseInvoice = apps.get_model('purchase_app', 'PurchaseInvoice')

    # ── Part 1: Fix the shared 'Pi' prefix ──────────────────────────────────
    # B2C Purchase (id=18): Pi -> PC
    try:
        b2c = PrefixConfiguration.objects.get(id=18)
        if b2c.prefix == 'Pi':
            b2c.prefix = 'PC'
            b2c.save()
    except PrefixConfiguration.DoesNotExist:
        pass  # Row not present in this environment — skip gracefully.

    # IGST Purchase (id=33): Pi -> PG
    try:
        igst = PrefixConfiguration.objects.get(id=33)
        if igst.prefix == 'Pi':
            igst.prefix = 'PG'
            igst.save()
    except PrefixConfiguration.DoesNotExist:
        pass

    # ── Part 2: Backfill legacy voucher_type label strings ──────────────────
    # Map human-readable label -> PrefixConfiguration id (as string).
    LABEL_TO_ID = {
        'B2B Purchase':  '17',
        'B2C Purchase':  '18',
        'IGST Purchase': '33',
    }
    for label, prefix_id in LABEL_TO_ID.items():
        updated = PurchaseInvoice.objects.filter(voucher_type=label).update(
            voucher_type=prefix_id
        )
        if updated:
            print(f"  Backfilled {updated} invoice(s): voucher_type '{label}' -> '{prefix_id}'")


def reverse_fix(apps, schema_editor):
    """
    Reverse: restore original prefixes and re-apply label strings.
    (Best-effort — only undoes rows that still carry the migrated values.)
    """
    PrefixConfiguration = apps.get_model('settings_app', 'PrefixConfiguration')
    PurchaseInvoice = apps.get_model('purchase_app', 'PurchaseInvoice')

    try:
        b2c = PrefixConfiguration.objects.get(id=18)
        if b2c.prefix == 'PC':
            b2c.prefix = 'Pi'
            b2c.save()
    except PrefixConfiguration.DoesNotExist:
        pass

    try:
        igst = PrefixConfiguration.objects.get(id=33)
        if igst.prefix == 'PG':
            igst.prefix = 'Pi'
            igst.save()
    except PrefixConfiguration.DoesNotExist:
        pass

    ID_TO_LABEL = {
        '17': 'B2B Purchase',
        '18': 'B2C Purchase',
        '33': 'IGST Purchase',
    }
    for prefix_id, label in ID_TO_LABEL.items():
        PurchaseInvoice.objects.filter(voucher_type=prefix_id).update(
            voucher_type=label
        )


class Migration(migrations.Migration):

    dependencies = [
        ('purchase_app', '0008_purchasetallysyncconfig'),
        # settings_app must already exist so get_model works
        ('settings_app', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(
            fix_prefixes_and_backfill_voucher_type,
            reverse_code=reverse_fix,
        ),
    ]
