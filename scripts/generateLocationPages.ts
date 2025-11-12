/**
 * Generate location pages for areas with 3+ movies
 * Creates location_[slug].json files and clickable-regions.geojson
 */

import * as fs from 'fs'
import * as path from 'path'

interface Location {
  lat: number
  lng: number
  city: string
  country: string
  description: string
}

interface Movie {
  movie_id: string
  title: string
  year: number
  genres: string[]
  poster?: string
  banner_1280?: string
  thumbnail_52?: string
  imdb_rating?: number
  locations: Location[]
}

// Slugify function
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Normalize country name to English
function normalizeCountryName(country: string): string {
  const countryMap: Record<string, string> = {
    'Deutschland': 'Germany',
    'Italia': 'Italy',
    'España': 'Spain',
    'France': 'France',
    'République française': 'France',
    'United States of America': 'United States of America',
    'USA': 'United States of America',
    'US': 'United States of America',
    'United Kingdom': 'United Kingdom',
    'UK': 'United Kingdom',
    'Éire / Ireland': 'Ireland',
    'Ireland': 'Ireland',
  }

  return countryMap[country.trim()] || country
}

// Calculate city center from multiple locations
function calculateCenter(locations: Location[]): { lat: number; lng: number } {
  const lat = locations.reduce((sum, loc) => sum + loc.lat, 0) / locations.length
  const lng = locations.reduce((sum, loc) => sum + loc.lng, 0) / locations.length
  return { lat, lng }
}

// Calculate distance between two coordinates in kilometers (Haversine formula)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Merge nearby cities that are too close together
function mergeNearbyCities(
  cities: Array<[string, { movies: Movie[]; locations: Location[]; country: string; originalCityName: string }]>,
  proximityThresholdKm: number = 15 // Cities within 15km will be merged
): Array<[string, { movies: Movie[]; locations: Location[]; country: string; originalCityName: string }]> {

  // Calculate centers for all cities
  const citiesWithCenters = cities.map(([name, data]) => ({
    name,
    data,
    center: calculateCenter(data.locations)
  }))

  // Track which cities have been merged
  const merged = new Set<number>()
  const result: Array<[string, { movies: Movie[]; locations: Location[]; country: string; originalCityName: string }]> = []

  for (let i = 0; i < citiesWithCenters.length; i++) {
    if (merged.has(i)) continue

    const city1 = citiesWithCenters[i]
    let bestCity = { ...city1 }
    const toMerge: number[] = []

    // Find all cities within proximity threshold
    for (let j = i + 1; j < citiesWithCenters.length; j++) {
      if (merged.has(j)) continue

      const city2 = citiesWithCenters[j]

      // Only merge cities in the same country
      if (city1.data.country !== city2.data.country) continue

      const distance = calculateDistance(
        city1.center.lat, city1.center.lng,
        city2.center.lat, city2.center.lng
      )

      if (distance <= proximityThresholdKm) {
        toMerge.push(j)
        console.log(`  🔗 Merging: ${city2.name} (${city2.data.movies.length} movies) → ${city1.name} (${city1.data.movies.length} movies) [${distance.toFixed(1)}km apart]`)
      }
    }

    // Merge all nearby cities into the one with most movies
    if (toMerge.length > 0) {
      const allCities = [{ index: i, ...city1 }, ...toMerge.map(idx => ({ index: idx, ...citiesWithCenters[idx] }))]

      // Sort by movie count and pick the one with most movies
      allCities.sort((a, b) => b.data.movies.length - a.data.movies.length)
      const primaryCity = allCities[0]

      // Merge all movies and locations from other cities into primary
      const mergedMovies = new Map<string, Movie>()
      const mergedLocations: Location[] = []

      allCities.forEach(city => {
        // Add all unique movies
        city.data.movies.forEach(movie => {
          mergedMovies.set(movie.movie_id, movie)
        })
        // Add all locations
        mergedLocations.push(...city.data.locations)
        // Mark as merged
        merged.add(city.index)
      })

      bestCity = {
        name: primaryCity.name,
        data: {
          movies: Array.from(mergedMovies.values()),
          locations: mergedLocations,
          country: primaryCity.data.country,
          originalCityName: primaryCity.data.originalCityName
        },
        center: calculateCenter(mergedLocations)
      }
    } else {
      merged.add(i)
    }

    result.push([bestCity.name, bestCity.data])
  }

  return result
}

