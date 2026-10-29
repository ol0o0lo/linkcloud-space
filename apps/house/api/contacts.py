from typing import Literal

from django.shortcuts import get_object_or_404

from ninja import Query, Router, Status
from ninja.pagination import paginate

from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_org_selected
from apps.house.queries.contacts import contacts_for_organization, prepare_contacts
from apps.house.queries.customers import visible_contacts
from apps.house.schemas.contacts import ContactIn, ContactOut, ContactPatchIn
from apps.house.schemas.landlord import LandlordInvitationOut
from apps.house.services.contacts import create_contact as perform_create_contact
from apps.house.services.contacts import invite_landlord as perform_invite_landlord
from apps.house.services.contacts import update_contact


class ContactPagination(LegacyPagination):
    def paginate_queryset(self, queryset, pagination, **params):
        page = super().paginate_queryset(queryset, pagination, **params)
        page["items"] = prepare_contacts(page["items"])
        return page


router = Router(tags=["房源/管理"])


@router.get("/contacts/", response=list[ContactOut], summary="获取联系人列表")
@paginate(ContactPagination)
def list_contacts(request, role: str | None = Query(None), task: str | None = Query(None), keyword: str | None = Query(None)):
    org = require_org_selected(request)
    return contacts_for_organization(organization=org, actor=request.user, role=role, task=task, keyword=keyword)


@router.post("/contacts/", response={201: ContactOut}, summary="创建联系人")
def create_contact(request, payload: ContactIn):
    org = require_org_selected(request)
    data = payload.model_dump(exclude_unset=True)
    contact = perform_create_contact(organization=org, actor=request.user, data=data)
    return Status(201, prepare_contacts([contact])[0])


@router.get("/contacts/{contact_id}/", response=ContactOut, summary="获取联系人详情")
def get_contact(request, contact_id: int):
    org = require_org_selected(request)
    return prepare_contacts([get_object_or_404(visible_contacts(organization=org, actor=request.user), pk=contact_id)])[0]


@router.patch("/contacts/{contact_id}/", response=ContactOut, summary="更新联系人")
def patch_contact(request, contact_id: int, payload: ContactPatchIn):
    data = payload.model_dump(exclude_unset=True)
    org = require_org_selected(request)
    contact = update_contact(organization=org, actor=request.user, contact_id=contact_id, changes=data)
    return prepare_contacts([contact])[0]


@router.post("/contacts/{contact_id}/landlord-invite/", response=LandlordInvitationOut, summary="邀请房东绑定账号")
def invite_landlord_contact(request, contact_id: int, delivery_method: Literal["sms", "manual"] = Query("sms")):
    org = require_org_selected(request)
    return perform_invite_landlord(organization=org, actor=request.user, contact_id=contact_id, delivery_method=delivery_method)
