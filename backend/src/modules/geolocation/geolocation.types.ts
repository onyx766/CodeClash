/**
 * Approximate, IP-derived location. Never street-level - just enough to show
 * a country/region/city and timezone. May be inaccurate behind VPNs, proxies,
 * mobile carriers, or corporate networks.
 */
export interface GeoLocation {
  country: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
}

export type GeolocationProviderName = 'ip-api' | 'ipapi';
