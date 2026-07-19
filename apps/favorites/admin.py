from django.contrib import admin

from apps.favorites.models import Favorite


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "target_type", "target_id", "is_active", "updated_at")
    list_filter = ("target_type", "is_active")
    search_fields = ("user__username", "target_id")
