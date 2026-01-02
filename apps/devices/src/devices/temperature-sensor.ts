import { IoTDevice } from './base';

export class TemperatureSensor extends IoTDevice {
  private currentTemperature = 20;
  private threshold = 30;
  private alerts: Array<{ timestamp: Date; temperature: number }> = [];

  constructor(id: string) {
    super({
      id,
      methods: {
        readTemperature: {
          definition: {
            description: 'Read the current temperature value',
            definition: {
              result: { type: 'number' },
            },
          },
          handler: () => this.readTemperature(),
        },
        setThreshold: {
          definition: {
            description: 'Set the temperature alert threshold',
            definition: {
              params: { type: 'object', properties: { threshold: { type: 'number' } } },
              result: { type: 'boolean' },
            },
          },
          handler: (params: unknown) => this.setThreshold(params),
        },
        getAlerts: {
          definition: {
            description: 'Get all recorded temperature alerts',
            definition: {
              result: { type: 'array' },
            },
          },
          handler: () => this.getAlerts(),
        },
        calibrate: {
          definition: {
            description: 'Calibrate the sensor with a known temperature value',
            definition: {
              params: { type: 'object', properties: { value: { type: 'number' } } },
              result: { type: 'string' },
            },
          },
          handler: (params: unknown) => this.calibrate(params),
        },
      },
      properties: {
        name: 'Temperature Sensor',
        description: 'IoT device that monitors and reports temperature',
        unit: 'Celsius',
        min: -40,
        max: 125,
      },
    });
  }

  private async readTemperature(): Promise<number> {
    // Simulate temperature reading with small random variations
    this.currentTemperature += (Math.random() - 0.5) * 0.5;
    this.currentTemperature = parseFloat(this.currentTemperature.toFixed(2));

    // Check if threshold is exceeded
    if (this.currentTemperature > this.threshold) {
      this.alerts.push({
        timestamp: new Date(),
        temperature: this.currentTemperature,
      });
    }

    return this.currentTemperature;
  }

  private async setThreshold(params: unknown): Promise<boolean> {
    if (params && typeof params === 'object' && 'threshold' in params) {
      const threshold = (params as Record<string, unknown>).threshold;
      if (typeof threshold === 'number') {
        this.threshold = threshold;
        console.log(`Temperature threshold set to ${this.threshold}°C`);
        return true;
      }
    }
    throw new Error('Invalid threshold value provided');
  }

  private async getAlerts(): Promise<Array<{ timestamp: string; temperature: number }>> {
    return this.alerts.map((alert) => ({
      timestamp: alert.timestamp.toISOString(),
      temperature: alert.temperature,
    }));
  }

  private async calibrate(params: unknown): Promise<string> {
    if (params && typeof params === 'object' && 'value' in params) {
      const value = (params as Record<string, unknown>).value;
      if (typeof value === 'number') {
        const offset = value - this.currentTemperature;
        this.currentTemperature = value;
        console.log(`Sensor calibrated. Offset: ${offset}°C`);
        return `Calibration successful. Offset applied: ${offset}°C`;
      }
    }
    throw new Error('Invalid calibration value provided');
  }
}
