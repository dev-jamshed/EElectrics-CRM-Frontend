import axios from "axios";
import type { Client, DocumentRecord, DocumentType, DashboardSummary, AddressSuggestion, MailboxSummary, MailboxThread } from "@/types/crm";

export type AppSettings = {
  profileName: string;
  profileEmail: string;
  profilePhone: string;
  profileAvatar: string;
  companyName: string;
  companyAddress: string;
  registrationNo: string;
  napitNo: string;
  companyPhone: string;
  companyEmail: string;
};

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
  adminUsers: async () => (await api.get<Array<{ id: string; name: string; email: string; status: "Active"; lastLogin: string }>>("/auth/users")).data,
  createAdminUser: async (payload: { name: string; email: string; password: string }) =>
    (await api.post<{ id: string; name: string; email: string; status: "Active"; lastLogin: string }>("/auth/users", payload)).data,
  deleteAdminUser: async (id: string) => (await api.delete<{ id: string; deleted: boolean }>(`/auth/users/${id}`)).data,
  appSettings: async (currentEmail: string) => (await api.get<AppSettings>("/auth/settings", { params: { currentEmail } })).data,
  updateAppSettings: async (payload: AppSettings & { currentEmail: string }) =>
    (await api.put<AppSettings>("/auth/settings", payload)).data,
  changePassword: async (payload: { currentEmail: string; currentPassword: string; newPassword: string }) =>
    (await api.post<{ updated: boolean }>("/auth/change-password", payload)).data,
  dashboard: async () => (await api.get<DashboardSummary>("/dashboard")).data,
  clients: async (q?: string) => (await api.get<Client[]>("/clients", { params: { q } })).data,
  client: async (id: string) => (await api.get<Client>(`/clients/${id}`)).data,
  updateClient: async (id: string, payload: unknown) => (await api.put<Client>(`/clients/${id}`, payload)).data,
  documents: async (params?: { type?: DocumentType; status?: string; q?: string; clientId?: string }) =>
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
  pdfDownloadUrl: (id: string) => `${String(api.defaults.baseURL ?? "").replace(/\/$/, "")}/pdf/documents/${id}/download?action=download`,
  mailboxStreamUrl: (token: string) =>
    `${String(api.defaults.baseURL ?? "").replace(/\/$/, "")}/mailbox/stream?token=${encodeURIComponent(token)}`,
  mailboxSummary: async () => (await api.get<MailboxSummary>("/mailbox/summary")).data,
  mailboxThreads: async (folder?: string) => (await api.get<MailboxThread[]>("/mailbox/threads", { params: { folder } })).data,
  mailboxThreadByDocument: async (documentId: string) =>
    (await api.get<MailboxThread | null>(`/mailbox/documents/${documentId}/thread`)).data,
  mailboxThread: async (id: string) => (await api.get<MailboxThread>(`/mailbox/threads/${id}`)).data,
  mailboxAttachmentUrl: (messageId: string, attachmentId: string) => {
    const token = localStorage.getItem("modern-crm-token") ?? "";
    return `${String(api.defaults.baseURL ?? "").replace(/\/$/, "")}/mailbox/messages/${messageId}/attachments/${attachmentId}?token=${encodeURIComponent(token)}`;
  },
  mailboxReply: async (id: string, body: string, replyToMessageId?: string) =>
    (await api.post<MailboxThread>(`/mailbox/threads/${id}/reply`, { body, replyToMessageId })).data,
  mailboxToggleStar: async (id: string) => (await api.post<MailboxThread>(`/mailbox/threads/${id}/star`, {})).data,
  mailboxToggleArchive: async (id: string) => (await api.post<MailboxThread>(`/mailbox/threads/${id}/archive`, {})).data,
  mailboxTrashThread: async (id: string) => (await api.post<MailboxThread>(`/mailbox/threads/${id}/trash`, {})).data,
  mailboxRestoreThread: async (id: string) => (await api.post<MailboxThread>(`/mailbox/threads/${id}/restore`, {})).data,
  mailboxDeleteThread: async (id: string) =>
    (await api.delete<{ deleted: boolean; threadId: string }>(`/mailbox/threads/${id}`)).data,
  mailboxReplyWithAttachments: async (id: string, body: string, files: File[], replyToMessageId?: string) => {
    const formData = new FormData();
    formData.append("body", body);
    if (replyToMessageId) formData.append("replyToMessageId", replyToMessageId);
    files.forEach((file) => formData.append("attachments", file));
    return (await api.post<MailboxThread>(`/mailbox/threads/${id}/reply-with-attachments`, formData)).data;
  },
  mailboxSendEmail: async (payload: { to: string; cc?: string; subject: string; body: string; files: File[] }) => {
    const formData = new FormData();
    formData.append("to", payload.to);
    if (payload.cc) formData.append("cc", payload.cc);
    formData.append("subject", payload.subject);
    formData.append("body", payload.body);
    payload.files.forEach((file) => formData.append("attachments", file));
    return (await api.post<MailboxThread>("/mailbox/send", formData)).data;
  },
  mailboxDeleteMessage: async (messageId: string) =>
    (await api.delete<{ deleted: boolean; threadDeleted: boolean; threadId: string }>(`/mailbox/messages/${messageId}`)).data,
  mailboxMarkRead: async (id: string) => (await api.post<MailboxThread>(`/mailbox/threads/${id}/read`, {})).data,
  mailboxSync: async () => (await api.post<{ imported: number }>("/mailbox/sync", {})).data
};
