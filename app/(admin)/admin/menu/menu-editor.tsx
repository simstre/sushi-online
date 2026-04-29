"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "@/components/image-upload";
import { cn, formatMoney } from "@/lib/utils";
import {
  ALL_MENU_TAGS,
  TAG_INFO,
  type MenuItemTag,
} from "@/lib/menu/tags";
import { tenantFetch } from "@/lib/tenant/client-url";

type Item = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  categoryId: string;
  tags: MenuItemTag[];
};

type Category = {
  id: string;
  name: string;
  order: number;
  items: Item[];
};

export function MenuEditor({ categories, currency }: { categories: Category[]; currency: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [creatingInCategory, setCreatingInCategory] = useState<string | null>(null);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function call(path: string, init: RequestInit) {
    setError(null);
    const res = await tenantFetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    if (!res.ok) {
      const body = await res.text();
      setError(body || `Request failed (${res.status})`);
      return null;
    }
    return res.json();
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return;
    const r = await call("/api/admin/menu/categories", {
      method: "POST",
      body: JSON.stringify({ name: newCategoryName.trim() }),
    });
    if (r) {
      setNewCategoryName("");
      refresh();
    }
  }

  async function renameCategory(id: string, name: string) {
    const r = await call(`/api/admin/menu/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    if (r) refresh();
  }

  async function moveCategory(id: string, dir: "up" | "down") {
    const r = await call(`/api/admin/menu/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ move: dir }),
    });
    if (r) refresh();
  }

  async function deleteCategory(id: string) {
    if (!confirm("Delete this category and all its items?")) return;
    const r = await call(`/api/admin/menu/categories/${id}`, { method: "DELETE" });
    if (r) refresh();
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;
    const r = await call(`/api/admin/menu/items/${id}`, { method: "DELETE" });
    if (r) refresh();
  }

  async function toggleAvailability(item: Item) {
    const r = await call(`/api/admin/menu/items/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isAvailable: !item.isAvailable }),
    });
    if (r) refresh();
  }

  async function moveItem(id: string, dir: "up" | "down") {
    const r = await call(`/api/admin/menu/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ move: dir }),
    });
    if (r) refresh();
  }

  async function saveItem(item: {
    id?: string;
    categoryId: string;
    name: string;
    description: string;
    price: number;
    imageUrl: string | null;
    isAvailable: boolean;
    tags: MenuItemTag[];
  }) {
    const isUpdate = Boolean(item.id);
    const path = isUpdate ? `/api/admin/menu/items/${item.id}` : "/api/admin/menu/items";
    const r = await call(path, {
      method: isUpdate ? "PATCH" : "POST",
      body: JSON.stringify({
        categoryId: item.categoryId,
        name: item.name,
        description: item.description || null,
        price: item.price,
        imageUrl: item.imageUrl,
        isAvailable: item.isAvailable,
        tags: item.tags,
      }),
    });
    if (r) {
      setEditingItem(null);
      setCreatingInCategory(null);
      refresh();
    }
  }

  async function toggleTag(item: Item, tag: MenuItemTag) {
    const next = item.tags.includes(tag)
      ? item.tags.filter((t) => t !== tag)
      : [...item.tags, tag];
    const r = await call(`/api/admin/menu/items/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ tags: next }),
    });
    if (r) refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Menu</h1>
          <p className="text-sm text-muted-foreground">
            Organize categories and items. Drag-ordering via arrows; prices in cents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="New category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="w-60"
          />
          <Button onClick={addCategory} disabled={pending || !newCategoryName.trim()}>
            <Plus className="mr-1 h-4 w-4" />
            Add category
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {categories.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          No categories yet. Add one above to get started.
        </p>
      )}

      {categories.map((c, idx) => (
        <Card key={c.id}>
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <EditableName value={c.name} onSave={(name) => renameCategory(c.id, name)} />
              <span className="text-xs text-muted-foreground">#{c.order}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                disabled={idx === 0}
                onClick={() => moveCategory(c.id, "up")}
                aria-label="Move up"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={idx === categories.length - 1}
                onClick={() => moveCategory(c.id, "down")}
                aria-label="Move down"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteCategory(c.id)}
                aria-label="Delete category"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="divide-y divide-border">
              {c.items.map((item, i) => (
                <li key={item.id} className="flex items-center gap-3 py-2">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-12 w-12 rounded object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded bg-muted" aria-hidden />
                  )}
                  <div className="flex-1">
                    <p className={cn("font-medium", !item.isAvailable && "text-muted-foreground")}>
                      {item.name}
                      {!item.isAvailable && " · hidden"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatMoney(item.price, currency)}
                      {item.description ? ` · ${item.description}` : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {ALL_MENU_TAGS.map((tag) => {
                        const on = item.tags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(item, tag)}
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[11px] capitalize transition-colors",
                              on
                                ? TAG_INFO[tag].badge
                                : "border-border bg-background text-muted-foreground hover:border-foreground/40",
                            )}
                          >
                            {TAG_INFO[tag].label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={i === 0}
                      onClick={() => moveItem(item.id, "up")}
                      aria-label="Move up"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={i === c.items.length - 1}
                      onClick={() => moveItem(item.id, "down")}
                      aria-label="Move down"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleAvailability(item)}
                    >
                      {item.isAvailable ? "Hide" : "Show"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingItem(item)}
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteItem(item.id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
              {c.items.length === 0 && (
                <li className="py-4 text-sm text-muted-foreground">No items yet.</li>
              )}
            </ul>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreatingInCategory(c.id)}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add item
            </Button>
          </CardContent>
        </Card>
      ))}

      {(editingItem || creatingInCategory) && (
        <ItemDialog
          key={editingItem?.id ?? creatingInCategory}
          categories={categories}
          initial={
            editingItem ?? {
              id: undefined,
              categoryId: creatingInCategory!,
              name: "",
              description: "",
              price: 0,
              imageUrl: null,
              isAvailable: true,
              tags: [],
            }
          }
          onClose={() => {
            setEditingItem(null);
            setCreatingInCategory(null);
          }}
          onSave={saveItem}
        />
      )}
    </div>
  );
}

function EditableName({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return (
      <button
        className="group inline-flex items-center gap-1 text-left"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        <CardTitle>{value}</CardTitle>
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100" />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSave(draft);
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
        autoFocus
      />
      <Button
        size="sm"
        onClick={() => {
          onSave(draft);
          setEditing(false);
        }}
      >
        Save
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </div>
  );
}

function ItemDialog({
  initial,
  categories,
  onClose,
  onSave,
}: {
  initial: {
    id?: string;
    categoryId: string;
    name: string;
    description: string | null;
    price: number;
    imageUrl: string | null;
    isAvailable: boolean;
    tags: MenuItemTag[];
  };
  categories: Category[];
  onClose: () => void;
  onSave: (item: {
    id?: string;
    categoryId: string;
    name: string;
    description: string;
    price: number;
    imageUrl: string | null;
    isAvailable: boolean;
    tags: MenuItemTag[];
  }) => Promise<void> | void;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [priceStr, setPriceStr] = useState(String(initial.price));
  const [imageUrl, setImageUrl] = useState<string | null>(initial.imageUrl);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [isAvailable, setIsAvailable] = useState(initial.isAvailable);
  const [tags, setTags] = useState<MenuItemTag[]>(initial.tags);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    await onSave({
      id: initial.id,
      categoryId,
      name: name.trim(),
      description: description.trim(),
      price: Math.max(0, Math.round(Number(priceStr) || 0)),
      imageUrl,
      isAvailable,
      tags,
    });
    setBusy(false);
  }

  function toggleTag(tag: MenuItemTag) {
    setTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold">{initial.id ? "Edit item" : "New item"}</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            Name
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-sm">
            Description
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Price (cents)
              <Input
                value={priceStr}
                inputMode="numeric"
                onChange={(e) => setPriceStr(e.target.value.replace(/[^\d]/g, ""))}
              />
            </label>
            <label className="block text-sm">
              Category
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
            />
            Available to order
          </label>
          <div className="text-sm">
            <p className="font-medium">Tags</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {ALL_MENU_TAGS.map((tag) => {
                const on = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      on
                        ? TAG_INFO[tag].badge
                        : "border-border bg-background text-muted-foreground hover:border-foreground/40",
                    )}
                  >
                    {TAG_INFO[tag].label}
                  </button>
                );
              })}
            </div>
          </div>
          <ImageUpload
            label="Image"
            prefix="menu"
            value={imageUrl}
            onChange={setImageUrl}
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !name || !categoryId}>
            {busy ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
