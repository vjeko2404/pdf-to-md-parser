import { Link } from "react-router-dom";
import { FileText, Pencil, RefreshCw, Sparkles, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { StatusBadge } from "./StatusBadge";
import { CategoryChips } from "./CategoryChips";
import { Tooltip } from "@/components/ui/Tooltip";
import { formatDate, formatDocType } from "@/lib/format";
import { parseTags, type DocumentDto } from "@/types/api";

export interface DocumentCardProps {
  doc: DocumentDto;
  selected: boolean;
  onToggle: (id: number) => void;
  onEnrich: (id: number) => void;
  onRetry: (id: number) => void;
  onReconvert: (id: number) => void;
  onEdit: (doc: DocumentDto) => void;
  onDelete: (id: number) => void;
  onTagClick: (tag: string) => void;
}

export function DocumentCard({
  doc,
  selected,
  onToggle,
  onEnrich,
  onRetry,
  onReconvert,
  onEdit,
  onDelete,
  onTagClick,
}: DocumentCardProps) {
  const tags = parseTags(doc.tagsJson);

  return (
    <Card selected={selected} className="flex min-w-0 flex-col gap-3">
      <div className="flex items-start gap-2">
        <Checkbox
          checked={selected}
          onChange={() => onToggle(doc.id)}
          aria-label="Select document"
          className="mt-1"
        />
        <Link to={`/doc/${doc.id}`} className="flex min-w-0 flex-1 items-center gap-2">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{doc.originalName}</span>
        </Link>
        <StatusBadge status={doc.status} />
      </div>

      {doc.summary && (
        <Tooltip content={doc.summary} asChild>
          <p className="line-clamp-2 cursor-default wrap-break-word text-sm text-muted-foreground">
            {doc.summary}
          </p>
        </Tooltip>
      )}

      <CategoryChips categories={doc.categories} />

      {(doc.docType || tags.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {doc.docType && (
            <span className="rounded-md bg-accent px-2 py-0.5 text-xs text-accent-foreground">
              {formatDocType(doc.docType)}
            </span>
          )}
          {tags.slice(0, 5).map((t) => (
            <Tooltip key={t} content={`Search “${t}”`} asChild>
              <button
                type="button"
                onClick={() => onTagClick(t)}
                className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground">
                {t}
              </button>
            </Tooltip>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between pt-1">
        <span className="text-xs text-muted-foreground">
          {doc.pages} pp · {formatDate(doc.createdAt)}
        </span>
        <div className="flex gap-1">
          <Tooltip content="Enrich with Ollama" asChild>
            <Button variant="ghost" size="sm" onClick={() => onEnrich(doc.id)}>
              <Sparkles className="size-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Edit name & categories" asChild>
            <Button variant="ghost" size="sm" onClick={() => onEdit(doc)}>
              <Pencil className="size-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Re-create parsing" asChild>
            <Button variant="ghost" size="sm" onClick={() => onReconvert(doc.id)}>
              <RefreshCw className="size-4" />
            </Button>
          </Tooltip>
          {doc.status === "Failed" && (
            <Tooltip content="Retry" asChild>
              <Button variant="ghost" size="sm" onClick={() => onRetry(doc.id)}>
                <RotateCcw className="size-4" />
              </Button>
            </Tooltip>
          )}
          <Tooltip content="Delete from vault" asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(doc.id)}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="size-4" />
            </Button>
          </Tooltip>
        </div>
      </div>
    </Card>
  );
}
