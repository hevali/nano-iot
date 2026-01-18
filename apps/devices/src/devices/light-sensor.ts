import { IoTDevice } from './base';

export class LightSensor extends IoTDevice {
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
      },
      properties: {
        name: 'Light Sensor',
        description: 'IoT device that measures illuminance and controls brightness',
        unit: 'lux',
        maxIlluminance: 65535,
        colorTemperature: '5000K',
        illuminance: 500,
        brightness: 50,
      },
      configuration: {
        targetBrightness: 50,
        autoAdjustEnabled: false,
        targetIlluminance: 500,
      },
    });
  }

  private async readIlluminance(): Promise<number> {
    return this.properties['illuminance'] as number;
  }

  protected override async simulate(): Promise<void> {
    let illuminance = this.properties['illuminance'] as number;
    let brightness = this.properties['brightness'] as number;
    const { autoAdjustEnabled, targetIlluminance, targetBrightness } = this.configuration as {
      autoAdjustEnabled: boolean;
      targetIlluminance: number;
      targetBrightness: number;
    };

    // Simulate illuminance reading with random variation
    const baseVariation = (Math.random() - 0.5) * 100;
    illuminance = Math.max(0, illuminance + baseVariation);
    illuminance = parseFloat(illuminance.toFixed(2));

    // Auto-adjust brightness if enabled
    if (autoAdjustEnabled) {
      // Adjust brightness to maintain target illuminance
      const difference = targetIlluminance - illuminance;

      if (difference > 100) {
        // Increase brightness
        brightness = Math.min(100, brightness + 5);
      } else if (difference < -100) {
        // Decrease brightness
        brightness = Math.max(0, brightness - 5);
      }
    } else {
        // If not auto-adjust, follow target brightness
        if (brightness !== targetBrightness) {
            brightness = targetBrightness;
        }
    }

    await this.reportProperties({ illuminance, brightness });
  }

  protected override async onConfigurationChange(patch: Record<string, unknown>): Promise<void> {
    if ('targetBrightness' in patch && !this.configuration['autoAdjustEnabled']) {
       // Apply immediately or wait for simulation loop?
       // Simulation loop handles it.
       console.log(`Target brightness updated to ${patch['targetBrightness']}%`);
    }
    if ('autoAdjustEnabled' in patch) {
        console.log(`Auto-adjust ${patch['autoAdjustEnabled'] ? 'enabled' : 'disabled'}`);
    }
  }
}