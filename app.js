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
    // State
    let currentUser = null;
    let allContent = [];
    let allServices = [];
    let userWatchlist = [];
    let recommendations = [];
    let currentView = 'library'; // 'library', 'recommendations', 'explore'
    let currentStatusFilter = 'all'; // 'all', 'watching', 'want_to_watch', 'completed'
    let currentLibraryServiceFilter = 'all'; // 'all', 'netflix', etc.
    let currentExploreService = 'netflix';
    let searchQuery = '';
    let isLoginMode = true;
    let currentDiscoveryService = null;
    let serviceCache = {};

    // DOM Elements - Main & Navigation
    const mainNav = document.getElementById('main-nav');
    const viewLibrary = document.getElementById('view-library');
    const viewRecommendations = document.getElementById('view-recommendations');
    const viewExplore = document.getElementById('view-explore');
    const libraryCountBadge = document.getElementById('library-count-badge');
    const libraryHeaderCount = document.getElementById('library-header-count');
    const recCountBadge = document.getElementById('rec-count-badge');

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
    
    // Library Section Elements
    const catalogGrid = document.getElementById('catalog-grid');
    const libraryStatusFilters = document.getElementById('library-status-filters');
    const libraryServiceFilters = document.getElementById('library-service-filters');
    const searchInput = document.getElementById('library-filter-field');
    const continueWatchingContainer = document.getElementById('continue-watching-container');
    const continueWatchingGrid = document.getElementById('continue-watching-grid');

    // Smart Recommendations Elements
    const tasteProfileBanner = document.getElementById('taste-profile-banner');
    const smartRecsContent = document.getElementById('smart-recs-content');

    // Explore / Discovery Section Elements
    const exploreServiceFilters = document.getElementById('explore-service-filters');
    const serviceDiscoveryContainer = document.getElementById('service-discovery-container');
    const serviceDiscoveryGrid = document.getElementById('service-discovery-grid');
    const serviceDiscoveryTitle = document.getElementById('service-discovery-title');
    const serviceDiscoverySubtitle = document.getElementById('service-discovery-subtitle');
    const quickServiceRow = document.getElementById('quick-service-row');

    const serviceMeta = {
        netflix: { name: 'Netflix', networkId: '213' },
        disney: { name: 'Disney+', networkId: '2739' },
        hulu: { name: 'Hulu', networkId: '453' },
        peacock: { name: 'Peacock', networkId: '3353' },
        prime: { name: 'Prime Video', networkId: '1024' },
        youtube: { name: 'YouTube TV', networkId: '247' }
    };

    // Curated Metadata & Genre Mapping for Smart Recommendation Analysis
    const SHOW_METADATA = {
        "66732": { genres: ["Sci-Fi & Fantasy", "Drama", "Mystery"], rating: 8.6, tags: ["supernatural", "80s", "monsters"] },
        "93405": { genres: ["Drama", "Mystery", "Action & Adventure"], rating: 8.4, tags: ["survival", "thriller", "dark"] },
        "119051": { genres: ["Comedy", "Sci-Fi & Fantasy", "Mystery"], rating: 8.1, tags: ["supernatural", "high school", "goth"] },
        "65494": { genres: ["Drama", "History"], rating: 8.6, tags: ["royalty", "politics", "biography"] },
        "69740": { genres: ["Crime", "Drama", "Mystery"], rating: 8.5, tags: ["money laundering", "cartel", "family"] },
        "87739": { genres: ["Drama"], rating: 8.5, tags: ["chess", "prodigy", "addiction"] },
        "42009": { genres: ["Sci-Fi & Fantasy", "Drama", "Mystery"], rating: 8.7, tags: ["technology", "dystopia", "anthology"] },
        "91239": { genres: ["Drama", "Romance"], rating: 8.2, tags: ["regency", "period", "romance"] },
        "76479": { genres: ["Action & Adventure", "Sci-Fi & Fantasy", "Drama"], rating: 8.0, tags: ["monsters", "magic", "fantasy"] },
        "1399": { genres: ["Drama", "Crime", "Thriller"], rating: 9.5, tags: ["chemistry", "cartel", "masterpiece"] },
        "82856": { genres: ["Sci-Fi & Fantasy", "Action & Adventure"], rating: 8.5, tags: ["star wars", "space", "bounty hunter"] },
        "85271": { genres: ["Sci-Fi & Fantasy", "Action & Adventure"], rating: 8.2, tags: ["marvel", "time travel", "multiverse"] },
        "85937": { genres: ["Sci-Fi & Fantasy", "Mystery", "Drama"], rating: 8.2, tags: ["marvel", "sitcom", "magic"] },
        "83867": { genres: ["Sci-Fi & Fantasy", "Action & Adventure", "Drama"], rating: 8.4, tags: ["star wars", "rebellion", "spy"] },
        "67070": { genres: ["Animation", "Kids", "Comedy"], rating: 9.0, tags: ["family", "wholesome", "parenting"] },
        "1404": { genres: ["Action & Adventure", "Sci-Fi & Fantasy", "Drama"], rating: 8.4, tags: ["marvel", "superhero", "gritty"] },
        "63247": { genres: ["Animation", "Sci-Fi & Fantasy", "Action & Adventure"], rating: 8.4, tags: ["star wars", "jedi", "animation"] },
        "108978": { genres: ["Action & Adventure", "Sci-Fi & Fantasy", "Comedy"], rating: 7.7, tags: ["marvel", "archer", "holiday"] },
        "57243": { genres: ["Sci-Fi & Fantasy", "Action & Adventure", "Drama"], rating: 7.3, tags: ["superhero", "marvel", "shield"] },
        "124364": { genres: ["Comedy", "Drama"], rating: 8.5, tags: ["kitchen", "family", "chicago", "culinary"] },
        "126308": { genres: ["Drama", "Action & Adventure", "History"], rating: 8.5, tags: ["japan", "samurai", "epic"] },
        "79242": { genres: ["Comedy", "Crime", "Mystery"], rating: 8.4, tags: ["podcast", "nyc", "murder"] },
        "70523": { genres: ["Drama", "Sci-Fi & Fantasy"], rating: 8.2, tags: ["dystopia", "totalitarian", "rebirth"] },
        "60059": { genres: ["Crime", "Drama", "Mystery"], rating: 8.9, tags: ["anthology", "midwest", "coen"] },
        "1433": { genres: ["Animation", "Comedy"], rating: 7.9, tags: ["cartoon", "humor", "family"] },
        "2710": { genres: ["Comedy"], rating: 8.8, tags: ["philly", "gang", "bar", "satire"] },
        "83631": { genres: ["Comedy", "Sci-Fi & Fantasy"], rating: 8.5, tags: ["vampires", "staten island", "mockumentary"] },
        "1400": { genres: ["Drama"], rating: 8.5, tags: ["advertising", "60s", "nyc"] },
        "1396": { genres: ["Drama", "Crime", "Mystery"], rating: 8.8, tags: ["drugs", "baltimore", "police", "street"] },
        "85552": { genres: ["Drama", "Western"], rating: 8.5, tags: ["ranch", "montana", "family empire"] },
        "106379": { genres: ["Mystery", "Comedy", "Crime"], rating: 7.9, tags: ["lie detector", "case of week", "columbo"] },
        "1418": { genres: ["Comedy"], rating: 8.6, tags: ["dunder mifflin", "mockumentary", "workplace"] },
        "46896": { genres: ["Comedy", "Crime"], rating: 8.5, tags: ["police", "detective", "99th precinct"] },
        "8592": { genres: ["Comedy"], rating: 8.5, tags: ["pawnee", "government", "waffles"] },
        "2190": { genres: ["Sci-Fi & Fantasy", "Drama"], rating: 8.3, tags: ["space", "cylons", "fleet"] },
        "1405": { genres: ["Crime", "Drama", "Mystery"], rating: 8.2, tags: ["miami", "serial killer", "blood"] },
        "1416": { genres: ["Drama"], rating: 8.3, tags: ["hospital", "doctors", "seattle"] },
        "76479_prime": { genres: ["Sci-Fi & Fantasy", "Action & Adventure"], rating: 8.5, tags: ["superheroes", "antihero", "vought"] },
        "92749": { genres: ["Drama", "Action & Adventure", "Crime"], rating: 8.1, tags: ["army", "drifter", "investigator"] },
        "106379_fallout": { genres: ["Sci-Fi & Fantasy", "Action & Adventure"], rating: 8.4, tags: ["post apocalyptic", "vault", "wasteland"] },
        "71914": { genres: ["Sci-Fi & Fantasy", "Action & Adventure"], rating: 7.7, tags: ["magic", "channeler", "epic"] },
        "60574": { genres: ["Drama", "Crime", "Mystery"], rating: 8.5, tags: ["lapd", "detective", "hollywood"] },
        "74204": { genres: ["Comedy", "Drama"], rating: 8.7, tags: ["standup", "50s", "nyc", "comedy"] },
        "84773": { genres: ["Animation", "Action & Adventure", "Sci-Fi & Fantasy"], rating: 8.7, tags: ["superhero", "omni man", "graphic"] },
        "67178": { genres: ["Sci-Fi & Fantasy", "Action & Adventure", "Drama"], rating: 8.5, tags: ["space", "politics", "ring"] },
        "73586": { genres: ["Drama", "Action & Adventure"], rating: 8.0, tags: ["cia", "analyst", "action"] },
        "76331": { genres: ["Sci-Fi & Fantasy", "Action & Adventure"], rating: 6.9, tags: ["middle earth", "elves", "sauron"] },
        "1911": { genres: ["Sci-Fi & Fantasy", "Drama", "Mystery"], rating: 8.3, tags: ["island", "smoke monster", "mystery", "plane crash"] },
        "1402": { genres: ["Drama", "Sci-Fi & Fantasy"], rating: 8.3, tags: ["zombies", "survival", "apocalypse"] },
        "65701": { genres: ["Comedy", "Talk"], rating: 8.0, tags: ["rhett and link", "games", "internet"] },
        "1667": { genres: ["Comedy"], rating: 7.0, tags: ["sketch", "live", "comedy"] },
        "60625": { genres: ["Animation", "Sci-Fi & Fantasy", "Comedy"], rating: 8.7, tags: ["multiverse", "scientist", "portal"] },
        "2912": { genres: ["News", "Family"], rating: 7.5, tags: ["trivia", "quiz", "game show"] }
    };

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

    // --- Navigation & View Switching ---
    function switchView(viewName, targetService = null) {
        currentView = viewName;

        // Update navigation tabs
        if (mainNav) {
            mainNav.querySelectorAll('.nav-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.view === viewName);
            });
        }

        // Update view containers
        if (viewLibrary) {
            viewLibrary.classList.toggle('active', viewName === 'library');
            viewLibrary.style.display = viewName === 'library' ? 'block' : 'none';
        }
        if (viewRecommendations) {
            viewRecommendations.classList.toggle('active', viewName === 'recommendations');
            viewRecommendations.style.display = viewName === 'recommendations' ? 'block' : 'none';
        }
        if (viewExplore) {
            viewExplore.classList.toggle('active', viewName === 'explore');
            viewExplore.style.display = viewName === 'explore' ? 'block' : 'none';
        }

        if (viewName === 'library') {
            renderContinueWatching();
            renderLibrary();
        } else if (viewName === 'recommendations') {
            renderSmartRecommendationsView();
        } else if (viewName === 'explore') {
            if (targetService) {
                currentExploreService = targetService;
                if (exploreServiceFilters) {
                    exploreServiceFilters.querySelectorAll('.pill-btn').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.service === targetService);
                    });
                }
            }
            renderServiceDiscovery(currentExploreService);
        }

        updateLibraryCounters();
    }
    window.switchView = switchView;

    // --- Render Logic ---
    function renderAllSections() {
        renderContinueWatching();
        renderLibrary();
        updateLibraryCounters();
        if (currentView === 'recommendations') {
            renderSmartRecommendationsView();
        } else if (currentView === 'explore') {
            renderServiceDiscovery(currentExploreService);
        }
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

    function renderLibrary() {
        if (!catalogGrid) return;
        catalogGrid.innerHTML = '';
        updateLibraryCounters();

        let filteredContent = [];
        try {
            filteredContent = allContent.filter(item => {
                if (!item) return false;
                const title = item.title || '';
                if (searchQuery && !title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                
                // Status Filter
                if (currentStatusFilter !== 'all') {
                    const idStr = String(item.id);
                    const tmdbIdStr = String(item.tmdb_id || item.id);
                    const watchData = userWatchlist.find(w => String(w.content_item_id) === idStr || String(w.content_item_id) === tmdbIdStr) || { status: 'none' };
                    if (watchData.status !== currentStatusFilter) return false;
                }

                // Provider Filter within Personal Library
                if (currentLibraryServiceFilter !== 'all') {
                    if (!matchesServiceFilter(item, currentLibraryServiceFilter)) return false;
                }

                return true;
            });
        } catch (e) {
            console.error("Filter error:", e);
            catalogGrid.innerHTML = `<p class="error-msg">Error filtering content: ${e.message}</p>`;
            return;
        }

        // Entire library is empty
        if (allContent.length === 0) {
            catalogGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: rgba(255,255,255,0.04); border-radius: 14px; margin-top: 10px; border: 1px dashed var(--border-subtle);">
                    <h2 style="margin-bottom: 12px; font-size: 1.85rem;">Your Library is Empty!</h2>
                    <p style="color: var(--text-muted); margin-bottom: 25px; font-size: 1.05rem; max-width: 520px; margin-left: auto; margin-right: auto;">Explore popular hits across streaming platforms, search TMDB, or discover smart recommendations to start building your personal watchlist.</p>
                    <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
                        <button class="btn primary-btn" style="font-size: 1rem; padding: 12px 24px;" onclick="document.getElementById('add-shows-btn').click()">+ Search & Add Shows</button>
                        <button class="btn secondary-btn" style="font-size: 1rem; padding: 12px 24px;" onclick="switchView('explore')">📺 Explore Streaming Services</button>
                    </div>
                </div>
            `;
            return;
        }

        // Filtered down to 0
        if (filteredContent.length === 0) {
            if (currentLibraryServiceFilter !== 'all') {
                const sName = serviceMeta[currentLibraryServiceFilter]?.name || currentLibraryServiceFilter;
                catalogGrid.innerHTML = `
                    <div class="library-empty-provider-card">
                        <h3>No ${sName} Shows in Your Library Yet</h3>
                        <p>You haven't added any ${sName} titles to your personal collection.</p>
                        <button class="btn primary-btn browse-explore-provider-btn" data-service="${currentLibraryServiceFilter}" style="padding: 10px 20px; font-size: 0.92rem;">
                            Browse ${sName} Catalog in Explore Streams →
                        </button>
                    </div>
                `;
            } else if (currentStatusFilter !== 'all') {
                const statusNames = { watching: 'Currently Watching', want_to_watch: 'Want to Watch', completed: 'Completed' };
                const stName = statusNames[currentStatusFilter] || currentStatusFilter;
                catalogGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px dashed var(--border-subtle);">
                        <p style="color: var(--text-muted); font-size: 1.05rem;">You have 0 shows marked as <strong>${stName}</strong>.</p>
                        <button class="btn secondary-btn" style="margin-top: 15px;" onclick="resetLibraryFilters()">View All Library Shows</button>
                    </div>
                `;
            } else {
                let reason = searchQuery ? ` matching "${searchQuery}"` : '';
                catalogGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px;">
                        <p class="skeleton-loader" style="margin-bottom: 15px;">No library content found${reason}.</p>
                        ${searchQuery ? `<button id="search-tmdb-fallback-btn" class="btn primary-btn" style="padding: 10px 20px; font-size: 0.95rem;">Search TMDB for "${searchQuery.replace(/"/g, '&quot;')}"</button>` : ''}
                    </div>
                `;
                const fallbackBtn = document.getElementById('search-tmdb-fallback-btn');
                if (fallbackBtn) {
                    fallbackBtn.addEventListener('click', () => {
                        addShowsModal.classList.remove('hidden');
                        tmdbSearchQuery.value = searchQuery;
                        tmdbSearchBtn.click();
                    });
                }
            }
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

    function resetLibraryFilters() {
        currentStatusFilter = 'all';
        currentLibraryServiceFilter = 'all';
        if (libraryStatusFilters) {
            libraryStatusFilters.querySelectorAll('.pill-btn').forEach(b => b.classList.toggle('active', b.dataset.status === 'all'));
        }
        if (libraryServiceFilters) {
            libraryServiceFilters.querySelectorAll('.pill-btn').forEach(b => b.classList.toggle('active', b.dataset.service === 'all'));
        }
        renderLibrary();
    }
    window.resetLibraryFilters = resetLibraryFilters;

    function updateLibraryCounters() {
        const total = allContent.length;
        const watching = userWatchlist.filter(w => w.status === 'watching').length;
        const want = userWatchlist.filter(w => w.status === 'want_to_watch').length;
        const completed = userWatchlist.filter(w => w.status === 'completed').length;

        if (libraryCountBadge) libraryCountBadge.textContent = total;
        if (libraryHeaderCount) libraryHeaderCount.textContent = `(${total} show${total === 1 ? '' : 's'})`;

        const cntAll = document.getElementById('count-status-all');
        const cntWatch = document.getElementById('count-status-watching');
        const cntWant = document.getElementById('count-status-want');
        const cntComp = document.getElementById('count-status-completed');

        if (cntAll) cntAll.textContent = total;
        if (cntWatch) cntWatch.textContent = watching;
        if (cntWant) cntWant.textContent = want;
        if (cntComp) cntComp.textContent = completed;

        // Provider counts
        ['netflix', 'disney', 'peacock', 'hulu', 'prime', 'youtube'].forEach(svc => {
            const el = document.getElementById(`svc-count-${svc}`);
            if (el) {
                const count = allContent.filter(item => matchesServiceFilter(item, svc)).length;
                el.textContent = count > 0 ? `(${count})` : '';
            }
        });

        // Recs badge in main nav
        if (recCountBadge) {
            recCountBadge.style.display = total >= 2 ? 'inline-block' : 'none';
        }
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

    async function fetchRecommendations() {
        if (currentView === 'recommendations') {
            renderSmartRecommendationsView();
        }
    }

    function renderRecommendations() {
        renderSmartRecommendationsView();
    }

    // --- Service Discovery Logic ---
    async function renderServiceDiscovery(service, forceRefresh = false) {
        if (!serviceDiscoveryContainer || !serviceDiscoveryGrid) return;

        if (!service || service === 'all') {
            serviceDiscoveryContainer.style.display = 'none';
            currentDiscoveryService = null;
            return;
        }

        const sMeta = serviceMeta[service] || { name: service.charAt(0).toUpperCase() + service.slice(1) };
        serviceDiscoveryContainer.style.display = 'block';

        if (serviceDiscoveryTitle) {
            serviceDiscoveryTitle.textContent = `Popular & Classic on ${sMeta.name}`;
        }
        if (serviceDiscoverySubtitle) {
            serviceDiscoverySubtitle.textContent = `Iconic hits and acclaimed classics available on ${sMeta.name}. Click any show or "+ Add" to add it to your library.`;
        }

        if (!forceRefresh && currentDiscoveryService === service) {
            updateDiscoveryInLibStatus();
            return;
        }

        currentDiscoveryService = service;

        let shows = serviceCache[service];
        if (!shows) {
            shows = (window.SERVICE_CATALOG && window.SERVICE_CATALOG[service]) 
                ? [...window.SERVICE_CATALOG[service]] 
                : [];
            serviceCache[service] = shows;
        }

        renderDiscoveryCards(shows, service);

        // Optionally augment with live TMDB Discover popular items if API key is present
        const cloudKey = await window.db.getSystemSetting('tmdb_api_key') || localStorage.getItem('tmdb_api_key');
        if (cloudKey && sMeta.networkId && !serviceCache[service + '_live']) {
            try {
                const res = await fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${cloudKey}&with_networks=${sMeta.networkId}&sort_by=popularity.desc&page=1`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.results && data.results.length > 0) {
                        const existingIds = new Set(shows.map(s => String(s.id)));
                        const newShows = [];
                        data.results.slice(0, 10).forEach(r => {
                            if (!existingIds.has(String(r.id))) {
                                newShows.push({
                                    id: String(r.id),
                                    title: r.name || 'Untitled',
                                    year: r.first_air_date ? r.first_air_date.split('-')[0] : 'TBA',
                                    poster: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null,
                                    overview: r.overview ? (r.overview.length > 95 ? r.overview.slice(0, 95) + '...' : r.overview) : ''
                                });
                            }
                        });
                        if (newShows.length > 0) {
                            shows = [...shows, ...newShows];
                            serviceCache[service] = shows;
                            serviceCache[service + '_live'] = true;
                            if (currentExploreService === service) {
                                renderDiscoveryCards(shows, service);
                            }
                        }
                    }
                }
            } catch (err) {
                console.warn("TMDB live discovery fetch error:", err);
            }
        }
    }

    function updateDiscoveryInLibStatus() {
        if (!serviceDiscoveryGrid) return;
        const cards = serviceDiscoveryGrid.querySelectorAll('.tmdb-result-card');
        cards.forEach(card => {
            const tmdbId = card.dataset.tmdbId;
            const title = card.dataset.title || '';
            const uuid = window.db?.toDeterministicUuid ? window.db.toDeterministicUuid(tmdbId) : tmdbId;
            const inLib = allContent.some(c => 
                String(c.id) === uuid || 
                String(c.tmdb_id) === tmdbId || 
                String(c.id) === tmdbId || 
                (c.title && c.title.toLowerCase() === title.toLowerCase())
            );
            const badge = card.querySelector('.tmdb-badge-in-lib, .tmdb-badge-add');
            const btn = card.querySelector('.add-discovery-btn');
            if (inLib) {
                card.classList.add('already-in-library');
                if (badge) {
                    badge.className = 'tmdb-badge-in-lib';
                    badge.textContent = '✓ In Library';
                }
                if (btn && btn.textContent !== '✓ Added!') {
                    btn.textContent = '✓ In Library';
                    btn.disabled = true;
                }
            } else {
                card.classList.remove('already-in-library');
                if (badge) {
                    badge.className = 'tmdb-badge-add';
                    badge.textContent = '+ Click to Add';
                }
                if (btn) {
                    btn.textContent = '+ Add to Library';
                    btn.style.background = '';
                    btn.disabled = false;
                }
            }
        });
    }

    function renderDiscoveryCards(shows, serviceId) {
        if (!serviceDiscoveryGrid) return;
        serviceDiscoveryGrid.innerHTML = '';

        if (!shows || shows.length === 0) {
            serviceDiscoveryGrid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1 / -1; padding: 20px 0; text-align: center;">No curated shows found for this service.</p>';
            return;
        }

        const sName = serviceMeta[serviceId]?.name || (serviceId ? serviceId.charAt(0).toUpperCase() + serviceId.slice(1) : 'Unknown');
        const fallbackPoster = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450' viewBox='0 0 300 450'%3E%3Crect width='300' height='450' fill='%231e1e1e'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666' font-family='sans-serif' font-size='16'%3ENo Poster%3C/text%3E%3C/svg%3E";

        shows.forEach(item => {
            const rawPoster = item.poster || item.poster_path;
            const poster = rawPoster ? (rawPoster.startsWith('http') ? rawPoster : `https://image.tmdb.org/t/p/w500${rawPoster}`) : fallbackPoster;
            const year = item.year || (item.first_air_date ? item.first_air_date.split('-')[0] : 'TBA');
            const showName = item.title || item.name || 'Untitled';
            const cleanTitle = showName.replace(/"/g, '&quot;');
            const overview = item.overview ? (item.overview.length > 95 ? item.overview.slice(0, 95) + '...' : item.overview) : '';

            const tmdbId = String(item.id);
            const uuid = window.db?.toDeterministicUuid ? window.db.toDeterministicUuid(tmdbId) : tmdbId;
            const isAlreadyInLib = allContent.some(c => 
                String(c.id) === uuid || 
                String(c.tmdb_id) === tmdbId || 
                String(c.id) === tmdbId || 
                (c.title && c.title.toLowerCase() === showName.toLowerCase())
            );

            const card = document.createElement('div');
            card.className = `tmdb-result-card ${isAlreadyInLib ? 'already-in-library' : ''}`;
            card.dataset.tmdbId = tmdbId;
            card.dataset.title = showName;
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('title', `Click to add "${cleanTitle}" to your library`);

            card.innerHTML = `
                <div class="tmdb-poster-container">
                    <img src="${poster}" class="tmdb-poster" alt="${cleanTitle}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackPoster}';">
                    ${isAlreadyInLib ? '<span class="tmdb-badge-in-lib">✓ In Library</span>' : '<span class="tmdb-badge-add">+ Click to Add</span>'}
                </div>
                <div class="tmdb-info">
                    <div class="tmdb-title" title="${cleanTitle}">${showName}</div>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                        <span class="tmdb-year">${year}</span>
                        <span class="card-service-badge" style="position: static; font-size: 0.7rem; padding: 2px 6px;">${sName}</span>
                    </div>
                    ${overview ? `<div class="tmdb-overview">${overview}</div>` : ''}
                    <button class="btn primary-btn add-discovery-btn" style="margin-top: auto; width: 100%; font-size: 0.85rem;" data-tmdb-id="${item.id}" data-title="${cleanTitle}">
                        ${isAlreadyInLib ? '✓ In Library' : '+ Add to Library'}
                    </button>
                </div>
            `;

            const handleAddShow = async (btnEl) => {
                if (card.classList.contains('adding')) return;

                const currentInLib = allContent.some(c => 
                    String(c.id) === uuid || 
                    String(c.tmdb_id) === tmdbId || 
                    String(c.id) === tmdbId ||
                    (c.title && c.title.toLowerCase() === showName.toLowerCase())
                );
                if (currentInLib) {
                    showToast(`"${showName}" is already in your library!`, 'info');
                    return;
                }

                card.classList.add('adding');
                if (btnEl) {
                    btnEl.textContent = 'Adding...';
                    btnEl.disabled = true;
                }

                const payload = {
                    id: uuid,
                    tmdb_id: tmdbId,
                    title: showName,
                    type: 'series_season',
                    release_year: parseInt(year) || null,
                    poster_url: poster,
                    streaming_service_id: null,
                    mock_service: sName
                };

                const { data, error } = await window.db.insertContentItem(payload);
                if (error) {
                    showToast("Error adding show: " + error.message, 'error');
                    if (btnEl) {
                        btnEl.textContent = 'Failed';
                        btnEl.disabled = false;
                    }
                    card.classList.remove('adding');
                } else {
                    const savedItem = (data && data[0]) ? data[0] : payload;
                    if (!allContent.some(c => String(c.id) === String(savedItem.id))) {
                        allContent.push(savedItem);
                    }
                    await updateWatchState(savedItem.id, 'want_to_watch', null);

                    card.classList.remove('adding');
                    card.classList.add('already-in-library');
                    if (btnEl) {
                        btnEl.textContent = '✓ Added!';
                        btnEl.style.background = 'var(--success-color)';
                        btnEl.disabled = true;
                    }
                    const badge = card.querySelector('.tmdb-badge-add');
                    if (badge) {
                        badge.className = 'tmdb-badge-in-lib';
                        badge.textContent = '✓ In Library';
                    }
                    showToast(`Added "${payload.title}" to your library!`, 'success');
                }
            };

            card.addEventListener('click', (e) => {
                const btnEl = card.querySelector('.add-discovery-btn');
                handleAddShow(btnEl);
            });

            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const btnEl = card.querySelector('.add-discovery-btn');
                    handleAddShow(btnEl);
                }
            });

            serviceDiscoveryGrid.appendChild(card);
        });
    }

    // --- Smart Multi-Vector Recommendation Engine ---
    function inferGenresFromTitleAndOverview(title = '', overview = '') {
        const text = (title + ' ' + overview).toLowerCase();
        const detected = [];
        if (/space|star|sci-fi|alien|planet|future|tech|cyborg|quantum|supernatural|robot|multiverse|magic|jedi/.test(text)) detected.push("Sci-Fi & Fantasy");
        if (/detective|police|crime|cartel|murder|kill|investigat|drugs|fbi|mafia|lawyer|gang/.test(text)) detected.push("Crime");
        if (/funny|laugh|comedy|sitcom|satire|humor|sketch|parody/.test(text)) detected.push("Comedy");
        if (/mystery|secret|vanish|disappear|puzzle|conspiracy|island|smoke/.test(text)) detected.push("Mystery");
        if (/action|hero|mission|war|fight|soldier|spy|agent|battle|superhero/.test(text)) detected.push("Action & Adventure");
        if (/animated|cartoon|anime/.test(text)) detected.push("Animation");
        if (/history|period|regency|monarch|queen|king|emperor|samurai/.test(text)) detected.push("History");
        if (detected.length === 0) detected.push("Drama");
        return detected;
    }

    function computeTasteProfile() {
        const genreScores = {};
        const serviceCounts = {};
        let watchingCount = 0;
        let likedCount = 0;
        const positiveSeeds = [];

        allContent.forEach(item => {
            const idStr = String(item.id);
            const tmdbIdStr = String(item.tmdb_id || item.id);
            const watchData = userWatchlist.find(w => String(w.content_item_id) === idStr || String(w.content_item_id) === tmdbIdStr) || { status: 'none', rating: null };
            
            let weight = 1.0;
            if (watchData.status === 'completed' && watchData.rating === 'thumbs_up') {
                weight = 4.0;
                likedCount++;
                positiveSeeds.push(item);
            } else if (watchData.status === 'watching') {
                weight = 3.0;
                watchingCount++;
                positiveSeeds.push(item);
            } else if (watchData.status === 'want_to_watch') {
                weight = 1.8;
            } else if (watchData.status === 'completed') {
                weight = 1.2;
            } else if (watchData.status === 'dropped' || watchData.rating === 'thumbs_down') {
                weight = -4.0;
            }

            // Detect service
            const rawSvc = (item.streaming_services?.name || item.mock_service || '').toLowerCase();
            for (const key of ['netflix', 'disney', 'hulu', 'peacock', 'prime', 'youtube']) {
                if (rawSvc.includes(key)) {
                    serviceCounts[key] = (serviceCounts[key] || 0) + 1;
                    break;
                }
            }

            // Map genres from SHOW_METADATA or keyword heuristics
            const meta = SHOW_METADATA[tmdbIdStr] || SHOW_METADATA[idStr];
            let genres = meta?.genres;
            if (!genres) {
                genres = inferGenresFromTitleAndOverview(item.title, item.overview || '');
            }

            genres.forEach(g => {
                genreScores[g] = (genreScores[g] || 0) + weight;
            });
        });

        const sortedGenres = Object.entries(genreScores)
            .filter(([_, score]) => score > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([genre]) => genre);

        const topServiceKey = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        const topServiceName = topServiceKey ? (serviceMeta[topServiceKey]?.name || topServiceKey) : 'Multi-Service';

        return {
            topGenres: sortedGenres.slice(0, 4),
            totalCount: allContent.length,
            watchingCount,
            likedCount,
            topService: topServiceName,
            positiveSeeds
        };
    }

    function generateSmartRecommendationsList(profile) {
        const catalogItems = [];
        if (window.SERVICE_CATALOG) {
            Object.entries(window.SERVICE_CATALOG).forEach(([svcKey, shows]) => {
                shows.forEach(show => {
                    catalogItems.push({
                        ...show,
                        serviceKey: svcKey,
                        serviceName: serviceMeta[svcKey]?.name || svcKey
                    });
                });
            });
        }

        // Filter out shows already in allContent
        const existingIds = new Set(allContent.map(c => String(c.id)));
        const existingTmdbIds = new Set(allContent.map(c => String(c.tmdb_id)).filter(Boolean));
        const existingTitles = new Set(allContent.map(c => (c.title || '').toLowerCase().trim()));

        const candidates = catalogItems.filter(item => {
            const uuid = window.db?.toDeterministicUuid ? window.db.toDeterministicUuid(String(item.id)) : String(item.id);
            if (existingIds.has(String(item.id)) || existingIds.has(uuid)) return false;
            if (existingTmdbIds.has(String(item.id))) return false;
            if (existingTitles.has((item.title || '').toLowerCase().trim())) return false;
            return true;
        });

        // If library is empty or < 2 shows: return starter curated gateway picks
        if (profile.totalCount < 2) {
            return candidates.slice(0, 10).map(c => ({
                ...c,
                reason: '🌟 Gateway Classic',
                rating: SHOW_METADATA[String(c.id)]?.rating || 8.4
            }));
        }

        // Score each candidate
        const scored = candidates.map(c => {
            let score = 0;
            const meta = SHOW_METADATA[String(c.id)] || { genres: inferGenresFromTitleAndOverview(c.title, c.overview), rating: 8.0, tags: [] };
            const candidateGenres = meta.genres || [];
            const candidateTags = meta.tags || [];

            // Genre synergy
            candidateGenres.forEach(g => {
                const idx = profile.topGenres.indexOf(g);
                if (idx === 0) score += 9; // Top favorite genre
                else if (idx === 1) score += 6;
                else if (idx >= 2) score += 3;
            });

            // Seed show similarity
            let bestSeedMatch = null;
            profile.positiveSeeds.forEach(seed => {
                const seedMeta = SHOW_METADATA[String(seed.tmdb_id || seed.id)] || { genres: inferGenresFromTitleAndOverview(seed.title), tags: [] };
                const sharedGenres = candidateGenres.filter(g => seedMeta.genres.includes(g));
                const sharedTags = candidateTags.filter(t => (seedMeta.tags || []).includes(t));
                if (sharedGenres.length >= 2 || sharedTags.length >= 1) {
                    score += 7;
                    if (!bestSeedMatch) bestSeedMatch = seed;
                }
            });

            // Provider synergy
            if (c.serviceName === profile.topService) {
                score += 3;
            }

            // Quality score from rating
            score += (meta.rating || 8.0);

            // Contextual rationale badge
            let reason = '⭐ Highly Recommended';
            if (bestSeedMatch) {
                reason = `✨ Because you watched ${bestSeedMatch.title}`;
            } else if (candidateGenres.some(g => g === profile.topGenres[0])) {
                reason = `🔥 Top Pick in ${profile.topGenres[0]}`;
            } else if (candidateGenres.some(g => g === profile.topGenres[1])) {
                reason = `🎯 Recommended in ${profile.topGenres[1]}`;
            } else if (c.serviceName === profile.topService) {
                reason = `📺 Acclaimed on ${c.serviceName}`;
            }

            return {
                ...c,
                score,
                reason,
                rating: meta.rating || 8.2
            };
        });

        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, 18);
    }

    function renderSmartRecommendationsView() {
        if (!smartRecsContent) return;
        const profile = computeTasteProfile();

        // Render Taste Profile Banner
        if (tasteProfileBanner) {
            tasteProfileBanner.innerHTML = `
                <div class="taste-profile-header">
                    <div class="taste-profile-title">
                        <span>🧠 Your Entertainment Taste Profile</span>
                    </div>
                    <div class="genre-tag-list">
                        ${profile.topGenres.length > 0 
                            ? profile.topGenres.map(g => `<span class="genre-chip">${g}</span>`).join('') 
                            : '<span class="genre-chip" style="opacity: 0.7;">Building Taste Profile...</span>'}
                    </div>
                </div>
                <div class="taste-metrics-row">
                    <div class="taste-metric">
                        <span class="taste-metric-val">${profile.totalCount}</span>
                        <span class="taste-metric-label">Shows in Library</span>
                    </div>
                    <div class="taste-metric">
                        <span class="taste-metric-val">${profile.watchingCount}</span>
                        <span class="taste-metric-label">Currently Watching</span>
                    </div>
                    <div class="taste-metric">
                        <span class="taste-metric-val">${profile.likedCount}</span>
                        <span class="taste-metric-label">Favorited (👍)</span>
                    </div>
                    <div class="taste-metric">
                        <span class="taste-metric-val">${profile.topService}</span>
                        <span class="taste-metric-label">Primary Service</span>
                    </div>
                </div>
            `;
        }

        // Generate recommendations
        const recList = generateSmartRecommendationsList(profile);

        if (recList.length === 0) {
            smartRecsContent.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px dashed var(--border-subtle);">
                    <h3 style="margin-bottom: 8px;">You're All Caught Up!</h3>
                    <p style="color: var(--text-muted);">You've added all top catalog shows to your library. Search TMDB in "+ Add Shows" to discover even more titles.</p>
                </div>
            `;
            return;
        }

        let headerNote = '';
        if (profile.totalCount < 2) {
            headerNote = `
                <div style="margin-bottom: 20px; padding: 14px 18px; background: rgba(0, 195, 255, 0.08); border: 1px solid rgba(0, 195, 255, 0.25); border-radius: 10px;">
                    <p style="font-size: 0.95rem; color: var(--text-main); margin: 0;">
                        💡 <strong>Welcome to Smart Recommendations!</strong> As your library grows and you rate favorites with a Thumbs Up (👍), our intelligent engine automatically tailors these picks to your exact genres and habits. Here are acclaimed gateway hits across genres to kickstart your collection:
                    </p>
                </div>
            `;
        } else {
            headerNote = `
                <div style="margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <h3 style="font-size: 1.25rem; color: var(--text-main); margin: 0;">🎯 Top Personalized Picks for You</h3>
                    <span style="font-size: 0.82rem; color: var(--text-muted);">Ranked by genre synergy, viewing status & acclaim</span>
                </div>
            `;
        }

        smartRecsContent.innerHTML = headerNote + `<div class="tmdb-results" id="smart-recs-grid"></div>`;
        const grid = document.getElementById('smart-recs-grid');
        if (grid) {
            recList.forEach(item => {
                grid.appendChild(createSmartRecCard(item));
            });
        }
    }

    function createSmartRecCard(item) {
        const fallbackPoster = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450' viewBox='0 0 300 450'%3E%3Crect width='300' height='450' fill='%231e1e1e'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666' font-family='sans-serif' font-size='16'%3ENo Poster%3C/text%3E%3C/svg%3E";
        const poster = item.poster || fallbackPoster;
        const cleanTitle = (item.title || 'Untitled').replace(/"/g, '&quot;');
        const year = item.year || 'TBA';
        const rating = item.rating || 8.0;
        const serviceName = item.serviceName || 'Streaming';
        const overview = item.overview ? (item.overview.length > 95 ? item.overview.slice(0, 95) + '...' : item.overview) : '';

        const tmdbId = String(item.id);
        const uuid = window.db?.toDeterministicUuid ? window.db.toDeterministicUuid(tmdbId) : tmdbId;
        const isAlreadyInLib = allContent.some(c => 
            String(c.id) === uuid || 
            String(c.tmdb_id) === tmdbId || 
            String(c.id) === tmdbId || 
            (c.title && c.title.toLowerCase() === (item.title || '').toLowerCase())
        );

        const card = document.createElement('div');
        card.className = `tmdb-result-card ${isAlreadyInLib ? 'already-in-library' : ''}`;
        card.dataset.tmdbId = tmdbId;
        card.dataset.title = item.title || '';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('title', `Click to add "${cleanTitle}" to your library`);

        card.innerHTML = `
            <div class="tmdb-poster-container">
                <img src="${poster}" class="tmdb-poster" alt="${cleanTitle}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackPoster}';">
                ${isAlreadyInLib ? '<span class="tmdb-badge-in-lib">✓ In Library</span>' : '<span class="tmdb-badge-add">+ Click to Add</span>'}
            </div>
            <div class="tmdb-info">
                <span class="rec-reason-badge">${item.reason}</span>
                <div class="tmdb-title" title="${cleanTitle}">${item.title}</div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                    <span class="tmdb-year">${year} • ★ ${rating}</span>
                    <span class="card-service-badge" style="position: static; font-size: 0.7rem; padding: 2px 6px;">${serviceName}</span>
                </div>
                ${overview ? `<div class="tmdb-overview">${overview}</div>` : ''}
                <button class="btn primary-btn add-smart-rec-btn" style="margin-top: auto; width: 100%; font-size: 0.85rem;" data-tmdb-id="${item.id}" data-title="${cleanTitle}">
                    ${isAlreadyInLib ? '✓ In Library' : '+ Add to Library'}
                </button>
            </div>
        `;

        const handleAdd = async (btnEl) => {
            if (card.classList.contains('adding')) return;

            const currentInLib = allContent.some(c => 
                String(c.id) === uuid || 
                String(c.tmdb_id) === tmdbId || 
                String(c.id) === tmdbId ||
                (c.title && c.title.toLowerCase() === (item.title || '').toLowerCase())
            );
            if (currentInLib) {
                showToast(`"${item.title}" is already in your library!`, 'info');
                return;
            }

            card.classList.add('adding');
            if (btnEl) {
                btnEl.textContent = 'Adding...';
                btnEl.disabled = true;
            }

            const payload = {
                id: uuid,
                tmdb_id: tmdbId,
                title: item.title,
                type: 'series_season',
                release_year: parseInt(year) || null,
                poster_url: poster,
                streaming_service_id: null,
                mock_service: serviceName
            };

            const { data, error } = await window.db.insertContentItem(payload);
            if (error) {
                showToast("Error adding show: " + error.message, 'error');
                if (btnEl) {
                    btnEl.textContent = 'Failed';
                    btnEl.disabled = false;
                }
                card.classList.remove('adding');
            } else {
                const savedItem = (data && data[0]) ? data[0] : payload;
                if (!allContent.some(c => String(c.id) === String(savedItem.id))) {
                    allContent.push(savedItem);
                }
                await updateWatchState(savedItem.id, 'want_to_watch', null);

                card.classList.remove('adding');
                card.classList.add('already-in-library');
                if (btnEl) {
                    btnEl.textContent = '✓ Added!';
                    btnEl.style.background = 'var(--success-color)';
                    btnEl.disabled = true;
                }
                const badge = card.querySelector('.tmdb-badge-add');
                if (badge) {
                    badge.className = 'tmdb-badge-in-lib';
                    badge.textContent = '✓ In Library';
                }
                updateLibraryCounters();
                showToast(`Added "${payload.title}" to your library!`, 'success');
            }
        };

        card.addEventListener('click', (e) => {
            const btnEl = card.querySelector('.add-smart-rec-btn');
            handleAdd(btnEl);
        });

        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const btnEl = card.querySelector('.add-smart-rec-btn');
                handleAdd(btnEl);
            }
        });

        return card;
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
            // Browse provider catalog in Explore view from empty library state
            if (e.target.closest('.browse-explore-provider-btn')) {
                const btn = e.target.closest('.browse-explore-provider-btn');
                const targetService = btn.dataset.service;
                switchView('explore', targetService);
                return;
            }
        });

        // Main View Navigation (Library, Smart Recommendations, Explore Services)
        if (mainNav) {
            mainNav.addEventListener('click', (e) => {
                const tab = e.target.closest('.nav-tab');
                if (!tab) return;
                const viewName = tab.dataset.view;
                if (viewName) {
                    switchView(viewName);
                }
            });
        }

        // Personal Library Status Filters (All, Watching, Want to Watch, Completed)
        if (libraryStatusFilters) {
            libraryStatusFilters.addEventListener('click', (e) => {
                const pill = e.target.closest('.pill-btn');
                if (!pill) return;
                libraryStatusFilters.querySelectorAll('.pill-btn').forEach(btn => btn.classList.remove('active'));
                pill.classList.add('active');
                currentStatusFilter = pill.dataset.status || 'all';
                renderLibrary();
            });
        }

        // Personal Library Provider Filters (All, Netflix, Disney+, etc.)
        if (libraryServiceFilters) {
            libraryServiceFilters.addEventListener('click', (e) => {
                const pill = e.target.closest('.pill-btn');
                if (!pill) return;
                libraryServiceFilters.querySelectorAll('.pill-btn').forEach(btn => btn.classList.remove('active'));
                pill.classList.add('active');
                currentLibraryServiceFilter = pill.dataset.service || 'all';
                renderLibrary();
            });
        }

        // Explore Streaming Services Filters (Netflix, Disney+, Hulu, Peacock, Prime, YouTube TV)
        if (exploreServiceFilters) {
            exploreServiceFilters.addEventListener('click', (e) => {
                const pill = e.target.closest('.pill-btn');
                if (!pill) return;
                exploreServiceFilters.querySelectorAll('.pill-btn').forEach(btn => btn.classList.remove('active'));
                pill.classList.add('active');
                currentExploreService = pill.dataset.service || 'netflix';
                renderServiceDiscovery(currentExploreService);
            });
        }

        // Personal Library Search Input
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                renderLibrary();
            });
        }

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

        // Trigger search on Enter key press
        tmdbSearchQuery.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                tmdbSearchBtn.click();
            }
        });

        // Quick browse buttons in Add Shows modal
        if (quickServiceRow) {
            quickServiceRow.addEventListener('click', (e) => {
                const btn = e.target.closest('.quick-browse-btn');
                if (!btn) return;
                quickServiceRow.querySelectorAll('.quick-browse-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const serviceKey = btn.dataset.service;
                const shows = (window.SERVICE_CATALOG && window.SERVICE_CATALOG[serviceKey]) ? window.SERVICE_CATALOG[serviceKey] : [];
                renderTmdbResults(shows, serviceKey);
            });
        }

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
                streaming_service_id: null,
                mock_service: service
            };

            customAddBtn.textContent = 'Adding...';
            customAddBtn.disabled = true;
            const { data, error } = await window.db.insertContentItem(payload);
            
            if (error) {
                showToast("Error adding show: " + error.message, 'error');
                customAddBtn.textContent = 'Add to Library';
                customAddBtn.disabled = false;
            } else {
                const savedItem = (data && data[0]) ? data[0] : payload;
                if (!allContent.some(c => String(c.id) === String(savedItem.id))) {
                    allContent.push(savedItem);
                }
                await updateWatchState(savedItem.id, 'want_to_watch', null);
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

    function renderTmdbResults(results, defaultService = '') {
        tmdbResultsGrid.innerHTML = '';
        if (results.length === 0) {
            tmdbResultsGrid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1 / -1; padding: 20px 0; text-align: center;">No matching shows found on TMDB.</p>';
            return;
        }

        const serviceOptions = allServices.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        const fallbackPoster = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450' viewBox='0 0 300 450'%3E%3Crect width='300' height='450' fill='%231e1e1e'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666' font-family='sans-serif' font-size='16'%3ENo Poster%3C/text%3E%3C/svg%3E";

        results.slice(0, 24).forEach(item => {
            const rawPoster = item.poster || item.poster_path;
            const poster = rawPoster ? (rawPoster.startsWith('http') ? rawPoster : `https://image.tmdb.org/t/p/w500${rawPoster}`) : fallbackPoster;
            const year = item.year || (item.first_air_date ? item.first_air_date.split('-')[0] : 'TBA');
            const showName = item.name || item.title || 'Untitled';
            const cleanTitle = showName.replace(/"/g, '&quot;');
            const overview = item.overview ? (item.overview.length > 95 ? item.overview.slice(0, 95) + '...' : item.overview) : '';
            const initialService = item.service || defaultService || '';
            
            const tmdbId = String(item.id);
            const uuid = window.db?.toDeterministicUuid ? window.db.toDeterministicUuid(tmdbId) : tmdbId;
            const isAlreadyInLib = allContent.some(c => String(c.id) === uuid || String(c.tmdb_id) === tmdbId || String(c.id) === tmdbId || (c.title && c.title.toLowerCase() === showName.toLowerCase()));

            const card = document.createElement('div');
            card.className = `tmdb-result-card ${isAlreadyInLib ? 'already-in-library' : ''}`;
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('title', `Click to add "${cleanTitle}" to your library`);

            card.innerHTML = `
                <div class="tmdb-poster-container">
                    <img src="${poster}" class="tmdb-poster" alt="${cleanTitle}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackPoster}';">
                    ${isAlreadyInLib ? '<span class="tmdb-badge-in-lib">✓ In Library</span>' : '<span class="tmdb-badge-add">+ Click to Add</span>'}
                </div>
                <div class="tmdb-info">
                    <div class="tmdb-title" title="${cleanTitle}">${showName}</div>
                    <div class="tmdb-year">${year}</div>
                    ${overview ? `<div class="tmdb-overview">${overview}</div>` : ''}
                    
                    <div class="tmdb-service-row" onclick="event.stopPropagation();">
                        <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Service</label>
                        <select class="admin-select-dropdown" id="service-${item.id}">
                            <option value="">None / Unknown</option>
                            ${serviceOptions}
                            <option value="youtube" ${initialService === 'youtube' ? 'selected' : ''}>YouTube TV</option>
                            <option value="netflix" ${initialService === 'netflix' ? 'selected' : ''}>Netflix</option>
                            <option value="disney" ${initialService === 'disney' ? 'selected' : ''}>Disney+</option>
                            <option value="peacock" ${initialService === 'peacock' ? 'selected' : ''}>Peacock</option>
                            <option value="hulu" ${initialService === 'hulu' ? 'selected' : ''}>Hulu</option>
                            <option value="prime" ${initialService === 'prime' ? 'selected' : ''}>Prime Video</option>
                        </select>
                    </div>

                    <button class="btn primary-btn add-supabase-btn" style="margin-top: auto; width: 100%; font-size: 0.85rem;" data-tmdb-id="${item.id}" data-title="${cleanTitle}" data-year="${year}" data-poster="${poster}">
                        ${isAlreadyInLib ? '✓ In Library' : '+ Add to Library'}
                    </button>
                </div>
            `;

            const handleAddShow = async (btnEl) => {
                if (card.classList.contains('adding')) return;

                const currentInLib = allContent.some(c => String(c.id) === uuid || String(c.tmdb_id) === tmdbId || String(c.id) === tmdbId || (c.title && c.title.toLowerCase() === showName.toLowerCase()));
                if (currentInLib) {
                    showToast(`"${showName}" is already in your library!`, 'info');
                    return;
                }

                card.classList.add('adding');
                if (btnEl) {
                    btnEl.textContent = 'Adding...';
                    btnEl.disabled = true;
                }

                const serviceSelect = document.getElementById(`service-${item.id}`);
                const serviceId = serviceSelect?.value || initialService || '';
                const isCustomName = ['youtube', 'netflix', 'disney', 'peacock', 'hulu', 'prime'].includes(serviceId);

                const payload = {
                    id: uuid,
                    tmdb_id: tmdbId,
                    title: showName,
                    type: 'series_season',
                    release_year: parseInt(year) || null,
                    poster_url: poster,
                    streaming_service_id: isCustomName ? null : (serviceId || null),
                    mock_service: isCustomName ? (serviceMeta[serviceId]?.name || serviceId) : null
                };

                const { data, error } = await window.db.insertContentItem(payload);
                if (error) {
                    showToast("Error adding show: " + error.message, 'error');
                    if (btnEl) {
                        btnEl.textContent = 'Failed';
                        btnEl.disabled = false;
                    }
                    card.classList.remove('adding');
                } else {
                    const savedItem = (data && data[0]) ? data[0] : payload;
                    if (!allContent.some(c => String(c.id) === String(savedItem.id))) {
                        allContent.push(savedItem);
                    }
                    await updateWatchState(savedItem.id, 'want_to_watch', null);
                    renderAllSections();

                    card.classList.remove('adding');
                    card.classList.add('already-in-library');
                    if (btnEl) {
                        btnEl.textContent = '✓ Added!';
                        btnEl.style.background = 'var(--success-color)';
                        btnEl.disabled = true;
                    }
                    const badge = card.querySelector('.tmdb-badge-add');
                    if (badge) {
                        badge.className = 'tmdb-badge-in-lib';
                        badge.textContent = '✓ In Library';
                    }
                    showToast(`Added "${payload.title}" to your library!`, 'success');
                }
            };

            card.addEventListener('click', (e) => {
                if (e.target.tagName === 'SELECT' || e.target.tagName === 'OPTION' || e.target.closest('.tmdb-service-row')) {
                    return;
                }
                const btnEl = card.querySelector('.add-supabase-btn');
                handleAddShow(btnEl);
            });

            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    if (e.target.tagName === 'SELECT') return;
                    e.preventDefault();
                    const btnEl = card.querySelector('.add-supabase-btn');
                    handleAddShow(btnEl);
                }
            });

            tmdbResultsGrid.appendChild(card);
        });
    }

    // Boot
    init();
});
