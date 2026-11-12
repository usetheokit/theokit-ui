---
"@theokit/ui": patch
---

The default tool registry parses the SDK's string tool results with the sdk-tools adapters (`shell_exec`, `git_diff`, `read_file`, `list_dir`, `apply_patch`) instead of showing raw JSON, and `defaultClassifyTool` matches exact names first and name hints only on word boundaries (`thread_summary` and `execute_sql` are no longer misclassified).
