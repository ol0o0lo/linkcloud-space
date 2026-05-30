from allauth.headless.contrib.ninja.security import XSessionTokenAuth


class XSessionTokenUserAuth(XSessionTokenAuth):
    def __call__(self, request):
        user = super().__call__(request)
        if user is not None:
            request.user = user
        return user


x_session_token_user_auth = XSessionTokenUserAuth()
