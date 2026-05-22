from __future__ import annotations
import json
import os
from typing import Literal, Optional
from openai import OpenAI
from pydantic import BaseModel, Field, ValidationError

from .models import Column, ColumnType, Schema, Table


MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
BASE_URL = "https://api.groq.com/openai/v1"


SUGGEST_SYSTEM = """You are a database schema designer. Suggest table columns based on a natural-language description of an entity.

Constraints:
- Target a relational database (MySQL or Postgres). Pick the best fit from this type set:
  int, bigint, string, text, boolean, float, decimal, date, datetime, json, uuid.
- Use `json` for nested or variable-shape attributes (maps to JSONB on Postgres, JSON on MySQL).
- Use `string` for short text (set `length`, default 255); `text` for long unbounded text.
- Use `decimal` for money (precision=12, scale=2 by default).
- Use `datetime` with default CURRENT_TIMESTAMP for created_at / updated_at columns.
- Include an `id` primary key (int, auto_increment, not nullable) unless the user explicitly says otherwise.
- Foreign keys: set `references` to "table.column" (e.g. "users.id"). Only use FKs the user clearly implies; do not invent foreign tables.
- Column names: snake_case, no spaces.
- Do NOT invent columns the user hasn't implied. Stay tight to the description.
- If the user provides existing columns, return ONLY new columns to ADD (do not repeat existing ones), unless they ask to redesign from scratch.

You MUST respond with ONLY valid JSON matching this exact shape (no prose, no markdown fences):
{
  "columns": [
    {
      "name": "snake_case_name",
      "type": "int|bigint|string|text|boolean|float|decimal|date|datetime|json|uuid",
      "nullable": true,
      "primary_key": false,
      "unique": false,
      "auto_increment": false,
      "default": null,
      "length": null,
      "precision": null,
      "scale": null,
      "references": null,
      "reason": "one short phrase: why this column"
    }
  ],
  "rationale": "one or two sentences summarizing the design choices"
}"""


DICTIONARY_SYSTEM = """You are a database documentation writer. Given a database schema, write clear, concise descriptions for each table and each column.

Rules:
- Table descriptions: one sentence describing what entity the table represents.
- Column descriptions: one sentence describing what the column stores, including units or format where useful (e.g. "Email address, lowercased", "Created timestamp in UTC", "Price in cents").
- For foreign keys, explicitly say "References <table>".
- For JSON columns, hint at the expected shape if obvious from the column name.
- Do NOT invent business rules the schema doesn't imply.
- Keep descriptions under ~120 characters each.

You MUST respond with ONLY valid JSON (no prose, no markdown fences) matching this shape:
{
  "tables": [
    {
      "name": "table_name",
      "description": "one sentence about the table",
      "columns": [
        {"name": "column_name", "description": "one sentence about the column"}
      ]
    }
  ]
}

Include EVERY table and EVERY column from the input schema. Use the exact names provided."""


class SuggestedColumn(BaseModel):
    name: str
    type: ColumnType
    nullable: bool = True
    primary_key: bool = False
    unique: bool = False
    auto_increment: bool = False
    default: Optional[str] = None
    length: Optional[int] = None
    precision: Optional[int] = None
    scale: Optional[int] = None
    references: Optional[str] = None
    reason: Optional[str] = None


class SuggestionResult(BaseModel):
    columns: list[SuggestedColumn] = Field(default_factory=list)
    rationale: str = ""


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class DictColumn(BaseModel):
    name: str
    description: str = ""


class DictTable(BaseModel):
    name: str
    description: str = ""
    columns: list[DictColumn] = Field(default_factory=list)


class DictionaryResult(BaseModel):
    tables: list[DictTable] = Field(default_factory=list)


def _api_key_or_raise() -> str:
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Get a free key at https://console.groq.com/keys, "
            "then add it to the backend environment: "
            "$env:GROQ_API_KEY = 'gsk_...' and restart uvicorn."
        )
    return key


