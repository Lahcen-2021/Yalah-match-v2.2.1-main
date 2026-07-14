async function test() {
    const res = await fetch('https://www.messisporat.com/matches/npm/events/?MatchID=12513478&lang=27&time=%2B01%3A00');
    const data = await res.json();
    console.log(JSON.stringify(data?.["STING-WEB-Match-Details"]?.["Match-Info"], null, 2));
}
test();
