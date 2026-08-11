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
            authStatusBadge.classList.add('logged-in');
            authBtn.textContent = 'Logout';
        } else {
            authStatusBadge.textContent = 'Guest';
            authStatusBadge.classList.remove('logged-in');
            authBtn.textContent = 'Login';
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
                        <label class="checkbox-wrapper">
                            <input type="checkbox" class="status-toggle" data-id="${item.id}" ${isCompleted ? 'checked' : ''} ${!currentUser ? 'disabled' : ''}>
                            <span>Completed</span>
                        </label>
                    </div>
                </div>
            `;
            catalogGrid.appendChild(card);
        });

        // Attach event listeners to checkboxes
        document.querySelectorAll('.status-toggle').forEach(checkbox => {
            checkbox.addEventListener('change', handleStatusToggle);
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

    async function handleStatusToggle(e) {
        const itemId = e.target.dataset.id;
        const isCompleted = e.target.checked;
        const newStatus = isCompleted ? 'completed' : 'planning';

        // Optimistic UI update
        const card = e.target.closest('.content-card');
        if (isCompleted) {
            card.classList.add('completed');
        } else {
            card.classList.remove('completed');
        }

        updateLocalWatchlist(itemId, newStatus);
        renderNextUp();

        // Database write
        const { error } = await window.db.upsertWatchlistItem(currentUser.id, itemId, newStatus);
        if (error) {
            console.error("Failed to update status in DB", error);
            // Revert optimistic update on failure (optional robust handling)
        }
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
    }

    // --- Mock Data Fallback ---
    function getMockData() {
        return [
            { id: '1', title: 'The Mandalorian', type: 'series_season', release_year: 2019, franchise_id: 'f1', mock_franchise: 'Star Wars', chronological_order: 1, mock_service: 'disney', poster_url: 'https://via.placeholder.com/300x450/111111/fff?text=Mandalorian' },
            { id: '2', title: 'The Book of Boba Fett', type: 'series_season', release_year: 2021, franchise_id: 'f1', mock_franchise: 'Star Wars', chronological_order: 2, mock_service: 'disney', poster_url: 'https://via.placeholder.com/300x450/111111/fff?text=Boba+Fett' },
            { id: '3', title: 'Stranger Things', type: 'series_season', release_year: 2016, franchise_id: null, chronological_order: null, mock_service: 'netflix', poster_url: 'https://via.placeholder.com/300x450/111111/e50914?text=Stranger+Things' },
            { id: '4', title: 'The Last of Us', type: 'series_season', release_year: 2023, franchise_id: null, chronological_order: null, mock_service: 'max', poster_url: 'https://via.placeholder.com/300x450/111111/fff?text=The+Last+of+Us' },
            { id: '5', title: 'The Bear', type: 'series_season', release_year: 2022, franchise_id: null, chronological_order: null, mock_service: 'hulu', poster_url: 'https://via.placeholder.com/300x450/111111/00ed70?text=The+Bear' },
        ];
    }

    // Boot
    init();
});
