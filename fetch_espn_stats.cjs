const https = require('https');
const fs = require('fs');

https.get('https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/statistics', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    fs.writeFileSync('espn_stats.json', data);
    console.log('Done');
  });
});
