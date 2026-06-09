from django.dispatch import receiver

from allauth.account.signals import user_signed_up

from apps.referrals.services import create_record_from_request


@receiver(user_signed_up)
def user_signed_up_receiver(request, user, **kwargs):
    if request is None:
        return
    create_record_from_request(request=request, invitee=user)
