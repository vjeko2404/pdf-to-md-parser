import { useState } from "react";
import { Plus, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Section } from "@/components/common/Section";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { TextInput } from "@/components/common/inputs";
import { useCategories, useCreateCategory, useDeleteCategory } from "@/hooks/useCategories";

export function CategoriesPage() {
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
      onSuccess: () => toast.success("Category deleted"),
    });
    setDeleteId(null);
  };

  const add = () => {
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), color },
      {
        onSuccess: () => {
          toast.success("Category created");
          setName("");
        },
      },
    );
  };

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Section title="Categories" description="Your taxonomy (separate from the LLM tags)">
        <div className="flex flex-col gap-2">
          {(cats ?? []).map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ background: c.color ?? "var(--muted-foreground)" }}
              />
              <Link
                to={`/?categoryId=${c.id}`}
                className="flex-1 font-medium text-foreground no-underline hover:text-primary hover:underline"
                title={`View documents in ${c.name}`}>
                {c.name}
              </Link>
              <span className="text-xs text-muted-foreground">{c.count ?? 0} docs</span>
              <Button variant="ghost" size="sm" onClick={() => setDeleteId(c.id)} title="Delete">
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {!cats?.length && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Tag className="size-4" /> No categories yet.
            </p>
          )}
        </div>
        <div className="mt-3 flex gap-2 border-t pt-3">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-12 rounded-md border bg-background"
          />
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button variant="button_primary" size="sm" onClick={add}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </Section>

      <ConfirmDialog
        open={deleteId != null}
        title="Delete category?"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” will be removed and unassigned from ${deleteTarget.count ?? 0} document(s). This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
