/**
 * Fetch and Transform - One Command Workflow
 *
 * Usage: npm run fetch 200
 *
 * This script will:
 * 1. Find N new movies from IMDb Top 250 + popular films
 * 2. Skip any movies already in the database
 * 3. Fetch movie data and locations automatically
 * 4. Save directly to movies_enriched.json (no manual review needed)
 * 5. Auto-run transform:geojson when complete
 */

import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Get target count from command line args
const targetCount = parseInt(process.argv[2] || '50', 10)

console.log('\n🎬 filmingmap Automated Fetch & Transform')
console.log('========================================\n')
console.log(`🎯 Target: Add ${targetCount} new movies to database\n`)

// DEPRECATED: Old hardcoded library - now loading from movies_input.json
// IMDb Top 500+ movies library (for auto-population)
/* Commented out - not used anymore
const MOVIE_LIBRARY_FALLBACK = [
  {"imdb_id": "tt0111161", "title": "The Shawshank Redemption"},
  {"imdb_id": "tt0068646", "title": "The Godfather"},
  {"imdb_id": "tt0468569", "title": "The Dark Knight"},
  {"imdb_id": "tt0050083", "title": "12 Angry Men"},
  {"imdb_id": "tt0108052", "title": "Schindler's List"},
  {"imdb_id": "tt0167260", "title": "The Lord of the Rings: The Return of the King"},
  {"imdb_id": "tt0110912", "title": "Pulp Fiction"},
  {"imdb_id": "tt0120737", "title": "The Lord of the Rings: The Fellowship of the Ring"},
  {"imdb_id": "tt0060196", "title": "The Good, the Bad and the Ugly"},
  {"imdb_id": "tt0109830", "title": "Forrest Gump"},
  {"imdb_id": "tt0137523", "title": "Fight Club"},
  {"imdb_id": "tt0120689", "title": "The Lord of the Rings: The Two Towers"},
  {"imdb_id": "tt0071562", "title": "The Godfather Part II"},
  {"imdb_id": "tt0080684", "title": "Star Wars: Episode V - The Empire Strikes Back"},
  {"imdb_id": "tt1375666", "title": "Inception"},
  {"imdb_id": "tt0133093", "title": "The Matrix"},
  {"imdb_id": "tt0099685", "title": "Goodfellas"},
  {"imdb_id": "tt0073486", "title": "One Flew Over the Cuckoo's Nest"},
  {"imdb_id": "tt0114369", "title": "Se7en"},
  {"imdb_id": "tt0047478", "title": "Seven Samurai"},
  {"imdb_id": "tt0317248", "title": "City of God"},
  {"imdb_id": "tt0076759", "title": "Star Wars: Episode IV - A New Hope"},
  {"imdb_id": "tt0102926", "title": "The Silence of the Lambs"},
  {"imdb_id": "tt0038650", "title": "It's a Wonderful Life"},
  {"imdb_id": "tt0118799", "title": "Life Is Beautiful"},
  {"imdb_id": "tt0120815", "title": "Saving Private Ryan"},
  {"imdb_id": "tt0245429", "title": "Spirited Away"},
  {"imdb_id": "tt0114814", "title": "The Usual Suspects"},
  {"imdb_id": "tt0110413", "title": "Léon: The Professional"},
  {"imdb_id": "tt0054215", "title": "Psycho"},
  {"imdb_id": "tt0021749", "title": "City Lights"},
  {"imdb_id": "tt0064116", "title": "Once Upon a Time in the West"},
  {"imdb_id": "tt0027977", "title": "Modern Times"},
  {"imdb_id": "tt0253474", "title": "The Pianist"},
  {"imdb_id": "tt0407887", "title": "The Departed"},
  {"imdb_id": "tt0088763", "title": "Back to the Future"},
  {"imdb_id": "tt2582802", "title": "Whiplash"},
  {"imdb_id": "tt0103064", "title": "Terminator 2: Judgment Day"},
  {"imdb_id": "tt0082971", "title": "Raiders of the Lost Ark"},
  {"imdb_id": "tt0047396", "title": "Rear Window"},
  {"imdb_id": "tt0078788", "title": "Apocalypse Now"},
  {"imdb_id": "tt0032553", "title": "The Great Dictator"},
  {"imdb_id": "tt0095327", "title": "Grave of the Fireflies"},
  {"imdb_id": "tt0078748", "title": "Alien"},
  {"imdb_id": "tt0081505", "title": "The Shining"},
  {"imdb_id": "tt0090605", "title": "Aliens"},
  {"imdb_id": "tt0057012", "title": "Dr. Strangelove"},
  {"imdb_id": "tt0043014", "title": "Sunset Boulevard"},
  {"imdb_id": "tt0051201", "title": "Paths of Glory"},
  {"imdb_id": "tt0053125", "title": "North by Northwest"},
  {"imdb_id": "tt0022100", "title": "M"},
  {"imdb_id": "tt0045152", "title": "Singin' in the Rain"},
  {"imdb_id": "tt0086879", "title": "Amadeus"},
  {"imdb_id": "tt0112573", "title": "Braveheart"},
  {"imdb_id": "tt0075314", "title": "Taxi Driver"},
  {"imdb_id": "tt0056172", "title": "Lawrence of Arabia"},
  {"imdb_id": "tt0086190", "title": "Star Wars: Episode VI - Return of the Jedi"},
  {"imdb_id": "tt0405094", "title": "The Lives of Others"},
  {"imdb_id": "tt0050825", "title": "The Seventh Seal"},
  {"imdb_id": "tt0114709", "title": "Toy Story"},
  {"imdb_id": "tt0119698", "title": "Princess Mononoke"},
  {"imdb_id": "tt0113277", "title": "Heat"},
  {"imdb_id": "tt0033467", "title": "Citizen Kane"},
  {"imdb_id": "tt0052357", "title": "Vertigo"},
  {"imdb_id": "tt0172495", "title": "Gladiator"},
  {"imdb_id": "tt0095765", "title": "Cinema Paradiso"},
  {"imdb_id": "tt0105236", "title": "Reservoir Dogs"},
  {"imdb_id": "tt0091251", "title": "Come and See"},
  {"imdb_id": "tt0180093", "title": "Requiem for a Dream"},
  {"imdb_id": "tt0055630", "title": "Yojimbo"},
  {"imdb_id": "tt0056592", "title": "To Kill a Mockingbird"},
  {"imdb_id": "tt0169547", "title": "American Beauty"},
  {"imdb_id": "tt0082096", "title": "Das Boot"},
  {"imdb_id": "tt0119217", "title": "Good Will Hunting"},
  {"imdb_id": "tt0105695", "title": "Unforgiven"},
  {"imdb_id": "tt0081398", "title": "Raging Bull"},
  {"imdb_id": "tt0036775", "title": "Double Indemnity"},
  {"imdb_id": "tt0070735", "title": "The Sting"},
  {"imdb_id": "tt0075148", "title": "Rocky"},
  {"imdb_id": "tt0066921", "title": "A Clockwork Orange"},
  {"imdb_id": "tt0040522", "title": "Bicycle Thieves"},
  {"imdb_id": "tt0046912", "title": "Dial M for Murder"},
  {"imdb_id": "tt0034583", "title": "Casablanca"},
  {"imdb_id": "tt0050976", "title": "The Bridge on the River Kwai"},
  {"imdb_id": "tt0055031", "title": "Breakfast at Tiffany's"},
  {"imdb_id": "tt0044741", "title": "High Noon"},
  {"imdb_id": "tt0071315", "title": "Chinatown"},
  {"imdb_id": "tt0053604", "title": "Ben-Hur"},
  {"imdb_id": "tt0116231", "title": "The English Patient"},
  {"imdb_id": "tt0112641", "title": "Casino"},
  {"imdb_id": "tt0107290", "title": "Jurassic Park"},
  {"imdb_id": "tt0031381", "title": "Gone with the Wind"},
  {"imdb_id": "tt0044079", "title": "A Streetcar Named Desire"},
  {"imdb_id": "tt0053291", "title": "Some Like It Hot"},
  {"imdb_id": "tt0059578", "title": "For a Few Dollars More"},
  {"imdb_id": "tt0093058", "title": "Full Metal Jacket"},
  {"imdb_id": "tt0087843", "title": "Once Upon a Time in America"},
  {"imdb_id": "tt0061512", "title": "Cool Hand Luke"},
  {"imdb_id": "tt0119488", "title": "L.A. Confidential"},
  {"imdb_id": "tt0071853", "title": "The Conversation"},
  {"imdb_id": "tt0042192", "title": "All About Eve"},
  {"imdb_id": "tt0116282", "title": "Fargo"},
  {"imdb_id": "tt0457430", "title": "Pan's Labyrinth"},
  {"imdb_id": "tt0246578", "title": "Donnie Darko"},
  {"imdb_id": "tt0083658", "title": "Blade Runner"},
  {"imdb_id": "tt0208092", "title": "Snatch"},
  {"imdb_id": "tt0167404", "title": "The Sixth Sense"},
  {"imdb_id": "tt0089881", "title": "Ran"},
  {"imdb_id": "tt0120382", "title": "The Truman Show"},
  {"imdb_id": "tt0041959", "title": "The Third Man"},
  {"imdb_id": "tt0372784", "title": "Batman Begins"},
  {"imdb_id": "tt0986264", "title": "Like Stars on Earth"},
  {"imdb_id": "tt0056443", "title": "The Manchurian Candidate"},
  {"imdb_id": "tt0119116", "title": "The Fifth Element"},
  {"imdb_id": "tt0062622", "title": "2001: A Space Odyssey"},
  {"imdb_id": "tt0469494", "title": "There Will Be Blood"},
  {"imdb_id": "tt0053198", "title": "The 400 Blows"},
  {"imdb_id": "tt0054997", "title": "Judgment at Nuremberg"},
  {"imdb_id": "tt0083987", "title": "The Thing"},
  {"imdb_id": "tt0120735", "title": "Lock, Stock and Two Smoking Barrels"},
  {"imdb_id": "tt0435761", "title": "Toy Story 3"},
  {"imdb_id": "tt0095016", "title": "Die Hard"},
  {"imdb_id": "tt0057115", "title": "The Great Escape"},
  {"imdb_id": "tt0097576", "title": "Indiana Jones and the Last Crusade"},
  {"imdb_id": "tt0211915", "title": "Amélie"},
  {"imdb_id": "tt0268978", "title": "A Beautiful Mind"},
  {"imdb_id": "tt0266697", "title": "Kill Bill: Vol. 1"},
  {"imdb_id": "tt0338013", "title": "Eternal Sunshine of the Spotless Mind"},
  {"imdb_id": "tt0047296", "title": "On the Waterfront"},
  {"imdb_id": "tt0032976", "title": "Rebecca"},
  {"imdb_id": "tt0083922", "title": "Gandhi"},
  {"imdb_id": "tt0117951", "title": "Trainspotting"},
  {"imdb_id": "tt0033870", "title": "The Maltese Falcon"},
  {"imdb_id": "tt0092005", "title": "Stand by Me"},
  {"imdb_id": "tt0107207", "title": "In the Name of the Father"},
  {"imdb_id": "tt0050986", "title": "Wild Strawberries"},
  {"imdb_id": "tt0032551", "title": "The Grapes of Wrath"},
  {"imdb_id": "tt0077416", "title": "The Deer Hunter"},
  {"imdb_id": "tt0381681", "title": "Before Sunset"},
  {"imdb_id": "tt0091763", "title": "Platoon"},
  {"imdb_id": "tt0266543", "title": "Finding Nemo"},
  {"imdb_id": "tt0477348", "title": "No Country for Old Men"},
  {"imdb_id": "tt0070047", "title": "The Exorcist"},
  {"imdb_id": "tt0112471", "title": "Before Sunrise"},
  {"imdb_id": "tt0074958", "title": "Network"},
  {"imdb_id": "tt0113247", "title": "La Haine"},
  {"imdb_id": "tt0118884", "title": "The Big Lebowski"},
  {"imdb_id": "tt0032138", "title": "The Wizard of Oz"},
  {"imdb_id": "tt0209144", "title": "Memento"},
  {"imdb_id": "tt0264464", "title": "Catch Me If You Can"},
  {"imdb_id": "tt0198781", "title": "Monsters, Inc."},
  {"imdb_id": "tt0061722", "title": "The Graduate"},
  {"imdb_id": "tt0364569", "title": "Oldboy"},
  {"imdb_id": "tt0405159", "title": "Million Dollar Baby"},
  {"imdb_id": "tt0012349", "title": "The Kid"},
  {"imdb_id": "tt0119094", "title": "Gattaca"},
  {"imdb_id": "tt0079470", "title": "Life of Brian"},
  {"imdb_id": "tt0087544", "title": "The Terminator"},
  {"imdb_id": "tt0070510", "title": "Papillon"},
  {"imdb_id": "tt0381849", "title": "3 Idiots"},
  {"imdb_id": "tt0401792", "title": "Sin City"},
  {"imdb_id": "tt0319262", "title": "The Bourne Supremacy"},
  {"imdb_id": "tt0372183", "title": "The Bourne Identity"},
  {"imdb_id": "tt0440963", "title": "The Bourne Ultimatum"},
  {"imdb_id": "tt0099348", "title": "Dances with Wolves"},
  {"imdb_id": "tt0120338", "title": "Titanic"},
  {"imdb_id": "tt0910970", "title": "WALL·E"},
  {"imdb_id": "tt0363163", "title": "Der Untergang"},
  {"imdb_id": "tt0434409", "title": "V for Vendetta"},
  {"imdb_id": "tt0097165", "title": "Dead Poets Society"},
  {"imdb_id": "tt0405508", "title": "Hotel Rwanda"},
  {"imdb_id": "tt1205489", "title": "Gran Torino"},
  {"imdb_id": "tt0056801", "title": "8½"},
  {"imdb_id": "tt0361748", "title": "Inglourious Basterds"},
  {"imdb_id": "tt1255953", "title": "Incendies"},
  {"imdb_id": "tt0405422", "title": "The Prestige"},
  {"imdb_id": "tt0107048", "title": "Groundhog Day"},
  {"imdb_id": "tt2106476", "title": "Before Midnight"},
  {"imdb_id": "tt0117665", "title": "The Rock"},
  {"imdb_id": "tt0116629", "title": "Independence Day"},
  {"imdb_id": "tt0162222", "title": "Cast Away"},
  {"imdb_id": "tt0266308", "title": "The Butterfly Effect"},
  {"imdb_id": "tt0120601", "title": "Being John Malkovich"},
  {"imdb_id": "tt0382932", "title": "Ratatouille"},
  {"imdb_id": "tt0993846", "title": "The Wolf of Wall Street"},
  {"imdb_id": "tt0816692", "title": "Interstellar"},
  {"imdb_id": "tt1853728", "title": "Django Unchained"},
  {"imdb_id": "tt2380307", "title": "Coco"},
  {"imdb_id": "tt1345836", "title": "The Dark Knight Rises"},
  {"imdb_id": "tt0347149", "title": "Howl's Moving Castle"},
  {"imdb_id": "tt2096673", "title": "Inside Out"},
  {"imdb_id": "tt0892769", "title": "How to Train Your Dragon"},
  {"imdb_id": "tt1130884", "title": "Shutter Island"},
  {"imdb_id": "tt1675434", "title": "The Intouchables"},
  {"imdb_id": "tt0482571", "title": "The Prestige"},
  {"imdb_id": "tt1049413", "title": "Up"},
  {"imdb_id": "tt1187043", "title": "3 Idiots"},
  {"imdb_id": "tt1291584", "title": "Warrior"},
  {"imdb_id": "tt0758758", "title": "Into the Wild"},
  {"imdb_id": "tt1201607", "title": "Harry Potter and the Deathly Hallows: Part 2"},
  {"imdb_id": "tt0765443", "title": "Children of Men"},
  {"imdb_id": "tt1392190", "title": "Mad Max: Fury Road"},
  {"imdb_id": "tt4633694", "title": "Spider-Man: Into the Spider-Verse"},
  {"imdb_id": "tt6751668", "title": "Parasite"},
  {"imdb_id": "tt1856101", "title": "Blade Runner 2049"},
  {"imdb_id": "tt4154796", "title": "Avengers: Endgame"},
  {"imdb_id": "tt5311514", "title": "Your Name"},
  {"imdb_id": "tt7286456", "title": "Joker"},
  {"imdb_id": "tt1302006", "title": "The Irishman"},
  {"imdb_id": "tt6710474", "title": "Everything Everywhere All at Once"},
  {"imdb_id": "tt10872600", "title": "Spider-Man: No Way Home"},
  {"imdb_id": "tt1160419", "title": "Dune"},
  {"imdb_id": "tt15398776", "title": "Oppenheimer"},
  {"imdb_id": "tt14230458", "title": "Barbie"},
  {"imdb_id": "tt11138512", "title": "The Northman"},
  {"imdb_id": "tt1877830", "title": "The Batman"},
  {"imdb_id": "tt1745960", "title": "Top Gun: Maverick"},
  {"imdb_id": "tt9764362", "title": "The Menu"},
  {"imdb_id": "tt11867850", "title": "Glass Onion: A Knives Out Mystery"},
  {"imdb_id": "tt15239678", "title": "Dune: Part Two"},
  {"imdb_id": "tt14444726", "title": "Killers of the Flower Moon"},
  {"imdb_id": "tt4154756", "title": "Avengers: Infinity War"},
  {"imdb_id": "tt0848228", "title": "The Avengers"},
  {"imdb_id": "tt0145487", "title": "Spider-Man"},
  {"imdb_id": "tt0371746", "title": "Iron Man"},
  {"imdb_id": "tt1843866", "title": "Captain America: The Winter Soldier"},
  {"imdb_id": "tt3498820", "title": "Captain America: Civil War"},
  {"imdb_id": "tt3896198", "title": "Guardians of the Galaxy Vol. 2"},
  {"imdb_id": "tt2015381", "title": "Guardians of the Galaxy"},
  {"imdb_id": "tt0482571", "title": "The Prestige"},
  {"imdb_id": "tt1170358", "title": "The Hobbit: An Unexpected Journey"},
  {"imdb_id": "tt1392214", "title": "Prisoners"},
  {"imdb_id": "tt1454468", "title": "Gravity"},
  {"imdb_id": "tt0816711", "title": "World War Z"},
  {"imdb_id": "tt2293640", "title": "Minions"},
  {"imdb_id": "tt1285016", "title": "The Social Network"},
  {"imdb_id": "tt0910970", "title": "WALL-E"},
  {"imdb_id": "tt0325980", "title": "Pirates of the Caribbean: The Curse of the Black Pearl"},
  {"imdb_id": "tt0449088", "title": "Pirates of the Caribbean: At World's End"},
  {"imdb_id": "tt0383574", "title": "Pirates of the Caribbean: Dead Man's Chest"},
  {"imdb_id": "tt1298650", "title": "Pirates of the Caribbean: On Stranger Tides"},
  {"imdb_id": "tt1790809", "title": "Ted"},
  {"imdb_id": "tt1605783", "title": "Midnight in Paris"},
  {"imdb_id": "tt1663202", "title": "The Revenant"},
  {"imdb_id": "tt2267998", "title": "Gone Girl"},
  {"imdb_id": "tt1424432", "title": "Zootopia"},
  {"imdb_id": "tt2488496", "title": "Star Wars: The Force Awakens"},
  {"imdb_id": "tt2527336", "title": "Star Wars: The Last Jedi"},
  {"imdb_id": "tt2527338", "title": "Star Wars: The Rise of Skywalker"},
  {"imdb_id": "tt3315342", "title": "Logan"},
  {"imdb_id": "tt1825683", "title": "Black Panther"},
  {"imdb_id": "tt5463162", "title": "Deadpool 2"},
  {"imdb_id": "tt1431045", "title": "Deadpool"},
  {"imdb_id": "tt3385516", "title": "X-Men: Apocalypse"},
  {"imdb_id": "tt1877832", "title": "X-Men: Days of Future Past"},
  {"imdb_id": "tt4550098", "title": "Thor: Ragnarok"},
  {"imdb_id": "tt3501632", "title": "Thor: Ragnarok"},
  {"imdb_id": "tt2395427", "title": "Avengers: Age of Ultron"},
  {"imdb_id": "tt1300854", "title": "Iron Man 3"},
  {"imdb_id": "tt1228705", "title": "Iron Man 2"},
  {"imdb_id": "tt0800369", "title": "Thor"},
  {"imdb_id": "tt0800080", "title": "The Incredible Hulk"},
  {"imdb_id": "tt0458339", "title": "Captain America: The First Avenger"},
  {"imdb_id": "tt3896198", "title": "Guardians of the Galaxy Vol. 2"},
  {"imdb_id": "tt0478970", "title": "Ant-Man"},
  {"imdb_id": "tt3501632", "title": "Thor: Ragnarok"},
  {"imdb_id": "tt1270797", "title": "Venom"},
  {"imdb_id": "tt9376612", "title": "Shang-Chi and the Legend of the Ten Rings"},
  {"imdb_id": "tt9032400", "title": "Eternals"},
  {"imdb_id": "tt10648342", "title": "Thor: Love and Thunder"},
  {"imdb_id": "tt9419884", "title": "Doctor Strange in the Multiverse of Madness"},
  {"imdb_id": "tt9362722", "title": "Spider-Man: Across the Spider-Verse"},
  {"imdb_id": "tt6718170", "title": "The Super Mario Bros. Movie"},
  {"imdb_id": "tt10954600", "title": "Ant-Man and the Wasp: Quantumania"},
  {"imdb_id": "tt11291274", "title": "Nope"},
  {"imdb_id": "tt11389748", "title": "Asteroid City"},
  {"imdb_id": "tt10298810", "title": "The Fabelmans"},
  {"imdb_id": "tt14208870", "title": "The Banshees of Inisherin"},
  {"imdb_id": "tt11866324", "title": "The Woman King"},
  {"imdb_id": "tt11116912", "title": "Tár"},
  {"imdb_id": "tt13320622", "title": "Triangle of Sadness"},
  {"imdb_id": "tt0167261", "title": "The Lord of the Rings: The Return of the King"},
  {"imdb_id": "tt0264464", "title": "Catch Me If You Can"},
]
*/

