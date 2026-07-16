import { sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

// city is either a bare city ("Lagos") or "Neighborhood, City" ("Yaba, Lagos").
// Same-city eligibility (offer fan-out, deal fan-out, discovery) should key off
// the trailing city segment only, so neighborhood-level detail doesn't break it.
export function getCanonicalCity(city: string): string {
  const parts = city.split(',');
  return parts[parts.length - 1].trim();
}

export function canonicalCityEq(column: PgColumn, city: string): SQL {
  return sql`lower(regexp_replace(${column}, '^.*,\s*', '')) = lower(${getCanonicalCity(city)})`;
}
