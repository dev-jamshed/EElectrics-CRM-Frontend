import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Calendar, Check, ChevronDown, FileText, Hash, Home, ImagePlus, Mail, Phone, PoundSterling, Save, Search, Trash2, User } from "lucide-react";
import { AddressCombobox } from "@/features/addresses/address-combobox";
import { crmApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import type { Attachment, DocumentRecord, DocumentType, LineItem } from "@/types/crm";

const includeChoices = [
  { value: "labour", label: "Labour" },
  { value: "material", label: "Material" },
  { value: "total_paid", label: "Total Paid" }
];

const defaultBookingNote =
  "A 12-month warranty is provided on all workmanship. Materials supplied by E Electrics are covered by the manufacturer's warranty.";

const oldCrmLogoUrl = "https://res.cloudinary.com/djneoqoqk/image/upload/v1734727264/email_logo_aqoox6.png";

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
  body: string;
  emailNote: string;
  includeOptions: string[];
  total: number;
}) {
  const title = form.type === "QUOTATION" ? "Quotation" : "Invoice";
  const clientName = [form.firstName, form.lastName].filter(Boolean).join(" ");
  const includeLabel = includeTotalLabel(form.includeOptions);
  const notes = richText(form.emailNote);
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
        <div class="description-div">${richText(form.body) || "-"}</div>
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

  const seed = useMemo<DocumentRecord | undefined>(() => existing ?? source, [existing, source]);
  const copyDocumentText = !isEdit && Boolean(source);
  const [addressLookup, setAddressLookup] = useState({ query: "", nonce: 0 });
  const submitLockedRef = useRef(false);

  const [form, setForm] = useState({
    type: documentType,
    status: "DRAFT",
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
    emailNote: documentType === "BOOKING" ? defaultBookingNote : "",
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
    lineItems: [] as LineItem[]
  });

  const copy = labels(form.type as DocumentType);

  useEffect(() => {
    if (!seed) return;
    setForm((current) => ({
      ...current,
      type: isEdit ? seed.type : documentType,
      status: isEdit ? seed.status ?? "DRAFT" : "DRAFT",
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
      emailNote: copyDocumentText ? "" : seed.emailNote ?? "",
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
      lineItems: seed.lineItems ?? []
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
  const documentAmount = hasLabour || hasMaterial ? calculatedAmount : Number(form.price || 0);

  const selectedLineItems: LineItem[] = [
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
      body: form.description || form.emailBody,
      emailNote: form.emailNote,
      includeOptions: form.includeOptions,
      total: documentAmount
    });
    window.open(URL.createObjectURL(new Blob([html], { type: "text/html" })), "_blank");
  };

  const mutation = useMutation({
    mutationFn: () => {
      if (!validateInclude()) throw new Error("Validation failed");
      const payload = {
        type: form.type,
        status: form.status,
        clientId: isEdit ? existing?.clientId : source?.clientId,
        client: {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone
        },
        caseFileId: isEdit ? existing?.caseFileId : source?.caseFileId,
        sourceDocumentId,
        jobTitle: form.jobTitle,
        description: form.description,
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
        includeOptions: form.includeOptions,
        sendMail: form.sendMail,
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
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(form.sendMail ? "Saved and marked for email" : "Saved successfully");
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

  const submitDocument = () => {
    if (submitLockedRef.current || mutation.isPending) return;
    submitLockedRef.current = true;
    mutation.mutate();
  };

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
              <Button onClick={submitDocument} disabled={!form.firstName || !form.jobTitle} loading={mutation.isPending}>
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
              <Button onClick={submitDocument} disabled={!form.firstName || !form.jobTitle} loading={mutation.isPending}>
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
      className="inline-flex items-center gap-3 rounded-md border px-3 py-2 text-sm font-medium transition hover:bg-secondary"
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
  type = "text"
}: {
  icon: typeof User;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-medium">{label}</span>
      <div className="flex">
        <div className="flex h-10 w-10 items-center justify-center rounded-l-md border border-r-0 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <Input className="rounded-l-none" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
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
  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-[11px] text-muted-foreground">
        <span>File</span>
        <span>Edit</span>
        <span>View</span>
        <span>Insert</span>
        <span>Format</span>
        <span>Tools</span>
        <span>Table</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
        <button type="button" className="rounded px-2 py-1 hover:bg-secondary">Undo</button>
        <button type="button" className="rounded px-2 py-1 hover:bg-secondary">Redo</button>
        <select className="h-7 rounded border bg-background px-2">
          <option>Paragraph</option>
        </select>
        <select className="h-7 rounded border bg-background px-2">
          <option>System Font</option>
        </select>
        <button type="button" className="rounded px-2 py-1 font-bold hover:bg-secondary">B</button>
        <button type="button" className="rounded px-2 py-1 italic hover:bg-secondary">I</button>
        <button type="button" className="rounded px-2 py-1 underline hover:bg-secondary">U</button>
        <button type="button" className="rounded px-2 py-1 hover:bg-secondary">Link</button>
        <button type="button" className="rounded px-2 py-1 hover:bg-secondary">List</button>
      </div>
      <Textarea
        className={`${minHeight} rounded-none border-0 focus:ring-0`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