def _client() -> OpenAI:
    return OpenAI(api_key=_api_key_or_raise(), base_url=BASE_URL)


def _strip_fences(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        # remove leading ```json or ```
        t = t.split("\n", 1)[1] if "\n" in t else t[3:]
        if t.endswith("```"):
            t = t[: -3]
    return t.strip()


def _build_suggest_user_turn(
    description: str,
    existing_columns: list[Column] | None,
    table_name: str | None,
) -> str:
    parts: list[str] = []
    if table_name:
        parts.append(f"Table name: {table_name}")
    parts.append(f"Description: {description}")
    if existing_columns:
        listing = "\n".join(
            f"  - {c.name}: {c.type}"
            + (f" (length={c.length})" if c.length else "")
            + (" PK" if c.primary_key else "")
            + (" UNIQUE" if c.unique else "")
            + (" NOT NULL" if not c.nullable else "")
            + (f" -> {c.references}" if c.references else "")
            for c in existing_columns
        )
        parts.append(f"Existing columns (do not repeat — suggest additions only):\n{listing}")
    return "\n\n".join(parts)


def suggest_columns(
    description: str,
    existing_columns: list[Column] | None = None,
    table_name: str | None = None,
    history: list[ChatMessage] | None = None,
) -> tuple[SuggestionResult, list[ChatMessage]]:
    """Ask the model to suggest columns. Returns (result, updated_history)."""
    client = _client()

    messages: list[dict] = [{"role": "system", "content": SUGGEST_SYSTEM}]
    for h in history or []:
        messages.append({"role": h.role, "content": h.content})

    user_turn = _build_suggest_user_turn(description, existing_columns, table_name)
    messages.append({"role": "user", "content": user_turn})

    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        response_format={"type": "json_object"},
        max_tokens=4000,
        temperature=0.2,
    )
    text = response.choices[0].message.content or ""
    raw = _strip_fences(text)
    try:
        result = SuggestionResult.model_validate(json.loads(raw))
    except (json.JSONDecodeError, ValidationError) as e:
        raise RuntimeError(f"Model did not return valid structured output: {e}. Raw: {raw[:400]}")

    updated_history = list(history or []) + [
        ChatMessage(role="user", content=user_turn),
        ChatMessage(role="assistant", content=result.model_dump_json()),
    ]
    return result, updated_history


def _schema_to_prompt(schema: Schema, only_table: Optional[str] = None) -> str:
    """Compact text representation of the schema for the dictionary prompt."""
    lines: list[str] = [f"Schema: {schema.name}", ""]
    for t in schema.tables:
        if only_table and t.name != only_table:
            continue
        lines.append(f"Table: {t.name}")
        for c in t.columns:
            attrs: list[str] = [c.type]
            if c.length:
                attrs.append(f"len={c.length}")
            if c.primary_key:
                attrs.append("PK")
            if c.unique:
                attrs.append("UNIQUE")
            if c.auto_increment:
                attrs.append("AI")
            if not c.nullable:
                attrs.append("NOT NULL")
            if c.references:
                attrs.append(f"FK->{c.references}")
            if c.default:
                attrs.append(f"default={c.default}")
            lines.append(f"  - {c.name} ({', '.join(attrs)})")
        lines.append("")
    return "\n".join(lines)


def generate_dictionary(
    schema: Schema, only_table: Optional[str] = None
) -> DictionaryResult:
    """Generate descriptions for every table & column (or just one table)."""
    client = _client()
    user_turn = _schema_to_prompt(schema, only_table=only_table)
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": DICTIONARY_SYSTEM},
            {"role": "user", "content": user_turn},
        ],
        response_format={"type": "json_object"},
        max_tokens=4000,
        temperature=0.1,
    )
    text = response.choices[0].message.content or ""
    raw = _strip_fences(text)
    try:
        return DictionaryResult.model_validate(json.loads(raw))
    except (json.JSONDecodeError, ValidationError) as e:
        raise RuntimeError(f"Model did not return valid dictionary output: {e}. Raw: {raw[:400]}")
