from apps.accounts.models import RealNameVerification
from apps.media.services import extract_media_ids


def collect_real_name_media_ids():
    media_ids = set()
    for row in RealNameVerification.objects.values_list("id_card_media", flat=True):
        if row:
            media_ids.update(extract_media_ids(row))
    return media_ids
