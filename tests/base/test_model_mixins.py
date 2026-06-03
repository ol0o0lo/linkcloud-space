from django.db import models

from apps.base.mixins import AuditModelMixin, BaseModelMixin, CreateUpdateTimeModelMixin


class AuditedThing(AuditModelMixin):
    class Meta:
        app_label = "tests"
        managed = False


class TimedThing(CreateUpdateTimeModelMixin):
    class Meta:
        app_label = "tests"
        managed = False


class BaseThing(BaseModelMixin):
    class Meta:
        app_label = "tests"
        managed = False


def test_audit_model_mixin_defines_user_audit_fields():
    created_by = AuditedThing._meta.get_field("created_by")
    updated_by = AuditedThing._meta.get_field("updated_by")

    assert isinstance(created_by, models.CharField)
    assert created_by.max_length == 150
    assert created_by.blank is True
    assert created_by.default == ""

    assert isinstance(updated_by, models.CharField)
    assert updated_by.max_length == 150
    assert updated_by.blank is True
    assert updated_by.default == ""


def test_create_update_time_model_mixin_defines_time_fields():
    created_at = TimedThing._meta.get_field("created_at")
    updated_at = TimedThing._meta.get_field("updated_at")

    assert created_at.auto_now_add is True
    assert updated_at.auto_now is True


def test_base_model_mixin_combines_time_and_audit_mixins():
    assert issubclass(BaseModelMixin, AuditModelMixin)
    assert issubclass(BaseModelMixin, CreateUpdateTimeModelMixin)
    assert BaseThing._meta.get_field("created_at")
    assert BaseThing._meta.get_field("created_by")
    assert BaseThing._meta.get_field("updated_at")
    assert BaseThing._meta.get_field("updated_by")
