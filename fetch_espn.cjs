const https = require('https');
const fs = require('fs');

https.get('https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=740880', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    fs.writeFileSync('espn_summary.json', data);
    console.log('Done');
  });
});
