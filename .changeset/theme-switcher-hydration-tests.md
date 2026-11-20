---
"@theokit/ui": patch
---

`ThemeSwitcher` hydration is now covered by tests where the server and client resolve different modes: the live region renders empty on the server, the server markup survives hydration without an error, and the announcement updates after mount and after a mode toggle.
