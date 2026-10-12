"""
房源领域信号。

租约与房态是用于业务追溯的弱关系，租约新增、状态变化、迁移或删除均不自动修改房态。
"""

from django.core.cache import cache
from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.house.queries.public import PUBLIC_HOUSE_REGIONS_CACHE_KEY


@receiver([post_save, post_delete], sender="house.House")
@receiver([post_save, post_delete], sender="house.Building")
@receiver([post_save, post_delete], sender="house.Estate")
@receiver([post_save, post_delete], sender="organizations.Organization")
def refresh_public_house_regions(sender, using, raw=False, **kwargs):
    if not raw:
        transaction.on_commit(lambda: cache.delete(PUBLIC_HOUSE_REGIONS_CACHE_KEY), using=using)
