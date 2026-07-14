async function test() {
    try {
        const response = await fetch('https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings');
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}
test();
