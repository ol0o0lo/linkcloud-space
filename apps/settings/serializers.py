from rest_framework import serializers


class SettingResultSerializer(serializers.Serializer):
    """Org/Team 设置项的统一返回格式。"""

    key = serializers.CharField()
    value = serializers.JSONField()
    value_type = serializers.CharField()
    description = serializers.CharField()
    is_customized = serializers.BooleanField()


class UserSettingResultSerializer(serializers.Serializer):
    """用户偏好的返回格式。"""

    key = serializers.CharField()
    value = serializers.JSONField()


class SetSettingSerializer(serializers.Serializer):
    """覆盖设置项的入参。"""

    value = serializers.JSONField()


class SetUserSettingSerializer(serializers.Serializer):
    """设置用户偏好的入参。"""

    value = serializers.JSONField()
