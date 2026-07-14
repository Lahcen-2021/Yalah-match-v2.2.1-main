const fs = require('fs');
const data = JSON.parse(fs.readFileSync('espn_summary.json', 'utf8'));
console.log('keyEvent 0:', JSON.stringify(data.keyEvents[0], null, 2));
console.log('roster 0 keys:', Object.keys(data.rosters[0]));
console.log('roster 0 roster[0]:', JSON.stringify(data.rosters[0].roster[0], null, 2));
