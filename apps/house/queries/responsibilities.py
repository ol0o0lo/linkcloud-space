from __future__ import annotations

from django.db.models import Count, Exists, IntegerField, OuterRef, Prefetch, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce

from apps.house.models import House, PropertyResponsibility
from apps.organizations.models import OrganizationMember

# Ordered from the most specific assignment to the broadest assignment.
RESPONSIBILITY_TARGETS = (("landlord", "landlord_id"), ("building", "building_id"), ("estate", "building__estate_id"))


def filter_responsible_houses(qs, org, member_id):
    responsibilities = PropertyResponsibility.objects.filter(organization=org)
    qs = qs.filter(building__organization=org)
    matched = Q(pk__in=[])
    more_specific_unassigned = Q()
    # Member counts wrap the house query in another subquery.
    member_reference = OuterRef(member_id) if isinstance(member_id, OuterRef) else member_id
    for target, house_field in RESPONSIBILITY_TARGETS:
        assigned = f"{target}_assigned"
        owned = f"{target}_owned"
        target_assignments = responsibilities.filter(**{f"{target}_id": OuterRef(house_field)})
        qs = qs.alias(**{assigned: Exists(target_assignments), owned: Exists(target_assignments.filter(member_id=member_reference))})
        matched |= more_specific_unassigned & Q(**{owned: True})
        more_specific_unassigned &= Q(**{assigned: False})
    return qs.filter(matched)


def resolve_contact_recipient(house):
    responsibilities = PropertyResponsibility.objects.filter(organization=house.organization, member__user__is_active=True).select_related("member__user")
    targets = {"landlord": house.landlord_id, "building": house.building_id, "estate": house.building.estate_id}
    for target, _house_field in RESPONSIBILITY_TARGETS:
        target_id = targets[target]
        if target_id is None:
            continue
        responsibility = responsibilities.filter(**{f"{target}_id": target_id}).order_by("member_id").first()
        if responsibility:
            return responsibility.member.user
    owner = OrganizationMember.objects.filter(organization=house.organization, is_owner=True, user__is_active=True).select_related("user").order_by("id").first()
    return owner.user if owner else None


def responsibility_members(org):
    assignments = PropertyResponsibility.objects.select_related("landlord", "building__estate", "estate").order_by(
        "landlord__name", "building__estate__name", "building__name", "estate__name", "id"
    )
    responsible_house_count = (
        filter_responsible_houses(House.objects.filter(building__organization=org), org, OuterRef("pk"))
        .order_by()
        .values("building__organization_id")
        .annotate(total=Count("pk", distinct=True))
        .values("total")
    )
    return (
        OrganizationMember.objects.filter(organization=org)
        .select_related("user")
        .prefetch_related(Prefetch("property_responsibilities", queryset=assignments, to_attr="prefetched_property_responsibilities"))
        .annotate(
            responsible_house_count=Coalesce(
                Subquery(responsible_house_count[:1], output_field=IntegerField()),
                Value(0),
                output_field=IntegerField(),
            )
        )
        .order_by("user__first_name", "user__last_name", "user__username", "pk")
    )


def list_responsibility_members(*, organization, keyword=None, team=None, unassigned=False, member_id=None):
    qs = responsibility_members(organization)
    if keyword:
        qs = qs.filter(Q(user__first_name__icontains=keyword) | Q(user__last_name__icontains=keyword) | Q(user__username__icontains=keyword) | Q(user__email__icontains=keyword))
    if team is not None:
        qs = qs.filter(user__teams=team).distinct()
    if unassigned:
        qs = qs.filter(property_responsibilities__isnull=True)
    if member_id is not None:
        qs = qs.filter(pk=member_id)
    return qs


def summarize_responsibility_members(*, organization, team):
    qs = list_responsibility_members(organization=organization, team=team)
    member_count = qs.count()
    configured_member_count = qs.filter(property_responsibilities__isnull=False).distinct().count()
    responsible_house_count_sum = qs.aggregate(total=Coalesce(Sum("responsible_house_count"), Value(0), output_field=IntegerField()))["total"]
    return {
        "member_count": member_count,
        "configured_member_count": configured_member_count,
        "unconfigured_member_count": member_count - configured_member_count,
        "responsible_house_count_sum": responsible_house_count_sum,
    }
