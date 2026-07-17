import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function currency(value: number | string | null | undefined) {
  const numberValue = Number(value ?? 0);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP"
  }).format(numberValue);
}

export function displayName(client?: { firstName?: string; lastName?: string; company?: string } | null) {
  if (!client) return "No client";
  return client.company || [client.firstName, client.lastName].filter(Boolean).join(" ") || "No client";
}

export function plainTextFromHtml(value?: string | null) {
  const source = String(value ?? "").trim();
  if (!source) return "";
  if (typeof DOMParser === "undefined") return source.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const parsed = new DOMParser().parseFromString(source, "text/html");
  parsed.querySelectorAll("script, style, iframe, object, embed").forEach((node) => node.remove());
  return (parsed.body.textContent || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function documentTypeLabel(type?: string) {
  if (type === "BOOKING") return "Booking";
  if (type === "INVOICE") return "Invoice";
  if (type === "QUOTATION") return "Quotation";
  return type || "Document";
}

export function hasDocumentRevisionActivity(doc: {
  parentDocumentId?: string | null;
  rootDocumentId?: string | null;
  id?: string;
  revisionNo?: number;
}) {
  return Boolean(
    doc.parentDocumentId ||
      (doc.rootDocumentId && doc.rootDocumentId !== doc.id) ||
      Number(doc.revisionNo ?? 1) > 1
  );
}

export function documentDisplayTitle(doc: {
  id?: string;
  type?: string;
  documentNo?: string;
  parentDocumentId?: string | null;
  rootDocumentId?: string | null;
  revisionNo?: number;
  revisions?: unknown[];
}) {
  const typeLabel = documentTypeLabel(doc.type);
  const revisionLabel = hasDocumentRevisionActivity(doc) ? ` Revision ${doc.revisionNo ?? 1}` : "";
  return `${typeLabel}${revisionLabel}${doc.documentNo ? ` - ${doc.documentNo}` : ""}`;
}
