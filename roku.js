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
        return localStorage.getItem(STORAGE_KEY_IP) || '';
    }

    /**
     * Sets and persists Roku IP address.
     * @param {string} ip 
     */
    function setIp(ip) {
        const cleaned = (ip || '').trim().replace(/^http:\/\//, '').replace(/:8060.*$/, '');
        localStorage.setItem(STORAGE_KEY_IP, cleaned);
    }

    /**
     * Retrieves configured Roku friendly name.
     * @returns {string}
     */
    function getName() {
        return localStorage.getItem(STORAGE_KEY_NAME) || 'My Roku';
    }

    /**
     * Sets and persists Roku friendly name.
     * @param {string} name 
     */
    function setName(name) {
        localStorage.setItem(STORAGE_KEY_NAME, (name || '').trim() || 'My Roku');
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
     * Dispatches a raw HTTP POST command to Roku ECP.
     * Uses 'no-cors' mode so the browser allows the LAN POST request through.
     * @param {string} path - E.g. '/keypress/Play' or '/launch/12'
     * @returns {Promise<{success: boolean, message?: string}>}
     */
    async function sendPost(path) {
        const base = getBaseUrl();
        if (!base) {
            return {
                success: false,
                message: 'No Roku IP configured. Please set your Roku IP in Settings.'
            };
        }

        const url = `${base}${path}`;
        try {
            // mode: 'no-cors' sends the POST request across local network without preflight failure
            await fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'text/plain'
                }
            });

            return { success: true };
        } catch (err) {
            console.warn('[RokuECP] Dispatch failed:', err);
            return {
                success: false,
                message: `Network error reaching Roku at ${getIp()}. Ensure phone/PC is on the same local Wi-Fi.`
            };
        }
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
                message: 'Enter a valid Roku IP address first (e.g. 192.168.1.50).'
            };
        }

        const res = await sendKey('Info');
        if (res.success) {
            return {
                success: true,
                message: `Command dispatched to ${getName()} (${getIp()}:8060). Look for an on-screen reaction.`
            };
        } else {
            return res;
        }
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
