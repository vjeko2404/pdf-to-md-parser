import { useTranslation } from "react-i18next";
import { Loader2, Pause, Play, Search, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Tooltip } from "@/components/ui/Tooltip";
import { ViewSwitcher } from "../ui/ViewSwitcher";
import type { ViewMode } from "@/hooks/useViewMode";
import type { Category } from "@/api/categories";
import type { DocumentStatus } from "@/types/api";

const STATUSES: (DocumentStatus | "All")[] = ["All", "Queued", "Processing", "Done", "Failed"];

const STATUS_KEY: Record<string, string> = {
  All: "status.all",
  Queued: "status.queued",
  Processing: "status.processing",
  Done: "status.done",
  Failed: "status.failed",
};

export interface LibraryToolbarProps {
  search: string;
  onSearch: (v: string) => void;
  status: string;
  onStatus: (v: string) => void;
  categories: Category[];
  categoryId: string;
  onCategory: (v: string) => void;
  sort: string;
  onSort: (v: string) => void;
  view: ViewMode;
  onView: (v: ViewMode) => void;
  showViewSwitcher?: boolean;
  selectedCount: number;
  onEnrichSelected: () => void;
  onDeleteSelected: () => void;
  enriching: boolean;
  paused: boolean;
  onTogglePause: () => void;
  pauseBusy: boolean;
}

export function LibraryToolbar(props: LibraryToolbarProps) {
  const {
    search,
    onSearch,
    status,
    onStatus,
    categories,
    categoryId,
    onCategory,
    sort,
    onSort,
    view,
    onView,
    showViewSwitcher = true,
    selectedCount,
    onEnrichSelected,
    onDeleteSelected,
    enriching,
    paused,
    onTogglePause,
    pauseBusy,
  } = props;
  const { t } = useTranslation("library");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-48 flex-1">
        <Input
          icon={<Search className="size-4" />}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t("toolbar.searchPlaceholder")}
          className={search ? "pr-8" : undefined}
        />
        {search && (
          <Tooltip content={t("toolbar.clearSearch")} asChild>
            <button
              type="button"
              onClick={() => onSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground">
              <X className="size-4" />
            </button>
          </Tooltip>
        )}
      </div>
      <Select value={status} onChange={onStatus}>
        {STATUSES.map((s) => (
          <option key={s} value={s === "All" ? "" : s}>
            {t(STATUS_KEY[s])}
          </option>
        ))}
      </Select>
      <Select value={categoryId} onChange={onCategory}>
        <option value="">{t("toolbar.allCategories")}</option>
        {categories.map((c) => (
          <option key={c.id} value={String(c.id)}>
            {c.name}
          </option>
        ))}
      </Select>
      <Tooltip content={t("toolbar.sort")} asChild>
        <Select value={sort} onChange={onSort}>
          <option value="">{t("toolbar.sortNewest")}</option>
          <option value="oldest">{t("toolbar.sortOldest")}</option>
          <option value="name">{t("toolbar.sortName")}</option>
          <option value="status">{t("toolbar.sortStatus")}</option>
        </Select>
      </Tooltip>
      {selectedCount > 0 && (
        <>
          <Button
            variant="button_primary"
            size="sm"
            className="h-9"
            onClick={onEnrichSelected}
            disabled={enriching}>
            {enriching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {enriching ? t("toolbar.enriching") : t("toolbar.enrich", { count: selectedCount })}
          </Button>
          <Button
            variant="button_red"
            size="sm"
            className="h-9"
            onClick={onDeleteSelected}
            disabled={enriching}>
            <Trash2 className="size-4" /> {t("toolbar.delete", { count: selectedCount })}
          </Button>
        </>
      )}
      <Tooltip content={paused ? t("toolbar.resumeProcessing") : t("toolbar.pauseProcessing")} asChild>
        <Button
          variant={paused ? "button_yellow" : "button_neutral"}
          size="sm"
          className="h-9"
          onClick={onTogglePause}
          disabled={pauseBusy}>
          {pauseBusy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : paused ? (
            <Play className="size-4" />
          ) : (
            <Pause className="size-4" />
          )}
          {paused ? t("toolbar.resume") : t("toolbar.pause")}
        </Button>
      </Tooltip>
      {showViewSwitcher && <ViewSwitcher mode={view} onChange={onView} />}
    </div>
  );
}