async function main() {
  try {
    // Step 1: Load movie library from movies_input.json
    const inputPath = path.join(__dirname, '../data/movies_input.json')
    let movieLibrary: any[] = []
    try {
      const inputData = await fs.readFile(inputPath, 'utf-8')
      const parsed = JSON.parse(inputData)
      movieLibrary = parsed.movies || parsed // Support both {movies: [...]} and [...]
      console.log(`📚 Movie library: ${movieLibrary.length} movies available\n`)
    } catch (error) {
      console.error('❌ Failed to load movies_input.json')
      console.error('💡 Make sure data/movies_input.json exists with your movie library')
      console.error('   Use movies_input_500.json as a template\n')
      process.exit(1)
    }

    // Step 2: Load current database
    const enrichedPath = path.join(__dirname, '../data/movies_enriched.json')
    let existingMovies: any[] = []
    try {
      const data = await fs.readFile(enrichedPath, 'utf-8')
      const parsed = JSON.parse(data)
      existingMovies = parsed.movies || parsed // Support both {movies: [...]} and [...]
      console.log(`📂 Current database: ${existingMovies.length} movies\n`)
    } catch {
      console.log(`📂 No existing database found - starting fresh\n`)
    }

    // Step 3: Find movies not yet in database
    const existingIds = new Set(existingMovies.map((m: any) => m.imdb_id))
    const availableMovies = movieLibrary.filter((m: any) => !existingIds.has(m.imdb_id))

    if (availableMovies.length === 0) {
      console.log('🎉 Congratulations! All movies in the library are already in your database!')
      console.log(`💡 Add more movies to data/movies_input.json to expand your library\n`)
      process.exit(0)
    }

    console.log(`🔍 Found ${availableMovies.length} new movies available to fetch`)

    // Step 4: Select movies to fetch (limit by target count)
    const moviesToFetch = availableMovies.slice(0, targetCount)
    console.log(`🎯 Will fetch ${moviesToFetch.length} movies (requested: ${targetCount})\n`)

    if (moviesToFetch.length === 0) {
      console.log('⚠️  No new movies to fetch!\n')
      process.exit(0)
    }

    // Step 5: Create temporary input file for the fetcher
    // (fetchMoviesAuto.ts expects an array of movies)
    const tempInputPath = path.join(__dirname, '../data/movies_to_fetch_temp.json')
    await fs.writeFile(tempInputPath, JSON.stringify(moviesToFetch, null, 2))
    console.log(`📝 Created temporary fetch list\n`)

    // Step 6: Run the fetcher
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🚀 Starting automated fetch...\n')

    try {
      execSync('tsx scripts/fetchMoviesAuto.ts', {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
        env: {
          ...process.env,
          INPUT_FILE: 'data/movies_to_fetch_temp.json' // Use relative path, not absolute
        }
      })
    } catch (error) {
      console.error('\n❌ Error during fetch:', error)
      // Clean up temp file
      try { await fs.unlink(tempInputPath) } catch {}
      process.exit(1)
    }

    // Clean up temp file
    try {
      await fs.unlink(tempInputPath)
      console.log(`🧹 Cleaned up temporary files\n`)
    } catch {}

    // Step 7: Verify the enriched file (no copy needed - fetchMoviesAuto writes directly)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📦 Verifying enriched database...\n')

    try {
      const finalData = JSON.parse(await fs.readFile(enrichedPath, 'utf-8'))
      console.log(`✅ Database contains ${finalData.length} movies\n`)
    } catch (error) {
      console.error('❌ Error reading database:', error)
      process.exit(1)
    }

    // Step 6.5: Clean duplicate locations
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔧 Cleaning duplicate locations...\n')

    try {
      execSync('npm run clean:duplicates', {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit'
      })
    } catch (error) {
      console.error('\n❌ Error during deduplication:', error)
      process.exit(1)
    }

    // Step 7: Transform to GeoJSON
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🗺️  Transforming to GeoJSON...\n')

    try {
      execSync('npm run transform:geojson', {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit'
      })
    } catch (error) {
      console.error('\n❌ Error during transform:', error)
      process.exit(1)
    }

    // Step 8: Download and optimize posters
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🖼️  Downloading and optimizing posters...\n')

    try {
      execSync('tsx scripts/downloadPosters.ts', {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit'
      })
    } catch (error) {
      console.error('\n❌ Error during poster download:', error)
      process.exit(1)
    }

    // Step 9: Re-transform to GeoJSON with local poster paths
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔄 Re-transforming GeoJSON with local posters...\n')

    try {
      execSync('npm run transform:geojson', {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit'
      })
    } catch (error) {
      console.error('\n❌ Error during re-transform:', error)
      process.exit(1)
    }

    // Step 10: Success!
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('\n🎉 SUCCESS! Everything is ready!')
    console.log('\n📊 Next steps:')
    console.log('   1. Restart your dev server: npm run dev')
    console.log('   2. Open the app and see your new movies on the globe! 🌍')
    console.log('   3. All posters are now cached locally in WebP format! ⚡\n')

  } catch (error) {
    console.error('\n💥 Fatal error:', error)
    process.exit(1)
  }
}

main()
