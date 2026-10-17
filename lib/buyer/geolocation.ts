// Browser geolocation + reverse geocoding for the delivery-address form.
//
// This is a convenience prefill only: it reads the device's coordinates and
// asks OpenStreetMap's public Nominatim service to turn them into a street,
// city, state and PIN code. The result is dropped straight into editable form
// fields and is validated server-side by lib/orders/delivery.ts like any
// hand-typed address — the network response is never trusted or persisted on
// its own, and coordinates are not stored.

export type DetectedAddress = {
  line1: string;
  city: string;
  state: string;
  pincode: string;
};

type NominatimResponse = {
  address?: {
    house_number?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    village?: string;
    town?: string;
    city?: string;
    state?: string;
    postcode?: string;
  };
};

// Nominatim's public policy requires a descriptive User-Agent and forbids
// heavy traffic; the browser sets its own UA, so we just keep the request
// single, on-demand and lightly rate-limited by the button's disabled state.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

function buildLine1(address: NominatimResponse["address"]): string {
  if (!address) return "";
  const street = address.road ?? address.neighbourhood ?? address.suburb ?? "";
  const house = address.house_number ?? "";
  const joined = [house, street].filter(Boolean).join(" ").trim();
  return joined || address.village || address.town || "";
}

/**
 * Ask the browser for a one-off fix and reverse-geocode it. Returns null when
 * permission is denied, unsupported, times out, or nothing usable comes back —
 * the caller shows a neutral message and the user types the address instead.
 */
export async function detectAddressFromDevice(): Promise<DetectedAddress | null> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return null;
  }

  const coords = await new Promise<GeolocationCoordinates | null>((resolve) => {
    let settled = false;
    const done = (value: GeolocationCoordinates | null) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    navigator.geolocation.getCurrentPosition(
      (position) => done(position.coords),
      () => done(null),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  });

  if (!coords) return null;

  try {
    const params = new URLSearchParams({
      lat: String(coords.latitude),
      lon: String(coords.longitude),
      format: "jsonv2",
      addressdetails: "1",
      zoom: "18",
    });
    const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as NominatimResponse;
    const address = data.address;
    if (!address) return null;

    const detected: DetectedAddress = {
      line1: buildLine1(address),
      city: address.city ?? address.town ?? address.village ?? "",
      state: address.state ?? "",
      pincode: address.postcode ?? "",
    };
    // Only hand back something the form can actually use; otherwise let the
    // user type it rather than half-filling fields from a bad match.
    if (!detected.city && !detected.pincode) return null;
    return detected;
  } catch {
    return null;
  }
}
