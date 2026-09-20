from django.db import migrations


def seed_current_home(apps, _schema_editor):
    HomeEntry = apps.get_model("miniprogram_home", "MiniProgramHomeEntry")
    HomeBanner = apps.get_model("miniprogram_home", "MiniProgramHomeBanner")

    HomeEntry.objects.create(
        kind="topic",
        slug="metro-line-homes",
        eyebrow="通勤专题",
        title="地铁沿线好房",
        summary="按站点发现通勤更从容的家",
        body_markdown="# 地铁沿线好房\n\n按站点发现通勤更从容的家。",
        tone="sage",
        sort_order=10,
        is_enabled=True,
    )
    HomeEntry.objects.create(
        kind="topic",
        slug="homes-under-3000",
        eyebrow="低价专题",
        title="月租 3000 内",
        summary="预算友好的高性价比房源",
        body_markdown="# 月租 3000 内\n\n预算友好的高性价比房源。",
        tone="lavender",
        sort_order=20,
        is_enabled=True,
    )
    graduation_topic = HomeEntry.objects.create(
        kind="topic",
        slug="graduation-rental",
        eyebrow="毕业季专题",
        title="毕业季安心租",
        summary="真实房源、灵活付款与年轻人关注的租住条件",
        body_markdown="# 毕业季安心租\n\n真实房源、灵活付款与年轻人关注的租住条件。",
        tone="lavender",
        sort_order=30,
        is_enabled=True,
    )
    HomeEntry.objects.create(
        kind="guide",
        slug="first-rental-checklist",
        eyebrow="实用指南",
        title="第一次租房必须确认的 8 件事",
        summary="合同 · 验房 · 押金 · 退租",
        body_markdown="# 第一次租房必须确认的 8 件事\n\n合同、验房、押金与退租等事项都应在签约前确认。",
        tone="slate",
        sort_order=10,
        is_enabled=True,
    )
    HomeEntry.objects.create(
        kind="guide",
        slug="commute-time-guide",
        eyebrow="实用指南",
        title="通勤时间怎么估算？",
        summary="避开地图距离带来的误差",
        body_markdown="# 通勤时间怎么估算？\n\n从实际出发时间、换乘次数与步行距离综合估算通勤时间。",
        tone="clay",
        sort_order=20,
        is_enabled=True,
    )

    HomeBanner.objects.create(
        eyebrow="智能找房场景",
        title="通勤 30 分钟内\n有哪些好房？",
        description="从公司或学校出发，筛出距离与预算都合适的房源",
        button_text="开始找房",
        tone="blue",
        action_type="house_list",
        sort_order=10,
        is_enabled=True,
    )
    HomeBanner.objects.create(
        eyebrow="限时运营专题",
        title="毕业季安心租\n新人好房专区",
        description="真实房源、灵活付款与年轻人关注的租住条件",
        button_text="查看专题",
        tone="violet",
        action_type="entry",
        entry=graduation_topic,
        sort_order=20,
        is_enabled=True,
    )
    HomeBanner.objects.create(
        eyebrow="地图找房",
        title="先选生活圈\n再挑合适的家",
        description="按区域、小区和楼栋逐级查看公开房源",
        button_text="打开地图",
        tone="teal",
        action_type="house_map",
        sort_order=30,
        is_enabled=True,
    )
class Migration(migrations.Migration):
    dependencies = [("miniprogram_home", "0001_initial")]

    operations = [migrations.RunPython(seed_current_home, migrations.RunPython.noop)]
