import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Loader2, Printer } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { crmApi } from "@/lib/api";

type PdfPreviewDialogProps = {
  open: boolean;
  documentId: string;
  title: string;
  documentNo?: string;
  onOpenChange: (open: boolean) => void;
};

export function PdfPreviewDialog({
  open,
  documentId,
  title,
  documentNo,
  onOpenChange
}: PdfPreviewDialogProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameReady, setFrameReady] = useState(false);
  const previewQuery = useQuery({
    queryKey: ["pdf-preview", documentId],
    queryFn: () => crmApi.pdfPreview(documentId),
    enabled: open && Boolean(documentId),
    staleTime: 30_000
  });

  const downloadPdf = () => {
    const link = window.document.createElement("a");
    link.href = crmApi.pdfDownloadUrl(documentId);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success("PDF download started");
  };

  const printPdf = () => {
    const frameWindow = frameRef.current?.contentWindow;
    if (!frameWindow) {
      toast.error("PDF is still loading");
      return;
    }
    frameWindow.focus();
    frameWindow.print();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setFrameReady(false);
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="flex h-[100dvh] w-screen !max-w-none flex-col gap-0 overflow-hidden border-0 bg-card p-0 shadow-2xl sm:h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:rounded-2xl sm:border sm:border-border/70">
        <div className="flex shrink-0 flex-col gap-3 border-b border-border/70 bg-card/95 px-4 py-3 pr-14 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4 sm:pr-14">
          <DialogHeader className="min-w-0 space-y-0 text-left">
            <DialogTitle className="flex min-w-0 items-center gap-2 text-base sm:text-lg">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </span>
              <span className="truncate">{title}</span>
            </DialogTitle>
            <DialogDescription className="pl-11 text-xs sm:text-sm">
              {documentNo ? `${documentNo} - ` : ""}PDF preview
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-lg border-border/70 bg-background px-3 text-sm shadow-sm sm:h-10 sm:px-4"
              onClick={printPdf}
              disabled={!frameReady || previewQuery.isLoading || previewQuery.isError}
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button
              type="button"
              className="h-9 rounded-lg px-3 text-sm shadow-sm sm:h-10 sm:px-4"
              onClick={downloadPdf}
              disabled={previewQuery.isLoading || previewQuery.isError}
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-secondary/50 p-2 sm:p-4">
          {previewQuery.isLoading ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-border/60 bg-background/70">
              <div className="flex flex-col items-center gap-3 text-sm font-medium text-muted-foreground">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                Preparing PDF preview...
              </div>
            </div>
          ) : previewQuery.isError ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-destructive/20 bg-background p-6 text-center">
              <div>
                <p className="font-semibold text-foreground">PDF preview could not be loaded.</p>
                <Button type="button" variant="outline" className="mt-4 rounded-lg" onClick={() => previewQuery.refetch()}>
                  Try again
                </Button>
              </div>
            </div>
          ) : previewQuery.data?.html ? (
            <div className="h-full overflow-hidden rounded-xl border border-border/70 bg-white shadow-sm">
              <iframe
                ref={frameRef}
                title={`${title} PDF preview`}
                srcDoc={previewQuery.data.html}
                className="h-full w-full bg-white"
                onLoad={() => setFrameReady(true)}
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
