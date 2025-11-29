# NRGKick Web Interface

A responsive web interface for NRGKick Gen2 EV chargers that runs in a Docker container.

## Features

- **Responsive Design**: Works on mobile devices, tablets, and desktop computers
- **Real-time Status**: View charging state, power, energy, current, voltage, and temperature
- **Charger Control**: Start/stop charging, set current limit, and switch between 1 and 3 phases
- **Device Information**: View serial number, firmware version, and total energy
- **Docker Ready**: Easy deployment with Docker and Docker Compose
- **Secure Configuration**: Credentials stored in environment variables, not in the UI
- **Dark Mode**: Automatic dark mode support based on system preferences
- **Auto-refresh**: Status updates every 2 seconds when connected

## Quick Start with Docker

### Using Docker Run

```bash
# Basic usage
docker run -p 3000:3000 -e NRGKICK_IP=192.168.1.100 ghcr.io/remiserriere/nrgkick-web-interface

# With authentication
docker run -p 3000:3000 \
  -e NRGKICK_IP=192.168.1.100 \
  -e NRGKICK_USER=admin \
  -e NRGKICK_PASS=secret \
  ghcr.io/remiserriere/nrgkick-web-interface
```

### Using Docker Compose

1. Create a `docker-compose.yml` file:

```yaml
services:
  nrgkick-web:
    image: ghcr.io/remiserriere/nrgkick-web-interface
    ports:
      - "3000:3000"
    environment:
      - NRGKICK_IP=192.168.1.100
      # - NRGKICK_USER=admin
      # - NRGKICK_PASS=secret
    restart: unless-stopped
```

2. Run:

```bash
docker-compose up -d
```

3. Open http://localhost:3000 in your browser

### Building Locally

```bash
# Clone the repository
git clone https://github.com/remiserriere/nrgkick-web-interface.git
cd nrgkick-web-interface

# Build the Docker image
docker build -t nrgkick-web .

# Run the container
docker run -p 3000:3000 -e NRGKICK_IP=192.168.1.100 nrgkick-web
```

## Configuration

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NRGKICK_IP` | Yes | IP address of your NRGKick charger | `192.168.1.100` |
| `NRGKICK_USER` | No | Username for API authentication | `admin` |
| `NRGKICK_PASS` | No | Password for API authentication | `secret` |
| `PORT` | No | Server port (default: 3000) | `8080` |

### URL Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `showConnection` | Show the connection panel (hidden by default when IP is configured) | `?showConnection=true` |

When `NRGKICK_IP` is configured via environment variable, the connection panel is hidden by default and the interface auto-connects. You can show the connection panel by adding `?showConnection=true` to the URL, which allows you to:
- View the configured IP address
- Enter username/password for authentication (overrides environment variables)

## Running Without Docker

If you prefer to run without Docker:

```bash
# Clone the repository
git clone https://github.com/remiserriere/nrgkick-web-interface.git
cd nrgkick-web-interface

# Run with Node.js (requires Node.js 14+)
NRGKICK_IP=192.168.1.100 node server.js

# With authentication
NRGKICK_IP=192.168.1.100 NRGKICK_USER=admin NRGKICK_PASS=secret node server.js
```

Then open http://localhost:3000 in your browser.

## Prerequisites

### Enable Local API on NRGKick

Before using this interface, you need to enable the local JSON API on your NRGKick device:

1. Open the NRGKick app on your smartphone
2. Go to **Extended** → **Local API**
3. Enable **JSON API**
4. (Optional) Enable **Authentication (JSON)** and set username/password
5. Note the IP address shown in the app

### Phase Switching

To use the phase switching feature (1 phase / 3 phases):

1. Open the NRGKick app
2. Go to **Extended** → **Phase Switching**
3. Enable the feature

## NRGKick API

This interface uses the NRGKick Gen2 local JSON API (HTTP REST). The API endpoints are:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/info` | GET | Device information (serial, model, versions, network) |
| `/control` | GET | Read/write control settings (current, pause, phases) |
| `/values` | GET | Real-time measurements (power, energy, temperatures) |

### Control Parameters

Control commands are sent as query parameters to `/control`:

- `current_set=<6-32>` - Set charging current in Amps
- `charge_pause=<0|1>` - 0 = charging enabled, 1 = charging paused
- `phase_count=<1|2|3>` - Set number of phases (requires phase switching enabled in app)
- `energy_limit=<Wh>` - Set energy limit in Watt-hours (0 = no limit)

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- Mobile browsers (iOS Safari, Chrome for Android)

## Troubleshooting

### Container Won't Start

1. Check that `NRGKICK_IP` environment variable is set
2. Verify the IP address is correct
3. Check container logs: `docker logs <container-id>`

### Connection Failed

1. Verify the NRGKick charger is powered on and connected to WiFi
2. Ensure you can ping the charger from the Docker host
3. Check that the JSON API is enabled in the NRGKick app
4. If using authentication, verify credentials are correct

### Phase Switching Not Working

1. Enable "Phase Switching" in the NRGKick app (Extended → Phase Switching)
2. Ensure your installation supports phase switching
3. Check the response for error messages

## License

MIT License - feel free to use and modify as needed.

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Disclaimer

This is an unofficial interface and is not affiliated with NRGKick GmbH. Use at your own risk.
