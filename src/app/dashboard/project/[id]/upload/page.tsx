"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Upload,
  FileText,
  Film,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { useCinemaStore } from "@/lib/store";

type UploadState = "idle" | "dragging" | "uploading" | "parsing" | "done" | "error";

export default function UploadPage() {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { uploadScript, scenes, characters, locations } = useCinemaStore();

  const projectId = pathname.split("/")[3];


  async function processFile(f: File) {
    const name = f.name.toLowerCase();
    if (!name.endsWith(".fdx") && !name.endsWith(".pdf")) {
      setError("Formato inválido. Aceitos: PDF ou Final Draft (.fdx)");
      setUploadState("error");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("O arquivo passa de 10 MB.");
      setUploadState("error");
      return;
    }

    setFile(f);
    setError(null);
    setProgress(0);
    setUploadState("parsing");

    const success = await uploadScript(projectId, f);
    if (success) {
      setProgress(100);
      setUploadState("done");
    } else {
      setError(useCinemaStore.getState().error || "Não foi possível processar o arquivo. Tente novamente.");
      setUploadState("error");
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setUploadState("dragging");
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setUploadState("idle");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) processFile(droppedFile);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) processFile(selectedFile);
  }

  function handleContinue() {
    router.push(`/dashboard/project/${projectId}/breakdown`);
  }

  function handleReset() {
    setFile(null);
    setUploadState("idle");
    setProgress(0);
    setError(null);
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold">Upload do Roteiro</h2>
        <p className="text-muted-foreground mt-1">
          Envie seu roteiro em PDF ou Final Draft (.fdx). A IA irá extrair todas as cenas automaticamente.
        </p>
      </div>

      {/* Supported Formats */}
      <div className="flex gap-2 mb-6">
        <Badge variant="secondary" className="gap-1.5">
          <FileText className="h-3 w-3" />
          PDF
        </Badge>
        <Badge variant="secondary" className="gap-1.5">
          <Film className="h-3 w-3" />
          Final Draft (.fdx)
        </Badge>
      </div>

      {/* Upload Area */}
      {uploadState === "idle" || uploadState === "dragging" || uploadState === "error" ? (
        <Card
          className={cn(
            "relative border-2 border-dashed transition-all cursor-pointer",
            uploadState === "dragging"
              ? "border-primary bg-primary/5 scale-[1.02]"
              : uploadState === "error"
              ? "border-destructive/50 bg-destructive/5"
              : "border-border/50 bg-card hover:border-primary/40 hover:bg-card"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <CardContent className="flex flex-col items-center justify-center py-16">
            <input
              type="file"
              accept=".pdf,.fdx"
              onChange={handleFileSelect}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />

            {uploadState === "error" ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
                  <AlertCircle className="h-7 w-7 text-destructive" />
                </div>
                <p className="text-sm text-destructive font-medium">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={handleReset}
                >
                  Tentar novamente
                </Button>
              </>
            ) : (
              <>
                <div
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full mb-4 transition-colors",
                    uploadState === "dragging"
                      ? "bg-primary/20"
                      : "bg-primary/10"
                  )}
                >
                  <Upload
                    className={cn(
                      "h-7 w-7 transition-all",
                      uploadState === "dragging"
                        ? "text-primary scale-110"
                        : "text-primary"
                    )}
                  />
                </div>
                <p className="font-medium">
                  {uploadState === "dragging"
                    ? "Solte o arquivo aqui"
                    : "Arraste o roteiro aqui"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  ou clique para selecionar
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Processing / Done State */
        <Card className="border-border/50 bg-card">
          <CardContent className="py-8">
            <div className="flex items-start gap-4">
              {/* File Icon */}
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg",
                  uploadState === "done"
                    ? "bg-green-500/10"
                    : "bg-primary/10"
                )}
              >
                {uploadState === "done" ? (
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                ) : (
                  <FileText className="h-6 w-6 text-primary" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{file?.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {file && (file.size / 1024).toFixed(0)} KB
                </p>

                {/* Progress Bar */}
                {(uploadState === "uploading" || uploadState === "parsing") && (
                  <div className="mt-3">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          uploadState === "parsing"
                            ? "bg-primary animate-pulse w-full"
                            : "bg-primary"
                        )}
                        style={
                          uploadState === "uploading"
                            ? { width: `${progress}%` }
                            : undefined
                        }
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {uploadState === "uploading"
                        ? `Enviando... ${progress}%`
                        : "Lendo o roteiro…"}
                    </p>
                  </div>
                )}

                {/* Done State */}
                {uploadState === "done" && (
                  <div className="mt-3">
                    <p className="text-sm text-green-500 font-medium">
                      Roteiro analisado
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {scenes.length} cenas detectadas · {characters.length} personagens · {locations.length} locações
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              {uploadState !== "done" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={handleReset}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Continue Button */}
            {uploadState === "done" && (
              <div className="mt-6 flex gap-3">
                <Button variant="outline" onClick={handleReset}>
                  Enviar outro
                </Button>
                <Button className="font-semibold" onClick={handleContinue}>
                  Revisar Breakdown →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
