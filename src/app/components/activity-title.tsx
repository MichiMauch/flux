"use client";

import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";

interface ActivityTitleProps {
  activityId: string;
  initialName: string;
}

export function ActivityTitle({ activityId, initialName }: ActivityTitleProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [draft, setDraft] = useState(initialName);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!draft.trim() || draft === name) {
      setEditing(false);
      setDraft(name);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/activities/${activityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.trim() }),
      });
      if (res.ok) {
        setName(draft.trim());
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          disabled={saving}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setEditing(false);
              setDraft(name);
            }
          }}
          className="text-2xl font-bold bg-transparent border-b border-muted-foreground/40 focus:border-foreground outline-none"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded p-1 hover:bg-muted"
          title="Speichern"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setDraft(name);
          }}
          className="rounded p-1 hover:bg-muted"
          title="Abbrechen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <h1 className="text-2xl font-bold">{name}</h1>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded p-1 hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
        title="Bearbeiten"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
