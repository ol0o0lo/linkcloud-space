from datetime import timedelta

from django.utils import timezone

import pytest
from model_bakery import baker

from apps.ai.models import AIInvocation
from apps.ai.runtime.contracts import AICapability, AIErrorCode, AIExecutionError, AIExecutionResult, AIRetentionPolicy, AIUsage
from apps.ai.services import enqueue, generate, get_job
from apps.ai.tasks import execute_ai_invocation, purge_expired_ai_payloads
from apps.settings.models import DefaultSetting, OrganizationSetting


@pytest.mark.django_db
def test_generate_persists_audit_without_metadata_payload(ai_runtime, org_owner):
    ai_runtime(response=AIExecutionResult("朝南两居室", usage=AIUsage(20, 8, 28, "reported")))
    result = generate(
        actor=org_owner.user,
        organization=org_owner.organization,
        capability=AICapability.TEXT_GENERATION,
        prompt_key="house.description",
        source_app="house",
        target_type="house",
        target_id="100",
        retention_policy=AIRetentionPolicy.METADATA_ONLY,
        safe_summary={"house_id": 100, "phone": "13800138000"},
    )
    invocation = AIInvocation.objects.get(pk=result.invocation_id)
    assert invocation.status == "succeeded"
    assert invocation.total_tokens == 28
    assert invocation.input_payload == invocation.output_payload == {}
    assert invocation.safe_summary == {"house_id": 100}


@pytest.mark.django_db
def test_enqueue_dispatches_only_id_and_get_job_is_scoped(ai_runtime, org_owner, monkeypatch, django_capture_on_commit_callbacks):
    ai_runtime(response=AIExecutionResult("完成"))
    dispatched = []
    monkeypatch.setattr("apps.ai.tasks.execute_ai_invocation.delay", lambda invocation_id: dispatched.append(invocation_id))
    with django_capture_on_commit_callbacks(execute=True):
        job = enqueue(
            actor=org_owner.user,
            organization=org_owner.organization,
            capability=AICapability.TEXT_GENERATION,
            prompt_key="house.description",
            source_app="house",
        )
    assert dispatched == [job.invocation_id]
    assert get_job(actor=org_owner.user, organization=org_owner.organization, invocation_id=job.invocation_id, source_app="house").status == "queued"


@pytest.mark.django_db
def test_async_worker_executes_existing_invocation(ai_runtime, org_owner):
    ai_runtime(response=AIExecutionResult("异步完成", usage=AIUsage(8, 2, 10, "reported")))
    job = enqueue(
        actor=org_owner.user,
        organization=org_owner.organization,
        capability=AICapability.TEXT_GENERATION,
        prompt_key="house.description",
        source_app="house",
    )
    assert execute_ai_invocation(job.invocation_id) is True
    completed = get_job(
        actor=org_owner.user,
        organization=org_owner.organization,
        invocation_id=job.invocation_id,
        source_app="house",
    )
    assert completed.status == "succeeded"
    assert completed.text == "异步完成"


@pytest.mark.django_db
def test_disabled_org_capability_is_rejected_before_invocation(ai_runtime, org_owner):
    ai_runtime(response=AIExecutionResult("不应调用"))
    capability_setting = DefaultSetting.objects.get(key="ai.allowed_capabilities")
    OrganizationSetting.objects.create(organization=org_owner.organization, setting=capability_setting, value=["chat"])
    with pytest.raises(AIExecutionError) as exc_info:
        generate(
            actor=org_owner.user,
            organization=org_owner.organization,
            capability=AICapability.TEXT_GENERATION,
            prompt_key="house.description",
            source_app="house",
        )
    assert exc_info.value.code == AIErrorCode.PERMISSION_DENIED
    assert AIInvocation.objects.count() == 0


@pytest.mark.django_db
def test_worker_claims_once_and_cleanup_preserves_audit(monkeypatch):
    invocation = baker.make(
        AIInvocation,
        capability="text_generation",
        source_app="house",
        execution_mode="async",
        status="queued",
        retention_policy="temporary",
        input_payload={"request": {}},
    )
    calls = []
    monkeypatch.setattr("apps.ai.services._execute_queued_invocation", lambda item: calls.append(item.pk))
    assert execute_ai_invocation(invocation.pk) is True
    assert execute_ai_invocation(invocation.pk) is False
    assert calls == [invocation.pk]

    expired = baker.make(
        AIInvocation,
        capability="text_generation",
        source_app="house",
        execution_mode="sync",
        status="succeeded",
        retention_policy="temporary",
        input_payload={"secret": "input"},
        output_payload={"text": "output"},
        content_expires_at=timezone.now() - timedelta(minutes=1),
        prompt_hash="abc",
    )
    assert purge_expired_ai_payloads() == 1
    expired.refresh_from_db()
    assert expired.input_payload == expired.output_payload == {}
    assert expired.prompt_hash == "abc"
