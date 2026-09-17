document.addEventListener('DOMContentLoaded', () => {

    // Non-intrusive Toast Notification System
    function showToast(message, type = 'info', duration = 3500) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(12px)';
            toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

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
    const searchInput = document.getElementById('library-filter-field');
    
    // New Carousels
    const continueWatchingContainer = document.getElementById('continue-watching-container');
    const continueWatchingGrid = document.getElementById('continue-watching-grid');
    const recommendationsContainer = document.getElementById('recommendations-container');
    const recommendationsGrid = document.getElementById('recommendations-grid');

    // Admin Elements
    const addShowsBtn = document.getElementById('add-shows-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const addShowsModal = document.getElementById('add-shows-modal');
    const settingsModal = document.getElementById('settings-modal');
    const closeAddShowsBtn = document.getElementById('close-add-shows-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
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
            if (currentUser) {
                await window.db.syncLocalStorageToCloud(currentUser.id);
            }
            await loadUserData();
        });

        currentUser = await window.db.getCurrentUser();
        updateAuthUI();
        if (currentUser) {
            await window.db.syncLocalStorageToCloud(currentUser.id);
        }
        
        allServices = await window.db.getStreamingServices();
        allContent = await window.db.getContentItems();

        await loadUserData();
        setupEventListeners();
    }

    async function loadUserData() {
        userWatchlist = await window.db.getUserWatchlist(currentUser ? currentUser.id : null);
        await fetchRecommendations();
        renderAllSections();
    }

    function updateAuthUI() {
        if (currentUser) {
            authStatusBadge.textContent = currentUser.email;
            authStatusBadge.classList.add('logged-in');
            authBtn.textContent = 'Logout';
        } else {
            authStatusBadge.textContent = 'Guest (Local)';
            authStatusBadge.classList.remove('logged-in');
            authBtn.textContent = 'Login';
        }
        // Always make Add Shows and Settings buttons accessible
        addShowsBtn.classList.remove('hidden');
        settingsBtn.classList.remove('hidden');
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
                            <option value="dropped" ${status === 'dropped' ? 'selected' : ''}>Not Interested</option>
                        </select>
            `;
            
            if (status === 'completed') {
                cardHtml += `
                        <div class="rating-bar">
                            <button class="rating-btn up ${rating === 'thumbs_up' ? 'active' : ''}" data-id="${item.id}" data-val="thumbs_up" title="Thumbs Up">👍</button>
                            <button class="rating-btn down ${rating === 'thumbs_down' ? 'active' : ''}" data-id="${item.id}" data-val="thumbs_down" title="Thumbs Down">👎</button>
                        </div>
                `;
            }
            cardHtml += `
                        <button class="remove-btn" data-id="${item.id}" data-title="${item.title.replace(/"/g, '&quot;')}">✕ Remove from Library</button>
                    </div>`;
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

    function matchesServiceFilter(item, filter) {
        if (!filter || filter === 'all') return true;
        const rawName = (item.streaming_services?.name || item.mock_service || '').toLowerCase().trim();
        if (!rawName) return false;

        const norm = filter.toLowerCase().trim();
        if (norm === 'disney') return rawName.includes('disney');
        if (norm === 'prime') return rawName.includes('prime') || rawName.includes('amazon');
        if (norm === 'youtube') return rawName.includes('youtube');
        return rawName.includes(norm);
    }

    function renderCatalog() {
        catalogGrid.innerHTML = '';
        
        let filteredContent = [];
        try {
            filteredContent = allContent.filter(item => {
                if (!item) return false;
                const title = item.title || '';
                if (searchQuery && !title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                if (!matchesServiceFilter(item, currentFilter)) return false;
                return true;
            });
        } catch (e) {
            console.error("Filter error:", e);
            catalogGrid.innerHTML = `<p class="error-msg">Error filtering content: ${e.message}</p>`;
            return;
        }

        if (allContent.length === 0) {
            catalogGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: rgba(255,255,255,0.05); border-radius: 12px; margin-top: 40px;">
                    <h2 style="margin-bottom: 15px; font-size: 2rem;">Your Library is Empty!</h2>
                    <p style="color: var(--text-muted); margin-bottom: 25px; font-size: 1.1rem;">It looks like you haven't added any shows yet. Build your personal watchlist by searching TMDB or manually adding shows from YouTube TV.</p>
                    <button class="btn primary-btn" style="font-size: 1.2rem; padding: 15px 30px;" onclick="document.getElementById('add-shows-btn').click()">+ Add Your First Show</button>
                </div>
            `;
            return;
        }

        if (filteredContent.length === 0) {
            let reason = searchQuery ? ` matching "${searchQuery}"` : '';
            catalogGrid.innerHTML = `<p class="skeleton-loader" style="grid-column: 1 / -1; text-align: center;">No library content found${reason}.</p>`;
            return;
        }

        let htmlString = '';
        filteredContent.forEach(item => {
            try {
                htmlString += createCardHTML(item);
            } catch(e) {
                console.error("Render card error:", e);
            }
        });
        catalogGrid.innerHTML = htmlString;
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

        // Recommend based on both currently watching shows and completed/liked shows
        const targetIds = userWatchlist
            .filter(w => (w.status === 'completed' && w.rating === 'thumbs_up') || w.status === 'watching')
            .map(w => w.content_item_id);
            
        // Filter strictly to numeric TMDB IDs to avoid 404s on custom shows
        const numericIds = targetIds.filter(id => /^\d+$/.test(String(id)));
        if (numericIds.length === 0) {
            recommendations = [];
            return;
        }

        let allRecs = [];
        // Use up to 3 most relevant shows
        for (const tmdbId of numericIds.slice(-3)) {
            try {
                const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/recommendations?api_key=${cloudKey}&language=en-US&page=1`);
                if (!res.ok) continue;
                const data = await res.json();
                if (data && data.results) {
                    allRecs = allRecs.concat(data.results);
                }
            } catch (e) {
                console.warn("TMDB Recommendation fetch warning:", e);
            }
        }

        // Deduplicate and filter out shows we already have in our library
        const uniqueRecs = [];
        const seenIds = new Set(allContent.map(c => String(c.id)));
        
        allRecs.forEach(rec => {
            if (rec && rec.id && !seenIds.has(String(rec.id))) {
                seenIds.add(String(rec.id));
                uniqueRecs.push({
                    id: String(rec.id),
                    title: rec.name || 'Untitled',
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
        const idStr = String(itemId);
        const existing = userWatchlist.find(w => String(w.content_item_id) === idStr);
        if (existing) {
            existing.status = status;
            if (rating !== null) existing.rating = rating;
        } else {
            userWatchlist.push({ content_item_id: idStr, status, rating });
        }

        renderAllSections();
        if ((status === 'completed' && rating === 'thumbs_up') || status === 'watching') {
            await fetchRecommendations();
            renderRecommendations();
        }

        await window.db.upsertWatchlistItem(currentUser?.id || null, idStr, status, rating);
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        // Global Grid Change Listener for Status Dropdown
        document.body.addEventListener('change', (e) => {
            if (e.target.classList.contains('status-dropdown')) {
                const itemId = e.target.dataset.id;
                const status = e.target.value;
                const existing = userWatchlist.find(w => String(w.content_item_id) === String(itemId));
                const currentRating = status === 'completed' ? (existing?.rating || null) : null;
                updateWatchState(itemId, status, currentRating);
            }
        });

        document.body.addEventListener('click', async (e) => {
            // Rating Buttons (Thumbs Up / Down)
            if (e.target.classList.contains('rating-btn')) {
                const itemId = e.target.dataset.id;
                let rating = e.target.dataset.val;
                
                if (e.target.classList.contains('active')) {
                    rating = null; 
                }
                
                updateWatchState(itemId, 'completed', rating);
            }

            // Remove Show from Library
            if (e.target.classList.contains('remove-btn')) {
                const itemId = e.target.dataset.id;
                const title = e.target.dataset.title || 'Show';
                if (!confirm(`Are you sure you want to remove "${title}" from your library?`)) return;

                const { error } = await window.db.deleteContentItem(itemId);
                if (error) {
                    showToast("Error removing show: " + error.message, 'error');
                } else {
                    allContent = allContent.filter(c => String(c.id) !== String(itemId));
                    userWatchlist = userWatchlist.filter(w => String(w.content_item_id) !== String(itemId));
                    await fetchRecommendations();
                    renderAllSections();
                    showToast(`Removed "${title}" from your library.`, 'info');
                }
            }

            // Quick Add from Recommendations
            if (e.target.classList.contains('add-rec-btn')) {
                const btn = e.target;
                const payload = {
                    id: String(btn.dataset.tmdbid),
                    title: btn.dataset.title,
                    type: 'series_season',
                    release_year: parseInt(btn.dataset.year) || null,
                    poster_url: btn.dataset.poster,
                    service_id: null,
                    mock_service: 'Recommended'
                };
                btn.textContent = "Adding...";
                btn.disabled = true;
                const { error } = await window.db.insertContentItem(payload);
                if (!error) {
                    if (!allContent.some(c => String(c.id) === String(payload.id))) {
                        allContent.push(payload);
                    }
                    await updateWatchState(payload.id, 'want_to_watch', null);
                    await fetchRecommendations();
                    renderAllSections();
                    showToast(`Added "${payload.title}" to your library!`, 'success');
                } else {
                    showToast("Error adding recommendation: " + error.message, 'error');
                    btn.textContent = "Error";
                    btn.disabled = false;
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

        // --- Admin / Modal Logic ---
        addShowsBtn.addEventListener('click', () => {
            addShowsModal.classList.remove('hidden');
        });
        
        closeAddShowsBtn.addEventListener('click', () => {
            addShowsModal.classList.add('hidden');
        });

        settingsBtn.addEventListener('click', async () => {
            settingsModal.classList.remove('hidden');
            const cloudKey = await window.db.getSystemSetting('tmdb_api_key');
            if (cloudKey) {
                tmdbApiKeyInput.value = cloudKey;
                localStorage.setItem('tmdb_api_key', cloudKey);
            } else {
                const savedKey = localStorage.getItem('tmdb_api_key');
                if (savedKey) tmdbApiKeyInput.value = savedKey;
            }
        });
        
        closeSettingsBtn.addEventListener('click', () => {
            settingsModal.classList.add('hidden');
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
                        settingsModal.classList.add('hidden');
                        fetchRecommendations(); // Trigger recs now that key exists
                        renderRecommendations();
                    }, 1000);
                }
            }
        });

        tmdbSearchBtn.addEventListener('click', async () => {
            const query = tmdbSearchQuery.value.trim();
            const key = await window.db.getSystemSetting('tmdb_api_key') || localStorage.getItem('tmdb_api_key');
            
            if (!key) {
                showToast("Please set your TMDB API Key in Settings first.", 'error');
                settingsModal.classList.remove('hidden');
                return;
            }
            if (!query) {
                showToast("Please enter a show title to search.", 'info');
                return;
            }

            tmdbSearchBtn.textContent = 'Searching...';
            tmdbSearchBtn.disabled = true;
            try {
                const res = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${key}&query=${encodeURIComponent(query)}`);
                if (!res.ok) {
                    showToast("TMDB search failed. Please verify your API Key in Settings.", 'error');
                } else {
                    const data = await res.json();
                    renderTmdbResults(data.results || []);
                }
            } catch (e) {
                console.error("TMDB Error", e);
                showToast("Failed to connect to TMDB: " + e.message, 'error');
            }
            tmdbSearchBtn.textContent = 'Search';
            tmdbSearchBtn.disabled = false;
        });

        // Custom Manual Add
        customAddBtn.addEventListener('click', async () => {
            const title = customTitle.value.trim();
            const poster = customPoster.value.trim() || 'https://via.placeholder.com/300x450/222/fff?text=' + encodeURIComponent(title);
            const service = customService.value;

            if (!title) {
                showToast("Please enter a title.", 'error');
                return;
            }

            const payload = {
                id: 'custom_' + Date.now(),
                title: title,
                type: 'series_season',
                release_year: new Date().getFullYear(),
                poster_url: poster,
                service_id: null,
                mock_service: service
            };

            customAddBtn.textContent = 'Adding...';
            customAddBtn.disabled = true;
            const { error } = await window.db.insertContentItem(payload);
            
            if (error) {
                showToast("Error adding show: " + error.message, 'error');
                customAddBtn.textContent = 'Add to Library';
                customAddBtn.disabled = false;
            } else {
                // Instantly update local in-memory catalog
                if (!allContent.some(c => String(c.id) === String(payload.id))) {
                    allContent.push(payload);
                }
                await updateWatchState(payload.id, 'want_to_watch', null);
                renderAllSections();

                customTitle.value = '';
                customPoster.value = '';
                customAddBtn.textContent = '✓ Added!';
                customAddBtn.style.background = 'var(--success-color)';
                showToast(`Added "${title}" to your library!`, 'success');
                
                setTimeout(() => {
                    customAddBtn.textContent = 'Add to Library';
                    customAddBtn.style.background = 'var(--accent-color)';
                    customAddBtn.disabled = false;
                }, 1500);
            }
        });
    }

    function renderTmdbResults(results) {
        tmdbResultsGrid.innerHTML = '';
        if (results.length === 0) {
            tmdbResultsGrid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1 / -1;">No matching shows found.</p>';
            return;
        }

        const serviceOptions = allServices.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

        results.slice(0, 12).forEach(item => {
            const poster = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://via.placeholder.com/300x450/111111/fff?text=No+Image';
            const year = item.first_air_date ? item.first_air_date.split('-')[0] : 'TBA';
            const cleanTitle = (item.name || 'Untitled').replace(/"/g, '&quot;');
            
            const card = document.createElement('div');
            card.className = 'tmdb-result-card';
            card.innerHTML = `
                <img src="${poster}" class="tmdb-poster" alt="${cleanTitle}" loading="lazy">
                <div class="tmdb-info">
                    <div class="tmdb-title">${item.name || 'Untitled'}</div>
                    <div class="tmdb-year">${year}</div>
                    
                    <label style="font-size: 0.8rem; margin-top: 5px;">Service</label>
                    <select class="admin-select-dropdown" id="service-${item.id}">
                        <option value="">None / Unknown</option>
                        ${serviceOptions}
                        <option value="youtube">YouTube TV</option>
                        <option value="netflix">Netflix</option>
                        <option value="disney">Disney+</option>
                        <option value="peacock">Peacock</option>
                        <option value="hulu">Hulu</option>
                        <option value="prime">Prime Video</option>
                    </select>

                    <button class="btn primary-btn add-supabase-btn" style="margin-top: 8px; width: 100%; font-size: 0.85rem;" data-tmdb-id="${item.id}" data-title="${cleanTitle}" data-year="${year}" data-poster="${poster}">+ Add to Library</button>
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
                const serviceId = serviceSelect?.value || '';
                const isCustomName = ['youtube', 'netflix', 'disney', 'peacock', 'hulu', 'prime'].includes(serviceId);

                btnEl.textContent = 'Adding...';
                btnEl.disabled = true;

                const payload = {
                    id: String(tmdbId),
                    title: title,
                    type: 'series_season',
                    release_year: parseInt(year) || null,
                    poster_url: poster,
                    service_id: isCustomName ? null : (serviceId || null),
                    mock_service: isCustomName ? serviceId : null
                };

                const { error } = await window.db.insertContentItem(payload);
                if (error) {
                    showToast("Error adding show: " + error.message, 'error');
                    btnEl.textContent = 'Failed';
                    btnEl.disabled = false;
                } else {
                    // Instantly update local in-memory catalog
                    if (!allContent.some(c => String(c.id) === String(payload.id))) {
                        allContent.push(payload);
                    }
                    await updateWatchState(payload.id, 'want_to_watch', null);
                    renderAllSections();

                    btnEl.textContent = '✓ Added!';
                    btnEl.style.background = 'var(--success-color)';
                    showToast(`Added "${title}" to your library!`, 'success');
                }
            });
        });
    }

    // Boot
    init();
});
