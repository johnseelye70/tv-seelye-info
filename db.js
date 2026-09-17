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

const db = {
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

    // LocalStorage Fallback Helpers
    getLocalLibrary() {
        try {
            return JSON.parse(localStorage.getItem('tv_hub_custom_library') || '[]');
        } catch (e) { return []; }
    },

    saveLocalLibrary(items) {
        try {
            localStorage.setItem('tv_hub_custom_library', JSON.stringify(items));
        } catch (e) {}
    },

    getLocalWatchlist() {
        try {
            return JSON.parse(localStorage.getItem('tv_hub_watchlist') || '[]');
        } catch (e) { return []; }
    },

    saveLocalWatchlist(items) {
        try {
            localStorage.setItem('tv_hub_watchlist', JSON.stringify(items));
        } catch (e) {}
    },

    async getContentItems() {
        let remoteItems = [];
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
                
                if (error) console.error("Error fetching content items:", error);
                else if (data) remoteItems = data;
            } catch(e) {
                console.warn("Supabase fetch failed, using local storage fallback", e);
            }
        }

        // Merge remote items with local offline library items
        const localItems = this.getLocalLibrary();
        const mergedMap = new Map();
        
        remoteItems.forEach(item => mergedMap.set(String(item.id), item));
        localItems.forEach(item => {
            if (!mergedMap.has(String(item.id))) {
                mergedMap.set(String(item.id), item);
            }
        });

        return Array.from(mergedMap.values());
    },

    async getUserWatchlist(userId) {
        let remoteList = [];
        if (userId && supabaseClient) {
            try {
                const { data, error } = await supabaseClient
                    .from('user_watchlist')
                    .select('*')
                    .eq('user_id', userId);
                
                if (error) console.error("Error fetching watchlist:", error);
                else if (data) remoteList = data;
            } catch(e) {
                console.warn("Watchlist fetch failed, using local fallback", e);
            }
        }

        // Merge with local offline watchlist
        const localList = this.getLocalWatchlist();
        const watchlistMap = new Map();
        remoteList.forEach(w => watchlistMap.set(String(w.content_item_id), w));
        localList.forEach(w => {
            if (!watchlistMap.has(String(w.content_item_id))) {
                watchlistMap.set(String(w.content_item_id), w);
            }
        });

        return Array.from(watchlistMap.values());
    },

    // Updates
    async upsertWatchlistItem(userId, contentItemId, status, rating = null) {
        // Always persist to local storage for immediate responsiveness & guest support
        const localList = this.getLocalWatchlist();
        const existingIdx = localList.findIndex(w => String(w.content_item_id) === String(contentItemId));
        const updatedEntry = {
            user_id: userId || 'guest',
            content_item_id: String(contentItemId),
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

        if (!userId || !supabaseClient) {
            return { data: [updatedEntry], error: null };
        }
        
        try {
            const { data, error } = await supabaseClient
                .from('user_watchlist')
                .upsert({ 
                    user_id: userId, 
                    content_item_id: contentItemId, 
                    status: status,
                    rating: rating,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id,content_item_id' })
                .select();
                
            if (error) console.error("Error upserting watchlist item:", error);
            return { data, error };
        } catch (e) {
            return { data: [updatedEntry], error: e };
        }
    },

    // Delete / Remove Item from Library & Watchlist
    async deleteContentItem(contentItemId) {
        const idStr = String(contentItemId);
        
        // Remove from local library
        const localLib = this.getLocalLibrary().filter(item => String(item.id) !== idStr);
        this.saveLocalLibrary(localLib);

        // Remove from local watchlist
        const localWatchlist = this.getLocalWatchlist().filter(w => String(w.content_item_id) !== idStr);
        this.saveLocalWatchlist(localWatchlist);

        let error = null;
        if (supabaseClient) {
            try {
                // Delete from user_watchlist first (foreign key reference)
                await supabaseClient.from('user_watchlist').delete().eq('content_item_id', contentItemId);
                // Delete from content_items
                const res = await supabaseClient.from('content_items').delete().eq('id', contentItemId);
                error = res.error;
            } catch (e) {
                error = e;
            }
        }
        return { error };
    },

    async deleteWatchlistItem(userId, contentItemId) {
        const idStr = String(contentItemId);
        const localList = this.getLocalWatchlist().filter(w => String(w.content_item_id) !== idStr);
        this.saveLocalWatchlist(localList);

        if (userId && supabaseClient) {
            try {
                const { error } = await supabaseClient
                    .from('user_watchlist')
                    .delete()
                    .eq('user_id', userId)
                    .eq('content_item_id', contentItemId);
                return { error };
            } catch (e) {
                return { error: e };
            }
        }
        return { error: null };
    },

    // Admin & Content Tools
    async insertContentItem(itemData) {
        // Save to local library immediately
        const localLib = this.getLocalLibrary();
        const idStr = String(itemData.id);
        const existingIdx = localLib.findIndex(item => String(item.id) === idStr);
        if (existingIdx >= 0) {
            localLib[existingIdx] = itemData;
        } else {
            localLib.push(itemData);
        }
        this.saveLocalLibrary(localLib);

        if (!supabaseClient) {
            return { data: [itemData], error: null };
        }
        
        try {
            const { data, error } = await supabaseClient
                .from('content_items')
                .upsert(itemData, { onConflict: 'id' })
                .select();
                
            if (error) console.error("Error inserting content item into Supabase:", error);
            return { data: data || [itemData], error };
        } catch (e) {
            return { data: [itemData], error: e };
        }
    },

    async syncLocalStorageToCloud(userId) {
        if (!userId || !supabaseClient) return;
        try {
            const localLib = this.getLocalLibrary();
            for (const item of localLib) {
                await supabaseClient.from('content_items').upsert(item, { onConflict: 'id' });
            }
            const localWatch = this.getLocalWatchlist();
            for (const watch of localWatch) {
                await supabaseClient.from('user_watchlist').upsert({
                    user_id: userId,
                    content_item_id: watch.content_item_id,
                    status: watch.status,
                    rating: watch.rating,
                    updated_at: watch.updated_at || new Date().toISOString()
                }, { onConflict: 'user_id,content_item_id' });
            }
        } catch (e) {
            console.warn("Cloud sync warning:", e);
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
