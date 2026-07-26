from ninja import Router
from ninja.errors import HttpError

from apps.payments.services import mark_payment_succeeded, mark_payout_result
from apps.payments.wechat import WechatPayClient, build_wechat_config

router = Router(tags=["支付"])


@router.post("/wechat/notify/", auth=None, response=dict, summary="微信收款回调")
def wechat_payment_notify(request):
    raw_body = request.body.decode("utf-8")
    client = WechatPayClient(build_wechat_config(purpose="payment"))
    if not client.verify_callback(headers=dict(request.headers), raw_body=raw_body):
        raise HttpError(403, "微信支付回调验签失败。")
    payment = mark_payment_succeeded(**client.parse_payment_callback(raw_body=raw_body))
    return {"code": "SUCCESS", "message": "成功", "transaction_no": payment.transaction_no}


@router.post("/wechat/payout/notify/", auth=None, response=dict, summary="微信出款回调")
def wechat_payout_notify(request):
    raw_body = request.body.decode("utf-8")
    client = WechatPayClient(build_wechat_config(purpose="payout"))
    if not client.verify_callback(headers=dict(request.headers), raw_body=raw_body):
        raise HttpError(403, "微信出款回调验签失败。")
    payout = mark_payout_result(provider="wechat", **client.parse_payout_callback(raw_body=raw_body))
    return {"code": "SUCCESS", "message": "成功", "out_trade_no": payout.out_trade_no}