// List of major cities to include (top cities per country)
const MAJOR_CITIES: Record<string, string[]> = {
  'United States': [
    // Major Metro Areas
    'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose',
    // Film Industry Hubs
    'Hollywood', 'Beverly Hills', 'Burbank', 'Pasadena', 'Santa Monica', 'Malibu', 'Long Beach', 'Glendale',
    // Major Cities
    'San Francisco', 'Seattle', 'Boston', 'Miami', 'Atlanta', 'Washington', 'Denver', 'Las Vegas', 'Portland', 'Detroit',
    // Tech & Culture Hubs
    'Austin', 'Nashville', 'Minneapolis', 'Tampa', 'Orlando', 'Charlotte', 'Raleigh', 'Indianapolis', 'Columbus', 'Jacksonville',
    // Historic & Film Locations
    'New Orleans', 'Baltimore', 'Pittsburgh', 'Cincinnati', 'Cleveland', 'Kansas City', 'St. Louis', 'Milwaukee', 'Buffalo',
    // West Coast
    'Sacramento', 'Fresno', 'Oakland', 'Anaheim', 'Santa Barbara', 'San Bernardino', 'Riverside', 'Monterey', 'Santa Cruz',
    // Southwest
    'Albuquerque', 'Tucson', 'El Paso', 'Mesa', 'Scottsdale', 'Tempe',
    // Northwest
    'Spokane', 'Tacoma', 'Vancouver', 'Salem', 'Eugene', 'Boise',
    // Mountain States
    'Salt Lake City', 'Colorado Springs', 'Aurora', 'Boulder',
    // East Coast
    'Newark', 'Jersey City', 'Hoboken', 'Providence', 'Hartford', 'Stamford', 'Bridgeport',
    // South
    'Memphis', 'Louisville', 'Richmond', 'Virginia Beach', 'Savannah', 'Charleston', 'Wilmington',
    // Florida
    'Fort Lauderdale', 'West Palm Beach', 'Key West', 'Pensacola', 'Tallahassee',
    // Texas
    'Fort Worth', 'Arlington', 'Corpus Christi', 'Plano', 'Lubbock', 'Irving',
    // Other Notable
    'Honolulu', 'Anchorage', 'Madison', 'Des Moines', 'Omaha', 'Wichita', 'Tulsa', 'Oklahoma City'
  ],
  'United Kingdom': [
    // England - Major Cities
    'London', 'Birmingham', 'Manchester', 'Leeds', 'Liverpool', 'Sheffield', 'Bristol', 'Newcastle', 'Nottingham', 'Leicester',
    // England - Film Locations & Historic
    'Oxford', 'Cambridge', 'Bath', 'York', 'Canterbury', 'Winchester', 'Durham', 'Chester', 'Salisbury', 'Exeter',
    // England - Coastal & Tourist
    'Brighton', 'Portsmouth', 'Southampton', 'Plymouth', 'Bournemouth', 'Blackpool', 'Scarborough', 'Whitby',
    // England - Greater London & Home Counties
    'Westminster', 'Kensington', 'Camden', 'Greenwich', 'Richmond', 'Kingston', 'Croydon', 'Bromley', 'Brent', 'Ealing',
    // England - Film Studios & Locations
    'Iver Heath', 'Watford', 'Hertford', 'St Albans', 'Hatfield', 'Guildford', 'Slough', 'Reading', 'Windsor', 'Eton',
    // England - North
    'Bradford', 'Wakefield', 'Huddersfield', 'Halifax', 'Middlesbrough', 'Sunderland', 'Carlisle', 'Lancaster',
    // England - Midlands
    'Coventry', 'Derby', 'Stoke', 'Wolverhampton', 'Gloucester', 'Worcester', 'Lincoln', 'Northampton', 'Peterborough',
    // England - East
    'Norwich', 'Ipswich', 'Colchester', 'Chelmsford', 'Southend', 'Luton', 'Milton Keynes',
    // England - South West
    'Truro', 'Penzance', 'Newquay', 'Torquay', 'Taunton', 'Yeovil', 'Weymouth', 'Dorchester',
    // Scotland
    'Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee', 'Inverness', 'Stirling', 'Perth', 'Fort William', 'St Andrews', 'Oban',
    // Wales
    'Cardiff', 'Swansea', 'Newport', 'Bangor', 'Wrexham', 'Aberystwyth', 'Caernarfon', 'Conwy', 'Llandudno',
    // Northern Ireland
    'Belfast', 'Derry', 'Lisburn', 'Newry', 'Armagh', 'Ballymena', 'Enniskillen',
    // Film-Specific Locations
    'Alnwick', 'Bamburgh', 'Lacock', 'Castle Combe', 'Rye', 'Ludlow', 'Stratford-upon-Avon'
  ],
  'England': [
    // Alias for United Kingdom - England specifically
    'London', 'Birmingham', 'Manchester', 'Leeds', 'Liverpool', 'Sheffield', 'Bristol', 'Newcastle', 'Nottingham', 'Leicester',
    'Oxford', 'Cambridge', 'Bath', 'York', 'Brighton', 'Portsmouth', 'Southampton', 'Plymouth', 'Iver Heath', 'Watford'
  ],
  'Scotland': [
    'Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee', 'Inverness', 'Stirling', 'Perth', 'Fort William', 'St Andrews', 'Oban'
  ],
  'Wales': [
    'Cardiff', 'Swansea', 'Newport', 'Bangor', 'Wrexham', 'Aberystwyth', 'Caernarfon', 'Conwy', 'Llandudno'
  ],
  'Northern Ireland': [
    'Belfast', 'Derry', 'Lisburn', 'Newry', 'Armagh', 'Ballymena', 'Enniskillen'
  ],
  'France': [
    // Major Cities
    'Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille',
    // Film & Tourist Destinations
    'Cannes', 'Monaco', 'Saint-Tropez', 'Antibes', 'Deauville', 'Biarritz', 'La Rochelle', 'Saint-Malo',
    // Historic & Cultural
    'Versailles', 'Fontainebleau', 'Orleans', 'Tours', 'Reims', 'Avignon', 'Arles', 'Carcassonne', 'Annecy',
    // Alps & Mountains
    'Grenoble', 'Chamonix', 'Albertville', 'Megève', 'Courchevel',
    // Provence & Riviera
    'Aix-en-Provence', 'Toulon', 'Grasse', 'Menton', 'Èze',
    // Other Major
    'Rennes', 'Dijon', 'Le Havre', 'Saint-Étienne', 'Clermont-Ferrand', 'Limoges', 'Amiens', 'Perpignan', 'Besançon', 'Brest'
  ],
  'Italy': [
    // Major Cities
    'Rome', 'Milan', 'Naples', 'Turin', 'Palermo', 'Genoa', 'Bologna', 'Florence', 'Bari', 'Catania',
    // Tourist & Film Destinations
    'Venice', 'Verona', 'Pisa', 'Siena', 'Perugia', 'Assisi', 'Padua', 'Mantua', 'Ravenna', 'Ferrara',
    // Coastal & Islands
    'Capri', 'Positano', 'Amalfi', 'Sorrento', 'Portofino', 'Cinque Terre', 'Taormina', 'Syracuse', 'Cagliari',
    // Tuscany
    'Lucca', 'Arezzo', 'Montepulciano', 'San Gimignano', 'Cortona', 'Volterra',
    // North
    'Trieste', 'Trento', 'Bolzano', 'Bergamo', 'Brescia', 'Como', 'Lecco',
    // South
    'Salerno', 'Lecce', 'Matera', 'Brindisi', 'Taranto', 'Reggio Calabria', 'Messina'
  ],
  'Spain': [
    // Major Cities
    'Madrid', 'Barcelona', 'Valencia', 'Seville', 'Zaragoza', 'Málaga', 'Murcia', 'Palma', 'Las Palmas', 'Bilbao',
    // Tourist & Film Destinations
    'Granada', 'Córdoba', 'Toledo', 'Segovia', 'Salamanca', 'Santiago de Compostela', 'San Sebastián',
    // Coastal
    'Alicante', 'Marbella', 'Ibiza', 'Mallorca', 'Menorca', 'Benidorm', 'Torremolinos', 'Cadiz', 'Tarragona',
    // Historic
    'Ávila', 'Cáceres', 'Cuenca', 'Ronda', 'Mérida', 'León', 'Burgos', 'Pamplona',
    // Other Major
    'Valladolid', 'Vigo', 'Gijón', 'A Coruña', 'Vitoria', 'Elche', 'Oviedo', 'Santander', 'Almería'
  ],
  'Germany': [
    // Major Cities
    'Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig',
    // Historic & Film Locations
    'Dresden', 'Nuremberg', 'Heidelberg', 'Rothenburg', 'Bamberg', 'Würzburg', 'Regensburg', 'Trier', 'Freiburg',
    // Cultural Hubs
    'Bremen', 'Hanover', 'Bonn', 'Münster', 'Karlsruhe', 'Mannheim', 'Augsburg', 'Wiesbaden', 'Göttingen',
    // East Germany
    'Potsdam', 'Weimar', 'Erfurt', 'Jena', 'Magdeburg', 'Halle', 'Rostock', 'Schwerin',
    // Bavaria
    'Garmisch-Partenkirchen', 'Berchtesgaden', 'Passau', 'Landshut', 'Ingolstadt',
    // Other Notable
    'Aachen', 'Kiel', 'Lübeck', 'Mainz', 'Saarbrücken', 'Ulm', 'Konstanz', 'Flensburg'
  ],
  'Canada': ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 'Edmonton'],
  'Australia': [
    // Major Cities
    'Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Canberra', 'Newcastle', 'Wollongong', 'Hobart',
    // New South Wales
    'Parramatta', 'Penrith', 'Blacktown', 'Liverpool', 'Manly', 'Bondi', 'Cronulla', 'Byron Bay', 'Port Macquarie',
    // Victoria
    'Geelong', 'Ballarat', 'Bendigo', 'Shepparton', 'Mornington Peninsula', 'Dandenong', 'Frankston',
    // Queensland
    'Cairns', 'Townsville', 'Toowoomba', 'Mackay', 'Rockhampton', 'Bundaberg', 'Sunshine Coast', 'Surfers Paradise', 'Noosa',
    // Western Australia
    'Fremantle', 'Mandurah', 'Bunbury', 'Kalgoorlie', 'Broome', 'Albany',
    // South Australia
    'Mount Gambier', 'Whyalla', 'Murray Bridge', 'Port Lincoln', 'Barossa Valley',
    // Tasmania
    'Launceston', 'Devonport', 'Burnie', 'Port Arthur',
    // Northern Territory
    'Darwin', 'Alice Springs', 'Katherine',
    // Australian Capital Territory
    'Canberra'
  ],
  'Japan': ['Tokyo', 'Osaka', 'Kyoto', 'Yokohama', 'Nagoya', 'Sapporo'],
  'China': ['Hong Kong', 'Shanghai', 'Beijing', 'Shenzhen', 'Guangzhou'],
  'India': ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad'],
  'Mexico': ['Mexico City', 'Guadalajara', 'Monterrey', 'Tijuana'],
  'Brazil': ['Rio de Janeiro', 'São Paulo', 'Brasília', 'Salvador'],
  'Argentina': ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza'],
  'Netherlands': [
    'Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Tilburg', 'Groningen', 'Almere', 'Breda', 'Nijmegen',
    'Haarlem', 'Arnhem', 'Zaandam', 'Delft', 'Leiden', 'Maastricht', 'Dordrecht', 'Zwolle'
  ],
  'Belgium': [
    'Brussels', 'Antwerp', 'Ghent', 'Bruges', 'Charleroi', 'Liège', 'Namur', 'Leuven', 'Mons', 'Mechelen', 'Ostend', 'Tournai'
  ],
  'Switzerland': [
    'Zurich', 'Geneva', 'Bern', 'Basel', 'Lausanne', 'Lucerne', 'St. Gallen', 'Lugano', 'Interlaken', 'Zermatt', 'Montreux', 'Grindelwald'
  ],
  'Austria': [
    'Vienna', 'Salzburg', 'Innsbruck', 'Graz', 'Linz', 'Klagenfurt', 'Hallstatt', 'Kitzbühel', 'St. Anton', 'Wachau'
  ],
  'Czech Republic': [
    'Prague', 'Brno', 'Ostrava', 'Plzeň', 'Liberec', 'Olomouc', 'České Budějovice', 'Hradec Králové', 'Karlovy Vary', 'Český Krumlov'
  ],
  'Poland': [
    'Warsaw', 'Krakow', 'Gdansk', 'Wroclaw', 'Poznan', 'Lodz', 'Szczecin', 'Katowice', 'Lublin', 'Bydgoszcz', 'Zakopane', 'Torun'
  ],
  'Russia': [
    'Moscow', 'St. Petersburg', 'Kazan', 'Novosibirsk', 'Yekaterinburg', 'Nizhny Novgorod', 'Sochi', 'Vladivostok'
  ],
  'Turkey': [
    'Istanbul', 'Ankara', 'Izmir', 'Antalya', 'Bursa', 'Adana', 'Gaziantep', 'Bodrum', 'Cappadocia', 'Pamukkale', 'Ephesus'
  ],
  'Greece': [
    'Athens', 'Thessaloniki', 'Patras', 'Heraklion', 'Santorini', 'Mykonos', 'Rhodes', 'Corfu', 'Crete', 'Delphi', 'Meteora', 'Olympia'
  ],
  'Sweden': [
    'Stockholm', 'Gothenburg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro', 'Linköping', 'Helsingborg', 'Jönköping', 'Norrköping', 'Lund', 'Visby'
  ],
  'Norway': [
    'Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Drammen', 'Kristiansand', 'Tromsø', 'Ålesund', 'Lillehammer', 'Bodø', 'Flåm'
  ],
  'Denmark': [
    'Copenhagen', 'Aarhus', 'Odense', 'Aalborg', 'Esbjerg', 'Randers', 'Kolding', 'Horsens', 'Roskilde', 'Helsingør', 'Skagen'
  ],
  'Finland': [
    'Helsinki', 'Espoo', 'Tampere', 'Vantaa', 'Oulu', 'Turku', 'Jyväskylä', 'Lahti', 'Kuopio', 'Rovaniemi', 'Lapland'
  ],
  'Portugal': [
    'Lisbon', 'Porto', 'Faro', 'Braga', 'Coimbra', 'Funchal', 'Setúbal', 'Almada', 'Aveiro', 'Évora', 'Sintra', 'Cascais', 'Algarve'
  ],
  'Ireland': [
    'Dublin', 'Cork', 'Galway', 'Limerick', 'Waterford', 'Drogheda', 'Dundalk', 'Kilkenny', 'Bray', 'Wexford', 'Sligo', 'Killarney', 'Dingle', 'Wicklow'
  ],
  'Éire / Ireland': [
    'Dublin', 'Cork', 'Galway', 'Limerick', 'Waterford', 'Drogheda', 'Dundalk', 'Kilkenny', 'Bray', 'Wexford', 'Sligo', 'Killarney', 'Dingle', 'Wicklow'
  ],
  'Iceland': ['Reykjavik', 'Akureyri', 'Vik', 'Höfn', 'Selfoss'],
  'New Zealand': ['Auckland', 'Wellington', 'Christchurch', 'Queenstown'],
  'South Africa': ['Cape Town', 'Johannesburg', 'Durban', 'Pretoria'],
  'Egypt': ['Cairo', 'Alexandria', 'Giza'],
  'Morocco': ['Casablanca', 'Marrakech', 'Rabat'],
  'Thailand': ['Bangkok', 'Chiang Mai', 'Phuket', 'Pattaya'],
  'Singapore': ['Singapore'],
  'Malaysia': ['Kuala Lumpur', 'Penang'],
  'South Korea': ['Seoul', 'Busan', 'Incheon'],
  'Taiwan': ['Taipei', 'Kaohsiung'],
  'UAE': ['Dubai', 'Abu Dhabi'],
  'Israel': ['Tel Aviv', 'Jerusalem', 'Haifa'],
}

