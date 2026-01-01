import { IoTDevice } from './base';

export class MotionSensor extends IoTDevice {
  private motionDetected = false;
  private lastMotionTime: Date | null = null;
  private detectionCount = 0;
  private sensitivity = 50; // 0-100

  constructor(id: string) {
    super({
      id,
      methods: {
        detectMotion: {
          definition: {
            description: 'Check if motion is currently detected',
            definition: {
              params: null,
              result: { type: 'boolean' },
            },
          },
          handler: () => this.detectMotion(),
        },
        getStatus: {
          definition: {
            description: 'Get detailed motion sensor status',
            definition: {
              params: null,
              result: { type: 'object' },
            },
          },
          handler: () => this.getStatus(),
        },
        setSensitivity: {
          definition: {
            description: 'Set the sensor sensitivity level (0-100)',
            definition: {
              params: { type: 'object', properties: { level: { type: 'number' } } },
              result: { type: 'string' },
            },
          },
          handler: (params: unknown) => this.setSensitivity(params),
        },
        reset: {
          definition: {
            description: 'Reset motion detection counters and state',
            definition: {
              params: null,
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
      },
    });
  }

  private async detectMotion(): Promise<boolean> {
    // Simulate motion detection based on sensitivity
    const randomChance = Math.random();
    const threshold = (100 - this.sensitivity) / 100;

    if (randomChance > threshold) {
      this.motionDetected = true;
      this.lastMotionTime = new Date();
      this.detectionCount++;
    } else {
      // Motion stops after a short time (simulated)
      if (this.lastMotionTime && new Date().getTime() - this.lastMotionTime.getTime() > 2000) {
        this.motionDetected = false;
      }
    }

    return this.motionDetected;
  }

  private async getStatus(): Promise<{
    motionDetected: boolean;
    lastMotionTime: string | null;
    detectionCount: number;
    sensitivity: number;
  }> {
    return {
      motionDetected: this.motionDetected,
      lastMotionTime: this.lastMotionTime ? this.lastMotionTime.toISOString() : null,
      detectionCount: this.detectionCount,
      sensitivity: this.sensitivity,
    };
  }

  private async setSensitivity(params: unknown): Promise<string> {
    if (params && typeof params === 'object' && 'level' in params) {
      const level = (params as Record<string, unknown>).level;
      if (typeof level === 'number') {
        if (level < 0 || level > 100) {
          throw new Error('Sensitivity level must be between 0 and 100');
        }
        this.sensitivity = level;
        console.log(`Motion sensor sensitivity set to ${this.sensitivity}%`);
        return `Sensitivity updated to ${this.sensitivity}%`;
      }
    }
    throw new Error('Invalid sensitivity level provided');
  }

  private async reset(): Promise<string> {
    this.motionDetected = false;
    this.lastMotionTime = null;
    this.detectionCount = 0;
    console.log('Motion sensor reset');
    return 'Motion sensor state reset successfully';
  }
}
