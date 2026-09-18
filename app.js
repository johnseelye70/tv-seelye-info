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
    let tasteQuizAnswers = JSON.parse(localStorage.getItem('tv_taste_quiz_answers') || 'null');
    let isQuizActive = false;
    let currentQuizStep = 0;
    let quizDraftAnswers = {};

    // DOM Elements - Main & Navigation
    const mainNav = document.getElementById('main-nav');
    const viewLibrary = document.getElementById('view-library');
    const viewRecommendations = document.getElementById('view-recommendations');
    const viewExplore = document.getElementById('view-explore');
    const viewChangelog = document.getElementById('view-changelog');
    const viewShowTracker = document.getElementById('view-show-tracker');
    const viewRemote = document.getElementById('view-remote');
    const remoteHeaderBtn = document.getElementById('remote-header-btn');
    const showTrackerContent = document.getElementById('show-tracker-content');
    const trackerBackBtn = document.getElementById('tracker-back-btn');
    const crumbLibraryLink = document.getElementById('crumb-library-link');
    const trackerCrumbTitle = document.getElementById('tracker-crumb-title');
    const versionBtn = document.getElementById('version-btn');
    const closeChangelogBtn = document.getElementById('close-changelog-btn');
    const libraryCountBadge = document.getElementById('library-count-badge');
    const libraryHeaderCount = document.getElementById('library-header-count');
    const recCountBadge = document.getElementById('rec-count-badge');

    let currentTrackerShow = null;
    let currentTrackerSeason = 1;
    let activeVideoEpisodeKey = null;
    const episodeVideosCache = {};

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
    const mobileStatusSelect = document.getElementById('mobile-status-select');
    const mobileServiceSelect = document.getElementById('mobile-service-select');
    const mobileExploreSelect = document.getElementById('mobile-explore-select');
    const searchInput = document.getElementById('library-filter-field');
    const continueWatchingContainer = document.getElementById('continue-watching-container');
    const continueWatchingGrid = document.getElementById('continue-watching-grid');

    // Smart Recommendations Elements
    const tasteQuizContainer = document.getElementById('taste-quiz-container');
    const tasteProfileBanner = document.getElementById('taste-profile-banner');
    const smartRecsContent = document.getElementById('smart-recs-content');

    // Explore / Discovery Section Elements
    const exploreServiceFilters = document.getElementById('explore-service-filters');
    const serviceDiscoveryContainer = document.getElementById('service-discovery-container');
    const serviceDiscoveryGrid = document.getElementById('service-discovery-grid');
    const serviceDiscoveryTitle = document.getElementById('service-discovery-title');
    const serviceDiscoverySubtitle = document.getElementById('service-discovery-subtitle');
    const quickServiceRow = document.getElementById('quick-service-row');
    const imdbModal = document.getElementById('imdb-modal');
    const closeImdbModalBtn = document.getElementById('close-imdb-modal-btn');
    const imdbModalBody = document.getElementById('imdb-modal-body');

    const serviceMeta = {
        netflix: { name: 'Netflix', networkId: '213' },
        disney: { name: 'Disney+', networkId: '2739' },
        hulu: { name: 'Hulu', networkId: '453' },
        peacock: { name: 'Peacock', networkId: '3353' },
        prime: { name: 'Prime Video', networkId: '1024' },
        youtube: { name: 'YouTube TV', networkId: '247' },
        appletv: { name: 'Apple TV+', networkId: '2552' }
    };

    // --- Smart Multi-Vector Recommendation Engine & Heuristics ---
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

    // Curated Metadata & Strict Category / Tone Mapping for Smart Recommendation Analysis
    const SHOW_METADATA = {
        // --- NETFLIX ---
        '66732': { title: 'Stranger Things', primaryCategory: 'dark_mystery_supernatural', tone: 'dark', genres: ['Sci-Fi & Fantasy', 'Mystery', 'Drama'], rating: 8.6, tags: ['supernatural', '80s', 'monsters', 'upside down'] },
        '93405': { title: 'Squid Game', primaryCategory: 'action_thriller', tone: 'dark', genres: ['Action & Adventure', 'Drama', 'Mystery'], rating: 8.4, tags: ['survival', 'thriller', 'dark', 'high stakes'] },
        '119051': { title: 'Wednesday', primaryCategory: 'dark_mystery_supernatural', tone: 'dark', genres: ['Mystery', 'Sci-Fi & Fantasy'], rating: 8.1, tags: ['supernatural', 'goth', 'macabre', 'high school', 'monsters'] },
        '65494': { title: 'The Crown', primaryCategory: 'prestige_drama', tone: 'serious', genres: ['Drama', 'History'], rating: 8.6, tags: ['royalty', 'politics', 'biography', 'british'] },
        '69740': { title: 'Ozark', primaryCategory: 'gritty_crime', tone: 'dark', genres: ['Crime', 'Drama', 'Thriller'], rating: 8.5, tags: ['money laundering', 'cartel', 'family', 'gritty'] },
        '87739': { title: "The Queen's Gambit", primaryCategory: 'prestige_drama', tone: 'serious', genres: ['Drama'], rating: 8.5, tags: ['chess', 'prodigy', 'period', 'addiction'] },
        '42009': { title: 'Black Mirror', primaryCategory: 'mindbending_scifi', tone: 'dark', genres: ['Sci-Fi & Fantasy', 'Drama', 'Mystery'], rating: 8.7, tags: ['technology', 'dystopia', 'anthology', 'dark future'] },
        '91239': { title: 'Bridgerton', primaryCategory: 'prestige_drama', tone: 'warm', genres: ['Drama', 'Romance'], rating: 8.2, tags: ['regency', 'period', 'romance', 'society'] },
        '71446': { title: 'Money Heist', primaryCategory: 'action_thriller', tone: 'tense', genres: ['Action & Adventure', 'Crime', 'Drama'], rating: 8.2, tags: ['heist', 'professor', 'hostage', 'suspense'] },
        '75006': { title: 'The Umbrella Academy', primaryCategory: 'dark_mystery_supernatural', tone: 'dark', genres: ['Sci-Fi & Fantasy', 'Action & Adventure'], rating: 7.9, tags: ['superhero', 'apocalypse', 'time travel', 'dysfunctional'] },

        // --- DISNEY+ ---
        '82856': { title: 'The Mandalorian', primaryCategory: 'action_thriller', tone: 'adventurous', genres: ['Sci-Fi & Fantasy', 'Action & Adventure'], rating: 8.5, tags: ['star wars', 'space', 'bounty hunter', 'grogu'] },
        '84958': { title: 'Loki', primaryCategory: 'mindbending_scifi', tone: 'cerebral', genres: ['Sci-Fi & Fantasy', 'Action & Adventure'], rating: 8.2, tags: ['marvel', 'time travel', 'multiverse', 'tva'] },
        '85271': { title: 'WandaVision', primaryCategory: 'mindbending_scifi', tone: 'cerebral', genres: ['Sci-Fi & Fantasy', 'Mystery', 'Drama'], rating: 8.2, tags: ['marvel', 'sitcom', 'magic', 'reality'] },
        '83867': { title: 'Andor', primaryCategory: 'action_thriller', tone: 'tense', genres: ['Sci-Fi & Fantasy', 'Action & Adventure', 'Drama'], rating: 8.4, tags: ['star wars', 'rebellion', 'spy', 'gritty'] },
        '114461': { title: 'Ahsoka', primaryCategory: 'action_thriller', tone: 'adventurous', genres: ['Sci-Fi & Fantasy', 'Action & Adventure'], rating: 7.6, tags: ['star wars', 'jedi', 'lightsaber', 'thrawn'] },
        '4194': { title: 'Star Wars: The Clone Wars', primaryCategory: 'action_thriller', tone: 'adventurous', genres: ['Animation', 'Sci-Fi & Fantasy', 'Action & Adventure'], rating: 8.4, tags: ['star wars', 'jedi', 'clones', 'galactic'] },
        '103540': { title: 'Percy Jackson and the Olympians', primaryCategory: 'fantasy_adventure', tone: 'adventurous', genres: ['Action & Adventure', 'Sci-Fi & Fantasy', 'Family'], rating: 7.4, tags: ['mythology', 'greek gods', 'demigod', 'quest'] },
        '92749': { title: 'Moon Knight', primaryCategory: 'action_thriller', tone: 'dark', genres: ['Action & Adventure', 'Sci-Fi & Fantasy', 'Drama'], rating: 7.3, tags: ['marvel', 'egyptian', 'superhero', 'psychological'] },
        '456': { title: 'The Simpsons', primaryCategory: 'lighthearted_comedy', tone: 'lighthearted', genres: ['Animation', 'Comedy'], rating: 8.7, tags: ['cartoon', 'springfield', 'family', 'satire'] },
        '202555': { title: 'Daredevil: Born Again', primaryCategory: 'action_thriller', tone: 'gritty', genres: ['Action & Adventure', 'Crime', 'Drama'], rating: 8.4, tags: ['marvel', 'hells kitchen', 'superhero', 'vigilante'] },

        // --- HULU ---
        '136315': { title: 'The Bear', primaryCategory: 'satirical_dark_comedy', tone: 'tense', genres: ['Drama', 'Comedy'], rating: 8.6, tags: ['kitchen', 'chicago', 'culinary', 'high stress', 'family'] },
        '126308': { title: 'Shōgun', primaryCategory: 'prestige_drama', tone: 'epic', genres: ['Drama', 'Action & Adventure', 'History'], rating: 8.7, tags: ['japan', 'samurai', 'feudal', 'epic', 'politics'] },
        '107113': { title: 'Only Murders in the Building', primaryCategory: 'gritty_crime', tone: 'witty', genres: ['Comedy', 'Crime', 'Mystery'], rating: 8.1, tags: ['podcast', 'nyc', 'murder', 'investigation'] },
        '69478': { title: "The Handmaid's Tale", primaryCategory: 'prestige_drama', tone: 'dark', genres: ['Drama', 'Sci-Fi & Fantasy'], rating: 8.4, tags: ['dystopia', 'totalitarian', 'gilead', 'resistance'] },
        '60622': { title: 'Fargo', primaryCategory: 'gritty_crime', tone: 'dark', genres: ['Crime', 'Drama', 'Mystery'], rating: 8.9, tags: ['anthology', 'midwest', 'coen', 'eccentric murder'] },
        '615': { title: 'Futurama', primaryCategory: 'lighthearted_comedy', tone: 'lighthearted', genres: ['Animation', 'Comedy', 'Sci-Fi & Fantasy'], rating: 8.5, tags: ['future', 'planet express', 'fry', 'bender'] },
        '64464': { title: '11.22.63', primaryCategory: 'prestige_drama', tone: 'tense', genres: ['Drama', 'Mystery', 'Sci-Fi & Fantasy'], rating: 8.1, tags: ['stephen king', 'time travel', 'jfk', 'assassination'] },
        '125935': { title: 'Abbott Elementary', primaryCategory: 'lighthearted_comedy', tone: 'lighthearted', genres: ['Comedy'], rating: 8.2, tags: ['mockumentary', 'teachers', 'school', 'philadelphia', 'wholesome'] },
        '82883': { title: 'The Act', primaryCategory: 'prestige_drama', tone: 'dark', genres: ['Crime', 'Drama'], rating: 7.9, tags: ['true crime', 'munchausen', 'gypsy rose', 'psychological'] },
        '110695': { title: 'Dopesick', primaryCategory: 'prestige_drama', tone: 'serious', genres: ['Drama'], rating: 8.6, tags: ['opioid', 'big pharma', 'purdue', 'addiction', 'investigation'] },

        // --- PEACOCK ---
        '2316': { title: 'The Office', primaryCategory: 'lighthearted_comedy', tone: 'lighthearted', genres: ['Comedy'], rating: 8.9, tags: ['dunder mifflin', 'mockumentary', 'workplace', 'sitcom', 'scranton'] },
        '8592': { title: 'Parks and Recreation', primaryCategory: 'lighthearted_comedy', tone: 'lighthearted', genres: ['Comedy'], rating: 8.6, tags: ['pawnee', 'mockumentary', 'government', 'waffles', 'wholesome'] },
        '73586': { title: 'Yellowstone', primaryCategory: 'prestige_drama', tone: 'serious', genres: ['Drama', 'Western'], rating: 8.6, tags: ['dutton', 'montana', 'ranch', 'family empire'] },
        '120998': { title: 'Poker Face', primaryCategory: 'gritty_crime', tone: 'witty', genres: ['Mystery', 'Comedy', 'Crime'], rating: 7.9, tags: ['columbo', 'case of week', 'lie detector', 'road trip'] },
        '48891': { title: 'Brooklyn Nine-Nine', primaryCategory: 'lighthearted_comedy', tone: 'lighthearted', genres: ['Comedy', 'Crime'], rating: 8.4, tags: ['police', 'detective', '99th precinct', 'sitcom', 'jake peralta'] },
        '37680': { title: 'Suits', primaryCategory: 'prestige_drama', tone: 'witty', genres: ['Drama'], rating: 8.5, tags: ['lawyers', 'manhattan', 'corporate', 'courtroom'] },
        '201834': { title: 'ted', primaryCategory: 'satirical_dark_comedy', tone: 'satirical', genres: ['Comedy'], rating: 7.9, tags: ['teddy bear', 'seth macfarlane', '90s', 'raunchy'] },
        '4608': { title: '30 Rock', primaryCategory: 'lighthearted_comedy', tone: 'lighthearted', genres: ['Comedy'], rating: 8.3, tags: ['nbc', 'sketch show', 'tina fey', 'satire', 'workplace'] },

        // --- PRIME VIDEO ---
        '76479': { title: 'The Boys', primaryCategory: 'action_thriller', tone: 'gritty', genres: ['Action & Adventure', 'Sci-Fi & Fantasy'], rating: 8.7, tags: ['superheroes', 'antihero', 'vought', 'homelander', 'satire'] },
        '106379': { title: 'Fallout', primaryCategory: 'mindbending_scifi', tone: 'gritty', genres: ['Sci-Fi & Fantasy', 'Action & Adventure'], rating: 8.4, tags: ['post-apocalyptic', 'vault', 'wasteland', 'ghoul'] },
        '108978': { title: 'Reacher', primaryCategory: 'action_thriller', tone: 'tense', genres: ['Action & Adventure', 'Crime', 'Drama'], rating: 8.1, tags: ['jack reacher', 'army investigator', 'combat', 'action'] },
        '95557': { title: 'INVINCIBLE', primaryCategory: 'action_thriller', tone: 'dark', genres: ['Animation', 'Action & Adventure', 'Sci-Fi & Fantasy'], rating: 8.7, tags: ['superhero', 'omni man', 'graphic', 'comics'] },
        '70796': { title: 'The Marvelous Mrs. Maisel', primaryCategory: 'prestige_drama', tone: 'witty', genres: ['Comedy', 'Drama'], rating: 8.7, tags: ['standup', '50s', 'nyc', 'period', 'midge'] },
        '84773': { title: 'The Lord of the Rings: The Rings of Power', primaryCategory: 'fantasy_adventure', tone: 'epic', genres: ['Sci-Fi & Fantasy', 'Action & Adventure'], rating: 6.9, tags: ['middle earth', 'sauron', 'galadriel', 'tolkien', 'elves'] },
        '63639': { title: 'The Expanse', primaryCategory: 'mindbending_scifi', tone: 'cerebral', genres: ['Sci-Fi & Fantasy', 'Drama'], rating: 8.5, tags: ['space', 'politics', 'ring gates', 'sol system', 'hard scifi'] },
        '67070': { title: 'Fleabag', primaryCategory: 'satirical_dark_comedy', tone: 'satirical', genres: ['Comedy', 'Drama'], rating: 8.7, tags: ['fourth wall', 'london', 'dark humor', 'grief', 'phoebe waller-bridge'] },

        // --- YOUTUBE ---
        '254002': { title: 'Critical Role', primaryCategory: 'fantasy_adventure', tone: 'adventurous', genres: ['Action & Adventure', 'Sci-Fi & Fantasy'], rating: 8.8, tags: ['dnd', 'voice actors', 'campaign', 'ttrpg'] },
        '89180': { title: 'Dimension 20', primaryCategory: 'fantasy_adventure', tone: 'adventurous', genres: ['Comedy', 'Sci-Fi & Fantasy'], rating: 8.6, tags: ['dnd', 'brennan lee mulligan', 'improv', 'ttrpg'] },
        '65701': { title: 'Good Mythical Morning', primaryCategory: 'lighthearted_comedy', tone: 'lighthearted', genres: ['Comedy', 'Talk'], rating: 8.0, tags: ['rhett and link', 'taste test', 'fun', 'youtube'] },
        '1667': { title: 'Saturday Night Live', primaryCategory: 'lighthearted_comedy', tone: 'lighthearted', genres: ['Comedy'], rating: 7.0, tags: ['sketch', 'live comedy', 'nbc', 'parody'] },
        '60625': { title: 'Rick and Morty', primaryCategory: 'satirical_dark_comedy', tone: 'satirical', genres: ['Animation', 'Comedy', 'Sci-Fi & Fantasy'], rating: 8.7, tags: ['multiverse', 'cynical', 'portal gun', 'mad scientist'] },
        '2912': { title: 'Jeopardy!', primaryCategory: 'lighthearted_comedy', tone: 'lighthearted', genres: ['Family', 'Comedy'], rating: 8.2, tags: ['trivia', 'quiz show', 'knowledge', 'comfort'] },

        // --- APPLE TV+ ---
        '97546': { title: 'Ted Lasso', primaryCategory: 'lighthearted_comedy', tone: 'wholesome', genres: ['Comedy', 'Drama'], rating: 8.8, tags: ['afc richmond', 'soccer', 'wholesome', 'feel-good', 'coach'] },
        '95396': { title: 'Severance', primaryCategory: 'mindbending_scifi', tone: 'cerebral', genres: ['Sci-Fi & Fantasy', 'Drama', 'Mystery'], rating: 8.7, tags: ['lumon', 'workplace', 'dystopia', 'psychological', 'mystery'] },
        '125988': { title: 'Silo', primaryCategory: 'mindbending_scifi', tone: 'tense', genres: ['Sci-Fi & Fantasy', 'Drama'], rating: 8.1, tags: ['underground', 'dystopia', 'post-apocalypse', 'secrets'] },
        '95480': { title: 'Slow Horses', primaryCategory: 'gritty_crime', tone: 'gritty', genres: ['Drama', 'Crime', 'Thriller'], rating: 8.2, tags: ['mi5', 'slough house', 'jackson lamb', 'espionage', 'british'] },
        '90282': { title: 'The Morning Show', primaryCategory: 'prestige_drama', tone: 'serious', genres: ['Drama'], rating: 8.2, tags: ['broadcast', 'news', 'journalism', 'corporate', 'metoo'] },
        '87917': { title: 'For All Mankind', primaryCategory: 'mindbending_scifi', tone: 'cerebral', genres: ['Sci-Fi & Fantasy', 'Drama'], rating: 8.1, tags: ['nasa', 'alternate history', 'space race', 'moon base'] },
        '93740': { title: 'Foundation', primaryCategory: 'mindbending_scifi', tone: 'epic', genres: ['Sci-Fi & Fantasy', 'Drama'], rating: 7.6, tags: ['asimov', 'galactic empire', 'psychohistory', 'space'] },
        '136311': { title: 'Shrinking', primaryCategory: 'lighthearted_comedy', tone: 'warm', genres: ['Comedy', 'Drama'], rating: 8.0, tags: ['therapy', 'grief', 'friendship', 'wholesome', 'jason segel'] },
        '155537': { title: 'Black Bird', primaryCategory: 'prestige_drama', tone: 'dark', genres: ['Drama', 'Crime'], rating: 8.1, tags: ['prison', 'fbi', 'serial killer', 'true crime', 'interrogation'] },
        '87784': { title: 'Defending Jacob', primaryCategory: 'prestige_drama', tone: 'serious', genres: ['Drama', 'Mystery', 'Crime'], rating: 7.9, tags: ['murder trial', 'family', 'district attorney', 'courtroom'] },

        // --- LEGACY & TMDB POPULAR ALIASES ---
        '1418': { title: 'The Office', primaryCategory: 'lighthearted_comedy', tone: 'lighthearted', genres: ['Comedy'], rating: 8.9, tags: ['dunder mifflin', 'mockumentary', 'workplace', 'sitcom'] },
        '46896': { title: 'Brooklyn Nine-Nine', primaryCategory: 'lighthearted_comedy', tone: 'lighthearted', genres: ['Comedy', 'Crime'], rating: 8.4, tags: ['police', 'detective', '99th precinct'] },
        '124364': { title: 'The Bear', primaryCategory: 'satirical_dark_comedy', tone: 'tense', genres: ['Drama', 'Comedy'], rating: 8.6, tags: ['kitchen', 'chicago', 'culinary'] },
        '79242': { title: 'Only Murders in the Building', primaryCategory: 'gritty_crime', tone: 'witty', genres: ['Comedy', 'Crime', 'Mystery'], rating: 8.1, tags: ['podcast', 'nyc', 'murder'] },
        '60059': { title: 'Fargo', primaryCategory: 'gritty_crime', tone: 'dark', genres: ['Crime', 'Drama', 'Mystery'], rating: 8.9, tags: ['anthology', 'midwest', 'coen'] },
        '1399': { title: 'Breaking Bad', primaryCategory: 'prestige_drama', tone: 'dark', genres: ['Drama', 'Crime', 'Thriller'], rating: 9.5, tags: ['chemistry', 'cartel', 'masterpiece', 'walter white'] },
        '1400': { title: 'Mad Men', primaryCategory: 'prestige_drama', tone: 'serious', genres: ['Drama'], rating: 8.5, tags: ['advertising', '60s', 'nyc', 'don draper'] },
        '1396': { title: 'The Wire', primaryCategory: 'gritty_crime', tone: 'dark', genres: ['Drama', 'Crime', 'Mystery'], rating: 8.8, tags: ['drugs', 'baltimore', 'police', 'street'] },
        '1405': { title: 'Dexter', primaryCategory: 'gritty_crime', tone: 'dark', genres: ['Crime', 'Drama', 'Mystery'], rating: 8.2, tags: ['miami', 'serial killer', 'blood', 'forensics'] },
        '1402': { title: 'The Walking Dead', primaryCategory: 'action_thriller', tone: 'dark', genres: ['Drama', 'Sci-Fi & Fantasy'], rating: 8.3, tags: ['zombies', 'survival', 'apocalypse'] },
        '1911': { title: 'Lost', primaryCategory: 'mindbending_scifi', tone: 'cerebral', genres: ['Sci-Fi & Fantasy', 'Drama', 'Mystery'], rating: 8.3, tags: ['island', 'smoke monster', 'mystery', 'plane crash'] },
        '2710': { title: "It's Always Sunny in Philadelphia", primaryCategory: 'satirical_dark_comedy', tone: 'satirical', genres: ['Comedy'], rating: 8.8, tags: ['philly', 'gang', 'bar', 'satire'] },
        '83631': { title: 'What We Do in the Shadows', primaryCategory: 'satirical_dark_comedy', tone: 'satirical', genres: ['Comedy', 'Sci-Fi & Fantasy'], rating: 8.5, tags: ['vampires', 'staten island', 'mockumentary'] },
        '85552': { title: 'Yellowstone', primaryCategory: 'prestige_drama', tone: 'serious', genres: ['Drama', 'Western'], rating: 8.6, tags: ['ranch', 'montana', 'family empire'] },
        '1416': { title: "Grey's Anatomy", primaryCategory: 'prestige_drama', tone: 'serious', genres: ['Drama'], rating: 8.3, tags: ['hospital', 'doctors', 'seattle'] }
    };

    function getShowClassification(item) {
        if (!item) return { primaryCategory: 'prestige_drama', tone: 'serious', genres: ['Drama'], rating: 8.0, tags: [] };
        const idStr = String(item.id);
        const tmdbIdStr = String(item.tmdb_id || item.id);
        if (SHOW_METADATA[tmdbIdStr]) return SHOW_METADATA[tmdbIdStr];
        if (SHOW_METADATA[idStr]) return SHOW_METADATA[idStr];

        const titleLower = (item.title || '').toLowerCase().trim();
        if (titleLower) {
            for (const meta of Object.values(SHOW_METADATA)) {
                if (meta.title && meta.title.toLowerCase().trim() === titleLower) {
                    return meta;
                }
            }
        }

        // Dynamic Heuristics for arbitrary TMDB search additions
        const text = (item.title + ' ' + (item.overview || '')).toLowerCase();
        const isDark = /dark|murder|serial killer|cartel|gritty|sinister|goth|macabre|horror|dystopia|brutal|blood|death|conspiracy/.test(text);
        const isSitcom = /sitcom|mockumentary|workplace comedy|hilarious|bickering|funny|laugh|stand-up|quirky/.test(text);
        const isCrime = /detective|police|cop|fbi|cartel|drugs|mafia|heist|lawyer|investigation|crime/.test(text);
        const isSciFi = /space|sci-fi|alien|planet|future|quantum|cyborg|supernatural|magic|multiverse|time travel/.test(text);
        const isAction = /action|combat|battle|soldier|spy|agent|superhero|warrior|assassin|survival/.test(text);

        let primaryCategory = 'prestige_drama';
        let tone = isDark ? 'dark' : 'serious';

        if (isSitcom && !isDark) {
            primaryCategory = 'lighthearted_comedy';
            tone = 'lighthearted';
        } else if (isDark && (isSitcom || /satire|black comedy/.test(text))) {
            primaryCategory = 'satirical_dark_comedy';
            tone = 'satirical';
        } else if (isDark && isSciFi) {
            primaryCategory = /supernatural|goth|macabre|vampire|witch/.test(text) ? 'dark_mystery_supernatural' : 'mindbending_scifi';
            tone = 'dark';
        } else if (isCrime) {
            primaryCategory = 'gritty_crime';
            tone = isDark ? 'dark' : 'serious';
        } else if (isSciFi) {
            primaryCategory = 'mindbending_scifi';
            tone = 'cerebral';
        } else if (isAction) {
            primaryCategory = 'action_thriller';
            tone = isDark ? 'dark' : 'adventurous';
        }

        return {
            primaryCategory,
            tone,
            genres: inferGenresFromTitleAndOverview(item.title, item.overview),
            rating: item.vote_average ? Number((item.vote_average).toFixed(1)) : 8.0,
            tags: []
        };
    }

    function checkMoodEligibility(item, mood) {
        if (!mood) return true;
        const meta = getShowClassification(item);
        const cat = meta.primaryCategory;
        const tone = meta.tone;

        if (mood === 'lighthearted') {
            // Strictly exclude dark, gritty, tense shows, or dark/action categories
            if (tone === 'dark' || tone === 'gritty' || tone === 'tense') return false;
            if (cat === 'dark_mystery_supernatural' || cat === 'prestige_drama' || cat === 'gritty_crime' || cat === 'action_thriller' || cat === 'satirical_dark_comedy') {
                return false;
            }
            return cat === 'lighthearted_comedy';
        }

        if (mood === 'drama') {
            // Strictly exclude lighthearted sitcoms, juvenile content, or supernatural teen mysteries
            if (cat === 'lighthearted_comedy') return false;
            if (cat === 'dark_mystery_supernatural') return false;
            if (cat === 'satirical_dark_comedy' && tone !== 'tense' && tone !== 'serious') return false;
            if (cat === 'prestige_drama') return true;
            if (cat === 'gritty_crime' && (tone === 'serious' || tone === 'dark' || tone === 'gritty')) return true;
            return false;
        }

        if (mood === 'mindbending') {
            if (cat === 'lighthearted_comedy') return false;
            return cat === 'mindbending_scifi' || (cat === 'dark_mystery_supernatural' && (tone === 'cerebral' || tone === 'dark'));
        }

        if (mood === 'adrenaline') {
            if (cat === 'lighthearted_comedy') return false;
            return cat === 'action_thriller' || cat === 'fantasy_adventure';
        }

        if (mood === 'crime') {
            if (cat === 'lighthearted_comedy') return false;
            return cat === 'gritty_crime' || (cat === 'prestige_drama' && meta.genres?.includes('Crime'));
        }

        return true;
    }

    // =========================================================================
    // --- Intelligent Streaming Service Detection & Auto-Resolution Engine ---
    // =========================================================================

    function extractServiceFromTmdbDetails(details) {
        if (!details) return null;

        // 1. Check US watch providers (flatrate, ads, free)
        const usWatch = details['watch/providers']?.results?.US || details.watch_providers?.results?.US;
        const usProviders = [
            ...(usWatch?.flatrate || []),
            ...(usWatch?.ads || []),
            ...(usWatch?.free || [])
        ];
        if (usProviders.length > 0) {
            for (const prov of usProviders) {
                const pName = (prov.provider_name || '').toLowerCase();
                if (pName.includes('disney')) return 'disney';
                if (pName.includes('netflix')) return 'netflix';
                if (pName.includes('apple')) return 'appletv';
                if (pName.includes('hulu')) return 'hulu';
                if (pName.includes('peacock')) return 'peacock';
                if (pName.includes('amazon') || pName.includes('prime')) return 'prime';
                if (pName.includes('youtube')) return 'youtube';
            }
        }

        // 2. Check production / original networks
        if (Array.isArray(details.networks) && details.networks.length > 0) {
            for (const net of details.networks) {
                const nName = (net.name || '').toLowerCase();
                const nId = String(net.id);
                if (nId === '2739' || nName.includes('disney')) return 'disney';
                if (nId === '213' || nName.includes('netflix')) return 'netflix';
                if (nId === '2552' || nName.includes('apple')) return 'appletv';
                if (nId === '453' || nName.includes('hulu') || nId === '88' || nName.includes('fx')) return 'hulu';
                if (nId === '3353' || nName.includes('peacock') || nId === '6' || nName.includes('nbc')) return 'peacock';
                if (nId === '1024' || nName.includes('amazon') || nName.includes('prime')) return 'prime';
                if (nId === '247' || nName.includes('youtube')) return 'youtube';
            }
        }

        return null;
    }

    function detectShowServiceSync(item) {
        if (!item) return null;
        const tmdbId = String(item.id || item.tmdb_id || '');
        const title = (item.title || item.name || '').toLowerCase().trim();

        // 1. Direct explicit service key
        if (item.service && serviceMeta[item.service]) return item.service;
        if (item.mock_service) {
            const ms = item.mock_service.toLowerCase().trim();
            if (!['unknown', 'none / unknown', 'custom', 'recommended'].includes(ms)) {
                for (const [k, meta] of Object.entries(serviceMeta)) {
                    if (ms.includes(k) || ms.includes(meta.name.toLowerCase())) return k;
                }
            }
        }

        // 2. Check window.SERVICE_CATALOG across all services
        if (typeof window !== 'undefined' && window.SERVICE_CATALOG) {
            for (const [svcKey, shows] of Object.entries(window.SERVICE_CATALOG)) {
                if (Array.isArray(shows)) {
                    for (const s of shows) {
                        if (tmdbId && String(s.id) === tmdbId) return svcKey;
                        if (title && s.title && s.title.toLowerCase().trim() === title) return svcKey;
                    }
                }
            }
        }

        // 3. Check SHOW_METADATA curated entries
        if (typeof SHOW_METADATA !== 'undefined' && tmdbId && SHOW_METADATA[tmdbId]?.service) {
            return SHOW_METADATA[tmdbId].service;
        }

        // 4. Curated Franchise & Title Heuristics
        if (title) {
            // Disney+ (Star Wars, Marvel, Pixar, Disney)
            if (/star wars|ahsoka|mandalorian|andor|obi-wan|clone wars|bad batch|boba fett|skeleton crew|acolyte|tales of the jedi|resistance|visions/.test(title)) return 'disney';
            if (/wandavision|loki|moon knight|hawkeye|ms\. marvel|she-hulk|secret invasion|agatha|daredevil|ironheart|echo|what if\.\.\./.test(title)) return 'disney';
            if (/percy jackson|monsters at work|dug days|win or lose|baymax|tangled|gravity falls|phineas and ferb|bluey|ducktails/.test(title)) return 'disney';

            // Apple TV+ originals
            if (/ted lasso|severance|slow horses|silo|morning show|for all mankind|shrinking|foundation|bad sisters|black bird|pachinko|sugar|presumed innocent|defending jacob|monarch: legacy|dickinson|servant|loot|palm royale/.test(title)) return 'appletv';

            // Netflix originals
            if (/stranger things|squid game|wednesday|bridgerton|the crown|ozark|witcher|black mirror|narcos|queen's gambit|dark|mindhunter|bojack|cobra kai|money heist|heartstopper|outer banks|lucifer|beef|one piece|you|dead to me|sweet tooth|sex education|umbrella academy/.test(title)) return 'netflix';

            // Hulu & FX originals
            if (/the bear|only murders in the building|shogun|fargo|handmaid's tale|dopesick|nine perfect strangers|normal people|little fires everywhere|reservation dogs|what we do in the shadows|american horror story|atlanta|justified|snowfall/.test(title)) return 'hulu';

            // Prime Video originals
            if (/the boys|reacher|fallout|rings of power|invincible|wheel of time|fleabag|marvelous mrs\. maisel|good omens|jack ryan|terminal list|upload|the expanse|outer range|bosch|mr\. & mrs\. smith|gen v/.test(title)) return 'prime';

            // Peacock & NBC originals/classics
            if (/yellowstone|poker face|the office|parks and recreation|battlestar galactica|ted|twisted metal|bel-air|monk|columbo|psych|brooklyn nine-nine|30 rock|community|suits|dr\. death/.test(title)) return 'peacock';
        }

        return null;
    }

    function resolveItemServiceName(item) {
        if (!item) return 'Unknown';
        let serviceName = item.streaming_services?.name || item.mock_service;
        if (!serviceName || ['unknown', 'none / unknown', 'custom', 'recommended'].includes(String(serviceName).toLowerCase().trim())) {
            const detectedKey = detectShowServiceSync(item);
            if (detectedKey && serviceMeta[detectedKey]) {
                serviceName = serviceMeta[detectedKey].name;
                item.mock_service = serviceName; // update in-memory item
            } else {
                serviceName = 'Unknown';
            }
        }
        return serviceName;
    }

    async function healLibraryServices() {
        if (!allContent || allContent.length === 0) return;
        let changed = false;
        const cloudKey = await window.db.getSystemSetting('tmdb_api_key') || localStorage.getItem('tmdb_api_key');
        const localLib = window.db.getLocalLibrary();
        let localLibUpdated = false;

        for (const item of allContent) {
            const currentService = item.streaming_services?.name || item.mock_service;
            const isUnknown = !currentService || ['unknown', 'none / unknown', 'custom', 'recommended'].includes(String(currentService).toLowerCase().trim());
            
            if (isUnknown) {
                let detectedKey = detectShowServiceSync(item);
                if (!detectedKey && cloudKey && item.tmdb_id && !String(item.tmdb_id).startsWith('custom_')) {
                    try {
                        const res = await fetch(`https://api.themoviedb.org/3/tv/${item.tmdb_id}?api_key=${cloudKey}&language=en-US&append_to_response=watch/providers`);
                        if (res.ok) {
                            const det = await res.json();
                            detectedKey = extractServiceFromTmdbDetails(det);
                        }
                    } catch(e) {}
                }

                if (detectedKey && serviceMeta[detectedKey]) {
                    const properName = serviceMeta[detectedKey].name;
                    item.mock_service = properName;
                    changed = true;

                    // Update local storage
                    const idx = localLib.findIndex(l => String(l.id) === String(item.id) || (l.title && l.title.toLowerCase() === (item.title || '').toLowerCase()));
                    if (idx >= 0) {
                        localLib[idx].mock_service = properName;
                        localLibUpdated = true;
                    }

                    // Update Supabase if available
                    if (window.db?.supabaseClient && currentUser) {
                        try {
                            const matchedSvc = allServices.find(s => s.name.toLowerCase().includes(detectedKey));
                            if (matchedSvc) {
                                item.streaming_service_id = matchedSvc.id;
                                window.db.supabaseClient.from('content_items').update({ streaming_service_id: matchedSvc.id }).eq('id', item.id).then(() => {});
                            }
                        } catch(e) {}
                    }
                }
            }
        }

        if (localLibUpdated) {
            window.db.saveLocalLibrary(localLib);
        }

        if (changed) {
            updateLibraryCounters();
            renderLibrary();
        }
    }

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

    // Add Shows Modal Handlers
    function openAddShowsModal() {
        if (addShowsModal) {
            addShowsModal.classList.remove('hidden');
            if (tmdbSearchQuery) {
                setTimeout(() => tmdbSearchQuery.focus(), 50);
            }
        }
    }
    window.openAddShowsModal = openAddShowsModal;

    function closeAddShowsModal() {
        if (addShowsModal) {
            addShowsModal.classList.add('hidden');
        }
    }
    window.closeAddShowsModal = closeAddShowsModal;

    // Admin Authentication Elements
    const adminAuthModal = document.getElementById('admin-auth-modal');
    const closeAdminAuthBtn = document.getElementById('close-admin-auth-btn');
    const adminAuthTitle = document.getElementById('admin-auth-title');
    const adminAuthDesc = document.getElementById('admin-auth-desc');
    const adminVerifyForm = document.getElementById('admin-verify-form');
    const adminPassInput = document.getElementById('admin-pass-input');
    const adminVerifySubmitBtn = document.getElementById('admin-verify-submit-btn');
    const adminVerifyCancelBtn = document.getElementById('admin-verify-cancel-btn');
    const adminAuthError = document.getElementById('admin-auth-error');
    const adminAuthStatus = document.getElementById('admin-auth-status');
    const adminChangePass = document.getElementById('admin-change-pass');
    const adminChangeConfirm = document.getElementById('admin-change-confirm');
    const updateAdminPassBtn = document.getElementById('update-admin-pass-btn');
    const adminPassStatus = document.getElementById('admin-pass-status');

    // --- Hardened Cryptographic Admin Authentication & Rate Limiting ---
    const ESTABLISHED_ADMIN_HASH = 'ef7b5399919988432dd0ecc566ed0f15c712bb830f5e786d76b3a2abc173a69f';
    let isAdminAuthenticated = false;

    function lockAdmin() {
        isAdminAuthenticated = false;
        sessionStorage.removeItem('tv_admin_authed');
    }

    async function hashSha256(text) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function getStoredAdminHash() {
        let hash = localStorage.getItem('tv_admin_password_hash');
        if (hash) return hash;

        try {
            const cloudHash = await window.db.getSystemSetting('admin_password_hash');
            if (cloudHash) {
                localStorage.setItem('tv_admin_password_hash', cloudHash);
                return cloudHash;
            }
        } catch (e) {
            console.warn("Could not retrieve admin password hash from cloud:", e);
        }
        localStorage.setItem('tv_admin_password_hash', ESTABLISHED_ADMIN_HASH);
        return ESTABLISHED_ADMIN_HASH;
    }

    async function saveAdminHash(hash) {
        localStorage.setItem('tv_admin_password_hash', hash);
        try {
            await window.db.setSystemSetting('admin_password_hash', hash);
        } catch (e) {
            console.warn("Could not sync admin password hash to cloud:", e);
        }
    }

    let failedAttempts = 0;
    let lockoutExpiresAt = 0;
    let lockoutInterval = null;
    let pendingAdminCallback = null;

    function checkLockoutState() {
        if (!adminAuthError || !adminPassInput || !adminVerifySubmitBtn) return false;
        const now = Date.now();
        if (now < lockoutExpiresAt) {
            const secondsLeft = Math.ceil((lockoutExpiresAt - now) / 1000);
            adminAuthError.textContent = `Too many failed attempts. Locked out for ${secondsLeft}s.`;
            adminAuthError.style.display = 'block';
            adminPassInput.disabled = true;
            adminVerifySubmitBtn.disabled = true;
            return true;
        } else {
            if (lockoutExpiresAt > 0) {
                lockoutExpiresAt = 0;
                failedAttempts = 0;
                if (lockoutInterval) {
                    clearInterval(lockoutInterval);
                    lockoutInterval = null;
                }
                adminAuthError.textContent = '';
                adminAuthError.style.display = 'none';
                adminPassInput.disabled = false;
                adminVerifySubmitBtn.disabled = false;
            }
            return false;
        }
    }

    function startLockoutTimer() {
        lockoutExpiresAt = Date.now() + 30000;
        checkLockoutState();
        if (lockoutInterval) clearInterval(lockoutInterval);
        lockoutInterval = setInterval(() => {
            const isLocked = checkLockoutState();
            if (!isLocked) {
                clearInterval(lockoutInterval);
                lockoutInterval = null;
            }
        }, 1000);
    }

    async function requireAdminAuth(callback) {
        if (isAdminAuthenticated) {
            if (typeof callback === 'function') callback();
            return;
        }

        pendingAdminCallback = callback;
        if (adminAuthError) {
            adminAuthError.textContent = '';
            adminAuthError.style.display = 'none';
        }
        if (adminAuthStatus) {
            adminAuthStatus.textContent = '';
            adminAuthStatus.style.display = 'none';
        }

        if (adminAuthTitle) adminAuthTitle.textContent = 'Admin Access Required';
        if (adminAuthDesc) adminAuthDesc.textContent = 'Enter master admin password to unlock protected controls.';
        if (adminVerifyForm) adminVerifyForm.style.display = 'block';
        if (adminPassInput) {
            adminPassInput.value = '';
            adminPassInput.disabled = false;
        }
        if (adminVerifySubmitBtn) {
            adminVerifySubmitBtn.disabled = false;
            adminVerifySubmitBtn.textContent = 'Unlock';
        }
        if (adminAuthModal) adminAuthModal.classList.remove('hidden');
        if (!checkLockoutState()) {
            setTimeout(() => { if (adminPassInput) adminPassInput.focus(); }, 100);
        }
    }

    function closeAdminAuthModal() {
        if (adminAuthModal) adminAuthModal.classList.add('hidden');
        if (adminAuthError) {
            adminAuthError.textContent = '';
            adminAuthError.style.display = 'none';
        }
        if (adminAuthStatus) {
            adminAuthStatus.textContent = '';
            adminAuthStatus.style.display = 'none';
        }
        pendingAdminCallback = null;
    }
    // --- Device Differentiation & Multi-Platform Adaptation ---
    function updateDeviceMetrics() {
        const ua = navigator.userAgent || '';
        const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isIPhone = /iPhone|iPod/.test(ua);
        const isIPad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 && window.innerWidth >= 641);
        
        const width = window.innerWidth || document.documentElement.clientWidth || 0;
        const height = window.innerHeight || document.documentElement.clientHeight || 0;
        const isPortrait = height >= width;

        let deviceType = 'desktop';
        if (isIPhone || width <= 640) {
            deviceType = 'phone';
        } else if (isIPad || (width >= 641 && width <= 1024)) {
            deviceType = 'tablet';
        }

        document.documentElement.dataset.device = deviceType;
        document.documentElement.dataset.orientation = isPortrait ? 'portrait' : 'landscape';

        // Orientation handling on phone
        const orientationBanner = document.getElementById('phone-orientation-banner');
        if (orientationBanner) {
            if (deviceType === 'phone' && !isPortrait) {
                orientationBanner.classList.add('visible');
            } else {
                orientationBanner.classList.remove('visible');
            }
        }

        // Try locking orientation to portrait if on mobile PWA/supported browser
        if (deviceType === 'phone' && screen.orientation && screen.orientation.lock) {
            try {
                screen.orientation.lock('portrait').catch(() => {});
            } catch (e) {}
        }
    }

    async function init() {
        lockAdmin();
        updateDeviceMetrics();
        window.addEventListener('resize', updateDeviceMetrics, { passive: true });
        window.addEventListener('orientationchange', updateDeviceMetrics, { passive: true });

        // Auto re-sync when user returns or switches tabs
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible' && currentUser) {
                try {
                    await window.db.syncCloudUserData(currentUser.id, currentUser.email);
                    allContent = await window.db.getContentItems();
                    await loadUserData();
                } catch (e) {}
            }
        });

        window.db.onAuthStateChange(async (event, session) => {
            currentUser = session?.user || null;
            if (!currentUser) {
                lockAdmin();
                if (settingsModal) settingsModal.classList.add('hidden');
                if (currentView === 'changelog') switchView('library');
            }
            updateAuthUI();
            if (currentUser && event === 'SIGNED_IN') {
                try {
                    await window.db.syncCloudUserData(currentUser.id, currentUser.email);
                    allContent = await window.db.getContentItems();
                    await healLibraryServices();
                    await loadUserData();
                } catch (e) {
                    console.warn("Auth change sync error:", e);
                }
            } else if (!currentUser) {
                await loadUserData();
            }
        });

        currentUser = await window.db.getCurrentUser();
        updateAuthUI();
        if (currentUser) {
            await window.db.syncCloudUserData(currentUser.id, currentUser.email);
        }
        
        allServices = await window.db.getStreamingServices();
        allContent = await window.db.getContentItems();
        await healLibraryServices();

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
            authStatusBadge.title = currentUser.email;
            authStatusBadge.classList.add('logged-in');
            authBtn.textContent = 'Logout';
        } else {
            authStatusBadge.textContent = 'Guest (Local)';
            authStatusBadge.title = 'Guest Session (Local)';
            authStatusBadge.classList.remove('logged-in');
            authBtn.textContent = 'Login';
        }
        // Always make Settings button accessible
        if (addShowsBtn) addShowsBtn.classList.remove('hidden');
        settingsBtn.classList.remove('hidden');
    }

    // --- Navigation & View Switching ---
    function switchView(viewName, targetService = null) {
        if (viewName === 'changelog' && !isAdminAuthenticated) {
            requireAdminAuth(() => switchView('changelog'));
            return;
        }

        if (viewName !== 'changelog') {
            lockAdmin();
        }

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
        if (viewChangelog) {
            viewChangelog.classList.toggle('active', viewName === 'changelog');
            viewChangelog.style.display = viewName === 'changelog' ? 'block' : 'none';
        }
        if (viewShowTracker) {
            viewShowTracker.classList.toggle('active', viewName === 'show-tracker');
            viewShowTracker.style.display = viewName === 'show-tracker' ? 'block' : 'none';
        }
        if (viewRemote) {
            viewRemote.classList.toggle('active', viewName === 'remote');
            viewRemote.style.display = viewName === 'remote' ? 'block' : 'none';
        }
        if (viewName !== 'show-tracker') {
            activeVideoEpisodeKey = null;
        }

        if (viewName === 'library') {
            renderContinueWatching();
            renderLibrary();
        } else if (viewName === 'recommendations') {
            renderSmartRecommendationsView();
        } else if (viewName === 'explore') {
            if (targetService && typeof targetService === 'string') {
                currentExploreService = targetService;
                if (exploreServiceFilters) {
                    exploreServiceFilters.querySelectorAll('.pill-btn').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.service === targetService);
                    });
                }
                if (mobileExploreSelect) {
                    mobileExploreSelect.value = targetService;
                }
            }
            renderServiceDiscovery(currentExploreService);
        } else if (viewName === 'show-tracker') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            if (targetService) {
                renderShowTracker(targetService);
            }
        } else if (viewName === 'remote') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            if (typeof updateRokuRemoteHeaderDisplay === 'function') {
                updateRokuRemoteHeaderDisplay();
            }
        } else if (viewName === 'changelog') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
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

    // --- Show Watch Data & Season/Episode Tracker ---
    function getShowWatchData(showId) {
        const idStr = String(showId || '');
        const uuid = window.db?.toDeterministicUuid ? window.db.toDeterministicUuid(idStr) : idStr;
        const found = userWatchlist.find(w => 
            String(w.content_item_id) === idStr || 
            String(w.content_item_id) === uuid
        );
        return found || {
            status: 'none',
            rating: null,
            episodes_watched: {},
            completed_seasons: [],
            archived: false,
            watched_count: 0,
            total_episodes: 0
        };
    }

    const showSeasonsCache = {};
    const seasonEpisodesCache = {};

    async function getTmdbKey() {
        return (await window.db.getSystemSetting('tmdb_api_key')) || localStorage.getItem('tmdb_api_key') || '';
    }

    async function fetchShowSeasonsData(showItem) {
        const showId = String(showItem.id);
        const tmdbId = String(showItem.tmdb_id || showItem.id || '');
        if (showSeasonsCache[showId]) return showSeasonsCache[showId];

        const key = await getTmdbKey();
        let details = null;
        let seasons = [];

        if (key && tmdbId && !tmdbId.startsWith('custom_')) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);
                const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${key}&language=en-US&append_to_response=external_ids,credits,videos`, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (res.ok) {
                    details = await res.json();
                    if (Array.isArray(details.seasons) && details.seasons.length > 0) {
                        const regular = details.seasons.filter(s => s.season_number > 0).sort((a, b) => a.season_number - b.season_number);
                        const specials = details.seasons.filter(s => s.season_number === 0 && s.episode_count > 0);
                        seasons = [...regular, ...specials];
                    }
                }
            } catch (err) {
                console.warn("fetchShowSeasonsData error:", err);
            }
        }

        if (!seasons || seasons.length === 0) {
            seasons = [
                {
                    season_number: 1,
                    name: 'Season 1',
                    episode_count: showItem.episode_count || 8,
                    air_date: showItem.release_year ? `${showItem.release_year}-01-01` : ''
                }
            ];
        }

        const result = { details, seasons };
        showSeasonsCache[showId] = result;
        return result;
    }

    async function fetchSeasonEpisodesData(showItem, seasonNumber) {
        const showId = String(showItem.id);
        const tmdbId = String(showItem.tmdb_id || showItem.id || '');
        const cacheKey = `${showId}_s${seasonNumber}`;
        if (seasonEpisodesCache[cacheKey]) return seasonEpisodesCache[cacheKey];

        const key = await getTmdbKey();
        let episodes = [];

        if (key && tmdbId && !tmdbId.startsWith('custom_')) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);
                const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}?api_key=${key}&language=en-US`, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data.episodes) && data.episodes.length > 0) {
                        episodes = data.episodes.map(ep => ({
                            episode_number: ep.episode_number,
                            season_number: seasonNumber,
                            name: ep.name || `Episode ${ep.episode_number}`,
                            overview: ep.overview || 'No episode synopsis available.',
                            air_date: ep.air_date || '',
                            runtime: ep.runtime || null,
                            still_path: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : null,
                            vote_average: ep.vote_average ? Math.round(ep.vote_average * 10) / 10 : null
                        }));
                    }
                }
            } catch (err) {
                console.warn("fetchSeasonEpisodesData error:", err);
            }
        }

        if (episodes.length === 0) {
            const count = 8;
            for (let i = 1; i <= count; i++) {
                episodes.push({
                    episode_number: i,
                    season_number: seasonNumber,
                    name: `Episode ${i}`,
                    overview: `Episode ${i} of ${showItem.title}.`,
                    air_date: '',
                    runtime: 45,
                    still_path: null,
                    vote_average: null
                });
            }
        }

        seasonEpisodesCache[cacheKey] = episodes;
        return episodes;
    }

    function getTmdbUsWatchUrl(showItem) {
        const tmdbId = String(showItem?.tmdb_id || showItem?.id || '');
        if (tmdbId && !tmdbId.startsWith('custom_')) {
            return `https://www.themoviedb.org/tv/${tmdbId}/watch?locale=US`;
        }
        const title = showItem?.title || showItem?.name || '';
        return `https://www.google.com/search?q=${encodeURIComponent(`watch ${title} united states streaming`)}`;
    }

    function getProviderWatchUrl(showItem, seasonNumber, episodeNumber) {
        const title = showItem?.title || showItem?.name || 'Show';
        const cleanTitle = encodeURIComponent(title);
        const epSearchTerm = encodeURIComponent(`${title} Season ${seasonNumber} Episode ${episodeNumber}`);
        const serviceKey = detectShowServiceSync(showItem) || (showItem.streaming_services?.name || showItem.mock_service || '').toLowerCase();

        if (serviceKey.includes('disney')) {
            return `https://www.disneyplus.com/en-us/home`;
        }
        if (serviceKey.includes('netflix')) {
            return `https://www.netflix.com/search?q=${cleanTitle}`;
        }
        if (serviceKey.includes('peacock')) {
            return `https://www.peacocktv.com/watch/home`;
        }
        if (serviceKey.includes('hulu')) {
            return `https://www.hulu.com/search?q=${cleanTitle}`;
        }
        if (serviceKey.includes('prime') || serviceKey.includes('amazon')) {
            return `https://www.amazon.com/s?k=${cleanTitle}&i=instant-video`;
        }
        if (serviceKey.includes('apple') || serviceKey.includes('appletv')) {
            return `https://tv.apple.com/us/search?term=${cleanTitle}`;
        }
        if (serviceKey.includes('youtube')) {
            return `https://tv.youtube.com/search/${cleanTitle}`;
        }
        return `https://www.google.com/search?q=${encodeURIComponent(`watch ${title} season ${seasonNumber} episode ${episodeNumber} streaming US`)}`;
    }

    async function fetchEpisodeVideoData(showItem, seasonNumber, episodeNumber) {
        const showId = String(showItem.id);
        const tmdbId = String(showItem.tmdb_id || showItem.id || '');
        const cacheKey = `${showId}_s${seasonNumber}_e${episodeNumber}`;
        if (episodeVideosCache[cacheKey]) return episodeVideosCache[cacheKey];

        const key = await getTmdbKey();
        let videoData = null;

        if (key && tmdbId && !tmdbId.startsWith('custom_')) {
            // 1. Try TMDB Episode Videos endpoint
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);
                const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}/episode/${episodeNumber}/videos?api_key=${key}&language=en-US`, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data.results) && data.results.length > 0) {
                        const ytVideo = data.results.find(v => v.site === 'YouTube' && (v.type === 'Clip' || v.type === 'Teaser' || v.type === 'Trailer' || v.type === 'Featurette')) 
                            || data.results.find(v => v.site === 'YouTube');
                        if (ytVideo && ytVideo.key) {
                            videoData = {
                                key: ytVideo.key,
                                title: ytVideo.name || `${showItem.title} S${seasonNumber}E${episodeNumber}`,
                                type: ytVideo.type || 'Official Clip',
                                site: 'YouTube',
                                embedUrl: `https://www.youtube-nocookie.com/embed/${ytVideo.key}?autoplay=1&rel=0`,
                                directUrl: `https://www.youtube.com/watch?v=${ytVideo.key}`
                            };
                        }
                    }
                }
            } catch (err) {
                console.warn("fetchEpisodeVideoData episode video error:", err);
            }

            // 2. Fallback to Show-level videos if episode has no specific video
            if (!videoData) {
                try {
                    const { details } = await fetchShowSeasonsData(showItem);
                    const showVideos = details?.videos?.results;
                    if (Array.isArray(showVideos) && showVideos.length > 0) {
                        const ytVideo = showVideos.find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')) 
                            || showVideos.find(v => v.site === 'YouTube');
                        if (ytVideo && ytVideo.key) {
                            videoData = {
                                key: ytVideo.key,
                                title: ytVideo.name || `${showItem.title} Preview`,
                                type: ytVideo.type || 'Official Trailer',
                                site: 'YouTube',
                                embedUrl: `https://www.youtube-nocookie.com/embed/${ytVideo.key}?autoplay=1&rel=0`,
                                directUrl: `https://www.youtube.com/watch?v=${ytVideo.key}`
                            };
                        }
                    }
                } catch (err) {
                    console.warn("fetchEpisodeVideoData show-level fallback error:", err);
                }
            }
        }

        // 3. Fallback to privacy-friendly YouTube search embed
        if (!videoData) {
            const query = `${showItem.title} Season ${seasonNumber} Episode ${episodeNumber}`;
            videoData = {
                key: null,
                title: `${showItem.title} - S${seasonNumber}E${episodeNumber}`,
                type: 'Episode Stream / Clip',
                site: 'YouTube',
                embedUrl: `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(query)}&autoplay=1`,
                directUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
            };
        }

        episodeVideosCache[cacheKey] = videoData;
        return videoData;
    }

    async function toggleEpisodeWatched(showItem, seasonNumber, episodeNumber, currentSeasonEpisodes, allSeasons) {
        const idStr = String(showItem.id);
        const watchData = getShowWatchData(showItem.id);
        const watchedMap = { ...(watchData.episodes_watched || {}) };
        const epKey = `s${seasonNumber}_e${episodeNumber}`;

        const isNowWatched = !watchedMap[epKey];
        if (isNowWatched) {
            watchedMap[epKey] = true;
        } else {
            delete watchedMap[epKey];
        }

        const completedSeasons = Array.isArray(watchData.completed_seasons) ? [...watchData.completed_seasons] : [];
        const seasonEpisodesCount = currentSeasonEpisodes.length;
        let seasonWatchedCount = 0;
        currentSeasonEpisodes.forEach(ep => {
            if (watchedMap[`s${seasonNumber}_e${ep.episode_number}`]) seasonWatchedCount++;
        });

        const seasonIdx = completedSeasons.indexOf(seasonNumber);
        if (seasonWatchedCount === seasonEpisodesCount && seasonEpisodesCount > 0) {
            if (seasonIdx === -1) completedSeasons.push(seasonNumber);
        } else {
            if (seasonIdx >= 0) completedSeasons.splice(seasonIdx, 1);
        }

        let totalSeriesEpisodes = 0;
        (allSeasons || []).forEach(s => { totalSeriesEpisodes += (s.episode_count || 0); });
        if (totalSeriesEpisodes === 0) totalSeriesEpisodes = currentSeasonEpisodes.length;
        const watchedCount = Object.keys(watchedMap).filter(k => watchedMap[k]).length;

        let newStatus = watchData.status;
        let isArchived = Boolean(watchData.archived);

        if (isNowWatched && (newStatus === 'none' || newStatus === 'want_to_watch')) {
            newStatus = 'watching';
        }

        const uuid = window.db?.toDeterministicUuid ? window.db.toDeterministicUuid(idStr) : idStr;
        const existingIdx = userWatchlist.findIndex(w => String(w.content_item_id) === idStr || String(w.content_item_id) === uuid);
        const updatedEntry = {
            content_item_id: uuid,
            status: newStatus,
            rating: watchData.rating || null,
            episodes_watched: watchedMap,
            completed_seasons: completedSeasons,
            archived: isArchived,
            watched_count: watchedCount,
            total_episodes: totalSeriesEpisodes,
            updated_at: new Date().toISOString()
        };

        if (existingIdx >= 0) {
            userWatchlist[existingIdx] = { ...userWatchlist[existingIdx], ...updatedEntry };
        } else {
            userWatchlist.push(updatedEntry);
        }

        await window.db.upsertWatchlistItem(currentUser?.id || null, idStr, newStatus, watchData.rating || null, {
            episodes_watched: watchedMap,
            completed_seasons: completedSeasons,
            archived: isArchived,
            watched_count: watchedCount,
            total_episodes: totalSeriesEpisodes
        });

        renderShowTracker(showItem, seasonNumber);
        updateLibraryCounters();
    }

    async function toggleSeasonWatched(showItem, seasonNumber, currentSeasonEpisodes, markAsWatched) {
        const idStr = String(showItem.id);
        const watchData = getShowWatchData(showItem.id);
        const watchedMap = { ...(watchData.episodes_watched || {}) };
        const completedSeasons = Array.isArray(watchData.completed_seasons) ? [...watchData.completed_seasons] : [];

        currentSeasonEpisodes.forEach(ep => {
            const epKey = `s${seasonNumber}_e${ep.episode_number}`;
            if (markAsWatched) {
                watchedMap[epKey] = true;
            } else {
                delete watchedMap[epKey];
            }
        });

        const seasonIdx = completedSeasons.indexOf(seasonNumber);
        if (markAsWatched) {
            if (seasonIdx === -1) completedSeasons.push(seasonNumber);
        } else {
            if (seasonIdx >= 0) completedSeasons.splice(seasonIdx, 1);
        }

        let newStatus = watchData.status;
        if (markAsWatched && (newStatus === 'none' || newStatus === 'want_to_watch')) {
            newStatus = 'watching';
        }

        const watchedCount = Object.keys(watchedMap).filter(k => watchedMap[k]).length;
        const uuid = window.db?.toDeterministicUuid ? window.db.toDeterministicUuid(idStr) : idStr;
        const existingIdx = userWatchlist.findIndex(w => String(w.content_item_id) === idStr || String(w.content_item_id) === uuid);
        const updatedEntry = {
            content_item_id: uuid,
            status: newStatus,
            rating: watchData.rating || null,
            episodes_watched: watchedMap,
            completed_seasons: completedSeasons,
            archived: Boolean(watchData.archived),
            watched_count: watchedCount,
            total_episodes: watchData.total_episodes || (currentSeasonEpisodes.length || 8),
            updated_at: new Date().toISOString()
        };

        if (existingIdx >= 0) {
            userWatchlist[existingIdx] = { ...userWatchlist[existingIdx], ...updatedEntry };
        } else {
            userWatchlist.push(updatedEntry);
        }

        await window.db.upsertWatchlistItem(currentUser?.id || null, idStr, newStatus, watchData.rating || null, {
            episodes_watched: watchedMap,
            completed_seasons: completedSeasons,
            archived: Boolean(watchData.archived),
            watched_count: watchedCount,
            total_episodes: updatedEntry.total_episodes
        });

        showToast(markAsWatched ? `✓ Season ${seasonNumber} marked complete!` : `Season ${seasonNumber} unchecked.`, 'info');
        renderShowTracker(showItem, seasonNumber);
        updateLibraryCounters();
    }

    async function markSeriesCompleteAndArchive(showItem, allSeasons) {
        const idStr = String(showItem.id);
        const watchData = getShowWatchData(showItem.id);
        const watchedMap = { ...(watchData.episodes_watched || {}) };
        const completedSeasons = (allSeasons || []).map(s => s.season_number);

        for (const s of (allSeasons || [])) {
            const count = s.episode_count || 8;
            for (let i = 1; i <= count; i++) {
                watchedMap[`s${s.season_number}_e${i}`] = true;
            }
        }

        const watchedCount = Object.keys(watchedMap).filter(k => watchedMap[k]).length;
        const uuid = window.db?.toDeterministicUuid ? window.db.toDeterministicUuid(idStr) : idStr;
        const existingIdx = userWatchlist.findIndex(w => String(w.content_item_id) === idStr || String(w.content_item_id) === uuid);
        
        const updatedEntry = {
            content_item_id: uuid,
            status: 'completed',
            rating: watchData.rating || null,
            episodes_watched: watchedMap,
            completed_seasons: completedSeasons,
            archived: true,
            watched_count: watchedCount,
            total_episodes: watchedCount,
            updated_at: new Date().toISOString()
        };

        if (existingIdx >= 0) {
            userWatchlist[existingIdx] = { ...userWatchlist[existingIdx], ...updatedEntry };
        } else {
            userWatchlist.push(updatedEntry);
        }

        await window.db.upsertWatchlistItem(currentUser?.id || null, idStr, 'completed', watchData.rating || null, {
            episodes_watched: watchedMap,
            completed_seasons: completedSeasons,
            archived: true,
            watched_count: watchedCount,
            total_episodes: watchedCount
        });

        showToast(`✓ "${showItem.title}" marked complete & moved to Archive!`, 'success', 3500);
        renderShowTracker(showItem, currentTrackerSeason);
        updateLibraryCounters();
    }

    async function reopenSeries(showItem) {
        const idStr = String(showItem.id);
        const watchData = getShowWatchData(showItem.id);
        const uuid = window.db?.toDeterministicUuid ? window.db.toDeterministicUuid(idStr) : idStr;
        const existingIdx = userWatchlist.findIndex(w => String(w.content_item_id) === idStr || String(w.content_item_id) === uuid);

        const updatedEntry = {
            content_item_id: uuid,
            status: 'watching',
            rating: watchData.rating || null,
            episodes_watched: watchData.episodes_watched || {},
            completed_seasons: watchData.completed_seasons || [],
            archived: false,
            watched_count: watchData.watched_count || 0,
            total_episodes: watchData.total_episodes || 0,
            updated_at: new Date().toISOString()
        };

        if (existingIdx >= 0) {
            userWatchlist[existingIdx] = { ...userWatchlist[existingIdx], ...updatedEntry };
        } else {
            userWatchlist.push(updatedEntry);
        }

        await window.db.upsertWatchlistItem(currentUser?.id || null, idStr, 'watching', watchData.rating || null, {
            episodes_watched: watchData.episodes_watched || {},
            completed_seasons: watchData.completed_seasons || [],
            archived: false,
            watched_count: watchData.watched_count || 0,
            total_episodes: watchData.total_episodes || 0
        });

        showToast(`"${showItem.title}" reopened and moved to Watching.`, 'info');
        renderShowTracker(showItem, currentTrackerSeason);
        updateLibraryCounters();
    }

    async function renderShowTracker(showItem, requestedSeason = null) {
        if (!showTrackerContent) return;
        if (!currentTrackerShow || String(currentTrackerShow.id) !== String(showItem.id)) {
            activeVideoEpisodeKey = null;
        }
        currentTrackerShow = showItem;

        if (trackerCrumbTitle) {
            trackerCrumbTitle.textContent = showItem.title || 'Show Tracker';
        }

        showTrackerContent.innerHTML = `
            <div style="padding: 60px 20px; text-align: center;">
                <div class="skeleton-loader" style="width: 180px; height: 36px; margin: 0 auto 16px auto; border-radius: 8px;"></div>
                <h3 style="font-size: 1.4rem; margin-bottom: 8px;">Loading Seasons for ${showItem.title}...</h3>
                <p style="color: var(--text-muted); font-size: 0.95rem;">Retrieving official episode guides, runtimes, and season progress...</p>
                <div class="skeleton-loader" style="width: 70%; max-width: 600px; height: 16px; margin: 25px auto 10px auto; border-radius: 4px;"></div>
            </div>
        `;

        const { details, seasons } = await fetchShowSeasonsData(showItem);

        let activeSeasonNum = requestedSeason;
        if (activeSeasonNum === null) {
            const watchData = getShowWatchData(showItem.id);
            const compSeasons = watchData.completed_seasons || [];
            const uncompletedSeason = seasons.find(s => !compSeasons.includes(s.season_number));
            activeSeasonNum = uncompletedSeason ? uncompletedSeason.season_number : (seasons[0]?.season_number || 1);
        }
        currentTrackerSeason = activeSeasonNum;

        const currentEpisodes = await fetchSeasonEpisodesData(showItem, activeSeasonNum);

        let activeVideoData = null;
        if (activeVideoEpisodeKey && activeVideoEpisodeKey.startsWith(`s${activeSeasonNum}_e`)) {
            const activeEpNum = parseInt(activeVideoEpisodeKey.split('_e')[1], 10);
            activeVideoData = await fetchEpisodeVideoData(showItem, activeSeasonNum, activeEpNum);
        }

        const watchData = getShowWatchData(showItem.id);
        const watchedMap = watchData.episodes_watched || {};
        
        let totalSeriesEpisodes = 0;
        seasons.forEach(s => {
            totalSeriesEpisodes += (s.episode_count || 0);
        });
        if (totalSeriesEpisodes === 0) {
            totalSeriesEpisodes = seasons.length * (currentEpisodes.length || 8);
        }

        let watchedCount = 0;
        Object.keys(watchedMap).forEach(key => {
            if (watchedMap[key]) watchedCount++;
        });

        const safeTotal = Math.max(totalSeriesEpisodes, watchedCount, 1);
        const percent = Math.min(100, Math.round((watchedCount / safeTotal) * 100));

        let seasonWatchedCount = 0;
        currentEpisodes.forEach(ep => {
            const epKey = `s${activeSeasonNum}_e${ep.episode_number}`;
            if (watchedMap[epKey]) seasonWatchedCount++;
        });
        const isSeasonAllWatched = currentEpisodes.length > 0 && seasonWatchedCount === currentEpisodes.length;
        const isSeriesComplete = watchData.status === 'completed' || watchData.archived;

        const serviceName = resolveItemServiceName(showItem);
        const posterImg = showItem.poster_url || (details?.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : 'https://via.placeholder.com/300x450?text=' + encodeURIComponent(showItem.title));
        const backdropImg = details?.backdrop_path ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}` : '';
        const ratingVal = details?.vote_average ? (Math.round(details.vote_average * 10) / 10) : 8.2;
        const yearVal = showItem.release_year || (details?.first_air_date ? details.first_air_date.split('-')[0] : 'N/A');
        const overview = details?.overview || showItem.overview || 'Track your season and episode progress below. Check off episodes as you watch them.';

        showTrackerContent.innerHTML = `
            <div class="tracker-hero" style="${backdropImg ? `background-image: url('${backdropImg}');` : 'background: #0f1424;'}">
                <div class="tracker-hero-overlay"></div>
                <div class="tracker-hero-content">
                    <img src="${posterImg}" class="tracker-poster-thumb" alt="${showItem.title.replace(/"/g, '&quot;')}" onerror="this.onerror=null;this.src='https://via.placeholder.com/300x450?text=No+Poster';">
                    <div class="tracker-hero-meta">
                        <div class="tracker-title-row">
                            <h2 class="tracker-show-title">${showItem.title}</h2>
                            ${isSeriesComplete ? '<span class="badge-archived">📦 Series Archived</span>' : '<span class="badge-watching">🎬 In Library</span>'}
                        </div>
                        <div class="tracker-meta-tags">
                            <span class="tracker-service-pill">${serviceName}</span>
                            <span class="tracker-meta-pill">${yearVal}</span>
                            <span class="tracker-meta-pill">${seasons.length} Season${seasons.length === 1 ? '' : 's'}</span>
                            <span class="tracker-meta-pill rating-gold">★ ${ratingVal}</span>
                        </div>
                        <p class="tracker-overview">${overview}</p>
                    </div>
                </div>
            </div>

            <div class="tracker-progress-card">
                <div class="tracker-progress-header">
                    <div>
                        <div class="tracker-progress-title">
                            <h3>Overall Series Progress</h3>
                            <span class="tracker-progress-badge">${watchedCount} of ${safeTotal} Episodes Watched (${percent}%)</span>
                        </div>
                        <p class="tracker-progress-sub">Check off episodes as you finish them. When you are done with a season or the entire series, mark it complete to move it into your library archive.</p>
                    </div>
                    <div class="tracker-series-actions">
                        ${isSeriesComplete 
                            ? `<button type="button" class="btn secondary-btn btn-toggle-series-archive" id="btn-toggle-series-archive" data-action="unarchive">
                                  <span>↺</span> Reopen Series (Move to Watching)
                               </button>`
                            : `<button type="button" class="btn primary-btn btn-toggle-series-archive" id="btn-toggle-series-archive" data-action="archive">
                                  <span>📦</span> Mark Series Complete &amp; Move to Archive
                               </button>`
                        }
                        <div class="tracker-rating-bar">
                            <span style="font-size: 0.85rem; color: var(--text-muted);">Rating:</span>
                            <button class="rating-btn up ${watchData.rating === 'thumbs_up' ? 'active' : ''}" id="tracker-thumbs-up" data-id="${showItem.id}" title="Thumbs Up">👍</button>
                            <button class="rating-btn down ${watchData.rating === 'thumbs_down' ? 'active' : ''}" id="tracker-thumbs-down" data-id="${showItem.id}" title="Thumbs Down">👎</button>
                        </div>
                    </div>
                </div>
                <div class="tracker-bar-container">
                    <div class="tracker-bar-fill" style="width: ${percent}%;"></div>
                </div>
            </div>

            <div class="tracker-seasons-bar">
                <div class="tracker-season-tabs" id="tracker-season-tabs">
                    ${seasons.map(s => {
                        const isSelected = s.season_number === activeSeasonNum;
                        const isSeasonDone = (watchData.completed_seasons || []).includes(s.season_number);
                        return `
                            <button type="button" class="season-tab-btn ${isSelected ? 'active' : ''} ${isSeasonDone ? 'season-done' : ''}" data-season="${s.season_number}">
                                ${s.name || `Season ${s.season_number}`}
                                <span class="season-tab-count">${s.episode_count ? `(${s.episode_count} eps)` : ''}</span>
                                ${isSeasonDone ? '<span class="season-check-icon">✓</span>' : ''}
                            </button>
                        `;
                    }).join('')}
                </div>
                <div class="tracker-season-action-btn-wrap">
                    <button type="button" class="btn secondary-btn" id="btn-toggle-season-complete" data-season="${activeSeasonNum}" data-allwatched="${isSeasonAllWatched}">
                        ${isSeasonAllWatched ? `<span>↺</span> Uncheck Season ${activeSeasonNum}` : `<span>✓</span> Mark Season ${activeSeasonNum} Complete`}
                    </button>
                </div>
            </div>

            <div class="tracker-episodes-header">
                <h3 style="margin: 0; font-size: 1.25rem;">
                    Season ${activeSeasonNum} Episodes 
                    <span style="font-size: 0.9rem; color: var(--text-muted); font-weight: normal;">(${seasonWatchedCount}/${currentEpisodes.length} watched)</span>
                </h3>
            </div>

            <div class="tracker-episodes-list" id="tracker-episodes-list">
                ${currentEpisodes.map(ep => {
                    const epKey = `s${activeSeasonNum}_e${ep.episode_number}`;
                    const isWatched = Boolean(watchedMap[epKey]);
                    const isPlaying = activeVideoEpisodeKey === epKey;
                    const still = ep.still_path || posterImg;
                    const runtimeStr = ep.runtime ? `${ep.runtime} min` : '';
                    const airDateStr = ep.air_date ? new Date(ep.air_date + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
                    const providerWatchUrl = getProviderWatchUrl(showItem, activeSeasonNum, ep.episode_number);
                    const usWatchUrl = getTmdbUsWatchUrl(showItem);

                    let inlineTheaterHtml = '';
                    if (isPlaying && activeVideoData) {
                        inlineTheaterHtml = `
                            <div class="episode-inline-theater animate-fadeIn" id="theater-${epKey}">
                                <div class="theater-header">
                                    <div class="theater-status">
                                        <span class="theater-beacon"></span>
                                        <span class="theater-badge">${serviceName} (US)</span>
                                        <span class="theater-title" title="${activeVideoData.title.replace(/"/g, '&quot;')}">${activeVideoData.title}</span>
                                        <span class="theater-type-pill">${activeVideoData.type}</span>
                                    </div>
                                    <div class="theater-actions">
                                        <a href="${providerWatchUrl}" target="_blank" rel="noopener noreferrer" class="theater-ext-btn provider-btn" title="Watch on ${serviceName} (US)">
                                            <span>📺 ${serviceName} (US)</span> ↗
                                        </a>
                                        <a href="${usWatchUrl}" target="_blank" rel="noopener noreferrer" class="theater-ext-btn provider-btn" style="background: rgba(0, 195, 255, 0.08); border-color: rgba(0, 195, 255, 0.35);" title="View all United States streaming availability on JustWatch / TMDB">
                                            <span>🇺🇸 US Streams</span> ↗
                                        </a>
                                        <a href="${activeVideoData.directUrl}" target="_blank" rel="noopener noreferrer" class="theater-ext-btn youtube-btn" title="Open video on YouTube">
                                            <span>YouTube</span> ↗
                                        </a>
                                        <button type="button" class="theater-close-btn" data-season="${activeSeasonNum}" data-episode="${ep.episode_number}" title="Close Video Player" aria-label="Close Player">✕</button>
                                    </div>
                                </div>

                                <div class="theater-iframe-container">
                                    <iframe 
                                        src="${activeVideoData.embedUrl}" 
                                        title="${showItem.title.replace(/"/g, '&quot;')} - S${activeSeasonNum}E${ep.episode_number} ${ep.name.replace(/"/g, '&quot;')}" 
                                        class="theater-iframe" 
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                                        referrerpolicy="strict-origin-when-cross-origin" 
                                        allowfullscreen>
                                    </iframe>
                                </div>

                                <div class="theater-fallback-bar">
                                    <div class="theater-fallback-info">
                                        <span class="theater-fallback-icon">💡</span>
                                        <span>Trouble playing inline? (Some mobile browsers block third-party embeds)</span>
                                    </div>
                                    <div class="theater-fallback-actions">
                                        <a href="${providerWatchUrl}" target="_blank" rel="noopener noreferrer" class="theater-fallback-link provider">
                                            Open ${serviceName} (US) ↗
                                        </a>
                                        <span class="theater-fallback-divider">•</span>
                                        <a href="${usWatchUrl}" target="_blank" rel="noopener noreferrer" class="theater-fallback-link" style="color: #00c3ff;">
                                            All US Streams ↗
                                        </a>
                                        <span class="theater-fallback-divider">•</span>
                                        <a href="${activeVideoData.directUrl}" target="_blank" rel="noopener noreferrer" class="theater-fallback-link youtube">
                                            Watch on YouTube ↗
                                        </a>
                                    </div>
                                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 6px; text-align: center; line-height: 1.4;">
                                        ℹ️ <em>Mobile browser notice:</em> Disney+ &amp; Netflix enforce DRM policies that restrict full episode playback to their official apps on iPad/iPhone. Full in-browser web playback is supported on desktop &amp; laptop browsers.
                                    </div>
                                </div>
                            </div>
                        `;
                    }

                    return `
                        <div class="episode-card ${isWatched ? 'is-watched' : ''} ${isPlaying ? 'is-playing' : ''}" id="ep-card-${activeSeasonNum}-${ep.episode_number}">
                            <div class="episode-card-main">
                                <div class="episode-still-col">
                                    <div class="episode-still-img" style="background-image: url('${still}')">
                                        ${runtimeStr ? `<span class="episode-runtime-pill">${runtimeStr}</span>` : ''}
                                        ${isWatched ? '<span class="episode-watched-badge">✓ Watched</span>' : ''}
                                    </div>
                                </div>
                                <div class="episode-info-col">
                                    <div class="episode-header-line">
                                        <h4 class="episode-title">
                                            <span class="ep-num-pill">E${ep.episode_number}</span>
                                            ${ep.name}
                                        </h4>
                                        ${ep.vote_average ? `<span class="ep-rating-pill">★ ${ep.vote_average}</span>` : ''}
                                    </div>
                                    <div class="episode-sub-meta">
                                        ${airDateStr ? `<span>Aired: ${airDateStr}</span>` : ''}
                                    </div>
                                    <p class="episode-overview">${ep.overview}</p>
                                </div>
                                <div class="episode-action-col">
                                    <button type="button" class="btn-watch-episode ${isPlaying ? 'is-playing' : ''}" 
                                        data-season="${activeSeasonNum}" 
                                        data-episode="${ep.episode_number}"
                                        title="${isPlaying ? 'Close inline video player' : 'Watch episode preview & clips inline'}">
                                        ${isPlaying ? '<span>✕</span> Close Player' : '<span>▶</span> Watch Episode'}
                                    </button>
                                    <button type="button" class="btn-play-on-roku" 
                                        data-season="${activeSeasonNum}" 
                                        data-episode="${ep.episode_number}"
                                        data-title="${encodeURIComponent(ep.name || '')}"
                                        title="Launch and play episode on your Roku TV">
                                        <span>📺</span> Play on Roku
                                    </button>
                                    <button type="button" class="btn-episode-toggle ${isWatched ? 'is-watched' : ''}" 
                                        data-season="${activeSeasonNum}" 
                                        data-episode="${ep.episode_number}"
                                        aria-label="Toggle watched status for Episode ${ep.episode_number}">
                                        ${isWatched ? '<span>✓</span> Watched' : '<span>○</span> Mark Watched'}
                                    </button>
                                </div>
                            </div>
                            ${inlineTheaterHtml}
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        const seasonTabs = showTrackerContent.querySelectorAll('.season-tab-btn');
        seasonTabs.forEach(btn => {
            btn.addEventListener('click', () => {
                const sNum = parseInt(btn.dataset.season, 10);
                renderShowTracker(showItem, sNum);
            });
        });

        const seasonToggleBtn = showTrackerContent.querySelector('#btn-toggle-season-complete');
        if (seasonToggleBtn) {
            seasonToggleBtn.addEventListener('click', async () => {
                const sNum = parseInt(seasonToggleBtn.dataset.season, 10);
                const allWatched = seasonToggleBtn.dataset.allwatched === 'true';
                await toggleSeasonWatched(showItem, sNum, currentEpisodes, !allWatched);
            });
        }

        const seriesArchiveBtn = showTrackerContent.querySelector('#btn-toggle-series-archive');
        if (seriesArchiveBtn) {
            seriesArchiveBtn.addEventListener('click', async () => {
                const action = seriesArchiveBtn.dataset.action;
                if (action === 'archive') {
                    await markSeriesCompleteAndArchive(showItem, seasons);
                } else {
                    await reopenSeries(showItem);
                }
            });
        }

        const thumbUp = showTrackerContent.querySelector('#tracker-thumbs-up');
        const thumbDown = showTrackerContent.querySelector('#tracker-thumbs-down');
        if (thumbUp) {
            thumbUp.addEventListener('click', async () => {
                const current = watchData.rating === 'thumbs_up' ? null : 'thumbs_up';
                await updateWatchState(showItem.id, watchData.status === 'none' ? 'watching' : watchData.status, current);
                renderShowTracker(showItem, activeSeasonNum);
            });
        }
        if (thumbDown) {
            thumbDown.addEventListener('click', async () => {
                const current = watchData.rating === 'thumbs_down' ? null : 'thumbs_down';
                await updateWatchState(showItem.id, watchData.status === 'none' ? 'watching' : watchData.status, current);
                renderShowTracker(showItem, activeSeasonNum);
            });
        }

        const watchEpisodeBtns = showTrackerContent.querySelectorAll('.btn-watch-episode');
        watchEpisodeBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const sNum = parseInt(btn.dataset.season, 10);
                const epNum = parseInt(btn.dataset.episode, 10);
                const epKey = `s${sNum}_e${epNum}`;

                if (activeVideoEpisodeKey === epKey) {
                    activeVideoEpisodeKey = null;
                    renderShowTracker(showItem, sNum);
                    return;
                }

                btn.disabled = true;
                btn.innerHTML = '<span>⏳</span> Loading...';
                activeVideoEpisodeKey = epKey;
                await fetchEpisodeVideoData(showItem, sNum, epNum);
                renderShowTracker(showItem, sNum);
            });
        });

        const theaterCloseBtns = showTrackerContent.querySelectorAll('.theater-close-btn');
        theaterCloseBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                activeVideoEpisodeKey = null;
                renderShowTracker(showItem, activeSeasonNum);
            });
        });

        const epToggles = showTrackerContent.querySelectorAll('.btn-episode-toggle');
        epToggles.forEach(btn => {
            btn.addEventListener('click', async () => {
                const sNum = parseInt(btn.dataset.season, 10);
                const epNum = parseInt(btn.dataset.episode, 10);
                await toggleEpisodeWatched(showItem, sNum, epNum, currentEpisodes, seasons);
            });
        });

        const epRokuBtns = showTrackerContent.querySelectorAll('.btn-play-on-roku');
        epRokuBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!window.RokuECP || !window.RokuECP.isConfigured()) {
                    showToast('Please configure your Roku IP in Settings first.', 'error');
                    requireAdminAuth(() => {
                        if (settingsModal) settingsModal.classList.remove('hidden');
                    });
                    return;
                }

                const sNum = parseInt(btn.dataset.season, 10);
                const epNum = parseInt(btn.dataset.episode, 10);
                const rawTitle = btn.dataset.title ? decodeURIComponent(btn.dataset.title) : '';
                
                showToast(`Casting "${showItem.title}" S${sNum}:E${epNum} to Roku TV...`, 'info');
                const res = await window.RokuECP.playShowOnRoku(showItem, {
                    season_number: sNum,
                    episode_number: epNum,
                    title: rawTitle
                });

                if (res.success) {
                    showToast(`Dispatched "${showItem.title}" to ${window.RokuECP.getName()}!`, 'success');
                } else {
                    showToast(res.message || 'Failed to send to Roku', 'error');
                }
            });
        });
    }

    function createCardHTML(item, isRecommendation = false) {
        const watchData = getShowWatchData(item.id);
        const status = watchData.status;
        const rating = watchData.rating;
        const isArchived = Boolean(watchData.archived || status === 'completed');
        
        const serviceName = resolveItemServiceName(item);
        const year = item.release_year || 'N/A';
        const poster = item.poster_url || 'https://via.placeholder.com/300x450?text=' + encodeURIComponent(item.title);
        
        let opacityClass = isArchived ? 'completed is-archived' : (status === 'dropped' ? 'dropped' : '');

        let cardHtml = `
            <div class="content-card ${opacityClass}">
                <div class="card-poster" style="background-image: url('${poster}')" data-id="${item.id}" title="Click to track episodes for ${item.title.replace(/"/g, '&quot;')}">
                    <span class="card-service-badge" style="text-transform: capitalize;">${serviceName}</span>
                    ${isArchived ? '<span class="card-archive-badge">📦 Archived</span>' : ''}
                </div>
                <div class="card-info">
                    <div class="card-title" data-id="${item.id}" title="Click to track episodes for ${item.title.replace(/"/g, '&quot;')}">${item.title}</div>
                    <div class="card-meta">${year}</div>
        `;

        if (!isRecommendation) {
            let progressHtml = '';
            const watchedCnt = watchData.watched_count !== undefined 
                ? watchData.watched_count 
                : Object.keys(watchData.episodes_watched || {}).filter(k => watchData.episodes_watched[k]).length;
            const totalCnt = watchData.total_episodes || (watchData.completed_seasons?.length ? watchData.completed_seasons.length * 8 : (watchedCnt > 0 ? Math.max(watchedCnt, 8) : 0));
            if (watchedCnt > 0 || totalCnt > 0) {
                const epPercent = Math.min(100, Math.round((watchedCnt / Math.max(totalCnt, 1)) * 100));
                progressHtml = `
                    <div class="card-progress-bar-wrap" title="${watchedCnt} of ${totalCnt || watchedCnt} episodes watched">
                        <div class="card-progress-label">
                            <span>${watchedCnt}/${totalCnt || watchedCnt} eps</span>
                            <span>${epPercent}%</span>
                        </div>
                        <div class="card-progress-track">
                            <div class="card-progress-fill" style="width: ${epPercent}%"></div>
                        </div>
                    </div>
                `;
            }

            cardHtml += `
                    ${progressHtml}
                    <div class="card-actions" style="flex-direction: column; gap: 0.5rem; align-items: stretch;">
                        <button type="button" class="btn secondary-btn btn-track-card" data-id="${item.id}" style="width: 100%; font-size: 0.82rem; padding: 6px 10px; display: inline-flex; align-items: center; justify-content: center; gap: 5px;">
                            <span>📋</span> Track Episodes &amp; Seasons
                        </button>
                        <select class="status-dropdown" data-id="${item.id}">
                            <option value="none" ${status === 'none' ? 'selected' : ''}>+ Add to List</option>
                            <option value="want_to_watch" ${status === 'want_to_watch' ? 'selected' : ''}>Want to Watch</option>
                            <option value="watching" ${status === 'watching' && !isArchived ? 'selected' : ''}>Watching</option>
                            <option value="completed" ${isArchived ? 'selected' : ''}>📦 Archive / Completed</option>
                            <option value="dropped" ${status === 'dropped' ? 'selected' : ''}>Not Interested</option>
                        </select>
            `;
            
            if (isArchived || status === 'completed') {
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
        const resolvedName = resolveItemServiceName(item);
        const rawName = resolvedName.toLowerCase().trim();
        if (!rawName || rawName === 'unknown') return false;

        const norm = filter.toLowerCase().trim();
        if (norm === 'disney') return rawName.includes('disney');
        if (norm === 'prime') return rawName.includes('prime') || rawName.includes('amazon');
        if (norm === 'youtube') return rawName.includes('youtube');
        if (norm === 'appletv' || norm === 'apple') return rawName.includes('apple');
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
                    const watchData = getShowWatchData(idStr);
                    const isArchived = Boolean(watchData.archived || watchData.status === 'completed');
                    
                    if (currentStatusFilter === 'completed') {
                        if (!isArchived) return false;
                    } else if (currentStatusFilter === 'watching') {
                        if (watchData.status !== 'watching' || isArchived) return false;
                    } else if (currentStatusFilter === 'want_to_watch') {
                        if (watchData.status !== 'want_to_watch' || isArchived) return false;
                    } else {
                        if (watchData.status !== currentStatusFilter) return false;
                    }
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
                        <button id="empty-lib-search-btn" class="btn primary-btn" style="font-size: 1rem; padding: 12px 24px;" onclick="openAddShowsModal()">+ Search & Add Shows</button>
                        <button class="btn secondary-btn" style="font-size: 1rem; padding: 12px 24px;" onclick="switchView('explore')">📺 Explore Streaming Services</button>
                    </div>
                </div>
            `;
            const emptyLibSearchBtn = document.getElementById('empty-lib-search-btn');
            if (emptyLibSearchBtn) {
                emptyLibSearchBtn.addEventListener('click', openAddShowsModal);
            }
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
                const statusNames = { watching: 'Currently Watching', want_to_watch: 'Want to Watch', completed: 'Archive' };
                const stName = statusNames[currentStatusFilter] || currentStatusFilter;
                const extraTip = currentStatusFilter === 'completed' 
                    ? '<p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 6px;">When you finish a season or series, mark it complete to move it into your archive.</p>' 
                    : '';
                catalogGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px dashed var(--border-subtle);">
                        <p style="color: var(--text-muted); font-size: 1.05rem;">You have 0 shows in <strong>${stName}</strong>.</p>
                        ${extraTip}
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
        if (mobileStatusSelect) mobileStatusSelect.value = 'all';
        if (mobileServiceSelect) mobileServiceSelect.value = 'all';
        renderLibrary();
    }
    window.resetLibraryFilters = resetLibraryFilters;

    function updateLibraryCounters() {
        const total = allContent.length;
        const watching = allContent.filter(c => {
            const w = getShowWatchData(c.id);
            return w.status === 'watching' && !w.archived;
        }).length;
        const want = allContent.filter(c => {
            const w = getShowWatchData(c.id);
            return w.status === 'want_to_watch' && !w.archived;
        }).length;
        const completed = allContent.filter(c => {
            const w = getShowWatchData(c.id);
            return w.status === 'completed' || w.archived;
        }).length;

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
        ['netflix', 'disney', 'peacock', 'hulu', 'prime', 'youtube', 'appletv'].forEach(svc => {
            const el = document.getElementById(`svc-count-${svc}`);
            if (el) {
                const count = allContent.filter(item => matchesServiceFilter(item, svc)).length;
                el.textContent = count > 0 ? `(${count})` : '';
            }
        });

        // Mobile dropdown labels with live counter badges
        if (mobileStatusSelect) {
            const optAll = mobileStatusSelect.querySelector('option[value="all"]');
            const optWatch = mobileStatusSelect.querySelector('option[value="watching"]');
            const optWant = mobileStatusSelect.querySelector('option[value="want_to_watch"]');
            const optComp = mobileStatusSelect.querySelector('option[value="completed"]');
            if (optAll) optAll.textContent = `All Shows (${total})`;
            if (optWatch) optWatch.textContent = `Watching (${watching})`;
            if (optWant) optWant.textContent = `Want to Watch (${want})`;
            if (optComp) optComp.textContent = `📦 Archive (${completed})`;
        }
        if (mobileServiceSelect) {
            ['netflix', 'disney', 'hulu', 'peacock', 'prime', 'youtube', 'appletv'].forEach(svc => {
                const opt = mobileServiceSelect.querySelector(`option[value="${svc}"]`);
                if (opt) {
                    const count = allContent.filter(item => matchesServiceFilter(item, svc)).length;
                    const metaName = serviceMeta[svc]?.name || svc;
                    opt.textContent = count > 0 ? `${metaName} (${count})` : metaName;
                }
            });
        }

        // Recs badge in main nav
        if (recCountBadge) {
            recCountBadge.style.display = total >= 2 ? 'inline-block' : 'none';
        }
    }

    function renderContinueWatching() {
        const watchingContent = allContent.filter(c => {
            const w = getShowWatchData(c.id);
            return w.status === 'watching' && !w.archived;
        });
        
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

    // --- IMDb Pop-up Modal System ---
    function closeImdbModal() {
        if (!imdbModal) return;
        imdbModal.classList.add('hidden');
        if (imdbModalBody) {
            imdbModalBody.innerHTML = '';
        }
    }
    window.closeImdbModal = closeImdbModal;

    async function openImdbModal(item) {
        if (!imdbModal || !imdbModalBody) return;
        imdbModal.classList.remove('hidden');

        const fallbackPoster = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450' viewBox='0 0 300 450'%3E%3Crect width='300' height='450' fill='%231e1e1e'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666' font-family='sans-serif' font-size='16'%3ENo Poster%3C/text%3E%3C/svg%3E";
        const title = item.title || item.name || 'Show Details';
        const cleanTitle = title.replace(/"/g, '&quot;');
        const rawPoster = item.poster || item.poster_path;
        const initialPoster = rawPoster ? (rawPoster.startsWith('http') ? rawPoster : `https://image.tmdb.org/t/p/w500${rawPoster}`) : fallbackPoster;
        const initialYear = item.year || (item.first_air_date ? item.first_air_date.split('-')[0] : '');
        const tmdbId = String(item.id || item.tmdb_id || '');

        // Loading state
        imdbModalBody.innerHTML = `
            <div style="padding: 50px 20px; text-align: center;">
                <div class="skeleton-loader" style="width: 140px; height: 32px; margin: 0 auto 16px auto; border-radius: 6px;"></div>
                <h3 style="margin-bottom: 8px; font-size: 1.4rem;">${cleanTitle}</h3>
                <p style="color: var(--text-muted); font-size: 0.95rem;">Retrieving official IMDb synopsis, ratings, and cast details...</p>
                <div class="skeleton-loader" style="width: 80%; max-width: 500px; height: 18px; margin: 25px auto 10px auto; border-radius: 4px;"></div>
                <div class="skeleton-loader" style="width: 65%; max-width: 400px; height: 18px; margin: 0 auto; border-radius: 4px;"></div>
            </div>
        `;

        let details = null;
        let imdbId = null;
        const key = await window.db.getSystemSetting('tmdb_api_key') || localStorage.getItem('tmdb_api_key');

        if (key && tmdbId && !tmdbId.startsWith('custom_')) {
            try {
                let res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${key}&language=en-US&append_to_response=external_ids,credits,content_ratings`);
                if (res.ok) {
                    details = await res.json();
                    imdbId = details.external_ids?.imdb_id || null;
                } else {
                    res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${key}&language=en-US&append_to_response=external_ids,credits,release_dates`);
                    if (res.ok) {
                        details = await res.json();
                        imdbId = details.external_ids?.imdb_id || null;
                    }
                }
            } catch (err) {
                console.warn("Failed fetching full TMDB details:", err);
            }
        }

        const imdbUrl = imdbId 
            ? `https://www.imdb.com/title/${imdbId}/` 
            : `https://www.imdb.com/find/?q=${encodeURIComponent(title)}`;
            
        const ratingVal = details?.vote_average 
            ? (Math.round(details.vote_average * 10) / 10) 
            : (item.rating || 8.0);
            
        const voteCount = details?.vote_count 
            ? Number(details.vote_count).toLocaleString() 
            : '';
            
        const yearVal = details?.first_air_date 
            ? details.first_air_date.split('-')[0] 
            : (details?.release_date ? details.release_date.split('-')[0] : (initialYear || 'TBA'));
            
        const posterImg = details?.poster_path 
            ? `https://image.tmdb.org/t/p/w500${details.poster_path}` 
            : initialPoster;
            
        const backdropImg = details?.backdrop_path 
            ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}` 
            : '';
            
        const overview = details?.overview || item.overview || 'No synopsis provided.';
        const tagline = details?.tagline ? `"${details.tagline}"` : '';
        const genres = details?.genres ? details.genres.map(g => g.name) : (inferGenresFromTitleAndOverview(title, overview));
        
        let seasonsText = '';
        if (details?.number_of_seasons) {
            seasonsText = `${details.number_of_seasons} Season${details.number_of_seasons === 1 ? '' : 's'}`;
            if (details.number_of_episodes) seasonsText += ` (${details.number_of_episodes} eps)`;
        }

        let contentRating = '';
        if (details?.content_ratings?.results) {
            const usRating = details.content_ratings.results.find(r => r.iso_3166_1 === 'US')?.rating;
            if (usRating) contentRating = usRating;
        }

        const castList = details?.credits?.cast?.slice(0, 8) || [];
        const creators = details?.created_by?.map(c => c.name).join(', ') || '';
        const networks = details?.networks?.map(n => n.name).join(', ') || (serviceMeta[item.service]?.name || item.service || '');
        const status = details?.status || '';

        const uuid = window.db?.toDeterministicUuid ? window.db.toDeterministicUuid(tmdbId) : tmdbId;
        const isAlreadyInLib = allContent.some(c => 
            String(c.id) === uuid || 
            String(c.tmdb_id) === tmdbId || 
            String(c.id) === tmdbId || 
            (c.title && c.title.toLowerCase() === title.toLowerCase())
        );

        imdbModalBody.innerHTML = `
            <div class="imdb-hero" style="${backdropImg ? `background-image: url('${backdropImg}');` : 'background: #1e1e1e;'}">
                <div class="imdb-hero-overlay"></div>
                <div class="imdb-hero-content">
                    <img src="${posterImg}" class="imdb-poster-thumb" alt="${cleanTitle}" onerror="this.onerror=null;this.src='${fallbackPoster}';">
                    <div class="imdb-meta-summary">
                        <div class="imdb-rating-badge">
                            <span class="imdb-gold-pill">IMDb</span>
                            <span class="imdb-rating-val">★ ${ratingVal} <small style="color:var(--text-muted); font-size:0.75rem;">/10</small></span>
                            ${voteCount ? `<span class="imdb-rating-votes">(${voteCount})</span>` : ''}
                        </div>
                        <h2 class="imdb-show-title">${title}</h2>
                        <div class="imdb-show-submeta">
                            <span>${yearVal}</span>
                            ${contentRating ? `<span class="imdb-submeta-dot">•</span><span style="border:1px solid rgba(255,255,255,0.3); padding:1px 5px; border-radius:3px; font-size:0.78rem;">${contentRating}</span>` : ''}
                            ${seasonsText ? `<span class="imdb-submeta-dot">•</span><span>${seasonsText}</span>` : ''}
                            ${genres.length > 0 ? `<span class="imdb-submeta-dot">•</span><span>${genres.slice(0, 3).join(', ')}</span>` : ''}
                        </div>
                        <div class="imdb-action-row">
                            <a href="${imdbUrl}" target="_blank" rel="noopener noreferrer" class="imdb-visit-btn" id="imdb-direct-link">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;">
                                    <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                                </svg>
                                <span>View on IMDb.com ↗</span>
                            </a>
                            <button class="btn primary-btn" id="imdb-modal-add-btn" style="padding: 8px 18px; font-size: 0.9rem;" ${isAlreadyInLib ? 'disabled style="background:var(--success-color);"' : ''}>
                                ${isAlreadyInLib ? '✓ In Library' : '+ Add to Library'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="imdb-body-content">
                <div class="imdb-tabs">
                    <button type="button" class="imdb-tab-btn active" data-tab="overview">Show Overview & Cast</button>
                    <button type="button" class="imdb-tab-btn" data-tab="webview">IMDb Web Preview</button>
                </div>

                <div id="imdb-tab-overview" class="imdb-tab-panel">
                    <div class="imdb-info-grid">
                        <div>
                            ${tagline ? `<div class="imdb-tagline">${tagline}</div>` : ''}
                            <div class="imdb-section-title">Synopsis</div>
                            <p class="imdb-synopsis">${overview}</p>

                            ${castList.length > 0 ? `
                                <div class="imdb-section-title">Top Billed Cast</div>
                                <div class="imdb-cast-list">
                                    ${castList.map(actor => `
                                        <div class="imdb-cast-chip">
                                            <strong>${actor.name}</strong>
                                            ${actor.character ? `<span class="imdb-cast-character"> as ${actor.character}</span>` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>

                        <div>
                            ${creators ? `
                                <div class="imdb-side-fact">
                                    <div class="imdb-side-fact-label">Creator${creators.includes(',') ? 's' : ''}</div>
                                    <div class="imdb-side-fact-val">${creators}</div>
                                </div>
                            ` : ''}
                            ${networks ? `
                                <div class="imdb-side-fact">
                                    <div class="imdb-side-fact-label">Original Network / Service</div>
                                    <div class="imdb-side-fact-val">${networks}</div>
                                </div>
                            ` : ''}
                            ${status ? `
                                <div class="imdb-side-fact">
                                    <div class="imdb-side-fact-label">Status</div>
                                    <div class="imdb-side-fact-val">${status}</div>
                                </div>
                            ` : ''}
                            ${genres.length > 0 ? `
                                <div class="imdb-side-fact">
                                    <div class="imdb-side-fact-label">Genres</div>
                                    <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">
                                        ${genres.map(g => `<span class="genre-chip" style="font-size:0.75rem; padding:3px 8px;">${g}</span>`).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <div id="imdb-tab-webview" class="imdb-tab-panel" style="display: none;">
                    <div style="padding: 12px 16px; background: rgba(245, 197, 24, 0.08); border: 1px solid rgba(245, 197, 24, 0.3); border-radius: 8px; margin-bottom: 14px;">
                        <p style="margin: 0; font-size: 0.88rem; color: var(--text-main);">
                            ℹ️ <em>If IMDb does not display below due to browser cross-origin frame protection, click the yellow <strong>"View on IMDb.com ↗"</strong> button above to open the full page directly.</em>
                        </p>
                    </div>
                    <div class="imdb-iframe-container">
                        <iframe src="${imdbUrl}" class="imdb-iframe" title="IMDb - ${cleanTitle}" sandbox="allow-scripts allow-same-origin allow-popups allow-forms"></iframe>
                    </div>
                </div>
            </div>
        `;

        const tabBtns = imdbModalBody.querySelectorAll('.imdb-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const targetTab = btn.dataset.tab;
                const pOverview = document.getElementById('imdb-tab-overview');
                const pWebview = document.getElementById('imdb-tab-webview');
                if (pOverview) pOverview.style.display = targetTab === 'overview' ? 'block' : 'none';
                if (pWebview) pWebview.style.display = targetTab === 'webview' ? 'block' : 'none';
            });
        });

        const modalAddBtn = document.getElementById('imdb-modal-add-btn');
        if (modalAddBtn && !isAlreadyInLib) {
            modalAddBtn.addEventListener('click', async () => {
                modalAddBtn.textContent = 'Adding...';
                modalAddBtn.disabled = true;

                let detectedKey = item.service || detectShowServiceSync(item) || extractServiceFromTmdbDetails(details);
                const svcName = (detectedKey && serviceMeta[detectedKey]) ? serviceMeta[detectedKey].name : (details?.networks?.[0]?.name || item.service || 'Custom');
                const payload = {
                    id: uuid,
                    tmdb_id: tmdbId,
                    title: title,
                    type: 'series_season',
                    release_year: parseInt(yearVal) || null,
                    poster_url: posterImg,
                    streaming_service_id: null,
                    mock_service: svcName
                };

                const { data, error } = await window.db.insertContentItem(payload);
                if (error) {
                    showToast('Error adding show: ' + error.message, 'error');
                    modalAddBtn.textContent = '+ Add to Library';
                    modalAddBtn.disabled = false;
                } else {
                    const savedItem = (data && data[0]) ? data[0] : payload;
                    if (!allContent.some(c => String(c.id) === String(savedItem.id))) {
                        allContent.push(savedItem);
                    }
                    await updateWatchState(savedItem.id, 'want_to_watch', null);
                    renderAllSections();

                    modalAddBtn.textContent = '✓ Added!';
                    modalAddBtn.style.background = 'var(--success-color)';
                    modalAddBtn.disabled = true;

                    document.querySelectorAll(`.tmdb-result-card[data-tmdb-id="${tmdbId}"]`).forEach(cEl => {
                        cEl.classList.add('already-in-library');
                        const btn = cEl.querySelector('.add-supabase-btn, .add-discovery-btn, .add-smart-rec-btn');
                        if (btn) {
                            btn.textContent = '✓ In Library';
                            btn.disabled = true;
                        }
                    });

                    showToast(`Added "${payload.title}" to your library!`, 'success');
                }
            });
        }
    }
    window.openImdbModal = openImdbModal;

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
                const res = await fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${cloudKey}&with_networks=${sMeta.networkId}&watch_region=US&with_watch_monetization_types=flatrate|free|ads&language=en-US&sort_by=popularity.desc&page=1`);
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

            card.innerHTML = `
                <div class="tmdb-poster-container" title="Click to view IMDb details" role="button" tabindex="0">
                    <img src="${poster}" class="tmdb-poster" alt="${cleanTitle}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackPoster}';">
                    ${isAlreadyInLib ? '<span class="tmdb-badge-in-lib">✓ In Library</span>' : ''}
                    <span class="tmdb-badge-imdb-hint">IMDb Details ↗</span>
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
                    const badge = card.querySelector('.tmdb-badge-in-lib');
                    if (!badge) {
                        const newBadge = document.createElement('span');
                        newBadge.className = 'tmdb-badge-in-lib';
                        newBadge.textContent = '✓ In Library';
                        card.querySelector('.tmdb-poster-container')?.prepend(newBadge);
                    }
                    showToast(`Added "${payload.title}" to your library!`, 'success');
                }
            };

            const posterContainer = card.querySelector('.tmdb-poster-container');
            if (posterContainer) {
                posterContainer.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openImdbModal({ ...item, title: showName, poster, year, service: currentDiscoveryService });
                });
                posterContainer.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        openImdbModal({ ...item, title: showName, poster, year, service: currentDiscoveryService });
                    }
                });
            }

            const addBtn = card.querySelector('.add-discovery-btn');
            if (addBtn) {
                addBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleAddShow(addBtn);
                });
            }

            serviceDiscoveryGrid.appendChild(card);
        });
    }

    // --- 30-Second Entertainment Taste Quiz Engine ---
    const TASTE_QUIZ_QUESTIONS = [
        {
            id: 'mood',
            title: 'What vibe or energy are you in the mood for?',
            subtitle: 'Pick the primary feeling that pulls you in when sitting down to stream.',
            options: [
                {
                    id: 'adrenaline',
                    icon: '⚡',
                    label: 'Adrenaline & High Stakes',
                    desc: 'Action, thrillers, survival, intense battles & fast heart rates.',
                    genres: ['Action & Adventure', 'Crime'],
                    tags: ['survival', 'thriller', 'dark', 'monsters']
                },
                {
                    id: 'mindbending',
                    icon: '🌌',
                    label: 'Mind-Bending & Complex',
                    desc: 'Sci-Fi, mystery twists, multi-layered puzzles & alternate realities.',
                    genres: ['Sci-Fi & Fantasy', 'Mystery'],
                    tags: ['space', 'future', 'tech', 'quantum', 'puzzle', 'conspiracy']
                },
                {
                    id: 'lighthearted',
                    icon: '😂',
                    label: 'Lighthearted & Comfort',
                    desc: 'Feel-good comedy, sharp wit, lovable friendships & zero stress.',
                    genres: ['Comedy'],
                    tags: ['funny', 'laugh', 'sitcom', 'feel-good', 'friendship']
                },
                {
                    id: 'drama',
                    icon: '🎭',
                    label: 'Deep Prestige Drama',
                    desc: 'Character-driven emotional depth, family sagas & moral conflicts.',
                    genres: ['Drama'],
                    tags: ['character', 'royalty', 'politics', 'masterpiece', 'family']
                },
                {
                    id: 'crime',
                    icon: '🕵️',
                    label: 'Gritty Crime & Investigations',
                    desc: 'Detectives, mob empires, cartel syndicates & thrilling whodunits.',
                    genres: ['Crime', 'Mystery'],
                    tags: ['detective', 'police', 'cartel', 'investigat', 'drugs', 'mafia']
                }
            ]
        },
        {
            id: 'world',
            title: 'Which story worlds pull you in the most?',
            subtitle: 'Choose the universe or setting that sparks your imagination.',
            options: [
                {
                    id: 'space_future',
                    icon: '🚀',
                    label: 'Distant Galaxies & High Tech',
                    desc: 'Futuristic dystopias, interstellar exploration & alien civilizations.',
                    genres: ['Sci-Fi & Fantasy'],
                    tags: ['space', 'star wars', 'future', 'dystopia', 'tech']
                },
                {
                    id: 'urban_streets',
                    icon: '🏙️',
                    label: 'Modern Metros & Underworlds',
                    desc: 'High-stakes corporate rooms, gritty streets, law firms & big city crime.',
                    genres: ['Crime', 'Drama'],
                    tags: ['money laundering', 'cartel', 'lawyer', 'drugs', 'fbi']
                },
                {
                    id: 'history_royals',
                    icon: '👑',
                    label: 'Historic Eras & Dynasties',
                    desc: 'Royalty, monarchies, period costumes, ancient legends & revolutions.',
                    genres: ['Drama', 'History'],
                    tags: ['royalty', 'politics', 'biography', 'period', 'regency']
                },
                {
                    id: 'cozy_towns',
                    icon: '☕',
                    label: 'Relatable Towns & Everyday Communities',
                    desc: 'Schools, tight-knit neighborhoods, workplace banter & warm romance.',
                    genres: ['Comedy', 'Drama'],
                    tags: ['high school', 'friendship', 'romance', 'feel-good']
                }
            ]
        },
        {
            id: 'pace',
            title: 'How do you prefer stories to unfold?',
            subtitle: 'Pick the storytelling pace and binge style you enjoy most.',
            options: [
                {
                    id: 'cliffhangers',
                    icon: '🏃',
                    label: 'Relentless Cliffhangers',
                    desc: 'Every episode ends on a shocking hook — impossible not to binge.',
                    tags: ['survival', 'thriller', 'dark', 'monsters'],
                    boostHighRating: true
                },
                {
                    id: 'slowburn',
                    icon: '🧩',
                    label: 'Layered Slow-Burn Payoff',
                    desc: 'Patient, atmospheric world-building that builds to a breathtaking climax.',
                    tags: ['chess', 'prodigy', 'politics', 'masterpiece'],
                    boostHighRating: true
                },
                {
                    id: 'episodic',
                    icon: '☕',
                    label: 'Comforting & Episodic',
                    desc: 'Self-contained episodes, enjoyable anytime without anxiety.',
                    tags: ['sitcom', 'feel-good', 'comedy'],
                    boostHighRating: false
                },
                {
                    id: 'cinematic',
                    icon: '🎬',
                    label: 'Cinematic Grandeur',
                    desc: 'Sweeping visual masterworks, soaring scores & award-winning prestige.',
                    tags: ['masterpiece', 'cinematic', 'epic'],
                    boostHighRating: true
                }
            ]
        },
        {
            id: 'service',
            title: 'Where do you find yourself streaming most often?',
            subtitle: 'Priority weighting will be given to shows available on this platform.',
            options: [
                { id: 'netflix', icon: '🔴', label: 'Netflix', desc: 'Global blockbuster originals & viral binge sensations.' },
                { id: 'appletv', icon: '🍏', label: 'Apple TV+', desc: 'Critically acclaimed, cinematic prestige series & visionary sci-fi.' },
                { id: 'disney', icon: '🐭', label: 'Disney+', desc: 'Star Wars, Marvel, Pixar, family favorites & nostalgic hits.' },
                { id: 'peacock', icon: '🦚', label: 'Peacock', desc: 'Acclaimed sitcoms, true-crime dramas & NBC universal favorites.' },
                { id: 'hulu', icon: '🟢', label: 'Hulu', desc: 'Sharp contemporary dramas, edgy comedies & award-winners.' },
                { id: 'prime', icon: '📦', label: 'Prime Video', desc: 'Epic fantasy sagas, gritty action thrillers & blockbuster series.' },
                { id: 'any', icon: '📺', label: 'Any / Multi-Stream', desc: 'Open to the best content anywhere across all platforms.' }
            ]
        }
    ];

    function renderTasteQuizContainer() {
        if (!tasteQuizContainer) return;

        if (!isQuizActive) {
            if (tasteQuizAnswers) {
                const q1 = TASTE_QUIZ_QUESTIONS[0].options.find(o => o.id === tasteQuizAnswers.mood);
                const q2 = TASTE_QUIZ_QUESTIONS[1].options.find(o => o.id === tasteQuizAnswers.world);
                const q3 = TASTE_QUIZ_QUESTIONS[2].options.find(o => o.id === tasteQuizAnswers.pace);
                const q4 = TASTE_QUIZ_QUESTIONS[3].options.find(o => o.id === tasteQuizAnswers.service);

                tasteQuizContainer.innerHTML = `
                    <div class="taste-quiz-prompt-card">
                        <div class="taste-quiz-prompt-info">
                            <div class="taste-quiz-prompt-title">
                                <span>🎯 Recommendations Tuned by 30s Quiz</span>
                            </div>
                            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">
                                ${q1 ? `<span class="quiz-pill-badge">${q1.icon} ${q1.label}</span>` : ''}
                                ${q2 ? `<span class="quiz-pill-badge">${q2.icon} ${q2.label}</span>` : ''}
                                ${q3 ? `<span class="quiz-pill-badge">${q3.icon} ${q3.label}</span>` : ''}
                                ${q4 && q4.id !== 'any' ? `<span class="quiz-pill-badge">${q4.icon} ${q4.label}</span>` : ''}
                            </div>
                        </div>
                        <div class="taste-quiz-prompt-actions">
                            <button class="btn primary-btn" id="retake-taste-quiz-btn" style="padding: 8px 16px; font-size: 0.88rem;">
                                🔄 Retake Quiz
                            </button>
                            <button class="btn secondary-btn" id="reset-taste-quiz-btn" style="padding: 8px 14px; font-size: 0.88rem;">
                                Reset Tuning
                            </button>
                        </div>
                    </div>
                `;

                document.getElementById('retake-taste-quiz-btn')?.addEventListener('click', () => {
                    isQuizActive = true;
                    currentQuizStep = 0;
                    quizDraftAnswers = { ...tasteQuizAnswers };
                    renderTasteQuizContainer();
                });

                document.getElementById('reset-taste-quiz-btn')?.addEventListener('click', () => {
                    resetTasteQuiz();
                });
            } else {
                tasteQuizContainer.innerHTML = `
                    <div class="taste-quiz-prompt-card">
                        <div class="taste-quiz-prompt-info">
                            <div class="taste-quiz-prompt-title">
                                <span>⚡ Calibrate Your Taste in 30 Seconds</span>
                            </div>
                            <p class="taste-quiz-prompt-desc">
                                Answer 4 quick questions about your mood, favorite worlds, and pacing to immediately tune your personalized recommendation queue.
                            </p>
                        </div>
                        <div class="taste-quiz-prompt-actions">
                            <button class="btn primary-btn" id="start-taste-quiz-btn" style="padding: 10px 20px; font-size: 0.95rem;">
                                Start 30s Quiz →
                            </button>
                        </div>
                    </div>
                `;

                document.getElementById('start-taste-quiz-btn')?.addEventListener('click', () => {
                    isQuizActive = true;
                    currentQuizStep = 0;
                    quizDraftAnswers = {};
                    renderTasteQuizContainer();
                });
            }
            return;
        }

        // Active Quiz View
        const q = TASTE_QUIZ_QUESTIONS[currentQuizStep];
        if (!q) return;

        const progressPercent = Math.round(((currentQuizStep + 1) / TASTE_QUIZ_QUESTIONS.length) * 100);

        tasteQuizContainer.innerHTML = `
            <div class="taste-quiz-active-card">
                <div class="quiz-step-indicator">
                    <span>Question ${currentQuizStep + 1} of ${TASTE_QUIZ_QUESTIONS.length}</span>
                    <span class="quiz-step-timer-badge">⏱️ 30s Quick Quiz</span>
                </div>
                <div class="quiz-progress-track">
                    <div class="quiz-progress-fill" style="width: ${progressPercent}%;"></div>
                </div>
                <div class="quiz-question-heading">${q.title}</div>
                <div class="quiz-question-subtext">${q.subtitle}</div>

                <div class="quiz-options-grid">
                    ${q.options.map(opt => {
                        const isSelected = quizDraftAnswers[q.id] === opt.id;
                        return `
                            <button class="quiz-option-btn ${isSelected ? 'selected' : ''}" data-opt-id="${opt.id}">
                                <span class="quiz-option-icon">${opt.icon}</span>
                                <div style="flex: 1;">
                                    <span class="quiz-option-label">${opt.label}</span>
                                    <span class="quiz-option-desc">${opt.desc}</span>
                                </div>
                            </button>
                        `;
                    }).join('')}
                </div>

                <div class="quiz-action-bar">
                    <div>
                        ${currentQuizStep > 0 ? `
                            <button class="btn secondary-btn" id="quiz-back-btn" style="padding: 8px 16px; font-size: 0.88rem;">
                                ← Back
                            </button>
                        ` : `
                            <button class="btn secondary-btn" id="quiz-cancel-btn" style="padding: 8px 16px; font-size: 0.88rem;">
                                Cancel
                            </button>
                        `}
                    </div>
                    <div>
                        <span style="font-size: 0.82rem; color: var(--text-muted);">Select an option to advance</span>
                    </div>
                </div>
            </div>
        `;

        // Option click handlers
        tasteQuizContainer.querySelectorAll('.quiz-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const optId = btn.dataset.optId;
                quizDraftAnswers[q.id] = optId;

                // Visual feedback
                tasteQuizContainer.querySelectorAll('.quiz-option-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');

                // Auto advance
                setTimeout(() => {
                    if (currentQuizStep < TASTE_QUIZ_QUESTIONS.length - 1) {
                        currentQuizStep++;
                        renderTasteQuizContainer();
                    } else {
                        finishTasteQuiz(quizDraftAnswers);
                    }
                }, 220);
            });
        });

        // Back button
        document.getElementById('quiz-back-btn')?.addEventListener('click', () => {
            if (currentQuizStep > 0) {
                currentQuizStep--;
                renderTasteQuizContainer();
            }
        });

        // Cancel button
        document.getElementById('quiz-cancel-btn')?.addEventListener('click', () => {
            isQuizActive = false;
            renderTasteQuizContainer();
        });
    }

    function finishTasteQuiz(answers) {
        tasteQuizAnswers = answers;
        localStorage.setItem('tv_taste_quiz_answers', JSON.stringify(answers));
        isQuizActive = false;
        showToast('✨ 30s Quiz complete! Calibrated your recommendations queue.', 'success');
        renderSmartRecommendationsView();
    }

    function resetTasteQuiz() {
        tasteQuizAnswers = null;
        localStorage.removeItem('tv_taste_quiz_answers');
        isQuizActive = false;
        showToast('Reset quiz preferences to default library weighting.', 'info');
        renderSmartRecommendationsView();
    }

    // --- Smart Multi-Vector Recommendation Engine ---
    function computeTasteProfile() {
        const genreScores = {};
        const serviceCounts = {};
        let watchingCount = 0;
        let likedCount = 0;
        const positiveSeeds = [];

        // Factor in library content
        allContent.forEach(item => {
            const idStr = String(item.id);
            const tmdbIdStr = String(item.tmdb_id || item.id);
            const watchData = userWatchlist.find(w => String(w.content_item_id) === idStr || String(w.content_item_id) === tmdbIdStr) || { status: 'none', rating: null };
            
            let weight = 1.0;
            const isFinishedOrArchived = watchData.status === 'completed' || Boolean(watchData.archived);
            if (isFinishedOrArchived && watchData.rating === 'thumbs_up') {
                weight = 4.5;
                likedCount++;
                positiveSeeds.push(item);
            } else if (isFinishedOrArchived) {
                // Completed & archived series are high-affinity recommendation drivers!
                weight = 3.5;
                if (watchData.rating !== 'thumbs_down') {
                    positiveSeeds.push(item);
                }
            } else if (watchData.status === 'watching') {
                weight = 3.0;
                watchingCount++;
                positiveSeeds.push(item);
            } else if (watchData.status === 'want_to_watch') {
                weight = 1.8;
            } else if (watchData.status === 'dropped' || watchData.rating === 'thumbs_down') {
                weight = -4.0;
            }

            // Detect service
            const rawSvc = (item.streaming_services?.name || item.mock_service || '').toLowerCase();
            for (const key of ['netflix', 'disney', 'hulu', 'peacock', 'prime', 'youtube', 'appletv']) {
                if (rawSvc.includes(key) || (key === 'appletv' && rawSvc.includes('apple'))) {
                    serviceCounts[key] = (serviceCounts[key] || 0) + 1;
                    break;
                }
            }

            // Map genres and classification
            const meta = getShowClassification(item);
            const genres = meta.genres || [];

            genres.forEach(g => {
                genreScores[g] = (genreScores[g] || 0) + weight;
            });
        });

        // Factor in 30-Second Quiz Answers if available
        if (tasteQuizAnswers) {
            const q1 = TASTE_QUIZ_QUESTIONS[0].options.find(o => o.id === tasteQuizAnswers.mood);
            const q2 = TASTE_QUIZ_QUESTIONS[1].options.find(o => o.id === tasteQuizAnswers.world);
            const q4 = TASTE_QUIZ_QUESTIONS[3].options.find(o => o.id === tasteQuizAnswers.service);

            if (q1?.genres) {
                q1.genres.forEach(g => {
                    genreScores[g] = (genreScores[g] || 0) + 14;
                });
            }
            if (q2?.genres) {
                q2.genres.forEach(g => {
                    genreScores[g] = (genreScores[g] || 0) + 9;
                });
            }
            if (q4?.id && q4.id !== 'any') {
                serviceCounts[q4.id] = (serviceCounts[q4.id] || 0) + 8;
            }
        }

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
            positiveSeeds,
            quizAnswers: tasteQuizAnswers
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

        // If library is empty or < 2 shows AND no quiz was completed: return starter gateway picks
        if (profile.totalCount < 2 && !tasteQuizAnswers) {
            return candidates.slice(0, 10).map(c => ({
                ...c,
                reason: '🌟 Gateway Classic',
                rating: getShowClassification(c)?.rating || 8.4
            }));
        }

        // Score each candidate with strict category and tone boundaries
        const scored = candidates.map(c => {
            let score = 0;
            const meta = getShowClassification(c);
            const candidateGenres = meta.genres || [];
            const candidateTags = meta.tags || [];

            // Genre synergy from profile
            candidateGenres.forEach(g => {
                const idx = profile.topGenres.indexOf(g);
                if (idx === 0) score += 10; // Top favorite genre
                else if (idx === 1) score += 7;
                else if (idx >= 2) score += 4;
            });

            // Seed show similarity from library with cross-tone isolation
            let bestSeedMatch = null;
            profile.positiveSeeds.forEach(seed => {
                const seedMeta = getShowClassification(seed);
                
                // Strict isolation: Never recommend dark/gritty shows based on lighthearted comedy seeds
                if (seedMeta.tone === 'lighthearted' && (meta.tone === 'dark' || meta.tone === 'gritty' || meta.tone === 'tense')) {
                    return;
                }
                // Never recommend lighthearted comedies based on dark/gritty drama seeds
                if ((seedMeta.tone === 'dark' || seedMeta.tone === 'gritty') && meta.primaryCategory === 'lighthearted_comedy') {
                    return;
                }

                // Category affinity boost (+8)
                if (seedMeta.primaryCategory === meta.primaryCategory) {
                    score += 8;
                    if (!bestSeedMatch) bestSeedMatch = seed;
                } else {
                    const sharedGenres = candidateGenres.filter(g => seedMeta.genres.includes(g));
                    const sharedTags = candidateTags.filter(t => (seedMeta.tags || []).includes(t));
                    if (sharedGenres.length >= 2 || sharedTags.length >= 1) {
                        score += 5;
                        if (!bestSeedMatch) bestSeedMatch = seed;
                    }
                }
            });

            // Provider synergy
            if (c.serviceName === profile.topService) {
                score += 3;
            }

            // Quality score from rating
            score += (meta.rating || 8.0);

            // Boosts and tailored rationale from 30s Taste Quiz with strict mood isolation
            let quizRationale = null;
            if (tasteQuizAnswers) {
                const q1 = TASTE_QUIZ_QUESTIONS[0].options.find(o => o.id === tasteQuizAnswers.mood);
                const q2 = TASTE_QUIZ_QUESTIONS[1].options.find(o => o.id === tasteQuizAnswers.world);
                const q3 = TASTE_QUIZ_QUESTIONS[2].options.find(o => o.id === tasteQuizAnswers.pace);
                const q4 = TASTE_QUIZ_QUESTIONS[3].options.find(o => o.id === tasteQuizAnswers.service);

                // Strict Mood Eligibility Check
                const isMoodEligible = checkMoodEligibility(c, tasteQuizAnswers.mood);
                if (!isMoodEligible) {
                    score -= 1000; // Hard disqualification for conflicting tone/genre candidates
                } else {
                    score += 25; // Decisive mood alignment
                    if (tasteQuizAnswers.mood === 'lighthearted') {
                        quizRationale = '😂 Lighthearted Comfort Pick';
                    } else if (tasteQuizAnswers.mood === 'drama') {
                        quizRationale = '🎭 Deep Prestige Drama Pick';
                    } else if (tasteQuizAnswers.mood === 'mindbending') {
                        quizRationale = '🌌 Mind-Bending Sci-Fi Pick';
                    } else if (tasteQuizAnswers.mood === 'adrenaline') {
                        quizRationale = '⚡ High-Stakes Action Pick';
                    } else if (tasteQuizAnswers.mood === 'crime') {
                        quizRationale = '🕵️ Gritty Investigation Pick';
                    }
                }

                // World setting match (+8 pts) - only for eligible candidates
                if (isMoodEligible) {
                    const matchedWorldTags = (q2?.tags || []).filter(t => candidateTags.includes(t));
                    if (matchedWorldTags.length > 0 || (q2?.genres && q2.genres.some(g => candidateGenres.includes(g)))) {
                        score += 8;
                        if (!quizRationale && Math.random() > 0.6) {
                            quizRationale = `🌍 Quiz World: ${q2.label}`;
                        }
                    }

                    // Narrative pacing match (+6 pts)
                    const matchedPaceTags = (q3?.tags || []).filter(t => candidateTags.includes(t));
                    if (matchedPaceTags.length > 0) {
                        score += 6;
                    }
                    if (q3?.boostHighRating && (meta.rating || 0) >= 8.3) {
                        score += 4;
                    }

                    // Preferred streaming service match (+9 pts)
                    if (q4?.id && q4.id !== 'any' && c.serviceKey === q4.id) {
                        score += 9;
                        if (!quizRationale && Math.random() > 0.4) {
                            quizRationale = `📺 Acclaimed on ${q4.label} (Quiz Match)`;
                        }
                    }
                }
            }

            // Contextual rationale badge
            let reason = '⭐ Highly Recommended';
            if (quizRationale) {
                reason = quizRationale;
            } else if (bestSeedMatch) {
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

        // Retain only valid, positively scored candidates
        const eligibleScored = scored.filter(c => c.score > 0);
        eligibleScored.sort((a, b) => b.score - a.score);
        return eligibleScored.slice(0, 18);
    }

    function renderSmartRecommendationsView() {
        if (!smartRecsContent) return;
        renderTasteQuizContainer();
        const profile = computeTasteProfile();

        // Render Taste Profile Banner
        if (tasteProfileBanner) {
            tasteProfileBanner.innerHTML = `
                <div class="taste-profile-header">
                    <div class="taste-profile-title" style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
                        <span>🧠 Your Entertainment Taste Profile</span>
                        ${tasteQuizAnswers ? '<span class="quiz-pill-badge" style="font-size: 0.74rem;">🎯 30s Quiz Tuned</span>' : ''}
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
        if (profile.totalCount < 2 && !tasteQuizAnswers) {
            headerNote = `
                <div style="margin-bottom: 20px; padding: 14px 18px; background: rgba(0, 195, 255, 0.08); border: 1px solid rgba(0, 195, 255, 0.25); border-radius: 10px;">
                    <p style="font-size: 0.95rem; color: var(--text-main); margin: 0;">
                        💡 <strong>Welcome to Smart Recommendations!</strong> Take the 30-second quiz above or start adding shows to your library to calibrate these picks. Here are acclaimed starter gateway classics across popular genres:
                    </p>
                </div>
            `;
        } else if (tasteQuizAnswers) {
            headerNote = `
                <div style="margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <h3 style="font-size: 1.25rem; color: var(--text-main); margin: 0;">🎯 Top Personalized Picks (Quiz Calibrated)</h3>
                    <span style="font-size: 0.82rem; color: var(--text-muted);">Dynamically boosted by your 30s taste quiz preferences</span>
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
    window.renderSmartRecommendationsView = renderSmartRecommendationsView;
    window.renderTasteQuizContainer = renderTasteQuizContainer;
    window.finishTasteQuiz = finishTasteQuiz;
    window.resetTasteQuiz = resetTasteQuiz;

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

        card.innerHTML = `
            <div class="tmdb-poster-container" title="Click to view IMDb details" role="button" tabindex="0">
                <img src="${poster}" class="tmdb-poster" alt="${cleanTitle}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackPoster}';">
                ${isAlreadyInLib ? '<span class="tmdb-badge-in-lib">✓ In Library</span>' : ''}
                <span class="tmdb-badge-imdb-hint">IMDb Details ↗</span>
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
                const badge = card.querySelector('.tmdb-badge-in-lib');
                if (!badge) {
                    const newBadge = document.createElement('span');
                    newBadge.className = 'tmdb-badge-in-lib';
                    newBadge.textContent = '✓ In Library';
                    card.querySelector('.tmdb-poster-container')?.prepend(newBadge);
                }
                updateLibraryCounters();
                showToast(`Added "${payload.title}" to your library!`, 'success');
            }
        };

        const posterContainer = card.querySelector('.tmdb-poster-container');
        if (posterContainer) {
            posterContainer.addEventListener('click', (e) => {
                e.stopPropagation();
                openImdbModal({ ...item, title: item.title, poster, year, rating, service: item.service });
            });
            posterContainer.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    openImdbModal({ ...item, title: item.title, poster, year, rating, service: item.service });
                }
            });
        }

        const addBtn = card.querySelector('.add-smart-rec-btn');
        if (addBtn) {
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleAdd(addBtn);
            });
        }

        return card;
    }

    // --- Actions ---
    async function updateWatchState(itemId, status, rating = null, extraFields = {}) {
        const idStr = String(itemId);
        const uuid = window.db?.toDeterministicUuid ? window.db.toDeterministicUuid(idStr) : idStr;
        const existing = userWatchlist.find(w => String(w.content_item_id) === idStr || String(w.content_item_id) === uuid);
        const isArchived = extraFields.archived !== undefined ? extraFields.archived : (status === 'completed' ? true : (existing?.archived || false));

        const updatedEntry = {
            content_item_id: uuid,
            status,
            rating: rating !== null ? rating : (existing?.rating || null),
            episodes_watched: extraFields.episodes_watched !== undefined ? extraFields.episodes_watched : (existing?.episodes_watched || {}),
            completed_seasons: extraFields.completed_seasons !== undefined ? extraFields.completed_seasons : (existing?.completed_seasons || []),
            archived: isArchived,
            watched_count: extraFields.watched_count !== undefined ? extraFields.watched_count : (existing?.watched_count || 0),
            total_episodes: extraFields.total_episodes !== undefined ? extraFields.total_episodes : (existing?.total_episodes || 0),
            updated_at: new Date().toISOString()
        };

        if (existing) {
            Object.assign(existing, updatedEntry);
        } else {
            userWatchlist.push(updatedEntry);
        }

        renderAllSections();
        await window.db.upsertWatchlistItem(currentUser?.id || null, idStr, status, rating, updatedEntry);
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        if (trackerBackBtn) {
            trackerBackBtn.addEventListener('click', () => {
                activeVideoEpisodeKey = null;
                switchView('library');
            });
        }
        if (crumbLibraryLink) {
            crumbLibraryLink.addEventListener('click', () => {
                activeVideoEpisodeKey = null;
                switchView('library');
            });
        }

        // Global Grid Change Listener for Status Dropdown
        document.body.addEventListener('change', (e) => {
            if (e.target.classList.contains('status-dropdown')) {
                const itemId = e.target.dataset.id;
                const status = e.target.value;
                const existing = userWatchlist.find(w => String(w.content_item_id) === String(itemId));
                const currentRating = status === 'completed' ? (existing?.rating || null) : null;
                const isArchived = status === 'completed';
                updateWatchState(itemId, status, currentRating, { archived: isArchived });
            }
        });

        document.body.addEventListener('click', async (e) => {
            // Track Episodes trigger from library card
            const trackBtn = e.target.closest('.btn-track-card');
            if (trackBtn) {
                const itemId = trackBtn.dataset.id;
                const showItem = allContent.find(c => String(c.id) === String(itemId) || String(c.tmdb_id) === String(itemId));
                if (showItem) switchView('show-tracker', showItem);
                return;
            }

            // Clicking poster or title in library opens show tracker
            const posterEl = e.target.closest('.catalog-grid .card-poster');
            const titleEl = e.target.closest('.catalog-grid .card-title');
            if (posterEl || titleEl) {
                const target = posterEl || titleEl;
                const itemId = target.dataset.id;
                const showItem = allContent.find(c => String(c.id) === String(itemId) || String(c.tmdb_id) === String(itemId));
                if (showItem) {
                    switchView('show-tracker', showItem);
                    return;
                }
            }

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
                const showItem = { id: String(btn.dataset.tmdbid), title: btn.dataset.title };
                const detectedKey = detectShowServiceSync(showItem);
                const svcName = (detectedKey && serviceMeta[detectedKey]) ? serviceMeta[detectedKey].name : 'Recommended';
                const payload = {
                    id: String(btn.dataset.tmdbid),
                    title: btn.dataset.title,
                    type: 'series_season',
                    release_year: parseInt(btn.dataset.year) || null,
                    poster_url: btn.dataset.poster,
                    service_id: null,
                    mock_service: svcName
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
                if (mobileStatusSelect) mobileStatusSelect.value = currentStatusFilter;
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
                if (mobileServiceSelect) mobileServiceSelect.value = currentLibraryServiceFilter;
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
                if (mobileExploreSelect) mobileExploreSelect.value = currentExploreService;
                renderServiceDiscovery(currentExploreService);
            });
        }

        // Mobile Filter Select Dropdowns (Phone optimized: eliminates clumping)
        if (mobileStatusSelect) {
            mobileStatusSelect.addEventListener('change', (e) => {
                currentStatusFilter = e.target.value;
                if (libraryStatusFilters) {
                    libraryStatusFilters.querySelectorAll('.pill-btn').forEach(btn => {
                        btn.classList.toggle('active', (btn.dataset.status || 'all') === currentStatusFilter);
                    });
                }
                renderLibrary();
            });
        }

        if (mobileServiceSelect) {
            mobileServiceSelect.addEventListener('change', (e) => {
                currentLibraryServiceFilter = e.target.value;
                if (libraryServiceFilters) {
                    libraryServiceFilters.querySelectorAll('.pill-btn').forEach(btn => {
                        btn.classList.toggle('active', (btn.dataset.service || 'all') === currentLibraryServiceFilter);
                    });
                }
                renderLibrary();
            });
        }

        if (mobileExploreSelect) {
            mobileExploreSelect.addEventListener('change', (e) => {
                currentExploreService = e.target.value;
                if (exploreServiceFilters) {
                    exploreServiceFilters.querySelectorAll('.pill-btn').forEach(btn => {
                        btn.classList.toggle('active', (btn.dataset.service || 'netflix') === currentExploreService);
                    });
                }
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
                lockAdmin();
                if (settingsModal) settingsModal.classList.add('hidden');
                if (currentView === 'changelog') switchView('library');
                await window.db.logout();
                showToast("Logged out successfully.", "info");
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
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            loginError.textContent = '';
            loginSuccess.style.display = 'none';

            if (isLoginMode) {
                authSubmitBtn.disabled = true;
                authSubmitBtn.textContent = 'Logging in...';
                const { data, error } = await window.db.login(email, password);
                authSubmitBtn.disabled = false;
                authSubmitBtn.textContent = 'Login';

                if (error) {
                    loginError.textContent = error.message;
                } else {
                    loginModal.classList.add('hidden');
                    loginForm.reset();
                    currentUser = data?.user || await window.db.getCurrentUser();
                    updateAuthUI();
                    if (currentUser) {
                        showToast('Syncing your library from cloud...', 'info', 2500);
                        await window.db.syncCloudUserData(currentUser.id, currentUser.email);
                        allContent = await window.db.getContentItems();
                        await healLibraryServices();
                        await loadUserData();
                        showToast(`✓ Cloud sync complete! Loaded ${allContent.length} shows.`, 'success', 3500);
                    }
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
        if (addShowsBtn) {
            addShowsBtn.addEventListener('click', () => {
                openAddShowsModal();
            });
        }

        const librarySearchAddBtn = document.getElementById('library-search-add-btn');
        if (librarySearchAddBtn) {
            librarySearchAddBtn.addEventListener('click', () => {
                openAddShowsModal();
            });
        }
        
        if (closeAddShowsBtn) {
            closeAddShowsBtn.addEventListener('click', () => {
                closeAddShowsModal();
            });
        }

        if (addShowsModal) {
            addShowsModal.addEventListener('click', (e) => {
                if (e.target === addShowsModal) {
                    closeAddShowsModal();
                }
            });
        }

        settingsBtn.addEventListener('click', () => {
            requireAdminAuth(async () => {
                settingsModal.classList.remove('hidden');
                const cloudKey = await window.db.getSystemSetting('tmdb_api_key');
                if (cloudKey) {
                    tmdbApiKeyInput.value = cloudKey;
                    localStorage.setItem('tmdb_api_key', cloudKey);
                } else {
                    const savedKey = localStorage.getItem('tmdb_api_key');
                    if (savedKey) tmdbApiKeyInput.value = savedKey;
                }

                // Populate Roku Device Settings
                const rokuDeviceNameInput = document.getElementById('roku-device-name');
                const rokuIpAddressInput = document.getElementById('roku-ip-address');
                if (rokuDeviceNameInput && window.RokuECP) {
                    rokuDeviceNameInput.value = window.RokuECP.getName();
                }
                if (rokuIpAddressInput && window.RokuECP) {
                    rokuIpAddressInput.value = window.RokuECP.getIp();
                }

                const syncBadge = document.getElementById('cloud-sync-status-badge');
                if (syncBadge) {
                    if (currentUser) {
                        syncBadge.textContent = `Connected (${currentUser.email}) • ${allContent.length} shows`;
                    } else {
                        syncBadge.textContent = 'Not logged in (Local guest session)';
                    }
                }
            });
        });
        
        closeSettingsBtn.addEventListener('click', () => {
            settingsModal.classList.add('hidden');
            lockAdmin();
        });

        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target === settingsModal) {
                    settingsModal.classList.add('hidden');
                    lockAdmin();
                }
            });
        }

        const forceCloudSyncBtn = document.getElementById('force-cloud-sync-btn');
        if (forceCloudSyncBtn) {
            forceCloudSyncBtn.addEventListener('click', async () => {
                if (!currentUser) {
                    showToast('Please log in first to sync with cloud.', 'warning');
                    return;
                }
                forceCloudSyncBtn.disabled = true;
                forceCloudSyncBtn.textContent = 'Syncing...';
                try {
                    showToast('Syncing with cloud PostgreSQL store...', 'info', 2500);
                    await window.db.syncCloudUserData(currentUser.id, currentUser.email);
                    allContent = await window.db.getContentItems();
                    await healLibraryServices();
                    await loadUserData();
                    showToast(`✓ Cloud sync complete! Loaded ${allContent.length} shows.`, 'success', 3500);
                    const syncBadge = document.getElementById('cloud-sync-status-badge');
                    if (syncBadge) {
                        syncBadge.textContent = `✓ Synced (${allContent.length} shows at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
                    }
                } catch(e) {
                    showToast('Cloud sync error: ' + (e.message || e), 'error');
                } finally {
                    forceCloudSyncBtn.disabled = false;
                    forceCloudSyncBtn.textContent = '☁️ Sync Cloud Now';
                }
            });
        }

        // Header Version Badge Button (Password Protected)
        if (versionBtn) {
            versionBtn.addEventListener('click', () => {
                requireAdminAuth(() => {
                    switchView('changelog');
                });
            });
        }

        // Close / Back Button from Inline Changelog
        if (closeChangelogBtn) {
            closeChangelogBtn.addEventListener('click', () => {
                lockAdmin();
                switchView('library');
            });
        }

        if (closeImdbModalBtn) {
            closeImdbModalBtn.addEventListener('click', () => {
                closeImdbModal();
            });
        }

        if (imdbModal) {
            imdbModal.addEventListener('click', (e) => {
                if (e.target === imdbModal) {
                    closeImdbModal();
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (settingsModal && !settingsModal.classList.contains('hidden')) {
                    settingsModal.classList.add('hidden');
                    lockAdmin();
                }
                if (imdbModal && !imdbModal.classList.contains('hidden')) {
                    closeImdbModal();
                }
                if (adminAuthModal && !adminAuthModal.classList.contains('hidden')) {
                    closeAdminAuthModal();
                }
                if (addShowsModal && !addShowsModal.classList.contains('hidden')) {
                    closeAddShowsModal();
                }
            }
        });

        // Admin Auth Modal controls
        if (closeAdminAuthBtn) {
            closeAdminAuthBtn.addEventListener('click', closeAdminAuthModal);
        }
        if (adminVerifyCancelBtn) {
            adminVerifyCancelBtn.addEventListener('click', closeAdminAuthModal);
        }
        if (adminAuthModal) {
            adminAuthModal.addEventListener('click', (e) => {
                if (e.target === adminAuthModal) closeAdminAuthModal();
            });
        }

        // Admin Verify Form (Password Authentication & Rate Limiting)
        if (adminVerifyForm) {
            adminVerifyForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (checkLockoutState()) return;

                adminAuthError.style.display = 'none';
                adminAuthError.textContent = '';

                const enteredPass = adminPassInput.value;
                if (!enteredPass) return;

                adminVerifySubmitBtn.disabled = true;
                adminVerifySubmitBtn.textContent = 'Verifying...';

                try {
                    const enteredHash = await hashSha256(enteredPass);
                    const storedHash = await getStoredAdminHash();

                    if (enteredHash === storedHash) {
                        failedAttempts = 0;
                        isAdminAuthenticated = true;
                        closeAdminAuthModal();
                        if (typeof pendingAdminCallback === 'function') {
                            const cb = pendingAdminCallback;
                            pendingAdminCallback = null;
                            cb();
                        }
                    } else {
                        failedAttempts++;
                        if (failedAttempts >= 5) {
                            startLockoutTimer();
                        } else {
                            const attemptsRemaining = 5 - failedAttempts;
                            adminAuthError.textContent = `Incorrect password. (${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining)`;
                            adminAuthError.style.display = 'block';
                            adminPassInput.select();
                        }
                    }
                } catch (err) {
                    adminAuthError.textContent = 'Authentication error: ' + err.message;
                    adminAuthError.style.display = 'block';
                } finally {
                    if (!checkLockoutState()) {
                        adminVerifySubmitBtn.disabled = false;
                        adminVerifySubmitBtn.textContent = 'Unlock';
                    }
                }
            });
        }

        // Update Admin Password from Settings Card
        if (updateAdminPassBtn) {
            updateAdminPassBtn.addEventListener('click', async () => {
                const currentPassInput = document.getElementById('admin-current-pass');
                const currentPass = currentPassInput ? currentPassInput.value : '';
                const newPass = adminChangePass.value;
                const confirmPass = adminChangeConfirm.value;
                adminPassStatus.style.display = 'block';

                if (!currentPass) {
                    adminPassStatus.textContent = 'Current master password is required.';
                    adminPassStatus.style.color = '#ff4444';
                    return;
                }

                const currentHash = await hashSha256(currentPass);
                const storedHash = await getStoredAdminHash();
                if (currentHash !== storedHash) {
                    adminPassStatus.textContent = 'Current master password is incorrect.';
                    adminPassStatus.style.color = '#ff4444';
                    return;
                }

                if (!newPass || newPass.length < 4) {
                    adminPassStatus.textContent = 'New password must be at least 4 characters.';
                    adminPassStatus.style.color = '#ff4444';
                    return;
                }
                if (newPass !== confirmPass) {
                    adminPassStatus.textContent = 'New passwords do not match.';
                    adminPassStatus.style.color = '#ff4444';
                    return;
                }

                updateAdminPassBtn.disabled = true;
                updateAdminPassBtn.textContent = 'Updating...';
                try {
                    const newHash = await hashSha256(newPass);
                    await saveAdminHash(newHash);
                    adminPassStatus.textContent = 'Master password updated successfully!';
                    adminPassStatus.style.color = 'var(--success-color)';
                    if (currentPassInput) currentPassInput.value = '';
                    adminChangePass.value = '';
                    adminChangeConfirm.value = '';
                    showToast('Master password updated successfully!', 'success');
                } catch (err) {
                    adminPassStatus.textContent = 'Error updating password: ' + err.message;
                    adminPassStatus.style.color = '#ff4444';
                } finally {
                    updateAdminPassBtn.disabled = false;
                    updateAdminPassBtn.textContent = 'Update Admin Password';
                }
            });
        }

        saveTmdbKeyBtn.addEventListener('click', async () => {
            if (!isAdminAuthenticated) {
                showToast("Admin authorization required to save system settings.", "error");
                return;
            }
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

        // Roku Settings Save & Test Handlers
        const saveRokuSettingsBtn = document.getElementById('save-roku-settings-btn');
        const testRokuBtn = document.getElementById('test-roku-btn');
        const rokuDeviceNameInput = document.getElementById('roku-device-name');
        const rokuIpAddressInput = document.getElementById('roku-ip-address');
        const rokuTestStatus = document.getElementById('roku-test-status');

        if (saveRokuSettingsBtn) {
            saveRokuSettingsBtn.addEventListener('click', () => {
                if (!window.RokuECP) return;
                const ip = (rokuIpAddressInput ? rokuIpAddressInput.value : '').trim();
                const name = (rokuDeviceNameInput ? rokuDeviceNameInput.value : '').trim() || 'My Roku';
                window.RokuECP.setIp(ip);
                window.RokuECP.setName(name);
                showToast(`Saved Roku: ${name} (${ip || 'No IP'})`, 'success');
                if (typeof updateRokuRemoteHeaderDisplay === 'function') {
                    updateRokuRemoteHeaderDisplay();
                }
            });
        }

        if (testRokuBtn) {
            testRokuBtn.addEventListener('click', async () => {
                if (!window.RokuECP) return;
                const ip = (rokuIpAddressInput ? rokuIpAddressInput.value : '').trim();
                if (ip) window.RokuECP.setIp(ip);
                if (rokuTestStatus) {
                    rokuTestStatus.textContent = 'Pinging Roku device...';
                    rokuTestStatus.style.color = 'var(--text-muted)';
                }
                const res = await window.RokuECP.testConnection();
                if (rokuTestStatus) {
                    if (res.success) {
                        rokuTestStatus.textContent = `✓ ${res.message}`;
                        rokuTestStatus.style.color = 'var(--success-color)';
                        showToast('Roku command dispatched successfully!', 'success');
                    } else {
                        rokuTestStatus.textContent = `✕ ${res.message}`;
                        rokuTestStatus.style.color = 'var(--danger-color)';
                        showToast(res.message, 'error');
                    }
                }
            });
        }

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
                const res = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${key}&query=${encodeURIComponent(query)}&region=US&language=en-US&include_adult=false`);
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

        // Initialize Roku Remote Handlers
        initRokuRemoteHandlers();
    }

    function updateRokuRemoteHeaderDisplay() {
        const dot = document.getElementById('remote-status-dot');
        const nameDisplay = document.getElementById('remote-device-name-display');
        const ipDisplay = document.getElementById('remote-ip-display');

        if (!window.RokuECP) return;

        const isConfig = window.RokuECP.isConfigured();
        const ip = window.RokuECP.getIp();
        const name = window.RokuECP.getName();

        if (dot) {
            dot.classList.toggle('unconfigured', !isConfig);
        }
        if (nameDisplay) {
            nameDisplay.textContent = name;
        }
        if (ipDisplay) {
            ipDisplay.textContent = isConfig ? `Target: http://${ip}:8060` : 'IP: Not Configured (Tap ⚙️ Configure)';
        }
    }

    function initRokuRemoteHandlers() {
        const remoteView = document.getElementById('view-remote');
        if (!remoteView) return;

        updateRokuRemoteHeaderDisplay();

        // Remote Header Button
        const remoteHeaderBtn = document.getElementById('remote-header-btn');
        if (remoteHeaderBtn) {
            remoteHeaderBtn.addEventListener('click', () => {
                switchView('remote');
            });
        }

        // Configure link in remote header
        const remoteSettingsLinkBtn = document.getElementById('remote-settings-link-btn');
        if (remoteSettingsLinkBtn) {
            remoteSettingsLinkBtn.addEventListener('click', () => {
                requireAdminAuth(() => {
                    if (settingsModal) {
                        settingsModal.classList.remove('hidden');
                        const rokuIpInput = document.getElementById('roku-ip-address');
                        const rokuNameInput = document.getElementById('roku-device-name');
                        if (rokuIpInput && window.RokuECP) rokuIpInput.value = window.RokuECP.getIp();
                        if (rokuNameInput && window.RokuECP) rokuNameInput.value = window.RokuECP.getName();
                    }
                });
            });
        }

        // Search bar
        const remoteSearchForm = document.getElementById('remote-search-form');
        const remoteSearchInput = document.getElementById('remote-search-input');
        if (remoteSearchForm && remoteSearchInput) {
            remoteSearchForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const q = remoteSearchInput.value.trim();
                if (!q) return;
                if (!window.RokuECP || !window.RokuECP.isConfigured()) {
                    showToast('Please set your Roku IP address first in Settings.', 'error');
                    return;
                }
                showToast(`Searching "${q}" on Roku TV...`, 'info');
                const res = await window.RokuECP.searchAndLaunch(q);
                if (res && res.success) {
                    showToast(`Dispatched search for "${q}" to TV!`, 'success');
                }
            });
        }

        // Click delegation on the remote controller
        remoteView.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            // Keypress buttons (D-pad, Home, Back, Play, etc.)
            const key = btn.dataset.key;
            if (key) {
                if (!window.RokuECP || !window.RokuECP.isConfigured()) {
                    showToast('Roku IP not configured. Tap "Configure IP" above.', 'error');
                    return;
                }
                // Visual feedback: briefly highlight
                btn.style.transform = 'scale(0.92)';
                setTimeout(() => { btn.style.transform = ''; }, 120);

                const res = await window.RokuECP.sendKey(key);
                if (res && !res.success) {
                    showToast(res.message || `Failed to dispatch ${key}`, 'error');
                }
                return;
            }

            // Quick launch channel buttons
            const channelKey = btn.dataset.channel;
            if (channelKey) {
                if (!window.RokuECP || !window.RokuECP.isConfigured()) {
                    showToast('Roku IP not configured. Tap "Configure IP" above.', 'error');
                    return;
                }
                showToast(`Launching ${channelKey.toUpperCase()} on Roku...`, 'info');
                const res = await window.RokuECP.launchChannel(channelKey);
                if (res && !res.success) {
                    showToast(res.message || 'Failed to launch channel', 'error');
                }
                return;
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
            const detectedKey = detectShowServiceSync(item) || item.service || defaultService || '';
            const initialService = detectedKey;
            
            const tmdbId = String(item.id);
            const uuid = window.db?.toDeterministicUuid ? window.db.toDeterministicUuid(tmdbId) : tmdbId;
            const isAlreadyInLib = allContent.some(c => String(c.id) === uuid || String(c.tmdb_id) === tmdbId || String(c.id) === tmdbId || (c.title && c.title.toLowerCase() === showName.toLowerCase()));

            const card = document.createElement('div');
            card.className = `tmdb-result-card ${isAlreadyInLib ? 'already-in-library' : ''}`;
            card.dataset.tmdbId = tmdbId;
            card.dataset.title = showName;

            card.innerHTML = `
                <div class="tmdb-poster-container" title="Click to view IMDb details" role="button" tabindex="0">
                    <img src="${poster}" class="tmdb-poster" alt="${cleanTitle}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackPoster}';">
                    ${isAlreadyInLib ? '<span class="tmdb-badge-in-lib">✓ In Library</span>' : ''}
                    <span class="tmdb-badge-imdb-hint">IMDb Details ↗</span>
                </div>
                <div class="tmdb-info">
                    <div class="tmdb-title" title="${cleanTitle}">${showName}</div>
                    <div class="tmdb-year">${year}</div>
                    ${overview ? `<div class="tmdb-overview">${overview}</div>` : ''}
                    
                    <div class="tmdb-service-row" onclick="event.stopPropagation();">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                            <label style="font-size: 0.75rem; color: var(--text-muted); display: block;">Service</label>
                            ${detectedKey ? `<span style="font-size: 0.72rem; color: var(--accent-color); font-weight: 500;">✓ ${serviceMeta[detectedKey]?.name || detectedKey}</span>` : ''}
                        </div>
                        <select class="admin-select-dropdown" id="service-${item.id}">
                            <option value="">None / Unknown</option>
                            ${serviceOptions}
                            <option value="youtube" ${initialService === 'youtube' ? 'selected' : ''}>YouTube TV</option>
                            <option value="netflix" ${initialService === 'netflix' ? 'selected' : ''}>Netflix</option>
                            <option value="disney" ${initialService === 'disney' ? 'selected' : ''}>Disney+</option>
                            <option value="peacock" ${initialService === 'peacock' ? 'selected' : ''}>Peacock</option>
                            <option value="hulu" ${initialService === 'hulu' ? 'selected' : ''}>Hulu</option>
                            <option value="prime" ${initialService === 'prime' ? 'selected' : ''}>Prime Video</option>
                            <option value="appletv" ${initialService === 'appletv' ? 'selected' : ''}>Apple TV+</option>
                        </select>
                    </div>

                    <button class="btn primary-btn add-supabase-btn" style="margin-top: auto; width: 100%; font-size: 0.85rem;" data-tmdb-id="${item.id}" data-title="${cleanTitle}" data-year="${year}" data-poster="${poster}">
                        ${isAlreadyInLib ? '✓ In Library' : '+ Add to Library'}
                    </button>
                </div>
            `;

            // Background provider enrichment if not known upfront
            if (!detectedKey) {
                const cloudKey = localStorage.getItem('tmdb_api_key');
                if (cloudKey && !tmdbId.startsWith('custom_')) {
                    fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${cloudKey}&language=en-US&append_to_response=watch/providers`)
                        .then(r => r.ok ? r.json() : null)
                        .then(det => {
                            if (det) {
                                const asyncKey = extractServiceFromTmdbDetails(det);
                                if (asyncKey) {
                                    const sel = document.getElementById(`service-${item.id}`);
                                    if (sel && (!sel.value || sel.value === '')) {
                                        sel.value = asyncKey;
                                    }
                                }
                            }
                        })
                        .catch(() => {});
                }
            }

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
                let serviceId = serviceSelect?.value || initialService || detectShowServiceSync(item) || '';

                if (!serviceId) {
                    const key = await window.db.getSystemSetting('tmdb_api_key') || localStorage.getItem('tmdb_api_key');
                    if (key && tmdbId && !tmdbId.startsWith('custom_')) {
                        try {
                            const detRes = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${key}&language=en-US&append_to_response=watch/providers`);
                            if (detRes.ok) {
                                const det = await detRes.json();
                                serviceId = extractServiceFromTmdbDetails(det) || '';
                            }
                        } catch(e) {}
                    }
                }

                const isCustomName = ['youtube', 'netflix', 'disney', 'peacock', 'hulu', 'prime', 'appletv'].includes(serviceId);
                const resolvedServiceName = isCustomName ? (serviceMeta[serviceId]?.name || serviceId) : (serviceId || 'Unknown');

                const payload = {
                    id: uuid,
                    tmdb_id: tmdbId,
                    title: showName,
                    type: 'series_season',
                    release_year: parseInt(year) || null,
                    poster_url: poster,
                    streaming_service_id: isCustomName ? null : (serviceId || null),
                    mock_service: resolvedServiceName
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
                    const badge = card.querySelector('.tmdb-badge-in-lib');
                    if (!badge) {
                        const newBadge = document.createElement('span');
                        newBadge.className = 'tmdb-badge-in-lib';
                        newBadge.textContent = '✓ In Library';
                        card.querySelector('.tmdb-poster-container')?.prepend(newBadge);
                    }
                    showToast(`Added "${payload.title}" to your library!`, 'success');
                }
            };

            const posterContainer = card.querySelector('.tmdb-poster-container');
            if (posterContainer) {
                posterContainer.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const svc = document.getElementById(`service-${item.id}`)?.value || initialService;
                    openImdbModal({
                        id: item.id,
                        tmdb_id: item.id,
                        title: showName,
                        name: showName,
                        poster: poster,
                        poster_path: item.poster_path,
                        year: year,
                        first_air_date: item.first_air_date,
                        overview: item.overview,
                        rating: item.vote_average,
                        service: svc
                    });
                });
                posterContainer.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        const svc = document.getElementById(`service-${item.id}`)?.value || initialService;
                        openImdbModal({
                            id: item.id,
                            tmdb_id: item.id,
                            title: showName,
                            name: showName,
                            poster: poster,
                            poster_path: item.poster_path,
                            year: year,
                            first_air_date: item.first_air_date,
                            overview: item.overview,
                            rating: item.vote_average,
                            service: svc
                        });
                    }
                });
            }

            const addBtn = card.querySelector('.add-supabase-btn');
            if (addBtn) {
                addBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleAddShow(addBtn);
                });
            }

            tmdbResultsGrid.appendChild(card);
        });
    }

    // Boot
    init();
});
