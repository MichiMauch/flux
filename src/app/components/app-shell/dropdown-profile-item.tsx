"use client";

import Link from "next/link";
import { useState } from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { NavLottie } from "./nav-lottie";

export function DropdownProfileItem() {
  const [hover, setHover] = useState(false);

  return (
    <DropdownMenuItem
      render={<Link href="/profile" />}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="gap-2"
    >
      <NavLottie file="profile" size={22} playing={hover} />
      <span>Profil</span>
    </DropdownMenuItem>
  );
}
