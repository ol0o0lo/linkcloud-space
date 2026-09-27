from django.db import migrations, models


def rename_resource_type(apps, _schema_editor):
    MediaFile = apps.get_model("media", "MediaFile")
    MediaFile.objects.filter(resource_type="miniprogram_home_image").update(resource_type="platform_content_image")


def restore_resource_type(apps, _schema_editor):
    MediaFile = apps.get_model("media", "MediaFile")
    MediaFile.objects.filter(resource_type="platform_content_image").update(resource_type="miniprogram_home_image")


class Migration(migrations.Migration):
    dependencies = [("media", "0011_alter_mediafile_resource_type")]

    operations = [
        migrations.RunPython(rename_resource_type, restore_resource_type),
        migrations.AlterField(
            model_name="mediafile",
            name="resource_type",
            field=models.CharField(
                choices=[
                    ("avatar", "用户头像"),
                    ("org_logo", "组织 Logo"),
                    ("real_name_id_card", "实名认证身份证图片"),
                    ("estate_image", "项目图片"),
                    ("building_image", "楼栋图片"),
                    ("house_image", "房源图片"),
                    ("house_video", "房源视频"),
                    ("lease_contract", "租约合同"),
                    ("platform_content_image", "运营内容图片"),
                ],
                max_length=32,
                verbose_name="资源类型",
            ),
        ),
    ]
