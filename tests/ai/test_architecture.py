import ast
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def test_business_apps_only_import_ai_services():
    violations = []
    for path in (PROJECT_ROOT / "apps").glob("*/**/*.py"):
        if "apps/ai/" in path.as_posix() or "/migrations/" in path.as_posix():
            continue
        tree = ast.parse(path.read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                names = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom):
                names = [node.module or ""]
            else:
                continue
            if any(name == "openai" or name.startswith("apps.ai.runtime") or name.startswith("apps.ai.models") for name in names):
                violations.append(str(path.relative_to(PROJECT_ROOT)))
    assert violations == []
