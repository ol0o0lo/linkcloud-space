"""房源路由聚合；业务实现位于各层对应模块。"""

from ninja import Router

from . import contacts, leases, maps, properties, responsibilities, viewings
from .landlord import landlord_router as landlord_router
from .landlord import public_landlord_router as public_landlord_router
from .public import public_router as public_router
from .tenant import tenant_router as tenant_router

router = Router()
for child_router in (properties.router, maps.router, contacts.router, responsibilities.router, viewings.router, leases.router):
    router.add_router("/", child_router)
