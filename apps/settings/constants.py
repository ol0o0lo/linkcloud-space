from apps.base.enums import StrChoices


class ValueType(StrChoices):
    TEXT = "text", "文本"
    PASSWORD = "password", "密码"
    JSON = "json", "JSON"
    BOOLEAN = "boolean", "布尔"
    INTEGER = "integer", "整数"
    FLOAT = "float", "浮点数"


class SettingWidget(StrChoices):
    INPUT = "input", "输入框"
    TEXTAREA = "textarea", "多行文本"
    PASSWORD = "password", "密码框"
    SWITCH = "switch", "开关"
    INPUT_NUMBER = "input_number", "数字输入框"
    SELECT = "select", "选择器"
    JSON_EDITOR = "json_editor", "JSON 编辑器"
    LOCATION_PICKER = "location_picker", "地址选择器"
    TAGS = "tags", "标签输入"
