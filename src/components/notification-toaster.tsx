import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Toaster, useSonner } from "sonner";
import { playNotificationSound, primeNotificationSound, type NotificationSound } from "@/lib/notification-sound";

const playedToastIds = new Set<string>();

export function NotificationToaster() {
  const { toasts } = useSonner();

  useEffect(() => {
    const prime = () => primeNotificationSound();
    window.addEventListener("pointerdown", prime, { once: true });
    window.addEventListener("keydown", prime, { once: true });
    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };
  }, []);

  useEffect(() => {
    toasts.forEach((item) => {
      const id = String(item.id);
      if (playedToastIds.has(id) || item.type === "loading") return;
      playedToastIds.add(id);
      const title = typeof item.title === "string" ? item.title.toLowerCase() : "";
      const kind: NotificationSound = id.startsWith("mail-") || title.includes("new email")
        ? "mail"
        : item.type === "success"
          ? "success"
          : item.type === "error"
            ? "error"
            : "info";
      playNotificationSound(kind);
    });

    if (playedToastIds.size > 200) {
      const recent = Array.from(playedToastIds).slice(-100);
      playedToastIds.clear();
      recent.forEach((id) => playedToastIds.add(id));
    }
  }, [toasts]);

  return (
    <Toaster
      richColors
      closeButton
      position="top-right"
      duration={4500}
      visibleToasts={4}
      gap={10}
      mobileOffset={{ top: 12, left: 12, right: 12 }}
      pauseWhenPageIsHidden
      icons={{
        success: <CheckCircle2 className="h-5 w-5" />,
        info: <Info className="h-5 w-5" />,
        warning: <TriangleAlert className="h-5 w-5" />,
        error: <AlertCircle className="h-5 w-5" />,
        loading: <Loader2 className="h-5 w-5 animate-spin" />
      }}
      toastOptions={{
        classNames: {
          toast: "!rounded-2xl !border-border/70 !bg-card/95 !text-foreground !shadow-apple !backdrop-blur-xl",
          title: "!text-sm !font-semibold !text-foreground",
          description: "!text-xs !leading-5 !text-muted-foreground",
          closeButton: "!border-border/70 !bg-background !text-muted-foreground hover:!text-foreground",
          actionButton: "!rounded-lg !bg-primary !px-3 !font-semibold !text-primary-foreground"
        }
      }}
    />
  );
}
