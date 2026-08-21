const fs = require('fs');
const data = JSON.parse(fs.readFileSync('espn_summary.json', 'utf8'));
const goals = data.keyEvents.filter(e => e.type.type === 'goal');
console.log('goals:', JSON.stringify(goals, null, 2));
const boxscoreTeams = data.boxscore.teams;
console.log('boxscore teams:', JSON.stringify(boxscoreTeams, null, 2));
