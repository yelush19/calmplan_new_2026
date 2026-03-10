# QUARANTINE — Monday.com Legacy Data

These files contain **stale historical data** from Monday.com imports.

**DO NOT** import or reference these files anywhere in the codebase.

The **Single Source of Truth (SSoT)** for CalmPlan is:
- `src/config/serviceWeights.js` — Service durations + cognitive load
- `src/config/automationRules.js` — Automation rules + due dates
- `src/config/taxCalendar2026.js` — Tax calendar + 874 logic
- `src/config/processTemplates.js` — Process step templates

Quarantined on: 2026-03-06
Reason: Monday data caused "digital dementia" — stale durations, wrong client names, obsolete service configs.
