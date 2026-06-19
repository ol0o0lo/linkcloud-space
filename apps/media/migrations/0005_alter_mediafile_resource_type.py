from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("media", "0004_remove_mediafile_order"),
    ]

    operations = [
        migrations.AlterField(
            model_name="mediafile",
            name="resource_type",
            field=models.CharField(choices=[("avatar", "用户头像"), ("org_logo", "组织 Logo"), ("real_name_id_card", "实名认证身份证图片")], max_length=32),
        ),
    ]
