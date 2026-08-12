const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');
const mockData = fs.readFileSync('mock_data.js', 'utf8');
app = app.replace(/function getMockData\(\) \{[\s\S]*?\];\s*\}/, mockData);
app = app.replace(/<option value="dropped">Dropped<\/option>/g, '<option value="dropped">Not Interested</option>');
fs.writeFileSync('app.js', app);
console.log('updated app.js');
