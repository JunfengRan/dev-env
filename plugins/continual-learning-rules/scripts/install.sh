#!/usr/bin/env bash
set -euo pipefail

command -v python3 >/dev/null || { echo "python3 required"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN_NAME="continual-learning-rules"
PLUGIN_ID="${PLUGIN_NAME}@local"
TARGET="$HOME/.cursor/plugins/$PLUGIN_NAME"
CLAUDE_PLUGINS="$HOME/.claude/plugins/installed_plugins.json"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"

# 1. Copy plugin files to ~/.cursor/plugins/
rm -rf "$TARGET"
mkdir -p "$TARGET"
for dir in .cursor-plugin hooks skills assets; do
  [[ -d "$PLUGIN_ROOT/$dir" ]] && cp -R "$PLUGIN_ROOT/$dir" "$TARGET/"
done
[[ -f "$PLUGIN_ROOT/LICENSE" ]] && cp "$PLUGIN_ROOT/LICENSE" "$TARGET/"

echo "Copied plugin to $TARGET"

# 2. Register in ~/.claude/plugins/installed_plugins.json
mkdir -p "$(dirname "$CLAUDE_PLUGINS")"
python3 - "$CLAUDE_PLUGINS" "$PLUGIN_ID" "$TARGET" <<'PY'
import json, os, sys
path, pid, ipath = sys.argv[1], sys.argv[2], sys.argv[3]
data = {}
if os.path.exists(path):
    try: data = json.load(open(path))
    except: data = {}
plugins = data.get("plugins", {})
entries = [e for e in plugins.get(pid, [])
           if not (isinstance(e, dict) and e.get("scope") == "user")]
entries.insert(0, {"scope": "user", "installPath": ipath})
plugins[pid] = entries
data["plugins"] = plugins
os.makedirs(os.path.dirname(path), exist_ok=True)
json.dump(data, open(path, "w"), indent=2)
print(f"Registered {pid} in {path}")
PY

# 3. Enable in ~/.claude/settings.json
mkdir -p "$(dirname "$CLAUDE_SETTINGS")"
python3 - "$CLAUDE_SETTINGS" "$PLUGIN_ID" <<'PY'
import json, os, sys
path, pid = sys.argv[1], sys.argv[2]
data = {}
if os.path.exists(path):
    try: data = json.load(open(path))
    except: data = {}
data.setdefault("enabledPlugins", {})[pid] = True
os.makedirs(os.path.dirname(path), exist_ok=True)
json.dump(data, open(path, "w"), indent=2)
print(f"Enabled {pid} in {path}")
PY

echo ""
echo "Done. Please restart Cursor to apply changes."
