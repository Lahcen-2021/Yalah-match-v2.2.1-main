export const LEAGUES = [
  { id: 'eng.1', name: 'الدوري الإنجليزي الممتاز' },
  { id: 'esp.1', name: 'الدوري الإسباني' },
  { id: 'ger.1', name: 'الدوري الألماني' },
  { id: 'ita.1', name: 'الدوري الإيطالي' },
  { id: 'fra.1', name: 'الدوري الفرنسي' },
];

export async function fetchLeagueStandings(leagueId: string) {
  try {
    const response = await fetch(`https://site.api.espn.com/apis/v2/sports/soccer/${leagueId}/standings`);
    if (!response.ok) {
      throw new Error(`Failed to fetch standings for ${leagueId}`);
    }
    return await response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
}
