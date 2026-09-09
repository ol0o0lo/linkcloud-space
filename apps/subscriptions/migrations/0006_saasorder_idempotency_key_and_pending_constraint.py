from django.db import migrations, models
from django.db.models import Q
from django.utils import timezone


def close_duplicate_pending_orders(apps, schema_editor):
    SaaSOrder = apps.get_model("subscriptions", "SaaSOrder")
    pending_orders = SaaSOrder.objects.filter(status="pending_payment").order_by("organization_id", "-created_at", "-pk")
    retained_organizations = set()
    now = timezone.now()
    for order in pending_orders.iterator():
        if order.organization_id not in retained_organizations:
            retained_organizations.add(order.organization_id)
            continue
        order.status = "closed"
        order.close_reason = "superseded"
        order.closed_at = now
        order.save(update_fields=["status", "close_reason", "closed_at", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [("subscriptions", "0005_alter_saasorder_close_reason")]

    operations = [
        migrations.AddField(
            model_name="saasorder",
            name="idempotency_key",
            field=models.CharField(blank=True, default="", max_length=64, verbose_name="下单幂等键"),
        ),
        migrations.RunPython(close_duplicate_pending_orders, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="saasorder",
            constraint=models.UniqueConstraint(
                fields=("organization", "idempotency_key"),
                condition=~Q(idempotency_key=""),
                name="subscriptions_order_org_idempotency_unique",
            ),
        ),
        migrations.AddConstraint(
            model_name="saasorder",
            constraint=models.UniqueConstraint(
                fields=("organization",),
                condition=Q(status="pending_payment"),
                name="subscriptions_one_pending_order_per_org",
            ),
        ),
    ]
