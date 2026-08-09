const KM_PER_LATITUDE_DEGREE = 111;
const DEGREES_TO_RADIANS = Math.PI / 180;

export interface GoogleMapsZoneBbox {
  minLongitude: number;
  minLatitude: number;
  maxLongitude: number;
  maxLatitude: number;
}

export interface GoogleMapsZoneBoundsInput {
  centro_lat: string;
  centro_lng: string;
  radio_km: string | null;
}

export function getZoneRadiusKm(zone: GoogleMapsZoneBoundsInput): number | null {
  if (zone.radio_km === null) return null;
  const radiusKm = Number(zone.radio_km);
  return Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : null;
}

export function getZoneBbox(zone: GoogleMapsZoneBoundsInput): GoogleMapsZoneBbox | undefined {
  const latitude = Number(zone.centro_lat);
  const longitude = Number(zone.centro_lng);
  const radiusKm = getZoneRadiusKm(zone);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || radiusKm === null) {
    return undefined;
  }

  const latitudeDelta = radiusKm / KM_PER_LATITUDE_DEGREE;
  const longitudeDelta = radiusKm / (KM_PER_LATITUDE_DEGREE * Math.cos(latitude * DEGREES_TO_RADIANS));
  return {
    minLongitude: Number((longitude - longitudeDelta).toFixed(6)),
    minLatitude: Number((latitude - latitudeDelta).toFixed(6)),
    maxLongitude: Number((longitude + longitudeDelta).toFixed(6)),
    maxLatitude: Number((latitude + latitudeDelta).toFixed(6)),
  };
}
