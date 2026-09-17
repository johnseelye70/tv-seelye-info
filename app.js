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
    const versionBtn = document.getElementById('version-btn');
    const closeChangelogBtn = document.getElementById('close-changelog-btn');
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

    // Admin Authentication Elements
    const adminAuthModal = document.getElementById('admin-auth-modal');
    const closeAdminAuthBtn = document.getElementById('close-admin-auth-btn');
    const adminAuthTitle = document.getElementById('admin-auth-title');
    const adminAuthDesc = document.getElementById('admin-auth-desc');
    const adminVerifyForm = document.getElementById('admin-verify-form');
    const adminPassInput = document.getElementById('admin-pass-input');
    const adminVerifySubmitBtn = document.getElementById('admin-verify-submit-btn');
    const adminVerifyCancelBtn = document.getElementById('admin-verify-cancel-btn');
    const adminSetupForm = document.getElementById('admin-setup-form');
    const adminSetupPass = document.getElementById('admin-setup-pass');
    const adminSetupConfirm = document.getElementById('admin-setup-confirm');
    const adminSetupSubmitBtn = document.getElementById('admin-setup-submit-btn');
    const adminSetupCancelBtn = document.getElementById('admin-setup-cancel-btn');
    const adminAuthError = document.getElementById('admin-auth-error');
    const adminAuthStatus = document.getElementById('admin-auth-status');
    const adminChangePass = document.getElementById('admin-change-pass');
    const adminChangeConfirm = document.getElementById('admin-change-confirm');
    const updateAdminPassBtn = document.getElementById('update-admin-pass-btn');
    const adminPassStatus = document.getElementById('admin-pass-status');

    // --- Hardened Cryptographic Admin Authentication & Rate Limiting ---
    async function hashSha256(text) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function getStoredAdminHash() {
        try {
            const cloudHash = await window.db.getSystemSetting('admin_password_hash');
            if (cloudHash) {
                localStorage.setItem('tv_admin_password_hash', cloudHash);
                return cloudHash;
            }
        } catch (e) {
            console.warn("Could not retrieve admin password hash from cloud:", e);
        }
        return localStorage.getItem('tv_admin_password_hash') || null;
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
        if (sessionStorage.getItem('tv_admin_authed') === 'true') {
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

        const storedHash = await getStoredAdminHash();
        if (!storedHash) {
            // Mode: Initial Setup
            if (adminAuthTitle) adminAuthTitle.textContent = 'Setup Admin Password';
            if (adminAuthDesc) adminAuthDesc.textContent = 'Create a secure master password to safeguard Settings and Version History. Only you will know this password.';
            if (adminVerifyForm) adminVerifyForm.style.display = 'none';
            if (adminSetupForm) adminSetupForm.style.display = 'block';
            if (adminSetupPass) adminSetupPass.value = '';
            if (adminSetupConfirm) adminSetupConfirm.value = '';
            if (adminAuthModal) adminAuthModal.classList.remove('hidden');
            setTimeout(() => { if (adminSetupPass) adminSetupPass.focus(); }, 100);
        } else {
            // Mode: Verification
            if (adminAuthTitle) adminAuthTitle.textContent = 'Admin Access Required';
            if (adminAuthDesc) adminAuthDesc.textContent = 'Enter your master admin password to continue.';
            if (adminSetupForm) adminSetupForm.style.display = 'none';
            if (adminVerifyForm) adminVerifyForm.style.display = 'block';
            if (adminPassInput) {
                adminPassInput.value = '';
                adminPassInput.disabled = false;
            }
            if (adminVerifySubmitBtn) adminVerifySubmitBtn.disabled = false;
            if (adminAuthModal) adminAuthModal.classList.remove('hidden');
            if (!checkLockoutState()) {
                setTimeout(() => { if (adminPassInput) adminPassInput.focus(); }, 100);
            }
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
        if (viewChangelog) {
            viewChangelog.classList.toggle('active', viewName === 'changelog');
            viewChangelog.style.display = viewName === 'changelog' ? 'block' : 'none';
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
        ['netflix', 'disney', 'peacock', 'hulu', 'prime', 'youtube', 'appletv'].forEach(svc => {
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
                let res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${key}&append_to_response=external_ids,credits,content_ratings`);
                if (res.ok) {
                    details = await res.json();
                    imdbId = details.external_ids?.imdb_id || null;
                } else {
                    res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${key}&append_to_response=external_ids,credits,release_dates`);
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

                const svcName = item.service ? (serviceMeta[item.service]?.name || item.service) : 'Custom';
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
            });
        });
        
        closeSettingsBtn.addEventListener('click', () => {
            settingsModal.classList.add('hidden');
        });

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
                if (imdbModal && !imdbModal.classList.contains('hidden')) {
                    closeImdbModal();
                }
                if (adminAuthModal && !adminAuthModal.classList.contains('hidden')) {
                    closeAdminAuthModal();
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
        if (adminSetupCancelBtn) {
            adminSetupCancelBtn.addEventListener('click', closeAdminAuthModal);
        }
        if (adminAuthModal) {
            adminAuthModal.addEventListener('click', (e) => {
                if (e.target === adminAuthModal) closeAdminAuthModal();
            });
        }

        // Admin Setup Form (Initial Password Creation)
        if (adminSetupForm) {
            adminSetupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                adminAuthError.style.display = 'none';
                adminAuthError.textContent = '';

                const pass = adminSetupPass.value;
                const confirm = adminSetupConfirm.value;

                if (!pass || pass.length < 4) {
                    adminAuthError.textContent = 'Password must be at least 4 characters.';
                    adminAuthError.style.display = 'block';
                    return;
                }
                if (pass !== confirm) {
                    adminAuthError.textContent = 'Passwords do not match. Please verify.';
                    adminAuthError.style.display = 'block';
                    return;
                }

                adminSetupSubmitBtn.disabled = true;
                adminSetupSubmitBtn.textContent = 'Saving...';
                try {
                    const hash = await hashSha256(pass);
                    await saveAdminHash(hash);
                    sessionStorage.setItem('tv_admin_authed', 'true');
                    showToast('Admin password created successfully!', 'success');
                    closeAdminAuthModal();
                    if (typeof pendingAdminCallback === 'function') {
                        const cb = pendingAdminCallback;
                        pendingAdminCallback = null;
                        cb();
                    }
                } catch (err) {
                    adminAuthError.textContent = 'Error saving password: ' + err.message;
                    adminAuthError.style.display = 'block';
                } finally {
                    adminSetupSubmitBtn.disabled = false;
                    adminSetupSubmitBtn.textContent = 'Save Password';
                }
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
                        sessionStorage.setItem('tv_admin_authed', 'true');
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
                const newPass = adminChangePass.value;
                const confirmPass = adminChangeConfirm.value;
                adminPassStatus.style.display = 'block';

                if (!newPass || newPass.length < 4) {
                    adminPassStatus.textContent = 'Password must be at least 4 characters.';
                    adminPassStatus.style.color = '#ff4444';
                    return;
                }
                if (newPass !== confirmPass) {
                    adminPassStatus.textContent = 'Passwords do not match.';
                    adminPassStatus.style.color = '#ff4444';
                    return;
                }

                updateAdminPassBtn.disabled = true;
                updateAdminPassBtn.textContent = 'Updating...';
                try {
                    const newHash = await hashSha256(newPass);
                    await saveAdminHash(newHash);
                    adminPassStatus.textContent = 'Admin password updated successfully!';
                    adminPassStatus.style.color = 'var(--success-color)';
                    adminChangePass.value = '';
                    adminChangeConfirm.value = '';
                    showToast('Admin password updated successfully!', 'success');
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
                            <option value="appletv" ${initialService === 'appletv' ? 'selected' : ''}>Apple TV+</option>
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
                const isCustomName = ['youtube', 'netflix', 'disney', 'peacock', 'hulu', 'prime', 'appletv'].includes(serviceId);

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
