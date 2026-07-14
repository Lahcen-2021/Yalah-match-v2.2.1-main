const fs = require('fs');
const data = JSON.parse(fs.readFileSync('espn_standings.json', 'utf8'));
console.log(Object.keys(data));
if (data.children) {
  console.log('children[0] keys:', Object.keys(data.children[0]));
  console.log('children[0].standings.entries[0]:', JSON.stringify(data.children[0].standings.entries[0], null, 2));
}
