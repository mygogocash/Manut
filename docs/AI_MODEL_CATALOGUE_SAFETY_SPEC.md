# Executive Summary

Keep the Manut AI chat model picker limited to stable, Vertex-backed models that are safe to recommend today.

# Business Goals

- Reduce user confusion from model options that may fail at send time.
- Keep the default AI chat path reliable for production users.

# Technical Goals

- Remove unverified preview/default-version model IDs from `Chat With Manut AI`.
- Preserve stable Gemini, Claude, and Llama Vertex choices.
- Guard the prompt catalogue with eval coverage.

# Requirements

- `gemini-2.5-flash` remains the default model.
- `gemini-2.5-flash`, `gemini-2.5-pro`, and `claude-sonnet-4-5@20250929` remain available.
- Unverified picker entries are not exposed until authenticated production smoke confirms them.

# Non-Goals

- Do not remove provider implementations.
- Do not change provider routing, pricing metadata, or Vertex config.
- Do not run production chat messages without an authenticated session.

# Architecture

The chat picker reads `optionalModels` from the backend prompt metadata for `Chat With Manut AI`. Provider classes can keep broader catalogues, but the user-facing prompt catalogue should stay conservative.

# Data Models

No database schema changes.

# API Contracts

GraphQL `currentUser.copilot.models(promptName)` keeps the same shape. Only the returned model list changes.

# Security

No new secrets or auth scopes. This change avoids exposing unverified providers to users.

# Edge Cases

- Existing sessions that request a removed model fall back to the prompt default through session model normalization.
- Direct provider implementations remain available for future rollout once config and quota are verified.

# Testing Strategy

- Extend prompt eval forbidden-model checks.
- Run focused backend prompt eval.
- Run TypeScript syntax/type-adjacent checks where practical.

# Rollback Plan

Revert the prompt catalogue and eval fixture changes to restore the broader picker.

# Milestones

- Milestone 1: Add RED eval for unsafe picker entries.
- Milestone 2: Remove unsafe entries from chat optional models.
- Milestone 3: Update docs and verify.

# Epics

- Epic 1: Production-safe AI model picker.

# User Stories

As a Manut user, I want the model picker to show models that are expected to work, so that choosing a model does not silently break chat.

# Tasks

- Add forbidden optional model eval entries.
- Trim `CHAT_PROMPT.optionalModels`.
- Update project handover wording.
- Run focused verification.

# Acceptance Criteria

- Prompt eval passes.
- `Chat With Manut AI` exposes only stable recommended models.
- Docs no longer claim preview/default-version models are ready for production use.
