# NRGKick Web Interface

A responsive web interface for NRGKick Gen2 EV chargers that works on both mobile devices and desktop computers.

## Features

- **Responsive Design**: Works on mobile devices, tablets, and desktop computers
- **Real-time Status**: View charging state, power, energy, current, voltage, and temperature
- **Charger Control**: Start/stop charging, set current limit, and switch between 1 and 3 phases
- **Device Information**: View serial number, firmware version, and total energy
- **URL Parameters**: Configure connection via URL parameters for easy bookmarking
- **Authentication Support**: Basic authentication with username and password
- **Dark Mode**: Automatic dark mode support based on system preferences
- **Auto-refresh**: Status updates every 2 seconds when connected

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

**Note:** The NRGKick device uses HTTP (not HTTPS) for local API access.

## Usage

### Basic Usage

1. Open `index.html` in your web browser
2. Enter the IP address of your NRGKick charger
3. Optionally enter username and password if authentication is required
4. Click "Connect"

### URL Parameters

You can configure the connection via URL parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `ip` | Charger IP address | `192.168.1.100` |
| `user` | Username for authentication | `admin` |
| `pass` | Password for authentication | `mypassword` |

**Example URL:**
```
index.html?ip=192.168.1.100&user=admin&pass=mypassword
```

When the `ip` parameter is provided, the interface will automatically attempt to connect.

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

## Installation

### GitHub Pages (Recommended)

This web interface can be hosted for free on GitHub Pages:

1. Fork this repository to your GitHub account
2. Go to **Settings** → **Pages**
3. Under "Build and deployment", select **GitHub Actions** as the source
4. The workflow will automatically deploy on push to the `main` branch
5. Access your interface at `https://YOUR-USERNAME.github.io/nrgkick-web-interface/`

**Example with URL parameters:**
```
https://YOUR-USERNAME.github.io/nrgkick-web-interface/?ip=192.168.1.100&user=admin&pass=mypassword
```

### Local Files

Simply download the files and open `index.html` in a web browser:

```
nrgkick-web-interface/
├── index.html  # Main HTML file
├── styles.css  # Stylesheet
├── app.js      # Application logic
└── README.md   # Documentation
```

### Self-Hosted Web Server

For production use, host the files on a web server (e.g., nginx, Apache, or a simple Python HTTP server):

```bash
# Using Python 3
python -m http.server 8080

# Using Node.js with http-server
npx http-server -p 8080
```

Then access the interface at `http://localhost:8080`

## CORS Considerations

When accessing the NRGKick charger from a web browser, CORS (Cross-Origin Resource Sharing) policies may apply. If you encounter connection issues:

1. **Host the web interface on the same network** as the charger
2. **Use a browser extension** that disables CORS for development
3. **Use a local proxy** to forward requests to the charger

**Note:** The NRGKick Gen2 firmware should include CORS headers for local API access. If you still experience issues, check your firmware version is up to date.

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- Mobile browsers (iOS Safari, Chrome for Android)

## Troubleshooting

### Connection Failed

1. Verify the IP address is correct
2. Ensure the NRGKick is powered on and connected to WiFi
3. Check that the JSON API is enabled in the NRGKick app
4. If using authentication, verify username and password

### Authentication Failed

1. Ensure "Authentication (JSON)" is enabled in the NRGKick app
2. Verify username and password are correct (case-sensitive)
3. Try disabling and re-enabling authentication in the app

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
