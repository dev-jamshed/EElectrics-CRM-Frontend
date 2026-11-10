import { crmApi } from "@/lib/api";

const WOOSMAP_API_KEY = "woos-c819f572-d85e-3c98-9b70-36926ff3d715";

/**
 * Fetches the complete list of houses / property descriptions for a given UK postcode,
 * using the exact two-step Woosmap API method from the reference CRM system:
 * 1. localities/autocomplete -> public_id
 * 2. localities/details -> result.addresses.list
 */
export async function fetchHousesByPostcode(postcode: string): Promise<string[]> {
  const cleanPostcode = postcode.trim();
  if (!cleanPostcode || cleanPostcode.length < 2) return [];

  // Try direct Woosmap call (identical to the reference Laravel project)
  try {
    const autocompleteUrl = `https://api.woosmap.com/localities/autocomplete/?key=${WOOSMAP_API_KEY}&input=${encodeURIComponent(
      cleanPostcode
    )}&language=en&components=country:gb&types=postal_code,address`;

    const res1 = await fetch(autocompleteUrl);
    if (res1.ok) {
      const data1 = await res1.json();
      if (data1.localities && data1.localities.length > 0 && data1.localities[0].public_id) {
        const publicId = data1.localities[0].public_id;
        const detailsUrl = `https://api.woosmap.com/localities/details/?public_id=${encodeURIComponent(
          publicId
        )}&key=${WOOSMAP_API_KEY}&language=en&components=country:gb`;

        const res2 = await fetch(detailsUrl);
        if (res2.ok) {
          const data2 = await res2.json();
          const list: Array<{ description?: string }> = data2.result?.addresses?.list || [];
          const houses = list
            .map((item) => item.description?.trim())
            .filter((desc): desc is string => Boolean(desc));

          if (houses.length > 0) {
            return houses;
          }
        }
      }
    }
  } catch (err) {
    console.warn("Direct Woosmap fetch error, falling back to backend proxy:", err);
  }

  // Fallback to backend API proxy (which forwards Referer: https://crm.eelectrics.co.uk/)
  try {
    const results = await crmApi.addresses(cleanPostcode);
    return results
      .map((item) => (item.line || item.label || "").trim())
      .filter((line) => Boolean(line));
  } catch (err) {
    console.error("Backend addresses fetch failed:", err);
    return [];
  }
}

