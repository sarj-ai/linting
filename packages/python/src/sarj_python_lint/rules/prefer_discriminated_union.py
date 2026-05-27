"""SARJ005: flag BaseModel with `success: bool` + Optional fields.

The anti-pattern:

    class Result(BaseModel):
        success: bool
        data: Optional[Data] = None
        error: Optional[str] = None

allows illegal states (success=True with data=None, or success=False with
data set). Use a discriminated union:

    class Success(BaseModel): data: Data
    class Failure(BaseModel): error: str
    Result = Union[Success, Failure]

References:
- https://docs.pydantic.dev/latest/concepts/unions/#discriminated-unions
- https://en.wikipedia.org/wiki/Tagged_union
"""

from __future__ import annotations

import ast
from pathlib import Path

from sarj_python_lint.rule_base import Diagnostic, Rule

STATUS_FIELDS = {"success", "ok", "is_success", "succeeded", "successful", "failed", "failure"}
IGNORED_OPTIONAL_FIELDS = {
    "metadata",
    "meta",
    "debug",
    "debug_logs",
    "extra",
    "log",
    "logs",
    "traceback",
    "request_id",
    "trace_id",
}


class PreferDiscriminatedUnion(Rule):
    """Pydantic BaseModel with success:bool — prefer a discriminated union."""

    id = "prefer-discriminated-union"
    code = "SARJ005"
    description = "BaseModel with `success: bool` + Optional siblings — use a discriminated union."

    def check(self, path: Path, source: str) -> list[Diagnostic]:
        try:
            tree = ast.parse(source, filename=str(path))
        except SyntaxError:
            return []
        diags: list[Diagnostic] = []
        for node in ast.walk(tree):
            if not isinstance(node, ast.ClassDef):
                continue
            if not _inherits_basemodel(node):
                continue
            has_status_bool = False
            optional_fields: list[str] = []
            for stmt in node.body:
                if not isinstance(stmt, ast.AnnAssign):
                    continue
                if not isinstance(stmt.target, ast.Name):
                    continue
                name = stmt.target.id
                ann_text = ast.unparse(stmt.annotation) if stmt.annotation else ""
                if name in STATUS_FIELDS and "bool" in ann_text:
                    has_status_bool = True
                if _is_optional(stmt.annotation):
                    if name not in IGNORED_OPTIONAL_FIELDS:
                        optional_fields.append(name)
            if has_status_bool and len(optional_fields) >= 2:
                diags.append( 
                    Diagnostic(
                        path=path,
                        line=node.lineno,
                        col=node.col_offset + 1,
                        code=self.code,
                        message=(
                            f"`{node.name}` has a bool status field plus "
                            f"Optional fields ({', '.join(optional_fields)}). "
                            "Model as `Union[Success, Failure]` to make illegal "
                            "states unrepresentable."
                        ),
                    )
                )
        return diags


def _inherits_basemodel(node: ast.ClassDef) -> bool:
    for base in node.bases:
        if isinstance(base, ast.Name) and base.id == "BaseModel":
            return True
        if isinstance(base, ast.Attribute) and base.attr == "BaseModel":
            return True
    return False


def _get_name_flat(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        val = _get_name_flat(node.value)
        if val:
            return f"{val}.{node.attr}"
    return ""


def _is_optional(node: ast.AST | None) -> bool:
    """Detect if an annotation represents an Optional type or Union with None."""
    if node is None:
        return False

    # If it's a string literal (forward ref), parse it and check the inner AST
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        try:
            parsed = ast.parse(node.value, mode="eval")
            return _is_optional(parsed.body)
        except SyntaxError:
            pass

    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.BitOr):
        return _is_optional(node.left) or _is_optional(node.right)

    if isinstance(node, ast.Subscript):
        name = _get_name_flat(node.value)
        if name == "Optional" or name.endswith(".Optional"):
            return True
        if name == "Union" or name.endswith(".Union"):
            slice_node = node.slice
            # Handle Python < 3.9 Index wrapper safely
            if type(slice_node).__name__ == "Index":
                slice_node = getattr(slice_node, "value", slice_node)
            if isinstance(slice_node, ast.Tuple):
                return any(_is_optional(elt) for elt in slice_node.elts)
            return _is_optional(slice_node)

    if isinstance(node, ast.Constant) and node.value is None:
        return True

    if isinstance(node, ast.Name) and node.id == "None":
        return True

    return False
