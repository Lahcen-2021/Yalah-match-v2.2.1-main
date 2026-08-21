import { fetchYanb8Leagues } from './services/api.js';

async function test() {
    try {
        const leagues = await fetchYanb8Leagues();
        console.log('Number of leagues:', leagues.length);
        leagues.forEach(l => console.log(`${l.id}: ${l.name}`));
    } catch (e) {
        console.error(e);
    }
}
test();
