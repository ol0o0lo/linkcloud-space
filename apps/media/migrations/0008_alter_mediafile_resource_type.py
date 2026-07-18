from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("media", "0007_mediafile_thumbnail_fields"),
    ]

    operations = [
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
                ],
                max_length=32,
            ),
        ),
    ]
