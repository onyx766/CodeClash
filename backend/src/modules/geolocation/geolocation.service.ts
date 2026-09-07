import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { GeoLocation, GeolocationProviderName } from './geolocation.types';

interface IpApiComResponse {
  status: 'success' | 'fail';
  country?: string;
  regionName?: string;
  city?: string;
  timezone?: string;
}

interface IpApiCoResponse {
  error?: boolean;
  country_name?: string;
  region?: string;
  city?: string;
  timezone?: string;
}

/**
 * Resolves approximate location (country/region/city/timezone) from a public
 * IP address. Best-effort: any failure (timeout, bad key, provider outage)
 * resolves to `null` rather than throwing, so callers never need to guard
 * authentication flows against this failing.
 */
@Injectable()
export class GeolocationService {
  private readonly logger = new Logger(GeolocationService.name);
  private readonly provider: GeolocationProviderName;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.provider =
      (this.config.get<string>(
        'GEOLOCATION_PROVIDER',
      ) as GeolocationProviderName) || 'ip-api';
    this.apiKey = this.config.get<string>('GEOLOCATION_API_KEY') || undefined;
    this.timeoutMs = this.config.get<number>('GEOLOCATION_TIMEOUT_MS') ?? 2000;
  }

  async getLocationFromIp(ip: string): Promise<GeoLocation | null> {
    try {
      switch (this.provider) {
        case 'ipapi':
          return await this.fetchFromIpApiCo(ip);
        case 'ip-api':
        default:
          return await this.fetchFromIpApiCom(ip);
      }
    } catch (err) {
      this.logger.debug(
        `Geolocation lookup failed via "${this.provider}": ${
          (err as Error).message
        }`,
      );
      return null;
    }
  }

  private async fetchFromIpApiCom(ip: string): Promise<GeoLocation | null> {
    const { data } = await axios.get<IpApiComResponse>(
      `http://ip-api.com/json/${encodeURIComponent(ip)}`,
      {
        timeout: this.timeoutMs,
        params: { fields: 'status,country,regionName,city,timezone' },
      },
    );

    if (!data || data.status !== 'success') return null;

    return {
      country: data.country ?? null,
      region: data.regionName ?? null,
      city: data.city ?? null,
      timezone: data.timezone ?? null,
    };
  }

  private async fetchFromIpApiCo(ip: string): Promise<GeoLocation | null> {
    const { data } = await axios.get<IpApiCoResponse>(
      `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
      {
        timeout: this.timeoutMs,
        params: this.apiKey ? { key: this.apiKey } : undefined,
      },
    );

    if (!data || data.error) return null;

    return {
      country: data.country_name ?? null,
      region: data.region ?? null,
      city: data.city ?? null,
      timezone: data.timezone ?? null,
    };
  }
}
