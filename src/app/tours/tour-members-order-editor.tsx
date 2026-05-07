"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { spaceMono } from "../components/bento/bento-fonts";
import { TourMemberRemoveButton } from "./tour-member-remove-button";
import { setTourMemberOrder } from "./actions";
import type { TourActivity } from "./data";
import {
  formatDistanceAuto,
  formatDateLabel,
} from "@/lib/activity-format";

interface Props {
  tourId: string;
  members: TourActivity[];
}

export function TourMembersOrderEditor({ tourId, members }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(members);
  const [savedOrder, setSavedOrder] = useState(() => members.map((m) => m.id));
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (items.length === 0) {
    return (
      <p className="text-sm text-[#a3a3a3]">
        Noch keine Aktivitäten zugeordnet.
      </p>
    );
  }

  const dirty =
    items.length !== savedOrder.length ||
    items.some((m, i) => m.id !== savedOrder[i]);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((m) => m.id === active.id);
    const newIndex = items.findIndex((m) => m.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setItems((prev) => arrayMove(prev, oldIndex, newIndex));
  }

  async function handleSave() {
    if (!dirty || busy) return;
    setBusy(true);
    const ids = items.map((m) => m.id);
    try {
      await setTourMemberOrder(tourId, ids);
      setSavedOrder(ids);
      toast.success("Reihenfolge gespeichert");
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Speichern fehlgeschlagen"
      );
    } finally {
      setBusy(false);
    }
  }

  function handleReset() {
    setItems(
      savedOrder
        .map((id) => members.find((m) => m.id === id))
        .filter((m): m is TourActivity => m != null)
    );
  }

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((m) => m.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="divide-y divide-[#1a1a1a] rounded-md border border-[#1a1a1a]">
            {items.map((m, idx) => (
              <SortableRow
                key={m.id}
                tourId={tourId}
                member={m}
                position={idx + 1}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {dirty ? (
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={handleReset}
            disabled={busy}
            className={`${spaceMono.className} inline-flex items-center rounded-md border border-[#2a2a2a] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a] disabled:opacity-60`}
          >
            Zurücksetzen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className={`${spaceMono.className} inline-flex items-center rounded-md border border-[#ff6a00] bg-[#ff6a00] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-black hover:bg-[#ff8030] disabled:opacity-60`}
          >
            {busy ? "Speichern …" : "Reihenfolge speichern"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SortableRow({
  tourId,
  member,
  position,
}: {
  tourId: string;
  member: TourActivity;
  position: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: member.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    background: isDragging ? "#161616" : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 touch-none"
    >
      <button
        type="button"
        aria-label="Position ändern"
        {...attributes}
        {...listeners}
        className={`${spaceMono.className} flex h-8 w-8 cursor-grab items-center justify-center rounded-md border border-[#2a2a2a] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a] active:cursor-grabbing`}
      >
        ⋮⋮
      </button>
      <span
        className={`${spaceMono.className} w-7 shrink-0 text-right text-[11px] uppercase tracking-[0.14em] text-[#7a7a7a]`}
      >
        #{position}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-white">{member.name}</div>
        <div
          className={`${spaceMono.className} flex flex-wrap items-center gap-x-3 text-[10px] uppercase tracking-[0.14em] text-[#a3a3a3]`}
        >
          <span>{member.type}</span>
          <span>{formatDateLabel(member.startTime)}</span>
          {member.distance ? (
            <span>{formatDistanceAuto(member.distance, 1)}</span>
          ) : null}
        </div>
      </div>
      <TourMemberRemoveButton
        tourId={tourId}
        activityId={member.id}
        activityName={member.name}
      />
    </li>
  );
}
