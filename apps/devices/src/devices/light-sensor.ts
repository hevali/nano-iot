import { IoTDevice } from './base';

export class LightSensor extends IoTDevice {
  private illuminance = 500; // lux
  private brightness = 50; // 0-100
  private autoAdjustEnabled = false;
  private targetIlluminance = 500;

  constructor(id: string) {
    super({
      id,
      methods: {
        readIlluminance: {
          definition: {
            description: 'Read the current illuminance level in lux',
            definition: {
              result: { type: 'number' },
            },
          },
          handler: () => this.readIlluminance(),
        },
        setBrightness: {
          definition: {
            description: 'Set the brightness level (0-100%)',
            definition: {
              params: { type: 'object', properties: { level: { type: 'number' } } },
              result: { type: 'string' },
            },
          },
          handler: (params: unknown) => this.setBrightness(params),
        },
        enableAutoAdjust: {
          definition: {
            description: 'Enable automatic brightness adjustment based on ambient light',
            definition: {
              params: { type: 'object', properties: { targetLux: { type: 'number' } } },
              result: { type: 'string' },
            },
          },
          handler: (params: unknown) => this.enableAutoAdjust(params),
        },
        getMetrics: {
          definition: {
            description: 'Get current light sensor metrics',
            definition: {
              result: { type: 'object' },
            },
          },
          handler: () => this.getMetrics(),
        },
      },
      properties: {
        name: 'Light Sensor',
        description: 'IoT device that measures illuminance and controls brightness',
        unit: 'lux',
        maxIlluminance: 65535,
        colorTemperature: '5000K',
      },
    });
  }

  private async readIlluminance(): Promise<number> {
    // Simulate illuminance reading with random variation
    const baseVariation = (Math.random() - 0.5) * 100;
    this.illuminance = Math.max(0, this.illuminance + baseVariation);
    this.illuminance = parseFloat(this.illuminance.toFixed(2));

    // Auto-adjust brightness if enabled
    if (this.autoAdjustEnabled) {
      this.adjustBrightnessAutomatically();
    }

    return this.illuminance;
  }

  private async setBrightness(params: unknown): Promise<string> {
    if (params && typeof params === 'object' && 'level' in params) {
      const level = (params as Record<string, unknown>).level;
      if (typeof level === 'number') {
        if (level < 0 || level > 100) {
          throw new Error('Brightness level must be between 0 and 100');
        }
        this.brightness = level;
        console.log(`Brightness set to ${this.brightness}%`);
        return `Brightness updated to ${this.brightness}%`;
      }
    }
    throw new Error('Invalid brightness level provided');
  }

  private async enableAutoAdjust(params: unknown): Promise<string> {
    if (params && typeof params === 'object' && 'targetLux' in params) {
      const targetLux = (params as Record<string, unknown>).targetLux;
      if (typeof targetLux === 'number') {
        if (targetLux < 0) {
          throw new Error('Target lux value cannot be negative');
        }
        this.autoAdjustEnabled = true;
        this.targetIlluminance = targetLux;
        console.log(`Auto-adjust enabled with target illuminance of ${this.targetIlluminance} lux`);
        return `Auto-adjust enabled. Target illuminance: ${this.targetIlluminance} lux`;
      }
    }
    throw new Error('Invalid target lux value provided');
  }

  private async getMetrics(): Promise<{
    illuminance: number;
    brightness: number;
    autoAdjustEnabled: boolean;
    targetIlluminance: number;
  }> {
    return {
      illuminance: this.illuminance,
      brightness: this.brightness,
      autoAdjustEnabled: this.autoAdjustEnabled,
      targetIlluminance: this.targetIlluminance,
    };
  }

  private adjustBrightnessAutomatically(): void {
    // Adjust brightness to maintain target illuminance
    const difference = this.targetIlluminance - this.illuminance;

    if (difference > 100) {
      // Increase brightness
      this.brightness = Math.min(100, this.brightness + 5);
    } else if (difference < -100) {
      // Decrease brightness
      this.brightness = Math.max(0, this.brightness - 5);
    }
  }
}
