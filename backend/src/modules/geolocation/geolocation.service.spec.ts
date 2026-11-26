import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { GeolocationService } from './geolocation.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function buildService(env: Record<string, string | number> = {}) {
  return Test.createTestingModule({
    providers: [
      GeolocationService,
      {
        provide: ConfigService,
        useValue: { get: (key: string) => env[key] },
      },
    ],
  }).compile();
}

describe('GeolocationService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('maps a successful ip-api.com response to the internal GeoLocation shape', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        status: 'success',
        country: 'United States',
        regionName: 'California',
        city: 'San Francisco',
        timezone: 'America/Los_Angeles',
      },
    });

    const module: TestingModule = await buildService({ GEOLOCATION_PROVIDER: 'ip-api' });
    const service = module.get(GeolocationService);

    const result = await service.getLocationFromIp('203.0.113.5');

    expect(result).toEqual({
      country: 'United States',
      region: 'California',
      city: 'San Francisco',
      timezone: 'America/Los_Angeles',
    });
  });

  it('maps a successful ipapi.co response to the internal GeoLocation shape', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        country_name: 'United States',
        region: 'California',
        city: 'San Francisco',
        timezone: 'America/Los_Angeles',
      },
    });

    const module: TestingModule = await buildService({
      GEOLOCATION_PROVIDER: 'ipapi',
    });
    const service = module.get(GeolocationService);

    const result = await service.getLocationFromIp('203.0.113.5');

    expect(result).toEqual({
      country: 'United States',
      region: 'California',
      city: 'San Francisco',
      timezone: 'America/Los_Angeles',
    });
  });

  it('returns null when the provider reports failure', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { status: 'fail', message: 'invalid query' },
    });

    const module: TestingModule = await buildService({ GEOLOCATION_PROVIDER: 'ip-api' });
    const service = module.get(GeolocationService);

    const result = await service.getLocationFromIp('0.0.0.0');
    expect(result).toBeNull();
  });

  it('returns null instead of throwing when the request times out', async () => {
    mockedAxios.get.mockRejectedValue(new Error('timeout of 2000ms exceeded'));

    const module: TestingModule = await buildService({ GEOLOCATION_PROVIDER: 'ip-api' });
    const service = module.get(GeolocationService);

    const result = await service.getLocationFromIp('203.0.113.5');
    expect(result).toBeNull();
  });

  it('returns null instead of throwing on any unexpected provider error', async () => {
    mockedAxios.get.mockRejectedValue(new Error('ECONNREFUSED'));

    const module: TestingModule = await buildService({ GEOLOCATION_PROVIDER: 'ip-api' });
    const service = module.get(GeolocationService);

    await expect(service.getLocationFromIp('203.0.113.5')).resolves.toBeNull();
  });

  it('is off by default and never contacts a provider', async () => {
    const module: TestingModule = await buildService();
    const service = module.get(GeolocationService);

    await expect(service.getLocationFromIp('203.0.113.5')).resolves.toBeNull();
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});
