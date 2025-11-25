/**
 * NRGKick Control Panel - Main Application
 * 
 * This application provides a web interface for NRGKick Gen2 EV chargers
 * using the local JSON API (HTTP REST).
 * 
 * API Endpoints (based on NRGKick Gen2 local API):
 * - GET /info - Device information (serial, model, versions, network)
 * - GET /control - Control settings (current_set, charge_pause, phases)
 * - GET /values - Real-time measurements (power, energy, temperatures)
 * 
 * URL Parameters:
 * - ip: Charger IP address (e.g., ?ip=192.168.1.100)
 * - user: Username for authentication (e.g., ?user=admin)
 * - pass: Password for authentication (e.g., ?pass=secret)
 * 
 * Example: index.html?ip=192.168.1.100&user=admin&pass=mypassword
 * 
 * Note: The NRGKick device uses HTTP (not HTTPS) for local API access.
 */

// Status codes from NRGKick API
const STATUS_MAP = {
    0: 'Unknown',
    1: 'Standby',
    2: 'Connected',
    3: 'Charging',
    6: 'Error',
    7: 'Wakeup',
};

class NRGKickController {
    constructor() {
        this.chargerIP = '';
        this.username = '';
        this.password = '';
        this.isConnected = false;
        this.updateInterval = null;
        this.updateIntervalMs = 2000; // Update every 2 seconds
        this.commandDelayMs = 500; // Delay before refreshing status after a command
        this.cachedDeviceInfo = null;

        this.initElements();
        this.initEventListeners();
        this.loadURLParameters();
    }

    /**
     * Initialize DOM element references
     */
    initElements() {
        // Connection elements
        this.connectionForm = document.getElementById('connection-form');
        this.chargerIPInput = document.getElementById('charger-ip');
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.disconnectBtn = document.getElementById('disconnect-btn');
        this.connectionStatus = document.getElementById('connection-status');

        // Panels
        this.connectionPanel = document.getElementById('connection-panel');
        this.statusPanel = document.getElementById('status-panel');
        this.controlsPanel = document.getElementById('controls-panel');
        this.infoPanel = document.getElementById('info-panel');

        // Status values
        this.chargingStateEl = document.getElementById('charging-state');
        this.powerValueEl = document.getElementById('power-value');
        this.energySessionEl = document.getElementById('energy-session');
        this.currentValueEl = document.getElementById('current-value');
        this.voltageValueEl = document.getElementById('voltage-value');
        this.temperatureValueEl = document.getElementById('temperature-value');
        this.vehicleConnectedEl = document.getElementById('vehicle-connected');
        this.currentLimitEl = document.getElementById('current-limit');

        // Control buttons
        this.startChargingBtn = document.getElementById('start-charging-btn');
        this.stopChargingBtn = document.getElementById('stop-charging-btn');
        this.currentSlider = document.getElementById('current-slider');
        this.currentSliderValue = document.getElementById('current-slider-value');
        this.setCurrentBtn = document.getElementById('set-current-btn');
        this.phase1Btn = document.getElementById('phase-1-btn');
        this.phase3Btn = document.getElementById('phase-3-btn');

        // Info values
        this.serialNumberEl = document.getElementById('serial-number');
        this.firmwareVersionEl = document.getElementById('firmware-version');
        this.modelEl = document.getElementById('model');
        this.totalEnergyEl = document.getElementById('total-energy');

        // Error and loading elements
        this.errorContainer = document.getElementById('error-container');
        this.errorText = document.getElementById('error-text');
        this.closeErrorBtn = document.getElementById('close-error');
        this.loadingOverlay = document.getElementById('loading-overlay');
    }

