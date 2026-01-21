import { IoTDevice } from './base';

export class TemperatureSensor extends IoTDevice {
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
        temperature: 20,
      },
      configuration: {
        threshold: 30,
      },
    });
  }

  private async readTemperature(): Promise<number> {
    return this.properties['temperature'] as number;
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
        const current = this.properties['temperature'] as number;
        const offset = value - current;
        await this.reportProperties({ temperature: value });
        console.log(`Sensor calibrated. Offset: ${offset}°C`);
        return `Calibration successful. Offset applied: ${offset}°C`;
      }
    }
    throw new Error('Invalid calibration value provided');
  }

  protected override async simulate(): Promise<void> {
    let currentTemperature = this.properties['temperature'] as number;
    // Simulate temperature reading with small random variations
    currentTemperature += (Math.random() - 0.5) * 0.5;
    currentTemperature = parseFloat(currentTemperature.toFixed(2));

    const threshold = (this.configuration['threshold'] as number) || 30;

    // Check if threshold is exceeded
    if (currentTemperature > threshold) {
      this.alerts.push({
        timestamp: new Date(),
        temperature: currentTemperature,
      });
      console.log(`Alert: Temperature ${currentTemperature}°C exceeds threshold ${threshold}°C`);
    }

    await this.reportProperties({ temperature: currentTemperature });
  }

  protected override async onConfigurationChange(patch: Record<string, unknown>): Promise<void> {
    if ('threshold' in patch) {
      console.log(`Temperature threshold updated to ${patch['threshold']}°C`);
    }
  }
}