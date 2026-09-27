import apps.media.fields
from django.db import migrations


MODEL_NAMES = (
    ("miniprogramhomeentry", "contententry"),
    ("miniprogramhomebanner", "homebanner"),
    ("miniprogramhomeentryhouse", "contententryhouse"),
)


def rename_content_types(apps, _schema_editor):
    ContentType = apps.get_model("contenttypes", "ContentType")
    Permission = apps.get_model("auth", "Permission")
    for old_name, new_name in MODEL_NAMES:
        for content_type in ContentType.objects.filter(app_label="miniprogram_home", model=old_name):
            for action in ("add", "change", "delete", "view"):
                Permission.objects.filter(content_type=content_type, codename=f"{action}_{old_name}").update(codename=f"{action}_{new_name}")
            content_type.model = new_name
            content_type.save(update_fields=["model"])


def restore_content_types(apps, _schema_editor):
    ContentType = apps.get_model("contenttypes", "ContentType")
    Permission = apps.get_model("auth", "Permission")
    for old_name, new_name in MODEL_NAMES:
        for content_type in ContentType.objects.filter(app_label="miniprogram_home", model=new_name):
            for action in ("add", "change", "delete", "view"):
                Permission.objects.filter(content_type=content_type, codename=f"{action}_{new_name}").update(codename=f"{action}_{old_name}")
            content_type.model = old_name
            content_type.save(update_fields=["model"])


class Migration(migrations.Migration):
    dependencies = [
        ("media", "0012_platform_content_image"),
        ("miniprogram_home", "0004_polish_seed_home_entries"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RenameModel("MiniProgramHomeEntry", "ContentEntry"),
                migrations.RenameModel("MiniProgramHomeBanner", "HomeBanner"),
                migrations.RenameModel("MiniProgramHomeEntryHouse", "ContentEntryHouse"),
                migrations.AlterModelTable("contententry", "miniprogram_home_miniprogramhomeentry"),
                migrations.AlterModelTable("homebanner", "miniprogram_home_miniprogramhomebanner"),
                migrations.AlterModelTable("contententryhouse", "miniprogram_home_miniprogramhomeentryhouse"),
                migrations.AlterModelOptions("contententry", options={"verbose_name": "运营专题或指南", "verbose_name_plural": "运营专题或指南", "ordering": ("sort_order", "id")}),
                migrations.AlterModelOptions("homebanner", options={"verbose_name": "首页 Banner", "verbose_name_plural": "首页 Banner", "ordering": ("sort_order", "id")}),
                migrations.AlterModelOptions("contententryhouse", options={"verbose_name": "运营专题房源", "verbose_name_plural": "运营专题房源", "ordering": ("sort_order", "id")}),
                migrations.AlterField(
                    model_name="contententry",
                    name="cover_image",
                    field=apps.media.fields.MediaRefsField(allowed_media_types=["image"], allowed_resource_types=["platform_content_image"], blank=True, default=list, max_items=1, verbose_name="封面图片"),
                ),
                migrations.AlterField(
                    model_name="homebanner",
                    name="image",
                    field=apps.media.fields.MediaRefsField(allowed_media_types=["image"], allowed_resource_types=["platform_content_image"], blank=True, default=list, max_items=1, verbose_name="配图"),
                ),
            ],
            database_operations=[],
        ),
        migrations.RunPython(rename_content_types, restore_content_types),
    ]
