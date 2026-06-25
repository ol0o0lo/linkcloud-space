from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.base.mixins import CreateUpdateTimeModelMixin
from apps.house.constants import (
    LEASE_STATUS_TRANSITIONS,
    ContactRole,
    EstatePropertyType,
    HouseDecoration,
    HouseOrientation,
    HousePublishStatus,
    HouseStatus,
    LeaseStatus,
    ViewingRecordStatus,
)
from apps.media.constants import MediaType, ResourceType
from apps.media.fields import MediaRefsField


class Estate(CreateUpdateTimeModelMixin):
    PropertyType = EstatePropertyType

    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="estates")
    name = models.CharField(max_length=100)
    display_name = models.CharField(max_length=150)
    developer = models.CharField(max_length=150, blank=True, null=True)
    built_year = models.PositiveIntegerField(blank=True, null=True)
    property_type = models.CharField(max_length=32, choices=PropertyType.choices, default=PropertyType.RESIDENTIAL)
    province = models.CharField(max_length=64)
    city = models.CharField(max_length=64)
    district = models.CharField(max_length=64)
    address = models.CharField(max_length=255, blank=True, default="")
    lat = models.DecimalField(max_digits=10, decimal_places=6, blank=True, null=True, help_text="项目/小区级展示点定位")
    lng = models.DecimalField(max_digits=10, decimal_places=6, blank=True, null=True, help_text="项目/小区级展示点定位")
    images = MediaRefsField(
        blank=True,
        default=list,
        max_items=9,
        allowed_media_types=[MediaType.IMAGE],
        allowed_resource_types=[ResourceType.ESTATE_IMAGE],
        business_validators=["apps.house.services.validate_org_scoped_media_refs"],
        verbose_name="项目图片",
    )
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name", "id"]
        constraints = [models.UniqueConstraint(fields=["organization", "name"], name="house_estate_org_name_unique")]

    def __str__(self):
        return self.display_name or self.name

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class Building(CreateUpdateTimeModelMixin):
    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="buildings")
    estate = models.ForeignKey(Estate, on_delete=models.PROTECT, related_name="buildings")
    name = models.CharField(max_length=100)
    floors = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    under_floors = models.PositiveIntegerField(blank=True, null=True)
    year_built = models.PositiveIntegerField(blank=True, null=True)
    elevator = models.BooleanField(default=False)
    lat = models.DecimalField(max_digits=10, decimal_places=6, blank=True, null=True, help_text="楼栋级精确导航定位")
    lng = models.DecimalField(max_digits=10, decimal_places=6, blank=True, null=True, help_text="楼栋级精确导航定位")
    address = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["estate__name", "name", "id"]
        constraints = [models.UniqueConstraint(fields=["estate", "name"], name="house_building_estate_name_unique")]

    def __str__(self):
        return f"{self.estate} {self.name}"

    def clean(self):
        super().clean()
        if self.estate_id and self.organization_id and self.estate.organization_id != self.organization_id:
            raise ValidationError({"organization": "楼栋组织必须与项目片区组织一致。"})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class Contact(CreateUpdateTimeModelMixin):
    Role = ContactRole

    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="house_contacts")
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=32)
    email = models.EmailField(blank=True)
    roles = models.JSONField(default=list, blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="house_contacts")
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name", "id"]
        constraints = [models.UniqueConstraint(fields=["organization", "phone"], name="house_contact_org_phone_unique")]

    def __str__(self):
        return f"{self.name} {self.phone}"

    def has_role(self, role: str) -> bool:
        return role in (self.roles or [])

    def clean(self):
        super().clean()
        from apps.accounts.models import normalize_phone

        normalized_phone = normalize_phone(self.phone)
        if not normalized_phone:
            raise ValidationError({"phone": "联系人手机号不能为空。"})
        self.phone = normalized_phone
        if not isinstance(self.roles, list):
            raise ValidationError({"roles": "联系人角色必须是列表。"})
        invalid = sorted(set(self.roles) - set(self.Role.values))
        if invalid:
            raise ValidationError({"roles": f"不支持的联系人角色: {invalid}"})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class House(CreateUpdateTimeModelMixin):
    Orientation = HouseOrientation
    Decoration = HouseDecoration
    Status = HouseStatus
    PublishStatus = HousePublishStatus

    building = models.ForeignKey(Building, on_delete=models.PROTECT, related_name="houses")
    landlord = models.ForeignKey(Contact, on_delete=models.PROTECT, related_name="landlord_houses", null=True, blank=True)
    room_number = models.CharField(max_length=64)
    floor = models.IntegerField(blank=True, null=True)
    area = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, validators=[MinValueValidator(Decimal("0"))])
    interior_area = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, validators=[MinValueValidator(Decimal("0"))])
    asking_rent = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True, validators=[MinValueValidator(Decimal("0"))])
    deposit_amount = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True, validators=[MinValueValidator(Decimal("0"))])
    available_from = models.DateField(blank=True, null=True)
    bedrooms = models.PositiveIntegerField(blank=True, null=True)
    living_rooms = models.PositiveIntegerField(blank=True, null=True)
    bathrooms = models.PositiveIntegerField(blank=True, null=True)
    kitchens = models.PositiveIntegerField(blank=True, null=True)
    balconies = models.PositiveIntegerField(blank=True, null=True)
    orientation = models.CharField(max_length=32, choices=Orientation.choices, blank=True, null=True)
    decoration = models.CharField(max_length=32, choices=Decoration.choices, blank=True, null=True)
    has_elevator_access = models.BooleanField(default=False)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.VACANT, db_index=True)
    publish_status = models.CharField(max_length=32, choices=PublishStatus.choices, default=PublishStatus.DRAFT, db_index=True)
    images = MediaRefsField(
        blank=True,
        default=list,
        max_items=9,
        allowed_media_types=[MediaType.IMAGE],
        allowed_resource_types=[ResourceType.HOUSE_IMAGE],
        business_validators=["apps.house.services.validate_org_scoped_media_refs"],
        verbose_name="房源图片",
    )
    videos = MediaRefsField(
        blank=True,
        default=list,
        max_items=3,
        allowed_media_types=[MediaType.VIDEO],
        allowed_resource_types=[ResourceType.HOUSE_VIDEO],
        business_validators=["apps.house.services.validate_org_scoped_media_refs"],
        verbose_name="房源视频",
    )
    tags = models.JSONField(default=list, blank=True)
    public_description = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)
    extra = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["building__estate__name", "building__name", "room_number", "id"]
        constraints = [models.UniqueConstraint(fields=["building", "room_number"], name="house_building_room_unique")]

    def __str__(self):
        return f"{self.building} {self.room_number}"

    @property
    def organization(self):
        return self.building.estate.organization

    def clean(self):
        super().clean()
        if not isinstance(self.tags, list):
            raise ValidationError({"tags": "房源标签必须是列表。"})
        if not isinstance(self.extra, dict):
            raise ValidationError({"extra": "扩展字段必须是对象。"})
        if self.landlord_id:
            if not self.landlord.has_role(Contact.Role.LANDLORD):
                raise ValidationError({"landlord": "登记出租方必须具备 landlord 角色。"})
            if self.building_id and self.landlord.organization_id != self.organization.pk:
                raise ValidationError({"landlord": "登记出租方组织必须与房源组织一致。"})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class ViewingRecord(CreateUpdateTimeModelMixin):
    Status = ViewingRecordStatus

    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="viewing_records")
    house = models.ForeignKey(House, on_delete=models.PROTECT, related_name="viewing_records")
    contact = models.ForeignKey(Contact, on_delete=models.PROTECT, related_name="viewing_records", null=True, blank=True)
    customer_name = models.CharField(max_length=100)
    customer_phone = models.CharField(max_length=32)
    scheduled_at = models.DateTimeField()
    viewed_at = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.SCHEDULED, db_index=True)
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_viewing_records")
    notes = models.TextField(blank=True)
    extra = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-scheduled_at", "-id"]

    def __str__(self):
        return f"{self.customer_name} 看房 {self.house}"

    def clean(self):
        super().clean()
        if self.house_id and self.organization_id and self.house.organization.pk != self.organization_id:
            raise ValidationError({"organization": "带看记录组织必须与房源组织一致。"})
        if self.contact_id and self.organization_id and self.contact.organization_id != self.organization_id:
            raise ValidationError({"contact": "联系人组织必须与带看记录组织一致。"})
        if not isinstance(self.extra, dict):
            raise ValidationError({"extra": "扩展字段必须是对象。"})
        if self.status == self.Status.VIEWED and self.viewed_at is None:
            self.viewed_at = timezone.now()

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class Lease(CreateUpdateTimeModelMixin):
    Status = LeaseStatus

    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="leases")
    house = models.ForeignKey(House, on_delete=models.PROTECT, related_name="leases")
    tenant = models.ForeignKey(Contact, on_delete=models.PROTECT, related_name="tenant_leases")
    source_viewing_record = models.ForeignKey(
        ViewingRecord,
        on_delete=models.PROTECT,
        related_name="converted_leases",
        null=True,
        blank=True,
        help_text="成交来源带看记录，可为空。",
    )
    sign_at = models.DateTimeField(blank=True, null=True)
    start_date = models.DateField()
    end_date = models.DateField()
    monthly_rent = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])
    deposit = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True, validators=[MinValueValidator(Decimal("0"))])
    payment_day = models.PositiveSmallIntegerField(default=1, validators=[MinValueValidator(1), MaxValueValidator(31)])
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.PENDING, db_index=True)
    contract_files = MediaRefsField(
        blank=True,
        default=list,
        max_items=1,
        allowed_media_types=[MediaType.FILE],
        allowed_resource_types=[ResourceType.LEASE_CONTRACT],
        business_validators=["apps.house.services.validate_org_scoped_media_refs"],
        verbose_name="租约合同",
    )
    notes = models.TextField(blank=True)
    extra = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-start_date", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["house"], condition=Q(status=LeaseStatus.ACTIVE), name="house_one_active_lease_unique"),
        ]

    def __str__(self):
        return f"{self.house} {self.tenant} {self.start_date}~{self.end_date}"

    def clean(self):
        super().clean()
        errors = {}
        if self.end_date and self.start_date and self.end_date < self.start_date:
            errors["end_date"] = "租期结束日期不能早于开始日期。"
        if self.house_id and self.organization_id and self.house.organization.pk != self.organization_id:
            errors["organization"] = "租约组织必须与房源组织一致。"
        if self.tenant_id:
            if not self.tenant.has_role(Contact.Role.TENANT):
                errors["tenant"] = "租客必须具备 tenant 角色。"
            if self.organization_id and self.tenant.organization_id != self.organization_id:
                errors["tenant"] = "租客组织必须与租约组织一致。"
        if self.house_id and self.house.landlord_id is None:
            errors["house"] = "签约前需先补齐登记出租方。"
        if self.source_viewing_record_id:
            if self.organization_id and self.source_viewing_record.organization_id != self.organization_id:
                errors["source_viewing_record"] = "成交来源带看记录组织必须与租约组织一致。"
            if self.house_id and self.source_viewing_record.house_id != self.house_id:
                errors["source_viewing_record"] = "成交来源带看记录必须属于当前签约房源。"
            if self.source_viewing_record.status != ViewingRecord.Status.CONVERTED:
                errors["source_viewing_record"] = "成交来源带看记录必须处于 converted 状态。"
            if self.tenant_id and self.source_viewing_record.contact_id and self.source_viewing_record.contact_id != self.tenant_id:
                errors["source_viewing_record"] = "成交来源带看记录关联租客必须与租约租客一致。"
            qs = type(self).objects.filter(source_viewing_record_id=self.source_viewing_record_id)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                errors["source_viewing_record"] = "该成交带看已生成租约，请直接维护现有租约。"
        if self.status == self.Status.ACTIVE and self.house_id:
            qs = type(self).objects.filter(house_id=self.house_id, status=self.Status.ACTIVE)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                errors["status"] = "同一房源只能有一条生效中的租约。"
        if self.pk:
            previous_status = type(self).objects.filter(pk=self.pk).values_list("status", flat=True).first()
            if previous_status and self.status not in LEASE_STATUS_TRANSITIONS.get(previous_status, {previous_status}):
                errors["status"] = "租约状态不允许逆向流转或从终态重新激活。"
        if not isinstance(self.extra, dict):
            errors["extra"] = "扩展字段必须是对象。"
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
