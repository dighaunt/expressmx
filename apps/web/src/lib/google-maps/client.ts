import 'server-only';
import { BadGatewayError, ServiceUnavailableError } from '@/lib/errors/http-errors';

const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const GOOGLE_STATIC_MAP_URL = 'https://maps.googleapis.com/maps/api/staticmap';

interface GeocodeInput {
  query: string;
  autocomplete?: boolean;
  limit?: number;
  proximity?: {
    latitude: number;
    longitude: number;
  };
  bbox?: {
    minLongitude: number;
    minLatitude: number;
    maxLongitude: number;
    maxLatitude: number;
  };
}

interface GoogleGeocodeResult {
  place_id?: string;
  formatted_address?: string;
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
}

interface GoogleGeocodeResponse {
  status?: string;
  error_message?: string;
  results?: GoogleGeocodeResult[];
}

export interface NormalizedGoogleMapsFeature {
  id: string;
  name: string;
  fullAddress: string;
  latitude: number;
  longitude: number;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  postcode: string | null;
  city: string | null;
  state: string | null;
}

export async function forwardGeocode(input: GeocodeInput): Promise<NormalizedGoogleMapsFeature[]> {
  const url = new URL(GOOGLE_GEOCODE_URL);
  url.searchParams.set('address', input.query);
  url.searchParams.set('components', 'country:MX');
  url.searchParams.set('language', 'es');
  url.searchParams.set('key', getGoogleMapsApiKey());
  if (input.bbox) {
    url.searchParams.set(
      'bounds',
      `${input.bbox.minLatitude},${input.bbox.minLongitude}|${input.bbox.maxLatitude},${input.bbox.maxLongitude}`,
    );
  }

  const response = await fetch(url);
  if (!response.ok) throw new BadGatewayError('Google Maps no pudo geocodificar la dirección');
  const payload = (await response.json()) as GoogleGeocodeResponse;
  assertGoogleStatus(payload, 'Google Maps no pudo geocodificar la dirección');
  return (payload.results ?? [])
    .slice(0, clamp(input.limit ?? 5, 1, 10))
    .map(normalizeFeature)
    .filter(Boolean) as NormalizedGoogleMapsFeature[];
}

export async function reverseGeocode(input: {
  latitude: number;
  longitude: number;
}): Promise<NormalizedGoogleMapsFeature[]> {
  const url = new URL(GOOGLE_GEOCODE_URL);
  url.searchParams.set('latlng', `${input.latitude.toFixed(6)},${input.longitude.toFixed(6)}`);
  url.searchParams.set('language', 'es');
  url.searchParams.set('result_type', 'street_address|premise|route|neighborhood|sublocality|locality');
  url.searchParams.set('key', getGoogleMapsApiKey());

  const response = await fetch(url);
  if (!response.ok) throw new BadGatewayError('Google Maps no pudo resolver la dirección');
  const payload = (await response.json()) as GoogleGeocodeResponse;
  assertGoogleStatus(payload, 'Google Maps no pudo resolver la dirección');
  return (payload.results ?? []).map(normalizeFeature).filter(Boolean) as NormalizedGoogleMapsFeature[];
}

export async function getStaticMapImage(input: {
  latitude: number;
  longitude: number;
  width: number;
  height: number;
  zoom: number;
}): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const latitude = input.latitude.toFixed(6);
  const longitude = input.longitude.toFixed(6);
  const url = new URL(GOOGLE_STATIC_MAP_URL);
  url.searchParams.set('center', `${latitude},${longitude}`);
  url.searchParams.set('zoom', String(input.zoom));
  url.searchParams.set('size', `${input.width}x${input.height}`);
  url.searchParams.set('scale', '2');
  url.searchParams.set('markers', `color:blue|${latitude},${longitude}`);
  url.searchParams.set('key', getGoogleMapsApiKey());

  const response = await fetch(url);
  if (!response.ok) throw new BadGatewayError('Google Maps no pudo generar el mapa');
  return {
    bytes: await response.arrayBuffer(),
    contentType: response.headers.get('content-type') ?? 'image/png',
  };
}

function normalizeFeature(feature: GoogleGeocodeResult): NormalizedGoogleMapsFeature | null {
  const latitude = feature.geometry?.location?.lat;
  const longitude = feature.geometry?.location?.lng;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const components = feature.address_components ?? [];
  const street = component(components, 'route');
  const number = component(components, 'street_number');
  const neighborhood = component(components, 'neighborhood', 'sublocality', 'sublocality_level_1');
  const postcode = component(components, 'postal_code');
  const city = component(components, 'locality', 'administrative_area_level_2');
  const state = component(components, 'administrative_area_level_1');
  const name = [street, number].filter(Boolean).join(' ') || neighborhood || city || 'Dirección encontrada';

  return {
    id: feature.place_id ?? `${latitude},${longitude}`,
    name,
    fullAddress: feature.formatted_address ?? name,
    latitude: Number(latitude),
    longitude: Number(longitude),
    street,
    number,
    neighborhood,
    postcode,
    city,
    state,
  };
}

function component(components: NonNullable<GoogleGeocodeResult['address_components']>, ...types: string[]): string | null {
  const found = components.find((item) => item.types.some((type) => types.includes(type)));
  return found?.long_name?.trim() || null;
}

function assertGoogleStatus(payload: GoogleGeocodeResponse, message: string) {
  if (!payload.status || payload.status === 'OK' || payload.status === 'ZERO_RESULTS') return;
  throw new BadGatewayError(payload.error_message || message);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

function getGoogleMapsApiKey(): string {
  const token = process.env.GOOGLE_MAPS_API_KEY ?? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!token) throw new ServiceUnavailableError('Google Maps no está configurado');
  return token;
}
