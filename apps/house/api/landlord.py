from uuid import UUID

from django.conf import settings
from django.shortcuts import get_object_or_404

from ninja import Router
from ninja.pagination import paginate

from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_authenticated, require_org_selected
from apps.house.queries.landlord import (
    get_landlord_contact_for_user,
    get_landlord_houses,
    get_landlord_houses_for_contact,
    get_landlord_invitation_preview,
    get_landlord_leases,
    get_landlord_leases_for_contact,
    get_landlord_relationship_contacts,
    get_public_landlord_contact,
)
from apps.house.queries.public import get_public_houses_queryset
from apps.house.schemas.landlord import LandlordHouseOut, LandlordInvitationAcceptOut, LandlordInvitationOut, LandlordRelationshipOut
from apps.house.schemas.leases import LeaseOut
from apps.house.schemas.properties import HouseOut
from apps.house.schemas.public import PublicHouseDetailOut, PublicHouseListOut, PublicLandlordProfileOut
from apps.house.services.contacts import accept_landlord_invitation as perform_accept_landlord_invitation

landlord_router = Router(tags=["房源/房东"])
public_landlord_router = Router(tags=["房源/房东公开店铺"])


@public_landlord_router.get("/{public_key}/", response=PublicLandlordProfileOut, auth=None, summary="获取房东公开店铺")
def get_public_landlord_profile(request, public_key: UUID):
    contact = get_public_landlord_contact(public_key)
    user = contact.user
    return {
        "public_key": str(contact.public_key),
        "name": user.get_full_name() or user.username,
        "avatar": user.avatar_resolved,
        "phone": user.phone,
        "organization": contact.organization,
        "house_count": get_public_houses_queryset().filter(landlord=contact).count(),
    }


@public_landlord_router.get("/{public_key}/houses/", response=list[PublicHouseListOut], auth=None, summary="获取房东店铺公开房源")
@paginate(LegacyPagination)
def list_public_landlord_houses(request, public_key: UUID):
    contact = get_public_landlord_contact(public_key)
    return get_public_houses_queryset().filter(landlord=contact)


@public_landlord_router.get("/{public_key}/houses/{house_id}/", response=PublicHouseDetailOut, auth=None, summary="获取房东店铺公开房源详情")
def get_public_landlord_house(request, public_key: UUID, house_id: int):
    contact = get_public_landlord_contact(public_key)
    return get_object_or_404(get_public_houses_queryset().filter(landlord=contact), pk=house_id)


@landlord_router.get("/my-houses/", response=list[HouseOut], summary="房东查询名下房源")
@paginate(LegacyPagination)
def list_my_houses(request):
    org = require_org_selected(request)
    return get_landlord_houses(request.user, org)


@landlord_router.get("/my-leases/", response=list[LeaseOut], summary="房东查询名下租约")
@paginate(LegacyPagination)
def list_my_leases(request):
    org = require_org_selected(request)
    return get_landlord_leases(request.user, org)


@landlord_router.get("/invites/{token}/", response=LandlordInvitationOut, auth=None, summary="查询房东邀请")
def get_landlord_invite(request, token: str):
    return get_landlord_invitation_preview(token=token)


@landlord_router.post("/invites/{token}/accept/", response=LandlordInvitationAcceptOut, summary="接受房东邀请")
def accept_landlord_invite(request, token: str):
    require_authenticated(request)
    return perform_accept_landlord_invitation(user=request.user, token=token)


@landlord_router.get("/relationships/", response=list[LandlordRelationshipOut], summary="获取房东绑定关系")
def list_landlord_relationships(request):
    require_authenticated(request)
    relationships = []
    for contact in get_landlord_relationship_contacts(request.user):
        relationships.append(
            {
                "contact_id": contact.pk,
                "organization_id": contact.organization_id,
                "organization_name": contact.organization.name,
                "organization_slug": contact.organization.slug,
                "contact_name": contact.name,
                "house_count": contact.house_count,
                "public_house_count": contact.public_house_count,
                "public_key": str(contact.public_key),
                "public_url": f"{settings.SITE_URL}/dashboard/landlords/{contact.public_key}",
            }
        )
    return relationships


@landlord_router.get("/contacts/{contact_id}/houses/", response=list[LandlordHouseOut], summary="按房东关系查询房源")
@paginate(LegacyPagination)
def list_landlord_contact_houses(request, contact_id: int):
    require_authenticated(request)
    contact = get_landlord_contact_for_user(request.user, contact_id)
    return get_landlord_houses_for_contact(contact)


@landlord_router.get("/contacts/{contact_id}/leases/", response=list[LeaseOut], summary="按房东关系查询租约")
@paginate(LegacyPagination)
def list_landlord_contact_leases(request, contact_id: int):
    require_authenticated(request)
    contact = get_landlord_contact_for_user(request.user, contact_id)
    return get_landlord_leases_for_contact(contact)
