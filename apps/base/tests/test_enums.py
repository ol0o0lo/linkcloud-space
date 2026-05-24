from django.utils.translation import gettext_lazy as _

from apps.base.enums import ChoicesMixin


class Color(ChoicesMixin):
    RED = "red", _("红色")
    GREEN = "green", _("绿色")


class TestChoicesMixin:
    def test_get_choice_label_found(self):
        assert Color.get_choice_label("red") == "红色"

    def test_get_choice_label_not_found(self):
        assert Color.get_choice_label("unknown") == "unknown"
