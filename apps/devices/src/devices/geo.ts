import { IoTDevice } from './base';

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export class GeoDevice extends IoTDevice {
  private locationHistory: Array<{ timestamp: Date; location: GeoLocation }> = [];

  constructor(id: string) {
    super({
      id,
      methods: {
        getLocation: {
          definition: {
            description: 'Get the current geographic location',
            definition: {
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
      },
      properties: {
        name: 'Geo Device',
        description: 'IoT device that tracks and reports geographic location',
        geofenceEnabled: false,
        latitude: 0,
        longitude: 0,
      },
      configuration: {
        geofenceRadius: 1000,
        simulateMovement: true, // New config to enable/disable random walk
      },
    });
  }

  private async getLocation(): Promise<GeoLocation> {
    return {
      latitude: this.properties['latitude'] as number,
      longitude: this.properties['longitude'] as number,
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
          location: { latitude: lat, longitude: lon },
        });

        await this.reportProperties({ latitude: lat, longitude: lon });
        console.log(`Location updated to ${lat}, ${lon}`);
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
      const currentLat = this.properties['latitude'] as number;
      const currentLon = this.properties['longitude'] as number;

      if (typeof targetLat === 'number' && typeof targetLon === 'number') {
        // Haversine formula for calculating distance between two points
        const earthRadiusKm = 6371;
        const dLat = this.toRad(targetLat - currentLat);
        const dLon = this.toRad(targetLon - currentLon);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(this.toRad(currentLat)) *
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

  protected override async simulate(): Promise<void> {
      if (this.configuration['simulateMovement']) {
          // Random walk: move slightly
          const lat = this.properties['latitude'] as number;
          const lon = this.properties['longitude'] as number;
          
          // Approx 111km per degree. 0.0001 deg is ~11 meters.
          const dLat = (Math.random() - 0.5) * 0.0002; 
          const dLon = (Math.random() - 0.5) * 0.0002;
          
          const newLat = parseFloat((lat + dLat).toFixed(6));
          const newLon = parseFloat((lon + dLon).toFixed(6));
          
           // Update location
          this.locationHistory.push({
            timestamp: new Date(),
            location: { latitude: newLat, longitude: newLon },
          });
          
          await this.reportProperties({ latitude: newLat, longitude: newLon });
      }
  }
  
  protected override async onConfigurationChange(patch: Record<string, unknown>): Promise<void> {
    if ('geofenceRadius' in patch) {
        // Just update property if needed, but 'geofenceEnabled' is logic based.
        const radius = patch['geofenceRadius'] as number;
        await this.reportProperties({ geofenceEnabled: radius > 0 });
        console.log(`Geofence radius set to ${radius}m`);
    }
  }

  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}