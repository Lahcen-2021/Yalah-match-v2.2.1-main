
const date = new Date("2026-03-13T12:00:00Z");
const options = { timeZone: 'Africa/Casablanca', hour: '2-digit', minute: '2-digit', hour12: false };
console.log("Morocco Time (Africa/Casablanca) for 12:00 UTC:", new Intl.DateTimeFormat('en-GB', options).format(date));
console.log("UTC Time:", new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }).format(date));
