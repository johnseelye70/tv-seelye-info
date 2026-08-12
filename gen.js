const fs = require('fs');

process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';
const shows = [
    {t: 'The Mandalorian', s: 'disney'},
    {t: 'The Book of Boba Fett', s: 'disney'},
    {t: 'Ahsoka', s: 'disney'},
    {t: 'WandaVision', s: 'disney'},
    {t: 'Loki', s: 'disney'},
    {t: 'Stranger Things', s: 'netflix'},
    {t: 'The Crown', s: 'netflix'}, 
    {t: 'Bridgerton', s: 'netflix'}, 
    {t: 'The Witcher', s: 'netflix'}, 
    {t: 'Squid Game', s: 'netflix'}, 
    {t: 'Ozark', s: 'netflix'}, 
    {t: 'The Queen\'s Gambit', s: 'netflix'}, 
    {t: 'The Office', s: 'peacock'},
    {t: 'Parks and Recreation', s: 'peacock'},
    {t: 'Yellowstone', s: 'peacock'}, 
    {t: 'Brooklyn Nine-Nine', s: 'peacock'}, 
    {t: 'The Bear', s: 'hulu'},
    {t: 'Shōgun', s: 'hulu'},
    {t: 'The Handmaid\'s Tale', s: 'hulu'}, 
    {t: 'Only Murders in the Building', s: 'hulu'}, 
    {t: 'Fargo', s: 'hulu'}, 
    {t: 'The Boys', s: 'prime'},
    {t: 'Invincible', s: 'prime'},
    {t: 'The Marvelous Mrs. Maisel', s: 'prime'}, 
    {t: 'Reacher', s: 'prime'}, 
    {t: 'Fallout', s: 'prime'}, 
    {t: 'Critical Role', s: 'youtube'},
    {t: 'Dimension 20', s: 'youtube'}, 
    {t: 'Good Mythical Morning', s: 'youtube'}
];

(async () => { 
    let id=1;
    let output = "function getMockData() {\n    return [\n";
    for (const {t, s} of shows) { 
        try { 
            const res = await fetch('https://api.tvmaze.com/search/shows?q=' + encodeURIComponent(t)); 
            const data = await res.json(); 
            if (data[0] && data[0].show.image) {
                output += `        { id: '${id++}', title: '${t.replace(/'/g, "\\'")}', type: 'series_season', release_year: 2020, mock_service: '${s}', poster_url: '${data[0].show.image.original}' },\n`;
            } 
        } catch(e) {} 
    } 
    output += "    ];\n}";
    fs.writeFileSync('mock_data.js', output);
    console.log('done');
})();
