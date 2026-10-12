from __future__ import annotations

from django.db import transaction
from django.shortcuts import get_object_or_404

from apps.house.constants import ContactRole
from apps.house.exceptions import HouseInvalidException
from apps.house.models import Building, Contact, Estate, PropertyResponsibility
from apps.house.queries.responsibilities import responsibility_members
from apps.organizations.models import OrganizationMember


@transaction.atomic
def replace_responsibilities(*, organization, actor, member_id: int, landlord_ids: list[int], building_ids: list[int], estate_ids: list[int]):
    org = organization
    member = get_object_or_404(OrganizationMember.objects.select_for_update().select_related("user"), pk=member_id, organization=org)
    landlord_ids = list(dict.fromkeys(landlord_ids))
    building_ids = list(dict.fromkeys(building_ids))
    estate_ids = list(dict.fromkeys(estate_ids))
    landlords = list(Contact.objects.filter(pk__in=landlord_ids, organization=org, is_active=True))
    buildings = list(Building.objects.filter(pk__in=building_ids, organization=org).select_related("estate"))
    estates = list(Estate.objects.filter(pk__in=estate_ids, organization=org))
    if len(landlords) != len(landlord_ids) or any(not landlord.has_role(ContactRole.LANDLORD) for landlord in landlords):
        raise HouseInvalidException("房东职责目标无效、已停用或不属于当前组织")
    if len(buildings) != len(building_ids):
        raise HouseInvalidException("楼栋职责目标无效或不属于当前组织")
    if len(estates) != len(estate_ids):
        raise HouseInvalidException("小区职责目标无效或不属于当前组织")

    with transaction.atomic():
        PropertyResponsibility.objects.filter(organization=org, member=member).delete()
        audit_fields = {"created_by": actor.username, "updated_by": actor.username}
        for landlord in landlords:
            PropertyResponsibility.objects.create(organization=org, member=member, landlord=landlord, **audit_fields)
        for building in buildings:
            PropertyResponsibility.objects.create(organization=org, member=member, building=building, **audit_fields)
        for estate in estates:
            PropertyResponsibility.objects.create(organization=org, member=member, estate=estate, **audit_fields)
    return responsibility_members(org).get(pk=member.pk)
