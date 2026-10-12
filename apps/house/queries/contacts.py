from __future__ import annotations

from django.db.models import Q
from django.shortcuts import get_object_or_404

from apps.house.constants import ContactRole
from apps.house.models import Contact
from apps.house.services.invitations import get_contact_invitations, invitation_expires_at


def get_contact_in_org(contact_id: int, org):
    return get_object_or_404(Contact, pk=contact_id, organization=org)


def contacts_for_organization(*, organization, role=None, task=None, keyword=None):
    qs = Contact.objects.filter(organization=organization).order_by("name", "id")
    if task in {"active", "role_missing_active"}:
        qs = qs.filter(is_active=True)
    elif task in {"inactive", "role_missing_inactive"}:
        qs = qs.filter(is_active=False)
    if keyword:
        qs = qs.filter(Q(name__icontains=keyword) | Q(phone__icontains=keyword) | Q(email__icontains=keyword))
    if role:
        qs = qs.filter(roles__contains=[role])
    if task == "dual_role":
        qs = qs.filter(roles__contains=[ContactRole.LANDLORD, ContactRole.TENANT])
    elif task in {"role_missing", "role_missing_active", "role_missing_inactive"}:
        qs = qs.filter(roles=[])
    return qs


def prepare_contacts(contacts):
    """准备响应字段；邀请状态只针对当前页批量读取。"""
    contacts = list(contacts)
    invitations = get_contact_invitations([contact.pk for contact in contacts if contact.has_role(ContactRole.LANDLORD) and not contact.user_id])
    for contact in contacts:
        contact.landlord_binding_status = None
        contact.landlord_invite_expires_at = None
        if not contact.has_role(ContactRole.LANDLORD):
            continue
        if contact.user_id:
            contact.landlord_binding_status = "bound"
        elif invitation := invitations.get(contact.pk):
            contact.landlord_binding_status = "invited"
            contact.landlord_invite_expires_at = invitation_expires_at(invitation)
        else:
            contact.landlord_binding_status = "unbound"
    return contacts
