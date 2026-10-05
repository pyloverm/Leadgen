import type { CategoryGroupId } from "./types";

export interface CategoryGroup {
  id: CategoryGroupId;
  label: string;
  emoji: string;
  /** Overpass QL tag filters; each one becomes a `nwr(around…)` clause. */
  osm: string[];
}

const FOOD_AMENITIES = [
  "restaurant",
  "cafe",
  "bar",
  "pub",
  "fast_food",
  "ice_cream",
  "biergarten",
  "food_court",
];
const LODGING_TOURISM = [
  "hotel",
  "guest_house",
  "hostel",
  "motel",
  "apartment",
  "chalet",
  "camp_site",
  "caravan_site",
];
const AUTO_SHOPS = ["car", "car_repair", "car_parts", "tyres", "motorcycle", "motorcycle_repair"];
const AUTO_AMENITIES = ["car_wash", "car_rental", "fuel", "vehicle_inspection", "motorcycle_rental"];
const BEAUTY_SHOPS = [
  "hairdresser",
  "beauty",
  "cosmetics",
  "massage",
  "tattoo",
  "optician",
  "hearing_aids",
  "medical_supply",
  "nutrition_supplements",
];
const HEALTH_AMENITIES = ["pharmacy", "dentist", "doctors", "clinic", "veterinary"];
const LEISURE_VALUES = [
  "fitness_centre",
  "dance",
  "escape_game",
  "bowling_alley",
  "amusement_arcade",
  "sports_centre",
  "marina",
  "golf_course",
  "horse_riding",
  "water_park",
];
const LEISURE_AMENITIES = ["nightclub", "cinema", "theatre", "arts_centre", "casino"];
const SERVICE_AMENITIES = ["driving_school", "language_school", "music_school", "dancing_school", "childcare"];
const SERVICE_SHOPS = ["travel_agency", "laundry", "dry_cleaning", "funeral_directors", "copyshop"];

const re = (values: string[]) => `^(${values.join("|")})$`;

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: "food",
    label: "Restauration",
    emoji: "🍽️",
    osm: [`["amenity"~"${re(FOOD_AMENITIES)}"]`, `["shop"~"^(bakery|pastry|confectionery)$"]`],
  },
  {
    id: "shops",
    label: "Commerces",
    emoji: "🛍️",
    osm: [`["shop"]`],
  },
  {
    id: "lodging",
    label: "Hébergement",
    emoji: "🏨",
    osm: [`["tourism"~"${re(LODGING_TOURISM)}"]`],
  },
  {
    id: "health_beauty",
    label: "Santé & beauté",
    emoji: "💇",
    osm: [
      `["shop"~"${re(BEAUTY_SHOPS)}"]`,
      `["amenity"~"${re(HEALTH_AMENITIES)}"]`,
      `["healthcare"]`,
      `["leisure"="fitness_centre"]`,
    ],
  },
  {
    id: "services",
    label: "Services & artisans",
    emoji: "🛠️",
    osm: [
      `["office"]`,
      `["craft"]`,
      `["amenity"~"${re(SERVICE_AMENITIES)}"]`,
      `["shop"~"${re(SERVICE_SHOPS)}"]`,
    ],
  },
  {
    id: "auto",
    label: "Auto & moto",
    emoji: "🚗",
    osm: [`["shop"~"${re(AUTO_SHOPS)}"]`, `["amenity"~"${re(AUTO_AMENITIES)}"]`],
  },
  {
    id: "leisure",
    label: "Loisirs & sorties",
    emoji: "🎳",
    osm: [`["leisure"~"${re(LEISURE_VALUES)}"]`, `["amenity"~"${re(LEISURE_AMENITIES)}"]`],
  },
];

export const ALL_GROUP_IDS = CATEGORY_GROUPS.map((g) => g.id);

export function getGroup(id: CategoryGroupId): CategoryGroup {
  const group = CATEGORY_GROUPS.find((g) => g.id === id);
  if (!group) throw new Error(`Unknown category group: ${id}`);
  return group;
}

