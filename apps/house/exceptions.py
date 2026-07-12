from apps.base.exceptions import ConflictException


class ResourceInUseException(ConflictException):
    error = "RESOURCE_IN_USE"

    def __init__(self, message: str, check: dict):
        super().__init__(message, data=check)
