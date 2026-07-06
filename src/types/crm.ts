export type DocumentType = "BOOKING" | "INVOICE" | "QUOTATION";
export type DocumentStatus = "DRAFT" | "SENT" | "CONFIRMED" | "PAID" | "CANCELLED";
export type LineItemKind = "MATERIAL" | "LABOUR" | "OTHER";

export type Client = {
  id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  totals?: {
    bookings: number;
    invoices: number;
    quotations: number;
  };
  caseFiles?: CaseFile[];
  documents?: DocumentRecord[];
};

export type CaseFile = {
  id: string;
  serialNo: number;
  title?: string;
  documents?: DocumentRecord[];
};

export type LineItem = {
  id?: string;
  kind: LineItemKind;
  title: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  total?: number;
};

export type Attachment = {
  id?: string;
  name: string;
  mimeType?: string;
  size?: number;
  dataUrl: string;
};

export type DocumentRecord = {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  documentNo: string;
  caseFile?: CaseFile | null;
  caseFileId?: string;
  client?: Client | null;
  clientId?: string;
  parentDocumentId?: string;
  rootDocumentId?: string;
  revisionNo: number;
  issueDate?: string;
  dueDate?: string;
  bookingDate?: string;
  jobTitle: string;
  description?: string;
  greeting?: string;
  emailNote?: string;
  cc?: string;
  phoneNo?: string;
  postalCode?: string;
  addressLine?: string;
  extraAddress?: string;
  selectedAddress?: unknown;
  price?: string | number;
  includeOptions?: string;
  sendMail?: boolean;
  sendImages?: boolean;
  invoiceCheck?: boolean;
  emailSubject?: string;
  emailBody?: string;
  pdfNotes?: string;
  emailStatus?: string;
  emailError?: string;
  subtotal: string | number;
  total: string | number;
  paymentStatus: string;
  paymentUrl?: string;
  pdfUrl?: string;
  sentAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  lineItems: LineItem[];
  attachments?: Attachment[];
  revisions?: DocumentRecord[];
};

export type AddressSuggestion = {
  id: string;
  label: string;
  line: string;
  city?: string;
  postcode?: string;
  source: "woosmap" | "postcodes.io";
};

export type DashboardSummary = {
  counts: {
    clients: number;
    bookings: number;
    invoices: number;
    quotations: number;
  };
  unpaidInvoiceTotal: string | number;
  recentDocuments: DocumentRecord[];
};
