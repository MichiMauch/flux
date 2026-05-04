"use client";

import { useCallback } from "react";
import Image from "next/image";
import { BentoTile } from "../bento-tile";
import type { GroupPhoto } from "@/app/groups/data";

interface BentoGroupPhotosProps {
  photos: GroupPhoto[];
}

export function BentoGroupPhotos({ photos }: BentoGroupPhotosProps) {
  const openPhoto = useCallback((id: string) => {
    if (typeof window !== "undefined") {
      window.location.hash = `photo=${id}`;
    }
  }, []);

  if (photos.length === 0) return null;

  return (
    <BentoTile label="Galerie" title={`${photos.length} ${photos.length === 1 ? "Foto" : "Fotos"}`}>
      <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:grid md:snap-none md:grid-cols-4 md:gap-2 md:overflow-visible md:px-0 lg:grid-cols-5 [&::-webkit-scrollbar]:hidden">
        {photos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => openPhoto(p.id)}
            aria-label="Foto öffnen"
            className="relative aspect-square shrink-0 basis-[42%] snap-start overflow-hidden rounded-md border border-[#2a2a2a] bg-[#0f0f0f] md:flex-initial md:basis-auto"
          >
            <Image
              src={`/api/photos/${p.id}?thumb=1`}
              alt=""
              width={300}
              height={300}
              className="h-full w-full object-cover"
              unoptimized
            />
          </button>
        ))}
      </div>
    </BentoTile>
  );
}
