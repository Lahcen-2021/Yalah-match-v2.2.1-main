
import * as cheerio from 'cheerio';

async function scrapeBeinEPG() {
    const mainUrl = 'https://www.bein.com/ar/%d8%ac%d8%af%d9%88%d9%84-%d8%a7%d9%84%d8%a8%d8%ab/?c=ma&';
    console.log(`Fetching main page to get postid: ${mainUrl}`);
    
    try {
        const mainRes = await fetch(mainUrl);
        const mainHtml = await mainRes.text();
        const postidMatch = mainHtml.match(/postid\s*[:=]\s*['"]?(\d+)['"]?/i);
        const postid = postidMatch ? postidMatch[1] : "25344";
        console.log(`Using postid: ${postid}`);

        const epgUrl = 'https://www.bein.com/ar/epg-ajax-template/';
        const params = new URLSearchParams({
            action: 'epg_fetch',
            offset: '-2', // Offset for Morocco
            category: 'sports',
            serviceidentity: 'bein.net',
            mins: '00',
            cdate: '', // Empty for today
            language: 'AR',
            postid: postid,
            loadindex: '0'
        });

        console.log(`Fetching EPG from: ${epgUrl}?${params.toString()}`);
        const response = await fetch(`${epgUrl}?${params.toString()}`);
        const html = await response.text();
        const $ = cheerio.load(html);

        const channels = [];
        $('.slider').each((i, el) => {
            const $slider = $(el);
            const channelId = $slider.attr('id');
            
            // The slider is inside a div.col-xs-8...
            // The channel info is in the previous sibling div.col-xs-4...
            const $sliderCol = $slider.parent();
            const $channelCol = $sliderCol.prev();
            
            let channelName = "Unknown Channel";
            let channelLogo = "";
            let channelHref = "";

            if ($channelCol.length > 0) {
                const $img = $channelCol.find('img');
                channelLogo = $img.attr('src') || "";
                channelName = $img.attr('alt') || "";
                
                const $a = $channelCol.find('a');
                channelHref = $a.attr('href') || "";

                if (!channelName) {
                    // Try to extract from href (e.g., https://beinconnect.app/beINSPORTS1)
                    const hrefMatch = channelHref.match(/\/([^\/]+)$/);
                    if (hrefMatch) {
                        channelName = hrefMatch[1].replace(/beINSPORTS/i, 'beIN SPORTS ');
                    }
                }

                if (!channelName && channelLogo) {
                    // Try to extract from logo src (e.g., beIN_SPORTS1_DIGITAL_Mono.png)
                    const logoMatch = channelLogo.match(/\/([^\/]+)\.(png|jpg|jpeg|svg)/i);
                    if (logoMatch) {
                        // Clean up the filename to get a readable name
                        channelName = logoMatch[1]
                            .split('_DIGITAL')[0]
                            .replace(/_/g, ' ')
                            .replace(/Mono/i, '')
                            .replace(/beIN/i, 'beIN')
                            .trim();
                        
                        // Remove leading year if present (e.g., "2023 ALKASS 1")
                        channelName = channelName.replace(/^\d{4}\s+/, '');
                        
                        channelName = channelName.toUpperCase();
                    }
                }
            }
            
            // Final cleanup for channel name
            channelName = channelName.replace(/\s+/g, ' ').trim();
            if (!channelName || channelName === "UNKNOWN CHANNEL") {
                channelName = channelId.toUpperCase().replace(/_/g, ' ');
            }
            
            // Fallback: Try to extract from first program's data-img if available
            if (!channelLogo || channelLogo.includes('placeholder')) {
                const firstItemImg = $slider.find('li').first().attr('data-img');
                if (firstItemImg) channelLogo = firstItemImg;
            }

            const programs = [];
            $slider.find('li').each((j, li) => {
                const time = $(li).find('.time').text().trim();
                const title = $(li).find('.title').text().trim();
                if (time && title) {
                    programs.push({ time, title });
                }
            });

            channels.push({
                id: channelId,
                name: channelName,
                logo: channelLogo,
                href: channelHref,
                programs
            });
        });

        console.log(`Found ${channels.length} channels.`);
        
        // Print summary to console
        channels.forEach(ch => {
            console.log(`\nChannel: ${ch.name} (${ch.id})`);
            ch.programs.forEach(p => {
                console.log(`  - ${p.time}: ${p.title}`);
            });
        });

        // Save to JSON file
        const outputFilename = 'bein_epg.json';
        fs.writeFileSync(outputFilename, JSON.stringify(channels, null, 2));
        console.log(`\nData saved to ${outputFilename}`);

    } catch (error) {
        console.error("Error scraping beIN EPG:", error);
    }
}

// Ensure fs is imported
import * as fs from 'fs';
scrapeBeinEPG();
