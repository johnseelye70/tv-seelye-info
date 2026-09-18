/**
 * Roku External Control Protocol (ECP) Client Engine
 * tv.seelye.info - Beta 2.4.0
 * 
 * Provides direct client-side LAN communication with Roku streaming devices.
 * Supports remote keypresses, app launching, universal search, and episode playback targeting.
 */

const RokuECP = (function () {
    const STORAGE_KEY_IP = 'seelye_tv_roku_ip';
    const STORAGE_KEY_NAME = 'seelye_tv_roku_name';
    const DEFAULT_PORT = 8060;

    // Standard Roku Channel IDs (US Market)
    const CHANNELS = {
        disney: { id: '291097', name: 'Disney+', color: '#0063e5' },
        netflix: { id: '12', name: 'Netflix', color: '#e50914' },
        hulu: { id: '2285', name: 'Hulu', color: '#1ce783' },
        peacock: { id: '593099', name: 'Peacock', color: '#000000' },
        prime: { id: '13', name: 'Prime Video', color: '#00a8e1' },
        appletv: { id: '551012', name: 'Apple TV+', color: '#000000' },
        youtube: { id: '837', name: 'YouTube', color: '#ff0000' },
        max: { id: '61322', name: 'Max', color: '#002be7' }
    };

    // Supabase Realtime Relay Configuration
    const RELAY_CHANNEL_NAME = 'seelye-roku-relay';
    let relayChannel = null;
    const bridgeStatus = {
        online: false,
        hostIp: '',
        hostname: '',
        version: '',
        lastHeartbeat: 0,
        commandsHandled: 0
    };
    const bridgeListeners = [];

    /**
     * Initializes the Supabase Realtime Relay WebSocket connection.
     */
    function initRelay() {
        let client = (typeof window !== 'undefined' && window.supabaseClient) ? window.supabaseClient : null;
        if (!client && typeof window !== 'undefined' && window.db && typeof window.db.getClient === 'function') {
            client = window.db.getClient();
        }
        if (!client && typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
            const url = window.ENV_SUPABASE_URL || 'https://nmawldbjspiefwcnykuk.supabase.co';
            const key = window.ENV_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tYXdsZGJqc3BpZWZ3Y255a3VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0Njc5OTUsImV4cCI6MjEwMjA0Mzk5NX0.m67NQPyXjtbaoeXSUiUUUm8lbEJgO3NXJIlMeJTVnNU';
            try {
                client = window.supabase.createClient(url, key);
                window.supabaseClient = client;
            } catch (e) {}
        }

        if (!client) {
            setTimeout(initRelay, 500);
            return;
        }

        if (relayChannel) return;

        try {
            relayChannel = client.channel(RELAY_CHANNEL_NAME);

            // Listen for bridge heartbeats
            relayChannel.on('broadcast', { event: 'bridge-heartbeat' }, ({ payload }) => {
                if (!payload) return;
                bridgeStatus.online = true;
                bridgeStatus.hostIp = payload.hostIp || '';
                bridgeStatus.hostname = payload.hostname || '';
                bridgeStatus.version = payload.version || '';
                bridgeStatus.commandsHandled = payload.commandsHandled || 0;
                bridgeStatus.lastHeartbeat = Date.now();
                notifyBridgeListeners();
            });

            // Listen for command ACKs
            relayChannel.on('broadcast', { event: 'roku-ack' }, ({ payload }) => {
                if (payload && typeof window !== 'undefined') {
                    console.log(`[RokuECP] Bridge ACK: ${payload.path} (${payload.duration}ms, HTTP ${payload.statusCode})`);
                    window.dispatchEvent(new CustomEvent('roku:ack', { detail: payload }));
                }
            });

            relayChannel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[RokuECP] Connected to Supabase Realtime relay. Pinging for bridge...');
                    pingBridge();
                }
            });

            // Watchdog: detect if bridge goes offline (>25s without heartbeat)
            setInterval(() => {
                if (bridgeStatus.online && Date.now() - bridgeStatus.lastHeartbeat > 25000) {
                    bridgeStatus.online = false;
                    notifyBridgeListeners();
                }
            }, 5000);
        } catch (err) {
            console.warn('[RokuECP] Relay init error:', err);
        }
    }

    /**
     * Sends a ping to ask any running bridge daemon to broadcast its presence.
     */
    function pingBridge() {
        if (!relayChannel) return;
        try {
            relayChannel.send({
                type: 'broadcast',
                event: 'bridge-ping',
                payload: { timestamp: Date.now() }
            });
        } catch (e) {}
    }

    function notifyBridgeListeners() {
        bridgeListeners.forEach(fn => {
            try { fn(getBridgeStatus()); } catch (e) {}
        });
    }

    /**
     * Subscribes to live bridge status updates.
     * @param {function(object):void} callback 
     */
    function onBridgeStatusChange(callback) {
        if (typeof callback === 'function') {
            bridgeListeners.push(callback);
            callback(getBridgeStatus());
        }
    }

    /**
     * Returns current bridge connection status.
     * @returns {{online: boolean, hostIp: string, hostname: string, version: string, lastHeartbeat: number}}
     */
    function getBridgeStatus() {
        return {
            online: bridgeStatus.online,
            hostIp: bridgeStatus.hostIp,
            hostname: bridgeStatus.hostname,
            version: bridgeStatus.version,
            commandsHandled: bridgeStatus.commandsHandled,
            lastHeartbeat: bridgeStatus.lastHeartbeat
        };
    }

    // Auto-init relay
    if (typeof window !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initRelay);
        } else {
            setTimeout(initRelay, 100);
        }
    }

    /**
     * Retrieves configured Roku IP address.
     * @returns {string}
     */
    function getIp() {
        return localStorage.getItem(STORAGE_KEY_IP) || '192.168.50.9';
    }

    /**
     * Sets and persists Roku IP address.
     * @param {string} ip 
     */
    function setIp(ip) {
        const cleaned = (ip || '').trim().replace(/^https?:\/\//, '').replace(/:8060.*$/, '');
        localStorage.setItem(STORAGE_KEY_IP, cleaned);
    }

    /**
     * Retrieves configured Roku friendly name.
     * @returns {string}
     */
    function getName() {
        return localStorage.getItem(STORAGE_KEY_NAME) || 'Roku Ultra 4850';
    }

    /**
     * Sets and persists Roku friendly name.
     * @param {string} name 
     */
    function setName(name) {
        localStorage.setItem(STORAGE_KEY_NAME, (name || '').trim() || 'Roku Ultra 4850');
    }

    /**
     * Builds the base ECP URL for the configured Roku device.
     * @returns {string}
     */
    function getBaseUrl() {
        const ip = getIp();
        if (!ip) return '';
        return `http://${ip}:${DEFAULT_PORT}`;
    }

    /**
     * Checks if a Roku device is configured.
     * @returns {boolean}
     */
    function isConfigured() {
        const ip = getIp();
        return Boolean(ip && ip.length >= 7);
    }

    /**
     * Dispatches an HTTP POST command to Roku ECP using multi-channel fallback:
     * 1. Hidden iframe Form POST (dispatches real HTTP POST without browser active mixed-content cancellation)
     * 2. navigator.sendBeacon (fire-and-forget POST)
     * 3. Direct fetch with mode: 'no-cors'
     * @param {string} path - E.g. '/keypress/Play' or '/launch/12'
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    async function sendPost(path) {
        const base = getBaseUrl();
        if (!base) {
            return {
                success: false,
                message: 'No Roku IP configured. Please select or enter your Roku IP.'
            };
        }

        const targetIp = getIp();
        const cmdId = Math.random().toString(36).substring(2, 9);
        let relayDispatched = false;

        // Primary Vector (Mobile / HTTPS): Relay through local PC bridge over Supabase Realtime WebSocket
        if (relayChannel) {
            try {
                relayChannel.send({
                    type: 'broadcast',
                    event: 'roku-cmd',
                    payload: {
                        path: path,
                        ip: targetIp,
                        id: cmdId,
                        timestamp: Date.now()
                    }
                });
                relayDispatched = true;
            } catch (relayErr) {
                console.warn('[RokuECP] Relay send note:', relayErr);
            }
        }

        // Secondary Vector (Direct LAN): Multi-channel direct POST for local unblocked environments
        const url = `${base}${path}`;

        // Channel 1: Hidden Iframe Form POST
        // In mobile WebKit/Blink on HTTPS, form navigation dispatches the HTTP POST at the socket layer
        // bypassing the active mixed-content blocking that aborts fetch() promises.
        try {
            let iframe = document.getElementById('roku-ecp-sink-frame');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'roku-ecp-sink-frame';
                iframe.name = 'roku-ecp-sink-frame';
                iframe.style.position = 'fixed';
                iframe.style.width = '1px';
                iframe.style.height = '1px';
                iframe.style.top = '-9999px';
                iframe.style.left = '-9999px';
                iframe.style.opacity = '0';
                iframe.style.pointerEvents = 'none';
                document.body.appendChild(iframe);
            }

            const form = document.createElement('form');
            form.method = 'POST';
            form.action = url;
            form.target = 'roku-ecp-sink-frame';
            form.style.display = 'none';
            document.body.appendChild(form);
            form.submit();
            setTimeout(() => {
                try { form.remove(); } catch (e) {}
            }, 500);
        } catch (formErr) {
            console.warn('[RokuECP] Form dispatch note:', formErr);
        }

        // Channel 2: navigator.sendBeacon (standard fire-and-forget POST)
        try {
            if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
                navigator.sendBeacon(url, '');
            }
        } catch (beaconErr) {}

        // Channel 3: Direct fetch with mode: 'no-cors'
        try {
            fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                cache: 'no-cache',
                credentials: 'omit'
            }).catch(() => {});
        } catch (fetchErr) {}

        const isBridge = bridgeStatus.online;
        const msg = isBridge
            ? `Dispatched via PC Bridge (${bridgeStatus.hostIp || '192.168.50.158'}) to ${getName()} (${targetIp})`
            : `Command dispatched to ${getName()} (${targetIp}:8060)`;

        return {
            success: true,
            bridgeActive: isBridge,
            cmdId,
            message: msg
        };
    }

    /**
     * Simulates a keypress on the Roku remote.
     * @param {string} key - E.g. 'Home', 'Select', 'Play', 'Back', 'Up', 'Down', etc.
     */
    async function sendKey(key) {
        if (!key) return;
        return sendPost(`/keypress/${encodeURIComponent(key)}`);
    }

    /**
     * Launches a specific Roku streaming channel by ID or provider key.
     * @param {string} providerKeyOrId - E.g. 'disney', 'netflix', or '291097'
     * @param {string} [contentId] - Optional platform content ID for deep-linking
     * @param {string} [mediaType] - Optional 'series', 'season', or 'episode'
     */
    async function launchChannel(providerKeyOrId, contentId = '', mediaType = 'series') {
        let channelId = providerKeyOrId;
        const lower = (providerKeyOrId || '').toLowerCase();

        if (CHANNELS[lower]) {
            channelId = CHANNELS[lower].id;
        }

        let query = '';
        if (contentId) {
            query = `?contentId=${encodeURIComponent(contentId)}&mediaType=${encodeURIComponent(mediaType)}`;
        }

        return sendPost(`/launch/${channelId}${query}`);
    }

    /**
     * Triggers Roku's universal OS search for a title.
     * @param {string} title 
     * @param {string} [type='series'] - 'series' or 'movie'
     */
    async function searchAndLaunch(title, type = 'series') {
        if (!title) return;
        const cleanTitle = title.trim();
        return sendPost(`/search/browse?keyword=${encodeURIComponent(cleanTitle)}&type=${encodeURIComponent(type)}&title=${encodeURIComponent(cleanTitle)}&launch=true`);
    }

    /**
     * Resolves a show's streaming provider into a Roku channel ID.
     * @param {string} providerName - E.g. 'Disney+', 'Netflix', 'Hulu'
     * @returns {string|null} Roku Channel ID
     */
    function resolveProviderChannelId(providerName) {
        if (!providerName) return null;
        const lower = providerName.toLowerCase();
        for (const [key, info] of Object.entries(CHANNELS)) {
            if (lower.includes(key) || lower.includes(info.name.toLowerCase())) {
                return info.id;
            }
        }
        return null;
    }

    /**
     * Casts/Launches a show or episode directly to the Roku.
     * Tries launching the specific provider channel first; falls back to Roku Universal Search.
     * @param {object} show - Show object containing title, services
     * @param {object} [episode] - Optional episode object with season_number, episode_number, title
     */
    async function playShowOnRoku(show, episode = null) {
        if (!show || !show.title) {
            return { success: false, message: 'Invalid show details' };
        }

        const providerName = (show.services && show.services[0]) ? show.services[0] : '';
        const channelId = resolveProviderChannelId(providerName);

        // Search query: if episode title provided, append for precise search
        const searchQuery = episode 
            ? `${show.title} ${episode.title || ''}`.trim() 
            : show.title;

        // If recognized streaming channel, launch the channel with title search
        if (channelId) {
            // First send launch channel command
            const launchRes = await launchChannel(channelId);
            // Also issue system search to assist navigation if the app supports it
            searchAndLaunch(searchQuery, 'series').catch(() => {});
            return launchRes;
        }

        // Fallback: Roku universal system search across all installed channels
        return searchAndLaunch(show.title, 'series');
    }

    /**
     * Tests connectivity to the configured Roku device by sending a harmless Info keypress.
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async function testConnection() {
        if (!isConfigured()) {
            return {
                success: false,
                message: 'Enter or select a valid Roku IP address first.'
            };
        }

        const res = await sendKey('Info');
        const bridgeNote = (res && res.bridgeActive) 
            ? ` via PC Bridge (${bridgeStatus.hostIp || '192.168.50.158'})` 
            : '';
        return {
            success: true,
            bridgeActive: bridgeStatus.online,
            message: `Command dispatched${bridgeNote} to ${getName()} (${getIp()}:8060). Look for on-screen reaction. (If no reaction, set Roku Settings > System > Advanced > Control by mobile apps to "Permissive").`
        };
    }

    return {
        CHANNELS,
        getIp,
        setIp,
        getName,
        setName,
        getBaseUrl,
        isConfigured,
        sendKey,
        launchChannel,
        searchAndLaunch,
        playShowOnRoku,
        resolveProviderChannelId,
        testConnection,
        getBridgeStatus,
        onBridgeStatusChange,
        pingBridge,
        initRelay
    };
})();

// Export for module/browser environments
if (typeof window !== 'undefined') {
    window.RokuECP = RokuECP;
}
