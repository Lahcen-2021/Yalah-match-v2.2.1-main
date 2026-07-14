
import * as cheerio from 'cheerio';

async function getParams() {
    const url = 'https://www.bein.com/ar/%d8%ac%d8%af%d9%88%d9%84-%d8%a7%d9%84%d8%a8%d8%ab/?c=ma&';
    console.log("Fetching main page:", url);
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await res.text();
        const $ = cheerio.load(html);
        
        // Look for postid
        const bodyClass = $('body').attr('class');
        console.log("Body class:", bodyClass);
        const postidMatch = html.match(/postid\s*[:=]\s*['"]?(\d+)['"]?/i);
        console.log("Post ID Match (Regex):", postidMatch ? postidMatch[1] : "Not found");
        
        if (!postidMatch) {
            // Try searching for it in a different way
            const lines = html.split('\n');
            for (const line of lines) {
                if (line.includes('postid')) {
                    console.log("Line with postid:", line.trim());
                }
            }
        }

        // Look for other params in scripts
        const scripts = $('script').map((i, el) => $(el).html()).get();
        for (const script of scripts) {
            if (script && script.includes('postid')) {
                console.log("Script with postid:", script.substring(0, 1000));
            }
        }
    } catch (e) {
        console.error(e);
    }
}

getParams();
