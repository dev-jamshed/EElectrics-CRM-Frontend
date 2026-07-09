import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Banknote,
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
  Mail,
  Monitor,
  Percent,
  Phone,
  Plus,
  PoundSterling,
  Receipt,
  Save,
  Search,
  Send,
  Settings,
  Smartphone,
  Trash2,
  User
} from "lucide-react";
import { AddressCombobox } from "@/features/addresses/address-combobox";
import { crmApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const defaultInvoiceRows: LineItem[] = [
  { kind: "LABOUR", title: "Labour installation", description: "", quantity: 1, unitPrice: 0, total: 0 },
  { kind: "MATERIAL", title: "Materials", description: "", quantity: 1, unitPrice: 0, total: 0 }
];

const invoiceInputClass = "border-[#cfd7e3] bg-white text-[#101828] placeholder:text-[#98a2b3] [color-scheme:light]";

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);
  const documentType = (type as DocumentType | undefined) ?? "INVOICE";

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
  const { data: clients = [] } = useQuery({
    queryKey: ["clients", "invoice-form"],
    queryFn: () => crmApi.clients(),
    enabled: documentType === "INVOICE"
  });

  const seed = useMemo<DocumentRecord | undefined>(() => existing ?? source, [existing, source]);
  const copyDocumentText = !isEdit && Boolean(source);
  const [addressLookup, setAddressLookup] = useState({ query: "", nonce: 0 });
  const submitLockedRef = useRef(false);
  const [invoiceNotesOpen, setInvoiceNotesOpen] = useState(true);
  const [invoicePreviewMode, setInvoicePreviewMode] = useState<"desktop" | "mobile">("desktop");

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
    emailNote: documentType === "BOOKING" || documentType === "INVOICE" ? defaultInvoiceNote : "",
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
    lineItems: documentType === "INVOICE" ? defaultInvoiceRows : ([] as LineItem[])
  });

  const copy = labels(form.type as DocumentType);

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
      emailNote: copyDocumentText ? defaultInvoiceNote : seed.emailNote ?? (documentType === "INVOICE" ? defaultInvoiceNote : ""),
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
      lineItems: seed.lineItems?.length ? seed.lineItems : current.lineItems
    }));
  }, [seed, isEdit, documentType, copyDocumentText]);

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
  const documentAmount = form.type === "INVOICE" ? invoiceAmount : legacyAmount;
  const computedIncludeOptions = form.type === "INVOICE" ? includeOptionsFromLineItems(invoiceLineItems) : form.includeOptions;

  const selectedLineItems: LineItem[] =
    form.type === "INVOICE"
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
    if (form.type === "INVOICE") {
      if (!invoiceLineItems.length) {
        toast.error("Add at least one invoice item");
        return false;
      }
      if (invoiceLineItems.some((item) => !item.title.trim())) {
        toast.error("Every invoice item needs a description");
        return false;
      }
      if (invoiceLineItems.some((item) => Number(item.quantity || 0) <= 0)) {
        toast.error("Every invoice item needs quantity");
        return false;
      }
      if (!Number.isFinite(invoiceAmount) || invoiceAmount <= 0) {
        toast.error("Invoice total must be greater than zero");
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
    window.open(URL.createObjectURL(new Blob([html], { type: "text/html" })), "_blank");
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
      body: form.type === "INVOICE" ? invoiceBodyFromItems(form.description || form.emailBody, selectedLineItems) : form.description || form.emailBody,
      emailNote: form.emailNote,
      includeOptions: computedIncludeOptions,
      total: documentAmount
    });
    window.open(URL.createObjectURL(new Blob([html], { type: "text/html" })), "_blank");
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
        description: form.type === "INVOICE" ? invoiceBodyFromItems(form.description, selectedLineItems) : form.description,
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
        lineItems: selectedLineItems
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

  const addInvoiceDiscount = () => {
    setForm((current) => ({
      ...current,
      lineItems: [
        ...current.lineItems,
        {
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
    setForm((current) => ({ ...current, lineItems: templates[template].map(normalizeLineItem) }));
  };

  if (form.type === "INVOICE") {
    const subtotal = form.lineItems.reduce((sum, item) => sum + lineItemTotal(item), 0);
    const normalizedRows = form.lineItems.map(normalizeLineItem);

    return (
      <div className="mx-auto max-w-[1540px] space-y-3 text-[#101828] [color-scheme:light]">
        <div className="flex items-center justify-between">
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">{isEdit ? "Edit Invoice" : "New Invoice"}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="h-10 border-[#d9e0ea] bg-white px-5 text-[#101828] hover:bg-[#f8fafc]" onClick={() => submitDocument({ sendMail: false, status: "DRAFT" })} loading={mutation.isPending}>
              <Save className="h-4 w-4" /> Save Draft
            </Button>
            <Button asChild size="icon" variant="outline" className="h-10 w-10 border-[#d9e0ea] bg-white text-[#101828] hover:bg-[#f8fafc]">
              <Link to="/documents">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-[#dfe5ee] bg-white px-8 py-4 shadow-sm">
          <div className="grid grid-cols-4 items-center gap-7">
            {[
              ["Client", "Add client details"],
              ["Items", "Add items and amounts"],
              ["Notes", "Email and PDF text"],
              ["Preview", "Review and send"]
            ].map(([step, caption], index) => (
              <div key={step} className="flex items-center gap-4">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${index < 2 ? "bg-[#ef1228] text-white" : "bg-[#d7dde6] text-[#344054]"}`}>
                  {index + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold">{step}</div>
                  <div className="text-xs text-[#53627a]">{caption}</div>
                </div>
                {index < 3 ? <div className="ml-auto hidden h-px flex-1 bg-[#cfd7e3] xl:block" /> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(620px,1fr)_minmax(560px,.98fr)]">
          <div className="space-y-3">
            <div className="rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-base font-bold">Client & Invoice Details</h2>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Client</span>
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
                <div className="grid gap-4">
                  <IconField icon={Mail} label="Email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} inputClassName={invoiceInputClass} iconClassName="border-[#cfd7e3] bg-white text-[#53627a]" />
                  <IconField icon={Phone} label="Phone" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} inputClassName={invoiceInputClass} iconClassName="border-[#cfd7e3] bg-white text-[#53627a]" />
                </div>
                <div className="grid gap-4">
                  <IconField icon={Calendar} label="Invoice Date" type="date" value={form.issueDate} onChange={(issueDate) => setForm({ ...form, issueDate })} inputClassName={invoiceInputClass} iconClassName="border-[#cfd7e3] bg-white text-[#53627a]" />
                  <IconField icon={Calendar} label="Due Date" type="date" value={form.dueDate} onChange={(dueDate) => setForm({ ...form, dueDate })} inputClassName={invoiceInputClass} iconClassName="border-[#cfd7e3] bg-white text-[#53627a]" />
                </div>
                <IconField icon={Hash} label="Reference / PO (optional)" value={form.cc} onChange={(cc) => setForm({ ...form, cc })} inputClassName={invoiceInputClass} iconClassName="border-[#cfd7e3] bg-white text-[#53627a]" />
                <IconField icon={FileText} label="Job Description" value={form.jobTitle} onChange={(jobTitle) => setForm({ ...form, jobTitle })} inputClassName={invoiceInputClass} iconClassName="border-[#cfd7e3] bg-white text-[#53627a]" />
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Postal Code</span>
                  <div className="flex">
                    <Input className={`rounded-r-none ${invoiceInputClass}`} value={form.postalCode} onChange={(event) => setForm({ ...form, postalCode: event.target.value })} />
                    <Button type="button" className="rounded-l-none bg-[#ef1228] hover:bg-[#d90f22]" size="icon" onClick={searchPostcodeAddress}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Address</span>
                  <AddressCombobox
                    value={form.addressLine}
                    onChange={(value, selected) => setForm({ ...form, addressLine: value, selectedAddress: selected })}
                    lookupQuery={addressLookup.query}
                    lookupNonce={addressLookup.nonce}
                    inputClassName={invoiceInputClass}
                  />
                </label>
              </div>
            </div>

            <div className="rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-base font-bold">Items</h2>
              <div className="overflow-x-auto rounded-md border border-[#cfd7e3]">
                <div className="min-w-[680px]">
                <div className="grid grid-cols-[26px_minmax(300px,1fr)_150px_150px_44px] bg-[#f8fafc] px-3 py-3 text-xs font-bold">
                  <span />
                  <span>Description</span>
                  <span>Price (GBP)</span>
                  <span className="text-right">Amount (GBP)</span>
                  <span />
                </div>
                {form.lineItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-[26px_minmax(300px,1fr)_150px_150px_44px] items-center gap-2 border-t border-[#e4e9f1] px-3 py-2">
                    <GripVertical className="h-4 w-4 text-[#53627a]" />
                    <Input className={`h-9 ${invoiceInputClass}`} value={item.title} onChange={(event) => updateInvoiceItem(index, { title: event.target.value })} />
                    <Input className={`h-9 text-right ${invoiceInputClass}`} type="number" value={String(item.unitPrice)} onChange={(event) => updateInvoiceItem(index, { unitPrice: Number(event.target.value) })} />
                    <div className="pr-2 text-right text-sm font-medium">{lineItemTotal(item).toFixed(2)}</div>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-[#ef1228] hover:bg-red-50" onClick={() => removeInvoiceItem(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                </div>
              </div>
              <div className="mt-3 flex items-start justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="border-red-200 bg-white text-[#ef1228] hover:bg-red-50" onClick={() => addInvoiceItem("OTHER")}>
                    <Plus className="h-4 w-4" /> Add item
                  </Button>
                  <Button type="button" variant="outline" className="border-[#d5dce7] bg-white text-[#101828] hover:bg-[#f8fafc]" onClick={addInvoiceDiscount}>
                    <Percent className="h-4 w-4" /> Add discount
                  </Button>
                </div>
                <div className="w-[230px] space-y-2 text-sm">
                  <div className="flex justify-between text-[#53627a]"><span>Subtotal</span><span>{subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between border-t border-[#d5dce7] pt-2 text-lg font-bold"><span>Total</span><span>{subtotal.toFixed(2)}</span></div>
                </div>
              </div>
            </div>

            <div className="hidden">
              <h2 className="mb-4 text-base font-bold">Payment Settings</h2>
              <div className="grid gap-5 md:grid-cols-3">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Payment method</span>
                  <select className={`h-10 w-full rounded-md px-3 text-sm ${invoiceInputClass}`}>
                    <option>Bank Transfer</option>
                  </select>
                </label>
                <div className="space-y-1.5">
                  <span className="text-xs font-medium">Online card payment</span>
                  <ToggleSwitch label="Include payment link in email" checked={form.sendMail} onChange={(sendMail) => setForm({ ...form, sendMail })} />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-medium">Payment status</span>
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
                  <span className="text-xs font-medium">Invoice Notes</span>
                  <RichTextarea value={form.description} onChange={(description) => setForm({ ...form, description })} minHeight="min-h-28" />
                </label>
                <label className="hidden space-y-2 md:col-span-2">
                  <span className="text-xs font-medium">PDF Notes</span>
                  <Textarea value={form.emailNote} onChange={(event) => setForm({ ...form, emailNote: event.target.value })} className="min-h-24" />
                </label>
                <label className="hidden space-y-2 md:col-span-2">
                  <span className="text-xs font-medium">Images</span>
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
            <div className="overflow-hidden rounded-lg border border-[#dfe5ee] bg-white shadow-sm">
              <button
                type="button"
                className="flex h-14 w-full items-center justify-between px-5 text-sm font-semibold text-[#101828]"
                onClick={() => setInvoiceNotesOpen((current) => !current)}
              >
                <span>Additional Notes (optional)</span>
                <ChevronDown className={`h-4 w-4 transition ${invoiceNotesOpen ? "rotate-180" : ""}`} />
              </button>
              {invoiceNotesOpen ? (
                <div className="grid gap-5 border-t border-[#edf1f6] p-5">
                  <label className="space-y-2">
                    <span className="text-xs font-medium">Greeting Description</span>
                    <RichTextarea value={form.greeting} onChange={(greeting) => setForm({ ...form, greeting })} minHeight="min-h-24" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-medium">Invoice Description</span>
                    <RichTextarea value={form.description} onChange={(description) => setForm({ ...form, description })} minHeight="min-h-28" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-medium">Notes</span>
                    <RichTextarea value={form.emailNote} onChange={(emailNote) => setForm({ ...form, emailNote })} minHeight="min-h-24" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-medium">Images</span>
                    <Input className={invoiceInputClass} type="file" multiple accept="image/*" onChange={handleImages} />
                  </label>
                  {form.attachments.length ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {form.attachments.map((attachment, index) => (
                        <div key={`${attachment.name}-${index}`} className="overflow-hidden rounded-md border border-[#dfe5ee]">
                          <img src={attachment.dataUrl} alt={attachment.name} className="h-28 w-full object-cover" />
                          <div className="flex items-center justify-between gap-2 p-2">
                            <span className="truncate text-xs text-[#667085]">{attachment.name}</span>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-[#ef1228] hover:bg-red-50"
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
            <div className="rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-3">
                <Button type="button" variant="outline" className="h-12 border-[#cfd7e3] bg-white text-[#101828] hover:bg-[#f8fafc]" onClick={() => submitDocument({ sendMail: false, status: "DRAFT" })} loading={mutation.isPending}>
                  <Save className="h-5 w-5" /> Save Draft
                </Button>
                <Button type="button" variant="outline" className="h-12 border-[#cfd7e3] bg-white text-[#101828] hover:bg-[#f8fafc]" onClick={previewPdf}>
                  <FileText className="h-5 w-5" /> Preview PDF
                </Button>
                <Button className="h-12 bg-[#ef1228] text-white hover:bg-[#d90f22]" onClick={() => submitDocument()} disabled={!form.firstName || !form.jobTitle} loading={mutation.isPending}>
                  <Send className="h-5 w-5" /> Send Invoice
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <InvoicePreviewPanel
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
                  <Send className="h-4 w-4" /> Send Invoice
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (form.type === "BOOKING") {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" /> Create Booking
            </CardTitle>
            <Button asChild size="sm">
              <Link to="/documents?type=BOOKING&status=SENT&title=Booked%20Bookings">Back</Link>
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
              <span className="text-xs font-medium">Postal Code</span>
              <div className="flex">
                <div className="flex h-10 w-10 items-center justify-center rounded-l-md border border-r-0 text-muted-foreground">
                  <Hash className="h-4 w-4" />
                </div>
                <Input
                  className="rounded-none"
                  value={form.postalCode}
                  onChange={(event) => setForm({ ...form, postalCode: event.target.value })}
                />
                <Button type="button" className="rounded-l-none" size="icon" onClick={searchPostcodeAddress}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-medium">Address</span>
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
            <IconField
              icon={Calendar}
              label="Date"
              type="date"
              value={form.bookingDate || form.issueDate}
              onChange={(value) => setForm({ ...form, issueDate: value, bookingDate: value })}
            />
            <IconField icon={FileText} label="Job Description" value={form.jobTitle} onChange={(jobTitle) => setForm({ ...form, jobTitle })} />

            <label className="space-y-2 md:col-span-3">
              <span className="text-xs font-medium">Greeting Description</span>
              <RichTextarea value={form.greeting} onChange={(greeting) => setForm({ ...form, greeting })} minHeight="min-h-56" />
            </label>

            <label className="space-y-2 md:col-span-3">
              <span className="text-xs font-medium">Notes (optional)</span>
              <RichTextarea value={form.emailNote} onChange={(emailNote) => setForm({ ...form, emailNote })} minHeight="min-h-36" />
            </label>

            <div className="flex flex-wrap items-center gap-3 md:col-span-3">
              <Button onClick={() => submitDocument()} disabled={!form.firstName || !form.jobTitle} loading={mutation.isPending}>
                <Save className="h-4 w-4" /> Save
              </Button>
              <Button type="button" variant="secondary" onClick={previewBooking}>
                Preview Booking
              </Button>
              <MailToggleButton checked={form.sendMail} onChange={(sendMail) => setForm({ ...form, sendMail })} />
            </div>
          </CardContent>
        </Card>
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
            <span className="text-xs font-medium">Postal Code</span>
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
            <span className="text-xs font-medium">Address</span>
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
            <span className="text-xs font-medium">Greeting Description</span>
            <RichTextarea value={form.greeting} onChange={(greeting) => setForm({ ...form, greeting })} minHeight="min-h-44" />
          </label>
          <label className="space-y-2 md:col-span-3">
            <span className="text-xs font-medium">{copy.body}</span>
            <RichTextarea value={form.description} onChange={(description) => setForm({ ...form, description })} minHeight="min-h-44" />
          </label>
          <label className="space-y-2 md:col-span-3">
            <span className="text-xs font-medium">Notes (optional)</span>
            <RichTextarea value={form.emailNote} onChange={(emailNote) => setForm({ ...form, emailNote })} minHeight="min-h-32" />
          </label>

          <label className="space-y-2 md:col-span-3">
            <span className="text-xs font-medium">Images</span>
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
    </div>
  );
}

function InvoicePreviewPanel({
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
  return (
    <div className="rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-base font-bold">Live Preview</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`flex h-9 w-11 items-center justify-center rounded-md border ${
              previewMode === "desktop" ? "border-[#ef1228] bg-red-50 text-[#ef1228]" : "border-[#d5dce7] bg-white text-[#53627a]"
            }`}
            onClick={() => onPreviewModeChange("desktop")}
          >
            <Monitor className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={`flex h-9 w-11 items-center justify-center rounded-md border ${
              previewMode === "mobile" ? "border-[#ef1228] bg-red-50 text-[#ef1228]" : "border-[#d5dce7] bg-white text-[#53627a]"
            }`}
            onClick={() => onPreviewModeChange("mobile")}
          >
            <Smartphone className="h-4 w-4" />
          </button>
          <button type="button" className="ml-6 flex h-10 items-center gap-2 rounded-md border border-[#d5dce7] bg-white px-4 text-sm font-medium" onClick={onDownloadPdf}>
            <Download className="h-4 w-4" /> Download PDF
          </button>
        </div>
      </div>
      <div className={`${previewMode === "mobile" ? "mx-auto max-w-[390px] px-4 py-5" : "mx-auto max-w-[720px] px-8 py-7"} border border-[#d5dce7] bg-white text-black shadow-lg`}>
        <div>
          <div className="mb-5 flex items-start justify-between gap-4">
            <img src={oldCrmLogoUrl} alt="E Electrics" className={`h-auto ${previewMode === "mobile" ? "w-40" : "w-56"}`} />
            <div className="text-right">
              <div className={`${previewMode === "mobile" ? "text-xl" : "text-2xl"} font-bold uppercase text-[#ef1228]`}>Invoice</div>
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
                <span className="font-bold">Invoice Date:</span><span>{formatOldDate(issueDate)}</span>
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
            <p className="mt-2 whitespace-pre-wrap leading-5">{notes || "Thank you for your business. Payment is due within 14 days from the invoice date."}</p>
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
      <div className="flex h-11 items-center rounded-md border border-[#cfd7e3] bg-white px-3">
        <User className="mr-2 h-4 w-4 text-[#53627a]" />
        <Input
          className="h-9 border-0 bg-transparent px-0 py-0 text-[#101828] shadow-none [color-scheme:light] placeholder:text-[#98a2b3] focus:ring-0"
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
        <button type="button" className="text-[#53627a]" onClick={() => setOpen((current) => !current)}>
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-[1000] max-h-72 overflow-auto rounded-md border border-[#dfe5ee] bg-white p-1 shadow-xl">
          {filteredClients.length ? (
            filteredClients.map((client) => (
              <button
                key={client.id}
                type="button"
                className="block w-full rounded px-3 py-2 text-left hover:bg-[#f3f6fa]"
                onClick={() => {
                  onSelect(client);
                  setOpen(false);
                }}
              >
                <span className="block truncate text-sm font-semibold text-[#101828]">{clientDisplayName(client.firstName, client.lastName ?? "")}</span>
                <span className="block truncate text-xs text-[#667085]">{[client.email, client.phone].filter(Boolean).join(" | ") || "No contact details"}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-[#667085]">No clients found</div>
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
      <span className="text-xs font-medium">Include</span>
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
      className="inline-flex items-center gap-3 rounded-md border border-[#d5dce7] bg-white px-3 py-2 text-sm font-medium text-[#101828] transition hover:bg-[#f8fafc]"
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
      <span className="text-xs font-medium">{label}</span>
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
    <label className="flex items-center gap-3 text-sm font-medium text-[#53627a]">
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
  return (
    <div className="overflow-hidden rounded-md border border-[#cfd7e3] bg-white [color-scheme:light]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#e4e9f1] bg-white px-3 py-2 text-[11px] text-[#53627a]">
        <span>File</span>
        <span>Edit</span>
        <span>View</span>
        <span>Insert</span>
        <span>Format</span>
        <span>Tools</span>
        <span>Table</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#e4e9f1] bg-white px-3 py-2 text-xs text-[#53627a]">
        <button type="button" className="rounded px-2 py-1 hover:bg-[#f3f6fa]">Undo</button>
        <button type="button" className="rounded px-2 py-1 hover:bg-[#f3f6fa]">Redo</button>
        <select className="h-7 rounded border border-[#cfd7e3] bg-white px-2 text-[#101828]">
          <option>Paragraph</option>
        </select>
        <select className="h-7 rounded border border-[#cfd7e3] bg-white px-2 text-[#101828]">
          <option>System Font</option>
        </select>
        <button type="button" className="rounded px-2 py-1 font-bold hover:bg-[#f3f6fa]">B</button>
        <button type="button" className="rounded px-2 py-1 italic hover:bg-[#f3f6fa]">I</button>
        <button type="button" className="rounded px-2 py-1 underline hover:bg-[#f3f6fa]">U</button>
        <button type="button" className="rounded px-2 py-1 hover:bg-[#f3f6fa]">Link</button>
        <button type="button" className="rounded px-2 py-1 hover:bg-[#f3f6fa]">List</button>
      </div>
      <Textarea
        className={`${minHeight} rounded-none border-0 bg-white text-[#101828] placeholder:text-[#98a2b3] focus:ring-0`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
