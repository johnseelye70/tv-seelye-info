// Initialize Supabase using environment variables or placeholders
// In production, these should be securely provided or fetched, but for standard client-side Vercel setups
// with RLS, the public anon key is safe to expose in the bundled/client code.
const SUPABASE_URL = window.ENV_SUPABASE_URL || 'https://nmawldbjspiefwcnykuk.supabase.co';
const SUPABASE_ANON_KEY = window.ENV_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tYXdsZGJqc3BpZWZ3Y255a3VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0Njc5OTUsImV4cCI6MjEwMjA0Mzk5NX0.m67NQPyXjtbaoeXSUiUUUm8lbEJgO3NXJIlMeJTVnNU';

let supabaseClient;
let _cloudOfflineUntil = 0;
let _cachedUser = undefined;
let _cachedUserTs = 0;
let _cloudDataCache = null;
let _cloudDataCacheKey = '';
let _cloudDataCacheTs = 0;
let _cloudDataInflight = null;
let _pushDebounceTimer = null;

function isCloudOffline() {
    return Date.now() < _cloudOfflineUntil;
}

function resetCloudCircuitBreaker() {
    _cloudOfflineUntil = 0;
    _cloudDataCache = null;
    _cloudDataCacheTs = 0;
}

if (typeof window !== 'undefined') {
    window.addEventListener('online', () => resetCloudCircuitBreaker());
}

async function fetchWithTimeout(resource, options = {}) {
    if (isCloudOffline()) {
        throw new Error('Cloud circuit breaker active (offline cooldown)');
    }
    const controller = new AbortController();
    const timeoutMs = 4500;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (options.signal) {
        options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    try {
        const response = await fetch(resource, { ...options, signal: controller.signal });
        clearTimeout(timer);
        return response;
    } catch (err) {
        clearTimeout(timer);
        // Activate 30s circuit breaker on network / DNS / timeout errors so subsequent calls fail in 0ms
        _cloudOfflineUntil = Date.now() + 30000;
        throw err;
    }
}

try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { fetch: fetchWithTimeout }
    });
    window.supabaseClient = supabaseClient;
} catch (e) {
    console.error("Supabase Initialization Error. Please ensure SUPABASE_URL starts with https://", e);
}

function toDeterministicUuid(id) {
    const s = String(id || '');
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
        return s;
    }
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x9e3779b9, h4 = 0xb7e15162;
    for (let i = 0; i < s.length; i++) {
        const ch = s.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
        h3 = Math.imul(h3 ^ ch, 3812015801);
        h4 = Math.imul(h4 ^ ch, 2246822507);
    }
    const hex = (h1 >>> 0).toString(16).padStart(8, '0') +
                (h2 >>> 0).toString(16).padStart(8, '0') +
                (h3 >>> 0).toString(16).padStart(8, '0') +
                (h4 >>> 0).toString(16).padStart(8, '0');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

