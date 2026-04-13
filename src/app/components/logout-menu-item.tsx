"use client";

import { LogOut } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function LogoutMenuItem() {
  return (
    <DropdownMenuItem
      render={<span role="button" className="w-full cursor-pointer" />}
      onClick={(e) => {
        e.currentTarget.closest("form")?.requestSubmit();
      }}
    >
      <LogOut className="mr-2 h-4 w-4" />
      Abmelden
    </DropdownMenuItem>
  );
}
