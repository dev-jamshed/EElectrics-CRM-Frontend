import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";

export function CustomMailPage() {
  const [form, setForm] = useState({
    to: "",
    cc: "",
    subject: "",
    body: ""
  });

  const openMail = () => {
    const params = new URLSearchParams();
    if (form.cc) params.set("cc", form.cc);
    if (form.subject) params.set("subject", form.subject);
    if (form.body) params.set("body", form.body);
    window.location.href = `mailto:${form.to}?${params.toString()}`;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Custom Mails</h1>
        <p className="text-muted-foreground">Create one-off customer emails.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium">To</span>
            <Input value={form.to} onChange={(event) => setForm({ ...form, to: event.target.value })} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">CC</span>
            <Input value={form.cc} onChange={(event) => setForm({ ...form, cc: event.target.value })} />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium">Subject</span>
            <Input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium">Email body</span>
            <Textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
          </label>
          <div className="md:col-span-2">
            <Button onClick={openMail} disabled={!form.to}>
              <Send className="h-4 w-4" /> Send
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
