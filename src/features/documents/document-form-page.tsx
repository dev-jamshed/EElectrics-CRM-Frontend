import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Banknote,
  Bold,
  Calendar,
  Check,
  ChevronDown,
  CreditCard,
  Download,
  FileText,
  GripVertical,
  Hash,
  Home,
  ImagePlus,
  Italic,
  Link2,
  List,
  Mail,
  Monitor,
  Percent,
  Phone,
  Plus,
  PoundSterling,
  Receipt,
  Redo2,
  Save,
  Search,
  Send,
  Settings,
  Smartphone,
  Trash2,
  Underline,
  Undo2,
  User
} from "lucide-react";
import { AddressCombobox } from "@/features/addresses/address-combobox";
import { crmApi } from "@/lib/api";
import { appendSnippetText, readMailSnippets } from "@/lib/mail-snippets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import type { Attachment, Client, DocumentRecord, DocumentType, LineItem } from "@/types/crm";

const includeChoices = [
  { value: "labour", label: "Labour" },
  { value: "material", label: "Material" },
  { value: "total_paid", label: "Total Paid" }
];

const defaultBookingNote =
  "A 12-month warranty is provided on all workmanship. Materials supplied by E Electrics are covered by the manufacturer's warranty.";

const defaultInvoiceNote = defaultBookingNote;

const oldCrmLogoUrl = "https://res.cloudinary.com/djneoqoqk/image/upload/v1734727264/email_logo_aqoox6.png";

function createLineItemId() {
  return globalThis.crypto?.randomUUID?.() ?? `line-item-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const defaultInvoiceRows: LineItem[] = [
  { id: createLineItemId(), kind: "LABOUR", title: "Labour installation", description: "", quantity: 1, unitPrice: 0, total: 0 },
  { id: createLineItemId(), kind: "MATERIAL", title: "Materials", description: "", quantity: 1, unitPrice: 0, total: 0 }
];

const invoiceInputClass = "border-[#cbd5e1] bg-white text-[#111827] placeholder:text-[#94a3b8] shadow-none focus:ring-primary/20 dark:border-border/70 dark:bg-background dark:text-foreground dark:placeholder:text-muted-foreground";
const formInputClass = `${invoiceInputClass} h-10 rounded-lg px-3 text-sm`;
const fieldLabelClass = "text-sm font-medium text-foreground";

function labels(type: DocumentType) {
  if (type === "BOOKING") {
    return {
      title: "Create Booking",
      date: "Booking date",
      body: "Booking description",
      price: "Booking price",
      greeting: "Greeting description"
    };
  }
  if (type === "QUOTATION") {
    return {
      title: "Create Quotation",
      date: "Quotation date",
      body: "Quotation description",
      price: "Quotation price",
      greeting: "Greeting description"
    };
  }
  return {
    title: "Create Invoice",
    date: "Invoice date",
    body: "Invoice description",
    price: "Invoice price",
    greeting: "Greeting description"
  };
}

function parseInclude(value?: string) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed.flatMap((item) => {
      if (item === "labour_material") return ["labour", "material"];
      if (item === "labour_only") return ["labour"];
      return [String(item)];
    });
    return Array.from(new Set(normalized));
  } catch {
    return [];
  }
}

function parseSelectedAddress(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function buildOldBookingPreviewHtml(form: {
  documentNo: string;
  bookingDate: string;
  firstName: string;
  lastName: string;
  addressLine: string;
  extraAddress: string;
  greeting: string;
  emailNote: string;
}) {
  const clientName = [form.firstName, form.lastName].filter(Boolean).join(" ");
  const notes = richText(form.emailNote);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    .new-p{
      margin: 0px;
      padding: 0px;
      font-size: 14px;
    }
    body {
      padding: 0px;
      margin: 0px;
      font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif;
      text-align: center;
      color: black;
      background: #d3d3d321;
    }
    body a {
      color: #06f;
    }
    .invoice-box {
      background-color: white;
      max-width: 850px;
      margin: auto;
      padding: 20px 0px;
      padding-bottom: 0px;
      font-size: 16px;
      font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif;
      color: black;
    }
    .invoice-box table {
      width: 100%;
      line-height: inherit;
      text-align: left;
      border-collapse: collapse;
    }
    .invoice-box table td {
      vertical-align: top;
    }
    .information_td{
      font-size: 13px;
      padding: 0px !important;
    }
    .text-align-right-td{
      text-align: right;
      overflow-wrap: anywhere;
    }
    .title_user{
      width: 71px;
    }
    .colum_user{
      width: 33%;
    }
    .logo{
      width: 100%;
      max-width: 200px
    }
    .greeting-desc{
      padding:20px 30px;
      font-size: 13px;
      text-align: left;
      overflow-wrap: anywhere;
    }
    .notes{
      font-size: 16px !important;
    }
    .footer{
      padding: 10px 20px;
      background-color:#DD2D3E;
      color: white;
      font-size: 13px !important;
    }
    @media only screen and (max-width: 640px) {
      .logo{
        width: 100%;
        max-width: 180px
      }
      .colum_user{
        width: 45%;
      }
      .booking-heading{
        font-size: 16px !important;
      }
    }
  </style>
</head>
<body>
  <div class="color-container" style="background:#d3d3d321;width: 100%;height: 100%;padding: 50px 0px;">
    <div class="invoice-box">
      <table>
        <tr class="top">
          <td style="padding: 20px 30px;padding-bottom: 0px;">
            <table>
              <tr>
                <td colspan="2" style="padding:0px !important">
                  <img class="logo" src="${oldCrmLogoUrl}" title="logo" alt="Company logo" />
                </td>
              </tr>
              <tr class="logo-td">
                <td style="padding-bottom: 5px;" class="logo-td">
                  <p class="new-p"><strong>E Electrics | E Electrics Limited</strong></p>
                  <p class="new-p"><strong>Head Office: </strong>Dent Close, Essex,RM15 5DS</p>
                  <p class="new-p">Registration No: 12418331</p>
                  <p class="new-p">NAPIT Member No: 65513</p>
                  <p class="new-p">info@eelectrics.co.uk | 0800 999 1452 </p>
                </td>
                <td class="colum_user">
                  <table>
                    <tr><td class="information_td title_user">Booking :</td><td class="information_td text-align-right-td">${escapeHtml(form.documentNo || "-")}</td></tr>
                    <tr><td class="information_td title_user">Date :</td><td class="information_td text-align-right-td">${escapeHtml(formatOldDate(form.bookingDate))}</td></tr>
                    <tr><td class="information_td title_user">FAO :</td><td class="information_td text-align-right-td">${escapeHtml(clientName || "-")}</td></tr>
                    <tr><td class="information_td title_user">Address :</td><td class="information_td text-align-right-td">${escapeHtml(form.addressLine || "-")}</td></tr>
                    ${form.extraAddress ? `<tr><td class="information_td title_user">Address 2 :</td><td class="information_td text-align-right-td">${escapeHtml(form.extraAddress)}</td></tr>` : ""}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="booking-heading" style="font-weight: bold;font-size: 20px;padding: 5px 0px 5px 0px;text-align: center;">BOOKING</td>
        </tr>
        <tr>
          <td class="greeting-desc">${richText(form.greeting) || "-"}</td>
        </tr>
        ${
          notes
            ? `<tr><td colspan="2" style="width: 100% !important;padding: 0px 30px; overflow-wrap:break-word !important;padding-top: 10px;padding-bottom: 10px;font-size: 13px;"><p class="notes" style=" margin-bottom: 0px; margin-top: 0px;padding-bottom: 5px;font-weight: bold;">Notes</p><table><tr><td class="display-block-sm" style="height: 1px;border-bottom:1.5px solid #DD2D3E;display: block !important;"></td></tr></table>${notes}</td></tr>`
            : ""
        }
      </table>
      <table>
        <tr>
          <td class="footer" style="text-align: center;margin-top: 20px;display: block;">
            <p style="font-weight: bold;line-height: 18px;margin: 8px 0px; padding: 25px 0px;">© 2023 EElectrics. All rights reserved. For bookings and inquiries, contact us at <a href="mailto:info@eelectrics.co.uk" style="color: white;">info@eelectrics.co.uk</a> .</p>
          </td>
        </tr>
      </table>
    </div>
  </div>
</body>
</html>`;
}