const db = {
    toDeterministicUuid,
    getClient: () => supabaseClient,
    resetCircuitBreaker: resetCloudCircuitBreaker,
    isCloudOffline,
    // Auth logic
    async login(email, password) {
        if (!supabaseClient) return { error: new Error('Database not connected. Please check your internet or ad-blocker.') };
        resetCloudCircuitBreaker();
        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (!error) {
                _cachedUser = data?.user || null;
                _cachedUserTs = Date.now();
            }
            return { data, error };
        } catch (e) {
            return { error: e };
        }
    },

    async signup(email, password) {
        if (!supabaseClient) return { error: new Error('Database not connected. Please check your internet or ad-blocker.') };
        resetCloudCircuitBreaker();
        try {
            const { data, error } = await supabaseClient.auth.signUp({ email, password });
            return { data, error };
        } catch (e) {
            return { error: e };
        }
    },

    async logout() {
        _cachedUser = null;
        _cachedUserTs = Date.now();
        _cloudDataCache = null;
        _cloudDataCacheTs = 0;
        const { error } = await supabaseClient.auth.signOut();
        return { error };
    },

    async getCurrentUser(forceRefresh = false) {
        if (!supabaseClient) return null;
        if (!forceRefresh && _cachedUser !== undefined && (Date.now() - _cachedUserTs < 15000)) {
            return _cachedUser;
        }
        try {
            const { data: sessionData } = await supabaseClient.auth.getSession();
            if (sessionData?.session?.user) {
                _cachedUser = sessionData.session.user;
                _cachedUserTs = Date.now();
                return _cachedUser;
            }
        } catch (e) {}

        if (isCloudOffline()) {
            return _cachedUser || null;
        }

        try {
            const { data, error } = await supabaseClient.auth.getUser();
            if (error) console.warn("Auth check:", error.message);
            _cachedUser = data?.user || null;
            _cachedUserTs = Date.now();
            return _cachedUser;
        } catch (e) {
            console.error("Error fetching user:", e);
            return _cachedUser || null;
        }
    },

    onAuthStateChange(callback) {
        if (!supabaseClient) return;
        supabaseClient.auth.onAuthStateChange((event, session) => {
            _cachedUser = session?.user || null;
            _cachedUserTs = Date.now();
            callback(event, session);
        });
    },

    getLocalStreamingServices() {
        try {
            const raw = localStorage.getItem('tv_hub_services_cache');
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) { return []; }
    },

    // Data Fetching Logic
    async getStreamingServices() {
        const cached = this.getLocalStreamingServices();
        if (!supabaseClient || isCloudOffline()) return cached;
        try {
            const { data, error } = await supabaseClient.from('streaming_services').select('*');
            if (error) console.error("Error fetching streaming services:", error);
            if (Array.isArray(data) && data.length > 0) {
                try { localStorage.setItem('tv_hub_services_cache', JSON.stringify(data)); } catch (e) {}
                return data;
            }
            return data || cached;
        } catch(e) { return cached; }
    },

    async getFranchises() {
        if (!supabaseClient) return [];
        try {
            const { data, error } = await supabaseClient.from('franchises').select('*');
            if (error) console.error("Error fetching franchises:", error);
            return data || [];
        } catch(e) { return []; }
    },

    // Deletion Tombstone Ledger Helpers (Multi-Device Deletion Protection)
    getLocalDeletedItems() {
        try {
            const raw = localStorage.getItem('tv_hub_deleted_items');
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) { return []; }
    },

    getLocalDeletedIds(sourceItems = null) {
        try {
            const items = sourceItems || this.getLocalDeletedItems();
            const set = new Set();
            items.forEach(d => {
                if (d) {
                    if (d.id) set.add(String(d.id));
                    if (d.uuid) set.add(String(d.uuid));
                    if (d.tmdb_id) set.add(String(d.tmdb_id));
                    if (d.key) set.add(String(d.key));
                }
            });
            if (!sourceItems && items.length === 0) {
                const rawLegacy = localStorage.getItem('tv_hub_deleted_ids');
                if (rawLegacy) {
                    const arr = JSON.parse(rawLegacy);
                    if (Array.isArray(arr)) arr.forEach(id => { if (id) set.add(String(id)); });
                }
            }
            return set;
        } catch (e) { return new Set(); }
    },

    saveLocalDeletedItems(items) {
        try {
            const valid = Array.isArray(items) ? items : [];
            localStorage.setItem('tv_hub_deleted_items', JSON.stringify(valid));
            const idList = Array.from(this.getLocalDeletedIds(valid));
            localStorage.setItem('tv_hub_deleted_ids', JSON.stringify(idList));
        } catch (e) {}
    },

    addDeletedItem(itemOrId, uuid = null, tmdbId = null, title = null) {
        const deleted = this.getLocalDeletedItems();
        const rawId = typeof itemOrId === 'object' && itemOrId !== null ? String(itemOrId.id || '') : String(itemOrId || '');
        const targetUuid = uuid || (typeof itemOrId === 'object' && itemOrId !== null ? itemOrId.uuid : null) || toDeterministicUuid(rawId);
        const targetTmdb = tmdbId || (typeof itemOrId === 'object' && itemOrId !== null ? itemOrId.tmdb_id : null) || (rawId && !isNaN(Number(rawId)) ? rawId : null);
        const targetTitle = title || (typeof itemOrId === 'object' && itemOrId !== null ? itemOrId.title : null);
        const titleKey = targetTitle ? 'title:' + String(targetTitle).toLowerCase().trim() : null;

        const entry = {
            id: rawId,
            uuid: String(targetUuid),
            tmdb_id: targetTmdb ? String(targetTmdb) : null,
            key: titleKey,
            deleted_at: new Date().toISOString()
        };

        const filtered = deleted.filter(d => {
            if (!d) return false;
            if (entry.id && String(d.id) === entry.id) return false;
            if (entry.uuid && String(d.uuid) === entry.uuid) return false;
            if (entry.tmdb_id && String(d.tmdb_id) === entry.tmdb_id) return false;
            return true;
        });
        filtered.push(entry);

        const trimmed = filtered.slice(-500);
        this.saveLocalDeletedItems(trimmed);
        return trimmed;
    },

    removeDeletedItem(itemOrId) {
        const rawId = typeof itemOrId === 'object' && itemOrId !== null ? String(itemOrId.id || '') : String(itemOrId || '');
        const targetUuid = typeof itemOrId === 'object' && itemOrId !== null && itemOrId.uuid ? String(itemOrId.uuid) : toDeterministicUuid(rawId);
        const targetTmdb = typeof itemOrId === 'object' && itemOrId !== null && itemOrId.tmdb_id ? String(itemOrId.tmdb_id) : (rawId && !isNaN(Number(rawId)) ? rawId : null);

        const deleted = this.getLocalDeletedItems();
        const filtered = deleted.filter(d => {
            if (!d) return false;
            if (rawId && String(d.id) === rawId) return false;
            if (targetUuid && (String(d.uuid) === targetUuid || String(d.id) === targetUuid)) return false;
            if (targetTmdb && (String(d.tmdb_id) === targetTmdb || String(d.id) === targetTmdb)) return false;
            return true;
        });
        this.saveLocalDeletedItems(filtered);
    },

    isTombstoned(itemOrId, deletedSet = null) {
        const set = deletedSet || this.getLocalDeletedIds();
        if (!itemOrId) return false;
        if (typeof itemOrId === 'string' || typeof itemOrId === 'number') {
            const s = String(itemOrId);
            if (set.has(s)) return true;
            const uuid = toDeterministicUuid(s);
            if (set.has(uuid)) return true;
            return false;
        }
        if (itemOrId.id && set.has(String(itemOrId.id))) return true;
        if (itemOrId.tmdb_id && set.has(String(itemOrId.tmdb_id))) return true;
        if (itemOrId.content_item_id && set.has(String(itemOrId.content_item_id))) return true;
        if (itemOrId.id && set.has(toDeterministicUuid(itemOrId.id))) return true;
        if (itemOrId.title && set.has('title:' + String(itemOrId.title).toLowerCase().trim())) return true;
        return false;
    },

    // LocalStorage Helpers with Dual-Key Safety & Multi-Device Protection
    getLocalLibrary() {
        try {
            const deletedSet = this.getLocalDeletedIds();
            const raw1 = localStorage.getItem('tv_hub_custom_library');
            const raw2 = localStorage.getItem('tv_hub_library');
            const arr1 = raw1 ? JSON.parse(raw1) : [];
            const arr2 = raw2 ? JSON.parse(raw2) : [];
            const list1 = (Array.isArray(arr1) ? arr1 : []).filter(item => !this.isTombstoned(item, deletedSet));
            const list2 = (Array.isArray(arr2) ? arr2 : []).filter(item => !this.isTombstoned(item, deletedSet));
            if (!list1.length && list2.length) return list2;
            if (list1.length && !list2.length) return list1;
            const mergedMap = new Map();
            list2.forEach(item => { if (item && (item.id || item.tmdb_id)) mergedMap.set(String(item.id || item.tmdb_id), item); });
            list1.forEach(item => { if (item && (item.id || item.tmdb_id)) mergedMap.set(String(item.id || item.tmdb_id), item); });
            return Array.from(mergedMap.values());
        } catch (e) { return []; }
    },

    saveLocalLibrary(items) {
        try {
            const deletedSet = this.getLocalDeletedIds();
            const valid = (Array.isArray(items) ? items : []).filter(item => !this.isTombstoned(item, deletedSet));
            const str = JSON.stringify(valid);
            localStorage.setItem('tv_hub_custom_library', str);
            localStorage.setItem('tv_hub_library', str);
        } catch (e) {}
    },

    getLocalWatchlist() {
        try {
            const deletedSet = this.getLocalDeletedIds();
            const raw = localStorage.getItem('tv_hub_watchlist');
            const arr = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(arr)) return [];
            return arr.filter(w => w && !this.isTombstoned(w, deletedSet));
        } catch (e) { return []; }
    },

    saveLocalWatchlist(items) {
        try {
            const deletedSet = this.getLocalDeletedIds();
            const valid = (Array.isArray(items) ? items : []).filter(w => w && !this.isTombstoned(w, deletedSet));
            localStorage.setItem('tv_hub_watchlist', JSON.stringify(valid));
        } catch (e) {}
    },

    // Recommendation "Not Interested" Dismissal Ledger (Multi-Device Sync)
    getLocalNotInterestedItems() {
        try {
            const raw = localStorage.getItem('tv_hub_not_interested');
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) { return []; }
    },

    getLocalNotInterestedIds(sourceItems = null) {
        try {
            const items = sourceItems || this.getLocalNotInterestedItems();
            const set = new Set();
            items.forEach(d => {
                if (d) {
                    if (d.id) set.add(String(d.id));
                    if (d.uuid) set.add(String(d.uuid));
                    if (d.tmdb_id) set.add(String(d.tmdb_id));
                    if (d.key) set.add(String(d.key));
                }
            });
            return set;
        } catch (e) { return new Set(); }
    },

    saveLocalNotInterestedItems(items) {
        try {
            const valid = Array.isArray(items) ? items : [];
            localStorage.setItem('tv_hub_not_interested', JSON.stringify(valid));
        } catch (e) {}
    },

    isNotInterested(itemOrId, notInterestedSet = null) {
        const set = notInterestedSet || this.getLocalNotInterestedIds();
        if (!itemOrId || set.size === 0) return false;
        if (typeof itemOrId === 'string' || typeof itemOrId === 'number') {
            const s = String(itemOrId);
            if (set.has(s)) return true;
            if (set.has(toDeterministicUuid(s))) return true;
            return false;
        }
        if (itemOrId.id && (set.has(String(itemOrId.id)) || set.has(toDeterministicUuid(itemOrId.id)))) return true;
        if (itemOrId.tmdb_id && (set.has(String(itemOrId.tmdb_id)) || set.has(toDeterministicUuid(itemOrId.tmdb_id)))) return true;
        if (itemOrId.title && set.has('title:' + String(itemOrId.title).toLowerCase().trim())) return true;
        return false;
    },

    addNotInterestedItem(itemOrId, uuid = null, tmdbId = null, title = null, syncCloud = true) {
        const list = this.getLocalNotInterestedItems();
        const isObj = typeof itemOrId === 'object' && itemOrId !== null;
        const rawId = isObj ? String(itemOrId.id || itemOrId.tmdb_id || '') : String(itemOrId || '');
        const targetUuid = uuid || (isObj ? itemOrId.uuid : null) || (rawId ? toDeterministicUuid(rawId) : null);
        const targetTmdb = tmdbId || (isObj ? itemOrId.tmdb_id : null) || (rawId && !isNaN(Number(rawId)) ? rawId : null);
        const targetTitle = title || (isObj ? (itemOrId.title || itemOrId.name) : null);
        const titleKey = targetTitle ? 'title:' + String(targetTitle).toLowerCase().trim() : null;

        const entry = {
            id: rawId || String(targetUuid || ''),
            uuid: targetUuid ? String(targetUuid) : null,
            tmdb_id: targetTmdb ? String(targetTmdb) : null,
            title: targetTitle || null,
            key: titleKey,
            dismissed_at: new Date().toISOString()
        };

        const filtered = list.filter(d => {
            if (!d) return false;
            if (entry.id && String(d.id) === entry.id) return false;
            if (entry.uuid && String(d.uuid) === entry.uuid) return false;
            if (entry.tmdb_id && String(d.tmdb_id) === entry.tmdb_id) return false;
            if (entry.key && String(d.key) === entry.key) return false;
            return true;
        });
        filtered.push(entry);

        const trimmed = filtered.slice(-500);
        this.saveLocalNotInterestedItems(trimmed);

        if (syncCloud && supabaseClient) {
            this.getCurrentUser().then(user => {
                if (user) {
                    this.scheduleCloudPush(user.id, user.email);
                    this.broadcastSyncEvent({
                        event: 'rec-dismissed',
                        item: entry,
                        userId: user.id
                    });
                }
            }).catch(() => {});
        }
        return trimmed;
    },

    removeNotInterestedItem(itemOrId) {
        if (!itemOrId) return;
        const isObj = typeof itemOrId === 'object' && itemOrId !== null;
        const rawId = isObj ? String(itemOrId.id || '') : String(itemOrId || '');
        const targetUuid = (isObj && itemOrId.uuid) ? String(itemOrId.uuid) : (rawId ? toDeterministicUuid(rawId) : null);
        const targetTmdb = (isObj && itemOrId.tmdb_id) ? String(itemOrId.tmdb_id) : (rawId && !isNaN(Number(rawId)) ? rawId : null);
        const targetTitle = isObj ? (itemOrId.title || itemOrId.name) : null;
        const titleKey = targetTitle ? 'title:' + String(targetTitle).toLowerCase().trim() : null;

        const filtered = this.getLocalNotInterestedItems().filter(d => {
            if (!d) return false;
            if (rawId && (String(d.id) === rawId || String(d.tmdb_id) === rawId)) return false;
            if (targetUuid && (String(d.uuid) === targetUuid || String(d.id) === targetUuid)) return false;
            if (targetTmdb && (String(d.tmdb_id) === targetTmdb || String(d.id) === targetTmdb)) return false;
            if (titleKey && String(d.key) === titleKey) return false;
            return true;
        });
        this.saveLocalNotInterestedItems(filtered);
    },

    clearNotInterestedItems(syncCloud = true) {
        this.saveLocalNotInterestedItems([]);
        if (syncCloud && supabaseClient) {
            this.getCurrentUser().then(user => {
                if (user) {
                    this.scheduleCloudPush(user.id, user.email);
                    this.broadcastSyncEvent({
                        event: 'rec-dismissed-cleared',
                        userId: user.id
                    });
                }
            }).catch(() => {});
        }
    },

    // Non-destructive merging helpers with tombstone exclusion
    mergeLibrarySafely(localList, cloudList) {
        const deletedSet = this.getLocalDeletedIds();
        const local = (Array.isArray(localList) ? localList : []).filter(item => !this.isTombstoned(item, deletedSet));
        const cloud = (Array.isArray(cloudList) ? cloudList : []).filter(item => !this.isTombstoned(item, deletedSet));
        
        // Push guard: uninitialized/fresh device loading empty array never wipes cloud library
        if (local.length === 0 && cloud.length > 0) return [...cloud];
        if (cloud.length === 0 && local.length === 0) return [];
        // If cloud is empty and local has only tombstoned items, return empty
        if (cloud.length === 0 && local.length > 0) {
            const cleanLocal = local.filter(item => !this.isTombstoned(item, deletedSet));
            return cleanLocal;
        }

        const mergedMap = new Map();
        const getKey = (item) => {
            if (!item) return null;
            if (item.id) return String(item.id);
            if (item.tmdb_id) return String(item.tmdb_id);
            if (item.title) return 'title:' + String(item.title).toLowerCase().trim();
            return null;
        };

        // Seed with cloud records
        cloud.forEach(item => {
            const key = getKey(item);
            if (key) mergedMap.set(key, item);
        });

        // Merge local records non-destructively
        local.forEach(item => {
            const key = getKey(item);
            if (!key) return;
            if (mergedMap.has(key)) {
                const existing = mergedMap.get(key);
                mergedMap.set(key, { ...existing, ...item });
            } else {
                mergedMap.set(key, item);
            }
        });

        return Array.from(mergedMap.values()).filter(item => !this.isTombstoned(item, deletedSet));
    },

    mergeWatchlistSafely(localList, cloudList) {
        const deletedSet = this.getLocalDeletedIds();
        const local = (Array.isArray(localList) ? localList : []).filter(w => !this.isTombstoned(w, deletedSet));
        const cloud = (Array.isArray(cloudList) ? cloudList : []).filter(w => !this.isTombstoned(w, deletedSet));
        if (local.length === 0 && cloud.length > 0) return [...cloud];
        if (cloud.length === 0 && local.length === 0) return [];
        if (cloud.length === 0 && local.length > 0) {
            return local.filter(w => !this.isTombstoned(w, deletedSet));
        }

        const map = new Map();
        cloud.forEach(w => {
            if (w && w.content_item_id) map.set(String(w.content_item_id), w);
        });
        local.forEach(w => {
            if (!w || !w.content_item_id) return;
            const key = String(w.content_item_id);
            if (map.has(key)) {
                const existing = map.get(key);
                const tLocal = new Date(w.updated_at || 0).getTime();
                const tCloud = new Date(existing.updated_at || 0).getTime();
                const baseWinner = tLocal >= tCloud ? { ...existing, ...w } : { ...w, ...existing };

                const mergedEpisodes = {
                    ...(existing.episodes_watched || {}),
                    ...(w.episodes_watched || {})
                };

                const existingSeasons = Array.isArray(existing.completed_seasons) ? existing.completed_seasons : [];
                const incomingSeasons = Array.isArray(w.completed_seasons) ? w.completed_seasons : [];
                const mergedSeasons = Array.from(new Set([...existingSeasons, ...incomingSeasons])).sort((a, b) => a - b);

                const isArchived = Boolean(w.archived || existing.archived || baseWinner.status === 'completed');

                map.set(key, {
                    ...baseWinner,
                    episodes_watched: mergedEpisodes,
                    completed_seasons: mergedSeasons,
                    archived: isArchived
                });
            } else {
                map.set(key, w);
            }
        });
        return Array.from(map.values()).filter(w => !this.isTombstoned(w, deletedSet));
    },

    async fetchUserCloudData(userId, email = null, forceRefresh = false) {
        const emptyResult = { library: [], watchlist: [], taste: null, deleted: [], notInterested: [], hasCloudRecord: false };
        if ((!userId && !email) || !supabaseClient || isCloudOffline()) return emptyResult;

        const cacheKey = `${userId || ''}:${email || ''}`;
        if (!forceRefresh) {
            if (_cloudDataInflight && _cloudDataCacheKey === cacheKey) {
                return await _cloudDataInflight;
            }
            if (_cloudDataCache && _cloudDataCacheKey === cacheKey && (Date.now() - _cloudDataCacheTs < 5000)) {
                return _cloudDataCache;
            }
        }

        const runFetch = async () => {
            let cloudLib = null;
            let cloudWatch = null;
            let cloudTaste = null;
            let cloudDeleted = [];
            let cloudNotInterested = [];
            let cloudLibFound = false;
            let cloudWatchFound = false;

            const keysToFetch = [];
            const emailKey = email ? toDeterministicUuid('email:' + String(email).toLowerCase().trim()) : null;

            if (userId) {
                keysToFetch.push(
                    `user_deleted_${userId}`,
                    `user_library_${userId}`,
                    `user_watchlist_${userId}`,
                    `user_taste_${userId}`,
                    `user_not_interested_${userId}`
                );
            }
            if (emailKey) {
                keysToFetch.push(
                    `user_deleted_${emailKey}`,
                    `user_library_${emailKey}`,
                    `user_watchlist_${emailKey}`,
                    `user_taste_${emailKey}`,
                    `user_not_interested_${emailKey}`
                );
            }

            if (keysToFetch.length > 0) {
                try {
                    const { data: rows, error } = await supabaseClient
                        .from('system_settings')
                        .select('id, value')
                        .in('id', keysToFetch);

                    if (!error && Array.isArray(rows)) {
                        const rowMap = new Map(rows.map(r => [r.id, r.value]));

                        const applyFromPrefix = (prefixId, onlyIfMissing = false) => {
                            if (!prefixId) return;
                            const delVal = rowMap.get(`user_deleted_${prefixId}`);
                            if (delVal && (!onlyIfMissing || cloudDeleted.length === 0)) {
                                try {
                                    const parsed = JSON.parse(delVal);
                                    if (Array.isArray(parsed)) cloudDeleted = parsed;
                                } catch (e) {}
                            }
                            const libVal = rowMap.get(`user_library_${prefixId}`);
                            if (libVal !== null && libVal !== undefined && (!onlyIfMissing || !cloudLibFound)) {
                                try {
                                    const parsed = JSON.parse(libVal);
                                    if (Array.isArray(parsed)) {
                                        cloudLib = parsed;
                                        cloudLibFound = true;
                                    }
                                } catch (e) {}
                            }
                            const watchVal = rowMap.get(`user_watchlist_${prefixId}`);
                            if (watchVal !== null && watchVal !== undefined && (!onlyIfMissing || !cloudWatchFound)) {
                                try {
                                    const parsed = JSON.parse(watchVal);
                                    if (Array.isArray(parsed)) {
                                        cloudWatch = parsed;
                                        cloudWatchFound = true;
                                    }
                                } catch (e) {}
                            }
                            const tasteVal = rowMap.get(`user_taste_${prefixId}`);
                            if (tasteVal && (!onlyIfMissing || !cloudTaste)) {
                                try {
                                    const parsed = JSON.parse(tasteVal);
                                    if (parsed) cloudTaste = parsed;
                                } catch (e) {}
                            }
                            const niVal = rowMap.get(`user_not_interested_${prefixId}`);
                            if (niVal && (!onlyIfMissing || cloudNotInterested.length === 0)) {
                                try {
                                    const parsed = JSON.parse(niVal);
                                    if (Array.isArray(parsed)) cloudNotInterested = parsed;
                                } catch (e) {}
                            }
                        };

                        // 1. Primary lookup by userId
                        applyFromPrefix(userId, false);
                        // 2. Secondary fallback by deterministic email hash if any key missing
                        applyFromPrefix(emailKey, true);
                    } else if (error) {
                        console.warn("fetchUserCloudData batched query warning:", error);
                    }
                } catch (e) {
                    console.warn("fetchUserCloudData settings batch error:", e);
                }
            }

            // 3. Fallback to Supabase Auth user_metadata only if never initialized in system_settings
            if (!cloudLibFound || !cloudWatchFound) {
                try {
                    const user = await this.getCurrentUser();
                    if (user?.user_metadata) {
                        if (!cloudLibFound && Array.isArray(user.user_metadata.tv_library)) {
                            cloudLib = user.user_metadata.tv_library;
                            cloudLibFound = true;
                        }
                        if (!cloudWatchFound && Array.isArray(user.user_metadata.tv_watchlist)) {
                            cloudWatch = user.user_metadata.tv_watchlist;
                            cloudWatchFound = true;
                        }
                        if (cloudDeleted.length === 0 && Array.isArray(user.user_metadata.tv_deleted)) {
                            cloudDeleted = user.user_metadata.tv_deleted;
                        }
                        if (!cloudTaste && user.user_metadata.tv_taste_quiz) {
                            cloudTaste = user.user_metadata.tv_taste_quiz;
                        }
                    }
                } catch (e) {}
            }

            const result = {
                library: cloudLib || [],
                watchlist: cloudWatch || [],
                taste: cloudTaste,
                deleted: cloudDeleted,
                notInterested: cloudNotInterested,
                hasCloudRecord: cloudLibFound
            };
            _cloudDataCache = result;
            _cloudDataCacheKey = cacheKey;
            _cloudDataCacheTs = Date.now();
            return result;
        };

        _cloudDataCacheKey = cacheKey;
        _cloudDataInflight = runFetch().finally(() => {
            _cloudDataInflight = null;
        });
        return await _cloudDataInflight;
    },

    async getContentItems() {
        let remoteItems = [];
        let cloudUserItems = [];

        if (supabaseClient && !isCloudOffline()) {
            try {
                const user = await this.getCurrentUser();
                if (user) {
                    const cloudData = await this.fetchUserCloudData(user.id, user.email);
                    if (Array.isArray(cloudData.deleted) && cloudData.deleted.length > 0) {
                        cloudData.deleted.forEach(d => {
                            if (d) this.addDeletedItem(d.id, d.uuid, d.tmdb_id, d.title);
                        });
                    }
                    if (cloudData.hasCloudRecord) {
                        cloudUserItems = (cloudData.library || []).filter(item => !this.isTombstoned(item));
                    }
                }
            } catch(e) {}

            if (!isCloudOffline()) {
                try {
                    const { data, error } = await supabaseClient
                        .from('content_items')
                        .select(`
                            *,
                            streaming_services ( name, icon_url ),
                            franchises ( name )
                        `)
                        .order('title', { ascending: true });
                    
                    if (data && !error) {
                        remoteItems = data.filter(item => !this.isTombstoned(item));
                    }
                } catch(e) {}
            }
        }

        const localItems = this.getLocalLibrary();
        let merged = this.mergeLibrarySafely(localItems, cloudUserItems);
        merged = this.mergeLibrarySafely(merged, remoteItems);

        // Keep local storage synchronized with resolved library (including empty array)
        this.saveLocalLibrary(merged);

        return merged;
    },

    async getUserWatchlist(userId) {
        let remoteList = [];
        let cloudUserWatch = [];

        if (userId && supabaseClient && !isCloudOffline()) {
            try {
                const user = await this.getCurrentUser();
                const cloudData = await this.fetchUserCloudData(userId, user?.email);
                if (Array.isArray(cloudData.deleted) && cloudData.deleted.length > 0) {
                    cloudData.deleted.forEach(d => {
                        if (d) this.addDeletedItem(d.id, d.uuid, d.tmdb_id, d.title);
                    });
                }
                if (cloudData.hasCloudRecord) {
                    cloudUserWatch = (cloudData.watchlist || []).filter(w => !this.isTombstoned(w));
                }
            } catch(e) {}

            if (!isCloudOffline()) {
                try {
                    const { data, error } = await supabaseClient
                        .from('user_watchlist')
                        .select('*')
                        .eq('user_id', userId);
                    
                    if (data && !error) {
                        remoteList = data.filter(w => !this.isTombstoned(w));
                    }
                } catch(e) {}
            }
        }

        const localList = this.getLocalWatchlist();
        let merged = this.mergeWatchlistSafely(localList, cloudUserWatch);
        merged = this.mergeWatchlistSafely(merged, remoteList);

        this.saveLocalWatchlist(merged);
        return merged;
    },

    scheduleCloudPush(userId, email = null) {
        if (!userId || userId === 'guest' || !supabaseClient) return;
        if (_pushDebounceTimer) clearTimeout(_pushDebounceTimer);
        _pushDebounceTimer = setTimeout(async () => {
            _pushDebounceTimer = null;
            try {
                const u = await this.getCurrentUser();
                await this.pushLocalToCloud(userId, email || u?.email);
            } catch (e) {}
        }, 350);
    },

    // Updates
    async upsertWatchlistItem(userId, contentItemId, status, rating = null, extraFields = {}) {
        const uuid = toDeterministicUuid(contentItemId);
        const rawId = String(contentItemId);
        
        // Remove from tombstone ledger since user is actively interacting with/adding it
        this.removeDeletedItem(rawId);
        this.removeDeletedItem(uuid);

        // Always persist to local storage for immediate responsiveness & guest support
        const localList = this.getLocalWatchlist();
        const existingIdx = localList.findIndex(w => String(w.content_item_id) === String(uuid) || String(w.content_item_id) === rawId);
        const existing = existingIdx >= 0 ? localList[existingIdx] : {};

        const updatedEntry = {
            ...existing,
            user_id: userId || 'guest',
            content_item_id: String(uuid),
            status: status !== undefined ? status : (existing.status || 'watching'),
            rating: rating !== undefined && rating !== null ? rating : (existing.rating || null),
            episodes_watched: extraFields.episodes_watched !== undefined ? extraFields.episodes_watched : (existing.episodes_watched || {}),
            completed_seasons: extraFields.completed_seasons !== undefined ? extraFields.completed_seasons : (existing.completed_seasons || []),
            archived: extraFields.archived !== undefined ? extraFields.archived : (existing.archived || false),
            watched_count: extraFields.watched_count !== undefined ? extraFields.watched_count : (existing.watched_count || 0),
            total_episodes: extraFields.total_episodes !== undefined ? extraFields.total_episodes : (existing.total_episodes || 0),
            updated_at: new Date().toISOString()
        };

        if (existingIdx >= 0) {
            localList[existingIdx] = updatedEntry;
        } else {
            localList.push(updatedEntry);
        }
        this.saveLocalWatchlist(localList);

        if (userId && userId !== 'guest' && supabaseClient) {
            this.getCurrentUser().then(user => {
                this.scheduleCloudPush(userId, user?.email);
                this.broadcastSyncEvent({
                    event: 'watch-updated',
                    contentItemId: rawId,
                    uuid: uuid,
                    userId: userId
                });
            }).catch(() => {});

            if (!isCloudOffline()) {
                Promise.resolve(
                    supabaseClient
                        .from('user_watchlist')
                        .upsert({ 
                            user_id: userId, 
                            content_item_id: uuid, 
                            status: status,
                            rating: rating,
                            updated_at: updatedEntry.updated_at
                        }, { onConflict: 'user_id,content_item_id' })
                ).then(({ error }) => {
                    if (error) console.warn("Supabase upsert watchlist warning:", error);
                }).catch(e => console.warn("Database watchlist exception:", e));
            }
        }

        return { data: [updatedEntry], error: null };
    },

    // Delete / Remove Item from Library & Watchlist (Records Tombstone & Real-Time Sync)
    async deleteContentItem(contentItemId) {
        const uuid = toDeterministicUuid(contentItemId);
        const idStr = String(uuid);
        const rawId = String(contentItemId);
        
        // 1. Find item details for tombstone
        const currentLib = this.getLocalLibrary();
        const existingItem = currentLib.find(item => 
            String(item.id) === idStr || String(item.id) === rawId || String(item.tmdb_id || '') === rawId
        );
        const tmdbId = existingItem?.tmdb_id || (rawId && !isNaN(Number(rawId)) ? rawId : null);
        const title = existingItem?.title || null;

        // 2. Add to tombstone ledger
        this.addDeletedItem(rawId, uuid, tmdbId, title);

        // 3. Remove from local library
        const localLib = currentLib.filter(item => 
            String(item.id) !== idStr && String(item.id) !== rawId && String(item.tmdb_id || '') !== rawId
        );
        this.saveLocalLibrary(localLib);

        // 4. Remove from local watchlist
        const localWatchlist = this.getLocalWatchlist().filter(w => 
            String(w.content_item_id) !== idStr && String(w.content_item_id) !== rawId
        );
        this.saveLocalWatchlist(localWatchlist);

        // 5. Non-blocking cloud push & relational cleanup if authenticated
        if (supabaseClient) {
            this.getCurrentUser().then(user => {
                if (user) {
                    this.scheduleCloudPush(user.id, user.email);
                    this.broadcastSyncEvent({
                        event: 'item-deleted',
                        id: rawId,
                        uuid: uuid,
                        tmdb_id: tmdbId,
                        title: title,
                        userId: user.id
                    });
                }
            }).catch(() => {});

            if (!isCloudOffline()) {
                (async () => {
                    try {
                        await supabaseClient.from('user_watchlist').delete().eq('content_item_id', uuid);
                        await supabaseClient.from('content_items').delete().eq('id', uuid);
                    } catch (e) {}
                })();
            }
        }
        return { error: null };
    },

    async deleteWatchlistItem(userId, contentItemId) {
        const uuid = toDeterministicUuid(contentItemId);
        const idStr = String(uuid);
        const rawId = String(contentItemId);

        this.addDeletedItem(rawId, uuid);
        const localList = this.getLocalWatchlist().filter(w => String(w.content_item_id) !== idStr && String(w.content_item_id) !== rawId);
        this.saveLocalWatchlist(localList);

        if (userId && userId !== 'guest' && supabaseClient) {
            this.getCurrentUser().then(user => {
                this.scheduleCloudPush(userId, user?.email);
                this.broadcastSyncEvent({
                    event: 'item-deleted',
                    id: rawId,
                    uuid: uuid,
                    userId: userId
                });
            }).catch(() => {});

            if (!isCloudOffline()) {
                Promise.resolve(
                    supabaseClient
                        .from('user_watchlist')
                        .delete()
                        .eq('user_id', userId)
                        .eq('content_item_id', uuid)
                ).catch(() => {});
            }
        }
        return { error: null };
    },

    // Admin & Content Tools
    async insertContentItem(itemData) {
        const uuid = toDeterministicUuid(itemData.id);
        const rawId = String(itemData.id);

        // Remove from tombstone and not-interested ledgers since user is actively adding this show
        this.removeDeletedItem(rawId);
        this.removeDeletedItem(uuid);
        this.removeNotInterestedItem(itemData);
        this.removeNotInterestedItem(rawId);
        this.removeNotInterestedItem(uuid);
        if (itemData.tmdb_id) {
            this.removeDeletedItem(String(itemData.tmdb_id));
            this.removeNotInterestedItem(String(itemData.tmdb_id));
        }

        const itemToSave = {
            ...itemData,
            id: uuid,
            tmdb_id: itemData.tmdb_id || itemData.id
        };

        // Save to local library immediately
        const localLib = this.getLocalLibrary();
        const idStr = String(uuid);
        const existingIdx = localLib.findIndex(item => String(item.id) === idStr || String(item.id) === rawId || String(item.tmdb_id || '') === rawId);
        if (existingIdx >= 0) {
            localLib[existingIdx] = itemToSave;
        } else {
            localLib.push(itemToSave);
        }
        this.saveLocalLibrary(localLib);

        // Non-blocking cloud store push & relational table sync for authenticated users
        if (supabaseClient) {
            this.getCurrentUser().then(user => {
                if (user) {
                    this.scheduleCloudPush(user.id, user.email);
                    this.broadcastSyncEvent({
                        event: 'item-added',
                        item: itemToSave,
                        userId: user.id
                    });

                    if (!isCloudOffline()) {
                        const supabasePayload = {
                            id: uuid,
                            title: itemToSave.title,
                            type: itemToSave.type || 'series_season',
                            release_year: itemToSave.release_year ? parseInt(itemToSave.release_year) : null,
                            poster_url: itemToSave.poster_url || null,
                            streaming_service_id: null,
                            franchise_id: null
                        };
                        Promise.resolve(
                            supabaseClient
                                .from('content_items')
                                .upsert(supabasePayload, { onConflict: 'id' })
                        ).then(({ error }) => {
                            if (error) console.warn("Supabase insert warning, preserved in local storage:", error);
                        }).catch(e => console.warn("Database insert error, preserved in local storage:", e));
                    }
                }
            }).catch(() => {});
        }

        return { data: [itemToSave], error: null };
    },

    async pushLocalToCloud(userId, email = null) {
        if (!userId || !supabaseClient || isCloudOffline()) return false;
        _cloudDataCache = null;
        _cloudDataCacheTs = 0;

        try {
            if (!email) {
                try {
                    const u = await this.getCurrentUser();
                    if (u?.email) email = u.email;
                } catch(e) {}
            }

            const nowIso = new Date().toISOString();
            const localLib = this.getLocalLibrary();
            const localWatch = this.getLocalWatchlist();
            const deletedRecords = this.getLocalDeletedItems();
            const notInterestedRecords = this.getLocalNotInterestedItems();
            let localTaste = null;
            try { localTaste = JSON.parse(localStorage.getItem('tv_taste_quiz_answers') || 'null'); } catch(e) {}

            const jsonLib = JSON.stringify(localLib);
            const jsonWatch = JSON.stringify(localWatch);
            const jsonDel = JSON.stringify(deletedRecords);
            const jsonNotInterested = JSON.stringify(notInterestedRecords);
            const jsonTaste = localTaste ? JSON.stringify(localTaste) : null;

            // 1. Batched persistence into PostgreSQL system_settings (userId + emailKey in 1 request)
            const settingsBatch = [
                { id: `user_library_${userId}`, value: jsonLib, updated_at: nowIso },
                { id: `user_watchlist_${userId}`, value: jsonWatch, updated_at: nowIso },
                { id: `user_deleted_${userId}`, value: jsonDel, updated_at: nowIso },
                { id: `user_not_interested_${userId}`, value: jsonNotInterested, updated_at: nowIso }
            ];
            if (jsonTaste) {
                settingsBatch.push({ id: `user_taste_${userId}`, value: jsonTaste, updated_at: nowIso });
            }

            if (email) {
                const emailKey = toDeterministicUuid('email:' + String(email).toLowerCase().trim());
                settingsBatch.push(
                    { id: `user_library_${emailKey}`, value: jsonLib, updated_at: nowIso },
                    { id: `user_watchlist_${emailKey}`, value: jsonWatch, updated_at: nowIso },
                    { id: `user_deleted_${emailKey}`, value: jsonDel, updated_at: nowIso },
                    { id: `user_not_interested_${emailKey}`, value: jsonNotInterested, updated_at: nowIso }
                );
                if (jsonTaste) {
                    settingsBatch.push({ id: `user_taste_${emailKey}`, value: jsonTaste, updated_at: nowIso });
                }
            }

            await supabaseClient.from('system_settings').upsert(settingsBatch, { onConflict: 'id' });

            // 2. Batched relational table sync (replaces per-item sequential loops)
            try {
                if (localLib.length > 0) {
                    const contentRows = localLib.map(item => ({
                        id: toDeterministicUuid(item.id),
                        title: item.title,
                        type: item.type || 'series_season',
                        release_year: item.release_year ? parseInt(item.release_year) : null,
                        poster_url: item.poster_url || null,
                        streaming_service_id: null,
                        franchise_id: null
                    }));
                    await supabaseClient.from('content_items').upsert(contentRows, { onConflict: 'id' });
                }
                if (localWatch.length > 0) {
                    const watchRows = localWatch.map(w => ({
                        user_id: userId,
                        content_item_id: toDeterministicUuid(w.content_item_id),
                        status: w.status,
                        rating: w.rating,
                        updated_at: w.updated_at || nowIso
                    }));
                    await supabaseClient.from('user_watchlist').upsert(watchRows, { onConflict: 'user_id,content_item_id' });
                }
            } catch (tblErr) {}

            return true;
        } catch (e) {
            console.warn("pushLocalToCloud error:", e);
            return false;
        }
    },

    // Strict Read-Only Fetching by default: Fetching must NEVER push to cloud as a side-effect
    async syncCloudUserData(userId, email = null, allowPush = false) {
        if (!userId || !supabaseClient || isCloudOffline()) return null;
        try {
            if (!email) {
                try {
                    const u = await this.getCurrentUser();
                    if (u?.email) email = u.email;
                } catch(e) {}
            }

            // 1. Fetch user data from PostgreSQL system_settings
            const cloudData = await this.fetchUserCloudData(userId, email);
            const { library: cloudLib, watchlist: cloudWatch, taste: cloudTaste, deleted: cloudDel, notInterested: cloudNotInterested, hasCloudRecord } = cloudData;

            // 2. Merge cloud deleted tombstones and dismissed recommendations into local ledgers
            if (Array.isArray(cloudDel) && cloudDel.length > 0) {
                cloudDel.forEach(d => {
                    if (d) this.addDeletedItem(d.id, d.uuid, d.tmdb_id, d.title);
                });
            }
            if (Array.isArray(cloudNotInterested) && cloudNotInterested.length > 0) {
                cloudNotInterested.forEach(d => {
                    if (d) this.addNotInterestedItem(d.id, d.uuid, d.tmdb_id, d.title, false);
                });
            }

            // 3. Fetch local storage items (which automatically filters tombstones)
            const localLib = this.getLocalLibrary();
            const localWatch = this.getLocalWatchlist();
            let localTaste = null;
            try { localTaste = JSON.parse(localStorage.getItem('tv_taste_quiz_answers') || 'null'); } catch(e) {}

            // 4. Non-destructively merge
            let mergedLib = [];
            let mergedWatch = [];

            if (hasCloudRecord && cloudLib.length === 0) {
                // Cloud explicitly holds an empty library (e.g. user cleared library on another device)
                // Tombstone and clear any stale local items that this device was holding from prior sessions
                if (localLib.length > 0) {
                    localLib.forEach(item => {
                        this.addDeletedItem(item.id, item.uuid, item.tmdb_id, item.title);
                    });
                }
                mergedLib = [];
                mergedWatch = [];
            } else {
                mergedLib = this.mergeLibrarySafely(localLib, cloudLib);
                mergedWatch = this.mergeWatchlistSafely(localWatch, cloudWatch);
            }

            const mergedTaste = localTaste || cloudTaste;

            // 5. Save merged state to localStorage
            this.saveLocalLibrary(mergedLib);
            this.saveLocalWatchlist(mergedWatch);
            if (mergedTaste) {
                try { localStorage.setItem('tv_taste_quiz_answers', JSON.stringify(mergedTaste)); } catch(e) {}
            }

            // 6. Push Guard: Data fetching must be 100% READ-ONLY!
            // NEVER push to cloud on background sync/page-load unless allowPush is true.
            if (allowPush) {
                await this.pushLocalToCloud(userId, email);
            }

            return { library: mergedLib, watchlist: mergedWatch, taste: mergedTaste };
        } catch (e) {
            console.warn("syncCloudUserData error:", e);
            return null;
        }
    },

    async syncLocalStorageToCloud(userId) {
        return this.syncCloudUserData(userId, null, true);
    },

    // Real-Time Cross-Device WebSocket Sync Subsystem
    _syncChannel: null,
    initSyncRealtime(onEvent) {
        if (!supabaseClient) return null;
        try {
            if (this._syncChannel) return this._syncChannel;
            this._syncChannel = supabaseClient.channel('seelye-sync-relay');
            this._syncChannel.on('broadcast', { event: 'library-sync' }, ({ payload }) => {
                if (typeof onEvent === 'function') {
                    onEvent(payload);
                }
            });
            this._syncChannel.subscribe();
            return this._syncChannel;
        } catch (e) {
            console.warn("initSyncRealtime error:", e);
            return null;
        }
    },

    broadcastSyncEvent(payload) {
        try {
            if (!supabaseClient) return;
            if (!this._syncChannel) {
                this.initSyncRealtime();
            }
            if (this._syncChannel) {
                this._syncChannel.send({
                    type: 'broadcast',
                    event: 'library-sync',
                    payload: payload
                });
            }
        } catch (e) {
            console.warn("broadcastSyncEvent error:", e);
        }
    },

    async getSystemSetting(key) {
        if (key === 'tmdb_api_key') {
            try {
                const localKey = localStorage.getItem('tmdb_api_key');
                if (localKey) return localKey;
            } catch (e) {}
        }
        if (!supabaseClient || isCloudOffline()) return null;
        try {
            const { data, error } = await supabaseClient
                .from('system_settings')
                .select('value')
                .eq('id', key)
                .single();
            if (error && error.code !== 'PGRST116') {
                console.error("Error fetching setting:", error);
            }
            const val = data?.value || null;
            if (key === 'tmdb_api_key' && val) {
                try { localStorage.setItem('tmdb_api_key', val); } catch (e) {}
            }
            return val;
        } catch(e) { return null; }
    },

    async setSystemSetting(key, value) {
        if (key === 'tmdb_api_key' && value) {
            try { localStorage.setItem('tmdb_api_key', value); } catch (e) {}
        }
        if (!supabaseClient || isCloudOffline()) return { error: new Error('Supabase client not initialized or offline') };
        
        const { data, error } = await supabaseClient
            .from('system_settings')
            .upsert({ 
                id: key, 
                value: value,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' })
            .select();
            
        if (error) console.error("Error setting system setting:", error);
        return { data, error };
    }
};

window.db = db;
