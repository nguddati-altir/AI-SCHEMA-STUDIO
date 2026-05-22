from ..models import Schema, Table, Column

PG_TYPES = {
    "int": "INTEGER",
    "bigint": "BIGINT",
    "string": "VARCHAR",
    "text": "TEXT",
    "boolean": "BOOLEAN",
    "float": "DOUBLE PRECISION",
    "decimal": "NUMERIC",
    "date": "DATE",
    "datetime": "TIMESTAMP",
    "json": "JSONB",
    "uuid": "UUID",
}

MY_TYPES = {
    "int": "INT",
    "bigint": "BIGINT",
    "string": "VARCHAR",
    "text": "TEXT",
    "boolean": "TINYINT(1)",
    "float": "DOUBLE",
    "decimal": "DECIMAL",
    "date": "DATE",
    "datetime": "DATETIME",
    "json": "JSON",
    "uuid": "CHAR(36)",
}


def _quote(name: str, dialect: str) -> str:
    return f'"{name}"' if dialect == "postgres" else f"`{name}`"


def _col_type(col: Column, dialect: str) -> str:
    types = PG_TYPES if dialect == "postgres" else MY_TYPES
    base = types[col.type]
    if col.type == "string":
        base += f"({col.length or 255})"
    elif col.type == "decimal":
        base += f"({col.precision or 10},{col.scale or 2})"
    return base


def _column_def(col: Column, dialect: str) -> str:
    qi = lambda n: _quote(n, dialect)
    type_str = _col_type(col, dialect)

    # Auto-increment translation
    if col.primary_key and col.auto_increment:
        if dialect == "postgres":
            type_str = "BIGSERIAL" if col.type == "bigint" else "SERIAL"
            ai_suffix = ""
        else:
            ai_suffix = " AUTO_INCREMENT"
    else:
        ai_suffix = ""

    parts = [qi(col.name), type_str + ai_suffix]
    if not col.nullable or col.primary_key:
        parts.append("NOT NULL")
    if col.unique and not col.primary_key:
        parts.append("UNIQUE")
    if col.default not in (None, ""):
        parts.append(f"DEFAULT {col.default}")
    return " ".join(parts)


def _sql_str(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def _column_def_with_inline_comment(col: Column, dialect: str) -> str:
    base = _column_def(col, dialect)
    if dialect == "mysql" and col.description:
        base += f" COMMENT {_sql_str(col.description)}"
    return base


def _table_ddl(table: Table, dialect: str) -> str:
    qi = lambda n: _quote(n, dialect)
    lines = [_column_def_with_inline_comment(c, dialect) for c in table.columns]
    pks = [c.name for c in table.columns if c.primary_key]
    if pks:
        lines.append(f"PRIMARY KEY ({', '.join(qi(p) for p in pks)})")
    for c in table.columns:
        if c.references:
            ref_table, _, ref_col = c.references.partition(".")
            if ref_table and ref_col:
                lines.append(
                    f"FOREIGN KEY ({qi(c.name)}) REFERENCES {qi(ref_table)}({qi(ref_col)})"
                )
    body = ",\n  ".join(lines)

    if dialect == "mysql":
        suffix = " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        if table.description:
            suffix += f" COMMENT={_sql_str(table.description)}"
        return f"CREATE TABLE {qi(table.name)} (\n  {body}\n){suffix};"

    # Postgres: COMMENT ON ... statements come after the table
    create = f"CREATE TABLE {qi(table.name)} (\n  {body}\n);"
    comments: list[str] = []
    if table.description:
        comments.append(f"COMMENT ON TABLE {qi(table.name)} IS {_sql_str(table.description)};")
    for c in table.columns:
        if c.description:
            comments.append(
                f"COMMENT ON COLUMN {qi(table.name)}.{qi(c.name)} IS {_sql_str(c.description)};"
            )
    if comments:
        return create + "\n" + "\n".join(comments)
    return create


def generate(schema: Schema, dialect: str) -> str:
    header = f"-- Schema: {schema.name}\n-- Dialect: {dialect}\n"
    return header + "\n\n".join(_table_ddl(t, dialect) for t in schema.tables) + "\n"
