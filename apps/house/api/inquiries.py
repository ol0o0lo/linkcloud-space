from django.db.models import Q

from ninja import Query, Router
from ninja.pagination import paginate

from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_org_selected
from apps.house.schemas.customers import CustomerInquiryConvertIn
from apps.house.schemas.inquiries import InquiryAssignIn, InquiryContactOut, InquiryOut, InquiryPatchIn
from apps.house.services.inquiries import assign_inquiry, convert_inquiry, get_inquiry, inquiries_for_actor, prepare_inquiry, prepare_inquiry_contact, update_inquiry

router = Router(tags=["房源/咨询"])


class InquiryPagination(LegacyPagination):
    def paginate_queryset(self, queryset, pagination, **params):
        page = super().paginate_queryset(queryset, pagination, **params)
        page["items"] = [prepare_inquiry(item, actor=params["request"].user) for item in page["items"]]
        return page


@router.get("/inquiries/", response=list[InquiryOut], summary="获取房源咨询")
@paginate(InquiryPagination)
def list_inquiries(request, status: str | None = Query(None), keyword: str | None = Query(None), contact_id: int | None = Query(None, gt=0)):
    qs = inquiries_for_actor(organization=require_org_selected(request), actor=request.user)
    if contact_id is not None:
        qs = qs.filter(contact_id=contact_id)
    if status:
        qs = qs.filter(status=status)
    if keyword:
        qs = qs.filter(
            Q(customer_name__icontains=keyword)
            | Q(phone__icontains=keyword)
            | Q(wechat__icontains=keyword)
            | Q(house__room_number__icontains=keyword)
            | Q(house__building__name__icontains=keyword)
        )
    return qs


@router.get("/inquiries/{inquiry_id}/", response=InquiryOut, summary="获取咨询及本次需求历史")
def inquiry_detail(request, inquiry_id: int):
    return prepare_inquiry(get_inquiry(organization=require_org_selected(request), actor=request.user, inquiry_id=inquiry_id), actor=request.user, detail=True)


@router.patch("/inquiries/{inquiry_id}/", response=InquiryOut, summary="更新咨询")
def patch_inquiry(request, inquiry_id: int, payload: InquiryPatchIn):
    inquiry = update_inquiry(organization=require_org_selected(request), actor=request.user, inquiry_id=inquiry_id, data=payload.model_dump(exclude_unset=True))
    return prepare_inquiry(inquiry, actor=request.user, detail=True)


@router.post("/inquiries/{inquiry_id}/assign/", response=InquiryOut, summary="转派当前咨询")
def post_assign_inquiry(request, inquiry_id: int, payload: InquiryAssignIn):
    inquiry = assign_inquiry(organization=require_org_selected(request), actor=request.user, inquiry_id=inquiry_id, assigned_to_id=payload.assigned_to_id)
    return prepare_inquiry(inquiry, actor=request.user, detail=True)


@router.post("/inquiries/{inquiry_id}/convert/", response=InquiryContactOut, summary="确认咨询客户")
def post_convert_inquiry(request, inquiry_id: int, payload: CustomerInquiryConvertIn):
    organization = require_org_selected(request)
    contact = convert_inquiry(organization=organization, actor=request.user, inquiry_id=inquiry_id, data=payload.model_dump(exclude_unset=True))
    inquiry = get_inquiry(organization=organization, actor=request.user, inquiry_id=inquiry_id)
    return prepare_inquiry_contact(contact, wechat=inquiry.wechat)
