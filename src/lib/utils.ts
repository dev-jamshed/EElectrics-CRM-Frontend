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

