from apps.base.enums import StrChoices


class ValueType(StrChoices):
    TEXT = "text", "文本"
    PASSWORD = "password", "密码"
    JSON = "json", "JSON"
    BOOLEAN = "boolean", "布尔"
    INTEGER = "integer", "整数"
