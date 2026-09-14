-- Adds Groq as a valid AI provider. Switching providers is meant to be
-- cheap (CLAUDE.md §5 "provider abstraction") — this is the DB-side half
-- of that; the Edge Function side is providers/groq.ts.

alter table ai_generations drop constraint ai_generations_provider_check;
alter table ai_generations add constraint ai_generations_provider_check
  check (provider in ('claude', 'gemini', 'groq'));
