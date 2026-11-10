import { useState } from "react";
import { Hash, Home, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchHousesByPostcode } from "./address-service";

type AddressSelectorProps = {
  postcode: string;
  onPostcodeChange: (value: string) => void;
  address: string;
  onAddressChange: (value: string) => void;
  address2?: string;
  onAddress2Change?: (value: string) => void;
  labelPrefix?: string;
  postcodeLabel?: string;
  addressLabel?: string;
  address2Label?: string;
  inputClassName?: string;
  iconClassName?: string;
  fieldLabelClass?: string;
};

export function AddressSelector({
  postcode,
  onPostcodeChange,
  address,
  onAddressChange,
  address2,
  onAddress2Change,
  labelPrefix,
  postcodeLabel,
  addressLabel,
  address2Label,
  inputClassName = "h-10 rounded-r-lg border border-[#cbd5e1] bg-white text-sm dark:border-border/70 dark:bg-background text-foreground",
  iconClassName = "border-border/70 bg-background text-muted-foreground",
  fieldLabelClass = "text-xs font-semibold text-muted-foreground"
}: AddressSelectorProps) {
  const [loading, setLoading] = useState(false);
  const [houseList, setHouseList] = useState<string[]>([]);
  const [selectedDropdownValue, setSelectedDropdownValue] = useState("");

  const resolvedPostcodeLabel = postcodeLabel || (labelPrefix ? `${labelPrefix} Post Code` : "Post Code");
  const resolvedAddressLabel = addressLabel || (labelPrefix ? `${labelPrefix} Address` : "Address");
  const resolvedAddress2Label = address2Label || (labelPrefix ? `${labelPrefix} Address 2 (Optional)` : "Address 2 (Optional)");

  const handleSearch = async () => {
    const cleanPostcode = postcode.trim();
    if (!cleanPostcode) {
      toast.error("Please enter a post code first");
      return;
    }

    try {
      setLoading(true);
      const houses = await fetchHousesByPostcode(cleanPostcode);
      setHouseList(houses);
      if (houses.length > 0) {
        toast.success(`Found ${houses.length} addresses for ${cleanPostcode.toUpperCase()}`);
      } else {
        toast.info(`No addresses found for ${cleanPostcode.toUpperCase()}. You can type the address manually.`);
      }
    } catch (err) {
      console.error("Address lookup error:", err);
      toast.error("Could not fetch addresses. Please enter address manually.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHouse = (value: string) => {
    if (!value) return;
    setSelectedDropdownValue(value);
    onAddressChange(value);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-x-5 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Post Code Input & Search Button */}
        <label className="space-y-2">
          <span className={fieldLabelClass}>{resolvedPostcodeLabel}</span>
          <div className="flex">
            <div className={`flex h-10 w-10 items-center justify-center rounded-l-lg border border-r-0 text-muted-foreground ${iconClassName}`}>
              <Hash className="h-4 w-4" />
            </div>
            <Input
              className="h-10 rounded-none border border-[#cbd5e1] bg-white text-sm uppercase dark:border-border/70 dark:bg-background text-foreground focus:ring-2 focus:ring-primary/20"
              placeholder="e.g. RM15 5DS"
              value={postcode}
              onChange={(e) => onPostcodeChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
            />
            <Button
              type="button"
              className="h-10 w-11 rounded-l-none rounded-r-lg bg-[#ef1228] px-0 hover:bg-[#d90f22]"
              size="icon"
              onClick={handleSearch}
              disabled={loading}
              title="Search addresses for this post code"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Search className="h-4 w-4 text-white" />}
            </Button>
          </div>
        </label>

        {/* Address Dropdown (populated when houses are fetched, identical to Laravel reference) */}
        <label className="space-y-2 md:col-span-2">
          <div className="flex items-center justify-between">
            <span className={fieldLabelClass}>
              {houseList.length > 0
                ? `Select Address (${houseList.length} houses found)`
                : "Select Address from Dropdown"}
            </span>
            {houseList.length > 0 ? (
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {houseList.length} addresses available
              </span>
            ) : null}
          </div>
          <select
            aria-label="Select address from houses list"
            className="h-10 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border/70 dark:bg-background"
            value={selectedDropdownValue}
            onChange={(e) => handleSelectHouse(e.target.value)}
          >
            <option value="" disabled>
              {loading
                ? "Fetching houses from post code..."
                : houseList.length > 0
                ? `-- Click to choose address (${houseList.length} found) --`
                : "Enter Post Code and click search to load houses"}
            </option>
            {houseList.map((house, idx) => (
              <option key={`${house}-${idx}`} value={house}>
                {house}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
        {/* Editable Address Line */}
        <label className="space-y-2">
          <span className={fieldLabelClass}>{resolvedAddressLabel} (Editable)</span>
          <div className="flex">
            <div className={`flex h-10 w-10 items-center justify-center rounded-l-lg border border-r-0 text-muted-foreground ${iconClassName}`}>
              <Home className="h-4 w-4" />
            </div>
            <Input
              className={inputClassName}
              placeholder="House number, street, city..."
              value={address}
              onChange={(e) => onAddressChange(e.target.value)}
            />
          </div>
        </label>

        {/* Address 2 (Optional) */}
        {onAddress2Change !== undefined ? (
          <label className="space-y-2">
            <span className={fieldLabelClass}>{resolvedAddress2Label}</span>
            <div className="flex">
              <div className={`flex h-10 w-10 items-center justify-center rounded-l-lg border border-r-0 text-muted-foreground ${iconClassName}`}>
                <Home className="h-4 w-4" />
              </div>
              <Input
                className={inputClassName}
                placeholder="Apartment, suite, unit (optional)"
                value={address2 || ""}
                onChange={(e) => onAddress2Change(e.target.value)}
              />
            </div>
          </label>
        ) : null}
      </div>
    </div>
  );
}

