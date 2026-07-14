
import fs from 'fs';

async function fetchCompetitions() {
    const url = 'https://webws.365scores.com/web/competitions/?appTypeId=5&langId=1&timezoneName=Africa/Casablanca';
    const response = await fetch(url);
    const data = await response.json();
    
    fs.writeFileSync('all_competitions_en.json', JSON.stringify(data.competitions, null, 2));
    console.log('Competitions saved to all_competitions_en.json');
}

fetchCompetitions();