const LABELS: Record<string, string> = {
  // food
  restaurant: "Restaurant",
  cafe: "Café",
  bar: "Bar",
  pub: "Pub",
  fast_food: "Fast-food",
  ice_cream: "Glacier",
  biergarten: "Brasserie",
  food_court: "Aire de restauration",
  bakery: "Boulangerie / pâtisserie",
  pastry: "Pâtisserie",
  confectionery: "Confiserie",
  // lodging
  hotel: "Hôtel",
  guest_house: "Maison d'hôtes",
  hostel: "Auberge de jeunesse",
  motel: "Motel",
  apartment: "Location d'appartements",
  chalet: "Chalet / gîte",
  camp_site: "Camping",
  caravan_site: "Aire camping-car",
  // shops
  supermarket: "Supermarché",
  convenience: "Épicerie",
  greengrocer: "Primeur",
  butcher: "Boucherie",
  seafood: "Poissonnerie",
  wine: "Caviste",
  alcohol: "Vins & spiritueux",
  clothes: "Vêtements",
  shoes: "Chaussures",
  jewelry: "Bijouterie",
  florist: "Fleuriste",
  furniture: "Meubles",
  hardware: "Quincaillerie",
  doityourself: "Bricolage",
  electronics: "Électronique",
  mobile_phone: "Téléphonie",
  computer: "Informatique",
  books: "Librairie",
  stationery: "Papeterie",
  gift: "Cadeaux / souvenirs",
  souvenir: "Souvenirs",
  pet: "Animalerie",
  bicycle: "Vélos",
  sports: "Articles de sport",
  toys: "Jouets",
  kiosk: "Kiosque",
  newsagent: "Presse / tabac",
  tobacco: "Tabac",
  department_store: "Grand magasin",
  variety_store: "Bazar",
  interior_decoration: "Décoration",
  art: "Galerie / art",
  photo: "Photographe",
  tailor: "Couturier",
  deli: "Épicerie fine",
  chemist: "Droguerie",
  perfumery: "Parfumerie",
  bag: "Maroquinerie",
  boutique: "Boutique",
  surf: "Surf shop",
  outdoor: "Outdoor",
  // health & beauty
  hairdresser: "Coiffeur",
  beauty: "Institut de beauté",
  cosmetics: "Cosmétiques",
  massage: "Massage",
  tattoo: "Tatoueur",
  optician: "Opticien",
  hearing_aids: "Audioprothésiste",
  medical_supply: "Matériel médical",
  nutrition_supplements: "Compléments alimentaires",
  pharmacy: "Pharmacie",
  dentist: "Dentiste",
  doctors: "Médecin",
  clinic: "Clinique",
  veterinary: "Vétérinaire",
  physiotherapist: "Kinésithérapeute",
  fitness_centre: "Salle de sport",
  // auto
  car: "Concession auto",
  car_repair: "Garage",
  car_parts: "Pièces auto",
  tyres: "Pneus",
  motorcycle: "Moto",
  motorcycle_repair: "Garage moto",
  car_wash: "Lavage auto",
  car_rental: "Location de voitures",
  motorcycle_rental: "Location de motos",
  fuel: "Station-service",
  vehicle_inspection: "Contrôle technique",
  // leisure
  dance: "École de danse",
  escape_game: "Escape game",
  bowling_alley: "Bowling",
  amusement_arcade: "Salle de jeux",
  sports_centre: "Centre sportif",
  marina: "Marina",
  golf_course: "Golf",
  horse_riding: "Équitation",
  water_park: "Parc aquatique",
  nightclub: "Discothèque",
  cinema: "Cinéma",
  theatre: "Théâtre",
  arts_centre: "Centre culturel",
  casino: "Casino",
  // services
  driving_school: "Auto-école",
  language_school: "École de langues",
  music_school: "École de musique",
  dancing_school: "École de danse",
  childcare: "Garde d'enfants",
  travel_agency: "Agence de voyages",
  travel_agent: "Agence de voyages",
  laundry: "Laverie",
  dry_cleaning: "Pressing",
  funeral_directors: "Pompes funèbres",
  copyshop: "Reprographie",
  estate_agent: "Agence immobilière",
  lawyer: "Avocat",
  accountant: "Comptable",
  insurance: "Assurances",
  architect: "Architecte",
  company: "Entreprise",
  it: "Informatique (services)",
  notary: "Notaire",
  tax_advisor: "Conseiller fiscal",
  employment_agency: "Agence d'emploi",
  carpenter: "Menuisier",
  electrician: "Électricien",
  plumber: "Plombier",
  painter: "Peintre",
  builder: "Maçon / BTP",
  roofer: "Couvreur",
  locksmith: "Serrurier",
  shoemaker: "Cordonnier",
  winery: "Domaine viticole",
  brewery: "Brasserie artisanale",
  handicraft: "Artisanat",
  photographer: "Photographe",
};

function prettify(value: string): string {
  const s = value.replace(/[_;]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function labelFor(value: string): string {
  return LABELS[value] ?? prettify(value);
}

type Tags = Record<string, string | undefined>;

/**
 * Decide which category group an OSM element belongs to.
 * Returns null for things that are not a prospectable business.
 */
export function classifyOsm(tags: Tags): { group: CategoryGroupId; value: string } | null {
  const { amenity, shop, tourism, leisure, office, craft, healthcare } = tags;

  if (shop === "vacant" || shop === "no") return null;
  if (amenity && FOOD_AMENITIES.includes(amenity)) return { group: "food", value: amenity };
  if (shop && ["bakery", "pastry", "confectionery"].includes(shop)) return { group: "food", value: shop };
  if (tourism && LODGING_TOURISM.includes(tourism)) return { group: "lodging", value: tourism };
  if (shop && AUTO_SHOPS.includes(shop)) return { group: "auto", value: shop };
  if (amenity && AUTO_AMENITIES.includes(amenity)) return { group: "auto", value: amenity };
  if (shop && BEAUTY_SHOPS.includes(shop)) return { group: "health_beauty", value: shop };
  if (amenity && HEALTH_AMENITIES.includes(amenity)) return { group: "health_beauty", value: amenity };
  if (healthcare) return { group: "health_beauty", value: healthcare };
  if (leisure === "fitness_centre") return { group: "health_beauty", value: leisure };
  if (leisure && LEISURE_VALUES.includes(leisure)) return { group: "leisure", value: leisure };
  if (amenity && LEISURE_AMENITIES.includes(amenity)) return { group: "leisure", value: amenity };
  if (amenity && SERVICE_AMENITIES.includes(amenity)) return { group: "services", value: amenity };
  if (shop && SERVICE_SHOPS.includes(shop)) return { group: "services", value: shop };
  if (office) return { group: "services", value: office === "yes" ? "company" : office };
  if (craft) return { group: "services", value: craft === "yes" ? "handicraft" : craft };
  if (shop) return { group: "shops", value: shop === "yes" ? "boutique" : shop };
  return null;
}
