import type { City, Airport } from './types';
import { supabase } from './supabase';

const API_KEY = process.env.EXPO_PUBLIC_AIRLABS_API_KEY;
const BASE_URL = 'https://airlabs.co/api/v9';

// Search airports from cache first, then API if needed
export async function searchAirports(query: string): Promise<Airport[]> {
  if (!query || query.length < 2) return [];

  const searchTerm = query.toLowerCase().trim();

  try {
    // 1. First, search in local cache
    const { data: cachedAirports, error: cacheError } = await supabase
      .from('airports_cache')
      .select('iata_code, name, city, country_code')
      .or(`name_lower.ilike.%${searchTerm}%,city_lower.ilike.%${searchTerm}%,iata_code.ilike.%${searchTerm}%`)
      .limit(10);

    if (!cacheError && cachedAirports && cachedAirports.length > 0) {
      return cachedAirports;
    }

    // 2. If not in cache and API key is configured, call API
    if (!API_KEY || API_KEY === 'your-airlabs-api-key') {
      return [];
    }

    const response = await fetch(
      `${BASE_URL}/suggest?q=${encodeURIComponent(query)}&api_key=${API_KEY}`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    if (!data || data.error) {
      return [];
    }

    const airportsData = data.response?.airports || [];

    if (!Array.isArray(airportsData)) {
      return [];
    }

    // 3. Map and filter valid airports
    const airports: Airport[] = airportsData
      .filter((airport: any) => airport && airport.iata_code && airport.name)
      .map((airport: any) => ({
        iata_code: airport.iata_code,
        name: airport.name,
        city: airport.city || airport.name,
        country_code: airport.country_code || '',
      }));

    // 4. Cache the results for future searches
    if (airports.length > 0) {
      const airportsToInsert = airports.map((airport) => ({
        iata_code: airport.iata_code,
        name: airport.name,
        city: airport.city,
        country_code: airport.country_code,
        name_lower: airport.name.toLowerCase(),
        city_lower: airport.city.toLowerCase(),
      }));

      await supabase
        .from('airports_cache')
        .upsert(airportsToInsert, {
          onConflict: 'iata_code',
          ignoreDuplicates: true,
        });
    }

    return airports;
  } catch (error) {
    console.error('Error searching airports:', error);
    return [];
  }
}

export async function searchCities(query: string): Promise<City[]> {
  const airports = await searchAirports(query);
  return airports.map((airport) => ({
    name: `${airport.name} (${airport.iata_code})`,
    city_code: airport.iata_code,
    country_code: airport.country_code,
  }));
}

export const COUNTRIES = [
  { code: 'FR', name: 'France' },
  { code: 'BE', name: 'Belgique' },
  { code: 'CH', name: 'Suisse' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MC', name: 'Monaco' },
  { code: 'DE', name: 'Allemagne' },
  { code: 'IT', name: 'Italie' },
  { code: 'ES', name: 'Espagne' },
  { code: 'PT', name: 'Portugal' },
  { code: 'GB', name: 'Royaume-Uni' },
  { code: 'NL', name: 'Pays-Bas' },
  { code: 'SN', name: 'Sénégal' },
  { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'CM', name: 'Cameroun' },
  { code: 'MA', name: 'Maroc' },
  { code: 'DZ', name: 'Algérie' },
  { code: 'TN', name: 'Tunisie' },
  { code: 'ML', name: 'Mali' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'GN', name: 'Guinée' },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]['code'];
