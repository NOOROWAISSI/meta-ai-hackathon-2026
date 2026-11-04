import { useState } from "react";
import { Database, Download, RotateCcw } from "lucide-react";
import {
  exportStore,
  readRecord,
  resetStore,
  STORAGE_SCHEMA_VERSION,
} from "@/lib/storage/database";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function StorageRecovery({ onReset }: { onReset?: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recoveries, setRecoveries] = useState<string[]>([]);
  const backup = async () => {
    setError("");
    try {
      const data = await exportStore();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "nextstep-browser-backup.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Backup could not be exported.");
    }
  };
  return (
    <details className="prep-storage">
      <summary
        onClick={() =>
          void readRecord<{ recovery: string[] }>("meta", { recovery: [] })
            .then((meta) => setRecoveries(meta.recovery))
            .catch(() => {})
        }
      >
        <Database className="size-3.5" aria-hidden />
        Storage & recovery
      </summary>
      <div className="mt-3 space-y-3 text-xs text-muted-foreground">
        <p>
          Browser-only demo · IndexedDB schema {STORAGE_SCHEMA_VERSION}. Acceptance and progress are
          committed atomically. No account or server copy is connected.
        </p>
        {!!recoveries.length && (
          <p role="status">
            {recoveries.length} older records need recovery. Their original contents are retained in
            the backup; no progress has been silently discarded.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void backup()} className="detail-secondary">
            <Download className="size-3.5" aria-hidden />
            Export backup
          </button>
          <button type="button" onClick={() => setOpen(true)} className="detail-secondary">
            <RotateCcw className="size-3.5" aria-hidden />
            Reset demo storage
          </button>
        </div>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </div>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset this browser's demo data?</DialogTitle>
            <DialogDescription>
              This removes the saved profile, opportunities saved in this browser, accepted plans,
              task progress, and recovery backups. Export a backup first if you want to keep them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
              className="detail-secondary"
            >
              Keep my data
            </button>
            <button
              type="button"
              disabled={busy}
              className="detail-primary"
              onClick={async () => {
                setBusy(true);
                try {
                  await resetStore();
                  setOpen(false);
                  onReset?.();
                } catch (failure) {
                  setError(
                    failure instanceof Error
                      ? failure.message
                      : "Reset failed. Your previous data is preserved.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Resetting…" : "Reset demo data"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </details>
  );
}
