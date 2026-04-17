"use client";

import Link from "next/link";
import { Activity, Menu, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "../theme-toggle";
import { LogoutMenuItem } from "../logout-menu-item";
import { BentoSyncButton } from "../bento/home/bento-sync-button";

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

        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Activity className="h-5 w-5 text-[color:var(--brand)]" />
          <span>Flux</span>
        </Link>

        <div className="flex-1" />

        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-9 w-9 items-center justify-center rounded-md text-foreground/80 hover:bg-surface hover:text-foreground"
          aria-label="Suche öffnen"
        >
          <Search className="h-4 w-4" />
        </button>

        <div className="hidden sm:block">
          <BentoSyncButton />
        </div>

        <div className="hidden sm:block">
          <ThemeToggle />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="relative h-8 w-8 rounded-full focus:outline-none">
            <Avatar className="h-8 w-8">
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
            <DropdownMenuItem
              render={<Link href="/profile" />}
              className="flex items-center gap-2"
            >
              Profil
            </DropdownMenuItem>
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
