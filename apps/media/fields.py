from django.core.exceptions import ValidationError
from django.db import models


class MediaRefsField(models.JSONField):
    """
    保存时自动校验并清洗媒体引用列表的 JSONField。

    业务模型用它替代普通 JSONField 存储媒体引用，save() 时会自动调用
    validate_media_refs() 做存在性、唯一性校验并剔除平台派生字段，
    业务代码无需再手动调用。
    """

    def __init__(
        self,
        *args,
        min_items: int | None = None,
        max_items: int | None = None,
        allowed_media_types: list[str] | tuple[str, ...] | None = None,
        allowed_resource_types: list[str] | tuple[str, ...] | None = None,
        business_validators: list[str] | tuple[str, ...] | None = None,
        resolved_property_name: str | None = None,
        **kwargs,
    ):
        self.min_items = min_items
        self.max_items = max_items
        self.allowed_media_types = tuple(allowed_media_types or ())
        self.allowed_resource_types = tuple(allowed_resource_types or ())
        self.business_validators = tuple(business_validators or ())
        self.resolved_property_name = resolved_property_name
        super().__init__(*args, **kwargs)

    def deconstruct(self):
        name, path, args, kwargs = super().deconstruct()
        if self.min_items is not None:
            kwargs["min_items"] = self.min_items
        if self.max_items is not None:
            kwargs["max_items"] = self.max_items
        if self.allowed_media_types:
            kwargs["allowed_media_types"] = list(self.allowed_media_types)
        if self.allowed_resource_types:
            kwargs["allowed_resource_types"] = list(self.allowed_resource_types)
        if self.business_validators:
            kwargs["business_validators"] = list(self.business_validators)
        if self.resolved_property_name is not None:
            kwargs["resolved_property_name"] = self.resolved_property_name
        return name, path, args, kwargs

    def contribute_to_class(self, cls, name, private_only=False):
        super().contribute_to_class(cls, name, private_only=private_only)
        property_name = self.resolved_property_name or f"{name}_resolved"
        if hasattr(cls, property_name):
            return

        def resolved(instance):
            from apps.media.services import resolve_media_refs

            return resolve_media_refs(getattr(instance, self.attname) or [])

        setattr(cls, property_name, property(resolved))

    def clean_media_refs(self, value, *, model_instance=None):
        refs = list(value or [])
        if refs and self.min_items is not None and len(refs) < self.min_items:
            raise ValueError(f"{self.verbose_name} 至少需要 {self.min_items} 个媒体引用。")
        if self.max_items is not None and len(refs) > self.max_items:
            raise ValueError(f"{self.verbose_name} 最多允许 {self.max_items} 个媒体引用。")
        from apps.media.services import validate_media_refs

        return validate_media_refs(
            refs,
            allowed_media_types=self.allowed_media_types,
            allowed_resource_types=self.allowed_resource_types,
            business_validators=self.business_validators,
            instance=model_instance,
            field=self,
            media_type_error_message=f"{self.verbose_name}媒体类型不正确。",
            resource_type_error_message=f"{self.verbose_name}资源类型不正确。",
        )

    def pre_save(self, model_instance, add):
        value = getattr(model_instance, self.attname)
        if value is not None:
            try:
                cleaned = self.clean_media_refs(value, model_instance=model_instance)
            except (TypeError, ValueError) as exc:
                raise ValidationError({self.attname: [str(exc)]}) from exc
            setattr(model_instance, self.attname, cleaned)
            return cleaned
        return super().pre_save(model_instance, add)
