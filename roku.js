/**
 * Roku External Control Protocol (ECP) Client Engine
 * tv.seelye.info - Beta 2.0.0
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

        const url = `${base}${path}`;
        let dispatched = false;

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
            dispatched = true;
        } catch (formErr) {
            console.warn('[RokuECP] Form dispatch note:', formErr);
        }

        // Channel 2: navigator.sendBeacon (standard fire-and-forget POST)
        try {
            if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
                navigator.sendBeacon(url, '');
                dispatched = true;
            }
        } catch (beaconErr) {}

        // Channel 3: Direct fetch with mode: 'no-cors'
        try {
            fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                cache: 'no-cache',
                credentials: 'omit'
            }).then(() => {
                dispatched = true;
            }).catch(() => {});
        } catch (fetchErr) {}

        return {
            success: true,
            message: `Command dispatched to ${getName()} (${getIp()}:8060).`
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
        return {
            success: true,
            message: `Command dispatched to ${getName()} (${getIp()}:8060). Look for on-screen reaction. (If no reaction, set Roku Settings > System > Advanced > Control by mobile apps to "Permissive").`
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
        testConnection
    };
})();

// Export for module/browser environments
if (typeof window !== 'undefined') {
    window.RokuECP = RokuECP;
}
