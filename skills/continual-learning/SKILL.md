---
name: continual-learning
description: Incrementally extract recurring user corrections/preferences and durable workspace facts from transcript changes, then route them into categorized .cursor/rules/*.mdc files. Use when the user asks to mine previous chats, maintain learned rules, or build a self-learning preference loop.
---

# Continual Learning

Extract recurring user corrections/preferences and durable workspace facts from conversation transcripts, and route them into the appropriate `.cursor/rules/*.mdc` file.

## Inputs

- Transcript root: `~/.cursor/projects/<workspace-slug>/agent-transcripts/`
- Rules directory: `.cursor/rules/`
- Incremental index: `.cursor/hooks/state/continual-learning-index.json`

## Workflow

1. **Scan existing rules** — Read every `.mdc` file under `.cursor/rules/` (including subdirectories). For each file, note its `description` frontmatter and the topics it covers.
2. **Load incremental index** if present.
3. **Discover transcripts** and process only:
   - new files not in index, or
   - files whose mtime is newer than indexed mtime.
4. **Extract high-signal items** — Look for recurring user corrections/preferences and durable workspace facts. Apply the inclusion bar below.
5. **Route each item** to the best-matching rule file:
   - Match by topic against existing `.mdc` files' descriptions and content.
   - If no file is a good fit, create a new `.mdc` in the appropriate subdirectory (see Rule File Layout).
6. **Merge into target file**:
   - Update matching bullets in place (don't duplicate).
   - Append net-new bullets under the most relevant section heading.
   - Deduplicate semantically similar bullets.
7. **Write back the incremental index**.

## Rule File Layout

Organize rules by package, matching the monorepo structure:

```
.cursor/rules/
├── dev-workflow.mdc              # alwaysApply: true — global habits
├── web/
│   ├── ui-development.mdc        # globs: packages/web/**/*.{vue,ts,scss}
│   ├── state-management.mdc      # globs: packages/web/src/stores/**
│   └── ...
├── server/
│   └── api-patterns.mdc          # globs: packages/server/**/*.ts
├── desktop/
│   └── electron-ipc-patterns.mdc # globs: packages/desktop/**/*.ts
└── sdk/
    └── opencode-sdk-reference.mdc # globs: packages/sdk/**, packages/web/src/context/**
```

### Creating a new rule file

When an item doesn't fit any existing file, create one following this template:

```markdown
---
description: <one-line summary — Agent uses this to decide relevance when no matching files are open>
globs: <glob pattern for auto-attach when matching files are in context>
alwaysApply: false
---

# <Title>

<bullets go here>
```

Cursor loads rules in four ways (in order of reliability):
1. **Always Apply** (`alwaysApply: true`) — every session, guaranteed
2. **Glob auto-attach** (`globs` set) — when matching files are in context
3. **Agent-decided** (`description` set, no globs) — Agent judges relevance from description
4. **Manual** (`@rule-name`) — only when user explicitly mentions

Best practice: **always set both `description` AND `globs`**. This gives you glob-based auto-attach as the primary trigger, with description as a fallback so Agent can still pick up the rule when discussing related topics without opening specific files.

- Set `alwaysApply: true` only for cross-cutting workflow rules.
- Set `globs` to the narrowest pattern that covers the relevant source files.
- Place the file in the subdirectory matching the monorepo package (`web/`, `server/`, `desktop/`, `sdk/`). If it spans multiple packages, put it at the rules root.

## Inclusion Bar

Keep an item only if **all** are true:

- Non-obvious: not in official docs or standard language/framework behavior
- Actionable: directly usable in future sessions
- Durable: stable across sessions, not tied to a specific branch or commit
- Repeated or explicit: appeared in multiple transcripts, or user explicitly stated it as a broad rule
- Non-sensitive: no secrets, tokens, credentials, or private personal data

### What qualifies

- API quirks, tool limitations, framework traps discovered by trial and error
- Problems that took multiple attempts to solve
- Upstream code paths that differ from what the surface API suggests
- Design principles agreed upon after discussion and correction
- Gotchas likely to recur during future maintenance

### What does NOT qualify

- Facts already obvious from official documentation
- Standard language/framework behavior
- Content already present in an existing rule file (avoid redundancy)
- One-off task instructions or transient details (branch names, commit hashes, temporary errors)

## Exclusions

Never store:

- secrets, tokens, credentials, private personal data
- one-off task instructions
- transient details (branch names, commit hashes, temporary errors)

## Incremental Index Format

```json
{
  "version": 1,
  "transcripts": {
    "/abs/path/to/file.jsonl": {
      "mtimeMs": 1730000000000,
      "lastProcessedAt": "2026-02-18T12:00:00.000Z"
    }
  }
}
```
