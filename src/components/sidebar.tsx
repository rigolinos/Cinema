"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Film,
  LayoutDashboard,
  Settings,
  LogOut,
  ChevronLeft,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center gap-3 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Film className="h-5 w-5 text-primary" />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight">
            CineBoard
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "ml-auto h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground transition-transform",
            collapsed && "rotate-180"
          )}
          onClick={() => setCollapsed(!collapsed)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      <Separator className="opacity-50" />

      {/* New Project Button */}
      <div className="px-3 pt-4">
        <Tooltip>
          <TooltipTrigger
              render={<Link href="/dashboard/new" />}
              className={cn(
                "inline-flex items-center justify-start gap-2 font-semibold rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm w-full cursor-pointer hover:bg-primary/90 transition-colors",
                collapsed && "justify-center px-0"
              )}
            >
              <Plus className="h-4 w-4" />
              {!collapsed && "Novo Projeto"}
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Novo Projeto</TooltipContent>}
        </Tooltip>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 pt-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger
                render={<Link href={item.href} />}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  collapsed && "justify-center px-0"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.title}
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right">{item.title}</TooltipContent>
              )}
            </Tooltip>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        <Tooltip>
          <TooltipTrigger
            render={<Link href="/settings" />}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              collapsed && "justify-center px-0"
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!collapsed && "Configurações"}
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Configurações</TooltipContent>}
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            onClick={handleLogout}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive",
              collapsed && "justify-center px-0"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && "Sair"}
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Sair</TooltipContent>}
        </Tooltip>
      </div>
    </aside>
  );
}
