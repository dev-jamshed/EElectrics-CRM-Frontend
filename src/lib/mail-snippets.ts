export type MailSnippet = {
  id: string;
  title: string;
  text: string;
  category?: string;
};

export const mailSnippetsKey = "modern-crm-mail-snippets";

const defaultMailSnippets: MailSnippet[] = [
  { id: "thanks", title: "Thanks for your reply", text: "Thanks for your reply. We will check and get back to you shortly.", category: "Follow up" },
  { id: "attached", title: "Please find attached", text: "Please find attached the requested document.", category: "Custom" },
  { id: "invoice-attached", title: "Invoice attached", text: "Please find attached your invoice. If you have any questions, please reply to this email.", category: "Invoice" },
  { id: "quotation-attached", title: "Quotation attached", text: "Please find attached your quotation. Please let us know if you would like to proceed or need any changes.", category: "Quotation" },
  { id: "booking-confirm", title: "Confirm booking", text: "Please click the confirmation link in this email to confirm your booking.", category: "Booking" },
  { id: "booking-schedule", title: "Schedule confirmation", text: "Your booking has been scheduled. Our engineer will attend at the agreed date and time.", category: "Booking" },
  { id: "payment-received", title: "Payment received", text: "Thank you, your payment has been received and updated on our system.", category: "Payment" },
  { id: "payment-reminder", title: "Payment reminder", text: "This is a friendly reminder that payment is still outstanding.", category: "Payment" },
  { id: "site-access", title: "Site access", text: "Please make sure clear access is available for the engineer on arrival.", category: "Booking" },
  { id: "closing", title: "Professional closing", text: "Regards,\nE Electrics Ltd\n0800 999 1452", category: "Custom" }
];

export function readMailSnippets(): MailSnippet[] {
  try {
    const raw = localStorage.getItem(mailSnippetsKey);
    if (!raw) return defaultMailSnippets;
    const stored = JSON.parse(raw) as MailSnippet[];
    return Array.isArray(stored) ? stored.filter((item) => item?.id && item?.title && item?.text) : defaultMailSnippets;
  } catch {
    return defaultMailSnippets;
  }
}

export function appendSnippetText(current: string, snippet: string) {
  return [current.trimEnd(), snippet.trim()].filter(Boolean).join(current.trim() ? "\n\n" : "");
}
