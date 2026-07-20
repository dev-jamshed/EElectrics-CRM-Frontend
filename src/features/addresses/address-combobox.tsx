import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { crmApi } from "@/lib/api";
import { Input } from "@/components/ui/input";

type AddressComboboxProps = {
  value: string;
  onChange: (value: string, selected?: unknown) => void;
  lookupQuery?: string;
  lookupNonce?: number;
  inputClassName?: string;
};

export function AddressCombobox({ value, onChange, lookupQuery, lookupNonce, inputClassName }: AddressComboboxProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [showEmptyState, setShowEmptyState] = useState(false);
  const { data = [], isFetching } = useQuery({
    queryKey: ["addresses", query],
    queryFn: () => crmApi.addresses(query),
    enabled: query.length > 1
  });

  useEffect(() => {
    const nextQuery = lookupQuery?.trim();
    if (!nextQuery) return;
    setQuery(nextQuery);
    setShowEmptyState(true);
    setOpen(true);
  }, [lookupQuery, lookupNonce]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setShowEmptyState(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        className={inputClassName}
        value={value}
        onFocus={() => {
          if (query.length > 1) setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            setShowEmptyState(false);
          }
        }}
        onChange={(event) => {
          const nextValue = event.target.value;
          setQuery(nextValue);
          setShowEmptyState(nextValue.length > 1);
          onChange(nextValue);
          setOpen(nextValue.length > 1);
        }}
        placeholder="Type address manually"
      />
      {open && query.length > 1 ? (
        <div className="relative z-20 mt-2 max-h-60 w-full overflow-x-hidden overflow-y-auto overscroll-contain rounded-lg border border-border bg-popover text-popover-foreground shadow-lg" role="listbox" aria-label="Address suggestions">
          {isFetching ? <div className="px-3 py-2 text-sm text-muted-foreground">Loading addresses...</div> : null}
          {!isFetching && data.length > 0
            ? data.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  className="flex min-w-0 w-full items-start justify-between gap-3 border-b border-border/50 px-3 py-2.5 text-left text-sm transition last:border-b-0 hover:bg-secondary focus:bg-secondary focus:outline-none"
                  onClick={() => {
                    onChange(item.line, item);
                    setQuery(item.line);
                    setShowEmptyState(false);
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 break-words font-medium">{item.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{item.source}</span>
                </button>
              ))
            : null}
          {!isFetching && showEmptyState && data.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No addresses found</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
