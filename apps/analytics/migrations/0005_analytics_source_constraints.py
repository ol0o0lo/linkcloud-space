from django.db import migrations, models


KNOWN_SOURCES = ("h5", "miniprogram", "public", "admin", "server")


def validate_existing_sources(apps, schema_editor):
    analytics_event = apps.get_model("analytics", "AnalyticsEvent")
    analytics_daily_metric = apps.get_model("analytics", "AnalyticsDailyMetric")
    unknown = set(analytics_event.objects.exclude(source__in=KNOWN_SOURCES).values_list("source", flat=True))
    unknown.update(analytics_daily_metric.objects.exclude(source="").exclude(source__in=KNOWN_SOURCES).values_list("source", flat=True))
    if unknown:
        values = ", ".join(sorted(unknown))
        raise RuntimeError(f"分析数据存在未注册来源，请先处理后再迁移：{values}")


class Migration(migrations.Migration):
    dependencies = [
        ("analytics", "0004_alter_analyticsdailymetric_options_and_more"),
    ]

    operations = [
        migrations.RunPython(validate_existing_sources, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="analyticsevent",
            name="source",
            field=models.CharField(
                choices=[
                    ("h5", "H5"),
                    ("miniprogram", "微信小程序"),
                    ("public", "公开页面"),
                    ("admin", "管理端"),
                    ("server", "服务端业务"),
                ],
                max_length=32,
                verbose_name="来源",
            ),
        ),
        migrations.AlterField(
            model_name="analyticsdailymetric",
            name="source",
            field=models.CharField(
                blank=True,
                choices=[
                    ("h5", "H5"),
                    ("miniprogram", "微信小程序"),
                    ("public", "公开页面"),
                    ("admin", "管理端"),
                    ("server", "服务端业务"),
                ],
                max_length=32,
                verbose_name="来源",
            ),
        ),
        migrations.AddConstraint(
            model_name="analyticsevent",
            constraint=models.CheckConstraint(
                condition=models.Q(source__in=KNOWN_SOURCES),
                name="analytics_event_source_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="analyticsdailymetric",
            constraint=models.CheckConstraint(
                condition=models.Q(source="") | models.Q(source__in=KNOWN_SOURCES),
                name="analytics_daily_source_valid",
            ),
        ),
    ]
