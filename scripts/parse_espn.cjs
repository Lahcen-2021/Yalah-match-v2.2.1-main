const fs = require('fs');
const data = JSON.parse(fs.readFileSync('espn_summary.json', 'utf8'));
console.log(Object.keys(data));
if (data.rosters) console.log('rosters:', data.rosters.length);
if (data.keyEvents) console.log('keyEvents:', data.keyEvents.length);
if (data.boxscore) console.log('boxscore keys:', Object.keys(data.boxscore));
