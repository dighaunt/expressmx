import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { PROVIDER_GOOGLE, type Provider, type Region } from 'react-native-maps';

export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

const fallbackDelta = 0.02;
const coordinatePadding = 1.6;
const isExpoGo = Constants.appOwnership === 'expo';

export const mapProvider: Provider = Platform.select({
  android: PROVIDER_GOOGLE,
  ios: isExpoGo ? undefined : PROVIDER_GOOGLE,
  default: undefined,
});

export function getMapRegion(coordinates: MapCoordinate[], fallback: MapCoordinate): Region {
  const valid = coordinates.filter(isValidCoordinate);
  if (valid.length === 0) {
    return {
      ...fallback,
      latitudeDelta: fallbackDelta,
      longitudeDelta: fallbackDelta,
    };
  }

  const latitudes = valid.map((coordinate) => coordinate.latitude);
  const longitudes = valid.map((coordinate) => coordinate.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max((maxLatitude - minLatitude) * coordinatePadding, fallbackDelta),
    longitudeDelta: Math.max((maxLongitude - minLongitude) * coordinatePadding, fallbackDelta),
  };
}

export function circlePolygon(center: MapCoordinate, radiusMeters: number, points = 72): MapCoordinate[] {
  const earthRadiusMeters = 6371000;
  const latitude = toRadians(center.latitude);
  const longitude = toRadians(center.longitude);
  const distance = radiusMeters / earthRadiusMeters;

  return Array.from({ length: points + 1 }, (_, index) => {
    const bearing = (2 * Math.PI * index) / points;
    const pointLatitude = Math.asin(
      Math.sin(latitude) * Math.cos(distance) +
        Math.cos(latitude) * Math.sin(distance) * Math.cos(bearing),
    );
    const pointLongitude =
      longitude +
      Math.atan2(
        Math.sin(bearing) * Math.sin(distance) * Math.cos(latitude),
        Math.cos(distance) - Math.sin(latitude) * Math.sin(pointLatitude),
      );

    return {
      latitude: toDegrees(pointLatitude),
      longitude: toDegrees(pointLongitude),
    };
  });
}

function isValidCoordinate(coordinate: MapCoordinate): boolean {
  return Number.isFinite(coordinate.latitude) && Number.isFinite(coordinate.longitude);
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}