function buildOldAmountPreviewHtml(form: {
  type: DocumentType;
  documentNo: string;
  issueDate: string;
  firstName: string;
  lastName: string;
  addressLine: string;
  extraAddress: string;
  jobTitle: string;
  greeting: string;
  body: string;
  emailNote: string;
  includeOptions: string[];
  total: number;
}) {
  const title = form.type === "QUOTATION" ? "Quotation" : "Invoice";
  const clientName = [form.firstName, form.lastName].filter(Boolean).join(" ");
  const includeLabel = includeTotalLabel(form.includeOptions);
    const notes = richText(form.emailNote);
    const greeting = richText(form.greeting);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    #doc-target{font-family:sans-serif;-webkit-font-smoothing:antialiased;color:#000;line-height:1.6em;margin:0 auto;}
    #outer{margin-bottom:10px;width:747px;margin-left:auto;margin-right:auto;background:#fff;}
    body{padding:0;margin:0;font-family:'Helvetica Neue','Helvetica',Helvetica,Arial,sans-serif;color:black;background:#E8E8E8;}
    .main-container{padding:0 20px;}
    .top-orange-line{padding:8px 0;border-top:3px solid #DD2D3E;}
    .header{display:flex;}
    .header .col-1{width:55%;}
    .header .col-2{width:45%;}
    .header-col-1-details p,.header-col-2-details p{font-size:13px;margin:0;padding:0;line-height:16.5px;font-family:'Helvetica Neue','Helvetica',Helvetica,Arial,sans-serif;}
    .user-detail{display:flex;justify-content:space-between;}
    .u-1{width:71px;}
    .u-2{text-align:right!important;flex:1;overflow-wrap:anywhere;}
    .logo img{display:block;width:100%;max-width:180px;padding-bottom:10px;}
    .mail-heading p{border-bottom:3px solid #DD2D3E;font-size:20px;font-weight:bold;padding-bottom:0;margin:16px 0 13px;}
    .description-container{margin:10px 0;line-height:17.5px;}
    .description-header,.final-price-footer{background-color:#DD2D3E;font-weight:bold;font-size:13px;color:white;display:flex;align-items:center;justify-content:space-between;padding:0 20px;}
    .description-header p,.final-price-footer p,.discount-price-footer p{margin:0;padding:10px 0;}
    .description-body{background-color:PapayaWhip;}
    .job-description-div,.description-div,.discount-price-footer{padding:0 20px;font-size:13px;}
    .discount-price-footer{display:flex;align-items:center;justify-content:space-between;font-weight:bold;}
    .job-description-div{border-bottom:1px solid #DD2D3E;display:flex;align-items:center;}
    .job-description-div p{padding:10px 0;margin:0;}
    .description-div{border-bottom:2px solid #DD2D3E;min-height:95px;overflow-wrap:anywhere;}
    .note-container{line-height:17.5px;}
    .note-container p{font-size:13px;margin:5px 0;}
    .note{margin:5px 0;padding:5px 0!important;font-size:15px!important;font-weight:bold;border-bottom:2px solid #DD2D3E;}
    @page{size:850px 900px;margin:0!important;padding:0!important}
    @media(max-width:820px){#outer{width:100%;}.header{display:block}.header .col-1,.header .col-2{width:100%;}.header .col-2{margin-top:14px;}}
  </style>
</head>
<body>
  <div id="outer"><div id="doc-target"><div id="lipsum"><div class="main-container">
    <div class="top-orange-line"></div>
    <div class="logo"><img src="${oldCrmLogoUrl}" title="logo" alt="Company logo" /></div>
    <div class="header">
      <div class="col-1"><div class="header-col-1-details">
        <p style="font-weight: bold;">E Electrics | E Electrics Limited</p>
        <p style="font-weight: bold;">Head Office: Dent Close, Essex,RM15 5DS</p>
        <p>Registration No: 12418331 </p>
        <p>NAPIT Member No: 65513 </p>
        <p>info@eelectrics.co.uk | 0800 999 1452 </p>
      </div></div>
      <div class="col-2"><div class="header-col-2-details">
        ${previewDetailRow(`${title} :`, form.documentNo || "-")}
        ${previewDetailRow("Date :", formatOldDate(form.issueDate))}
        ${previewDetailRow("FAO :", clientName || "-")}
        ${previewDetailRow("Address :", form.addressLine || "-")}
        ${form.extraAddress ? previewDetailRow("Address 2 :", form.extraAddress) : ""}
      </div></div>
    </div>
    <div class="mail-heading"><p>${title}</p></div>
    <div class="description-container">
      <div class="description-header"><p>Description</p><p>Price</p></div>
      <div class="description-body">
        <div class="job-description-div"><p>${escapeHtml(form.jobTitle || "")}</p></div>
        <div class="description-div">${[greeting, richText(form.body)].filter(Boolean).join("<br />") || "-"}</div>
      </div>
      <div class="description-footer">
        ${includeLabel ? `<div class="discount-price-footer"><p>${escapeHtml(includeLabel)}</p><p>${formatPounds(form.total)}</p></div>` : ""}
        <div class="final-price-footer"><p>Total to be Paid</p><p>${formatPounds(form.total)}</p></div>
      </div>
    </div>
    ${notes ? `<div class="note-container"><p class="note">Notes:</p><p>${notes}</p></div>` : ""}
  </div></div></div></div>
</body>
</html>`;
}

function previewDetailRow(label: string, value: string) {
  return `<div class="user-detail"><div class="u-1"><p>${escapeHtml(label)}</p></div><div class="u-2"><p>${escapeHtml(value || "-")}</p></div></div>`;
}

function includeTotalLabel(includes: string[]) {
  const hasLabour = includes.includes("labour");
  const hasMaterial = includes.includes("material");
  if (hasLabour && hasMaterial) return "Total Including Labour and Materials";
  if (hasLabour) return "Total Including Only Labour";
  if (hasMaterial) return "Total Including Only Materials";
  if (includes.includes("total_paid")) return "Total Paid";
  return "";
}

function formatPounds(value: number) {
  return `£ ${Number(value || 0).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatOldDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const parts = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("day")} - ${part("month")} - ${part("year")}`;
}

function richText(value: string) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const withoutDangerousTags = text.replace(/<\s*(script|style|iframe)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  const withoutHandlers = withoutDangerousTags.replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "");
  if (/<[a-z][\s\S]*>/i.test(withoutHandlers)) return withoutHandlers;
  return escapeHtml(withoutHandlers).replace(/\r?\n/g, "<br />");
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function readFile(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        name: file.name,
        mimeType: file.type,
        size: file.size,
        dataUrl: String(reader.result)
      });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function lineItemTotal(item: LineItem) {
  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.unitPrice || 0);
  return quantity * unitPrice;
}

function normalizeLineItem(item: LineItem): LineItem {
  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.unitPrice || 0);
  return {
    id: item.id ?? createLineItemId(),
    kind: item.kind,
    title: item.title,
    description: item.description ?? "",
    quantity,
    unitPrice,
    total: quantity * unitPrice
  };
}

function includeOptionsFromLineItems(items: LineItem[]) {
  const includes = new Set<string>();
  if (items.some((item) => item.kind === "LABOUR")) includes.add("labour");
  if (items.some((item) => item.kind === "MATERIAL")) includes.add("material");
  if (!includes.size) includes.add("total_paid");
  return Array.from(includes);
}

function invoiceBodyFromItems(notes: string, items: LineItem[]) {
  const rows = items
    .filter((item) => item.title.trim())
    .map((item) => {
      const description = item.description?.trim() ? ` - ${escapeHtml(item.description)}` : "";
      return `<li><strong>${escapeHtml(item.title)}</strong>${description}: ${formatPounds(lineItemTotal(item))}</li>`;
    })
    .join("");
  const itemHtml = rows ? `<ul>${rows}</ul>` : "";
  return [itemHtml, richText(notes)].filter(Boolean).join("");
}

function clientDisplayName(firstName: string, lastName: string) {
  return [firstName, lastName].filter(Boolean).join(" ") || "-";
}

export function DocumentFormPage() {
  const { id, type } = useParams();
  const [searchParams] = useSearchParams();
  const sourceDocumentId = searchParams.get("sourceDocumentId") ?? undefined;
  const clientIdParam = searchParams.get("clientId") ?? undefined;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);
  const documentType = (type as DocumentType | undefined) ?? "INVOICE";
  const isBillingRoute = documentType === "INVOICE" || documentType === "QUOTATION";

  const { data: existing } = useQuery({
    queryKey: ["document", id],
    queryFn: () => crmApi.document(id!),
    enabled: isEdit
  });
  const { data: source } = useQuery({
    queryKey: ["document", sourceDocumentId],
    queryFn: () => crmApi.document(sourceDocumentId!),
    enabled: Boolean(sourceDocumentId)
  });
  const { data: selectedClient } = useQuery({
    queryKey: ["client", clientIdParam],
    queryFn: () => crmApi.client(clientIdParam!),
    enabled: Boolean(clientIdParam && !isEdit && !sourceDocumentId)
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients", "invoice-form"],
    queryFn: () => crmApi.clients(),
    enabled: isBillingRoute
  });

  const seed = useMemo<DocumentRecord | undefined>(() => existing ?? source, [existing, source]);
  const copyDocumentText = !isEdit && Boolean(source);
  const [addressLookup, setAddressLookup] = useState({ query: "", nonce: 0 });
  const submitLockedRef = useRef(false);
  const [invoiceNotesOpen, setInvoiceNotesOpen] = useState(true);
  const [invoicePreviewMode, setInvoicePreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [previewHtml, setPreviewHtml] = useState<{ title: string; html: string } | null>(null);

  const [form, setForm] = useState({
    type: documentType,
    status: "DRAFT",
    clientId: "",
    firstName: "",
    lastName: "",
    email: "",
    cc: "",
    phone: "",
    postalCode: "",
    addressLine: "",
    extraAddress: "",
    selectedAddress: undefined as unknown,
    jobTitle: "",
    description: "",
    greeting: "",
    emailNote: documentType === "BOOKING" || isBillingRoute ? defaultInvoiceNote : "",
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    bookingDate: "",
    price: "",
    labourDescription: "",
    labourPrice: "",
    materialDescription: "",
    materialPrice: "",
    includeOptions: [] as string[],
    sendMail: true,
    sendImages: false,
    invoiceCheck: false,
    emailSubject: "",
    emailBody: "",
    pdfNotes: "",
    attachments: [] as Attachment[],
    lineItems: isBillingRoute ? defaultInvoiceRows : ([] as LineItem[])
  });
  const itemSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const copy = labels(form.type as DocumentType);
  const isBillingDocument = form.type === "INVOICE" || form.type === "QUOTATION";
  const billingNoun = form.type === "QUOTATION" ? "Quotation" : "Invoice";

  useEffect(() => {
    if (!seed) return;
    setForm((current) => ({
      ...current,
      type: isEdit ? seed.type : documentType,
      status: isEdit ? seed.status ?? "DRAFT" : "DRAFT",
      clientId: seed.clientId ?? seed.client?.id ?? "",
      firstName: seed.client?.firstName ?? "",
      lastName: seed.client?.lastName ?? "",
      email: seed.client?.email ?? "",
      cc: seed.cc ?? "",
      phone: seed.phoneNo ?? seed.client?.phone ?? "",
      postalCode: seed.postalCode ?? "",
      addressLine: seed.addressLine ?? "",
      extraAddress: seed.extraAddress ?? "",
      selectedAddress: parseSelectedAddress(seed.selectedAddress),
      jobTitle: seed.jobTitle ?? "",
      description: copyDocumentText ? "" : seed.description ?? "",
      greeting: copyDocumentText ? "" : seed.greeting ?? "",
      emailNote: copyDocumentText ? defaultInvoiceNote : seed.emailNote ?? (isBillingRoute ? defaultInvoiceNote : ""),
      issueDate: seed.issueDate?.slice(0, 10) ?? current.issueDate,
      dueDate: seed.dueDate?.slice(0, 10) ?? "",
      bookingDate: seed.bookingDate?.slice(0, 10) ?? "",
      price: seed.price ? String(seed.price) : seed.total ? String(seed.total) : "",
      labourDescription: seed.lineItems?.find((item) => item.kind === "LABOUR")?.description ?? "",
      labourPrice: seed.lineItems?.find((item) => item.kind === "LABOUR")?.unitPrice ? String(seed.lineItems.find((item) => item.kind === "LABOUR")?.unitPrice) : "",
      materialDescription: seed.lineItems?.find((item) => item.kind === "MATERIAL")?.description ?? "",
      materialPrice: seed.lineItems?.find((item) => item.kind === "MATERIAL")?.unitPrice ? String(seed.lineItems.find((item) => item.kind === "MATERIAL")?.unitPrice) : "",
      includeOptions: parseInclude(seed.includeOptions),
      sendMail: isEdit ? seed.sendMail ?? true : true,
      sendImages: isEdit ? seed.sendImages ?? false : false,
      invoiceCheck: isEdit ? seed.invoiceCheck ?? false : false,
      emailSubject: copyDocumentText ? "" : seed.emailSubject ?? "",
      emailBody: copyDocumentText ? "" : seed.emailBody ?? "",
      pdfNotes: copyDocumentText ? "" : seed.pdfNotes ?? "",
      attachments: copyDocumentText ? [] : seed.attachments ?? [],
      lineItems: seed.lineItems?.length ? seed.lineItems.map(normalizeLineItem) : current.lineItems
    }));
  }, [seed, isEdit, documentType, copyDocumentText]);

  useEffect(() => {
    if (!selectedClient || isEdit || sourceDocumentId) return;
    const recentDocument = selectedClient.documents?.find((item) => item.addressLine || item.extraAddress || item.postalCode);
    setForm((current) => ({
      ...current,
      clientId: selectedClient.id,
      firstName: selectedClient.firstName ?? "",
      lastName: selectedClient.lastName ?? "",
      email: selectedClient.email ?? "",
      phone: selectedClient.phone ?? "",
      postalCode: recentDocument?.postalCode ?? current.postalCode,
      addressLine: recentDocument?.addressLine ?? current.addressLine,
      extraAddress: recentDocument?.extraAddress ?? current.extraAddress
    }));
  }, [selectedClient, isEdit, sourceDocumentId]);

  const handleImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const attachments = await Promise.all(files.map(readFile));
    setForm((current) => ({ ...current, attachments: [...current.attachments, ...attachments] }));
    event.target.value = "";
  };

  const searchPostcodeAddress = () => {
    const query = form.postalCode.trim();
    if (!query) {
      toast.error("Enter postal code first");
      return;
    }
    setAddressLookup((current) => ({ query, nonce: current.nonce + 1 }));
  };

  const hasLabour = form.includeOptions.includes("labour");
  const hasMaterial = form.includeOptions.includes("material");
  const hasTotalPaid = form.includeOptions.includes("total_paid");
  const labourAmount = hasLabour ? Number(form.labourPrice || 0) : 0;
  const materialAmount = hasMaterial ? Number(form.materialPrice || 0) : 0;
  const calculatedAmount = labourAmount + materialAmount;
  const invoiceLineItems = form.lineItems
    .filter((item) => item.title.trim() || item.description?.trim() || Number(item.unitPrice || 0))
    .map(normalizeLineItem);
  const invoiceAmount = invoiceLineItems.reduce((sum, item) => sum + lineItemTotal(item), 0);
  const legacyAmount = hasLabour || hasMaterial ? calculatedAmount : Number(form.price || 0);
  const documentAmount = isBillingDocument ? invoiceAmount : legacyAmount;
  const computedIncludeOptions = isBillingDocument ? includeOptionsFromLineItems(invoiceLineItems) : form.includeOptions;

  const selectedLineItems: LineItem[] =
    isBillingDocument
      ? invoiceLineItems
      : [
          ...(hasLabour
            ? [
                {
                  kind: "LABOUR" as const,
                  title: "Labour",
                  description: form.labourDescription,
                  quantity: 1,
                  unitPrice: labourAmount,
                  total: labourAmount
                }
              ]
            : []),
          ...(hasMaterial
            ? [
                {
                  kind: "MATERIAL" as const,
                  title: "Material",
                  description: form.materialDescription,
                  quantity: 1,
                  unitPrice: materialAmount,
                  total: materialAmount
                }
              ]
            : [])
        ];

  const validateInclude = () => {
    if (form.type === "BOOKING") return true;
    if (isBillingDocument) {
      if (!invoiceLineItems.length) {
        toast.error(`Add at least one ${billingNoun.toLowerCase()} item`);
        return false;
      }
      if (invoiceLineItems.some((item) => !item.title.trim())) {
        toast.error(`Every ${billingNoun.toLowerCase()} item needs a description`);
        return false;
      }
      if (invoiceLineItems.some((item) => Number(item.quantity || 0) <= 0)) {
        toast.error(`Every ${billingNoun.toLowerCase()} item needs quantity`);
        return false;
      }
      if (!Number.isFinite(invoiceAmount) || invoiceAmount <= 0) {
        toast.error(`${billingNoun} total must be greater than zero`);
        return false;
      }
      return true;
    }
    if (!form.includeOptions.length) {
      toast.error("Select at least one include option");
      return false;
    }
    if (hasLabour && !Number(form.labourPrice)) {
      toast.error("Labour price is required");
      return false;
    }
    if (hasMaterial && !Number(form.materialPrice)) {
      toast.error("Material price is required");
      return false;
    }
    if (!hasLabour && !hasMaterial && hasTotalPaid && !Number(form.price)) {
      toast.error("Currency amount is required");
      return false;
    }
    return true;
  };

  const previewBooking = () => {
    const html = buildOldBookingPreviewHtml({
      documentNo: existing?.documentNo ?? "-",
      bookingDate: form.bookingDate || form.issueDate,
      firstName: form.firstName,
      lastName: form.lastName,
      addressLine: form.addressLine,
      extraAddress: form.extraAddress,
      greeting: form.greeting,
      emailNote: form.emailNote
    });
    setPreviewHtml({ title: "Booking Preview", html });
  };

  const previewPdf = () => {
    const html = buildOldAmountPreviewHtml({
      type: form.type as DocumentType,
      documentNo: existing?.documentNo ?? "-",
      issueDate: form.issueDate,
      firstName: form.firstName,
      lastName: form.lastName,
      addressLine: form.addressLine,
      extraAddress: form.extraAddress,
      jobTitle: form.jobTitle,
      greeting: form.greeting,
      body: isBillingDocument ? invoiceBodyFromItems(form.description || form.emailBody, selectedLineItems) : form.description || form.emailBody,
      emailNote: form.emailNote,
      includeOptions: computedIncludeOptions,
      total: documentAmount
    });
    setPreviewHtml({ title: `${billingNoun} Preview`, html });
  };

  const downloadPdf = () => {
    if (isEdit && existing?.id) {
      window.open(crmApi.pdfDownloadUrl(existing.id), "_blank");
      return;
    }
    toast.error("Save draft first, then download PDF");
  };

  const mutation = useMutation({
    mutationFn: (overrides?: { sendMail?: boolean; status?: string }) => {
      if (!validateInclude()) throw new Error("Validation failed");
      const payload = {
        type: form.type,
        status: overrides?.status ?? form.status,
        clientId: form.clientId || (isEdit ? existing?.clientId : source?.clientId),
        client: {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone
        },
        caseFileId: isEdit ? existing?.caseFileId : source?.caseFileId,
        sourceDocumentId,
        jobTitle: form.jobTitle,
        description: isBillingDocument ? invoiceBodyFromItems(form.description, selectedLineItems) : form.description,
        greeting: form.greeting,
        emailNote: form.emailNote,
        cc: form.cc,
        phoneNo: form.phone,
        postalCode: form.postalCode,
        addressLine: form.addressLine,
        extraAddress: form.extraAddress,
        selectedAddress: form.selectedAddress,
        issueDate: form.type === "BOOKING" ? undefined : form.issueDate || undefined,
        dueDate: form.dueDate || undefined,
        bookingDate: form.type === "BOOKING" ? form.bookingDate || form.issueDate || undefined : undefined,
        price: documentAmount,
        includeOptions: computedIncludeOptions,
        sendMail: overrides?.sendMail ?? form.sendMail,
        sendImages: form.sendImages,
        invoiceCheck: form.invoiceCheck,
        emailSubject: form.emailSubject,
        emailBody: form.emailBody,
        pdfNotes: form.pdfNotes,
        attachments: form.attachments,
        lineItems: selectedLineItems.map((item) => ({
          kind: item.kind,
          title: item.title,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }))
      };
      return isEdit ? crmApi.updateDocument(id!, payload) : crmApi.createDocument(payload);
    },
    onSuccess: (saved, variables) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success((variables?.sendMail ?? form.sendMail) ? "Saved and marked for email" : "Saved successfully");
      navigate(`/documents/${saved.id}`);
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "Validation failed") return;
      toast.error("Unable to save document");
    },
    onSettled: () => {
      submitLockedRef.current = false;
    }
  });

  const submitDocument = (overrides?: { sendMail?: boolean; status?: string }) => {
    if (submitLockedRef.current || mutation.isPending) return;
    submitLockedRef.current = true;
    mutation.mutate(overrides);
  };

  const updateInvoiceItem = (index: number, patch: Partial<LineItem>) => {
    setForm((current) => ({
      ...current,
      lineItems: current.lineItems.map((item, itemIndex) => (itemIndex === index ? normalizeLineItem({ ...item, ...patch }) : item))
    }));
  };

  const addInvoiceItem = (kind: LineItem["kind"] = "OTHER") => {
    setForm((current) => ({
      ...current,
      lineItems: [
        ...current.lineItems,
        {
          id: createLineItemId(),
          kind,
          title: kind === "LABOUR" ? "Labour" : kind === "MATERIAL" ? "Materials" : "Service item",
          description: "",
          quantity: 1,
          unitPrice: 0,
          total: 0
        }
      ]
    }));
  };

  const removeInvoiceItem = (index: number) => {
    setForm((current) => ({
      ...current,
      lineItems: current.lineItems.filter((_, itemIndex) => itemIndex !== index)
    }));
  };

  const reorderInvoiceItems = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setForm((current) => {
      const oldIndex = current.lineItems.findIndex((item) => item.id === active.id);
      const newIndex = current.lineItems.findIndex((item) => item.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      return { ...current, lineItems: arrayMove(current.lineItems, oldIndex, newIndex) };
    });
  };

  const addInvoiceDiscount = () => {
    setForm((current) => ({
      ...current,
      lineItems: [
        ...current.lineItems,
        {
          id: createLineItemId(),
          kind: "OTHER",
          title: "Discount",
          description: "",
          quantity: 1,
          unitPrice: -10,
          total: -10
        }
      ]
    }));
  };

  const addInvoiceVat = () => {
    const subtotal = form.lineItems.reduce((sum, item) => sum + lineItemTotal(item), 0);
    const vat = Math.max(0, subtotal * 0.2);
    setForm((current) => ({
      ...current,
      lineItems: [
        ...current.lineItems,
        {
          id: createLineItemId(),
          kind: "OTHER",
          title: "VAT",
          description: "20%",
          quantity: 1,
          unitPrice: Number(vat.toFixed(2)),
          total: Number(vat.toFixed(2))
        }
      ]
    }));
  };

  const applyInvoiceTemplate = (template: "standard" | "labour" | "materials" | "service") => {
    const templates: Record<typeof template, LineItem[]> = {
      standard: defaultInvoiceRows,
      labour: [{ kind: "LABOUR", title: "Labour installation", description: "", quantity: 1, unitPrice: 0, total: 0 }],
      materials: [{ kind: "MATERIAL", title: "Materials supplied", description: "", quantity: 1, unitPrice: 0, total: 0 }],
      service: [
        { kind: "LABOUR", title: "Electrical service visit", description: "", quantity: 1, unitPrice: 0, total: 0 },
        { kind: "OTHER", title: "Testing certificate", description: "", quantity: 1, unitPrice: 0, total: 0 }
      ]
    };
    setForm((current) => ({ ...current, lineItems: templates[template].map((item) => ({ ...normalizeLineItem(item), id: createLineItemId() })) }));
  };

  const previewModal = (
    <PreviewHtmlDialog
      preview={previewHtml}
      onOpenChange={(open) => {
        if (!open) setPreviewHtml(null);
      }}
    />
  );

  if (isBillingDocument) {
    const subtotal = form.lineItems.reduce((sum, item) => sum + lineItemTotal(item), 0);
    const normalizedRows = form.lineItems.map(normalizeLineItem);

    return (
      <div className="mx-auto w-full min-w-0 max-w-[1680px] space-y-3 text-foreground">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{isEdit ? `Edit ${billingNoun}` : `New ${billingNoun}`}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="h-10 rounded-xl border-border/70 bg-card px-5 text-foreground hover:bg-secondary" onClick={() => submitDocument({ sendMail: false, status: "DRAFT" })} loading={mutation.isPending}>
              <Save className="h-4 w-4" /> Save Draft
            </Button>
            <Button asChild size="icon" variant="outline" className="h-10 w-10 rounded-xl border-border/70 bg-card text-foreground hover:bg-secondary">
              <Link to="/documents">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/75 px-4 py-4 shadow-sm backdrop-blur-xl sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:items-center">
            {[
              ["Client", "Add client details"],
              ["Items", "Add items and amounts"],
              ["Notes", "Email and PDF text"],
              ["Preview", "Review and send"]
            ].map(([step, caption], index) => (
              <div key={step} className="flex items-center gap-4">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${index < 2 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                  {index + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold">{step}</div>
                  <div className="text-xs text-muted-foreground">{caption}</div>
                </div>
                {index < 3 ? <div className="ml-auto hidden h-px flex-1 bg-border xl:block" /> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(440px,0.9fr)] 2xl:grid-cols-[minmax(0,0.96fr)_minmax(520px,1.04fr)]">
          <div className="min-w-0 space-y-3">
            <div className="rounded-2xl border border-border/50 bg-card/75 p-4 shadow-sm backdrop-blur-xl sm:p-5">
              <h2 className="mb-4 text-base font-bold">Client & {billingNoun} Details</h2>
              <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={fieldLabelClass}>Client</span>
                  <InvoiceClientPicker
                    clients={clients}
                    value={clientDisplayName(form.firstName, form.lastName) === "-" ? "" : clientDisplayName(form.firstName, form.lastName)}
                    onType={(value) => {
                      const [firstName = "", ...rest] = value.trimStart().split(/\s+/);
                      setForm({ ...form, clientId: "", firstName, lastName: rest.join(" "), email: "", phone: "" });
                    }}
                    onSelect={(client) => {
                      const recentDocument = client.documents?.find((item) => item.addressLine || item.extraAddress || item.postalCode);
                      setForm({
                        ...form,
                        clientId: client.id,
                        firstName: client.firstName ?? "",
                        lastName: client.lastName ?? "",
                        email: client.email ?? "",
                        phone: client.phone ?? "",
                        postalCode: recentDocument?.postalCode ?? form.postalCode,
                        addressLine: recentDocument?.addressLine ?? form.addressLine,
                        extraAddress: recentDocument?.extraAddress ?? form.extraAddress
                      });
                    }}
                  />
                </label>
                <IconField icon={Mail} label="Email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} inputClassName={invoiceInputClass} iconClassName="border-border/70 bg-background text-muted-foreground" />
                <IconField icon={Phone} label="Phone" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} inputClassName={invoiceInputClass} iconClassName="border-border/70 bg-background text-muted-foreground" />
                <IconField icon={Hash} label="Reference / PO (optional)" value={form.cc} onChange={(cc) => setForm({ ...form, cc })} inputClassName={invoiceInputClass} iconClassName="border-border/70 bg-background text-muted-foreground" />
                <IconField icon={Calendar} label={`${billingNoun} Date`} type="date" value={form.issueDate} onChange={(issueDate) => setForm({ ...form, issueDate })} inputClassName={invoiceInputClass} iconClassName="border-border/70 bg-background text-muted-foreground" />
                <IconField icon={Calendar} label="Due Date" type="date" value={form.dueDate} onChange={(dueDate) => setForm({ ...form, dueDate })} inputClassName={invoiceInputClass} iconClassName="border-border/70 bg-background text-muted-foreground" />
                <IconField icon={FileText} label="Job Description" value={form.jobTitle} onChange={(jobTitle) => setForm({ ...form, jobTitle })} inputClassName={invoiceInputClass} iconClassName="border-border/70 bg-background text-muted-foreground" />
                <label className="space-y-2">
                  <span className={fieldLabelClass}>Postal Code</span>
                  <div className="flex">
                    <div className="flex h-10 w-10 items-center justify-center rounded-l-lg border border-r-0 border-[#cbd5e1] bg-white text-slate-500 dark:border-border/70 dark:bg-background dark:text-muted-foreground">
                      <Hash className="h-4 w-4" />
                    </div>
                    <Input className={`${formInputClass} rounded-none`} value={form.postalCode} onChange={(event) => setForm({ ...form, postalCode: event.target.value })} />
                    <Button type="button" className="h-10 w-10 rounded-l-none rounded-r-lg bg-[#ef1228] hover:bg-[#d90f22]" size="icon" onClick={searchPostcodeAddress}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className={fieldLabelClass}>Address</span>
                  <AddressCombobox
                    value={form.addressLine}
                    onChange={(value, selected) => setForm({ ...form, addressLine: value, selectedAddress: selected })}
                    lookupQuery={addressLookup.query}
                    lookupNonce={addressLookup.nonce}
                    inputClassName={formInputClass}
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/75 p-4 shadow-sm backdrop-blur-xl">
              <h2 className="mb-3 text-base font-bold">Items</h2>
              <div className="overflow-hidden rounded-2xl border border-border/60">
                <div className="hidden grid-cols-[26px_minmax(0,1fr)_128px_128px_40px] bg-secondary/60 px-3 py-2 text-xs font-bold text-muted-foreground sm:grid">
                  <span />
                  <span>Description</span>
                  <span>Price (GBP)</span>
                  <span className="text-right">Amount (GBP)</span>
                  <span />
                </div>
                <DndContext sensors={itemSensors} collisionDetection={closestCenter} onDragEnd={reorderInvoiceItems}>
                  <SortableContext items={form.lineItems.map((item) => item.id!)} strategy={verticalListSortingStrategy}>
                    {form.lineItems.map((item, index) => (
                      <SortableInvoiceItemRow
                        key={item.id}
                        id={item.id!}
                        item={item}
                        index={index}
                        onUpdate={updateInvoiceItem}
                        onRemove={removeInvoiceItem}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="rounded-xl border-primary/25 bg-background text-primary hover:bg-primary/10" onClick={() => addInvoiceItem("OTHER")}>
                    <Plus className="h-4 w-4" /> Add item
                  </Button>
                  <Button type="button" variant="outline" className="rounded-xl border-border/70 bg-background text-foreground hover:bg-secondary" onClick={addInvoiceDiscount}>
                    <Percent className="h-4 w-4" /> Add discount
                  </Button>
                </div>
                <div className="w-full space-y-2 rounded-2xl bg-secondary/40 p-3 text-sm sm:w-[230px]">
                  <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between border-t border-border pt-2 text-lg font-bold"><span>Total</span><span>{subtotal.toFixed(2)}</span></div>
                </div>
              </div>
            </div>

            <div className="hidden">
              <h2 className="mb-4 text-base font-bold">Payment Settings</h2>
              <div className="grid gap-5 md:grid-cols-3">
                <label className="space-y-1.5">
                  <span className={fieldLabelClass}>Payment method</span>
                  <select className={`h-10 w-full rounded-md px-3 text-sm ${invoiceInputClass}`}>
                    <option>Bank Transfer</option>
                  </select>
                </label>
                <div className="space-y-1.5">
                  <span className={fieldLabelClass}>Online card payment</span>
                  <ToggleSwitch label="Include payment link in email" checked={form.sendMail} onChange={(sendMail) => setForm({ ...form, sendMail })} />
                </div>
                <div className="space-y-1.5">
                  <span className={fieldLabelClass}>Payment status</span>
                  <div className="inline-flex h-10 items-center rounded-full bg-[#ffdf9e] px-5 text-sm font-bold text-[#8a4a00]">Unpaid</div>
                </div>
                <div className="hidden rounded-md border bg-background p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Banknote className="h-4 w-4 text-[#DD2D3E]" /> Bank transfer
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Default</span>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>Barclays Bank</p>
                    <p>E electrics limited</p>
                    <p>Account 23929884 · Sort 20-25-19</p>
                  </div>
                </div>
                <div className="hidden rounded-md border bg-background p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <CreditCard className="h-4 w-4 text-[#DD2D3E]" /> Online card payment
                    </div>
                    <span className="rounded-full bg-secondary px-2 py-1 text-xs font-semibold">Email only</span>
                  </div>
                  <ToggleSwitch label="Attach images in email" checked={form.sendImages} onChange={(sendImages) => setForm({ ...form, sendImages })} />
                </div>
                <label className="hidden space-y-2 md:col-span-2">
                    <span className={fieldLabelClass}>{billingNoun} Notes</span>
                  <RichTextarea value={form.description} onChange={(description) => setForm({ ...form, description })} minHeight="min-h-28" />
                </label>
                <label className="hidden space-y-2 md:col-span-2">
                  <span className={fieldLabelClass}>PDF Notes</span>
                  <Textarea value={form.emailNote} onChange={(event) => setForm({ ...form, emailNote: event.target.value })} className="min-h-24" />
                </label>
                <label className="hidden space-y-2 md:col-span-2">
                  <span className={fieldLabelClass}>Images</span>
                  <Input type="file" multiple accept="image/*" onChange={handleImages} />
                </label>
                {form.attachments.length ? (
                  <div className="grid gap-3 md:col-span-2 sm:grid-cols-2 lg:grid-cols-3">
                    {form.attachments.map((attachment, index) => (
                      <div key={`${attachment.name}-${index}`} className="overflow-hidden rounded-md border">
                        <img src={attachment.dataUrl} alt={attachment.name} className="h-28 w-full object-cover" />
                        <div className="flex items-center justify-between gap-2 p-2">
                          <span className="truncate text-xs text-muted-foreground">{attachment.name}</span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                attachments: current.attachments.filter((_, itemIndex) => itemIndex !== index)
                              }))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/75 shadow-sm backdrop-blur-xl">
              <button
                type="button"
                className="flex h-12 w-full items-center justify-between px-4 text-sm font-semibold text-foreground"
                onClick={() => setInvoiceNotesOpen((current) => !current)}
              >
                <span>Additional Notes (optional)</span>
                <ChevronDown className={`h-4 w-4 transition ${invoiceNotesOpen ? "rotate-180" : ""}`} />
              </button>
              {invoiceNotesOpen ? (
                <div className="grid gap-5 border-t border-border/60 p-4 sm:p-5">
                  <SnippetSelect onInsert={(text) => setForm((current) => ({ ...current, emailNote: appendSnippetText(current.emailNote, text) }))} />
                  <label className="space-y-2">
                    <span className={fieldLabelClass}>Greeting Description</span>
                    <RichTextarea value={form.greeting} onChange={(greeting) => setForm({ ...form, greeting })} minHeight="min-h-24" />
                  </label>
                  <label className="space-y-2">
                    <span className={fieldLabelClass}>{billingNoun} Description</span>
                    <RichTextarea value={form.description} onChange={(description) => setForm({ ...form, description })} minHeight="min-h-28" />
                  </label>
                  <label className="space-y-2">
                    <span className={fieldLabelClass}>Notes</span>
                    <RichTextarea value={form.emailNote} onChange={(emailNote) => setForm({ ...form, emailNote })} minHeight="min-h-24" />
                  </label>
                  <label className="space-y-2">
                    <span className={fieldLabelClass}>Images</span>
                    <Input className={formInputClass} type="file" multiple accept="image/*" onChange={handleImages} />
                  </label>
                  {form.attachments.length ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {form.attachments.map((attachment, index) => (
                        <div key={`${attachment.name}-${index}`} className="overflow-hidden rounded-2xl border border-border/60 bg-secondary/40">
                          <img src={attachment.dataUrl} alt={attachment.name} className="h-28 w-full object-cover" />
                          <div className="flex items-center justify-between gap-2 p-2">
                            <span className="truncate text-xs text-muted-foreground">{attachment.name}</span>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-primary hover:bg-primary/10"
                              onClick={() =>
                                setForm((current) => ({
                                  ...current,
                                  attachments: current.attachments.filter((_, itemIndex) => itemIndex !== index)
                                }))
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    <ToggleSwitch label="Send Images in Mail ?" checked={form.sendImages} onChange={(sendImages) => setForm({ ...form, sendImages })} />
                    <MailToggleButton checked={form.sendMail} onChange={(sendMail) => setForm({ ...form, sendMail })} />
                  </div>
                </div>
              ) : null}
            </div>
            <div className="rounded-2xl border border-border/50 bg-card/75 p-4 shadow-sm backdrop-blur-xl">
              <div className="grid gap-3 sm:grid-cols-3">
                <Button type="button" variant="outline" className="h-12 rounded-xl border-border/70 bg-background text-foreground hover:bg-secondary" onClick={() => submitDocument({ sendMail: false, status: "DRAFT" })} loading={mutation.isPending}>
                  <Save className="h-5 w-5" /> Save Draft
                </Button>
                <Button type="button" variant="outline" className="h-12 rounded-xl border-border/70 bg-background text-foreground hover:bg-secondary" onClick={previewPdf}>
                  <FileText className="h-5 w-5" /> Preview PDF
                </Button>
                <Button className="h-12 rounded-xl" onClick={() => submitDocument()} disabled={!form.firstName || !form.jobTitle} loading={mutation.isPending}>
                  <Send className="h-5 w-5" /> Send {billingNoun}
                </Button>
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-4 xl:sticky xl:top-[88px] xl:h-[calc(100dvh-104px)] xl:self-start xl:overflow-hidden">
              <InvoicePreviewPanel
              documentType={form.type as DocumentType}
              documentNo={existing?.documentNo ?? "Draft"}
              issueDate={form.issueDate}
              dueDate={form.dueDate}
              clientName={clientDisplayName(form.firstName, form.lastName)}
              addressLine={form.addressLine}
              extraAddress={form.extraAddress}
              jobTitle={form.jobTitle}
              greeting={form.greeting}
              invoiceDescription={form.description}
              items={normalizedRows}
              subtotal={subtotal}
              notes={form.emailNote}
              previewMode={invoicePreviewMode}
              onPreviewModeChange={setInvoicePreviewMode}
              onDownloadPdf={downloadPdf}
            />
            <div className="hidden rounded-lg border bg-card p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Total Due</div>
                  <div className="text-3xl font-semibold">{formatPounds(documentAmount)}</div>
                </div>
                <MailToggleButton checked={form.sendMail} onChange={(sendMail) => setForm({ ...form, sendMail })} />
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Button type="button" variant="outline" onClick={() => submitDocument({ sendMail: false, status: "DRAFT" })} loading={mutation.isPending}>
                  <Save className="h-4 w-4" /> Save Draft
                </Button>
                <Button type="button" variant="secondary" onClick={previewPdf}>
                  <FileText className="h-4 w-4" /> Preview PDF
                </Button>
                <Button onClick={() => submitDocument()} disabled={!form.firstName || !form.jobTitle} loading={mutation.isPending}>
                  <Send className="h-4 w-4" /> Send {billingNoun}
                </Button>
              </div>
            </div>
          </div>
        </div>
        {previewModal}
      </div>
    );
  }

  if (form.type === "BOOKING") {
    return (
      <div className="mx-auto w-full min-w-0 max-w-[1680px] space-y-3 text-foreground">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <Button
              type="button"
              variant="ghost"
              className="mb-1 h-8 px-0 text-muted-foreground hover:bg-transparent hover:text-primary"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{isEdit ? "Edit Booking" : "New Booking"}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="h-10 rounded-xl border-border/70 bg-card px-5 text-foreground hover:bg-secondary" onClick={() => submitDocument({ sendMail: false, status: "DRAFT" })} loading={mutation.isPending}>
              <Save className="h-4 w-4" /> Save Draft
            </Button>
            <Button asChild size="icon" variant="outline" className="h-10 w-10 rounded-xl border-border/70 bg-card text-foreground hover:bg-secondary">
              <Link to="/settings">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/75 px-4 py-4 shadow-sm backdrop-blur-xl sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:items-center">
            {[
              ["Client", "Add client details"],
              ["Booking Details", "Date, address and job"],
              ["Email & Images", "Message and attachments"],
              ["Preview", "Review and send"]
            ].map(([step, caption], index) => (
              <div key={step} className="flex items-center gap-4">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${index < 2 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{step}</div>
                  <div className="truncate text-xs text-muted-foreground">{caption}</div>
                </div>
                {index < 3 ? <div className="ml-auto hidden h-px flex-1 bg-border xl:block" /> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="min-w-0 space-y-3">
            <div className="rounded-2xl border border-border/50 bg-card/75 p-4 shadow-sm backdrop-blur-xl sm:p-5">
              <h2 className="mb-4 text-base font-bold">Client & Booking Details</h2>
              <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
                <IconField icon={User} label="First Name" value={form.firstName} onChange={(firstName) => setForm({ ...form, firstName })} inputClassName={invoiceInputClass} iconClassName="border-border/70 bg-background text-muted-foreground" />
                <IconField icon={User} label="Last Name (Optional)" value={form.lastName} onChange={(lastName) => setForm({ ...form, lastName })} inputClassName={invoiceInputClass} iconClassName="border-border/70 bg-background text-muted-foreground" />
                <IconField icon={Mail} label="Email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} inputClassName={invoiceInputClass} iconClassName="border-border/70 bg-background text-muted-foreground" />
                <IconField icon={Phone} label="Phone Number /UK Format/ (Optional)" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} inputClassName={invoiceInputClass} iconClassName="border-border/70 bg-background text-muted-foreground" />
                <IconField icon={Mail} label="CC (Optional)" type="email" value={form.cc} onChange={(cc) => setForm({ ...form, cc })} inputClassName={invoiceInputClass} iconClassName="border-border/70 bg-background text-muted-foreground" />
                <label className="space-y-2">
                  <span className={fieldLabelClass}>Postal Code</span>
                  <div className="flex">
                    <div className="flex h-10 w-10 items-center justify-center rounded-l-lg border border-r-0 border-[#cbd5e1] bg-white text-slate-500 dark:border-border/70 dark:bg-background dark:text-muted-foreground">
                      <Hash className="h-4 w-4" />
                    </div>
                    <Input
                      className={`${formInputClass} rounded-none`}
                      value={form.postalCode}
                      onChange={(event) => setForm({ ...form, postalCode: event.target.value })}
                    />
                    <Button type="button" className="h-10 w-10 rounded-l-none rounded-r-lg bg-[#ef1228] hover:bg-[#d90f22]" size="icon" onClick={searchPostcodeAddress}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className={fieldLabelClass}>Address</span>
                  <AddressCombobox
                    value={form.addressLine}
                    onChange={(value, selected) => setForm({ ...form, addressLine: value, selectedAddress: selected })}
                    lookupQuery={addressLookup.query}
                    lookupNonce={addressLookup.nonce}
                    inputClassName={formInputClass}
                  />
                </label>
                <IconField icon={Home} label="Address 2 (Optional)" value={form.extraAddress} onChange={(extraAddress) => setForm({ ...form, extraAddress })} inputClassName={invoiceInputClass} iconClassName="border-border/70 bg-background text-muted-foreground" />
                <IconField
                  icon={Calendar}
                  label="Booking Date"
                  type="date"
                  value={form.bookingDate || form.issueDate}
                  onChange={(value) => setForm({ ...form, issueDate: value, bookingDate: value })}
                  inputClassName={invoiceInputClass}
                  iconClassName="border-border/70 bg-background text-muted-foreground"
                />
                <IconField icon={FileText} label="Job Description" value={form.jobTitle} onChange={(jobTitle) => setForm({ ...form, jobTitle })} inputClassName={invoiceInputClass} iconClassName="border-border/70 bg-background text-muted-foreground" />
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/75 p-4 shadow-sm backdrop-blur-xl sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold">Message Content</h2>
                  <p className="mt-1 text-xs text-muted-foreground">This content is used in booking email and PDF.</p>
                </div>
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div className="grid gap-5">
                <SnippetSelect onInsert={(text) => setForm((current) => ({ ...current, emailNote: appendSnippetText(current.emailNote, text) }))} />
                <label className="space-y-2">
                  <span className={fieldLabelClass}>Greeting Description</span>
                  <RichTextarea value={form.greeting} onChange={(greeting) => setForm({ ...form, greeting })} minHeight="min-h-40" />
                </label>
                <label className="space-y-2">
                  <span className={fieldLabelClass}>Booking Description</span>
                  <RichTextarea value={form.description} onChange={(description) => setForm({ ...form, description })} minHeight="min-h-36" />
                </label>
                <label className="space-y-2">
                  <span className={fieldLabelClass}>Notes</span>
                  <RichTextarea value={form.emailNote} onChange={(emailNote) => setForm({ ...form, emailNote })} minHeight="min-h-24" />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/75 p-4 shadow-sm backdrop-blur-xl sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold">Images & Email</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Upload job images and choose email options.</p>
                </div>
                <ImagePlus className="h-5 w-5 text-primary" />
              </div>
              <label className="block space-y-2">
                <span className={fieldLabelClass}>Images</span>
                <Input className={formInputClass} type="file" multiple accept="image/*" onChange={handleImages} />
              </label>
              {form.attachments.length ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {form.attachments.map((attachment, index) => (
                    <div key={`${attachment.name}-${index}`} className="overflow-hidden rounded-2xl border border-border/60 bg-secondary/40">
                      <img src={attachment.dataUrl} alt={attachment.name} className="h-28 w-full object-cover" />
                      <div className="flex items-center justify-between gap-2 p-2">
                        <span className="truncate text-xs text-muted-foreground">{attachment.name}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-primary hover:bg-primary/10"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              attachments: current.attachments.filter((_, itemIndex) => itemIndex !== index)
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-border bg-background/50 p-6 text-center text-sm font-semibold text-muted-foreground">No images selected</div>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <MailToggleButton checked={form.sendMail} onChange={(sendMail) => setForm({ ...form, sendMail })} />
                <ToggleSwitch label="Send Images in Mail ?" checked={form.sendImages} onChange={(sendImages) => setForm({ ...form, sendImages })} />
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/75 p-4 shadow-sm backdrop-blur-xl">
              <div className="grid gap-3 sm:grid-cols-3">
                <Button type="button" variant="outline" className="h-12 rounded-xl border-border/70 bg-background text-foreground hover:bg-secondary" onClick={() => navigate(-1)}>
                  <ArrowLeft className="h-5 w-5" /> Back
                </Button>
                <Button type="button" variant="outline" className="h-12 rounded-xl border-border/70 bg-background text-foreground hover:bg-secondary" onClick={() => submitDocument({ sendMail: false, status: "DRAFT" })} loading={mutation.isPending}>
                  <Save className="h-5 w-5" /> Save Draft
                </Button>
                <Button className="h-12 rounded-xl" onClick={() => submitDocument()} disabled={!form.firstName || !form.jobTitle} loading={mutation.isPending}>
                  <Send className="h-5 w-5" /> Send Booking Email
                </Button>
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-4 xl:sticky xl:top-[88px] xl:h-[calc(100dvh-104px)] xl:self-start xl:overflow-hidden">
            <BookingPreviewPanel
              documentNo={existing?.documentNo ?? "Draft"}
              bookingDate={form.bookingDate || form.issueDate}
              clientName={clientDisplayName(form.firstName, form.lastName)}
              addressLine={form.addressLine}
              extraAddress={form.extraAddress}
              postalCode={form.postalCode}
              jobTitle={form.jobTitle}
              greeting={form.greeting}
              bookingDescription={form.description}
              notes={form.emailNote}
              previewMode={invoicePreviewMode}
              onPreviewModeChange={setInvoicePreviewMode}
              onPreviewBooking={previewBooking}
            />
          </div>
        </div>
        {previewModal}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4" /> {isEdit ? `Edit ${form.type.toLowerCase()}` : copy.title}
          </CardTitle>
          <Button asChild size="sm">
            <Link to="/documents">Back</Link>
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="grid gap-4 pt-5 md:grid-cols-3">
          <IconField icon={User} label="First Name" value={form.firstName} onChange={(firstName) => setForm({ ...form, firstName })} />
          <IconField icon={User} label="Last Name (Optional)" value={form.lastName} onChange={(lastName) => setForm({ ...form, lastName })} />
          <IconField icon={Mail} label="Email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
          <IconField icon={Mail} label="CC (Optional)" type="email" value={form.cc} onChange={(cc) => setForm({ ...form, cc })} />
          <IconField icon={Phone} label="Phone Number /UK Format/ (Optional)" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
          <label className="space-y-2">
            <span className={fieldLabelClass}>Postal Code</span>
            <div className="flex">
              <div className="flex h-10 w-10 items-center justify-center rounded-l-md border border-r-0 text-muted-foreground">
                <Hash className="h-4 w-4" />
              </div>
              <Input className="rounded-none" value={form.postalCode} onChange={(event) => setForm({ ...form, postalCode: event.target.value })} />
              <Button type="button" className="rounded-l-none" size="icon" onClick={searchPostcodeAddress}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className={fieldLabelClass}>Address</span>
            <div className="flex">
              <div className="flex h-10 w-10 items-center justify-center rounded-l-md border border-r-0 text-muted-foreground">
                <Home className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <AddressCombobox
                  value={form.addressLine}
                  onChange={(value, selected) => setForm({ ...form, addressLine: value, selectedAddress: selected })}
                  lookupQuery={addressLookup.query}
                  lookupNonce={addressLookup.nonce}
                />
              </div>
            </div>
          </label>
          <IconField icon={Home} label="Address 2 (Optional)" value={form.extraAddress} onChange={(extraAddress) => setForm({ ...form, extraAddress })} />
          <IconField icon={Calendar} label="Date" type="date" value={form.issueDate} onChange={(issueDate) => setForm({ ...form, issueDate })} />
          <IconField icon={FileText} label="Job Description" value={form.jobTitle} onChange={(jobTitle) => setForm({ ...form, jobTitle })} />
          <div>
            <IncludeMultiSelect
              value={form.includeOptions}
              onChange={(includeOptions) => setForm({ ...form, includeOptions })}
            />
          </div>
          {hasTotalPaid && !hasLabour && !hasMaterial ? (
            <IconField icon={PoundSterling} label="Currency" type="number" value={form.price} onChange={(price) => setForm({ ...form, price })} />
          ) : null}
          {hasLabour ? (
            <IncludePriceSection
              title="Labour"
              price={form.labourPrice}
              onPriceChange={(labourPrice) => setForm({ ...form, labourPrice })}
            />
          ) : null}
          {hasMaterial ? (
            <IncludePriceSection
              title="Material"
              price={form.materialPrice}
              onPriceChange={(materialPrice) => setForm({ ...form, materialPrice })}
            />
          ) : null}
          <label className="space-y-2 md:col-span-3">
            <span className={fieldLabelClass}>Greeting Description</span>
            <RichTextarea value={form.greeting} onChange={(greeting) => setForm({ ...form, greeting })} minHeight="min-h-44" />
          </label>
          <div className="md:col-span-3">
            <SnippetSelect onInsert={(text) => setForm((current) => ({ ...current, emailNote: appendSnippetText(current.emailNote, text) }))} />
          </div>
          <label className="space-y-2 md:col-span-3">
            <span className={fieldLabelClass}>{copy.body}</span>
            <RichTextarea value={form.description} onChange={(description) => setForm({ ...form, description })} minHeight="min-h-44" />
          </label>
          <label className="space-y-2 md:col-span-3">
            <span className={fieldLabelClass}>Notes (optional)</span>
            <RichTextarea value={form.emailNote} onChange={(emailNote) => setForm({ ...form, emailNote })} minHeight="min-h-32" />
          </label>

          <label className="space-y-2 md:col-span-3">
            <span className={fieldLabelClass}>Images</span>
            <Input type="file" multiple accept="image/*" onChange={handleImages} />
          </label>

          <div className="min-h-11 rounded-md border md:col-span-3">
            {form.attachments.length ? (
              <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
                {form.attachments.map((attachment, index) => (
                  <div key={`${attachment.name}-${index}`} className="overflow-hidden rounded-md border">
                    <img src={attachment.dataUrl} alt={attachment.name} className="h-28 w-full object-cover" />
                    <div className="flex items-center justify-between gap-2 p-2">
                      <span className="truncate text-xs text-muted-foreground">{attachment.name}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            attachments: current.attachments.filter((_, itemIndex) => itemIndex !== index)
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-8 md:col-span-3">
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => submitDocument()} disabled={!form.firstName || !form.jobTitle} loading={mutation.isPending}>
                Send
              </Button>
              <Button type="button" variant="secondary" onClick={previewPdf}>
                <FileText className="h-4 w-4" /> Preview PDF
              </Button>
            </div>
            <ToggleSwitch
              label="Send Images in Mail ?"
              checked={form.sendImages}
              onChange={(sendImages) => setForm({ ...form, sendImages })}
            />
            <MailToggleButton checked={form.sendMail} onChange={(sendMail) => setForm({ ...form, sendMail })} />
          </div>
        </CardContent>
      </Card>
      {previewModal}
    </div>
  );
}

function PreviewHtmlDialog({
  preview,
  onOpenChange
}: {
  preview: { title: string; html: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(preview)} onOpenChange={onOpenChange}>
      <DialogContent className="h-[92svh] w-[calc(100vw-1rem)] max-w-6xl gap-3 overflow-hidden rounded-3xl border-border/60 bg-card/95 p-4 shadow-apple backdrop-blur-xl sm:w-[calc(100vw-3rem)] sm:p-5">
        <DialogHeader>
          <DialogTitle>{preview?.title ?? "Preview"}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-white">
          {preview ? <iframe title={preview.title} srcDoc={preview.html} className="h-full min-h-[70svh] w-full bg-white" /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InvoicePreviewPanel({
  documentType,
  documentNo,
  issueDate,
  dueDate,
  clientName,
  addressLine,
  extraAddress,
  jobTitle,
  greeting,
  invoiceDescription,
  items,
  subtotal,
  notes,
  previewMode,
  onPreviewModeChange,
  onDownloadPdf
}: {
  documentType: DocumentType;
  documentNo: string;
  issueDate: string;
  dueDate: string;
  clientName: string;
  addressLine: string;
  extraAddress: string;
  jobTitle: string;
  greeting: string;
  invoiceDescription: string;
  items: LineItem[];
  subtotal: number;
  notes: string;
  previewMode: "desktop" | "mobile";
  onPreviewModeChange: (mode: "desktop" | "mobile") => void;
  onDownloadPdf: () => void;
}) {
  const documentLabel = documentType === "QUOTATION" ? "Quotation" : "Invoice";
  return (
    <div className="flex flex-col rounded-2xl border border-border/50 bg-card/75 p-4 shadow-apple backdrop-blur-xl sm:p-5 xl:h-full">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="text-base font-bold">Live Preview</div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <button
            type="button"
            className={`flex h-9 w-11 items-center justify-center rounded-md border ${
              previewMode === "desktop" ? "border-primary bg-primary/10 text-primary" : "border-border/70 bg-background text-muted-foreground"
            }`}
            onClick={() => onPreviewModeChange("desktop")}
          >
            <Monitor className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={`flex h-9 w-11 items-center justify-center rounded-md border ${
              previewMode === "mobile" ? "border-primary bg-primary/10 text-primary" : "border-border/70 bg-background text-muted-foreground"
            }`}
            onClick={() => onPreviewModeChange("mobile")}
          >
            <Smartphone className="h-4 w-4" />
          </button>
          <button type="button" className="ml-0 flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-border/70 bg-background px-4 text-sm font-medium text-foreground hover:bg-secondary sm:ml-3 sm:flex-none" onClick={onDownloadPdf}>
            <Download className="h-4 w-4" /> Download PDF
          </button>
        </div>
      </div>
      <div className={`${previewMode === "mobile" ? "mx-auto max-w-[390px] px-4 py-5" : "mx-auto max-w-[860px] px-7 py-7"} min-h-0 flex-1 overflow-auto border border-[#d5dce7] bg-white text-black shadow-lg`}>
        <div>
          <div className="mb-5 flex items-start justify-between gap-4">
            <img src={oldCrmLogoUrl} alt="E Electrics" className={`h-auto ${previewMode === "mobile" ? "w-40" : "w-56"}`} />
            <div className="text-right">
              <div className={`${previewMode === "mobile" ? "text-xl" : "text-2xl"} font-bold uppercase text-[#ef1228]`}>{documentLabel}</div>
              <div className="text-base font-bold">{documentNo}</div>
            </div>
          </div>
          <div className={`grid text-[12px] leading-5 ${previewMode === "mobile" ? "gap-4" : "gap-8 sm:grid-cols-2"}`}>
            <div>
              <p className="font-bold">E Electrics Ltd</p>
              <p>57 Beckhampton Road</p>
              <p>Bath, BA2 1BL</p>
              <p>United Kingdom</p>
              <p>Registration No: 12418331</p>
              <p>NAPIT Member No: 65513</p>
              <p>info@eelectrics.co.uk&nbsp;&nbsp;|&nbsp;&nbsp;0800 999 1452</p>
            </div>
            <div className="grid gap-5">
              <div className="grid grid-cols-[100px_1fr] gap-x-4">
                <span className="font-bold">{documentLabel} Date:</span><span>{formatOldDate(issueDate)}</span>
                <span className="font-bold">Due Date:</span><span>{dueDate ? formatOldDate(dueDate) : "-"}</span>
              </div>
              <div className="rounded border border-[#d5dce7] bg-[#fbfcfe] p-3">
                <p className="font-bold">Bill To:</p>
                <p className="font-bold">{clientName}</p>
                <p>{addressLine || "-"}</p>
                {extraAddress ? <p>{extraAddress}</p> : null}
              </div>
            </div>
          </div>
          <div className="mt-8 border-t-2 border-[#ef1228] pt-3">
            {jobTitle ? <div className="mb-2 text-sm font-semibold">{jobTitle}</div> : null}
            {greeting ? <div className="mb-3 whitespace-pre-wrap text-xs leading-5">{greeting}</div> : null}
            {invoiceDescription ? <div className="mb-3 whitespace-pre-wrap text-xs leading-5">{invoiceDescription}</div> : null}
            <div className={`${previewMode === "mobile" ? "grid-cols-[1fr_72px_74px] px-2 text-[10px]" : "grid-cols-[1fr_120px_130px] px-3 text-xs"} grid bg-[#ef1228] py-2 font-bold text-white`}>
              <span>Description</span>
              <span className="text-right">Price (GBP)</span>
              <span className="text-right">Amount</span>
            </div>
            <div className="divide-y divide-dashed divide-[#b8c2d0]">
              {items.length ? (
                items.map((item, index) => (
                  <div key={`${item.title}-${index}`} className={`${previewMode === "mobile" ? "grid-cols-[1fr_72px_74px] gap-1 px-2 text-[10px]" : "grid-cols-[1fr_120px_130px] gap-3 px-3 text-xs"} grid py-3`}>
                    <div>{item.title || "-"}</div>
                    <div className="text-right">{Number(item.unitPrice || 0).toFixed(2)}</div>
                    <div className="text-right">{lineItemTotal(item).toFixed(2)}</div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-8 text-sm text-slate-600">-</div>
              )}
            </div>
            <div className={`ml-auto mt-5 space-y-2 text-xs ${previewMode === "mobile" ? "w-full" : "w-[310px]"}`}>
              <div className="flex justify-between"><span>Subtotal</span><span>{formatPounds(subtotal)}</span></div>
            </div>
            <div className={`ml-auto mt-2 grid grid-cols-[1fr_120px] bg-[#ef1228] px-4 py-3 font-bold text-white ${previewMode === "mobile" ? "w-full text-sm" : "w-[310px] text-base"}`}>
              <span>Total Due</span>
              <span className="text-right">{formatPounds(subtotal)}</span>
            </div>
          </div>
          <div className="mt-4 border-b border-[#cfd7e3] pb-5 text-xs">
            <p className="font-bold text-[#ef1228]">Notes:</p>
            <p className="mt-2 whitespace-pre-wrap leading-5">{notes || `Thank you for your business. ${documentLabel === "Invoice" ? "Payment is due within 14 days from the invoice date." : "Please review this quotation and contact us with any questions."}`}</p>
          </div>
          <div className={`grid gap-6 border-b border-[#ef1228] py-4 text-xs ${previewMode === "mobile" ? "" : "sm:grid-cols-2"}`}>
            <div>
              <p className="mb-2 font-bold text-[#ef1228]">Payment Method</p>
              <p className="font-bold">Bank Transfer</p>
              <p><strong>Account Name:</strong> E Electrics Ltd</p>
              <p><strong>Sort Code:</strong> 20-25-19</p>
              <p><strong>Account No:</strong> 23929884</p>
            </div>
            <div>
              <p>Alternative payment option:</p>
              <p className="font-bold text-[#ef1228]">Online card payment</p>
              <p>A secure payment link is included in the email.</p>
            </div>
          </div>
          <p className="pt-3 text-center text-xs">Thank you for choosing E Electrics Ltd.</p>
        </div>
      </div>
    </div>
  );
}

function BookingPreviewPanel({
  documentNo,
  bookingDate,
  clientName,
  addressLine,
  extraAddress,
  postalCode,
  jobTitle,
  greeting,
  bookingDescription,
  notes,
  previewMode,
  onPreviewModeChange,
  onPreviewBooking
}: {
  documentNo: string;
  bookingDate: string;
  clientName: string;
  addressLine: string;
  extraAddress: string;
  postalCode: string;
  jobTitle: string;
  greeting: string;
  bookingDescription: string;
  notes: string;
  previewMode: "desktop" | "mobile";
  onPreviewModeChange: (mode: "desktop" | "mobile") => void;
  onPreviewBooking: () => void;
}) {
  const compact = previewMode === "mobile";
  const previewWidth = compact ? "max-w-[340px]" : "max-w-[860px]";

  return (
    <div className="flex flex-col rounded-2xl border border-border/50 bg-card/75 p-4 shadow-apple backdrop-blur-xl sm:p-5 xl:h-full">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-bold">Live Preview</h2>
          <p className="mt-1 text-xs text-muted-foreground">Booking email and PDF layout preview.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-border/70 bg-background p-1">
            <button
              type="button"
              className={`flex h-8 w-9 items-center justify-center rounded-lg ${previewMode === "desktop" ? "border border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"}`}
              onClick={() => onPreviewModeChange("desktop")}
              title="Desktop preview"
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={`flex h-8 w-9 items-center justify-center rounded-lg ${previewMode === "mobile" ? "border border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"}`}
              onClick={() => onPreviewModeChange("mobile")}
              title="Mobile preview"
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>
          <Button type="button" variant="outline" className="h-10 rounded-xl border-border/70 bg-background px-4 text-foreground hover:bg-secondary" onClick={onPreviewBooking}>
            <FileText className="h-4 w-4" />
            Preview Booking
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border/60 bg-background/60 p-2 sm:p-4">
        <div className={`mx-auto min-h-[760px] ${previewWidth} bg-white p-6 text-[#101828] shadow-sm transition-all sm:p-8`}>
          <div className="border-t-[3px] border-[#DD2D3E] pt-4">
            <img src={oldCrmLogoUrl} alt="E Electrics" className="h-auto w-[190px]" />
          </div>

          <div className={`mt-5 grid gap-6 ${compact ? "grid-cols-1" : "grid-cols-[1fr_.9fr]"}`}>
            <div className="space-y-1 text-[13px] leading-5">
              <p className="font-bold">E Electrics | E Electrics Limited</p>
              <p className="font-bold">Head Office: Dent Close, Essex, RM15 5DS</p>
              <p>Registration No: 12418331</p>
              <p>NAPIT Member No: 65513</p>
              <p>info@eelectrics.co.uk | 0800 999 1452</p>
            </div>
            <div className="space-y-1 text-[13px] leading-5">
              <PreviewLine label="Booking:" value={documentNo || "Draft"} />
              <PreviewLine label="Date:" value={formatOldDate(bookingDate)} />
              <PreviewLine label="FAO:" value={clientName} />
              <PreviewLine label="Address:" value={addressLine || "-"} />
              {extraAddress ? <PreviewLine label="Address 2:" value={extraAddress} /> : null}
              {postalCode ? <PreviewLine label="Postcode:" value={postalCode} /> : null}
            </div>
          </div>

          <div className="mt-5 border-b-[3px] border-[#DD2D3E] pb-1 text-xl font-bold">BOOKING</div>

          <div className="mt-6 overflow-hidden border border-[#f3c4c9]">
            <div className={`grid ${compact ? "grid-cols-[1fr_92px] px-3 text-xs" : "grid-cols-[1fr_150px] px-4 text-sm"} bg-[#DD2D3E] py-3 font-bold text-white`}>
              <span>Description</span>
              <span>Date</span>
            </div>
            <div className={`grid ${compact ? "grid-cols-[1fr_92px] px-3 text-xs" : "grid-cols-[1fr_150px] px-4 text-sm"} bg-[#fff4df] py-4 leading-6`}>
              <div>
                <p className="font-bold">{jobTitle || "Booking job description"}</p>
                {greeting ? <p className="mt-3 whitespace-pre-wrap">{greeting}</p> : null}
                {bookingDescription ? <p className="mt-3 whitespace-pre-wrap">{bookingDescription}</p> : null}
              </div>
              <div>{formatOldDate(bookingDate)}</div>
            </div>
          </div>

          <div className="mt-6 text-sm leading-6">
            <p className="border-b-2 border-[#DD2D3E] pb-1 text-base font-bold">Notes:</p>
            <p className="mt-2 whitespace-pre-wrap">{notes || defaultBookingNote}</p>
          </div>

          <div className="mt-8 border-t border-[#DD2D3E] pt-4 text-center text-xs font-semibold">
            Thank you for choosing E Electrics Ltd.
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[82px_1fr] gap-2">
      <span>{label}</span>
      <span className="break-words text-right font-medium">{value || "-"}</span>
    </div>
  );
}

function SortableInvoiceItemRow({
  id,
  item,
  index,
  onUpdate,
  onRemove
}: {
  id: string;
  item: LineItem;
  index: number;
  onUpdate: (index: number, patch: Partial<LineItem>) => void;
  onRemove: (index: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`grid min-w-0 grid-cols-[28px_minmax(0,1fr)_40px] gap-2 border-t border-border/60 bg-card px-3 py-2 sm:grid-cols-[26px_minmax(0,1fr)_128px_128px_40px] sm:items-center ${isDragging ? "relative z-20 rounded-xl border border-primary/30 opacity-90 shadow-lg" : ""}`}
    >
      <button
        type="button"
        className="flex h-9 w-7 touch-none cursor-grab items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground active:cursor-grabbing"
        aria-label={`Reorder ${item.title || `item ${index + 1}`}`}
        title="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Input className={`h-9 min-w-0 ${invoiceInputClass}`} value={item.title} onChange={(event) => onUpdate(index, { title: event.target.value })} placeholder="Item description" />
      <label className="col-start-2 grid gap-1 sm:col-start-auto sm:block">
        <span className="text-[11px] font-medium text-muted-foreground sm:hidden">Price</span>
        <Input className={`h-9 text-right ${invoiceInputClass}`} type="number" value={String(item.unitPrice)} onChange={(event) => onUpdate(index, { unitPrice: Number(event.target.value) })} />
      </label>
      <div className="col-start-2 flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-sm font-medium sm:col-start-auto sm:block sm:bg-transparent sm:px-0 sm:py-0 sm:pr-2 sm:text-right">
        <span className="text-xs text-muted-foreground sm:hidden">Amount</span>
        {lineItemTotal(item).toFixed(2)}
      </div>
      <Button type="button" size="icon" variant="ghost" className="col-start-3 row-start-1 h-9 w-9 rounded-lg text-primary hover:bg-primary/10 sm:col-start-auto sm:row-start-auto" onClick={() => onRemove(index)} title="Remove item">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function InvoiceClientPicker({
  clients,
  value,
  onType,
  onSelect
}: {
  clients: Client[];
  value: string;
  onType: (value: string) => void;
  onSelect: (client: Client) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const normalizedValue = value.trim().toLowerCase();
  const filteredClients = clients
    .filter((client) => {
      if (!normalizedValue) return true;
      const haystack = [client.firstName, client.lastName, client.email, client.phone, client.company].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(normalizedValue);
    })
    .slice(0, 8);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex h-10 items-center overflow-hidden rounded-lg border border-[#cbd5e1] bg-white text-[#111827] shadow-none transition focus-within:ring-2 focus-within:ring-primary/20 dark:border-border/70 dark:bg-background dark:text-foreground">
        <div className="flex h-full w-10 shrink-0 items-center justify-center border-r border-[#cbd5e1] text-slate-500 dark:border-border/70 dark:text-muted-foreground">
          <User className="h-4 w-4" />
        </div>
        <Input
          className="h-full min-w-0 rounded-none border-0 bg-transparent px-3 py-0 text-sm text-inherit shadow-none placeholder:text-[#94a3b8] focus:ring-0 dark:placeholder:text-muted-foreground"
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onType(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "Enter" && filteredClients[0]) {
              event.preventDefault();
              onSelect(filteredClients[0]);
              setOpen(false);
            }
          }}
          placeholder="Select or type client"
        />
        <button type="button" className="flex h-full w-9 shrink-0 items-center justify-center text-muted-foreground" onClick={() => setOpen((current) => !current)}>
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-[1000] max-h-72 overflow-auto rounded-xl border border-border bg-card p-1 text-card-foreground shadow-xl">
          {filteredClients.length ? (
            filteredClients.map((client) => (
              <button
                key={client.id}
                type="button"
                className="block w-full rounded-lg px-3 py-2 text-left hover:bg-secondary"
                onClick={() => {
                  onSelect(client);
                  setOpen(false);
                }}
              >
                <span className="block truncate text-sm font-semibold text-card-foreground">{clientDisplayName(client.firstName, client.lastName ?? "")}</span>
                <span className="block truncate text-xs text-muted-foreground">{[client.email, client.phone].filter(Boolean).join(" | ") || "No contact details"}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">No clients found</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function IncludeMultiSelect({
  value,
  onChange
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selectedLabels = includeChoices.filter((choice) => value.includes(choice.value)).map((choice) => choice.label);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const toggleOption = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter((item) => item !== option));
      return;
    }
    onChange([...value, option]);
  };

  return (
    <div ref={wrapperRef} className="relative z-50 space-y-2">
      <span className={fieldLabelClass}>Include</span>
      <button
        type="button"
        className="flex h-10 w-full items-center justify-between gap-3 rounded-md border bg-background px-3 text-left text-sm"
        onClick={() => setOpen((current) => !current)}
      >
        <span className={`min-w-0 flex-1 truncate ${selectedLabels.length ? "" : "text-muted-foreground"}`}>
          {selectedLabels.length ? selectedLabels.join(", ") : "Select include"}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-[1000] rounded-md border bg-popover p-1 shadow-xl">
          {includeChoices.map((choice) => {
            const checked = value.includes(choice.value);
            return (
              <button
                key={choice.value}
                type="button"
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-secondary"
                onClick={() => toggleOption(choice.value)}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border ${
                    checked ? "border-primary bg-primary text-primary-foreground" : "border-input"
                  }`}
                >
                  {checked ? <Check className="h-3 w-3" /> : null}
                </span>
                {choice.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function IncludePriceSection({
  title,
  price,
  onPriceChange
}: {
  title: string;
  price: string;
  onPriceChange: (value: string) => void;
}) {
  return (
    <IconField icon={PoundSterling} label={`${title} Price (GBP)`} type="number" value={price} onChange={onPriceChange} />
  );
}

function MailToggleButton({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
    >
      <Mail className={`h-4 w-4 ${checked ? "text-primary" : "text-muted-foreground"}`} />
      <span>Send Mail</span>
      <span className={`flex h-5 w-10 items-center rounded-full border transition ${checked ? "border-primary bg-primary" : "border-input bg-secondary"}`}>
        <span className={`h-4 w-4 rounded-full bg-white transition ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </span>
      <span className={checked ? "text-primary" : "text-muted-foreground"}>{checked ? "On" : "Off"}</span>
    </button>
  );
}

function IconField({
  icon: Icon,
  label,
  value,
  onChange,
  type = "text",
  inputClassName,
  iconClassName
}: {
  icon: typeof User;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputClassName?: string;
  iconClassName?: string;
}) {
  return (
    <label className="space-y-2">
      <span className={fieldLabelClass}>{label}</span>
      <div className="flex">
        <div className={`flex h-10 w-10 items-center justify-center rounded-l-md border border-r-0 text-muted-foreground ${iconClassName ?? ""}`}>
          <Icon className="h-4 w-4" />
        </div>
        <Input className={`rounded-l-none ${inputClassName ?? ""}`} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </label>
  );
}

function ToggleSwitch({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
      <button
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={`flex h-5 w-10 items-center rounded-full border transition ${checked ? "border-primary bg-primary" : "border-input bg-secondary"}`}
      >
        <span className={`h-4 w-4 rounded-full bg-white transition ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
      {label}
    </label>
  );
}

function RichTextarea({
  value,
  onChange,
  minHeight
}: {
  value: string;
  onChange: (value: string) => void;
  minHeight: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [blockStyle, setBlockStyle] = useState("p");

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor || editor.innerHTML === value) return;
    editor.innerHTML = value;
  }, [value]);

  const emitValue = () => onChange(editorRef.current?.innerHTML ?? "");
  const runCommand = (command: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    emitValue();
  };
  const preserveSelection = () => {
    const selection = window.getSelection();
    selectionRef.current = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
  };
  const restoreSelection = () => {
    const selection = window.getSelection();
    if (!selectionRef.current || !selection) return;
    selection.removeAllRanges();
    selection.addRange(selectionRef.current);
  };
  const applyBlockStyle = (nextStyle: string) => {
    restoreSelection();
    runCommand("formatBlock", nextStyle);
    setBlockStyle(nextStyle);
  };
  const applyLink = () => {
    const href = linkUrl.trim();
    if (!href) return;
    restoreSelection();
    runCommand("createLink", /^https?:\/\//i.test(href) || href.startsWith("mailto:") ? href : `https://${href}`);
    setLinkOpen(false);
    setLinkUrl("");
  };
  const toolButtonClass = "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground";

  return (
    <div className="overflow-hidden rounded-lg border border-[#cbd5e1] bg-white text-[#111827] shadow-none transition focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20 dark:border-border/70 dark:bg-background dark:text-foreground">
      <div className="flex min-h-11 flex-wrap items-center gap-0.5 border-b border-border/60 bg-secondary/35 px-2 py-1.5">
        <button type="button" className={toolButtonClass} title="Undo" aria-label="Undo" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("undo")}><Undo2 className="h-4 w-4" /></button>
        <button type="button" className={toolButtonClass} title="Redo" aria-label="Redo" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("redo")}><Redo2 className="h-4 w-4" /></button>
        <span className="mx-1 h-5 w-px bg-border" />
        <select
          aria-label="Text style"
          className="mr-1 h-8 rounded-lg border border-border bg-card px-2 text-xs font-medium text-foreground shadow-none outline-none focus:ring-2 focus:ring-primary/20"
          value={blockStyle}
          onMouseDown={preserveSelection}
          onChange={(event) => applyBlockStyle(event.target.value)}
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
        </select>
        <button type="button" className={toolButtonClass} title="Bold" aria-label="Bold" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("bold")}><Bold className="h-4 w-4" /></button>
        <button type="button" className={toolButtonClass} title="Italic" aria-label="Italic" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("italic")}><Italic className="h-4 w-4" /></button>
        <button type="button" className={toolButtonClass} title="Underline" aria-label="Underline" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("underline")}><Underline className="h-4 w-4" /></button>
        <button type="button" className={toolButtonClass} title="Bullet list" aria-label="Bullet list" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("insertUnorderedList")}><List className="h-4 w-4" /></button>
        <button
          type="button"
          className={toolButtonClass}
          title="Insert link"
          aria-label="Insert link"
          onMouseDown={(event) => {
            event.preventDefault();
            preserveSelection();
          }}
          onClick={() => setLinkOpen((current) => !current)}
        >
          <Link2 className="h-4 w-4" />
        </button>
      </div>
      {linkOpen ? (
        <div className="flex items-center gap-2 border-b border-border/60 bg-background p-2">
          <Input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} onKeyDown={(event) => event.key === "Enter" && applyLink()} className="h-8 rounded-lg border-border bg-card text-xs shadow-none" placeholder="https://example.com" autoFocus />
          <Button type="button" size="sm" className="h-8 rounded-lg px-3" onClick={applyLink}>Apply</Button>
        </div>
      ) : null}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        className={`${minHeight} max-h-[420px] overflow-y-auto bg-white px-3 py-3 text-sm leading-6 text-[#111827] outline-none empty:before:pointer-events-none empty:before:text-[#94a3b8] empty:before:content-['Start_writing...'] [&_h1]:my-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:leading-tight [&_h2]:my-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:leading-tight [&_h3]:my-1.5 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:my-1.5 [&_h4]:text-base [&_h4]:font-semibold dark:bg-background dark:text-foreground dark:empty:before:text-muted-foreground`}
        onInput={emitValue}
      />
    </div>
  );
}

function SnippetSelect({ onInsert }: { onInsert: (text: string) => void }) {
  const snippets = readMailSnippets();
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="text-xs font-semibold text-muted-foreground">Insert saved snippet</span>
      <select
        className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm font-medium text-foreground outline-none transition focus:ring-2 focus:ring-primary/20"
        defaultValue=""
        onChange={(event) => {
          const snippet = snippets.find((item) => item.id === event.target.value);
          if (snippet) {
            onInsert(snippet.text);
            toast.success("Snippet inserted");
          }
          event.target.value = "";
        }}
      >
        <option value="">Choose a saved snippet</option>
        {snippets.map((snippet) => <option key={snippet.id} value={snippet.id}>{snippet.title}</option>)}
      </select>
    </label>
  );
}
