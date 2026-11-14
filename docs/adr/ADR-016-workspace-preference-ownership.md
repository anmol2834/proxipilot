# ADR-016: Workspace Preference Ownership

## Status
Accepted

## Context
Step 4 of the onboarding wizard configures operational parameters including timezone, default AI response style, and language. We had to determine whether these preferences are scoped to the individual `User` or the `Organization`.

## Decision
We applied the core preference rule:
> *"Would this value be different for two users inside the same organization?"*

- `timezone`: Primarily represents the business operating timezone for organization SLAs, email campaign dispatch hours, automated lead response windows, and audit logs. Therefore, it is stored at the `Organization` level in `workspace_preferences`.
- `response_style`: Represents the public-facing brand voice (e.g. Professional, Friendly, Concise, Executive) of ProxiPilot when generating automated replies on behalf of the company. Therefore, it is stored at the `Organization` level.
- `language`: Represents default customer interaction language for email responses.

Personal user preferences (such as dashboard dark mode or personal alert settings) will reside in a future `user_preferences` table.

## Consequences
- Clean separation between tenant-wide operational settings and individual user UI preferences.
- Automated workers and AI processors pull tone and timezone from `WorkspacePreferences` by tenant ID without needing to guess which user initiated the background task.
