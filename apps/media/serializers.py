from rest_framework import serializers


class OssTokenRequestSerializer(serializers.Serializer):
    scope = serializers.ChoiceField(choices=["user", "org"])
    filename = serializers.CharField(max_length=255)


class OssTokenResponseSerializer(serializers.Serializer):
    access_key_id = serializers.CharField()
    access_key_secret = serializers.CharField()
    security_token = serializers.CharField()
    endpoint = serializers.CharField()
    bucket = serializers.CharField()
    path = serializers.CharField()
    expires_at = serializers.CharField()
