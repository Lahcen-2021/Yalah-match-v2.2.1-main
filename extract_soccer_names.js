
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('all_competitions.json', 'utf8'));
// sportId 1 is soccer
const soccerCompetitions = data.filter(c => c.sportId === 1);
const names = soccerCompetitions.map(c => c.name);
console.log(JSON.stringify(names, null, 2));
