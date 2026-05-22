from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field

ColumnType = Literal[
    "int", "bigint", "string", "text", "boolean",
    "float", "decimal", "date", "datetime",
    "json", "uuid",
]


class Column(BaseModel):
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
    references: Optional[str] = None  # "table.column"
    description: Optional[str] = None


class Table(BaseModel):
    name: str
    columns: list[Column] = Field(default_factory=list)
    description: Optional[str] = None


class Schema(BaseModel):
    name: str = "my_project"
    tables: list[Table] = Field(default_factory=list)
