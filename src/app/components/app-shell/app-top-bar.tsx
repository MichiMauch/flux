"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogoutMenuItem } from "../logout-menu-item";
import { NavLottie } from "./nav-lottie";
import { DropdownSyncItem } from "./dropdown-sync-item";
import { DropdownProfileItem } from "./dropdown-profile-item";

interface AppTopBarProps {
  userName: string;
  userEmail: string;
  portraitUrl: string | null;
  initials: string;
  logoutAction: () => void;
  onToggleSidebar: () => void;
  onOpenSearch: () => void;
}

export function AppTopBar({
  userName,
  userEmail,
  portraitUrl,
  initials,
  logoutAction,
  onToggleSidebar,
  onOpenSearch,
}: AppTopBarProps) {
  const [searchHover, setSearchHover] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden lg:flex h-9 w-9 items-center justify-center rounded-md text-foreground/80 hover:bg-surface hover:text-foreground"
          aria-label="Sidebar umschalten"
        >
          <Menu className="h-4 w-4" />
        </button>

        <Link href="/" className="flex items-center" aria-label="Flux Home">
          <Image
            src="/icon-192.png"
            alt="Flux"
            width={40}
            height={40}
            className="h-10 w-10"
            priority
          />
        </Link>

        <div className="flex-1" />

        <button
          type="button"
          onClick={onOpenSearch}
          onMouseEnter={() => setSearchHover(true)}
          onMouseLeave={() => setSearchHover(false)}
          className="flex h-11 w-11 items-center justify-center rounded-md text-foreground/80 hover:bg-surface hover:text-foreground"
          aria-label="Suche öffnen"
        >
          <NavLottie file="search" size={34} playing={searchHover} />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="relative h-8 w-8 rounded-full focus:outline-none">
            <Avatar className="h-8 w-8 ring-1 ring-[color:var(--brand)]">
              {portraitUrl && <AvatarImage src={portraitUrl} alt={initials} />}
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <div className="text-sm font-medium">{userName}</div>
            </div>
            <div className="px-2 pb-1.5">
              <div className="text-xs text-foreground/70">{userEmail}</div>
            </div>
            <DropdownMenuSeparator />
            <DropdownSyncItem />
            <DropdownProfileItem />
            <DropdownMenuSeparator />
            <form action={logoutAction}>
              <LogoutMenuItem />
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
