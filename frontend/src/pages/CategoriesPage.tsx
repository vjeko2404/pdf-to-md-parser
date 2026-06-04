import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Section } from "@/components/common/Section";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { Link } from "@/components/ui/Link";
import { Input } from "@/components/ui/Input";
import { useCategories, useCreateCategory, useDeleteCategory } from "@/hooks/useCategories";

export function CategoriesPage() {
  const { t } = useTranslation("categories");
  const { data: cats } = useCategories();
  const create = useCreateCategory();
  const del = useDeleteCategory();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#aa3bff");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const deleteTarget = cats?.find((c) => c.id === deleteId);

  const confirmDelete = () => {
    if (deleteId == null) return;
    del.mutate(deleteId, {
      onSuccess: () => toast.success(t("toast.deleted")),
    });
    setDeleteId(null);
  };

  const add = () => {
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), color },
      {
        onSuccess: () => {
          toast.success(t("toast.created"));
          setName("");
        },
      },
    );
  };

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Section title={t("title")} description={t("description")}>
        <div className="flex flex-col gap-2">
          {(cats ?? []).map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ background: c.color ?? "var(--muted-foreground)" }}
              />
              <Tooltip content={t("viewDocuments", { name: c.name })} asChild>
                <Link
                  to={`/?categoryId=${c.id}`}
                  className="flex-1 font-medium text-foreground no-underline hover:text-primary hover:underline">
                  {c.name}
                </Link>
              </Tooltip>
              <span className="text-xs text-muted-foreground">
                {t("docsCount", { count: c.count ?? 0 })}
              </span>
              <Tooltip content={t("common:delete")} asChild>
                <Button variant="ghost" size="sm" onClick={() => setDeleteId(c.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </Tooltip>
            </div>
          ))}
          {!cats?.length && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Tag className="size-4" /> {t("empty")}
            </p>
          )}
        </div>
        <div className="mt-3 flex gap-2 border-t pt-3">
          <ColorPicker value={color} onChange={setColor} />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button variant="button_primary" size="sm" className="h-9" onClick={add}>
            <Plus className="size-4" /> {t("common:add")}
          </Button>
        </div>
      </Section>

      <ConfirmDialog
        open={deleteId != null}
        title={t("delete.title")}
        description={
          deleteTarget
            ? t("delete.description", {
                name: deleteTarget.name,
                count: deleteTarget.count ?? 0,
              })
            : undefined
        }
        confirmLabel={t("common:delete")}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
