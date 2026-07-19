from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.base.mixins import BaseModelMixin, CreateUpdateTimeModelMixin
from apps.house.constants import (
    LEASE_STATUS_TRANSITIONS,
    ContactRole,
    EstatePropertyType,
    HouseDecoration,
    HouseOrientation,
    HouseStatus,
    LeaseStatus,
    ViewingRecordStatus,
)
from apps.media.constants import MediaType, ResourceType
from apps.media.fields import MediaRefsField


def normalize_space_identity(value: str) -> str:
    return " ".join(value.split())


def merge_tags(*tag_groups: list[str] | None) -> list[str]:
    merged: list[str] = []
    for tags in tag_groups:
        for tag in tags or []:
            if tag not in merged:
                merged.append(tag)
    return merged


def validate_coordinates(*, address: str, lat: Decimal | None, lng: Decimal | None, address_required: bool) -> None:
    if address_required and not address:
        raise ValidationError({"address": "楼栋地址不能为空。"})
    if (lat is None) != (lng is None):
        raise ValidationError({"lng" if lat is not None else "lat": "纬度和经度必须同时填写。"})
    if lat is not None and not Decimal("-90") <= lat <= Decimal("90"):
        raise ValidationError({"lat": "纬度必须在 -90 到 90 之间。"})
    if lng is not None and not Decimal("-180") <= lng <= Decimal("180"):
        raise ValidationError({"lng": "经度必须在 -180 到 180 之间。"})
    if lat is not None and not address:
        raise ValidationError({"address": "保存坐标时必须填写地址。"})


