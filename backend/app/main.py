from __future__ import annotations
import json
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ValidationError

from .models import Schema, Column
from .generators import sql as sql_gen
from .generators import prisma as prisma_gen
from . import excel as excel_mod
from . import ai as ai_mod

app = FastAPI(title="Schema Designer", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/generate/sql")
def generate_sql(schema: Schema, dialect: str = "postgres") -> dict:
    if dialect not in {"postgres", "mysql"}:
        raise HTTPException(400, "dialect must be 'postgres' or 'mysql'")
    return {"sql": sql_gen.generate(schema, dialect)}


@app.post("/generate/prisma")
def generate_prisma(schema: Schema, provider: str = "postgresql") -> dict:
    if provider not in {"postgresql", "mysql"}:
        raise HTTPException(400, "provider must be 'postgresql' or 'mysql'")
    return {"prisma": prisma_gen.generate(schema, provider)}


def _parse_schema(schema_json: str) -> Schema:
    try:
        return Schema.model_validate(json.loads(schema_json))
    except (json.JSONDecodeError, ValidationError) as e:
        raise HTTPException(400, f"Invalid schema JSON: {e}")


@app.post("/excel/validate")
async def excel_validate(
    schema_json: str = Form(...),
    file: UploadFile = File(...),
) -> dict:
    schema = _parse_schema(schema_json)
    contents = await file.read()
    return excel_mod.validate(schema, contents)


@app.post("/excel/inserts")
async def excel_inserts(
    schema_json: str = Form(...),
    dialect: str = Form("postgres"),
    file: UploadFile = File(...),
) -> dict:
    if dialect not in {"postgres", "mysql"}:
        raise HTTPException(400, "dialect must be 'postgres' or 'mysql'")
    schema = _parse_schema(schema_json)
    contents = await file.read()
    return {"sql": excel_mod.generate_inserts(schema, contents, dialect)}


class SuggestRequest(BaseModel):
    description: str
    table_name: str | None = None
    existing_columns: list[Column] = []
    history: list[ai_mod.ChatMessage] = []


@app.post("/ai/suggest-columns")
def ai_suggest_columns(req: SuggestRequest) -> dict:
    if not req.description.strip():
        raise HTTPException(400, "description is required")
    try:
        result, history = ai_mod.suggest_columns(
            description=req.description,
            existing_columns=req.existing_columns or None,
            table_name=req.table_name,
            history=req.history or None,
        )
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(500, f"AI request failed: {e}")
    return {"result": result.model_dump(), "history": [h.model_dump() for h in history]}


@app.get("/ai/available")
def ai_available() -> dict:
    import os
    return {"available": bool(os.environ.get("GROQ_API_KEY"))}


@app.post("/ai/data-dictionary")
def ai_data_dictionary(req: dict) -> dict:
    raw_schema = req.get("schema")
    if not raw_schema:
        raise HTTPException(400, "schema is required")
    try:
        schema = Schema.model_validate(raw_schema)
    except ValidationError as e:
        raise HTTPException(400, f"Invalid schema: {e}")
    only_table = req.get("only_table") or None
    try:
        result = ai_mod.generate_dictionary(schema, only_table=only_table)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(500, f"AI request failed: {e}")
    return {"result": result.model_dump()}
