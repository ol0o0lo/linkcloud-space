from django.utils.translation import gettext_lazy as _

from apps.base.enums import IntChoices, StrChoices


class Color(StrChoices):
    RED = "red", _("红色")
    GREEN = "green", _("绿色")


class Status(IntChoices):
    ACTIVE = 1, "启用"
    INACTIVE = 0, "禁用"


class TestStrChoices:
    def test_get_choice_label_found(self):
        assert Color.get_choice_label("red") == "红色"

    def test_get_choice_label_not_found(self):
        assert Color.get_choice_label("unknown") == "unknown"


class TestIntChoices:
    def test_values(self):
        assert Status.values == [1, 0]

    def test_get_choice_label_found(self):
        assert Status.get_choice_label(1) == "启用"

    def test_get_choice_label_not_found(self):
        assert Status.get_choice_label(99) == 99
