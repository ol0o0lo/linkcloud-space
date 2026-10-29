import re

from django.db import migrations, models

import apps.media.fields


def convert_contact_messages(apps, schema_editor):
    message_model = apps.get_model("messaging", "Message")
    rows = (
        message_model.objects.using(schema_editor.connection.alias)
        .filter(
            message_type="text",
            conversation__namespace="real_estate.inquiry",
            sender_member__access_kind="business_party",
            content__startswith="我想咨询房源 #",
        )
        .select_related("conversation")
    )
    pattern = re.compile(r"我想咨询房源 #([1-9]\d*)。(?:\n手机号：(\+?\d{7,32}))?(?:\n微信号：([^\r\n]{1,64}))?")
    for message in rows.iterator(chunk_size=200):
        match = pattern.fullmatch(message.content)
        if not match or not (match[2] or match[3]) or message.conversation.context_key != f"listing:{match[1]}":
            continue
        if not re.fullmatch(r"inquiry:\d+:agent:\d+", message.conversation.conversation_key):
            continue
        message_model.objects.using(schema_editor.connection.alias).filter(pk=message.pk).update(
            message_type="house.contact",
            payload={"house_id": int(match[1]), "phone": match[2] or "", "wechat": match[3] or ""},
        )


class Migration(migrations.Migration):
    dependencies = [("messaging", "0001_initial")]

    operations = [
        migrations.AddField(model_name="message", name="message_type", field=models.CharField(default="text", max_length=64, verbose_name="消息类型")),
        migrations.AddField(model_name="message", name="payload", field=models.JSONField(blank=True, default=dict, verbose_name="消息数据")),
        migrations.AddField(model_name="message", name="media", field=apps.media.fields.MediaRefsField(blank=True, default=list, max_items=1, verbose_name="消息图片")),
        migrations.RunPython(convert_contact_messages, migrations.RunPython.noop),
    ]
