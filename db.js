// Initialize Supabase using environment variables or placeholders
// In production, these should be securely provided or fetched, but for standard client-side Vercel setups
// with RLS, the public anon key is safe to expose in the bundled/client code.
const SUPABASE_URL = window.ENV_SUPABASE_URL || 'https://nmawldbjspiefwcnykuk.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = window.ENV_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tYXdsZGJqc3BpZWZ3Y255a3VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0Njc5OTUsImV4cCI6MjEwMjA0Mzk5NX0.m67NQPyXjtbaoeXSUiUUUm8lbEJgO3NXJIlMeJTVnNU';

// Initialize the Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const db = {
    // Auth logic
    async login(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        return { data, error };
    },

    async logout() {
        const { error } = await supabase.auth.signOut();
        return { error };
    },

    async getCurrentUser() {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    },

    onAuthStateChange(callback) {
        supabase.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    },

    // Data Fetching Logic
    async getStreamingServices() {
        const { data, error } = await supabase.from('streaming_services').select('*');
        if (error) console.error("Error fetching streaming services:", error);
        return data || [];
    },

    async getFranchises() {
        const { data, error } = await supabase.from('franchises').select('*');
        if (error) console.error("Error fetching franchises:", error);
        return data || [];
    },

    async getContentItems() {
        const { data, error } = await supabase
            .from('content_items')
            .select(`
                *,
                streaming_services ( name, icon_url ),
                franchises ( name )
            `)
            .order('title', { ascending: true });
        
        if (error) console.error("Error fetching content items:", error);
        return data || [];
    },

    async getUserWatchlist(userId) {
        if (!userId) return [];
        const { data, error } = await supabase
            .from('user_watchlist')
            .select('*')
            .eq('user_id', userId);
        
        if (error) console.error("Error fetching watchlist:", error);
        return data || [];
    },

    // Updates
    async upsertWatchlistItem(userId, contentItemId, status) {
        if (!userId) return { error: new Error('User not logged in') };
        
        const { data, error } = await supabase
            .from('user_watchlist')
            .upsert({ 
                user_id: userId, 
                content_item_id: contentItemId, 
                status: status,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,content_item_id' })
            .select();
            
        if (error) console.error("Error upserting watchlist item:", error);
        return { data, error };
    }
};

window.db = db;