// Check if a city is a major city
function isMajorCity(city: string, country: string): boolean {
  // Normalize country name to handle variations
  let normalizedCountry = country.trim()

  // Handle US variations
  if (normalizedCountry.includes('United States') || normalizedCountry === 'USA' || normalizedCountry === 'US') {
    normalizedCountry = 'United States'
  }

  // Handle UK variations
  if (normalizedCountry.includes('United Kingdom') || normalizedCountry === 'UK' ||
      normalizedCountry === 'England' || normalizedCountry === 'Scotland' ||
      normalizedCountry === 'Wales' || normalizedCountry === 'Northern Ireland') {
    // Try specific country first, then fall back to United Kingdom
    if (MAJOR_CITIES[normalizedCountry]) {
      // Keep specific (England, Scotland, Wales, Northern Ireland)
    } else {
      normalizedCountry = 'United Kingdom'
    }
  }

  // Handle Ireland variations
  if (normalizedCountry.includes('Ireland') || normalizedCountry.includes('Éire')) {
    normalizedCountry = 'Ireland'
  }

  // Handle Germany variations
  if (normalizedCountry === 'Deutschland' || normalizedCountry === 'Germany') {
    normalizedCountry = 'Germany'
  }

  // Handle Italy variations
  if (normalizedCountry === 'Italia' || normalizedCountry === 'Italy') {
    normalizedCountry = 'Italy'
  }

  // Handle France variations
  if (normalizedCountry === 'France' || normalizedCountry === 'République française') {
    normalizedCountry = 'France'
  }

  // Handle Spain variations
  if (normalizedCountry === 'España' || normalizedCountry === 'Spain') {
    normalizedCountry = 'Spain'
  }

  // Handle Australia variations
  if (normalizedCountry.includes('Australia')) {
    normalizedCountry = 'Australia'
  }

  const majorCitiesForCountry = MAJOR_CITIES[normalizedCountry]
  if (!majorCitiesForCountry) return false  // Normalize city name for comparison (case-insensitive, trim)
  let normalizedCity = city.trim().toLowerCase()

  // Remove common prefixes like "City of", "Greater", "North/South/East/West"
  normalizedCity = normalizedCity
    .replace(/^city of\s+/i, '')
    .replace(/^greater\s+/i, '')
    .replace(/^(north|south|east|west)\s+/i, '')

  // Remove state/province suffixes (e.g., "Brisbane, Queensland, Australia")
  normalizedCity = normalizedCity.split(',')[0].trim()

  // Exclude regions/counties/states that aren't cities (for US)
  if (normalizedCountry === 'United States') {
    const excludePatterns = ['shire', 'county', 'province', 'region', 'district', ', usa', 'usa']
    if (excludePatterns.some(pattern => normalizedCity.includes(pattern))) {
      return false
    }
  } else if (normalizedCountry === 'United Kingdom' || normalizedCountry === 'England' ||
             normalizedCountry === 'Scotland' || normalizedCountry === 'Wales' ||
             normalizedCountry === 'Northern Ireland') {
    // For UK, exclude administrative districts, counties, boroughs that aren't cities
    const excludePatterns = ['shire', 'county', 'borough', 'district', 'hatfield', 'hertsmere', 'dacorum', 'spelthorne', 'waverley']
    if (excludePatterns.some(pattern => normalizedCity.includes(pattern))) {
      return false
    }
  } else {
    // For other countries, only check for shire
    const excludePatterns = ['shire', 'county', 'province', 'region', 'district']
    if (excludePatterns.some(pattern => normalizedCity.includes(pattern))) {
      return false
    }
  }

  return majorCitiesForCountry.some(majorCity =>
    normalizedCity === majorCity.toLowerCase() ||
    normalizedCity.includes(majorCity.toLowerCase()) ||
    majorCity.toLowerCase().includes(normalizedCity)
  )
}// Normalize city name for grouping (removes prefixes, suffixes)
function normalizeCity(city: string): string {
  return city.trim()
    .replace(/^city of\s+/i, '')
    .replace(/^greater\s+/i, '')
    .replace(/^(north|south|east|west)\s+/i, '')
    .replace(/\s+city$/i, '') // Remove " City" suffix (e.g., "Gold Coast City" -> "Gold Coast")
    .split(',')[0]
    .trim()
}

