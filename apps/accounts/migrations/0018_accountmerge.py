import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0017_alter_realnameverification_options_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="AccountMerge",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reason", models.CharField(default="verified_phone_match", max_length=64, verbose_name="合并原因")),
                ("identity_provider", models.CharField(max_length=64, verbose_name="身份来源")),
                ("trigger", models.CharField(default="wechat_phone_binding", max_length=64, verbose_name="触发方式")),
                ("migration_summary", models.JSONField(default=dict, verbose_name="迁移摘要")),
                ("merged_at", models.DateTimeField(auto_now_add=True, verbose_name="合并时间")),
                (
                    "source_user",
                    models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name="account_merge", to=settings.AUTH_USER_MODEL, verbose_name="来源账号"),
                ),
                (
                    "target_user",
                    models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="account_merge_targets", to=settings.AUTH_USER_MODEL, verbose_name="主账号"),
                ),
            ],
            options={
                "verbose_name": "账号合并记录",
                "verbose_name_plural": "账号合并记录",
                "ordering": ("-merged_at", "-pk"),
            },
        ),
    ]