    /**
     * Initialize event listeners
     */
    initEventListeners() {
        // Connection form
        this.connectionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.connect();
        });

        this.disconnectBtn.addEventListener('click', () => this.disconnect());

        // Control buttons
        this.startChargingBtn.addEventListener('click', () => this.startCharging());
        this.stopChargingBtn.addEventListener('click', () => this.stopCharging());
        this.setCurrentBtn.addEventListener('click', () => this.setCurrentLimit());
        this.phase1Btn.addEventListener('click', () => this.setPhases(1));
        this.phase3Btn.addEventListener('click', () => this.setPhases(3));

        // Current slider
        this.currentSlider.addEventListener('input', () => {
            this.currentSliderValue.textContent = `${this.currentSlider.value}A`;
            this.updateSliderBackground();
        });

        // Error close button
        this.closeErrorBtn.addEventListener('click', () => this.hideError());
    }

    /**
     * Load configuration from URL parameters
     */
    loadURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        
        const ip = urlParams.get('ip');
        const user = urlParams.get('user');
        const pass = urlParams.get('pass');

        if (ip) {
            this.chargerIPInput.value = ip;
        }
        if (user) {
            this.usernameInput.value = user;
        }
        if (pass) {
            this.passwordInput.value = pass;
        }

        // Auto-connect if IP is provided
        if (ip) {
            this.connect();
        }
    }

    /**
     * Update URL with current parameters
     */
    updateURL() {
        const params = new URLSearchParams();
        if (this.chargerIP) {
            params.set('ip', this.chargerIP);
        }
        if (this.username) {
            params.set('user', this.username);
        }
        // Note: We don't store password in URL for security, but we read it
        
        const newURL = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
        window.history.replaceState({}, '', newURL);
    }

    /**
     * Build the API URL for a given endpoint
     * NRGKick uses HTTP (not HTTPS) for local API access
     */
    buildAPIUrl(endpoint) {
        // Always use HTTP for NRGKick local API
        return `http://${this.chargerIP}${endpoint}`;
    }

    /**
     * Build authentication headers
     */
    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        if (this.username && this.password) {
            const credentials = btoa(`${this.username}:${this.password}`);
            headers['Authorization'] = `Basic ${credentials}`;
        }

        return headers;
    }

    /**
     * Make an API request to the charger
     * Handles both GET requests with query parameters and response parsing
     */
    async apiRequest(endpoint, params = null) {
        let url = this.buildAPIUrl(endpoint);
        
        // Add query parameters if provided
        if (params) {
            const queryString = new URLSearchParams(params).toString();
            url = `${url}?${queryString}`;
        }

        const options = {
            method: 'GET',
            headers: this.getAuthHeaders(),
            mode: 'cors'
        };

        const response = await fetch(url, options);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText} (${url})`);
        }

        const data = await response.json();
        
        // Check for API error response
        if (data.Response) {
            throw new Error(data.Response);
        }

        return data;
    }

    /**
     * Connect to the charger
     */
    async connect() {
        this.chargerIP = this.chargerIPInput.value.trim();
        this.username = this.usernameInput.value.trim();
        this.password = this.passwordInput.value;

        if (!this.chargerIP) {
            this.showError('Please enter the charger IP address');
            return;
        }

        this.showLoading(true);
        this.setConnectionStatus('connecting');

        try {
            // Try to fetch charger info to verify connection
            await this.fetchChargerInfo();
            await this.fetchChargerStatus();
            
            this.isConnected = true;
            this.setConnectionStatus('connected');
            this.updateURL();
            this.showPanels(true);
            
            // Start periodic updates
            this.startPeriodicUpdates();
            
            // Update disconnect button
            this.disconnectBtn.disabled = false;
            
        } catch (error) {
            console.error('Connection failed:', error);
            this.showError(`Connection failed: ${error.message}`);
            this.setConnectionStatus('disconnected');
            this.isConnected = false;
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Disconnect from the charger
     */
    disconnect() {
        this.stopPeriodicUpdates();
        this.isConnected = false;
        this.setConnectionStatus('disconnected');
        this.showPanels(false);
        this.disconnectBtn.disabled = true;
        this.resetStatusValues();
    }

    /**
     * Start periodic status updates
     */
    startPeriodicUpdates() {
        this.stopPeriodicUpdates();
        this.updateInterval = setInterval(() => {
            if (this.isConnected) {
                this.fetchChargerStatus().catch(error => {
                    console.error('Status update failed:', error);
                });
            }
        }, this.updateIntervalMs);
    }

    /**
     * Stop periodic status updates
     */
    stopPeriodicUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Fetch charger device information from /info endpoint
     * Sections: general, connector, grid, network, versions
     */
    async fetchChargerInfo() {
        try {
            // Request all info sections
            const info = await this.apiRequest('/info', {
                general: 1,
                connector: 1,
                grid: 1,
                network: 1,
                versions: 1
            });

            this.cachedDeviceInfo = info;
            this.updateDeviceInfo(info);
            return info;
        } catch (error) {
            console.warn('Could not fetch device info:', error);
            throw error;
        }
    }

    /**
     * Fetch current charger status from /control and /values endpoints
     */
    async fetchChargerStatus() {
        try {
            // Fetch control settings and real-time values in parallel
            const [control, values] = await Promise.all([
                this.apiRequest('/control'),
                this.apiRequest('/values', {
                    general: 1,
                    energy: 1,
                    powerflow: 1,
                    temperatures: 1
                })
            ]);

            // Merge the data for display
            const status = {
                control,
                values
            };

            this.updateStatusDisplay(status);
            return status;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Update the device information display
     * Data structure from /info endpoint:
     * - general: { serial_number, device_name, model_type, rated_current }
     * - versions: { sw_sm, hw_sm }
     * - connector: { phase_count, max_current, type, serial }
     */
    updateDeviceInfo(info) {
        // Get values from nested structure
        const general = info.general || {};
        const versions = info.versions || {};
        const connector = info.connector || {};
        
        this.serialNumberEl.textContent = general.serial_number || '--';
        this.firmwareVersionEl.textContent = versions.sw_sm || versions.smartmodule || '--';
        this.modelEl.textContent = general.model_type || 'NRGKick';
        
        // Total energy might come from /values endpoint, not /info
        // We'll update this in updateStatusDisplay if available
    }

    /**
     * Update the status display with current values
     * Data structure:
     * - control: { current_set, charge_pause, energy_limit, phase_count }
     * - values.general: { status, charging_rate, vehicle_connect_time }
     * - values.energy: { total_charged_energy, charged_energy }
     * - values.powerflow: { total_active_power, l1: {...}, l2: {...}, l3: {...} }
     * - values.temperatures: { housing, connector_l1, connector_l2, connector_l3 }
     */
    updateStatusDisplay(data) {
        const control = data.control || {};
        const values = data.values || {};
        const general = values.general || {};
        const energy = values.energy || {};
        const powerflow = values.powerflow || {};
        const temperatures = values.temperatures || {};

        // Get charging state from status code
        const statusCode = general.status;
        this.updateChargingState(statusCode);

        // Update power display (value is in Watts, convert to kW)
        const power = powerflow.total_active_power;
        if (typeof power === 'number') {
            this.powerValueEl.textContent = `${(power / 1000).toFixed(2)} kW`;
        }

        // Update session energy (value is in Wh, convert to kWh)
        const sessionEnergy = energy.charged_energy;
        if (typeof sessionEnergy === 'number') {
            this.energySessionEl.textContent = `${(sessionEnergy / 1000).toFixed(2)} kWh`;
        }

        // Update total energy
        const totalEnergy = energy.total_charged_energy;
        if (typeof totalEnergy === 'number') {
            this.totalEnergyEl.textContent = `${(totalEnergy / 1000).toFixed(2)} kWh`;
        }

        // Calculate total current from all phases
        const l1 = powerflow.l1 || {};
        const l2 = powerflow.l2 || {};
        const l3 = powerflow.l3 || {};
        const totalCurrent = (l1.current || 0) + (l2.current || 0) + (l3.current || 0);
        if (totalCurrent > 0 || statusCode === 3) {
            this.currentValueEl.textContent = `${totalCurrent.toFixed(1)} A`;
        }

        // Get voltage (use L1 voltage as reference, or max of all phases)
        const voltage = Math.max(l1.voltage || 0, l2.voltage || 0, l3.voltage || 0);
        if (voltage > 0) {
            this.voltageValueEl.textContent = `${voltage.toFixed(0)} V`;
        }

        // Update temperature (housing temperature)
        const temperature = temperatures.housing;
        if (temperature !== undefined && temperature !== null) {
            this.temperatureValueEl.textContent = `${temperature.toFixed(1)} °C`;
        }

        // Update vehicle connected status (status >= 2 means connected)
        const vehicleConnected = statusCode >= 2;
        this.vehicleConnectedEl.textContent = vehicleConnected ? 'Yes' : 'No';
        this.vehicleConnectedEl.className = `status-value ${vehicleConnected ? 'charging-active' : 'charging-stopped'}`;

        // Update current limit from control settings
        const currentLimit = control.current_set;
        if (typeof currentLimit === 'number') {
            this.currentLimitEl.textContent = `${currentLimit} A`;
            this.currentSlider.value = currentLimit;
            this.currentSliderValue.textContent = `${currentLimit}A`;
            this.updateSliderBackground();
        }

        // Update phase buttons based on current phase count
        const phases = control.phase_count;
        if (phases) {
            this.phase1Btn.classList.toggle('active', phases === 1);
            this.phase3Btn.classList.toggle('active', phases === 3);
        }
    }

    /**
     * Update the charging state display based on status code
     * Status codes:
     * 0 - Unknown
     * 1 - Standby (no vehicle)
     * 2 - Connected (vehicle connected, not charging)
     * 3 - Charging
     * 6 - Error
     * 7 - Wakeup
     */
    updateChargingState(statusCode) {
        if (statusCode === undefined || statusCode === null) {
            this.chargingStateEl.textContent = '--';
            this.chargingStateEl.className = 'status-value';
            return;
        }

        const displayState = STATUS_MAP[statusCode] || 'Unknown';
        let stateClass = '';

        switch (statusCode) {
            case 3: // Charging
                stateClass = 'charging-active';
                break;
            case 2: // Connected
            case 7: // Wakeup
                stateClass = 'charging-ready';
                break;
            case 1: // Standby
                stateClass = 'charging-stopped';
                break;
            case 6: // Error
                stateClass = 'charging-error';
                break;
            default:
                stateClass = '';
        }

        this.chargingStateEl.textContent = displayState;
        this.chargingStateEl.className = `status-value ${stateClass}`;
    }

    /**
     * Start charging (disable charge pause)
     * Uses GET /control?charge_pause=0
     */
    async startCharging() {
        try {
            this.startChargingBtn.disabled = true;
            
            await this.apiRequest('/control', { charge_pause: 0 });

            // Refresh status after command
            setTimeout(() => this.fetchChargerStatus(), this.commandDelayMs);
        } catch (error) {
            this.showError(`Failed to start charging: ${error.message}`);
        } finally {
            this.startChargingBtn.disabled = false;
        }
    }

    /**
     * Stop charging (enable charge pause)
     * Uses GET /control?charge_pause=1
     */
    async stopCharging() {
        try {
            this.stopChargingBtn.disabled = true;
            
            await this.apiRequest('/control', { charge_pause: 1 });

            // Refresh status after command
            setTimeout(() => this.fetchChargerStatus(), this.commandDelayMs);
        } catch (error) {
            this.showError(`Failed to stop charging: ${error.message}`);
        } finally {
            this.stopChargingBtn.disabled = false;
        }
    }

    /**
     * Set current limit
     * Uses GET /control?current_set=<value>
     */
    async setCurrentLimit() {
        const newLimit = parseInt(this.currentSlider.value, 10);
        
        try {
            this.setCurrentBtn.disabled = true;
            
            await this.apiRequest('/control', { current_set: newLimit });

            // Refresh status after command
            setTimeout(() => this.fetchChargerStatus(), this.commandDelayMs);
        } catch (error) {
            this.showError(`Failed to set current limit: ${error.message}`);
        } finally {
            this.setCurrentBtn.disabled = false;
        }
    }

    /**
     * Set number of phases
     * Uses GET /control?phase_count=<value>
     * Note: Phase switching must be enabled in the NRGKick app
     */
    async setPhases(phases) {
        try {
            const btn = phases === 1 ? this.phase1Btn : this.phase3Btn;
            btn.disabled = true;
            
            await this.apiRequest('/control', { phase_count: phases });

            // Update button states
            this.phase1Btn.classList.toggle('active', phases === 1);
            this.phase3Btn.classList.toggle('active', phases === 3);

            // Refresh status after command
            setTimeout(() => this.fetchChargerStatus(), this.commandDelayMs);
        } catch (error) {
            this.showError(`Failed to set phases: ${error.message}`);
        } finally {
            this.phase1Btn.disabled = false;
            this.phase3Btn.disabled = false;
        }
    }

    /**
     * Update slider background to show progress
     */
    updateSliderBackground() {
        const min = parseInt(this.currentSlider.min);
        const max = parseInt(this.currentSlider.max);
        const value = parseInt(this.currentSlider.value);
        const percentage = ((value - min) / (max - min)) * 100;
        
        this.currentSlider.style.background = `linear-gradient(to right, var(--primary-color) ${percentage}%, var(--border-color) ${percentage}%)`;
    }

    /**
     * Show/hide panels based on connection state
     */
    showPanels(connected) {
        this.statusPanel.classList.toggle('hidden', !connected);
        this.controlsPanel.classList.toggle('hidden', !connected);
        this.infoPanel.classList.toggle('hidden', !connected);
    }

    /**
     * Reset all status values to default
     */
    resetStatusValues() {
        this.chargingStateEl.textContent = '--';
        this.chargingStateEl.className = 'status-value';
        this.powerValueEl.textContent = '-- kW';
        this.energySessionEl.textContent = '-- kWh';
        this.currentValueEl.textContent = '-- A';
        this.voltageValueEl.textContent = '-- V';
        this.temperatureValueEl.textContent = '-- °C';
        this.vehicleConnectedEl.textContent = '--';
        this.vehicleConnectedEl.className = 'status-value';
        this.currentLimitEl.textContent = '-- A';
        this.serialNumberEl.textContent = '--';
        this.firmwareVersionEl.textContent = '--';
        this.modelEl.textContent = '--';
        this.totalEnergyEl.textContent = '-- kWh';
    }

    /**
     * Set connection status indicator
     */
    setConnectionStatus(status) {
        this.connectionStatus.className = `status ${status}`;
        const statusText = this.connectionStatus.querySelector('.status-text');
        
        switch (status) {
            case 'connected':
                statusText.textContent = 'Connected';
                break;
            case 'connecting':
                statusText.textContent = 'Connecting...';
                break;
            default:
                statusText.textContent = 'Disconnected';
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        this.errorText.textContent = message;
        this.errorContainer.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => this.hideError(), 5000);
    }

    /**
     * Hide error message
     */
    hideError() {
        this.errorContainer.classList.add('hidden');
    }

    /**
     * Show/hide loading overlay
     */
    showLoading(show) {
        this.loadingOverlay.classList.toggle('hidden', !show);
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.nrgkickController = new NRGKickController();
});
