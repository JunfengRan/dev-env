# Continual Learning

Automatically and incrementally keeps categorized `.cursor/rules/*.mdc` files up to date from transcript changes.

The plugin combines:

- A `stop` hook that decides when to trigger learning.
- A `continual-learning` skill that mines only high-signal transcript deltas.

It is designed to avoid noisy rewrites by:

- Reading existing `.cursor/rules/*.mdc` files first and updating matching bullets in place.
- Processing only new or changed transcript files.
- Routing durable preferences and workspace facts to the narrowest matching rule.

## Installation

Install `continual-learning-rules` from this repository's Cursor marketplace,
or copy this plugin directory into the Cursor user plugin directory.

## How it works

On eligible `stop` events, the hook may emit a `followup_message` that asks the agent to run the `continual-learning` skill.

The hook keeps local runtime state in:

- `.cursor/hooks/state/continual-learning.json` (cadence state)

The skill uses an incremental transcript index at:

- `.cursor/hooks/state/continual-learning-index.json`

## Trigger cadence

Default cadence:

- minimum 10 completed turns
- minimum 120 minutes since the last run
- transcript mtime must advance since the previous run

Trial mode defaults (enabled in this plugin hook config):

- minimum 3 completed turns
- minimum 15 minutes
- automatically expires after 24 hours, then falls back to default cadence

## Optional env overrides

- `CONTINUAL_LEARNING_MIN_TURNS` (or legacy `CONTINUOUS_LEARNING_MIN_TURNS`)
- `CONTINUAL_LEARNING_MIN_MINUTES` (or legacy `CONTINUOUS_LEARNING_MIN_MINUTES`)
- `CONTINUAL_LEARNING_TRIAL_MODE` (or legacy `CONTINUOUS_LEARNING_TRIAL_MODE`)
- `CONTINUAL_LEARNING_TRIAL_MIN_TURNS` (or legacy `CONTINUOUS_LEARNING_TRIAL_MIN_TURNS`)
- `CONTINUAL_LEARNING_TRIAL_MIN_MINUTES` (or legacy `CONTINUOUS_LEARNING_TRIAL_MIN_MINUTES`)
- `CONTINUAL_LEARNING_TRIAL_DURATION_MINUTES` (or legacy `CONTINUOUS_LEARNING_TRIAL_DURATION_MINUTES`)

## Relationship to deep-research

- **continual-learning**: mines user preferences from transcripts → `.cursor/rules/*.mdc`
- **deep-research-gates**: validates research phase artifacts → `.research/<run-id>/`

They are orthogonal: preferences vs. research process compliance.

## Output format in Cursor rules

The skill updates matching `.cursor/rules/*.mdc` files in place. When no
existing rule is suitable, it creates a focused rule with `description`,
`globs`, and `alwaysApply` frontmatter. It never writes secrets or transient
branch/session details.

## License

MIT
