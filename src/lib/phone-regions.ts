import { haversine } from "./geo";
import type { GeoPoint } from "./types";

/**
 * Portuguese landline area codes (first digits of 2xx xxx xxx numbers) and the town they are centred on.
 * Mobile numbers (9x) carry no location.
 */
const AREA_CODES: Record<string, [string, number, number]> = {
  "21": ["Lisboa", 38.72, -9.14],
  "22": ["Porto", 41.15, -8.61],
  "231": ["Mealhada", 40.38, -8.45],
  "232": ["Viseu", 40.66, -7.91],
  "233": ["Figueira da Foz", 40.15, -8.86],
  "234": ["Aveiro", 40.64, -8.65],
  "235": ["Arganil", 40.22, -8.05],
  "236": ["Pombal", 39.92, -8.63],
  "238": ["Seia", 40.42, -7.71],
  "239": ["Coimbra", 40.21, -8.43],
  "241": ["Abrantes", 39.46, -8.2],
  "242": ["Ponte de Sor", 39.25, -8.01],
  "243": ["Santarém", 39.24, -8.69],
  "244": ["Leiria", 39.74, -8.81],
  "245": ["Portalegre", 39.29, -7.43],
  "249": ["Torres Novas", 39.48, -8.54],
  "251": ["Valença", 42.03, -8.63],
  "252": ["V. N. de Famalicão", 41.41, -8.52],
  "253": ["Braga", 41.55, -8.42],
  "254": ["Peso da Régua", 41.16, -7.79],
  "255": ["Penafiel", 41.21, -8.28],
  "256": ["S. João da Madeira", 40.9, -8.49],
  "258": ["Viana do Castelo", 41.69, -8.83],
  "259": ["Vila Real", 41.3, -7.74],
  "261": ["Torres Vedras", 39.09, -9.26],
  "262": ["Caldas da Rainha", 39.4, -9.14],
  "263": ["Vila Franca de Xira", 38.95, -8.99],
  "265": ["Setúbal", 38.52, -8.89],
  "266": ["Évora", 38.57, -7.91],
  "268": ["Estremoz", 38.84, -7.59],
  "269": ["Santiago do Cacém", 38.02, -8.69],
  "271": ["Guarda", 40.54, -7.27],
  "272": ["Castelo Branco", 39.82, -7.49],
  "273": ["Bragança", 41.81, -6.76],
  "274": ["Proença-a-Nova", 39.75, -7.92],
  "275": ["Covilhã", 40.28, -7.5],
  "276": ["Chaves", 41.74, -7.47],
  "277": ["Idanha-a-Nova", 39.92, -7.24],
  "278": ["Mirandela", 41.49, -7.18],
  "279": ["Torre de Moncorvo", 41.17, -7.05],
  "281": ["Tavira", 37.13, -7.65],
  "282": ["Portimão", 37.14, -8.54],
  "283": ["Odemira", 37.6, -8.64],
  "284": ["Beja", 38.02, -7.86],
  "285": ["Moura", 38.14, -7.45],
  "286": ["Castro Verde", 37.7, -8.08],
  "289": ["Faro", 37.02, -7.93],
  "291": ["Funchal", 32.65, -16.91],
  "292": ["Horta", 38.54, -28.63],
  "295": ["Angra do Heroísmo", 38.65, -27.22],
  "296": ["Ponta Delgada", 37.74, -25.67],
};

/** Area codes cover whole districts: anything closer than this is considered "the same area". */
export const SAME_AREA_KM = 55;

export interface PhoneArea {
  code: string;
  town: string;
  point: GeoPoint;
}

/** Area of a Portuguese landline (any format), or null for mobiles / foreign numbers. */
export function phoneArea(phone: string): PhoneArea | null {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00351")) d = d.slice(5);
  else if (d.startsWith("351") && d.length === 12) d = d.slice(3);
  if (d.length !== 9 || !d.startsWith("2")) return null;
  const code = AREA_CODES[d.slice(0, 2)] ? d.slice(0, 2) : d.slice(0, 3);
  const entry = AREA_CODES[code];
  return entry ? { code, town: entry[0], point: { lat: entry[1], lon: entry[2] } } : null;
}

export function areaDistanceKm(area: PhoneArea, p: GeoPoint): number {
  return haversine(area.point, p) / 1000;
}
