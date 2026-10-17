---
name: view
description: Open the Azimuth viewer, the live local web view of the project's features, specs, decisions, questions and agent activity.
allowed-tools:
  - Bash(azimuth *)
  - Bash(${CLAUDE_PLUGIN_ROOT}/bin/azimuth *)
---

# Open the viewer

Run `azimuth view --detach`. It reuses the running viewer for this project or starts one, and
prints its URL. Give the user the URL. Mention that the page updates live while agents work and
that a read-only snapshot can be saved with `azimuth export -o azimuth.html`.