class Estate(CreateUpdateTimeModelMixin):
    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="estates")
    name = models.CharField(max_length=100)
    display_name = models.CharField(max_length=150)
    developer = models.CharField(max_length=150, blank=True, null=True)
    built_year = models.PositiveIntegerField(blank=True, null=True)
    property_type = models.CharField(max_length=32, choices=EstatePropertyType.choices, default=EstatePropertyType.RESIDENTIAL)
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

    class Meta:
        ordering = ["name", "id"]
        constraints = [models.UniqueConstraint(fields=["organization", "name"], name="house_estate_org_name_unique")]

    def __str__(self):
        return self.display_name or self.name

    def clean(self):
        super().clean()
        validate_coordinates(address=self.address, lat=self.lat, lng=self.lng, address_required=False)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class Building(CreateUpdateTimeModelMixin):
    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="buildings")
    estate = models.ForeignKey(Estate, on_delete=models.PROTECT, related_name="buildings", null=True, blank=True)
    name = models.CharField(max_length=100)
    floors = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    under_floors = models.PositiveIntegerField(blank=True, null=True)
    year_built = models.PositiveIntegerField(blank=True, null=True)
    elevator = models.BooleanField(default=False)
    lat = models.DecimalField(max_digits=10, decimal_places=6, blank=True, null=True, help_text="楼栋级精确导航定位")
    lng = models.DecimalField(max_digits=10, decimal_places=6, blank=True, null=True, help_text="楼栋级精确导航定位")
    address = models.CharField(max_length=255, blank=True)
    images = MediaRefsField(
        blank=True,
        default=list,
        max_items=9,
        allowed_media_types=[MediaType.IMAGE],
        allowed_resource_types=[ResourceType.BUILDING_IMAGE],
        business_validators=["apps.house.services.validate_org_scoped_media_refs"],
        verbose_name="楼栋图片",
    )
    tags = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["estate__name", "name", "id"]
        constraints = [
            models.UniqueConstraint(fields=["estate", "name"], condition=Q(estate__isnull=False), name="house_building_estate_name_unique"),
            models.UniqueConstraint(fields=["organization", "name", "address"], condition=Q(estate__isnull=True), name="house_building_org_name_address_unique"),
        ]

    def __str__(self):
        return f"{self.estate} {self.name}" if self.estate_id else self.name

    def clean(self):
        super().clean()
        if not isinstance(self.tags, list):
            raise ValidationError({"tags": "楼栋标签必须是列表。"})
        if self.estate_id and self.organization_id and self.estate.organization_id != self.organization_id:
            raise ValidationError({"organization": "楼栋组织必须与项目片区组织一致。"})
        validate_coordinates(address=self.address, lat=self.lat, lng=self.lng, address_required=True)

        duplicates = type(self).objects.exclude(pk=self.pk)
        if self.estate_id and self.name and duplicates.filter(estate_id=self.estate_id, name=self.name).exists():
            raise ValidationError({"name": "该小区已存在同名楼栋。"})
        if (
            not self.estate_id
            and self.organization_id
            and self.name
            and self.address
            and duplicates.filter(organization_id=self.organization_id, estate__isnull=True, name=self.name, address=self.address).exists()
        ):
            raise ValidationError({"address": "该组织已存在名称和地址相同的非小区楼栋。"})

    def full_clean(self, exclude=None, validate_unique=True, validate_constraints=True):
        self.name = normalize_space_identity(self.name)
        self.address = normalize_space_identity(self.address)
        super().full_clean(exclude=exclude, validate_unique=validate_unique, validate_constraints=validate_constraints)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class Contact(CreateUpdateTimeModelMixin):
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
        invalid = sorted(set(self.roles) - set(ContactRole.values))
        if invalid:
            raise ValidationError({"roles": f"不支持的联系人角色: {invalid}"})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class PropertyResponsibility(BaseModelMixin):
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="property_responsibilities")
    member = models.ForeignKey("organizations.OrganizationMember", on_delete=models.CASCADE, related_name="property_responsibilities")
    landlord = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name="property_responsibilities", null=True, blank=True)
    building = models.ForeignKey(Building, on_delete=models.CASCADE, related_name="property_responsibilities", null=True, blank=True)
    estate = models.ForeignKey(Estate, on_delete=models.CASCADE, related_name="property_responsibilities", null=True, blank=True)

    class Meta:
        ordering = ["member__user__username", "landlord__name", "building__name", "estate__name", "id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(landlord__isnull=False, building__isnull=True, estate__isnull=True)
                | Q(landlord__isnull=True, building__isnull=False, estate__isnull=True)
                | Q(landlord__isnull=True, building__isnull=True, estate__isnull=False),
                name="house_responsibility_one_target",
            ),
            models.UniqueConstraint(
                fields=["member", "landlord"],
                condition=Q(landlord__isnull=False),
                name="house_responsibility_member_landlord_unique",
            ),
            models.UniqueConstraint(
                fields=["member", "building"],
                condition=Q(building__isnull=False),
                name="house_responsibility_member_building_unique",
            ),
            models.UniqueConstraint(
                fields=["member", "estate"],
                condition=Q(estate__isnull=False),
                name="house_responsibility_member_estate_unique",
            ),
        ]

    def __str__(self):
        """返回员工与职责目标的可读关系。"""
        return f"{self.member.user} -> {self.landlord or self.building or self.estate}"

    def clean(self):
        super().clean()
        if sum(target_id is not None for target_id in (self.landlord_id, self.building_id, self.estate_id)) != 1:
            raise ValidationError("房源职责必须且只能选择一个房东、楼栋或小区。")
        if self.member_id and self.organization_id and self.member.organization_id != self.organization_id:
            raise ValidationError({"member": "员工必须属于当前组织。"})
        if self.landlord_id:
            if self.landlord.organization_id != self.organization_id:
                raise ValidationError({"landlord": "房东必须属于当前组织。"})
            if not self.landlord.has_role(ContactRole.LANDLORD):
                raise ValidationError({"landlord": "职责目标联系人必须具备 landlord 角色。"})
        if self.building_id and self.building.organization_id != self.organization_id:
            raise ValidationError({"building": "楼栋必须属于当前组织。"})
        if self.estate_id and self.estate.organization_id != self.organization_id:
            raise ValidationError({"estate": "小区必须属于当前组织。"})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class House(CreateUpdateTimeModelMixin):
    building = models.ForeignKey(Building, on_delete=models.PROTECT, related_name="houses")
    landlord = models.ForeignKey(Contact, on_delete=models.PROTECT, related_name="landlord_houses", null=True, blank=True)
    room_number = models.CharField(max_length=64)
    floor = models.IntegerField(blank=True, null=True)
    area = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, validators=[MinValueValidator(Decimal("0"))])
    interior_area = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, validators=[MinValueValidator(Decimal("0"))])
    asking_rent = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True, validators=[MinValueValidator(Decimal("0"))])
    deposit_amount = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True, validators=[MinValueValidator(Decimal("0"))])
    bedrooms = models.PositiveIntegerField(blank=True, null=True)
    living_rooms = models.PositiveIntegerField(blank=True, null=True)
    bathrooms = models.PositiveIntegerField(blank=True, null=True)
    kitchens = models.PositiveIntegerField(blank=True, null=True)
    balconies = models.PositiveIntegerField(blank=True, null=True)
    orientation = models.CharField(max_length=32, choices=HouseOrientation.choices, blank=True, null=True)
    decoration = models.CharField(max_length=32, choices=HouseDecoration.choices, blank=True, null=True)
    has_elevator_access = models.BooleanField(default=False)
    status = models.CharField(max_length=32, choices=HouseStatus.choices, default=HouseStatus.VACANT, db_index=True)
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

    class Meta:
        ordering = ["building__estate__name", "building__name", "room_number", "id"]
        constraints = [models.UniqueConstraint(fields=["building", "room_number"], name="house_building_room_unique")]

    def __str__(self):
        return f"{self.building} {self.room_number}"

    @property
    def organization(self):
        return self.building.organization

    @property
    def effective_tags(self) -> list[str]:
        return merge_tags(self.tags, self.building.tags)

    def clean(self):
        super().clean()
        if not isinstance(self.tags, list):
            raise ValidationError({"tags": "房源标签必须是列表。"})
        if not isinstance(self.extra, dict):
            raise ValidationError({"extra": "扩展字段必须是对象。"})
        if self.landlord_id:
            if not self.landlord.has_role(ContactRole.LANDLORD):
                raise ValidationError({"landlord": "登记出租方必须具备 landlord 角色。"})
            if self.building_id and self.landlord.organization_id != self.organization.pk:
                raise ValidationError({"landlord": "登记出租方组织必须与房源组织一致。"})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class HouseFavorite(CreateUpdateTimeModelMixin):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="house_favorites")
    house = models.ForeignKey(House, on_delete=models.CASCADE, related_name="favorites")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-updated_at", "-id"]
        constraints = [models.UniqueConstraint(fields=["user", "house"], name="house_favorite_user_house_unique")]

    def __str__(self):  # noqa: D105
        return f"{self.user} -> {self.house}"


