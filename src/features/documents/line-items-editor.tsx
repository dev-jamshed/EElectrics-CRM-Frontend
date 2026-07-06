import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { currency } from "@/lib/utils";
import type { LineItem } from "@/types/crm";

type Props = {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
};

const emptyItem = (): LineItem => ({
  kind: "MATERIAL",
  title: "",
  quantity: 1,
  unitPrice: 0
});

export function LineItemsEditor({ items, onChange }: Props) {
  const update = (index: number, patch: Partial<LineItem>) => {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const total = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-secondary">
            <tr>
              <th className="px-3 py-2 text-left">Include</th>
              <th className="px-3 py-2 text-left">Item</th>
              <th className="px-3 py-2 text-left">Qty</th>
              <th className="px-3 py-2 text-left">Price</th>
              <th className="px-3 py-2 text-left">Total</th>
              <th className="w-12 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="border-t">
                <td className="px-3 py-2">
                  <Select value={item.kind} onChange={(event) => update(index, { kind: event.target.value as LineItem["kind"] })}>
                    <option value="MATERIAL">Material</option>
                    <option value="LABOUR">Labour</option>
                    <option value="OTHER">Other</option>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Input value={item.title} onChange={(event) => update(index, { title: event.target.value })} placeholder="e.g. Cable, callout, fitting" />
                </td>
                <td className="px-3 py-2">
                  <Input type="number" value={item.quantity} onChange={(event) => update(index, { quantity: Number(event.target.value) })} />
                </td>
                <td className="px-3 py-2">
                  <Input type="number" value={item.unitPrice} onChange={(event) => update(index, { unitPrice: Number(event.target.value) })} />
                </td>
                <td className="px-3 py-2 font-medium">{currency(Number(item.quantity || 0) * Number(item.unitPrice || 0))}</td>
                <td className="px-3 py-2">
                  <Button type="button" size="icon" variant="ghost" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={() => onChange([...items, emptyItem()])}>
          <Plus className="h-4 w-4" /> Add material/labour
        </Button>
        <div className="text-xl font-semibold">{currency(total)}</div>
      </div>
    </div>
  );
}

