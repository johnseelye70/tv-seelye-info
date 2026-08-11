document.addEventListener('DOMContentLoaded', () => {
    // State
    let currentUser = null;
    let allContent = [];
    let allServices = [];
    let allFranchises = [];
    let userWatchlist = [];
    let currentFilter = 'all';
    let searchQuery = '';
    let isLoginMode = true;

    // DOM Elements
    const authBtn = document.getElementById('auth-btn');
    const authStatusBadge = document.getElementById('auth-status-badge');
    const loginModal = document.getElementById('login-modal');
    const loginForm = document.getElementById('login-form');
    const closeLoginBtn = document.getElementById('close-login-btn');
    const loginError = document.getElementById('login-error');
    const loginSuccess = document.getElementById('login-success');
    const authModalTitle = document.getElementById('auth-modal-title');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const toggleAuthModeBtn = document.getElementById('toggle-auth-mode');
    const catalogGrid = document.getElementById('catalog-grid');
    const serviceFilters = document.getElementById('service-filters');
    const searchInput = document.getElementById('search-input');
    const nextUpCard = document.getElementById('next-up-card');

    // Admin Elements
    const adminNavBtn = document.getElementById('admin-nav-btn');
    const adminModal = document.getElementById('admin-modal');
    const closeAdminBtn = document.getElementById('close-admin-btn');
    const catalogSection = document.querySelector('.catalog-section');
    const filtersSection = document.querySelector('.filters-section');
    
    const adminSettingsCard = document.getElementById('admin-settings-card');
    const tmdbApiKeyInput = document.getElementById('tmdb-api-key');
    const saveTmdbKeyBtn = document.getElementById('save-tmdb-key-btn');
    const tmdbKeyStatus = document.getElementById('tmdb-key-status');
    const adminSearchCard = document.getElementById('admin-search-card');
    const tmdbSearchQuery = document.getElementById('tmdb-search-query');
    const tmdbSearchBtn = document.getElementById('tmdb-search-btn');
    const tmdbResultsGrid = document.getElementById('tmdb-results-grid');

    // --- Initialization ---
    async function init() {
        // Setup Auth Listener
        window.db.onAuthStateChange(async (event, session) => {
            currentUser = session?.user || null;
            updateAuthUI();
            await loadUserData();
        });

        // Initial Data Load
        currentUser = await window.db.getCurrentUser();
        updateAuthUI();
        
        // Load Global Data
        allServices = await window.db.getStreamingServices();
        allFranchises = await window.db.getFranchises();
        
        // If unauthenticated, we'll load content anyway (since RLS allows read-only for authenticated, 
        // wait, the prompt says RLS is for authenticated, we might need a fallback or ensure they login)
        // For this demo, let's assume they can view the catalog if not logged in, but can't save.
        allContent = await window.db.getContentItems();
        
        if (allContent.length === 0) {
            // Provide some fallback mock data for unauthenticated testing if the DB is empty or inaccessible
            allContent = getMockData();
        }

        await loadUserData(); // Loads watchlist if logged in, renders UI
        
        setupEventListeners();
    }

    async function loadUserData() {
        if (currentUser) {
            userWatchlist = await window.db.getUserWatchlist(currentUser.id);
        } else {
            userWatchlist = [];
        }
        renderCatalog();
        renderNextUp();
    }

    // --- Auth UI ---
    function updateAuthUI() {
        if (currentUser) {
            authStatusBadge.textContent = currentUser.email;
            authBtn.textContent = 'Logout';
            adminNavBtn.classList.remove('hidden');
        } else {
            authStatusBadge.textContent = 'Guest';
            authBtn.textContent = 'Login';
            adminNavBtn.classList.add('hidden');
        }
    }

    // --- Render Logic ---
    function renderCatalog() {
        catalogGrid.innerHTML = '';
        
        // Filter logic
        let filteredContent = allContent.filter(item => {
            // Search filter
            if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) {
                return false;
            }
            // Service filter
            if (currentFilter !== 'all') {
                const serviceName = item.streaming_services?.name?.toLowerCase() || item.mock_service?.toLowerCase();
                if (serviceName !== currentFilter) return false;
            }
            return true;
        });

        if (filteredContent.length === 0) {
            catalogGrid.innerHTML = '<p class="skeleton-loader">No content found matching criteria.</p>';
            return;
        }

        filteredContent.forEach(item => {
            const isCompleted = isItemCompleted(item.id);
            const serviceName = item.streaming_services?.name || item.mock_service || 'Unknown';
            const year = item.release_year || 'N/A';
            const poster = item.poster_url || 'https://via.placeholder.com/300x450?text=' + encodeURIComponent(item.title);

            const card = document.createElement('div');
            card.className = `content-card ${isCompleted ? 'completed' : ''}`;
            card.innerHTML = `
                <div class="card-poster" style="background-image: url('${poster}')">
                    <span class="card-service-badge">${serviceName}</span>
                </div>
                <div class="card-info">
                    <div class="card-title">${item.title}</div>
                    <div class="card-meta">${year} • ${item.type === 'series_season' ? 'Series' : 'Movie'}</div>
                    <div class="card-actions">
                        <button class="mark-btn" data-id="${item.id}" data-status="${isCompleted ? 'completed' : 'none'}">
                            ${isCompleted ? 'Completed' : 'Mark as Completed'}
                        </button>
                    </div>
                </div>
            `;
            catalogGrid.appendChild(card);
        });
    }

    function isItemCompleted(itemId) {
        const watchItem = userWatchlist.find(w => w.content_item_id === itemId);
        return watchItem && watchItem.status === 'completed';
    }

    function renderNextUp() {
        if (!currentUser) {
            nextUpCard.innerHTML = `
                <div class="next-up-details">
                    <h3>Login to see your Next Up</h3>
                    <p>Track your franchises and chronological viewing orders automatically.</p>
                </div>
            `;
            return;
        }

        // Example: hardcoding MCU or Star Wars franchise lookup.
        // In a full app, you might iterate all franchises or let the user select an active one.
        // Let's just find the first franchise we have data for.
        const franchisesWithContent = [...new Set(allContent.filter(c => c.franchise_id).map(c => c.franchise_id))];
        
        if (franchisesWithContent.length === 0) {
            nextUpCard.innerHTML = `<p class="skeleton-loader">No franchise data available for chronological mapping.</p>`;
            return;
        }

        const activeFranchiseId = franchisesWithContent[0];
        const nextItem = calculateNextUp(activeFranchiseId);

        if (nextItem) {
            const franchiseName = nextItem.franchises?.name || nextItem.mock_franchise || 'Universe';
            const poster = nextItem.poster_url || 'https://via.placeholder.com/300x450?text=' + encodeURIComponent(nextItem.title);
            
            nextUpCard.innerHTML = `
                <img src="${poster}" alt="${nextItem.title}" style="width: 150px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                <div class="next-up-details">
                    <p style="color: var(--text-muted); text-transform: uppercase; font-size: 0.85rem; letter-spacing: 1px;">Next in ${franchiseName}</p>
                    <h3>${nextItem.title}</h3>
                    <p>Chronological Step: ${nextItem.chronological_order}</p>
                    <button class="btn primary-btn mark-next-completed" data-id="${nextItem.id}">Mark as Completed</button>
                </div>
            `;

            const btn = nextUpCard.querySelector('.mark-next-completed');
            if(btn) {
                btn.addEventListener('click', () => {
                    handleDirectComplete(nextItem.id);
                });
            }
        } else {
            nextUpCard.innerHTML = `
                <div class="next-up-details">
                    <h3>You're all caught up!</h3>
                    <p>You have finished everything in this timeline.</p>
                </div>
            `;
        }
    }

    // --- Business Logic ---
    function calculateNextUp(franchiseId) {
        // Fetch all content_items where franchise_id === franchiseId, ordered by chronological_order ASC.
        const franchiseContent = allContent
            .filter(item => item.franchise_id === franchiseId)
            .sort((a, b) => a.chronological_order - b.chronological_order);

        // Filter out completed items based on user_watchlist
        const remainingContent = franchiseContent.filter(item => !isItemCompleted(item.id));

        // Return the first index
        return remainingContent.length > 0 ? remainingContent[0] : null;
    }

    async function handleDirectComplete(itemId) {
        updateLocalWatchlist(itemId, 'completed');
        renderCatalog(); // re-render grid to check the box
        renderNextUp();  // re-calculate next up
        await window.db.upsertWatchlistItem(currentUser.id, itemId, 'completed');
    }

    function updateLocalWatchlist(itemId, status) {
        const existingIndex = userWatchlist.findIndex(w => w.content_item_id === itemId);
        if (existingIndex >= 0) {
            userWatchlist[existingIndex].status = status;
        } else {
            userWatchlist.push({ content_item_id: itemId, status: status });
        }
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        // Auth Modal
        authBtn.addEventListener('click', async () => {
            if (currentUser) {
                await window.db.logout();
            } else {
                loginModal.classList.remove('hidden');
            }
        });

        closeLoginBtn.addEventListener('click', () => {
            loginModal.classList.add('hidden');
            loginError.textContent = '';
            loginSuccess.style.display = 'none';
        });

        toggleAuthModeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            isLoginMode = !isLoginMode;
            loginError.textContent = '';
            loginSuccess.style.display = 'none';
            if (isLoginMode) {
                authModalTitle.textContent = 'Welcome Back';
                authSubmitBtn.textContent = 'Login';
                toggleAuthModeBtn.textContent = 'Need an account? Sign up';
            } else {
                authModalTitle.textContent = 'Create Account';
                authSubmitBtn.textContent = 'Sign Up';
                toggleAuthModeBtn.textContent = 'Already have an account? Login';
            }
        });

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            loginError.textContent = '';
            loginSuccess.style.display = 'none';

            if (isLoginMode) {
                const { error } = await window.db.login(email, password);
                if (error) {
                    loginError.textContent = error.message;
                } else {
                    loginModal.classList.add('hidden');
                    loginForm.reset();
                }
            } else {
                const { data, error } = await window.db.signup(email, password);
                if (error) {
                    loginError.textContent = error.message;
                } else {
                    // Check if email confirmation is required by Supabase settings
                    if (data.user && data.user.identities && data.user.identities.length === 0) {
                        loginError.textContent = 'Email already in use.';
                    } else if (data.session === null) {
                        loginSuccess.textContent = 'Account created! Please check your email to confirm.';
                        loginSuccess.style.display = 'block';
                    } else {
                        loginModal.classList.add('hidden');
                        loginForm.reset();
                    }
                }
            }
        });

        // Filter Bar
        serviceFilters.addEventListener('click', (e) => {
            if (e.target.classList.contains('pill-btn')) {
                // Update active class
                document.querySelectorAll('.pill-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                
                // Update filter and render
                currentFilter = e.target.dataset.service;
                renderCatalog();
            }
        });

        // Search
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            renderCatalog();
        });

        // Filter Bar
        catalogGrid.addEventListener('click', async (e) => {
            if (e.target.classList.contains('mark-btn')) {
                if (!currentUser) {
                    alert("Please login to track your watchlist.");
                    return;
                }
                const itemId = e.target.dataset.id;
                const newStatus = e.target.dataset.status === 'completed' ? 'none' : 'completed';
                
                // Optimistic UI Update
                updateLocalWatchlist(itemId, newStatus);
                renderCatalog();
                renderNextUp();

                // Backend Update
                await window.db.upsertWatchlistItem(currentUser.id, itemId, newStatus);
            }
        });

        // --- Admin Logic ---
        adminNavBtn.addEventListener('click', async () => {
            adminModal.classList.remove('hidden');
            
            // Check cloud settings for API Key
            const cloudKey = await window.db.getSystemSetting('tmdb_api_key');
            if (cloudKey) {
                // Key exists in cloud, hide the input completely
                adminSettingsCard.style.display = 'none';
                adminSearchCard.style.display = 'block';
                // Cache it locally so search button can read it instantly
                localStorage.setItem('tmdb_api_key', cloudKey);
            } else {
                adminSettingsCard.style.display = 'block';
                // Fallback to local storage if not in cloud yet
                const savedKey = localStorage.getItem('tmdb_api_key');
                if (savedKey) {
                    tmdbApiKeyInput.value = savedKey;
                    adminSearchCard.style.display = 'block';
                }
            }
        });

        closeAdminBtn.addEventListener('click', () => {
            adminModal.classList.add('hidden');
            init(); // Refresh data
        });

        saveTmdbKeyBtn.addEventListener('click', async () => {
            const key = tmdbApiKeyInput.value.trim();
            if (key) {
                tmdbKeyStatus.textContent = 'Saving to cloud...';
                tmdbKeyStatus.style.display = 'block';
                
                const { error } = await window.db.setSystemSetting('tmdb_api_key', key);
                
                if (error) {
                    tmdbKeyStatus.textContent = 'Error saving key: ' + error.message;
                    tmdbKeyStatus.style.color = '#ff4444';
                } else {
                    localStorage.setItem('tmdb_api_key', key);
                    tmdbKeyStatus.textContent = 'Key saved securely in the cloud!';
                    tmdbKeyStatus.style.color = 'var(--success-color)';
                    
                    // Hide the settings card after a short delay since it's now cloud-synced
                    setTimeout(() => {
                        adminSettingsCard.style.display = 'none';
                        adminSearchCard.style.display = 'block';
                    }, 1500);
                }
            }
        });

        tmdbSearchBtn.addEventListener('click', async () => {
            const query = tmdbSearchQuery.value.trim();
            const key = localStorage.getItem('tmdb_api_key');
            if (!query || !key) return;

            tmdbSearchBtn.textContent = 'Searching...';
            try {
                const res = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${key}&query=${encodeURIComponent(query)}`);
                const data = await res.json();
                renderTmdbResults(data.results || []);
            } catch (e) {
                console.error("TMDB Error", e);
                alert("Failed to fetch from TMDB. Check your API key.");
            }
            tmdbSearchBtn.textContent = 'Search';
        });
    }

    function renderTmdbResults(results) {
        tmdbResultsGrid.innerHTML = '';
        if (results.length === 0) {
            tmdbResultsGrid.innerHTML = '<p>No results found.</p>';
            return;
        }

        // Build dropdown options for services and franchises
        const serviceOptions = allServices.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        const franchiseOptions = allFranchises.map(f => `<option value="${f.id}">${f.name}</option>`).join('');

        results.slice(0, 12).forEach(item => {
            const poster = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://via.placeholder.com/300x450/111111/fff?text=No+Image';
            const year = item.first_air_date ? item.first_air_date.split('-')[0] : 'TBA';
            
            const card = document.createElement('div');
            card.className = 'tmdb-result-card';
            card.innerHTML = `
                <img src="${poster}" class="tmdb-poster" alt="${item.name}">
                <div class="tmdb-info">
                    <div class="tmdb-title">${item.name}</div>
                    <div class="tmdb-year">${year}</div>
                    
                    <label style="font-size: 0.8rem; margin-top: 10px;">Service</label>
                    <select class="admin-select-dropdown" id="service-${item.id}">
                        <option value="">None / Unknown</option>
                        ${serviceOptions}
                    </select>

                    <label style="font-size: 0.8rem;">Franchise</label>
                    <select class="admin-select-dropdown" id="franchise-${item.id}">
                        <option value="">None / Standalone</option>
                        ${franchiseOptions}
                    </select>

                    <label style="font-size: 0.8rem;">Chronological Order (optional)</label>
                    <input type="number" class="admin-select-dropdown" id="order-${item.id}" placeholder="e.g. 1" style="background: var(--bg-dark); color: white; border: 1px solid var(--border-subtle); padding: 5px;">

                    <button class="btn primary-btn add-supabase-btn" style="margin-top: 10px; width: 100%;" data-tmdb-id="${item.id}" data-title="${item.name.replace(/"/g, '&quot;')}" data-year="${year}" data-poster="${poster}">Add to Database</button>
                </div>
            `;
            tmdbResultsGrid.appendChild(card);
        });

        // Add Event Listeners for Add Buttons
        document.querySelectorAll('.add-supabase-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const btnEl = e.target;
                const tmdbId = btnEl.dataset.tmdbId;
                const title = btnEl.dataset.title;
                const year = btnEl.dataset.year;
                const poster = btnEl.dataset.poster;

                const serviceId = document.getElementById(`service-${tmdbId}`).value;
                const franchiseId = document.getElementById(`franchise-${tmdbId}`).value;
                const chronoOrder = document.getElementById(`order-${tmdbId}`).value;

                btnEl.textContent = 'Adding...';
                btnEl.disabled = true;

                const payload = {
                    id: tmdbId.toString(),
                    title: title,
                    type: 'series_season',
                    release_year: parseInt(year) || null,
                    poster_url: poster,
                    franchise_id: franchiseId || null,
                    chronological_order: chronoOrder ? parseInt(chronoOrder) : null,
                    service_id: serviceId || null // Assuming schema uses service_id
                };

                const { error } = await window.db.insertContentItem(payload);
                if (error) {
                    alert("Error: " + error.message);
                    btnEl.textContent = 'Failed';
                } else {
                    btnEl.textContent = 'Added!';
                    btnEl.style.background = 'var(--success-color)';
                }
            });
        });
    }

    // --- Mock Data Fallback ---
    function getMockData() {
        return [
            { id: '1', title: 'The Mandalorian', type: 'series_season', release_year: 2019, franchise_id: 'f1', mock_franchise: 'Star Wars', chronological_order: 1, mock_service: 'disney', poster_url: 'https://image.tmdb.org/t/p/w500/eU1i6eHXlzMOlEq0ku1Rzq7Y4wA.jpg' },
            { id: '2', title: 'The Book of Boba Fett', type: 'series_season', release_year: 2021, franchise_id: 'f1', mock_franchise: 'Star Wars', chronological_order: 2, mock_service: 'disney', poster_url: 'https://image.tmdb.org/t/p/w500/gNbdjDi1OIRC24nmOblOXqlIQnv.jpg' },
            { id: '3', title: 'Ahsoka', type: 'series_season', release_year: 2023, franchise_id: 'f1', mock_franchise: 'Star Wars', chronological_order: 3, mock_service: 'disney', poster_url: 'https://image.tmdb.org/t/p/w500/q228tJmE6L20s5gLThc2zOqHj8q.jpg' },
            { id: '4', title: 'Stranger Things', type: 'series_season', release_year: 2016, franchise_id: null, chronological_order: null, mock_service: 'netflix', poster_url: 'https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8SliM7O14.jpg' },
            { id: '5', title: 'The Last of Us', type: 'series_season', release_year: 2023, franchise_id: null, chronological_order: null, mock_service: 'peacock', poster_url: 'https://image.tmdb.org/t/p/w500/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg' },
            { id: '6', title: 'The Bear', type: 'series_season', release_year: 2022, franchise_id: null, chronological_order: null, mock_service: 'hulu', poster_url: 'https://image.tmdb.org/t/p/w500/sY6u6vPoyWkHqGg7V02GTV4B9pZ.jpg' },
            { id: '7', title: 'WandaVision', type: 'series_season', release_year: 2021, franchise_id: 'f2', mock_franchise: 'Marvel', chronological_order: 1, mock_service: 'disney', poster_url: 'https://image.tmdb.org/t/p/w500/glKDfE6btIRcVB5zrjspRIs4r52.jpg' },
            { id: '8', title: 'Loki', type: 'series_season', release_year: 2021, franchise_id: 'f2', mock_franchise: 'Marvel', chronological_order: 2, mock_service: 'disney', poster_url: 'https://image.tmdb.org/t/p/w500/kEl2t3OhXc3Zb9FBh1AuYzRTgZp.jpg' },
            { id: '9', title: 'House of the Dragon', type: 'series_season', release_year: 2022, franchise_id: null, chronological_order: null, mock_service: 'peacock', poster_url: 'https://image.tmdb.org/t/p/w500/1X4h40fcBaqcg9cgEV13koOSNfl.jpg' },
            { id: '10', title: 'The Boys', type: 'series_season', release_year: 2019, franchise_id: null, chronological_order: null, mock_service: 'prime', poster_url: 'https://image.tmdb.org/t/p/w500/7Ns6tOqsT7h2LqF21c2G4t9q30Z.jpg' },
            { id: '11', title: 'Invincible', type: 'series_season', release_year: 2021, franchise_id: null, chronological_order: null, mock_service: 'prime', poster_url: 'https://image.tmdb.org/t/p/w500/y20p5ZpYngF2kUeA4JjG1W3tYIu.jpg' },
            { id: '12', title: 'Shōgun', type: 'series_season', release_year: 2024, franchise_id: null, chronological_order: null, mock_service: 'hulu', poster_url: 'https://image.tmdb.org/t/p/w500/7O4iVfOMQmdCSxhOg1WNzG1AoQk.jpg' }
        ];
    }

    // Boot
    init();
});
