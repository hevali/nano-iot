import { IoTDevice } from './base';

export class MotionSensor extends IoTDevice {
  constructor(id: string) {
    super({
      id,
      methods: {
        detectMotion: {
          definition: {
            description: 'Check if motion is currently detected',
            definition: {
              result: { type: 'boolean' },
            },
          },
          handler: () => this.detectMotion(),
        },
        reset: {
          definition: {
            description: 'Reset motion detection counters and state',
            definition: {
              result: { type: 'string' },
            },
          },
          handler: () => this.reset(),
        },
      },
      properties: {
        name: 'Motion Sensor',
        description: 'IoT device that detects motion and presence',
        type: 'PIR',
        range: '5-7 meters',
        motionDetected: false,
        lastMotionTime: null,
        detectionCount: 0,
      },
      configuration: {
        sensitivity: 50,
      },
    });
  }

  private async detectMotion(): Promise<boolean> {
    return this.properties['motionDetected'] as boolean;
  }

  private async reset(): Promise<string> {
    await this.reportProperties({
      motionDetected: false,
      lastMotionTime: null,
      detectionCount: 0,
    });
    console.log('Motion sensor reset');
    return 'Motion sensor state reset successfully';
  }

  protected override async simulate(): Promise<void> {
    const sensitivity = (this.configuration['sensitivity'] as number) || 50;
    const motionDetected = this.properties['motionDetected'] as boolean;
    const detectionCount = this.properties['detectionCount'] as number;

    // Logic: If motion is not detected, random chance to detect.
    // If motion IS detected, check if it should stop (timeout).

    if (!motionDetected) {
      const randomChance = Math.random();
      // Higher sensitivity = lower threshold to trigger
      // Sensitivity 0-100.
      // If sensitivity is 100, threshold is 0 -> always trigger? No, that's too much noise.
      // Let's say max sensitivity means 50% chance per tick?
      // Old logic: threshold = (100 - sensitivity) / 100.
      // If sens=50, th=0.5. Chance > 0.5.
      // If sens=100, th=0. Chance > 0 (Always).
      // If sens=0, th=1. Chance > 1 (Never).
      // Since simulate runs every 5s, we might want lower probability.
      // Let's scale it.

      const threshold = 0.8 + ((100 - sensitivity) / 100) * 0.2;
      // If sens=100, th=0.8. 20% chance.
      // If sens=0, th=1.0. 0% chance.
      // If sens=50, th=0.9. 10% chance.

      if (randomChance > threshold) {
        await this.reportProperties({
          motionDetected: true,
          lastMotionTime: new Date().toISOString(),
          detectionCount: detectionCount + 1,
        });
        console.log('Motion detected!');
      }
    } else {
      // Motion is currently detected.
      // Reset after 2 seconds? The loop is 5s (default).
      // So if it was detected in previous tick, it should probably clear now unless we want to sustain it.
      // Let's assume it clears if simulated time passed.
      // Since simulation interval is likely > 2s, we can just clear it if it was set.

      await this.reportProperties({
        motionDetected: false,
      });
      // console.log('Motion stopped.');
    }
  }

  protected override async onConfigurationChange(patch: Record<string, unknown>): Promise<void> {
    if ('sensitivity' in patch) {
      console.log(`Motion sensor sensitivity set to ${patch['sensitivity']}%`);
    }
  }
}
