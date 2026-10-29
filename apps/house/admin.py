from django import forms
from django.contrib import admin, messages
from django.db.models import ProtectedError

from apps.house.exceptions import HouseInvalidException
from apps.house.models import Building, Contact, Estate, House, HouseAIInsight, HouseFavorite, Lease, LeaseAllocation, PropertyResponsibility, ViewingRecord
from apps.house.services.properties import validate_house_publication


class ProtectedDeleteMessageMixin:
    def delete_model(self, request, obj):
        try:
            super().delete_model(request, obj)
        except ProtectedError:
            self.message_user(request, "该记录仍被业务数据引用，不能删除。", level=messages.ERROR)


@admin.register(Estate)
class EstateAdmin(ProtectedDeleteMessageMixin, admin.ModelAdmin):
    list_display = ("name", "display_name", "property_type", "city")
    search_fields = ("name", "display_name", "city", "district")
    list_filter = ("organization", "property_type", "city")


@admin.register(Building)
class BuildingAdmin(ProtectedDeleteMessageMixin, admin.ModelAdmin):
    list_display = ("name", "estate", "floors", "elevator", "location")
    list_filter = ("organization", "estate")
    search_fields = ("name", "estate__name", "address")


class HouseAdminForm(forms.ModelForm):
    class Meta:
        model = House
        fields = "__all__"

    def _post_clean(self):
        super()._post_clean()
        if self.errors:
            return
        previous_status = House.objects.filter(pk=self.instance.pk).values_list("status", flat=True).first() if self.instance.pk else None
        try:
            validate_house_publication(self.instance, previous_status=previous_status, organization=self.instance.organization)
        except HouseInvalidException as exc:
            self.add_error("status", str(exc))


@admin.register(House)
class HouseAdmin(ProtectedDeleteMessageMixin, admin.ModelAdmin):
    form = HouseAdminForm
    list_display = ("room_number", "building", "landlord", "floor", "status", "is_active")
    list_filter = ("building__organization", "status", "is_active", "decoration", "orientation")
    search_fields = ("room_number", "building__name", "building__estate__name", "landlord__name", "landlord__phone")
    autocomplete_fields = ("building", "landlord")
    fieldsets = (
        ("基础信息", {"fields": ("building", "room_number", "landlord", "floor", "status", "is_active")}),
        ("户型", {"fields": ("area", "interior_area", "bedrooms", "living_rooms", "bathrooms", "kitchens", "balconies", "orientation", "decoration", "has_elevator_access")}),
        ("媒体", {"fields": ("images", "videos")}),
        ("描述", {"fields": ("tags", "public_description", "internal_notes", "extra")}),
    )


@admin.register(HouseAIInsight)
class HouseAIInsightAdmin(admin.ModelAdmin):
    list_display = ("house", "generated_at", "expires_at", "schema_version", "invocation")
    list_filter = ("schema_version", "generated_at", "expires_at")
    search_fields = ("house__room_number", "house__building__name", "house__building__estate__name")
    raw_id_fields = ("house", "invocation")
    readonly_fields = (
        "house",
        "invocation",
        "schema_version",
        "content",
        "source_facts",
        "missing_fields",
        "source_snapshot_hash",
        "generated_at",
        "expires_at",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(HouseFavorite)
class HouseFavoriteAdmin(admin.ModelAdmin):
    list_display = ("user", "house", "is_active", "created_at", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("user__username", "house__room_number", "house__building__name")
    autocomplete_fields = ("user", "house")


@admin.register(Contact)
class ContactAdmin(ProtectedDeleteMessageMixin, admin.ModelAdmin):
    list_display = ("name", "phone", "roles_display", "user", "is_active")
    list_filter = ("organization", "is_active")
    search_fields = ("name", "phone", "email", "user__username")
    autocomplete_fields = ("user",)

    @admin.display(description="角色")
    def roles_display(self, obj):
        return ", ".join(obj.roles or [])


@admin.register(PropertyResponsibility)
class PropertyResponsibilityAdmin(admin.ModelAdmin):
    list_display = ("member", "landlord", "building", "estate", "created_by", "updated_by", "created_at")
    list_filter = ("organization",)
    search_fields = ("member__user__username", "member__user__first_name", "member__user__last_name", "landlord__name", "building__name", "estate__name")
    raw_id_fields = ("member", "landlord", "building", "estate")
    readonly_fields = ("created_at", "updated_at", "created_by", "updated_by")

    def save_model(self, request, obj, form, change):
        username = request.user.username
        if not obj.created_by:
            obj.created_by = username
        obj.updated_by = username
        super().save_model(request, obj, form, change)


@admin.register(ViewingRecord)
class ViewingRecordAdmin(ProtectedDeleteMessageMixin, admin.ModelAdmin):
    list_display = ("house", "customer_name", "customer_phone", "scheduled_at", "viewed_at", "status", "assigned_to", "is_active")
    list_filter = ("organization", "status", "is_active", "assigned_to")
    search_fields = ("customer_name", "customer_phone", "house__room_number", "house__building__name")
    autocomplete_fields = ("house", "contact", "assigned_to")


@admin.register(Lease)
class LeaseAdmin(ProtectedDeleteMessageMixin, admin.ModelAdmin):
    list_display = ("house", "tenant", "source_viewing_record", "sign_at", "start_date", "end_date", "monthly_rent", "status")
    list_filter = ("organization", "status")
    search_fields = ("house__room_number", "tenant__name", "tenant__phone")
    autocomplete_fields = ("house", "tenant", "source_viewing_record")


@admin.register(LeaseAllocation)
class LeaseAllocationAdmin(admin.ModelAdmin):
    list_display = ("id", "lease", "allocation_request", "created_at")
    search_fields = ("lease__house__room_number", "lease__tenant__name", "allocation_request__submitted_by_name_snapshot")
    readonly_fields = ("lease", "allocation_request", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
