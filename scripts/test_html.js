import fs from 'fs';
async function test() {
    const res = await fetch('https://www.messisporat.com/matches/match/?id=4674526', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    const html = await res.text();
    fs.writeFileSync('test_html.html', html);
}
test();
