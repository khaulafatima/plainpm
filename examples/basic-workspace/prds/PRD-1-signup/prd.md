---
schema_version: "plainpm/v1"
kind: prd

meta:
  id: "PRD-1"
  name: "User Signup Flow"
  seq: 1
  status: in_progress
  owner: "dan"

defaults:
  labels:
    - onboarding
    - auth

execution_order:
  - id: "PRD-1-001"
    title: "Registration form component"
    blocked_by: []
  - id: "PRD-1-002"
    title: "Email verification flow"
    blocked_by: ["PRD-1-001"]
  - id: "PRD-1-003"
    title: "Profile completion wizard"
    blocked_by: ["PRD-1-002"]
---

# User Signup Flow

## Summary

A seamless 2-step onboarding flow enabling new users to authenticate with email or OAuth2
and complete their profile.

## Deliverables

- Registration form with email + password and Google OAuth2
- Email verification flow with magic link
- Profile completion wizard (name, avatar, preferences)

## Open Questions

- Should we support Apple Sign-in in v1 or defer to v2?
