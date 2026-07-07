import axios from "axios";
import type { Client, DocumentRecord, DocumentType, DashboardSummary, AddressSuggestion, MailboxSummary, MailboxThread } from "@/types/crm";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000/api"
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("modern-crm-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const crmApi = {
  login: async (payload: { email: string; password: string }) =>
    (await api.post<{ token: string; user: { name: string; email: string; role: string } }>("/auth/login", payload)).data,
  me: async () => (await api.get<{ name: string; email: string; role: string }>("/auth/me")).data,
  dashboard: async () => (await api.get<DashboardSummary>("/dashboard")).data,
  clients: async (q?: string) => (await api.get<Client[]>("/clients", { params: { q } })).data,
  client: async (id: string) => (await api.get<Client>(`/clients/${id}`)).data,
  documents: async (params?: { type?: DocumentType; status?: string; q?: string }) =>
    (await api.get<DocumentRecord[]>("/documents", { params })).data,
  document: async (id: string) => (await api.get<DocumentRecord>(`/documents/${id}`)).data,
  createDocument: async (payload: unknown) => (await api.post<DocumentRecord>("/documents", payload)).data,
  updateDocument: async (id: string, payload: unknown) =>
    (await api.put<DocumentRecord>(`/documents/${id}`, payload)).data,
  deleteDocument: async (id: string) => (await api.delete<{ id: string; deleted: boolean }>(`/documents/${id}`)).data,
  cloneDocument: async (id: string) => (await api.post<DocumentRecord>(`/documents/${id}/clone`, {})).data,
  sendDocument: async (id: string) => (await api.post<DocumentRecord>(`/documents/${id}/send`, {})).data,
  markPaid: async (id: string) => (await api.post<DocumentRecord>(`/documents/${id}/mark-paid`, {})).data,
  addresses: async (q: string) => (await api.get<AddressSuggestion[]>("/addresses/search", { params: { q } })).data,
  pdfPreview: async (id: string) => (await api.get<{ html: string }>(`/pdf/documents/${id}`)).data,
  pdfDownloadUrl: (id: string) => `${String(api.defaults.baseURL ?? "").replace(/\/$/, "")}/pdf/documents/${id}/download`,
  mailboxStreamUrl: (token: string) =>
    `${String(api.defaults.baseURL ?? "").replace(/\/$/, "")}/mailbox/stream?token=${encodeURIComponent(token)}`,
  mailboxSummary: async () => (await api.get<MailboxSummary>("/mailbox/summary")).data,
  mailboxThreads: async () => (await api.get<MailboxThread[]>("/mailbox/threads")).data,
  mailboxThread: async (id: string) => (await api.get<MailboxThread>(`/mailbox/threads/${id}`)).data,
  mailboxReply: async (id: string, body: string) => (await api.post<MailboxThread>(`/mailbox/threads/${id}/reply`, { body })).data,
  mailboxMarkRead: async (id: string) => (await api.post<MailboxThread>(`/mailbox/threads/${id}/read`, {})).data,
  mailboxSync: async () => (await api.post<{ imported: number }>("/mailbox/sync", {})).data
};
