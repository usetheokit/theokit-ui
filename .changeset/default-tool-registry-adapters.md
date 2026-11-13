---
"@theokit/ui": patch
---

The default tool registry renders the string results of `shell_exec`, `git_diff`, `read_file`, `list_dir` and `apply_patch` through the sdk-tools adapters instead of raw JSON, and `defaultClassifyTool` matches exact names and whole-word hints, so `thread_summary` and `execute_sql` are no longer misclassified.
