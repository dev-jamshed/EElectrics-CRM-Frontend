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
        <div className="absolute z-[1000] mt-2 w-full overflow-hidden rounded-md border border-[#dfe5ee] bg-white text-[#101828] shadow-xl [color-scheme:light]">
          {isFetching ? <div className="px-3 py-2 text-sm text-[#667085]">Loading addresses...</div> : null}
          {!isFetching && data.length > 0
            ? data.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm transition hover:bg-[#f3f6fa]"
                  onClick={() => {
                    onChange(item.line, item);
                    setQuery(item.line);
                    setShowEmptyState(false);
                    setOpen(false);
                  }}
                >
                  {item.label}
                  <span className="ml-2 text-xs text-[#667085]">{item.source}</span>
                </button>
              ))
            : null}
          {!isFetching && showEmptyState && data.length === 0 ? (
            <div className="px-3 py-2 text-sm text-[#667085]">No addresses found</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
