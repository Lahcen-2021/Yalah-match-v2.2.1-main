
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('all_competitions.json', 'utf8'));
const names = data.map(c => c.name);
console.log(JSON.stringify(names, null, 2));
