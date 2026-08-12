document.addEventListener('DOMContentLoaded', () => {
    // State
    let currentUser = null;
    let allContent = [];
    let allServices = [];
    let userWatchlist = [];
    let recommendations = [];
    let currentFilter = 'all';
    let searchQuery = '';
    let isLoginMode = true;

    // DOM Elements - Main
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
    
    // New Carousels
    const continueWatchingContainer = document.getElementById('continue-watching-container');
    const continueWatchingGrid = document.getElementById('continue-watching-grid');
    const recommendationsContainer = document.getElementById('recommendations-container');
    const recommendationsGrid = document.getElementById('recommendations-grid');

    // Admin Elements
    const adminNavBtn = document.getElementById('admin-nav-btn');
    const adminModal = document.getElementById('admin-modal');
    const closeAdminBtn = document.getElementById('close-admin-btn');
    const adminSettingsCard = document.getElementById('admin-settings-card');
    const tmdbApiKeyInput = document.getElementById('tmdb-api-key');
    const saveTmdbKeyBtn = document.getElementById('save-tmdb-key-btn');
    const tmdbKeyStatus = document.getElementById('tmdb-key-status');
    const adminSearchCard = document.getElementById('admin-search-card');
    const tmdbSearchQuery = document.getElementById('tmdb-search-query');
    const tmdbSearchBtn = document.getElementById('tmdb-search-btn');
    const tmdbResultsGrid = document.getElementById('tmdb-results-grid');
    
    // Custom Add Elements
    const customTitle = document.getElementById('custom-title');
    const customPoster = document.getElementById('custom-poster');
    const customService = document.getElementById('custom-service');
    const customAddBtn = document.getElementById('custom-add-btn');

    // --- Initialization ---
    async function init() {
        window.db.onAuthStateChange(async (event, session) => {
            currentUser = session?.user || null;
            updateAuthUI();
            await loadUserData();
        });

        currentUser = await window.db.getCurrentUser();
        updateAuthUI();
        
        allServices = await window.db.getStreamingServices();
        allContent = await window.db.getContentItems();
        
        if (allContent.length === 0) {
            allContent = getMockData();
        }

        await loadUserData();
        setupEventListeners();
    }

    async function loadUserData() {
        if (currentUser) {
            userWatchlist = await window.db.getUserWatchlist(currentUser.id);
        } else {
            // Mock Watchlist for demo purposes so features are visible without auth
            userWatchlist = [
                { content_item_id: '1', status: 'completed', rating: 'thumbs_up' }, // Mando (Will recommend SciFi)
                { content_item_id: '5', status: 'watching', rating: null }, // The Office
                { content_item_id: '9', status: 'want_to_watch', rating: null } // Parks & Rec
            ];
        }
        
        await fetchRecommendations();
        renderAllSections();
    }

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
    function renderAllSections() {
        renderContinueWatching();
        renderRecommendations();
        renderCatalog();
    }

    function createCardHTML(item, isRecommendation = false) {
        const watchData = userWatchlist.find(w => w.content_item_id === item.id) || { status: 'none', rating: null };
        const status = watchData.status;
        const rating = watchData.rating;
        
        const serviceName = item.streaming_services?.name || item.mock_service || 'Unknown';
        const year = item.release_year || 'N/A';
        const poster = item.poster_url || 'https://via.placeholder.com/300x450?text=' + encodeURIComponent(item.title);
        
        let opacityClass = status === 'completed' ? 'completed' : (status === 'dropped' ? 'dropped' : '');

        let cardHtml = `
            <div class="content-card ${opacityClass}">
                <div class="card-poster" style="background-image: url('${poster}')">
                    <span class="card-service-badge" style="text-transform: capitalize;">${serviceName}</span>
                </div>
                <div class="card-info">
                    <div class="card-title">${item.title}</div>
                    <div class="card-meta">${year}</div>
        `;

        if (!isRecommendation) {
            cardHtml += `
                    <div class="card-actions" style="flex-direction: column; gap: 0.5rem; align-items: stretch;">
                        <select class="status-dropdown" data-id="${item.id}">
                            <option value="none" ${status === 'none' ? 'selected' : ''}>+ Add to List</option>
                            <option value="want_to_watch" ${status === 'want_to_watch' ? 'selected' : ''}>Want to Watch</option>
                            <option value="watching" ${status === 'watching' ? 'selected' : ''}>Watching</option>
                            <option value="completed" ${status === 'completed' ? 'selected' : ''}>Completed</option>
                            <option value="dropped" ${status === 'dropped' ? 'selected' : ''}>Dropped</option>
                        </select>
            `;
            
            if (status === 'completed') {
                cardHtml += `
                        <div class="rating-bar">
                            <button class="rating-btn up ${rating === 'thumbs_up' ? 'active' : ''}" data-id="${item.id}" data-val="thumbs_up">👍</button>
                            <button class="rating-btn down ${rating === 'thumbs_down' ? 'active' : ''}" data-id="${item.id}" data-val="thumbs_down">👎</button>
                        </div>
                `;
            }
            cardHtml += `</div>`;
        } else {
            // It's a recommendation card
            cardHtml += `
                    <div class="card-actions">
                        <button class="btn primary-btn add-rec-btn" data-title="${item.title.replace(/"/g, '&quot;')}" data-year="${year}" data-poster="${poster}" data-tmdbid="${item.id}" style="width:100%; font-size:0.8rem;">Add to Watchlist</button>
                    </div>
            `;
        }

        cardHtml += `
                </div>
            </div>
        `;
        return cardHtml;
    }

    function renderCatalog() {
        catalogGrid.innerHTML = '';
        
        let filteredContent = allContent.filter(item => {
            if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            if (currentFilter !== 'all') {
                const serviceName = item.streaming_services?.name?.toLowerCase() || item.mock_service?.toLowerCase();
                if (serviceName !== currentFilter) return false;
            }
            return true;
        });

        if (filteredContent.length === 0) {
            catalogGrid.innerHTML = '<p class="skeleton-loader">No library content found.</p>';
            return;
        }

        filteredContent.forEach(item => {
            catalogGrid.innerHTML += createCardHTML(item);
        });
    }

    function renderContinueWatching() {
        const watchingIds = userWatchlist.filter(w => w.status === 'watching').map(w => w.content_item_id);
        const watchingContent = allContent.filter(c => watchingIds.includes(c.id));
        
        if (watchingContent.length > 0) {
            continueWatchingContainer.style.display = 'block';
            continueWatchingGrid.innerHTML = watchingContent.map(item => createCardHTML(item)).join('');
        } else {
            continueWatchingContainer.style.display = 'none';
        }
    }

    function renderRecommendations() {
        if (recommendations.length > 0) {
            recommendationsContainer.style.display = 'block';
            recommendationsGrid.innerHTML = recommendations.map(item => createCardHTML(item, true)).join('');
        } else {
            recommendationsContainer.style.display = 'none';
        }
    }

    // --- Recommendation Logic ---
    async function fetchRecommendations() {
        const cloudKey = await window.db.getSystemSetting('tmdb_api_key') || localStorage.getItem('tmdb_api_key');
        if (!cloudKey) {
            recommendations = [];
            return;
        }

        const thumbsUpIds = userWatchlist
            .filter(w => w.status === 'completed' && w.rating === 'thumbs_up')
            .map(w => w.content_item_id);
            
        if (thumbsUpIds.length === 0) {
            recommendations = [];
            return;
        }

        let allRecs = [];
        // Only fetch recommendations for the last 3 liked shows to prevent API spam
        for (const tmdbId of thumbsUpIds.slice(0, 3)) {
            try {
                const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/recommendations?api_key=${cloudKey}&language=en-US&page=1`);
                const data = await res.json();
                if(data.results) {
                    allRecs = allRecs.concat(data.results);
                }
            } catch (e) {
                console.error("TMDB Rec Error", e);
            }
        }

        // Deduplicate and filter out shows we already have in our library
        const uniqueRecs = [];
        const seenIds = new Set(allContent.map(c => String(c.id)));
        
        allRecs.forEach(rec => {
            if (!seenIds.has(String(rec.id))) {
                seenIds.add(String(rec.id));
                uniqueRecs.push({
                    id: String(rec.id),
                    title: rec.name,
                    release_year: rec.first_air_date ? rec.first_air_date.split('-')[0] : 'N/A',
                    poster_url: rec.poster_path ? `https://image.tmdb.org/t/p/w500${rec.poster_path}` : null,
                    mock_service: 'Recommended'
                });
            }
        });
        
        // Take top 8 recommendations
        recommendations = uniqueRecs.slice(0, 8);
    }

    // --- Actions ---
    async function updateWatchState(itemId, status, rating = null) {
        if (!currentUser) {
            alert("Please login to save changes.");
            return;
        }

        const existing = userWatchlist.find(w => w.content_item_id === itemId);
        if (existing) {
            existing.status = status;
            if (rating !== null) existing.rating = rating;
        } else {
            userWatchlist.push({ content_item_id: itemId, status, rating });
        }

        renderAllSections();
        if (status === 'completed' && rating === 'thumbs_up') {
            await fetchRecommendations();
            renderRecommendations();
        }

        await window.db.upsertWatchlistItem(currentUser.id, itemId, status, rating);
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        // Global Grid Click Listener for Status / Rating
        document.body.addEventListener('change', (e) => {
            if (e.target.classList.contains('status-dropdown')) {
                const itemId = e.target.dataset.id;
                const status = e.target.value;
                // If they change away from completed, clear rating
                const existing = userWatchlist.find(w => w.content_item_id === itemId);
                const currentRating = status === 'completed' ? (existing?.rating || null) : null;
                updateWatchState(itemId, status, currentRating);
            }
        });

        document.body.addEventListener('click', async (e) => {
            // Rating Buttons
            if (e.target.classList.contains('rating-btn')) {
                const itemId = e.target.dataset.id;
                let rating = e.target.dataset.val;
                
                // Toggle off if clicking the active one
                if (e.target.classList.contains('active')) {
                    rating = null; 
                }
                
                updateWatchState(itemId, 'completed', rating);
            }

            // Quick Add from Recommendations
            if (e.target.classList.contains('add-rec-btn')) {
                if (!currentUser) { alert("Login required"); return; }
                const btn = e.target;
                const payload = {
                    id: btn.dataset.tmdbid,
                    title: btn.dataset.title,
                    type: 'series_season',
                    release_year: parseInt(btn.dataset.year) || null,
                    poster_url: btn.dataset.poster,
                    service_id: null
                };
                btn.textContent = "Adding...";
                const { error } = await window.db.insertContentItem(payload);
                if (!error) {
                    allContent.push(payload);
                    await updateWatchState(payload.id, 'want_to_watch', null);
                    // fetchRecommendations will re-run removing it from recs since it's in library now
                    await fetchRecommendations();
                    renderAllSections();
                } else {
                    alert("Error adding: " + error.message);
                    btn.textContent = "Error";
                }
            }
        });

        // Filter Bar
        serviceFilters.addEventListener('click', (e) => {
            if (e.target.classList.contains('pill-btn')) {
                document.querySelectorAll('.pill-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                currentFilter = e.target.dataset.service;
                renderCatalog();
            }
        });

        // Search
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            renderCatalog();
        });

        // Auth Modals
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
                if (error) loginError.textContent = error.message;
                else {
                    loginModal.classList.add('hidden');
                    loginForm.reset();
                }
            } else {
                const { data, error } = await window.db.signup(email, password);
                if (error) loginError.textContent = error.message;
                else if (data.session === null) {
                    loginSuccess.textContent = 'Check your email to confirm.';
                    loginSuccess.style.display = 'block';
                } else {
                    loginModal.classList.add('hidden');
                    loginForm.reset();
                }
            }
        });

        // --- Admin Logic ---
        adminNavBtn.addEventListener('click', async () => {
            adminModal.classList.remove('hidden');
            const cloudKey = await window.db.getSystemSetting('tmdb_api_key');
            if (cloudKey) {
                adminSettingsCard.style.display = 'none';
                adminSearchCard.style.display = 'block';
                localStorage.setItem('tmdb_api_key', cloudKey);
            } else {
                adminSettingsCard.style.display = 'block';
                const savedKey = localStorage.getItem('tmdb_api_key');
                if (savedKey) {
                    tmdbApiKeyInput.value = savedKey;
                    adminSearchCard.style.display = 'block';
                }
            }
        });

        closeAdminBtn.addEventListener('click', () => {
            adminModal.classList.add('hidden');
            // Hard reload state
            allContent = [];
            init(); 
        });

        saveTmdbKeyBtn.addEventListener('click', async () => {
            const key = tmdbApiKeyInput.value.trim();
            if (key) {
                tmdbKeyStatus.textContent = 'Saving to cloud...';
                tmdbKeyStatus.style.display = 'block';
                const { error } = await window.db.setSystemSetting('tmdb_api_key', key);
                if (error) {
                    tmdbKeyStatus.textContent = 'Error: ' + error.message;
                    tmdbKeyStatus.style.color = '#ff4444';
                } else {
                    localStorage.setItem('tmdb_api_key', key);
                    tmdbKeyStatus.textContent = 'Key saved securely!';
                    tmdbKeyStatus.style.color = 'var(--success-color)';
                    setTimeout(() => {
                        adminSettingsCard.style.display = 'none';
                        adminSearchCard.style.display = 'block';
                        fetchRecommendations(); // Trigger recs now that key exists
                        renderRecommendations();
                    }, 1000);
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
            }
            tmdbSearchBtn.textContent = 'Search';
        });

        // Custom Manual Add
        customAddBtn.addEventListener('click', async () => {
            const title = customTitle.value.trim();
            const poster = customPoster.value.trim() || 'https://via.placeholder.com/300x450/222/fff?text=' + encodeURIComponent(title);
            const service = customService.value;

            if (!title) {
                alert("Please enter a title.");
                return;
            }

            const payload = {
                id: 'custom_' + Date.now(), // Generate a unique ID for non-TMDB items
                title: title,
                type: 'series_season',
                release_year: new Date().getFullYear(),
                poster_url: poster,
                service_id: null,
                mock_service: service // Use mock_service for quick string display without joining tables
            };

            customAddBtn.textContent = 'Adding...';
            const { error } = await window.db.insertContentItem(payload);
            
            if (error) {
                alert("Error: " + error.message);
                customAddBtn.textContent = 'Add to Library';
            } else {
                customTitle.value = '';
                customPoster.value = '';
                customAddBtn.textContent = 'Added!';
                customAddBtn.style.background = 'var(--success-color)';
                setTimeout(() => {
                    customAddBtn.textContent = 'Add to Library';
                    customAddBtn.style.background = 'var(--accent-color)';
                }, 2000);
            }
        });
    }

    function renderTmdbResults(results) {
        tmdbResultsGrid.innerHTML = '';
        if (results.length === 0) {
            tmdbResultsGrid.innerHTML = '<p>No results found.</p>';
            return;
        }

        const serviceOptions = allServices.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

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
                        <option value="youtube">YouTube TV</option>
                    </select>

                    <button class="btn primary-btn add-supabase-btn" style="margin-top: 10px; width: 100%;" data-tmdb-id="${item.id}" data-title="${item.name.replace(/"/g, '&quot;')}" data-year="${year}" data-poster="${poster}">Add to Library</button>
                </div>
            `;
            tmdbResultsGrid.appendChild(card);
        });

        document.querySelectorAll('.add-supabase-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const btnEl = e.target;
                const tmdbId = btnEl.dataset.tmdbId;
                const title = btnEl.dataset.title;
                const year = btnEl.dataset.year;
                const poster = btnEl.dataset.poster;

                const serviceSelect = document.getElementById(`service-${tmdbId}`);
                const serviceId = serviceSelect.value;
                const serviceName = serviceSelect.options[serviceSelect.selectedIndex].text;

                btnEl.textContent = 'Adding...';
                btnEl.disabled = true;

                const payload = {
                    id: tmdbId.toString(),
                    title: title,
                    type: 'series_season',
                    release_year: parseInt(year) || null,
                    poster_url: poster,
                    service_id: serviceId !== 'youtube' ? (serviceId || null) : null,
                    mock_service: serviceId === 'youtube' ? 'youtube' : null // Override for custom networks not in DB
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
            { id: '1', title: 'The Mandalorian', type: 'series_season', release_year: 2019, mock_service: 'disney', poster_url: 'https://image.tmdb.org/t/p/w500/eU1i6eHXlzMOlEq0ku1Rzq7Y4wA.jpg' },
            { id: '2', title: 'The Book of Boba Fett', type: 'series_season', release_year: 2021, mock_service: 'disney', poster_url: 'https://image.tmdb.org/t/p/w500/gNbdjDi1OIRC24nmOblOXqlIQnv.jpg' },
            { id: '3', title: 'Ahsoka', type: 'series_season', release_year: 2023, mock_service: 'disney', poster_url: 'https://image.tmdb.org/t/p/w500/q228tJmE6L20s5gLThc2zOqHj8q.jpg' },
            { id: '4', title: 'Stranger Things', type: 'series_season', release_year: 2016, mock_service: 'netflix', poster_url: 'https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8SliM7O14.jpg' },
            { id: '5', title: 'The Office', type: 'series_season', release_year: 2005, mock_service: 'peacock', poster_url: 'https://image.tmdb.org/t/p/w500/qatS1yP6mG4y7h2fD5R51QWJ4V6.jpg' },
            { id: '6', title: 'The Bear', type: 'series_season', release_year: 2022, mock_service: 'hulu', poster_url: 'https://image.tmdb.org/t/p/w500/sY6u6vPoyWkHqGg7V02GTV4B9pZ.jpg' },
            { id: '7', title: 'WandaVision', type: 'series_season', release_year: 2021, mock_service: 'disney', poster_url: 'https://image.tmdb.org/t/p/w500/glKDfE6btIRcVB5zrjspRIs4r52.jpg' },
            { id: '8', title: 'Loki', type: 'series_season', release_year: 2021, mock_service: 'disney', poster_url: 'https://image.tmdb.org/t/p/w500/kEl2t3OhXc3Zb9FBh1AuYzRTgZp.jpg' },
            { id: '9', title: 'Parks and Recreation', type: 'series_season', release_year: 2009, mock_service: 'peacock', poster_url: 'https://image.tmdb.org/t/p/w500/lXylq5d0dK7uJ9W8vC5p4F1b4p.jpg' },
            { id: '10', title: 'The Boys', type: 'series_season', release_year: 2019, mock_service: 'prime', poster_url: 'https://image.tmdb.org/t/p/w500/7Ns6tOqsT7h2LqF21c2G4t9q30Z.jpg' },
            { id: '11', title: 'Invincible', type: 'series_season', release_year: 2021, mock_service: 'prime', poster_url: 'https://image.tmdb.org/t/p/w500/y20p5ZpYngF2kUeA4JjG1W3tYIu.jpg' },
            { id: '12', title: 'Shōgun', type: 'series_season', release_year: 2024, mock_service: 'hulu', poster_url: 'https://image.tmdb.org/t/p/w500/7O4iVfOMQmdCSxhOg1WNzG1AoQk.jpg' },
            { id: '13', title: 'Critical Role', type: 'series_season', release_year: 2015, mock_service: 'youtube', poster_url: 'https://image.tmdb.org/t/p/w500/r51296x08yN6W7sP0Rk.jpg' } // Added generic youtube example
        ];
    }

    // Boot
    init();
});
