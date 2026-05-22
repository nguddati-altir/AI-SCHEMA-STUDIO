from ..models import Schema, Column

PRISMA_TYPES = {
    "int": "Int",
    "bigint": "BigInt",
    "string": "String",
    "text": "String",
    "boolean": "Boolean",
    "float": "Float",
    "decimal": "Decimal",
    "date": "DateTime",
    "datetime": "DateTime",
    "json": "Json",
    "uuid": "String",
}


def _column_line(col: Column, provider: str) -> str:
    t = PRISMA_TYPES[col.type]
    optional = "?" if (col.nullable and not col.primary_key) else ""
    attrs: list[str] = []
    if col.primary_key:
        attrs.append("@id")
    if col.auto_increment:
        attrs.append("@default(autoincrement())")
    if col.unique and not col.primary_key:
        attrs.append("@unique")
    if col.type == "uuid" and provider == "postgresql":
        attrs.append("@db.Uuid")
    if col.type == "text":
        attrs.append("@db.Text")
    if col.type == "string" and col.length:
        attrs.append(f"@db.VarChar({col.length})")
    if col.type == "datetime":
        attrs.append("@db.Timestamp(6)" if provider == "postgresql" else "@db.DateTime(6)")
    if col.default and not col.auto_increment:
        attrs.append(f"@default({col.default})")
    suffix = (" " + " ".join(attrs)) if attrs else ""
    return f"  {col.name} {t}{optional}{suffix}"


def generate(schema: Schema, provider: str = "postgresql") -> str:
    out: list[str] = [
        "generator client {",
        '  provider = "prisma-client-js"',
        "}",
        "",
        "datasource db {",
        f'  provider = "{provider}"',
        '  url      = env("DATABASE_URL")',
        "}",
        "",
    ]

    # Forward and reverse relations
    forward: dict[str, list[tuple[str, str, str]]] = {}
    for t in schema.tables:
        for c in t.columns:
            if c.references:
                ref_t, _, ref_c = c.references.partition(".")
                if ref_t and ref_c:
                    forward.setdefault(t.name, []).append((c.name, ref_t, ref_c))

    for t in schema.tables:
        out.append(f"model {t.name} {{")
        for c in t.columns:
            out.append(_column_line(c, provider))
        # forward relation fields
        for col_name, ref_t, ref_c in forward.get(t.name, []):
            rel_field = f"{ref_t}_{col_name}"
            out.append(
                f"  {rel_field} {ref_t} @relation(\"{t.name}_{col_name}_to_{ref_t}\", fields: [{col_name}], references: [{ref_c}])"
            )
        # reverse relation fields
        for other_t, rels in forward.items():
            for col_name, ref_t, ref_c in rels:
                if ref_t == t.name and other_t != t.name:
                    out.append(
                        f"  {other_t}_{col_name}_list {other_t}[] @relation(\"{other_t}_{col_name}_to_{ref_t}\")"
                    )
        out.append("}")
        out.append("")

    return "\n".join(out)
