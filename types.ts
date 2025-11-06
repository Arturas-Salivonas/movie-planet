/**
 * CineMap - Canonical Data Model
 * TypeScript interfaces for movies, locations, actors, and GeoJSON features
 */

/**
 * Geographic point with latitude and longitude
 */
export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

/**
 * Filming location with geographic coordinates and context
 */
export interface Location {
  readonly lat: number;
  readonly lng: number;
  readonly city: string;
  readonly country: string;
  readonly scene_description?: string;
  readonly start_date?: string; // ISO 8601 date format (YYYY-MM-DD)
  readonly end_date?: string; // ISO 8601 date format (YYYY-MM-DD)
}

/**
 * Streaming platform availability
 */
export interface StreamingPlatform {
  readonly platform: string;
  readonly url?: string;
  readonly region?: string;
}

/**
 * Movie entity with metadata and filming locations
 */
export interface Movie {
  readonly id: string;
  readonly title: string;
  readonly year: number;
  readonly tmdb_id?: number;
  readonly imdb_id?: string;
  readonly genres: readonly string[];
  readonly poster_url?: string;
  readonly trailer_url?: string;
  readonly streaming?: readonly StreamingPlatform[];
  readonly rating?: number; // 0-10 scale
  readonly runtime?: number; // minutes
  readonly director?: string;
  readonly cast?: readonly string[]; // Actor IDs
  readonly locations: readonly Location[];
  readonly trivia?: string;
  readonly synopsis?: string;
}

/**
 * Actor/Performer entity
 */
export interface Actor {
  readonly id: string;
  readonly name: string;
  readonly dob?: string; // ISO 8601 date format (YYYY-MM-DD)
  readonly birth_place?: {
    readonly city?: string;
    readonly country?: string;
    readonly lat?: number;
    readonly lng?: number;
  };
  readonly known_for?: readonly string[]; // Movie IDs
  readonly photo_url?: string;
}

/**
 * GeoJSON Feature for a single movie location
 * Compatible with Mapbox GL JS
 */
export interface MovieGeoFeature {
  readonly type: "Feature";
  readonly geometry: {
    readonly type: "Point";
    readonly coordinates: readonly [number, number]; // [lng, lat] - GeoJSON order!
  };
  readonly properties: {
    readonly movie_id: string;
    readonly movie_title: string;
    readonly year: number;
    readonly city: string;
    readonly country: string;
    readonly scene_description?: string;
    readonly poster_url?: string;
    readonly rating?: number;
    readonly genres?: readonly string[];
  };
}

/**
 * GeoJSON FeatureCollection for multiple movie locations
 * Ready to use with Mapbox GL JS
 */
export interface MovieGeoFeatureCollection {
  readonly type: "FeatureCollection";
  readonly features: readonly MovieGeoFeature[];
}

/**
 * Helper function to convert a Movie to multiple GeoJSON Features
 * (one feature per filming location)
 */
export function movieToGeoFeatures(movie: Movie): MovieGeoFeature[] {
  return movie.locations.map((location) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [location.lng, location.lat] as const, // GeoJSON uses [lng, lat]
    },
    properties: {
      movie_id: movie.id,
      movie_title: movie.title,
      year: movie.year,
      city: location.city,
      country: location.country,
      scene_description: location.scene_description,
      poster_url: movie.poster_url,
      rating: movie.rating,
      genres: movie.genres,
    },
  }));
}

/**
 * Convert an array of movies to a GeoJSON FeatureCollection
 */
export function moviesToGeoJSON(movies: readonly Movie[]): MovieGeoFeatureCollection {
  const features = movies.flatMap(movieToGeoFeatures);
  return {
    type: "FeatureCollection",
    features,
  };
}
