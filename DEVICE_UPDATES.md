# IoT Device Script - Updated Features

This document describes the recent updates to the device script, enabling it to run as either a Docker container or standalone CLI with support for multiple device implementations.

## Changes Overview

### 1. Enhanced CLI Interface (`main.ts`)

The script has been refactored to support:

- **Device Type Parameter**: Use `--type` flag to specify which device implementation to execute
- **Environment Variables**: Support for Docker containers via environment variables:
  - `DEVICE_ID`: Device identifier
  - `DEVICE_TYPE`: Type of device to run
  - `MQTT_BROKER_URL`: MQTT broker address (default: `mqtts://localhost:1884`)
  - `CERT_PATH`: Path to certificates directory (default: `/certs`)
- **Device Registry**: Dynamic device instantiation based on type
- **Graceful Shutdown**: Proper handling of SIGTERM and SIGINT signals

### 2. Device Registry

The following device types are now available:

- `ping`: Simple ping device (existing)
- `geo`: Geolocation device (existing)
- **`temperature`**: Temperature sensor (NEW)
- **`motion`**: Motion sensor (NEW)
- **`light`**: Light sensor (NEW)

## Usage Examples

### CLI Usage

```bash
# Run as standalone temperature sensor
./device --device sensor-1 --type temperature \
  --broker-url mqtts://example.com:1884 \
  --cert-path /path/to/certs

# Run as motion sensor with default broker
./device --device motion-1 --type motion --cert-path /certs

# View help
./device --help
```

### Docker Container Usage

```bash
docker run -e DEVICE_ID=sensor-1 \
  -e DEVICE_TYPE=temperature \
  -e MQTT_BROKER_URL=mqtts://mqtt-broker:1884 \
  -e CERT_PATH=/certs \
  -v /path/to/certs:/certs \
  my-iot-device-image
```

## New Device Implementations

### Temperature Sensor (`temperature-sensor.ts`)

Monitors and reports temperature values with alert functionality.

**Methods:**

- `readTemperature()`: Read current temperature value in Celsius
- `setThreshold(threshold: number)`: Set alert threshold
- `getAlerts()`: Retrieve all recorded temperature alerts
- `calibrate(value: number)`: Calibrate sensor with known temperature

**Properties:**

- Unit: Celsius
- Range: -40 to 125°C
- Features: Real-time reading, alert system, calibration support

---

### Motion Sensor (`motion-sensor.ts`)

Detects motion and presence with sensitivity control.

**Methods:**

- `detectMotion()`: Check if motion is currently detected
- `getStatus()`: Get detailed sensor status (detection count, last motion time, sensitivity)
- `setSensitivity(level: 0-100)`: Adjust sensor sensitivity
- `reset()`: Reset detection counters and state

**Properties:**

- Type: PIR (Passive Infrared)
- Range: 5-7 meters
- Features: Adjustable sensitivity, motion tracking, state reset

---

### Light Sensor (`light-sensor.ts`)

Measures illuminance and controls brightness with automatic adjustment.

**Methods:**

- `readIlluminance()`: Read current illuminance in lux
- `setBrightness(level: 0-100)`: Set brightness level
- `enableAutoAdjust(targetLux: number)`: Enable automatic brightness adjustment
- `getMetrics()`: Get current light sensor metrics

**Properties:**

- Unit: Lux
- Max Illuminance: 65535
- Color Temperature: 5000K
- Features: Real-time illuminance reading, brightness control, auto-adjustment

---

## Architecture

All device implementations extend the base `IoTDevice` class which provides:

- MQTT connection management
- RPC method handling
- Property publishing
- Automatic device capability advertisement

The device registry pattern allows easy addition of new device types without modifying the main script.
