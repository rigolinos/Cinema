"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Upload, TableProperties, Users, MapPin, Calendar, Download, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { id: "upload", label: "Roteiro", icon: Upload, href: "upload" },
  { id: "breakdown", label: "Breakdown", icon: TableProperties, href: "breakdown" },
  { id: "casting", label: "Casting", icon: Users, href: "casting" },
  { id: "setup", label: "Produção", icon: MapPin, href: "setup" },
  { id: "schedule", label: "Ordem do Dia", icon: Calendar, href: "schedule" },
  { id: "export", label: "Exportar", icon: Download, href: "export" },
];

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Extract project id from the pathname since we can't await in client component
  const segments = pathname.split("/");
  const projectId = segments[3] || "";

  const currentStepIndex = steps.findIndex((step) =>
    pathname.endsWith(`/${step.href}`)
  );

  return (
    <div className="animate-fade-in">
      {/* Back to dashboard */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar aos projetos
      </Link>

      {/* Step Navigation */}
      <div className="mb-8">
        <nav className="flex items-center gap-1 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm p-1.5 overflow-x-auto">
          {steps.map((step, index) => {
            const isActive = pathname.endsWith(`/${step.href}`);
            const isCompleted = currentStepIndex > index;

            return (
              <Link
                key={step.id}
                href={`/dashboard/project/${projectId}/${step.href}`}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : isCompleted
                    ? "text-primary hover:bg-primary/10"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {isCompleted && !isActive ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <step.icon className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Page Content */}
      {children}
    </div>
  );
}
