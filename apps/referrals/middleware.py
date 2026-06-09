from apps.referrals.services import capture_referral_code


class ReferralAttributionMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        capture_referral_code(request)
        return self.get_response(request)
