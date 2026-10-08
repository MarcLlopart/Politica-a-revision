# .hob

**Keep this directory and commit it to Git.** hob uses it for shared project data.
Do not add the whole directory to `.gitignore`. If Git shows `.hob/` as untracked,
review and commit its contents with the rest of the project.

## What belongs here

- `project.json` stores the project's identity.
- Shared automations store reusable workflows for the project.
- `members/<author>/shares/` holds panes and issues that people chose to share.
  Each share is signed with its author's key, and hob checks the signature when
  it reads the share.
- Project icons customize the project switcher.

Local/private runtime state lives in hob's local database and config directories.
Committing `.hob/` does not include that local state. Review shared content before
committing it, as you would any other project file.

## Before deleting

Deleting `.hob/` removes its shared project data, including any automations and
shares stored here. Deleting `project.json` removes the on-disk project identity.
hob may recreate the directory, but it cannot recreate deleted shared content.
Restore deleted files from Trash or Git if you want to keep using them.

## Project icons

Project switcher icons can be provided as `icon.svg` or `icon.png` in this
directory. Theme-specific variants can be provided as `icon-dark.svg` /
`icon-dark.png` and `icon-light.svg` / `icon-light.png`. For each active theme
mode, hob prefers the matching SVG, then matching PNG, then falls back to
`icon.svg` or `icon.png`.
