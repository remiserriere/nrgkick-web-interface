/**
 * NRGKick Control Panel - Main Application
 * 
 * This application provides a web interface for NRGKick EV chargers
 * using the JSON API. It supports URL parameters for configuration:
 * 
 * URL Parameters:
 * - ip: Charger IP address (e.g., ?ip=192.168.1.100)
 * - user: Username for authentication (e.g., ?user=admin)
 * - pass: Password for authentication (e.g., ?pass=secret)
 * 
 * Example: index.html?ip=192.168.1.100&user=admin&pass=mypassword
 */

class NRGKickController {
    constructor() {
        this.chargerIP = '';
        this.username = '';
        this.password = '';
        this.isConnected = false;
        this.updateInterval = null;
        this.updateIntervalMs = 2000; // Update every 2 seconds
        this.commandDelayMs = 500; // Delay before refreshing status after a command

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
     */
    buildAPIUrl(endpoint) {
        const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
        return `${protocol}://${this.chargerIP}/api${endpoint}`;
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
     */
    async apiRequest(endpoint, method = 'GET', body = null) {
        const url = this.buildAPIUrl(endpoint);
        const options = {
            method,
            headers: this.getAuthHeaders(),
            mode: 'cors'
        };

        if (body && method !== 'GET') {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText} (${url})`);
        }

        return response.json();
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
     * Fetch charger device information
     */
    async fetchChargerInfo() {
        try {
            // NRGKick API endpoints - try different possible endpoints
            const endpoints = ['/info', '/device', '/settings'];
            let info = null;
            
            for (const endpoint of endpoints) {
                try {
                    info = await this.apiRequest(endpoint);
                    break;
                } catch (e) {
                    continue;
                }
            }

            if (info) {
                this.updateDeviceInfo(info);
            }
        } catch (error) {
            console.warn('Could not fetch device info:', error);
        }
    }

    /**
     * Fetch current charger status
     */
    async fetchChargerStatus() {
        try {
            // NRGKick API - try different possible status endpoints
            const endpoints = ['/status', '/charging', '/measurements'];
            let status = null;
            
            for (const endpoint of endpoints) {
                try {
                    status = await this.apiRequest(endpoint);
                    break;
                } catch (e) {
                    continue;
                }
            }

            if (status) {
                this.updateStatusDisplay(status);
            } else {
                // If no specific endpoint works, try root endpoint
                status = await this.apiRequest('');
                this.updateStatusDisplay(status);
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * Update the device information display
     */
    updateDeviceInfo(info) {
        this.serialNumberEl.textContent = info.serial_number || info.serialNumber || info.sn || '--';
        this.firmwareVersionEl.textContent = info.firmware_version || info.firmwareVersion || info.fw || '--';
        this.modelEl.textContent = info.model || info.device_type || info.type || 'NRGKick';
        
        if (info.total_energy !== undefined) {
            this.totalEnergyEl.textContent = `${(info.total_energy / 1000).toFixed(2)} kWh`;
        } else if (info.totalEnergy !== undefined) {
            this.totalEnergyEl.textContent = `${(info.totalEnergy / 1000).toFixed(2)} kWh`;
        }
    }

    /**
     * Update the status display with current values
     */
    updateStatusDisplay(status) {
        // Handle different possible API response formats
        const chargingState = status.charging_state || status.chargingState || status.state || status.status;
        const power = status.power || status.active_power || status.activePower || 0;
        const energySession = status.energy_session || status.energySession || status.session_energy || 0;
        const current = status.current || status.charging_current || status.chargingCurrent || 0;
        const voltage = status.voltage || status.grid_voltage || status.gridVoltage || 0;
        const temperature = status.temperature || status.device_temperature || status.deviceTemperature;
        const vehicleConnected = status.vehicle_connected || status.vehicleConnected || status.connected;
        const currentLimit = status.current_limit || status.currentLimit || status.max_current || status.maxCurrent || 0;

        // Update charging state with appropriate styling
        this.updateChargingState(chargingState);

        // Update power display
        if (typeof power === 'number') {
            this.powerValueEl.textContent = `${(power / 1000).toFixed(2)} kW`;
        }

        // Update energy session
        if (typeof energySession === 'number') {
            this.energySessionEl.textContent = `${(energySession / 1000).toFixed(2)} kWh`;
        }

        // Update current
        if (typeof current === 'number') {
            this.currentValueEl.textContent = `${current.toFixed(1)} A`;
        }

        // Update voltage
        if (typeof voltage === 'number') {
            this.voltageValueEl.textContent = `${voltage.toFixed(0)} V`;
        }

        // Update temperature
        if (temperature !== undefined && temperature !== null) {
            this.temperatureValueEl.textContent = `${temperature.toFixed(1)} °C`;
        }

        // Update vehicle connected status
        if (vehicleConnected !== undefined) {
            this.vehicleConnectedEl.textContent = vehicleConnected ? 'Yes' : 'No';
            this.vehicleConnectedEl.className = `status-value ${vehicleConnected ? 'charging-active' : 'charging-stopped'}`;
        }

        // Update current limit
        if (typeof currentLimit === 'number') {
            this.currentLimitEl.textContent = `${currentLimit} A`;
            this.currentSlider.value = currentLimit;
            this.currentSliderValue.textContent = `${currentLimit}A`;
            this.updateSliderBackground();
        }
    }

    /**
     * Update the charging state display
     */
    updateChargingState(state) {
        if (!state) {
            this.chargingStateEl.textContent = '--';
            this.chargingStateEl.className = 'status-value';
            return;
        }

        const stateStr = String(state).toLowerCase();
        let displayState = state;
        let stateClass = '';

        // Map common charging states
        if (stateStr.includes('charging') || stateStr.includes('active') || stateStr === 'c') {
            displayState = 'Charging';
            stateClass = 'charging-active';
        } else if (stateStr.includes('ready') || stateStr.includes('connected') || stateStr === 'b') {
            displayState = 'Ready to Charge';
            stateClass = 'charging-ready';
        } else if (stateStr.includes('idle') || stateStr.includes('standby') || stateStr === 'a') {
            displayState = 'Idle';
            stateClass = 'charging-stopped';
        } else if (stateStr.includes('error') || stateStr.includes('fault')) {
            displayState = 'Error';
            stateClass = 'charging-error';
        } else if (stateStr.includes('stopped') || stateStr.includes('paused')) {
            displayState = 'Stopped';
            stateClass = 'charging-stopped';
        }

        this.chargingStateEl.textContent = displayState;
        this.chargingStateEl.className = `status-value ${stateClass}`;
    }

    /**
     * Start charging
     */
    async startCharging() {
        try {
            this.startChargingBtn.disabled = true;
            
            // Try different possible endpoints for starting charging
            const endpoints = [
                { endpoint: '/charging', body: { enabled: true } },
                { endpoint: '/control', body: { command: 'start' } },
                { endpoint: '/start', body: {} }
            ];

            let success = false;
            for (const { endpoint, body } of endpoints) {
                try {
                    await this.apiRequest(endpoint, 'POST', body);
                    success = true;
                    break;
                } catch (e) {
                    continue;
                }
            }

            if (!success) {
                throw new Error('Could not start charging');
            }

            // Refresh status after command
            setTimeout(() => this.fetchChargerStatus(), this.commandDelayMs);
        } catch (error) {
            this.showError(`Failed to start charging: ${error.message}`);
        } finally {
            this.startChargingBtn.disabled = false;
        }
    }

    /**
     * Stop charging
     */
    async stopCharging() {
        try {
            this.stopChargingBtn.disabled = true;
            
            // Try different possible endpoints for stopping charging
            const endpoints = [
                { endpoint: '/charging', body: { enabled: false } },
                { endpoint: '/control', body: { command: 'stop' } },
                { endpoint: '/stop', body: {} }
            ];

            let success = false;
            for (const { endpoint, body } of endpoints) {
                try {
                    await this.apiRequest(endpoint, 'POST', body);
                    success = true;
                    break;
                } catch (e) {
                    continue;
                }
            }

            if (!success) {
                throw new Error('Could not stop charging');
            }

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
     */
    async setCurrentLimit() {
        const newLimit = parseInt(this.currentSlider.value, 10);
        
        try {
            this.setCurrentBtn.disabled = true;
            
            // Try different possible endpoints for setting current
            const endpoints = [
                { endpoint: '/settings', body: { current_limit: newLimit } },
                { endpoint: '/current', body: { limit: newLimit } },
                { endpoint: '/control', body: { max_current: newLimit } }
            ];

            let success = false;
            for (const { endpoint, body } of endpoints) {
                try {
                    await this.apiRequest(endpoint, 'POST', body);
                    success = true;
                    break;
                } catch (e) {
                    continue;
                }
            }

            if (!success) {
                throw new Error('Could not set current limit');
            }

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
     */
    async setPhases(phases) {
        try {
            const btn = phases === 1 ? this.phase1Btn : this.phase3Btn;
            btn.disabled = true;
            
            // Try different possible endpoints for setting phases
            const endpoints = [
                { endpoint: '/settings', body: { phases: phases } },
                { endpoint: '/phases', body: { count: phases } },
                { endpoint: '/control', body: { phases: phases } }
            ];

            let success = false;
            for (const { endpoint, body } of endpoints) {
                try {
                    await this.apiRequest(endpoint, 'POST', body);
                    success = true;
                    break;
                } catch (e) {
                    continue;
                }
            }

            if (!success) {
                throw new Error('Could not set phases');
            }

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