async function generateLocationPages() {
  console.log('🎬 Generating location pages for MAJOR CITIES with 3+ movies...\n')

  // Clean up old location files first
  const dataDir = path.join(process.cwd(), 'data')
  const files = fs.readdirSync(dataDir)
  const locationFiles = files.filter(f => f.startsWith('location_') && f.endsWith('.json'))

  if (locationFiles.length > 0) {
    console.log(`🧹 Cleaning up ${locationFiles.length} old location files...`)
    locationFiles.forEach(file => {
      fs.unlinkSync(path.join(dataDir, file))
    })
  }

  // Read movies data
  const moviesPath = path.join(process.cwd(), 'data', 'movies_enriched.json')
  const movies: Movie[] = JSON.parse(fs.readFileSync(moviesPath, 'utf-8'))

  console.log(`📊 Total movies: ${movies.length}`)

  // Group movies by NORMALIZED city (merge North/South/East/West variants)
  const cityMovies: Record<string, {
    movies: Movie[]
    locations: Location[]
    country: string
    originalCityName: string // Keep the most common city name
  }> = {}

  movies.forEach(movie => {
    movie.locations.forEach(location => {
      const normalizedCityName = normalizeCity(location.city)
      const cityKey = `${normalizedCityName}, ${location.country}`

      if (!cityMovies[cityKey]) {
        cityMovies[cityKey] = {
          movies: [],
          locations: [],
          country: location.country,
          originalCityName: normalizedCityName
        }
      }

      // Add movie if not already added for this city
      if (!cityMovies[cityKey].movies.find(m => m.movie_id === movie.movie_id)) {
        cityMovies[cityKey].movies.push(movie)
      }

      // Add location
      cityMovies[cityKey].locations.push(location)
    })
  })

  // Filter cities: must have 3+ movies AND be a major city
  const qualifiedCities = Object.entries(cityMovies)
    .filter(([cityName, data]) => {
      const city = cityName.split(', ')[0]
      const country = data.country

      // Must have at least 3 movies
      if (data.movies.length < 3) return false

      // Must be a recognized major city
      return isMajorCity(city, country)
    })
    .sort((a, b) => b[1].movies.length - a[1].movies.length) // Sort by movie count

  console.log(`\n✅ Found ${qualifiedCities.length} major cities with 3+ movies`)
  console.log(`🔍 Checking for overlapping cities within 15km...\n`)

  // Merge nearby cities that are too close together (e.g., London + Westminster)
  const mergedCities = mergeNearbyCities(qualifiedCities, 15)

  console.log(`\n✅ After merging: ${mergedCities.length} unique regions\n`)

  const regionFeatures: any[] = []
  let generatedCount = 0

  // Generate location page for each merged region
  for (const [cityName, data] of mergedCities) {
    const city = cityName.split(', ')[0]
    const country = data.country
    const normalizedCountry = normalizeCountryName(country) // Normalize for slug and display
    const slug = slugify(`${city}-${normalizedCountry}`)

    console.log(`📍 ${cityName}: ${data.movies.length} movies`)

    // Calculate center coordinates
    const center = calculateCenter(data.locations)

    // Count locations per movie
    const moviesWithLocationCount = data.movies.map(movie => ({
      movie_id: movie.movie_id,
      title: movie.title,
      year: movie.year,
      genres: movie.genres,
      poster: movie.poster,
      banner_1280: movie.banner_1280,
      thumbnail_52: movie.thumbnail_52,
      imdb_rating: movie.imdb_rating,
      londonLocationCount: movie.locations.filter(loc =>
        loc.city === city && loc.country === country
      ).length
    }))

    // Calculate stats
    const genreCounts: Record<string, number> = {}
    const decadeCounts: Record<string, number> = {}
    let totalLocations = 0

    data.movies.forEach(movie => {
      // Count genres
      movie.genres.forEach(genre => {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1
      })

      // Count decades
      const decade = `${Math.floor(movie.year / 10) * 10}s`
      decadeCounts[decade] = (decadeCounts[decade] || 0) + 1

      // Count locations in this city
      totalLocations += movie.locations.filter(loc =>
        loc.city === city && loc.country === country
      ).length
    })

    // Create location data file
    const locationData = {
      location: {
        city,
        country: normalizedCountry, // Use normalized country name
        slug,
        coordinates: center
      },
      movies: moviesWithLocationCount.sort((a, b) => {
        // Sort by rating, then year
        if (b.imdb_rating && a.imdb_rating) {
          return b.imdb_rating - a.imdb_rating
        }
        return b.year - a.year
      }),
      stats: {
        totalMovies: data.movies.length,
        totalLocations,
        genres: genreCounts,
        decades: decadeCounts
      }
    }

    // Write location data file
    const outputPath = path.join(process.cwd(), 'data', `location_${slug}.json`)
    fs.writeFileSync(outputPath, JSON.stringify(locationData, null, 2))
    generatedCount++

    // Add to clickable regions GeoJSON
    regionFeatures.push({
      type: 'Feature',
      id: generatedCount,
      properties: {
        name: `${city} Area`,
        slug,
        country: normalizedCountry, // Use normalized country name
        movieCount: data.movies.length
      },
      geometry: {
        type: 'Point',
        coordinates: [center.lng, center.lat]
      }
    })
  }

  // Create clickable-regions.geojson
  const regionsGeoJSON = {
    type: 'FeatureCollection',
    features: regionFeatures
  }

  const geoJSONPath = path.join(process.cwd(), 'public', 'geo', 'clickable-regions.geojson')
  fs.writeFileSync(geoJSONPath, JSON.stringify(regionsGeoJSON, null, 2))

  console.log(`\n✅ Generated ${generatedCount} location pages`)
  console.log(`✅ Updated clickable-regions.geojson with ${regionFeatures.length} regions`)
  console.log('\n🎉 Done!')
}

generateLocationPages().catch(console.error)
