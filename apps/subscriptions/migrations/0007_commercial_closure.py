# Generated manually for the SaaS commercial closure.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def configure_commercial_catalog(apps, schema_editor):
    Plan = apps.get_model("subscriptions", "Plan")
    PlanPrice = apps.get_model("subscriptions", "PlanPrice")
    catalog = {
        "free": ("适合个人体验基础房源管理。", "self_service"),
        "standard": ("适合 2～10 人门店，覆盖房源、客户、带看与租约协作。", "self_service"),
        "professional": ("适合 11～50 人团队，增加经营分析、批量操作与更高配额。", "self_service"),
        "enterprise": ("适合连锁门店与大型团队，提供高级权限、接口集成和专属实施服务。", "sales_assisted"),
    }
    for code, (description, purchase_mode) in catalog.items():
        Plan.objects.filter(code=code).update(description=description, purchase_mode=purchase_mode)
    PlanPrice.objects.filter(plan__code="standard", billing_cycle="year").update(display_note="年付约省 2 个月")
    PlanPrice.objects.filter(plan__code="professional", billing_cycle="year").update(display_note="年付约省 2 个月")
    PlanPrice.objects.filter(plan__code="enterprise").update(display_note="最终价格以需求评估为准")


class Migration(migrations.Migration):
    dependencies = [
        ("organizations", "0015_organizationmember_employee_name_and_job_title"),
        ("subscriptions", "0006_saasorder_idempotency_key_and_pending_constraint"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="plan",
            name="purchase_mode",
            field=models.CharField(
                choices=[("self_service", "自助购买"), ("sales_assisted", "联系销售")],
                default="self_service",
                max_length=24,
                verbose_name="购买方式",
            ),
        ),
        migrations.CreateModel(
            name="OrganizationSaaSProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="创建时间")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="更新时间")),
                ("business_type", models.CharField(choices=[("individual", "独立中介"), ("store", "中介门店")], default="store", max_length=24, verbose_name="经营类型")),
                ("city_code", models.CharField(blank=True, default="", max_length=32, verbose_name="城市编码")),
                ("city_name", models.CharField(blank=True, default="", max_length=64, verbose_name="城市名称")),
                (
                    "team_size_band",
                    models.CharField(
                        choices=[("1", "1 人"), ("2_10", "2～10 人"), ("11_50", "11～50 人"), ("51_plus", "51 人以上")],
                        default="2_10",
                        max_length=24,
                        verbose_name="团队规模",
                    ),
                ),
                ("source", models.CharField(blank=True, default="miniprogram", max_length=32, verbose_name="来源")),
                (
                    "organization",
                    models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="saas_profile", to="organizations.organization", verbose_name="所属组织"),
                ),
            ],
            options={
                "db_table": "subscriptions_organization_saas_profile",
                "verbose_name": "组织 SaaS 经营画像",
                "verbose_name_plural": "组织 SaaS 经营画像",
            },
        ),
        migrations.CreateModel(
            name="SubscriptionSalesLead",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="创建时间")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="更新时间")),
                ("contact_name", models.CharField(max_length=64, verbose_name="联系人")),
                ("contact_phone", models.CharField(db_index=True, max_length=32, verbose_name="联系电话")),
                ("company_name", models.CharField(blank=True, default="", max_length=128, verbose_name="公司或门店名称")),
                ("city_name", models.CharField(blank=True, default="", max_length=64, verbose_name="所在城市")),
                ("team_size", models.CharField(blank=True, default="", max_length=32, verbose_name="团队规模")),
                ("house_scale", models.CharField(blank=True, default="", max_length=32, verbose_name="房源规模")),
                ("needs", models.TextField(blank=True, default="", verbose_name="需求说明")),
                ("source", models.CharField(blank=True, default="miniprogram", max_length=32, verbose_name="来源")),
                (
                    "status",
                    models.CharField(
                        choices=[("new", "待联系"), ("contacting", "跟进中"), ("qualified", "已确认需求"), ("won", "已成交"), ("lost", "已流失")],
                        db_index=True,
                        default="new",
                        max_length=24,
                        verbose_name="跟进状态",
                    ),
                ),
                ("admin_note", models.TextField(blank=True, default="", verbose_name="跟进备注")),
                ("last_contacted_at", models.DateTimeField(blank=True, null=True, verbose_name="最近联系时间")),
                (
                    "assigned_to",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="assigned_subscription_sales_leads", to=settings.AUTH_USER_MODEL, verbose_name="跟进人"),
                ),
                (
                    "organization",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="subscription_sales_leads", to="organizations.organization", verbose_name="所属组织"),
                ),
                (
                    "user",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="subscription_sales_leads", to=settings.AUTH_USER_MODEL, verbose_name="提交用户"),
                ),
            ],
            options={
                "db_table": "subscriptions_sales_lead",
                "ordering": ("-created_at", "-pk"),
                "verbose_name": "SaaS 销售线索",
                "verbose_name_plural": "SaaS 销售线索",
                "indexes": [models.Index(fields=["status", "created_at"], name="sub_lead_status_created_idx")],
            },
        ),
        migrations.RunPython(configure_commercial_catalog, migrations.RunPython.noop),
    ]
