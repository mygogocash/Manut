-- Seed curated learning courses (AI + Software + Cyber Security).
-- Idempotent: guarded inserts by stable IDs.
--
-- `duration` is NULL in every row, so a bare `SELECT * FROM (VALUES ...)`
-- leaves Postgres unable to infer its type and defaults the derived
-- column to `text` -> "column duration is of type integer but
-- expression is of type text" (SQLSTATE 42804) when inserting into the
-- integer column. Project the columns explicitly and cast duration to
-- integer so the NULL is typed correctly.
INSERT INTO "training_modules" ("id", "title", "description", "category", "duration", "url", "is_mandatory", "is_active")
SELECT
  v.id, v.title, v.description, v.category,
  v.duration::integer AS duration,
  v.url, v.is_mandatory, v.is_active
FROM (
  VALUES
    -- TAFE NSW
    ('course_cyber_tafe_cert4', 'Certificate IV in Cyber Security (TAFE NSW)', NULL, 'cyber-security', NULL, 'https://www.tafensw.edu.au/course-areas/information-and-communications-technology/courses/certificate-iv-in-cyber-security--22603VIC-01', false, true),

    -- Udemy
    ('course_ai_udemy_career', 'Artificial Intelligence: Preparing Your Career for AI', NULL, 'ai', NULL, 'https://www.udemy.com/course/artificial-intelligence-preparing-your-career-for-ai/', false, true),
    ('course_ai_udemy_aiml', 'Artificial Intelligence Markup Language (AIML)', NULL, 'ai', NULL, 'https://www.udemy.com/course/artificial-intelligence-markup-language/', false, true),
    ('course_ai_udemy_testing', 'Introduction to Artificial Intelligence in Software Testing', NULL, 'ai', NULL, 'https://www.udemy.com/course/introduction-to-ai-in-software-testing/', false, true),
    ('course_ai_udemy_chatgpt_30', 'ChatGPT in 30 Minutes: NEW Prompt Engineering & AI Skills', NULL, 'ai', NULL, 'https://www.udemy.com/course/chatgpt-in-30-minutes-new-prompt-engineering-ai-skills/', false, true),

    -- Anthropic Academy (Skilljar)
    ('course_ai_anthropic_101', 'Understanding core features', NULL, 'ai', NULL, 'https://anthropic.skilljar.com/claude-101', false, true),
    ('course_ai_anthropic_codex', 'How to use Claude Codex', NULL, 'ai', NULL, 'https://anthropic.skilljar.com/claude-codex-101', false, true),
    ('course_ai_anthropic_intro_coding', 'Introduction to Claude coding', NULL, 'ai', NULL, 'https://anthropic.skilljar.com/introduction-to-claude-code-work', false, true),
    ('course_ai_anthropic_code_action', 'Claude code in action', NULL, 'ai', NULL, 'https://anthropic.skilljar.com/claude-code-in-action', false, true),
    ('course_ai_anthropic_fluency_framework', 'AI Fluency Framework', NULL, 'ai', NULL, 'https://anthropic.skilljar.com/ai-fluency-framework-foundations', false, true),
    ('course_ai_anthropic_api', 'Claude API', NULL, 'ai', NULL, 'https://anthropic.skilljar.com/claude-with-the-anthropic-api', false, true),
    ('course_ai_anthropic_mcp_intro', 'Introduction to model context protocol', NULL, 'ai', NULL, 'https://anthropic.skilljar.com/introduction-to-model-context-protocol', false, true),
    ('course_ai_anthropic_fluency_educators', 'AI Fluency for educators', NULL, 'ai', NULL, 'https://anthropic.skilljar.com/ai-fluency-for-educators', false, true),
    ('course_ai_anthropic_fluency_students', 'AI Fluency for students', NULL, 'ai', NULL, 'https://anthropic.skilljar.com/ai-fluency-for-students', false, true),
    ('course_ai_anthropic_mcp_advanced', 'Advanced model context protocol', NULL, 'ai', NULL, 'https://anthropic.skilljar.com/advanced-model-context-protocol-advanced-topics', false, true),
    ('course_ai_anthropic_bedrock', 'Claude in amazon bedrock', NULL, 'ai', NULL, 'https://anthropic.skilljar.com/claude-in-amazon-bedrock', false, true),
    ('course_ai_anthropic_vertex', 'Claude with google vertex', NULL, 'ai', NULL, 'https://anthropic.skilljar.com/claude-with-google-vertex', false, true),
    ('course_ai_anthropic_teaching', 'Teaching AI fluency', NULL, 'ai', NULL, 'https://anthropic.skilljar.com/teaching-ai-fluency', false, true),
    ('course_ai_anthropic_nonprofits', 'AI fluency for non profits', NULL, 'ai', NULL, 'https://anthropic.skilljar.com/ai-fluency-for-nonprofits', false, true),
    ('course_ai_anthropic_agent_skills', 'Introduction to agent skills', NULL, 'ai', NULL, 'https://anthropic.skilljar.com/introduction-to-agent-skills', false, true),
    ('course_ai_anthropic_subagents', 'Introduction to subagents', NULL, 'ai', NULL, 'https://anthropic.skilljar.com/introduction-to-subagents', false, true),
    ('course_ai_anthropic_caps_limits', 'AI capabilities and limitations', NULL, 'ai', NULL, 'https://anthropic.skilljar.com/ai-capabilities-and-limitations', false, true),
    ('course_ai_anthropic_smallbiz', 'AI Fluency for small businesses', NULL, 'ai', NULL, 'https://anthropic.skilljar.com/ai-fluency-for-small-businesses', false, true),

    -- Matt Pocock + OpenAI Academy (from screenshot)
    ('course_ai_mattpocock_vercel_ai_sdk_v5', 'Vercel AI SDK v5 crash course', NULL, 'ai', NULL, 'https://www.youtube.com/watch?v=ihHLs6v7Lko', false, true),
    ('course_ai_mattpocock_mcp_fundamentals', 'Model Context Protocol (MCP) fundamentals', NULL, 'ai', NULL, 'https://www.aihero.dev/', false, true),
    ('course_ai_mattpocock_llm_fundamentals', 'LLM fundamentals for engineers', NULL, 'ai', NULL, 'https://www.aihero.dev/', false, true),
    ('course_ai_mattpocock_design_spec', 'Driving AI coding tools from a design spec', NULL, 'ai', NULL, 'https://www.youtube.com/@mattpocockuk/videos', false, true),
    ('course_sw_mattpocock_deeppartial', 'Advanced TypeScript: DeepPartial utility type', NULL, 'software', NULL, 'https://www.youtube.com/watch?v=AnziPAzTGts', false, true),
    ('course_sw_mattpocock_type_challenges', 'TypeScript Type Challenges walkthroughs', NULL, 'software', NULL, 'https://www.youtube.com/watch?v=ins_ZsvfVM0', false, true),
    ('course_sw_mattpocock_ts_channel', 'Whole TypeScript channel — wizard tips & releases', NULL, 'software', NULL, 'https://www.youtube.com/@mattpocockuk/videos', false, true),
    ('course_ai_openai_codex_beginners', 'Codex for beginners', NULL, 'ai', NULL, 'https://academy.openai.com/public/videos/codex-for-beginners-2026-04-22', false, true),
    ('course_ai_openai_chatgpt_fundamentals', 'ChatGPT fundamentals', NULL, 'ai', NULL, 'https://academy.openai.com/public/clubs/work-users-viqjucd/icons/chatgpt-basics', false, true),
    ('course_ai_openai_prompting', 'Prompting', NULL, 'ai', NULL, 'https://academy.openai.com/public/clubs/work-users-viqjucd/icons/prompting', false, true)
) AS v(id, title, description, category, duration, url, is_mandatory, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM "training_modules" m WHERE m."id" = v.id
);
