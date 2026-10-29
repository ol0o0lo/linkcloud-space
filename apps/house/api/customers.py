from typing import Literal

from ninja import Query, Router, Status
from ninja.pagination import paginate

from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_org_selected
from apps.house.queries.customers import can_manage_customers, customer_workbench, customers_for_actor, get_customer, prepare_customer, require_customer_member
from apps.house.schemas.customers import (
    CustomerIn,
    CustomerInquiryConvertIn,
    CustomerOut,
    CustomerPatchIn,
    CustomerStageValue,
    CustomerWorkbenchOut,
)
from apps.house.schemas.inquiries import InquiryContactOut
from apps.house.services.customers import convert_customer_inquiry, create_customer, update_customer

router = Router(tags=["房源/客户"])


class CustomerPagination(LegacyPagination):
    def paginate_queryset(self, queryset, pagination, **params):
        page = super().paginate_queryset(queryset, pagination, **params)
        page["items"] = [prepare_customer(contact) for contact in page["items"]]
        return page


@router.get("/customer-capabilities/", response=dict[str, bool], summary="获取客户管理能力")
def customer_capabilities(request):
    org = require_org_selected(request)
    require_customer_member(organization=org, actor=request.user)
    return {"can_manage": can_manage_customers(organization=org, actor=request.user)}


@router.get("/customers/", response=list[CustomerOut], summary="获取客户列表")
@paginate(CustomerPagination)
def list_customers(
    request,
    keyword: str | None = Query(None),
    stage: CustomerStageValue | None = Query(None),
    scope: Literal["mine", "all"] = Query("all"),
):
    return customers_for_actor(organization=require_org_selected(request), actor=request.user, keyword=keyword, stage=stage, scope=scope)


@router.post("/customers/", response={201: CustomerOut}, summary="创建客户")
def post_customer(request, payload: CustomerIn):
    contact = create_customer(organization=require_org_selected(request), actor=request.user, data=payload.model_dump(exclude_unset=True))
    return Status(201, prepare_customer(contact))


@router.get("/customers/{contact_id}/", response=CustomerOut, summary="获取客户详情")
def customer_detail(request, contact_id: int):
    return prepare_customer(get_customer(organization=require_org_selected(request), actor=request.user, contact_id=contact_id))


@router.patch("/customers/{contact_id}/", response=CustomerOut, summary="更新客户档案")
def patch_customer(request, contact_id: int, payload: CustomerPatchIn):
    contact = update_customer(organization=require_org_selected(request), actor=request.user, contact_id=contact_id, changes=payload.model_dump(exclude_unset=True))
    return prepare_customer(contact)


@router.post("/customer-inquiries/{notification_id}/convert/", response=InquiryContactOut, summary="将咨询转入客户")
def convert_inquiry(request, notification_id: int, payload: CustomerInquiryConvertIn):
    return convert_customer_inquiry(organization=require_org_selected(request), actor=request.user, notification_id=notification_id, data=payload.model_dump(exclude_unset=True))


@router.get("/customer-workbench/", response=CustomerWorkbenchOut, summary="获取客户工作台待办")
def get_customer_workbench(request):
    return customer_workbench(organization=require_org_selected(request), actor=request.user)
