-- ai_calls.provider 放宽约束，允许 gemini_api（接入 Gemini 免费层作为 provider）
alter table app_private.ai_calls drop constraint if exists ai_calls_provider_check;
alter table app_private.ai_calls add constraint ai_calls_provider_check
  check (provider in ('anthropic_api', 'claude_agent_sdk', 'gemini_api', 'mock'));
