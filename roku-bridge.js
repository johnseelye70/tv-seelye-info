/**
 * Seelye TV - Local Roku Hardware Bridge Daemon
 * tv.seelye.info - Beta 2.5.0
 * 
 * Bridges HTTPS web commands from mobile phones/iPads/browsers
 * over Supabase Realtime WebSocket to local Roku TVs on port 8060 (ECP).
 */

const http = require('http');
const os = require('os');

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nmawldbjspiefwcnykuk.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tYXdsZGJqc3BpZWZ3Y255a3VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0Njc5OTUsImV4cCI6MjEwMjA0Mzk5NX0.m67NQPyXjtbaoeXSUiUUUm8lbEJgO3NXJIlMeJTVnNU';
const CHANNEL_NAME = 'seelye-roku-relay';
const HTTP_BRIDGE_PORT = 8062;

// Discover local IPv4 addresses
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

const HOST_IP = getLocalIp();

// WebSocket resolver: use globalThis.WebSocket or 'ws' package
let WSClass = typeof WebSocket !== 'undefined' ? WebSocket : null;
if (!WSClass) {
    try {
        WSClass = require('ws');
    } catch (e) {
        console.error('WebSocket not found. Run with: node --experimental-websocket roku-bridge.js or npm install ws');
        process.exit(1);
    }
}

let ws = null;
let heartbeatInterval = null;
let bridgeHeartbeatInterval = null;
let isConnected = false;
let messageRef = 1;
let stats = {
    startedAt: new Date().toISOString(),
    commandsHandled: 0,
    lastCommand: null,
    lastAck: null
};

/**
 * Sends a command to the Roku TV via local LAN HTTP POST.
 */
function forwardToRoku(targetIp, targetPath, callback) {
    const cleanIp = (targetIp || '192.168.50.9').trim().replace(/^https?:\/\//, '').replace(/:8060.*$/, '');
    const startTime = Date.now();

    const req = http.request({
        hostname: cleanIp,
        port: 8060,
        path: targetPath,
        method: 'POST',
        headers: {
            'User-Agent': 'SeelyeTV-Bridge/2.5.0',
            'Content-Length': '0'
        },
        timeout: 4000
    }, (res) => {
        const duration = Date.now() - startTime;
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
            console.log(`[Roku ECP] ${res.statusCode === 200 ? '✓' : '⚠'} POST http://${cleanIp}:8060${targetPath} -> HTTP ${res.statusCode} (${duration}ms)`);
            stats.commandsHandled++;
            stats.lastCommand = { ip: cleanIp, path: targetPath, statusCode: res.statusCode, duration, timestamp: new Date().toISOString() };
            if (callback) callback(null, { statusCode: res.statusCode, duration, data });
        });
    });

    req.on('error', (err) => {
        const duration = Date.now() - startTime;
        console.error(`[Roku ECP] ✕ POST http://${cleanIp}:8060${targetPath} failed (${duration}ms):`, err.message);
        if (callback) callback(err, { statusCode: 0, duration, error: err.message });
    });

    req.on('timeout', () => {
        req.destroy();
        console.error(`[Roku ECP] ✕ POST http://${cleanIp}:8060${targetPath} timed out (>4000ms)`);
        if (callback) callback(new Error('Timeout'), { statusCode: 408, duration: 4000 });
    });

    req.end();
}

/**
 * Connects to Supabase Realtime WebSocket and joins relay channel.
 */
