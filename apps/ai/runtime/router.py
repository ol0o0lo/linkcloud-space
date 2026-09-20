from apps.ai.models import AIModelRoute
from apps.ai.runtime.contracts import AICapability, AIExecutionMode, AIModelCandidate, AIStructuredOutputMode


def get_model_candidates(capability: AICapability, *, mode: AIExecutionMode, requires_structured_output: bool) -> list[AIModelCandidate]:
    routes = AIModelRoute.objects.select_related("model__provider").filter(
        capability=capability.value,
        enabled=True,
        model__enabled=True,
        model__provider__enabled=True,
    )
    if mode == AIExecutionMode.STREAM:
        routes = routes.filter(model__supports_streaming=True)
    if requires_structured_output:
        routes = routes.exclude(model__structured_output_mode=AIStructuredOutputMode.NONE.value)

    return [
        AIModelCandidate(
            provider_code=route.model.provider.code,
            adapter=route.model.provider.adapter,
            base_url=route.model.provider.base_url,
            api_key_env=route.model.provider.api_key_env,
            timeout_seconds=route.model.provider.timeout_seconds,
            provider_extra=route.model.provider.extra,
            model_name=route.model.model_name,
            display_name=route.model.display_name,
            structured_output_mode=AIStructuredOutputMode(route.model.structured_output_mode),
            context_window=route.model.context_window,
            max_output_tokens=route.model.max_output_tokens,
            default_parameters=route.model.default_parameters,
            input_price_per_million=route.model.input_price_per_million,
            output_price_per_million=route.model.output_price_per_million,
            currency=route.model.currency,
        )
        for route in routes.order_by("priority", "pk")
    ]
