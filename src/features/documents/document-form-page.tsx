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
    sendMail: false,
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
      sendMail: isEdit ? seed.sendMail ?? false : false,
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
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Booking Preview</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; margin: 40px; line-height: 1.5; }
    header { border-bottom: 2px solid #111827; padding-bottom: 16px; margin-bottom: 24px; }
    h1 { margin: 0; font-size: 26px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .label { font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 700; }
    .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; white-space: pre-wrap; margin-top: 8px; }
  </style>
</head>
<body>
  <header>
    <h1>Booking Preview</h1>
    <div>${form.bookingDate || form.issueDate}</div>
  </header>
  <section class="grid">
    <div><div class="label">Name</div>${form.firstName} ${form.lastName}</div>
    <div><div class="label">Email</div>${form.email}</div>
    <div><div class="label">Phone</div>${form.phone}</div>
    <div><div class="label">Postcode</div>${form.postalCode}</div>
    <div><div class="label">Address</div>${form.addressLine}</div>
    <div><div class="label">Address 2</div>${form.extraAddress}</div>
  </section>
  <h2>${form.jobTitle}</h2>
  <div class="box">${form.greeting}</div>
  <div class="box">${form.emailNote}</div>
</body>
</html>`;
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
              <Button onClick={submitDocument} disabled={mutation.isPending || !form.firstName || !form.jobTitle}>
                <Save className="h-4 w-4" /> Save
              </Button>
              <Button type="button" variant="secondary" onClick={previewBooking}>
                Preview Booking
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium md:col-span-3">
              <input type="checkbox" checked={form.sendMail} onChange={(event) => setForm({ ...form, sendMail: event.target.checked })} />
              Send Mail
            </label>
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
            <Button onClick={submitDocument} disabled={mutation.isPending || !form.firstName || !form.jobTitle}>
              Send
            </Button>
            <ToggleSwitch
              label="Send Images in Mail ?"
              checked={form.sendImages}
              onChange={(sendImages) => setForm({ ...form, sendImages })}
            />
            <ToggleSwitch label="Send Mail" checked={form.sendMail} onChange={(sendMail) => setForm({ ...form, sendMail })} />
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