function connectWebSocket() {
    const wsUrl = `${SUPABASE_URL.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;
    console.log(`[Bridge] Connecting to Supabase Realtime relay (${SUPABASE_URL})...`);

    try {
        ws = new WSClass(wsUrl);
    } catch (err) {
        console.error('[Bridge] Failed to create WebSocket:', err.message);
        setTimeout(connectWebSocket, 5000);
        return;
    }

    ws.onopen = () => {
        console.log('[Bridge] WebSocket connection established.');
        isConnected = true;

        // Join the relay broadcast channel
        const joinPayload = {
            topic: `realtime:${CHANNEL_NAME}`,
            event: 'phx_join',
            payload: {
                config: {
                    broadcast: { ack: false, self: false },
                    presence: { key: `bridge-${HOST_IP}` }
                }
            },
            ref: String(messageRef++)
        };
        ws.send(JSON.stringify(joinPayload));

        // Start Phoenix protocol heartbeat (every 25s)
        clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
            if (ws && ws.readyState === WSClass.OPEN) {
                ws.send(JSON.stringify({
                    topic: 'phoenix',
                    event: 'heartbeat',
                    payload: {},
                    ref: String(messageRef++)
                }));
            }
        }, 25000);

        // Start Bridge Announcement broadcast (every 10s)
        sendBridgeAnnouncement();
        clearInterval(bridgeHeartbeatInterval);
        bridgeHeartbeatInterval = setInterval(sendBridgeAnnouncement, 10000);
    };

    ws.onmessage = (event) => {
        try {
            const raw = typeof event.data === 'string' ? event.data : event.data.toString();
            const msg = JSON.parse(raw);

            // Channel join confirmation
            if (msg.event === 'phx_reply' && msg.topic === `realtime:${CHANNEL_NAME}`) {
                if (msg.payload && msg.payload.status === 'ok') {
                    console.log(`[Bridge] ✓ Subscribed to relay channel "${CHANNEL_NAME}". Ready for phone commands!`);
                }
            }

            // Incoming broadcast message
            if (msg.event === 'broadcast' && msg.topic === `realtime:${CHANNEL_NAME}`) {
                const bPayload = msg.payload || {};
                if (bPayload.event === 'roku-cmd' && bPayload.payload) {
                    handleRelayCommand(bPayload.payload);
                } else if (bPayload.event === 'bridge-ping') {
                    // Mobile client pinging for immediate bridge status
                    sendBridgeAnnouncement();
                }
            }
        } catch (parseErr) {
            console.error('[Bridge] Error parsing WS message:', parseErr.message);
        }
    };

    ws.onerror = (err) => {
        console.error('[Bridge] WebSocket error:', err.message || err);
    };

    ws.onclose = (event) => {
        console.warn(`[Bridge] WebSocket closed (code: ${event.code || 'unknown'}). Reconnecting in 3s...`);
        isConnected = false;
        clearInterval(heartbeatInterval);
        clearInterval(bridgeHeartbeatInterval);
        setTimeout(connectWebSocket, 3000);
    };
}

/**
 * Sends a bridge announcement broadcast so mobile clients can detect the active bridge.
 */
function sendBridgeAnnouncement() {
    if (!ws || ws.readyState !== WSClass.OPEN) return;
    try {
        const payload = {
            topic: `realtime:${CHANNEL_NAME}`,
            event: 'broadcast',
            payload: {
                type: 'broadcast',
                event: 'bridge-heartbeat',
                payload: {
                    status: 'online',
                    hostIp: HOST_IP,
                    hostname: os.hostname(),
                    version: '2.5.0',
                    commandsHandled: stats.commandsHandled,
                    uptime: Math.floor(process.uptime()),
                    timestamp: Date.now()
                }
            },
            ref: String(messageRef++)
        };
        ws.send(JSON.stringify(payload));
    } catch (e) {}
}

/**
 * Handles an incoming command from the web app.
 */
function handleRelayCommand(data) {
    const path = data.path || (data.key ? `/keypress/${encodeURIComponent(data.key)}` : '');
    const ip = data.ip || '192.168.50.9';
    const cmdId = data.id || Math.random().toString(36).substring(2, 9);

    if (!path) {
        console.warn('[Bridge] Received invalid empty command:', data);
        return;
    }

    console.log(`[Bridge] << Received command from web app: ${path} (Target: ${ip})`);

    forwardToRoku(ip, path, (err, res) => {
        if (!ws || ws.readyState !== WSClass.OPEN) return;
        try {
            const ack = {
                topic: `realtime:${CHANNEL_NAME}`,
                event: 'broadcast',
                payload: {
                    type: 'broadcast',
                    event: 'roku-ack',
                    payload: {
                        cmdId,
                        success: !err && res.statusCode === 200,
                        statusCode: res ? res.statusCode : 0,
                        duration: res ? res.duration : 0,
                        path,
                        ip,
                        timestamp: Date.now()
                    }
                },
                ref: String(messageRef++)
            };
            ws.send(JSON.stringify(ack));
        } catch (ackErr) {}
    });
}

/**
 * Starts local HTTP server on port 8062 for status checks & direct LAN REST control.
 */
function startLocalHttpServer() {
    const server = http.createServer((req, res) => {
        // Enable CORS for LAN access
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const url = new URL(req.url, `http://${req.headers.host}`);

        if (url.pathname === '/' || url.pathname === '/status' || url.pathname === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                app: 'Seelye TV Roku Bridge',
                version: '2.5.0',
                status: isConnected ? 'online' : 'connecting',
                hostIp: HOST_IP,
                hostname: os.hostname(),
                uptime: Math.floor(process.uptime()),
                stats
            }, null, 2));
            return;
        }

        if (url.pathname === '/roku' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const parsed = body ? JSON.parse(body) : {};
                    const path = parsed.path || url.searchParams.get('path');
                    const ip = parsed.ip || url.searchParams.get('ip') || '192.168.50.9';

                    if (!path) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Missing path parameter' }));
                        return;
                    }

                    forwardToRoku(ip, path, (err, result) => {
                        res.writeHead(result.statusCode === 200 ? 200 : 502, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: !err && result.statusCode === 200,
                            path,
                            ip,
                            duration: result.duration,
                            statusCode: result.statusCode
                        }));
                    });
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
                }
            });
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    });

    server.listen(HTTP_BRIDGE_PORT, '0.0.0.0', () => {
        console.log(`[Bridge] Local HTTP server listening on http://${HOST_IP}:${HTTP_BRIDGE_PORT}`);
        console.log(`[Bridge] Web dashboard / status at: http://${HOST_IP}:${HTTP_BRIDGE_PORT}/status`);
    });

    server.on('error', (err) => {
        console.warn(`[Bridge] HTTP server on port ${HTTP_BRIDGE_PORT} failed (continuing WebSocket only):`, err.message);
    });
}

// Banner & startup
console.log('===========================================================');
console.log('       SEELYE TV - LOCAL ROKU HARDWARE BRIDGE (Beta 2.5.0)');
console.log('===========================================================');
console.log(`[Bridge] Local Host IP: ${HOST_IP}`);
console.log(`[Bridge] Target Default Roku: 192.168.50.9:8060`);
console.log(`[Bridge] Relay Channel: ${CHANNEL_NAME}`);
console.log('-----------------------------------------------------------');

startLocalHttpServer();
connectWebSocket();

// Handle graceful exit
process.on('SIGINT', () => {
    console.log('\n[Bridge] Shutting down cleanly...');
    if (ws) ws.close();
    process.exit(0);
});
process.on('SIGTERM', () => {
    if (ws) ws.close();
    process.exit(0);
});
