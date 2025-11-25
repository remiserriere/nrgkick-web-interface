# NRGKick Web Interface

A responsive web interface for NRGKick EV chargers that works on both mobile devices and desktop computers.

## Features

- **Responsive Design**: Works on mobile devices, tablets, and desktop computers
- **Real-time Status**: View charging state, power, energy, current, voltage, and temperature
- **Charger Control**: Start/stop charging, set current limit, and switch between 1 and 3 phases
- **Device Information**: View serial number, firmware version, and total energy
- **URL Parameters**: Configure connection via URL parameters for easy bookmarking
- **Authentication Support**: Basic authentication with username and password
- **Dark Mode**: Automatic dark mode support based on system preferences
- **Auto-refresh**: Status updates every 2 seconds when connected

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

## API Compatibility

This interface uses the NRGKick JSON API. It tries multiple common API endpoints to ensure compatibility with different firmware versions:

- `/api/status` - Charger status
- `/api/info` - Device information
- `/api/settings` - Configuration
- `/api/charging` - Charging control
- `/api/control` - Command control

## Installation

Simply download the files and open `index.html` in a web browser:

```
nrgkick-web-interface/
├── index.html  # Main HTML file
├── styles.css  # Stylesheet
├── app.js      # Application logic
└── README.md   # Documentation
```

### Hosting on a Web Server

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
2. **Use a CORS proxy** if needed for development
3. **Check if your NRGKick firmware** supports CORS headers

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- Mobile browsers (iOS Safari, Chrome for Android)

## License

MIT License - feel free to use and modify as needed.

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Disclaimer

This is an unofficial interface and is not affiliated with NRGKick GmbH. Use at your own risk.
