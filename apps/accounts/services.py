"""accounts 业务服务层。"""


def bind_phone_to_user(request, user, phone: str):
    """绑定手机号到 user。若已有其他账号使用此手机号，执行合并。"""
    from django.contrib.auth import get_user_model
    from django.db import transaction

    from allauth.account.internal.flows.login import Login, perform_login
    from allauth.socialaccount.models import SocialAccount

    User = get_user_model()

    # 幂等：当前 user 已经是这个手机号
    if user.phone == phone:
        return user, False

    existing = User.objects.filter(phone=phone).exclude(pk=user.pk).first()
    if existing:
        with transaction.atomic():
            SocialAccount.objects.filter(user=user).update(user=existing)
            user.is_active = False
            user.save(update_fields=["is_active"])
        perform_login(request, Login(user=existing))
        return existing, True
    else:
        user.phone = phone
        user.phone_verified = True
        user.save(update_fields=["phone", "phone_verified"])
        return user, False
