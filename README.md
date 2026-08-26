# Git SHA Graph

Click a commit SHA in the Cursor terminal to open that commit in **Source Control** — the GRAPH sidebar and the commit tab with the diff.

This is a local extension. It does not depend on GitLens or other marketplace extensions. It opens Cursor's built-in Source Control views.

## Use

1. Reload the window after installing (`Developer: Reload Window`).
2. Run `git log` (or any command that prints SHAs) in the terminal.
3. Click a SHA. Source Control opens and the commit is shown.

Command Palette: **Git SHA Graph: Open Commit in Source Control**.

GitLens also linkifies SHAs. If a click opens GitLens instead, turn off `gitlens.terminalLinks.enabled`.

## Install

```bash
rm -rf ~/.cursor/extensions/local.git-sha-graph-0.1.0
cp -R .vscode/extensions/git-sha-graph ~/.cursor/extensions/local.git-sha-graph-0.1.0
```

Then reload the window.
