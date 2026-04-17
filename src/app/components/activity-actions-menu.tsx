"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ActivityEditSheet } from "./activity-edit-sheet";

interface ActivityActionsMenuProps {
  activity: {
    id: string;
    name: string;
    type: string;
    notes: string | null;
    ascent: number | null;
    descent: number | null;
  };
  initialPhotos: { id: string }[];
}

export function ActivityActionsMenu({
  activity,
  initialPhotos,
}: ActivityActionsMenuProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/activities/${activity.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setConfirmOpen(false);
      setConfirmStep(1);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
      setDeleting(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Aktionen"
        >
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Bearbeiten
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setConfirmStep(1);
              setConfirmOpen(true);
            }}
            className="text-destructive data-[highlighted]:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ActivityEditSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        activity={activity}
        initialPhotos={initialPhotos}
      />

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!deleting) {
            setConfirmOpen(open);
            if (!open) setConfirmStep(1);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmStep === 1
                ? "Aktivität löschen?"
                : "Bist du ganz sicher, dass du löschen willst?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmStep === 1
                ? "Diese Aktivität wird mit allen Fotos endgültig gelöscht. Dies kann nicht rückgängig gemacht werden."
                : "Die Aktivität und alle zugehörigen Fotos werden sofort entfernt."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmStep === 1) {
                  setConfirmStep(2);
                } else {
                  handleDelete();
                }
              }}
              disabled={deleting}
              variant="destructive"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmStep === 1 ? "Löschen" : "Ja, endgültig löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
