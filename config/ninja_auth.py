"""
Ninja 认证：Django session（Web SPA 用 X-CSRFToken）。
"""

from ninja.security import django_auth

__all__ = ["django_auth"]
