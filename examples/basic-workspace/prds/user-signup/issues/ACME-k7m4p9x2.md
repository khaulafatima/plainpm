---
schema_version: "plainpm/v1"
kind: issue
id: "ACME-k7m4p9x2"
short_id: "ACME-1"
external_links:
  - provider: github
    external_id: "123"
    url: "https://github.com/owner/repo/issues/123"
title: "Create registration form component with client-side validation"
status: agent_in_progress
type: task
priority: high
rank: "mmmmmm"
parent:
  prd: "PRD-r8n3v6w5"
assignee: "agent:example"
reporter: dan
branch: "feat/ACME-k7m4p9x2-registration-form"
claim:
  session_id: "example-session-1"
  claimed_at: "2026-09-27T20:15:00Z"
labels: [frontend, onboarding]
dates:
  created_at: "2026-09-27T20:00:00Z"
  updated_at: "2026-09-27T21:15:00Z"
links:
  blocked_by: []
  relates_to: []
acceptance_criteria:
  - id: ac-1
    text: "Required fields display accessible validation errors."
    done: false
    verify: manual
  - id: ac-2
    text: "Submit button shows a loading state while the request is pending."
    done: false
    verify: manual
---

# Create registration form

## Description

Build a registration form collecting full name, work email, and password.
This is illustrative project data, not a task implemented in PlainPM itself.

## Implementation notes

Reuse the application form components and shared validation helpers.
Test through the form's public inputs and submit callback.

## Test strategy

Check required-field validation, keyboard navigation, screen-reader feedback,
and the loading state while a submission is pending. Ask a human to verify
these manual criteria before marking them complete.

## Agent context

The example session has started the form scaffold. Validation and loading
behavior remain unverified. Ownership remains with the session in `claim`;
a handoff does not release it.

## Comments

<!-- plainpm:comments -->

<!-- plainpm:comment COMMENT-c3f7s8u2 -->
Author: dan
Created-at: 2026-09-27T20:30:00Z

Please verify that initial focus is placed on the full-name input.
<!-- plainpm:end-comment -->

<!-- plainpm:comment COMMENT-d5g9v4z6 -->
Author: agent:example
Created-at: 2026-09-27T21:15:00Z

Form scaffolding has started. Acceptance criteria still need verification.
<!-- plainpm:end-comment -->
