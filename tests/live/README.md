# Live-bundle regression scripts

These tests exercise extracted code from a matching installed VS Code build. They are not an all-version CI suite. Client tests take `VSCODE_WORKBENCH_BUNDLE`; the working-folder test takes `VSCODE_SESSIONS_BUNDLE`. Agent-host tests use Docker volume `vscode`, Linux ARM64, and build a44adf7f53e00964ab890f9f8758a334f1fc15bc by default; override `VSCODE_COMMIT` if testing another compatible build. Run agent tests from WSL.

Imports now resolve to the root patcher. Paths used in pure fixtures are examples. These archived behavioural checks are included for reproducibility; packaging validation reports separately which tests were actually run.
