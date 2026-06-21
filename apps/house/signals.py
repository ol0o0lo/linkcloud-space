from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from apps.house.models import Lease
from apps.house.services import recalculate_house_status


@receiver(pre_save, sender=Lease)
def lease_capture_previous_house(sender, instance, **kwargs):
    if not instance.pk:
        instance._previous_house_id = None
        return
    instance._previous_house_id = sender.objects.filter(pk=instance.pk).values_list("house_id", flat=True).first()


@receiver(post_save, sender=Lease)
def lease_saved_recalculate_house_status(sender, instance, **kwargs):
    recalculate_house_status(instance.house_id)
    previous_house_id = getattr(instance, "_previous_house_id", None)
    if previous_house_id and previous_house_id != instance.house_id:
        recalculate_house_status(previous_house_id)


@receiver(post_delete, sender=Lease)
def lease_deleted_recalculate_house_status(sender, instance, **kwargs):
    recalculate_house_status(instance.house_id)
