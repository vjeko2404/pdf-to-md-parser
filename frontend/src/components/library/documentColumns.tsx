import { Link } from "react-router-dom";
import { Pencil, RefreshCw, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Tooltip } from "@/components/ui/Tooltip";
import { SortButton } from "@/components/ui/DataTable";
import { StatusBadge } from "./StatusBadge";
import { CategoryChips } from "./CategoryChips";
import { formatDate, formatDocType } from "@/lib/format";
import { parseTags, type DocumentDto } from "@/types/api";

/** Shared state + callbacks the document columns read from `table.options.meta`. */
export interface DocumentTableMeta {
  selected: Set<number>;
  allSelected: boolean;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  onEnrich: (id: number) => void;
  onRetry: (id: number) => void;
  onReconvert: (id: number) => void;
  onEdit: (doc: DocumentDto) => void;
  onDelete: (id: number) => void;
  onTagClick: (tag: string) => void;
  /** Server-side sort key: '' | 'oldest' | 'name' | 'status'. */
  sort: string;
  onSort: (v: string) => void;
}

const meta = (table: { options: { meta?: unknown } }) =>
  table.options.meta as DocumentTableMeta;

/**
 * Column definitions for the documents table. Built from a factory so the header
 * text/tooltips can be localized via the passed-in `t`; per-row state and
 * callbacks flow through `meta`. Edit this file to add/reorder columns without
 * touching the table shell.
 */
export function buildDocumentColumns(
  t: TFunction<"library">,
): ColumnDef<DocumentDto>[] {
  return [
  {
    id: "select",
    meta: { headerClassName: "w-9" },
    header: ({ table }) => {
      const m = meta(table);
      return (
        <Checkbox checked={m.allSelected} onChange={m.onToggleAll} aria-label={t("table.selectAll")} />
      );
    },
    cell: ({ row, table }) => {
      const m = meta(table);
      return (
        <Checkbox
          checked={m.selected.has(row.original.id)}
          onChange={() => m.onToggle(row.original.id)}
          aria-label={t("table.selectDocument")}
        />
      );
    },
  },
  {
    id: "name",
    header: ({ table }) => {
      const m = meta(table);
      return (
        <SortButton
          label={t("table.name")}
          active={m.sort === "name"}
          dir="asc"
          onClick={() => m.onSort(m.sort === "name" ? "" : "name")}
        />
      );
    },
    cell: ({ row }) => (
      <Tooltip content={row.original.originalName} asChild>
        <Link to={`/doc/${row.original.id}`} className="block truncate font-medium hover:underline">
          {row.original.originalName}
        </Link>
      </Tooltip>
    ),
  },
  {
    id: "summary",
    header: t("table.summary"),
    meta: { headerClassName: "hidden w-56 xl:table-cell", cellClassName: "hidden xl:table-cell" },
    cell: ({ row }) =>
      row.original.summary ? (
        <Tooltip content={row.original.summary} asChild>
          <p className="line-clamp-2 cursor-default wrap-break-word text-xs text-muted-foreground">
            {row.original.summary}
          </p>
        </Tooltip>
      ) : (
        <span className="text-xs text-muted-foreground/50">—</span>
      ),
  },
  {
    id: "type",
    header: t("table.type"),
    meta: {
      headerClassName: "hidden w-36 lg:table-cell",
      cellClassName: "hidden text-muted-foreground lg:table-cell",
    },
    cell: ({ row }) => {
      const type = formatDocType(row.original.docType);
      return (
        <Tooltip content={type} asChild>
          <span className="block truncate">{type}</span>
        </Tooltip>
      );
    },
  },
  {
    id: "categories",
    header: t("table.categories"),
    meta: { headerClassName: "hidden w-44 lg:table-cell", cellClassName: "hidden lg:table-cell" },
    cell: ({ row }) => <CategoryChips categories={row.original.categories} />,
  },
  {
    id: "tags",
    header: t("table.tags"),
    meta: { headerClassName: "hidden w-56 md:table-cell", cellClassName: "hidden md:table-cell" },
    cell: ({ row, table }) => {
      const m = meta(table);
      return (
        <div className="flex flex-wrap gap-1">
          {parseTags(row.original.tagsJson).map((tag) => (
            <Tooltip key={tag} content={t("table.searchTag", { tag })} asChild>
              <button
                type="button"
                onClick={() => m.onTagClick(tag)}
                className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground">
                {tag}
              </button>
            </Tooltip>
          ))}
        </div>
      );
    },
  },
  {
    id: "status",
    header: t("table.status"),
    meta: { headerClassName: "w-24" },
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "pages",
    header: t("table.pages"),
    meta: {
      headerClassName: "hidden w-14 sm:table-cell",
      cellClassName: "hidden text-muted-foreground sm:table-cell",
    },
    cell: ({ row }) => row.original.pages,
  },
  {
    id: "date",
    meta: {
      headerClassName: "hidden w-28 sm:table-cell",
      cellClassName: "hidden whitespace-nowrap text-muted-foreground sm:table-cell",
    },
    header: ({ table }) => {
      const m = meta(table);
      const active = m.sort === "" || m.sort === "oldest";
      return (
        <SortButton
          label={t("table.date")}
          active={active}
          dir={m.sort === "oldest" ? "asc" : "desc"}
          onClick={() => m.onSort(m.sort === "oldest" ? "" : "oldest")}
        />
      );
    },
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
  {
    id: "actions",
    header: t("table.actions"),
    meta: { headerClassName: "w-40 text-right", cellClassName: "text-right" },
    cell: ({ row, table }) => {
      const m = meta(table);
      const d = row.original;
      return (
        <div className="flex justify-end gap-1">
          <Tooltip content={t("table.enrich")} asChild>
            <Button variant="ghost" size="sm" onClick={() => m.onEnrich(d.id)}>
              <Sparkles className="size-4" />
            </Button>
          </Tooltip>
          <Tooltip content={t("table.editNameCategories")} asChild>
            <Button variant="ghost" size="sm" onClick={() => m.onEdit(d)}>
              <Pencil className="size-4" />
            </Button>
          </Tooltip>
          <Tooltip content={t("table.recreateParsing")} asChild>
            <Button variant="ghost" size="sm" onClick={() => m.onReconvert(d.id)}>
              <RefreshCw className="size-4" />
            </Button>
          </Tooltip>
          {d.status === "Failed" && (
            <Tooltip content={t("table.retry")} asChild>
              <Button variant="ghost" size="sm" onClick={() => m.onRetry(d.id)}>
                <RotateCcw className="size-4" />
              </Button>
            </Tooltip>
          )}
          <Tooltip content={t("table.deleteFromVault")} asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => m.onDelete(d.id)}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="size-4" />
            </Button>
          </Tooltip>
        </div>
      );
    },
  },
  ];
}
