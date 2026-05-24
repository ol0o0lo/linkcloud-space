from apps.media.enums import MediaExtension, MediaScope


class TestMediaScope:
    def test_values(self):
        assert MediaScope.get_values() == ["user", "org"]

    def test_user_member(self):
        assert MediaScope.USER == "user"

    def test_org_member(self):
        assert MediaScope.ORG == "org"


class TestMediaExtension:
    def test_values(self):
        assert MediaExtension.get_values() == ["jpg", "jpeg", "png", "webp"]

    def test_jpg_member(self):
        assert MediaExtension.JPG == "jpg"
