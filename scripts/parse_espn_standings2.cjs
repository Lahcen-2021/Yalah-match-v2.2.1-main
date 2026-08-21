const fs = require('fs');
const data = JSON.parse(fs.readFileSync('espn_standings.json', 'utf8'));
console.log('data is array?', Array.isArray(data));
if (Array.isArray(data)) {
  console.log('data[0] keys:', Object.keys(data[0]));
  console.log('data[0].children[0] keys:', Object.keys(data[0].children[0]));
  console.log('data[0].children[0].standings.entries[0] keys:', Object.keys(data[0].children[0].standings.entries[0]));
  console.log('data[0].children[0].standings.entries[0].stats:', JSON.stringify(data[0].children[0].standings.entries[0].stats, null, 2));
} else {
  console.log(Object.keys(data));
}
