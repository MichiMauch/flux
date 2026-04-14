"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { ActivityEditSheet } from "./activity-edit-sheet";

interface EditButtonProps {
  activity: {
    id: string;
    name: string;
    notes: string | null;
    ascent: number | null;
    descent: number | null;
  };
  initialPhotos: { id: string }[];
}

export function EditButton({ activity, initialPhotos }: EditButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Aktivität bearbeiten"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <ActivityEditSheet
        open={open}
        onClose={() => setOpen(false)}
        activity={activity}
        initialPhotos={initialPhotos}
      />
    </>
  );
}
