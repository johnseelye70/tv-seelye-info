// Initialize Supabase using environment variables or placeholders
// In production, these should be securely provided or fetched, but for standard client-side Vercel setups
// with RLS, the public anon key is safe to expose in the bundled/client code.
const SUPABASE_URL = window.ENV_SUPABASE_URL || 'https://nmawldbjspiefwcnykuk.supabase.co';
const SUPABASE_ANON_KEY = window.ENV_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tYXdsZGJqc3BpZWZ3Y255a3VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0Njc5OTUsImV4cCI6MjEwMjA0Mzk5NX0.m67NQPyXjtbaoeXSUiUUUm8lbEJgO3NXJIlMeJTVnNU';

let supabaseClient;
try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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

    // LocalStorage Helpers with Dual-Key Safety & Multi-Device Protection
    getLocalLibrary() {
        try {
            const raw1 = localStorage.getItem('tv_hub_custom_library');
            const raw2 = localStorage.getItem('tv_hub_library');
            const arr1 = raw1 ? JSON.parse(raw1) : [];
            const arr2 = raw2 ? JSON.parse(raw2) : [];
            const list1 = Array.isArray(arr1) ? arr1 : [];
            const list2 = Array.isArray(arr2) ? arr2 : [];
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
            const valid = Array.isArray(items) ? items : [];
            const str = JSON.stringify(valid);
            localStorage.setItem('tv_hub_custom_library', str);
            localStorage.setItem('tv_hub_library', str);
        } catch (e) {}
    },

    getLocalWatchlist() {
        try {
            const raw = localStorage.getItem('tv_hub_watchlist');
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) { return []; }
    },

    saveLocalWatchlist(items) {
        try {
            const valid = Array.isArray(items) ? items : [];
            localStorage.setItem('tv_hub_watchlist', JSON.stringify(valid));
        } catch (e) {}
    },

    // Non-destructive merging helpers
    mergeLibrarySafely(localList, cloudList) {
        const local = Array.isArray(localList) ? localList : [];
        const cloud = Array.isArray(cloudList) ? cloudList : [];
        
        // Push guard: uninitialized/fresh device loading empty array never wipes cloud library
        if (local.length === 0 && cloud.length > 0) return [...cloud];
        // Cloud empty: initial push from device with library
        if (cloud.length === 0 && local.length > 0) return [...local];
        if (local.length === 0 && cloud.length === 0) return [];

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

        return Array.from(mergedMap.values());
    },

    mergeWatchlistSafely(localList, cloudList) {
        const local = Array.isArray(localList) ? localList : [];
        const cloud = Array.isArray(cloudList) ? cloudList : [];
        if (local.length === 0 && cloud.length > 0) return [...cloud];
        if (cloud.length === 0 && local.length > 0) return [...local];
        if (local.length === 0 && cloud.length === 0) return [];

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
                map.set(key, tLocal >= tCloud ? { ...existing, ...w } : { ...w, ...existing });
            } else {
                map.set(key, w);
            }
        });
        return Array.from(map.values());
    },

    async fetchUserCloudData(userId, email = null) {
        if (!userId && !email) return { library: [], watchlist: [], taste: null };

        let cloudLib = [];
        let cloudWatch = [];
        let cloudTaste = null;

        // 1. Query PostgreSQL system_settings by userId
        if (userId && supabaseClient) {
            try {
                const libVal = await this.getSystemSetting(`user_library_${userId}`);
                if (libVal) {
                    const parsed = JSON.parse(libVal);
                    if (Array.isArray(parsed) && parsed.length > 0) cloudLib = parsed;
                }
                const watchVal = await this.getSystemSetting(`user_watchlist_${userId}`);
                if (watchVal) {
                    const parsed = JSON.parse(watchVal);
                    if (Array.isArray(parsed) && parsed.length > 0) cloudWatch = parsed;
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
        if (email && cloudLib.length === 0 && supabaseClient) {
            try {
                const emailKey = toDeterministicUuid('email:' + String(email).toLowerCase().trim());
                const libVal = await this.getSystemSetting(`user_library_${emailKey}`);
                if (libVal) {
                    const parsed = JSON.parse(libVal);
                    if (Array.isArray(parsed) && parsed.length > 0) cloudLib = parsed;
                }
                if (cloudWatch.length === 0) {
                    const watchVal = await this.getSystemSetting(`user_watchlist_${emailKey}`);
                    if (watchVal) {
                        const parsed = JSON.parse(watchVal);
                        if (Array.isArray(parsed) && parsed.length > 0) cloudWatch = parsed;
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

        // 3. Fallback to Supabase Auth user_metadata
        if (cloudLib.length === 0 || cloudWatch.length === 0) {
            try {
                const user = await this.getCurrentUser();
                if (user?.user_metadata) {
                    if (cloudLib.length === 0 && Array.isArray(user.user_metadata.tv_library) && user.user_metadata.tv_library.length > 0) {
                        cloudLib = user.user_metadata.tv_library;
                    }
                    if (cloudWatch.length === 0 && Array.isArray(user.user_metadata.tv_watchlist) && user.user_metadata.tv_watchlist.length > 0) {
                        cloudWatch = user.user_metadata.tv_watchlist;
                    }
                    if (!cloudTaste && user.user_metadata.tv_taste_quiz) {
                        cloudTaste = user.user_metadata.tv_taste_quiz;
                    }
                }
            } catch (e) {}
        }

        return { library: cloudLib, watchlist: cloudWatch, taste: cloudTaste };
    },

    async getContentItems() {
        let remoteItems = [];
        let cloudUserItems = [];

        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient
                    .from('content_items')
                    .select(`
                        *,
                        streaming_services ( name, icon_url ),
                        franchises ( name )
                    `)
                    .order('title', { ascending: true });
                
                if (data && !error) remoteItems = data;
            } catch(e) {}

            try {
                const user = await this.getCurrentUser();
                if (user) {
                    const cloudData = await this.fetchUserCloudData(user.id, user.email);
                    if (cloudData.library && cloudData.library.length > 0) {
                        cloudUserItems = cloudData.library;
                    }
                }
            } catch(e) {}
        }

        const localItems = this.getLocalLibrary();
        let merged = this.mergeLibrarySafely(localItems, cloudUserItems);
        merged = this.mergeLibrarySafely(merged, remoteItems);

        // Keep local storage fresh with resolved library
        if (merged.length > 0) {
            this.saveLocalLibrary(merged);
        }

        return merged;
    },

    async getUserWatchlist(userId) {
        let remoteList = [];
        let cloudUserWatch = [];

        if (userId && supabaseClient) {
            try {
                const { data, error } = await supabaseClient
                    .from('user_watchlist')
                    .select('*')
                    .eq('user_id', userId);
                
                if (data && !error) remoteList = data;
            } catch(e) {}

            try {
                const user = await this.getCurrentUser();
                const cloudData = await this.fetchUserCloudData(userId, user?.email);
                if (cloudData.watchlist && cloudData.watchlist.length > 0) {
                    cloudUserWatch = cloudData.watchlist;
                }
            } catch(e) {}
        }

        const localList = this.getLocalWatchlist();
        let merged = this.mergeWatchlistSafely(localList, cloudUserWatch);
        merged = this.mergeWatchlistSafely(merged, remoteList);

        if (merged.length > 0) {
            this.saveLocalWatchlist(merged);
        }

        return merged;
    },

    // Updates
    async upsertWatchlistItem(userId, contentItemId, status, rating = null) {
        const uuid = toDeterministicUuid(contentItemId);
        // Always persist to local storage for immediate responsiveness & guest support
        const localList = this.getLocalWatchlist();
        const existingIdx = localList.findIndex(w => String(w.content_item_id) === String(uuid) || String(w.content_item_id) === String(contentItemId));
        const updatedEntry = {
            user_id: userId || 'guest',
            content_item_id: String(uuid),
            status: status,
            rating: rating,
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

    // Delete / Remove Item from Library & Watchlist
    async deleteContentItem(contentItemId) {
        const uuid = toDeterministicUuid(contentItemId);
        const idStr = String(uuid);
        const rawId = String(contentItemId);
        
        // Remove from local library
        const localLib = this.getLocalLibrary().filter(item => String(item.id) !== idStr && String(item.id) !== rawId && String(item.tmdb_id || '') !== rawId);
        this.saveLocalLibrary(localLib);

        // Remove from local watchlist
        const localWatchlist = this.getLocalWatchlist().filter(w => String(w.content_item_id) !== idStr && String(w.content_item_id) !== rawId);
        this.saveLocalWatchlist(localWatchlist);

        // Sync cloud PostgreSQL store if authenticated
        try {
            const user = await this.getCurrentUser();
            if (user) {
                await this.pushLocalToCloud(user.id, user.email);
            }
        } catch (e) {}

        let error = null;
        if (supabaseClient) {
            try {
                // Delete from user_watchlist first (foreign key reference)
                await supabaseClient.from('user_watchlist').delete().eq('content_item_id', uuid);
                // Delete from content_items
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
        const localList = this.getLocalWatchlist().filter(w => String(w.content_item_id) !== idStr && String(w.content_item_id) !== rawId);
        this.saveLocalWatchlist(localList);

        if (userId && userId !== 'guest') {
            try {
                const user = await this.getCurrentUser();
                await this.pushLocalToCloud(userId, user?.email);
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
        const itemToSave = {
            ...itemData,
            id: uuid,
            tmdb_id: itemData.tmdb_id || itemData.id
        };

        // Save to local library immediately
        const localLib = this.getLocalLibrary();
        const idStr = String(uuid);
        const existingIdx = localLib.findIndex(item => String(item.id) === idStr || String(item.id) === String(itemData.id) || String(item.tmdb_id || '') === String(itemData.id));
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
            }
        } catch (e) {}

        if (!supabaseClient) {
            return { data: [itemToSave], error: null };
        }
        
        try {
            const user = await this.getCurrentUser();
            if (!user) {
                // For guest users, save to local library without failing on Supabase RLS
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
            let localTaste = null;
            try { localTaste = JSON.parse(localStorage.getItem('tv_taste_quiz_answers') || 'null'); } catch(e) {}

            const jsonLib = JSON.stringify(localLib);
            const jsonWatch = JSON.stringify(localWatch);
            const jsonTaste = localTaste ? JSON.stringify(localTaste) : null;

            // 1. Primary persistence: PostgreSQL system_settings record by userId
            await this.setSystemSetting(`user_library_${userId}`, jsonLib);
            await this.setSystemSetting(`user_watchlist_${userId}`, jsonWatch);
            if (jsonTaste) {
                await this.setSystemSetting(`user_taste_${userId}`, jsonTaste);
            }

            // 2. Secondary persistence: PostgreSQL system_settings record by deterministic email hash
            if (email) {
                const emailKey = toDeterministicUuid('email:' + String(email).toLowerCase().trim());
                await this.setSystemSetting(`user_library_${emailKey}`, jsonLib);
                await this.setSystemSetting(`user_watchlist_${emailKey}`, jsonWatch);
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

    async syncCloudUserData(userId, email = null) {
        if (!userId || !supabaseClient) return null;
        try {
            if (!email) {
                try {
                    const u = await this.getCurrentUser();
                    if (u?.email) email = u.email;
                } catch(e) {}
            }

            // 1. Fetch user data from PostgreSQL system_settings and user_metadata
            const { library: cloudLib, watchlist: cloudWatch, taste: cloudTaste } = await this.fetchUserCloudData(userId, email);

            // 2. Fetch local storage items
            const localLib = this.getLocalLibrary();
            const localWatch = this.getLocalWatchlist();
            let localTaste = null;
            try { localTaste = JSON.parse(localStorage.getItem('tv_taste_quiz_answers') || 'null'); } catch(e) {}

            // 3. Non-destructively merge (Push Guard: empty fresh device never wipes cloud)
            const mergedLib = this.mergeLibrarySafely(localLib, cloudLib);
            const mergedWatch = this.mergeWatchlistSafely(localWatch, cloudWatch);
            const mergedTaste = localTaste || cloudTaste;

            // 4. Save merged state to localStorage
            this.saveLocalLibrary(mergedLib);
            this.saveLocalWatchlist(mergedWatch);
            if (mergedTaste) {
                try { localStorage.setItem('tv_taste_quiz_answers', JSON.stringify(mergedTaste)); } catch(e) {}
            }

            // 5. Push merged state back to cloud store if any records exist
            if (mergedLib.length > 0 || mergedWatch.length > 0) {
                await this.pushLocalToCloud(userId, email);
            }

            return { library: mergedLib, watchlist: mergedWatch, taste: mergedTaste };
        } catch (e) {
            console.warn("syncCloudUserData error:", e);
            return null;
        }
    },

    async syncLocalStorageToCloud(userId) {
        return this.syncCloudUserData(userId);
    },

    async getSystemSetting(key) {
        if (!supabaseClient) return null;
        try {
            const { data, error } = await supabaseClient
                .from('system_settings')
                .select('value')
                .eq('id', key)
                .single();
            if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned", which is fine for a missing setting
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
