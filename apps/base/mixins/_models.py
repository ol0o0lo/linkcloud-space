from django.db import models


class CreateUpdateTimeModelMixin(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class AuditModelMixin(models.Model):
    created_by = models.CharField(max_length=150, blank=True, default="")
    updated_by = models.CharField(max_length=150, blank=True, default="")

    class Meta:
        abstract = True


class BaseModelMixin(CreateUpdateTimeModelMixin, AuditModelMixin):
    class Meta:
        abstract = True


class TimeStampModelMixin(CreateUpdateTimeModelMixin):
    class Meta:
        abstract = True


class BaseListModelMixin(BaseModelMixin):
    is_active = models.BooleanField(default=True)

    class Meta:
        abstract = True
