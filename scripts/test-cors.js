const https = require('https');
https.get('https://yallamatch.pages.dev/api/matches?date=2026-04-30', (res) => {
    console.log(res.statusCode);
    console.log(res.headers);
});
