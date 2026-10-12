from __future__ import annotations

from uuid import UUID

from django.db.models import Count, Q
from django.http import Http404
from django.shortcuts import get_object_or_404

from apps.accounts.models import User
from apps.base.invitation_exceptions import InvitationUnavailableException
from apps.house.constants import ContactRole, HouseStatus
from apps.house.exceptions import HouseUnavailableException
from apps.house.models import Contact
from apps.house.services.invitations import LandlordInvitationCacheError, get_landlord_invitation, invitation_expires_at, mask_phone
from apps.organizations.models import Organization


def get_landlord_houses(user: User, organization: Organization):
    from apps.house.models import House

    return (
        House.objects.select_related("building__estate", "landlord")
        .filter(
            landlord__user=user,
            building__organization=organization,
        )
        .order_by("building__estate__name", "building__name", "room_number")
    )


def get_landlord_relationship_contacts(user: User):
    from apps.house.models import Contact

    contacts = (
        Contact.objects.filter(user=user, is_active=True, organization__is_active=True, roles__contains=[ContactRole.LANDLORD])
        .select_related("organization")
        .annotate(
            house_count=Count("landlord_houses", distinct=True),
            public_house_count=Count(
                "landlord_houses",
                filter=Q(landlord_houses__status=HouseStatus.LISTED),
                distinct=True,
            ),
        )
        .order_by("organization__name", "name", "pk")
    )
    return contacts


def get_landlord_houses_for_contact(contact):
    from apps.house.models import House

    return House.objects.select_related("building__estate", "landlord").filter(landlord=contact).order_by("building__estate__name", "building__name", "room_number")


def get_landlord_leases_for_contact(contact):
    from apps.house.models import Lease

    return (
        Lease.objects.select_related("house__building__estate", "house__landlord", "tenant", "source_viewing_record")
        .filter(organization=contact.organization, house__landlord=contact)
        .order_by("-start_date", "-id")
    )


def get_landlord_leases(user: User, organization: Organization):
    from apps.house.models import Lease

    return (
        Lease.objects.select_related("house__building__estate", "house__landlord", "tenant", "source_viewing_record")
        .filter(
            organization=organization,
            house__landlord__user=user,
            house__building__organization=organization,
        )
        .order_by("-start_date", "-id")
    )


def get_public_landlord_contact(public_key: UUID):
    contact = get_object_or_404(
        Contact.objects.select_related("organization", "user"),
        public_key=public_key,
        is_active=True,
        organization__is_active=True,
        user__is_active=True,
        user__phone_verified=True,
    )
    if ContactRole.LANDLORD not in (contact.roles or []) or not contact.user.phone:
        raise Http404
    return contact


def get_landlord_contact_for_user(user, contact_id: int):
    contact = get_object_or_404(
        Contact.objects.select_related("organization"),
        pk=contact_id,
        user=user,
        is_active=True,
        organization__is_active=True,
    )
    if ContactRole.LANDLORD not in (contact.roles or []):
        raise Http404
    return contact


def get_landlord_invitation_preview(token: str):
    try:
        invitation = get_landlord_invitation(token)
    except LandlordInvitationCacheError as err:
        raise HouseUnavailableException(str(err)) from err
    if invitation is None:
        raise InvitationUnavailableException()

    contact = get_object_or_404(
        Contact.objects.select_related("organization"),
        pk=invitation["contact_id"],
        organization_id=invitation["organization_id"],
        is_active=True,
    )
    if ContactRole.LANDLORD not in (contact.roles or []):
        raise Http404
    return {
        "organization_name": contact.organization.name,
        "contact_name": contact.name,
        "invitee_phone_masked": mask_phone(invitation["phone"]),
        "expires_at": invitation_expires_at(invitation),
    }
