from django.db.models import Q
from django.utils import timezone

from celery import shared_task

from apps.ai.models import AIInvocation
from apps.ai.runtime.contracts import AIExecutionError, AIInvocationStatus


@shared_task
def execute_ai_invocation(invocation_id: int) -> bool:
    claimed = AIInvocation.objects.filter(pk=invocation_id, status=AIInvocationStatus.QUEUED.value).update(
        status=AIInvocationStatus.RUNNING.value,
        started_at=timezone.now(),
    )
    if claimed != 1:
        return False
    invocation = AIInvocation.objects.get(pk=invocation_id)
    from apps.ai.services import _execute_queued_invocation

    try:
        _execute_queued_invocation(invocation)
    except AIExecutionError as error:
        AIInvocation.objects.filter(pk=invocation_id, status=AIInvocationStatus.RUNNING.value).update(
            status=AIInvocationStatus.FAILED.value,
            error_type=error.code.value,
            error_code=error.code.value,
            error_summary=error.safe_message[:500],
            finished_at=timezone.now(),
        )
        raise
    except Exception as unexpected:
        AIInvocation.objects.filter(pk=invocation_id, status=AIInvocationStatus.RUNNING.value).update(
            status=AIInvocationStatus.FAILED.value,
            error_type="internal_error",
            error_code="internal_error",
            error_summary="AI 异步任务发生内部错误。",
            finished_at=timezone.now(),
        )
        raise RuntimeError("AI 异步任务执行失败。") from unexpected
    return True


def purge_expired_ai_payloads() -> int:
    queryset = AIInvocation.objects.filter(
        Q(content_expires_at__isnull=False),
        content_expires_at__lte=timezone.now(),
    ).exclude(input_payload={}, output_payload={})
    return queryset.update(input_payload={}, output_payload={})


@shared_task
def purge_expired_ai_payloads_task() -> int:
    return purge_expired_ai_payloads()
