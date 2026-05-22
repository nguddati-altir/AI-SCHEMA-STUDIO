export type ColumnType =
  | "int"
  | "bigint"
  | "string"
  | "text"
  | "boolean"
  | "float"
  | "decimal"
  | "date"
  | "datetime"
  | "json"
  | "uuid";

export const COLUMN_TYPES: ColumnType[] = [
  "int",
  "bigint",
  "string",
  "text",
  "boolean",
  "float",
  "decimal",
  "date",
  "datetime",
  "json",
  "uuid",
];

export interface Column {
  name: string;
  type: ColumnType;
  nullable: boolean;
  primary_key: boolean;
  unique: boolean;
  auto_increment: boolean;
  default: string | null;
  length: number | null;
  precision: number | null;
  scale: number | null;
  references: string | null;
  description?: string | null;
}

export interface Table {
  name: string;
  columns: Column[];
  description?: string | null;
}

export interface Schema {
  name: string;
  tables: Table[];
}

export function newColumn(name = "new_column"): Column {
  return {
    name,
    type: "string",
    nullable: true,
    primary_key: false,
    unique: false,
    auto_increment: false,
    default: null,
    length: null,
    precision: null,
    scale: null,
    references: null,
    description: null,
  };
}

export function newTable(name = "new_table"): Table {
  return {
    name,
    columns: [
      {
        ...newColumn("id"),
        type: "int",
        primary_key: true,
        auto_increment: true,
        nullable: false,
      },
    ],
  };
}

export function defaultSchema(): Schema {
  return {
    name: "my_project",
    tables: [
      {
        name: "users",
        columns: [
          { ...newColumn("id"), type: "int", primary_key: true, auto_increment: true, nullable: false },
          { ...newColumn("email"), type: "string", length: 255, unique: true, nullable: false },
          { ...newColumn("name"), type: "string", length: 120 },
          { ...newColumn("metadata"), type: "json" },
          { ...newColumn("created_at"), type: "datetime", default: "CURRENT_TIMESTAMP", nullable: false },
        ],
      },
      {
        name: "posts",
        columns: [
          { ...newColumn("id"), type: "int", primary_key: true, auto_increment: true, nullable: false },
          { ...newColumn("user_id"), type: "int", nullable: false, references: "users.id" },
          { ...newColumn("title"), type: "string", length: 200, nullable: false },
          { ...newColumn("body"), type: "text" },
          { ...newColumn("tags"), type: "json" },
        ],
      },
    ],
  };
}
