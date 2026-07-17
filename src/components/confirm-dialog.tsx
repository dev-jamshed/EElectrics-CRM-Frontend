import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  loading,
  onOpenChange,
  onConfirm
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] rounded-3xl border-border/60 bg-card/95 p-0 shadow-apple backdrop-blur-xl sm:max-w-md">
        <div className="p-5 sm:p-6">
          <DialogHeader className="text-left">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl">{title}</DialogTitle>
            <DialogDescription className="pt-1 leading-6">{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 gap-2 sm:space-x-0">
            <Button type="button" variant="outline" className="rounded-xl border-border/70 bg-background" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" className="rounded-xl" loading={loading} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