class ViewingRecord(CreateUpdateTimeModelMixin):
    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="viewing_records")
    house = models.ForeignKey(House, on_delete=models.PROTECT, related_name="viewing_records")
    contact = models.ForeignKey(Contact, on_delete=models.PROTECT, related_name="viewing_records", null=True, blank=True)
    customer_name = models.CharField(max_length=100)
    customer_phone = models.CharField(max_length=32)
    scheduled_at = models.DateTimeField()
    viewed_at = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=32, choices=ViewingRecordStatus.choices, default=ViewingRecordStatus.SCHEDULED, db_index=True)
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
        if self.status == ViewingRecordStatus.VIEWED and self.viewed_at is None:
            self.viewed_at = timezone.now()

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class Lease(CreateUpdateTimeModelMixin):
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
    status = models.CharField(max_length=32, choices=LeaseStatus.choices, default=LeaseStatus.PENDING, db_index=True)
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
            if not self.tenant.has_role(ContactRole.TENANT):
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
            if self.source_viewing_record.status != ViewingRecordStatus.CONVERTED:
                errors["source_viewing_record"] = "成交来源带看记录必须处于 converted 状态。"
            if self.tenant_id and self.source_viewing_record.contact_id and self.source_viewing_record.contact_id != self.tenant_id:
                errors["source_viewing_record"] = "成交来源带看记录关联租客必须与租约租客一致。"
            qs = type(self).objects.filter(source_viewing_record_id=self.source_viewing_record_id)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                errors["source_viewing_record"] = "该成交带看已生成租约，请直接维护现有租约。"
        if self.status == LeaseStatus.ACTIVE and self.house_id:
            qs = type(self).objects.filter(house_id=self.house_id, status=LeaseStatus.ACTIVE)
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
