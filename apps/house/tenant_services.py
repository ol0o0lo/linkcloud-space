from django.db import transaction

from apps.accounts.models import normalize_phone
from apps.house.constants import ContactRole
from apps.house.models import Contact


class TenantContactConflict(Exception):
    pass


@transaction.atomic
def get_or_bind_tenant_contact(*, organization, user) -> Contact:
    normalized_phone = normalize_phone(user.phone)
    matches = [contact for contact in Contact.objects.select_for_update().filter(organization=organization) if normalize_phone(contact.phone) == normalized_phone]
    if len(matches) > 1:
        raise TenantContactConflict("该手机号在当前组织存在多条联系人记录，请联系工作人员处理。")

    if matches:
        contact = matches[0]
        if not contact.is_active:
            raise TenantContactConflict("该手机号对应的联系人已停用，请联系工作人员处理。")
        if contact.user_id not in (None, user.pk):
            raise TenantContactConflict("该手机号已绑定其他账号，请联系工作人员处理。")
        contact.user = user
        contact.roles = list(dict.fromkeys([*(contact.roles or []), ContactRole.TENANT]))
        contact.save(update_fields=["user", "roles", "updated_at"])
        return contact

    return Contact.objects.create(
        organization=organization,
        name=user.get_full_name().strip() or user.username,
        phone=normalized_phone,
        roles=[ContactRole.TENANT],
        user=user,
    )
