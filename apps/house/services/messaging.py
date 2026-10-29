"""房源咨询对通用聊天的业务适配。"""

import re
from urllib.parse import parse_qs, urlsplit

from django.db import transaction
from django.shortcuts import get_object_or_404

from apps.data_migration.presentation import migration_media_for
from apps.house.exceptions import HouseInvalidException
from apps.house.models import HouseInquiry
from apps.house.queries.public import get_public_houses_queryset
from apps.messaging.constants import ParticipantAccessKind
from apps.messaging.contracts import ParticipantSpec
from apps.messaging.exceptions import ConversationNotFound, MessageIdempotencyConflict
from apps.messaging.models import Conversation, Message
from apps.messaging.services import find_sent_message, get_conversation, get_or_create_conversation, send_message

CONTACT_NAMESPACE = "real_estate.inquiry"


def contact_message_payload(*, house, phone, wechat):
    return {"house_id": house.pk, "phone": phone, "wechat": wechat}


def contact_message_content(*, house, phone, wechat):
    lines = [f"我想咨询房源 #{house.pk}。"]
    if phone:
        lines.append(f"手机号：{phone}")
    if wechat:
        lines.append(f"微信号：{wechat}")
    return "\n".join(lines)


def _attach_delivery(inquiry, conversation, message):
    inquiry.notification_id = None
    inquiry.conversation = conversation
    inquiry.message = message
    return inquiry


def replay_contact_message(*, house, user, client_message_id, content, phone, wechat):
    message = find_sent_message(
        actor=user,
        organization=house.organization,
        access_kind=ParticipantAccessKind.BUSINESS_PARTY,
        namespace=CONTACT_NAMESPACE,
        context_key=f"listing:{house.pk}",
        client_message_id=client_message_id,
    )
    if message is None:
        return None
    identity = re.fullmatch(r"inquiry:(\d+):agent:(\d+)", message.conversation.conversation_key)
    if identity is None:
        raise HouseInvalidException("咨询关联异常，请从消息列表查看已发送记录。")
    inquiry = HouseInquiry.objects.filter(pk=int(identity.group(1)), organization=house.organization, house=house, user=user).first()
    if inquiry is None:
        raise HouseInvalidException("咨询记录已失效，请从消息列表查看已发送内容。")
    message, _created = send_message(
        actor=user,
        organization=house.organization,
        access_kind=ParticipantAccessKind.BUSINESS_PARTY,
        conversation_id=message.conversation_id,
        client_message_id=client_message_id,
        content=content,
        message_type="house.contact",
        payload=contact_message_payload(house=house, phone=phone, wechat=wechat),
    )
    conversation = get_conversation(actor=user, organization=house.organization, access_kind=ParticipantAccessKind.BUSINESS_PARTY, conversation_id=message.conversation_id)
    return _attach_delivery(inquiry, conversation, message)


def get_inquiry_conversation(*, house, user, inquiry, recipient):
    return get_or_create_conversation(
        actor=user,
        organization=house.organization,
        namespace=CONTACT_NAMESPACE,
        conversation_key=f"inquiry:{inquiry.pk}:agent:{recipient.pk}",
        context_key=f"listing:{house.pk}",
        participants=[
            ParticipantSpec(user.pk, ParticipantAccessKind.BUSINESS_PARTY),
            ParticipantSpec(recipient.pk, ParticipantAccessKind.ORGANIZATION_MEMBER),
        ],
    )


def send_contact_message(*, house, user, inquiry, recipient, client_message_id, content, phone, wechat):
    conversation = get_inquiry_conversation(house=house, user=user, inquiry=inquiry, recipient=recipient)
    message, _created = send_message(
        actor=user,
        organization=house.organization,
        access_kind=ParticipantAccessKind.BUSINESS_PARTY,
        conversation_id=conversation.pk,
        client_message_id=client_message_id,
        content=content,
        message_type="house.contact",
        payload=contact_message_payload(house=house, phone=phone, wechat=wechat),
    )
    conversation = get_conversation(actor=user, organization=house.organization, access_kind=ParticipantAccessKind.BUSINESS_PARTY, conversation_id=conversation.pk)
    return _attach_delivery(inquiry, conversation, message)


def get_personal_inquiry_conversation(*, user, conversation_id):
    conversation = Conversation.objects.select_related("organization").filter(pk=conversation_id, namespace=CONTACT_NAMESPACE).first()
    if conversation is None:
        raise ConversationNotFound()
    conversation = get_conversation(actor=user, organization=conversation.organization, access_kind=ParticipantAccessKind.BUSINESS_PARTY, conversation_id=conversation_id)
    identity = re.fullmatch(r"inquiry:(\d+):agent:(\d+)", conversation.conversation_key)
    if identity is None:
        raise ConversationNotFound()
    inquiry = HouseInquiry.objects.select_related("house__building", "organization").filter(pk=int(identity.group(1)), organization=conversation.organization, user=user).first()
    if inquiry is None or conversation.context_key != f"listing:{inquiry.house_id}":
        raise ConversationNotFound()
    return inquiry, conversation


@transaction.atomic
def share_house_message(*, actor, organization, access_kind, conversation_id, house_id, client_message_id):
    get_object_or_404(Conversation.objects.select_for_update(), pk=conversation_id, organization=organization)
    conversation = get_conversation(actor=actor, organization=organization, access_kind=access_kind, conversation_id=conversation_id)
    existing = Message.objects.filter(conversation=conversation, sender_member_id=conversation.my_member_id, client_message_id=client_message_id).first()
    if existing:
        if existing.message_type != "house.listing" or existing.payload.get("house_id") != house_id:
            raise MessageIdempotencyConflict()
        return existing, False
    house = get_object_or_404(get_public_houses_queryset(), pk=house_id)
    building = house.building
    estate = building.estate
    title = " ".join(part for part in ((estate.display_name or estate.name) if estate else "", building.name, house.room_number) if part)
    payload = {
        "house_id": house.pk,
        "title": title,
        "bedrooms": house.bedrooms,
        "living_rooms": house.living_rooms,
        "area": str(house.area) if house.area is not None else None,
        "asking_rent": str(house.asking_rent) if house.asking_rent is not None else None,
        "address": building.address or (estate.address if estate else ""),
    }
    media = (house.images or [])[:1]
    if not media:
        for image in migration_media_for(house):
            if image.get("field") != "images" or image.get("media_type") != "image":
                continue
            if image.get("media_file_id"):
                media = [{"media_id": image["media_file_id"], "media_type": "image"}]
                break
            url = image.get("url")
            if not url:
                continue
            signed_parameters = {"expires", "signature", "x-oss-signature", "x-amz-signature"}
            if not (signed_parameters & {key.lower() for key in parse_qs(urlsplit(url).query)}):
                payload["cover_url"] = url
                break
    return send_message(
        actor=actor,
        organization=organization,
        access_kind=access_kind,
        conversation_id=conversation.pk,
        client_message_id=client_message_id,
        content=f"[房源] {title}",
        message_type="house.listing",
        payload=payload,
        media=media,
    )
