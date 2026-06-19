from django.db import models
from django.db.models import Q


class NotificationQuerySet(models.QuerySet):
    def filter_by_org(self, request):
        org = request.org
        if org.id is not None:
            return self.filter(recipient=request.user).filter(
                Q(organization_id=org.id) | Q(organization__isnull=True)
            )
        return self.filter(recipient=request.user, organization__isnull=True)
