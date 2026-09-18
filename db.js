// Initialize Supabase using environment variables or placeholders
// In production, these should be securely provided or fetched, but for standard client-side Vercel setups
// with RLS, the public anon key is safe to expose in the bundled/client code.
const SUPABASE_URL = window.ENV_SUPABASE_URL || 'https://nmawldbjspiefwcnykuk.supabase.co';
const SUPABASE_ANON_KEY = window.ENV_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tYXdsZGJqc3BpZWZ3Y255a3VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0Njc5OTUsImV4cCI6MjEwMjA0Mzk5NX0.m67NQPyXjtbaoeXSUiUUUm8lbEJgO3NXJIlMeJTVnNU';

let supabaseClient;
try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
    // Auth logic
    async login(email, password) {
        if (!supabaseClient) return { error: new Error('Database not connected. Please check your internet or ad-blocker.') };
        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            return { data, error };
        } catch (e) {
            return { error: e };
        }
    },

    async signup(email, password) {
        if (!supabaseClient) return { error: new Error('Database not connected. Please check your internet or ad-blocker.') };
        try {
            const { data, error } = await supabaseClient.auth.signUp({ email, password });
            return { data, error };
        } catch (e) {
            return { error: e };
        }
    },

    async logout() {
        const { error } = await supabaseClient.auth.signOut();
        return { error };
    },

    async getCurrentUser() {
        if (!supabaseClient) return null;
        try {
            const { data, error } = await supabaseClient.auth.getUser();
            if (error) console.warn("Auth check:", error.message);
            return data?.user || null;
        } catch (e) {
            console.error("Error fetching user:", e);
            return null;
        }
    },

    onAuthStateChange(callback) {
        if (!supabaseClient) return;
        supabaseClient.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    },

    // Data Fetching Logic
    async getStreamingServices() {
        if (!supabaseClient) return [];
        try {
            const { data, error } = await supabaseClient.from('streaming_services').select('*');
            if (error) console.error("Error fetching streaming services:", error);
            return data || [];
        } catch(e) { return []; }
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

    async fetchUserCloudData(userId, email = null) {
        if (!userId && !email) return { library: [], watchlist: [], taste: null, deleted: [], hasCloudRecord: false };

        let cloudLib = null;
        let cloudWatch = null;
        let cloudTaste = null;
        let cloudDeleted = [];
        let cloudLibFound = false;
        let cloudWatchFound = false;

        // 1. Query PostgreSQL system_settings by userId
        if (userId && supabaseClient) {
            try {
                const delVal = await this.getSystemSetting(`user_deleted_${userId}`);
                if (delVal) {
                    const parsed = JSON.parse(delVal);
                    if (Array.isArray(parsed)) cloudDeleted = parsed;
                }

                const libVal = await this.getSystemSetting(`user_library_${userId}`);
                if (libVal !== null && libVal !== undefined) {
                    const parsed = JSON.parse(libVal);
                    if (Array.isArray(parsed)) {
                        cloudLib = parsed;
                        cloudLibFound = true;
                    }
                }

                const watchVal = await this.getSystemSetting(`user_watchlist_${userId}`);
                if (watchVal !== null && watchVal !== undefined) {
                    const parsed = JSON.parse(watchVal);
                    if (Array.isArray(parsed)) {
                        cloudWatch = parsed;
                        cloudWatchFound = true;
                    }
                }

                const tasteVal = await this.getSystemSetting(`user_taste_${userId}`);
                if (tasteVal) {
                    const parsed = JSON.parse(tasteVal);
                    if (parsed) cloudTaste = parsed;
                }
            } catch (e) {
                console.warn("fetchUserCloudData settings by userId error:", e);
            }
        }

        // 2. Query PostgreSQL system_settings by deterministic email hash if not found
        if (email && !cloudLibFound && supabaseClient) {
            try {
                const emailKey = toDeterministicUuid('email:' + String(email).toLowerCase().trim());
                if (cloudDeleted.length === 0) {
                    const delVal = await this.getSystemSetting(`user_deleted_${emailKey}`);
                    if (delVal) {
                        const parsed = JSON.parse(delVal);
                        if (Array.isArray(parsed)) cloudDeleted = parsed;
                    }
                }
                const libVal = await this.getSystemSetting(`user_library_${emailKey}`);
                if (libVal !== null && libVal !== undefined) {
                    const parsed = JSON.parse(libVal);
                    if (Array.isArray(parsed)) {
                        cloudLib = parsed;
                        cloudLibFound = true;
                    }
                }
                if (!cloudWatchFound) {
                    const watchVal = await this.getSystemSetting(`user_watchlist_${emailKey}`);
                    if (watchVal !== null && watchVal !== undefined) {
                        const parsed = JSON.parse(watchVal);
                        if (Array.isArray(parsed)) {
                            cloudWatch = parsed;
                            cloudWatchFound = true;
                        }
                    }
                }
                if (!cloudTaste) {
                    const tasteVal = await this.getSystemSetting(`user_taste_${emailKey}`);
                    if (tasteVal) cloudTaste = JSON.parse(tasteVal);
                }
            } catch (e) {
                console.warn("fetchUserCloudData settings by email error:", e);
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

        return { 
            library: cloudLib || [], 
            watchlist: cloudWatch || [], 
            taste: cloudTaste, 
            deleted: cloudDeleted,
            hasCloudRecord: cloudLibFound 
        };
    },

    async getContentItems() {
        let remoteItems = [];
        let cloudUserItems = [];
        const deletedSet = this.getLocalDeletedIds();

        if (supabaseClient) {
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

        if (userId && supabaseClient) {
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

        const localList = this.getLocalWatchlist();
        let merged = this.mergeWatchlistSafely(localList, cloudUserWatch);
        merged = this.mergeWatchlistSafely(merged, remoteList);

        this.saveLocalWatchlist(merged);
        return merged;
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

        if (userId && userId !== 'guest') {
            try {
                const user = await this.getCurrentUser();
                await this.pushLocalToCloud(userId, user?.email);
                this.broadcastSyncEvent({
                    event: 'watch-updated',
                    contentItemId: rawId,
                    uuid: uuid,
                    userId: userId
                });
            } catch(e) {}
        }

        if (!userId || !supabaseClient) {
            return { data: [updatedEntry], error: null };
        }
        
        try {
            const { data, error } = await supabaseClient
                .from('user_watchlist')
                .upsert({ 
                    user_id: userId, 
                    content_item_id: uuid, 
                    status: status,
                    rating: rating,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id,content_item_id' })
                .select();
                
            if (error) console.warn("Supabase upsert watchlist warning:", error);
            return { data: data || [updatedEntry], error: null };
        } catch (e) {
            console.warn("Database watchlist exception:", e);
            return { data: [updatedEntry], error: null };
        }
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

        // 5. Sync cloud PostgreSQL store if authenticated
        let currentUserId = null;
        try {
            const user = await this.getCurrentUser();
            if (user) {
                currentUserId = user.id;
                await this.pushLocalToCloud(user.id, user.email);
                this.broadcastSyncEvent({
                    event: 'item-deleted',
                    id: rawId,
                    uuid: uuid,
                    tmdb_id: tmdbId,
                    title: title,
                    userId: user.id
                });
            }
        } catch (e) {}

        let error = null;
        if (supabaseClient) {
            try {
                await supabaseClient.from('user_watchlist').delete().eq('content_item_id', uuid);
                const res = await supabaseClient.from('content_items').delete().eq('id', uuid);
                error = res.error;
            } catch (e) {
                error = e;
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

        if (userId && userId !== 'guest') {
            try {
                const user = await this.getCurrentUser();
                await this.pushLocalToCloud(userId, user?.email);
                this.broadcastSyncEvent({
                    event: 'item-deleted',
                    id: rawId,
                    uuid: uuid,
                    userId: userId
                });
            } catch(e) {}
        }

        if (userId && supabaseClient) {
            try {
                const { error } = await supabaseClient
                    .from('user_watchlist')
                    .delete()
                    .eq('user_id', userId)
                    .eq('content_item_id', uuid);
                return { error };
            } catch (e) {
                return { error: e };
            }
        }
        return { error: null };
    },

    // Admin & Content Tools
    async insertContentItem(itemData) {
        const uuid = toDeterministicUuid(itemData.id);
        const rawId = String(itemData.id);

        // Remove from tombstone ledger since user is actively re-adding or adding this show
        this.removeDeletedItem(rawId);
        this.removeDeletedItem(uuid);
        if (itemData.tmdb_id) this.removeDeletedItem(String(itemData.tmdb_id));

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

        // Immediate cloud store push for authenticated users
        try {
            const user = await this.getCurrentUser();
            if (user) {
                await this.pushLocalToCloud(user.id, user.email);
                this.broadcastSyncEvent({
                    event: 'item-added',
                    item: itemToSave,
                    userId: user.id
                });
            }
        } catch (e) {}

        if (!supabaseClient) {
            return { data: [itemToSave], error: null };
        }
        
        try {
            const user = await this.getCurrentUser();
            if (!user) {
                return { data: [itemToSave], error: null };
            }

            const supabasePayload = {
                id: uuid,
                title: itemToSave.title,
                type: itemToSave.type || 'series_season',
                release_year: itemToSave.release_year ? parseInt(itemToSave.release_year) : null,
                poster_url: itemToSave.poster_url || null,
                streaming_service_id: null,
                franchise_id: null
            };

            const { data, error } = await supabaseClient
                .from('content_items')
                .upsert(supabasePayload, { onConflict: 'id' })
                .select();
                
            if (error) {
                console.warn("Supabase insert warning, preserved in local storage:", error);
                return { data: [itemToSave], error: null };
            }
            return { data: data || [itemToSave], error: null };
        } catch (e) {
            console.warn("Database insert error, preserved in local storage:", e);
            return { data: [itemToSave], error: null };
        }
    },

    async pushLocalToCloud(userId, email = null) {
        if (!userId || !supabaseClient) return false;
        try {
            if (!email) {
                try {
                    const u = await this.getCurrentUser();
                    if (u?.email) email = u.email;
                } catch(e) {}
            }

            const localLib = this.getLocalLibrary();
            const localWatch = this.getLocalWatchlist();
            const deletedRecords = this.getLocalDeletedItems();
            let localTaste = null;
            try { localTaste = JSON.parse(localStorage.getItem('tv_taste_quiz_answers') || 'null'); } catch(e) {}

            const jsonLib = JSON.stringify(localLib);
            const jsonWatch = JSON.stringify(localWatch);
            const jsonDel = JSON.stringify(deletedRecords);
            const jsonTaste = localTaste ? JSON.stringify(localTaste) : null;

            // 1. Primary persistence: PostgreSQL system_settings record by userId
            await this.setSystemSetting(`user_library_${userId}`, jsonLib);
            await this.setSystemSetting(`user_watchlist_${userId}`, jsonWatch);
            await this.setSystemSetting(`user_deleted_${userId}`, jsonDel);
            if (jsonTaste) {
                await this.setSystemSetting(`user_taste_${userId}`, jsonTaste);
            }

            // 2. Secondary persistence: PostgreSQL system_settings record by deterministic email hash
            if (email) {
                const emailKey = toDeterministicUuid('email:' + String(email).toLowerCase().trim());
                await this.setSystemSetting(`user_library_${emailKey}`, jsonLib);
                await this.setSystemSetting(`user_watchlist_${emailKey}`, jsonWatch);
                await this.setSystemSetting(`user_deleted_${emailKey}`, jsonDel);
                if (jsonTaste) {
                    await this.setSystemSetting(`user_taste_${emailKey}`, jsonTaste);
                }
            }

            // 3. Backup update to Supabase Auth user_metadata
            try {
                await supabaseClient.auth.updateUser({
                    data: {
                        tv_library: localLib,
                        tv_watchlist: localWatch,
                        tv_deleted: deletedRecords.slice(-100),
                        tv_taste_quiz: localTaste,
                        last_synced_at: new Date().toISOString()
                    }
                });
            } catch (authErr) {
                // Secondary auth metadata non-blocking
            }

            // 4. Background attempt to populate relational tables
            try {
                for (const item of localLib) {
                    const uuid = toDeterministicUuid(item.id);
                    await supabaseClient.from('content_items').upsert({
                        id: uuid,
                        title: item.title,
                        type: item.type || 'series_season',
                        release_year: item.release_year ? parseInt(item.release_year) : null,
                        poster_url: item.poster_url || null,
                        streaming_service_id: null,
                        franchise_id: null
                    }, { onConflict: 'id' });
                }
                for (const w of localWatch) {
                    const uuid = toDeterministicUuid(w.content_item_id);
                    await supabaseClient.from('user_watchlist').upsert({
                        user_id: userId,
                        content_item_id: uuid,
                        status: w.status,
                        rating: w.rating,
                        updated_at: w.updated_at || new Date().toISOString()
                    }, { onConflict: 'user_id,content_item_id' });
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
        if (!userId || !supabaseClient) return null;
        try {
            if (!email) {
                try {
                    const u = await this.getCurrentUser();
                    if (u?.email) email = u.email;
                } catch(e) {}
            }

            // 1. Fetch user data from PostgreSQL system_settings
            const cloudData = await this.fetchUserCloudData(userId, email);
            const { library: cloudLib, watchlist: cloudWatch, taste: cloudTaste, deleted: cloudDel, hasCloudRecord } = cloudData;

            // 2. Merge cloud deleted tombstones into local tombstone ledger
            if (Array.isArray(cloudDel) && cloudDel.length > 0) {
                cloudDel.forEach(d => {
                    if (d) this.addDeletedItem(d.id, d.uuid, d.tmdb_id, d.title);
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
        if (!supabaseClient) return null;
        try {
            const { data, error } = await supabaseClient
                .from('system_settings')
                .select('value')
                .eq('id', key)
                .single();
            if (error && error.code !== 'PGRST116') {
                console.error("Error fetching setting:", error);
            }
            return data?.value || null;
        } catch(e) { return null; }
    },

    async setSystemSetting(key, value) {
        if (!supabaseClient) return { error: new Error('Supabase client not initialized') };
        
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
