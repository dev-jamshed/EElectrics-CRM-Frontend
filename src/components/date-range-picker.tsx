import { endOfMonth, format, startOfMonth, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarDays, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DateRangePickerProps = {
  value?: DateRange;
  onChange: (value: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
};

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Pick date range",
  className
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const label =
    value?.from && value?.to
      ? `${format(value.from, "dd MMM yyyy")} - ${format(value.to, "dd MMM yyyy")}`
      : value?.from
        ? format(value.from, "dd MMM yyyy")
        : placeholder;

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          type="button"
          className={cn(
            "inline-flex h-10 w-full items-center justify-start gap-2 rounded-xl border border-border/70 bg-card/80 px-3 text-left text-sm font-medium shadow-sm outline-none backdrop-blur-md transition hover:bg-secondary focus:ring-2 focus:ring-ring/30 sm:w-[260px]",
            !value?.from && "text-muted-foreground"
          )}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{label}</span>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="bottom"
          sideOffset={10}
          collisionPadding={16}
          className="z-[80] flex max-h-[min(42rem,var(--radix-popover-content-available-height))] w-[min(calc(100vw-2rem),46rem)] flex-col overflow-hidden border-border bg-card p-0 shadow-apple"
        >
          <div className="relative z-20 grid shrink-0 grid-cols-2 gap-2 border-b border-border/60 bg-card p-3 sm:grid-cols-4">
            {[
              { label: "Today", range: todayRange() },
              { label: "Last 7", range: { from: subDays(new Date(), 6), to: new Date() } },
              { label: "Last 30", range: { from: subDays(new Date(), 29), to: new Date() } },
              { label: "Month", range: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) } }
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground transition hover:bg-secondary/75"
                onClick={() => {
                  onChange(preset.range);
                  setOpen(false);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Calendar
              mode="range"
              selected={value}
              onSelect={(range) => onChange(normalizeRange(range))}
              numberOfMonths={2}
              className="hidden sm:block"
            />
            <Calendar mode="range" selected={value} onSelect={(range) => onChange(normalizeRange(range))} numberOfMonths={1} className="sm:hidden" />
          </div>
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/60 p-3">
            <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => onChange(undefined)}>
              Clear
            </Button>
            <Button type="button" size="sm" className="rounded-xl" onClick={() => setOpen(false)}>
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {value?.from ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
          onClick={() => onChange(undefined)}
          title="Clear date range"
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

function normalizeRange(range: DateRange | undefined) {
  if (!range?.from) return range;
  return { from: startOfDay(range.from), to: range.to ? endOfDay(range.to) : undefined };
}

function todayRange() {
  const today = new Date();
  return { from: startOfDay(today), to: endOfDay(today) };
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}
