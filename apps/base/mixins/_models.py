from django.db import models


class CreateUpdateTimeModelMixin(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        abstract = True


class AuditModelMixin(models.Model):
    created_by = models.CharField(max_length=150, blank=True, default="", verbose_name="创建人")
    updated_by = models.CharField(max_length=150, blank=True, default="", verbose_name="更新人")

    class Meta:
        abstract = True


class BaseModelMixin(CreateUpdateTimeModelMixin, AuditModelMixin):
    class Meta:
        abstract = True
