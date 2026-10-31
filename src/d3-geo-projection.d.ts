// d3-geo-projection ships without types; these are the projections the map offers.
declare module "d3-geo-projection" {
  import type { GeoProjection } from "d3-geo";
  export function geoCylindricalEqualArea(): GeoProjection & { parallel(degrees: number): GeoProjection };
  export function geoEckert4(): GeoProjection;
  export function geoMiller(): GeoProjection;
  export function geoMollweide(): GeoProjection;
  export function geoRobinson(): GeoProjection;
  export function geoWinkel3(): GeoProjection;
}
