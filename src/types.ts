/**
 * filmingmap - Type Definitions
 * Adapted to match the data schema from Stage 2
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
  readonly description?: string; // Scene description
}

/**
 * Movie entity with metadata and filming locations
 */
export interface Movie {
  readonly movie_id: string;
  readonly title: string;
  readonly original_title?: string; // Original title if different
  readonly year: number;
  readonly imdb_id: string;
  readonly tmdb_id: string;
  readonly type?: 'movie' | 'tv'; // Content type - movie or TV show
  readonly genres: readonly string[];
  readonly poster?: string;
  readonly trailer?: string;
  readonly streaming?: readonly string[];
  readonly imdb_rating?: number;
  readonly locations: readonly Location[];
  readonly trivia?: string;
}

/**
 * Actor/Performer entity
 */
export interface Actor {
  readonly actor_id: string;
  readonly name: string;
  readonly dob?: string;
  readonly birth_place?: {
    readonly city?: string;
    readonly country?: string;
    readonly lat?: number;
    readonly lng?: number;
  };
  readonly known_for?: readonly string[]; // Movie IDs
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
    readonly description?: string;
    readonly poster?: string;
    readonly imdb_rating?: number;
    readonly genres?: readonly string[];
  };
  readonly id?: string | number;
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
 * Search index entry for Fuse.js
 */
export interface SearchIndexEntry {
  readonly id: string;
  readonly title: string;
  readonly year: number;
  readonly genres: readonly string[];
  readonly actors?: readonly string[];
  readonly countries?: readonly string[];
  readonly cities?: readonly string[];
}

/**
 * Filter state
 */
export interface FilterState {
  genres: string[];
  decades: [number, number];
  streaming: string[];
}

/**
 * Map viewport state
 */
export interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
}
