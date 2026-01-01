import { IoTDevice } from './base';

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export class GeoDevice extends IoTDevice {
  private location: GeoLocation;
  private locationHistory: Array<{ timestamp: Date; location: GeoLocation }> = [];
  private geofenceRadius = 1000; // meters

  constructor(id: string, location: GeoLocation) {
    super({
      id,
      methods: {
        getLocation: {
          definition: {
            description: 'Get the current geographic location',
            definition: {
              params: null,
              result: { type: 'object' },
            },
          },
          handler: () => this.getLocation(),
        },
        updateLocation: {
          definition: {
            description: 'Update the device location',
            definition: {
              params: {
                type: 'object',
                properties: {
                  latitude: { type: 'number' },
                  longitude: { type: 'number' },
                },
              },
              result: { type: 'string' },
            },
          },
          handler: (params: unknown) => this.updateLocation(params),
        },
        getLocationHistory: {
          definition: {
            description: 'Get location history of the device',
            definition: {
              params: { type: 'object', properties: { limit: { type: 'number' } } },
              result: { type: 'array' },
            },
          },
          handler: (params: unknown) => this.getLocationHistory(params),
        },
        calculateDistance: {
          definition: {
            description: 'Calculate distance to another location in kilometers',
            definition: {
              params: {
                type: 'object',
                properties: {
                  latitude: { type: 'number' },
                  longitude: { type: 'number' },
                },
              },
              result: { type: 'number' },
            },
          },
          handler: (params: unknown) => this.calculateDistance(params),
        },
        setGeofence: {
          definition: {
            description: 'Enable geofencing with specified radius in meters',
            definition: {
              params: { type: 'object', properties: { radius: { type: 'number' } } },
              result: { type: 'string' },
            },
          },
          handler: (params: unknown) => this.setGeofence(params),
        },
      },
      properties: {
        name: 'Geo Device',
        description: 'IoT device that tracks and reports geographic location',
        location,
        geofenceEnabled: false,
      },
    });
    this.location = location;
  }

  private async getLocation(): Promise<GeoLocation> {
    return {
      latitude: parseFloat(this.location.latitude.toFixed(6)),
      longitude: parseFloat(this.location.longitude.toFixed(6)),
    };
  }

  private async updateLocation(params: unknown): Promise<string> {
    if (params && typeof params === 'object' && 'latitude' in params && 'longitude' in params) {
      const lat = (params as Record<string, unknown>).latitude;
      const lon = (params as Record<string, unknown>).longitude;

      if (typeof lat === 'number' && typeof lon === 'number') {
        if (lat < -90 || lat > 90) {
          throw new Error('Latitude must be between -90 and 90');
        }
        if (lon < -180 || lon > 180) {
          throw new Error('Longitude must be between -180 and 180');
        }

        this.locationHistory.push({
          timestamp: new Date(),
          location: this.location,
        });

        this.location = { latitude: lat, longitude: lon };
        console.log(`Location updated to ${this.location.latitude}, ${this.location.longitude}`);
        return `Location updated to ${lat}, ${lon}`;
      }
    }
    throw new Error('Invalid location parameters provided');
  }

  private async getLocationHistory(
    params: unknown
  ): Promise<Array<{ timestamp: string; latitude: number; longitude: number }>> {
    let limit = 10;
    if (params && typeof params === 'object' && 'limit' in params) {
      const limitValue = (params as Record<string, unknown>).limit;
      if (typeof limitValue === 'number' && limitValue > 0) {
        limit = limitValue;
      }
    }

    return this.locationHistory.slice(-limit).map((entry) => ({
      timestamp: entry.timestamp.toISOString(),
      latitude: entry.location.latitude,
      longitude: entry.location.longitude,
    }));
  }

  private async calculateDistance(params: unknown): Promise<number> {
    if (params && typeof params === 'object' && 'latitude' in params && 'longitude' in params) {
      const targetLat = (params as Record<string, unknown>).latitude;
      const targetLon = (params as Record<string, unknown>).longitude;

      if (typeof targetLat === 'number' && typeof targetLon === 'number') {
        // Haversine formula for calculating distance between two points
        const earthRadiusKm = 6371;
        const dLat = this.toRad(targetLat - this.location.latitude);
        const dLon = this.toRad(targetLon - this.location.longitude);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(this.toRad(this.location.latitude)) *
            Math.cos(this.toRad(targetLat)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = earthRadiusKm * c;
        return parseFloat(distance.toFixed(2));
      }
    }
    throw new Error('Invalid location parameters provided');
  }

  private async setGeofence(params: unknown): Promise<string> {
    if (params && typeof params === 'object' && 'radius' in params) {
      const radius = (params as Record<string, unknown>).radius;
      if (typeof radius === 'number' && radius > 0) {
        this.geofenceRadius = radius;
        console.log(`Geofence enabled with radius ${this.geofenceRadius}m`);
        return `Geofence enabled with radius ${this.geofenceRadius} meters`;
      }
    }
    throw new Error('Invalid geofence radius provided');
  }

  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}
