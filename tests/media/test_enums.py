from apps.media.constants import MediaExtension, MediaScope


class TestMediaScope:
    def test_values(self):
        assert MediaScope.values == ["user", "org"]

    def test_user_member(self):
        assert MediaScope.USER == "user"

    def test_org_member(self):
        assert MediaScope.ORG == "org"


class TestMediaExtension:
    def test_values(self):
        assert MediaExtension.values == ["jpg", "jpeg", "png", "webp", "mp4", "mov", "avi", "pdf", "doc", "docx"]

    def test_jpg_member(self):
        assert MediaExtension.JPG == "jpg"

    def test_video_and_contract_members(self):
        assert MediaExtension.MP4 == "mp4"
        assert MediaExtension.MOV == "mov"
        assert MediaExtension.AVI == "avi"
        assert MediaExtension.PDF == "pdf"
