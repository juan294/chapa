#!/usr/bin/env python3
"""
Analyzer for scripts/check-craft-propagation.sh.

Reads grep --H -n -E 'computeImpactV6\\s*\\(' output from the env var
CRAFT_GUARD_INPUT (one match per line, formatted as "<file>:<line>:<content>").
Receives an optional allowlist of file paths as positional arguments — call
sites in those files are not reported even if they pass only one argument.

Prints offending "<file>:<line> computeImpactV6(<args>)" lines to stdout and
exits 0. The shell wrapper interprets non-empty stdout as a failure.
"""

from __future__ import annotations

import os
import re
import sys


def has_top_level_comma(arg_text: str) -> bool:
    """True when arg_text contains a comma outside any nested () / [] / {} /
    string / template literal — i.e., a real second positional argument."""
    depth = 0
    in_single = in_double = in_template = False
    for i, ch in enumerate(arg_text):
        prev = arg_text[i - 1] if i > 0 else ""
        if in_single:
            if ch == "'" and prev != "\\":
                in_single = False
            continue
        if in_double:
            if ch == '"' and prev != "\\":
                in_double = False
            continue
        if in_template:
            if ch == "`" and prev != "\\":
                in_template = False
            continue
        if ch == "'":
            in_single = True
            continue
        if ch == '"':
            in_double = True
            continue
        if ch == "`":
            in_template = True
            continue
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        elif ch == "," and depth == 0:
            return True
    return False


def extract_args(content: str, open_idx: int) -> str | None:
    """Walk forward from open_idx (position of "(") to the matching ")",
    accounting for nested parens, strings, and template literals. Returns
    the argument-list text without the surrounding parens, or None when the
    expression doesn't terminate on this line (multi-line call)."""
    depth = 1
    in_single = in_double = in_template = False
    out: list[str] = []
    for i in range(open_idx + 1, len(content)):
        ch = content[i]
        prev = content[i - 1] if i > 0 else ""
        if in_single:
            if ch == "'" and prev != "\\":
                in_single = False
            out.append(ch)
            continue
        if in_double:
            if ch == '"' and prev != "\\":
                in_double = False
            out.append(ch)
            continue
        if in_template:
            if ch == "`" and prev != "\\":
                in_template = False
            out.append(ch)
            continue
        if ch == "'":
            in_single = True
            out.append(ch)
            continue
        if ch == '"':
            in_double = True
            out.append(ch)
            continue
        if ch == "`":
            in_template = True
            out.append(ch)
            continue
        if ch == "(":
            depth += 1
            out.append(ch)
            continue
        if ch == ")":
            depth -= 1
            if depth == 0:
                return "".join(out)
            out.append(ch)
            continue
        out.append(ch)
    return None


def main() -> int:
    allowed = set(sys.argv[1:])
    raw = os.environ.get("CRAFT_GUARD_INPUT", "")
    offenders: list[str] = []

    for line in raw.splitlines():
        if not line:
            continue
        # grep -H format: <file>:<lineno>:<content>
        parts = line.split(":", 2)
        if len(parts) < 3:
            continue
        fpath, lineno, content = parts

        # Skip test files — they're allowed to call however they want.
        if re.search(r"\.test\.(ts|tsx)$", fpath):
            continue
        # Skip the function declaration itself.
        if re.search(r"\b(?:export\s+)?function\s+computeImpactV6\b", content):
            continue
        # Skip imports and bare references.
        if re.search(r"\bimport\b.*\bcomputeImpactV6\b", content):
            continue

        m = re.search(r"\bcomputeImpactV6\s*\(", content)
        if not m:
            continue

        open_idx = m.end() - 1
        arg_text = extract_args(content, open_idx)
        if arg_text is None:
            # Multi-line call — the line-by-line shell scan can't decide.
            # Defer to the vitest-side test (which sees the whole file)
            # rather than emit a false positive here.
            continue
        if has_top_level_comma(arg_text):
            continue
        if fpath in allowed:
            continue
        offenders.append(f"{fpath}:{lineno} computeImpactV6({arg_text.strip()})")

    if offenders:
        print("\n".join(offenders))
    return 0


if __name__ == "__main__":
    sys.exit(main())
