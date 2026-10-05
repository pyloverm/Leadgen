import type { CategoryGroupId } from "./types";

export interface CategoryGroup {
  id: CategoryGroupId;
  label: string;
  emoji: string;
  /** Overpass QL tag filters; each one becomes a `nwr(around…)` clause. */
  osm: string[];
  /** Google Places (New) "Table A" types. */
  google: string[];
  /** Small, safe subset used if Google rejects one of the types above. */
  googleCore: string[];
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
    google: [
      "restaurant",
      "cafe",
      "bar",
      "bakery",
      "meal_takeaway",
      "ice_cream_shop",
      "coffee_shop",
      "pub",
      "wine_bar",
      "fast_food_restaurant",
    ],
    googleCore: ["restaurant", "cafe", "bar", "bakery", "meal_takeaway"],
  },
  {
    id: "shops",
    label: "Commerces",
    emoji: "🛍️",
    osm: [`["shop"]`],
    google: [
      "store",
      "clothing_store",
      "shoe_store",
      "jewelry_store",
      "furniture_store",
      "home_goods_store",
      "hardware_store",
      "electronics_store",
      "book_store",
      "florist",
      "pet_store",
      "bicycle_store",
      "convenience_store",
      "supermarket",
      "liquor_store",
      "cell_phone_store",
      "sporting_goods_store",
      "gift_shop",
      "grocery_store",
    ],
    googleCore: ["store", "clothing_store", "furniture_store", "hardware_store", "florist", "supermarket"],
  },
  {
    id: "lodging",
    label: "Hébergement",
    emoji: "🏨",
    osm: [`["tourism"~"${re(LODGING_TOURISM)}"]`],
    google: ["lodging", "hotel", "guest_house", "hostel", "bed_and_breakfast", "motel", "campground"],
    googleCore: ["lodging", "campground"],
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
    google: [
      "beauty_salon",
      "hair_care",
      "hair_salon",
      "nail_salon",
      "barber_shop",
      "spa",
      "gym",
      "fitness_center",
      "yoga_studio",
      "dentist",
      "dental_clinic",
      "doctor",
      "physiotherapist",
      "pharmacy",
      "veterinary_care",
    ],
    googleCore: ["beauty_salon", "hair_care", "spa", "gym", "dentist", "doctor", "physiotherapist", "pharmacy", "veterinary_care"],
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
    google: [
      "lawyer",
      "accounting",
      "real_estate_agency",
      "insurance_agency",
      "travel_agency",
      "electrician",
      "plumber",
      "painter",
      "roofing_contractor",
      "locksmith",
      "moving_company",
      "laundry",
      "general_contractor",
    ],
    googleCore: [
      "lawyer",
      "accounting",
      "real_estate_agency",
      "insurance_agency",
      "travel_agency",
      "electrician",
      "plumber",
      "painter",
      "locksmith",
      "laundry",
    ],
  },
  {
    id: "auto",
    label: "Auto & moto",
    emoji: "🚗",
    osm: [`["shop"~"${re(AUTO_SHOPS)}"]`, `["amenity"~"${re(AUTO_AMENITIES)}"]`],
    google: ["car_repair", "car_dealer", "car_wash", "car_rental", "gas_station"],
    googleCore: ["car_repair", "car_dealer", "car_wash", "car_rental", "gas_station"],
  },
  {
    id: "leisure",
    label: "Loisirs & sorties",
    emoji: "🎳",
    osm: [`["leisure"~"${re(LEISURE_VALUES)}"]`, `["amenity"~"${re(LEISURE_AMENITIES)}"]`],
    google: ["night_club", "bowling_alley", "art_gallery", "amusement_center", "golf_course", "movie_theater"],
    googleCore: ["night_club", "bowling_alley", "art_gallery", "movie_theater"],
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

/** Map a Google primary type to one of our groups (used when a place matches several requests). */
export function classifyGoogleType(type: string | undefined, fallback: CategoryGroupId): CategoryGroupId {
  if (!type) return fallback;
  for (const group of CATEGORY_GROUPS) {
    if (group.google.includes(type)) return group.id;
  }
  if (type.endsWith("_restaurant")) return "food";
  if (type.endsWith("_store") || type.endsWith("_shop")) return "shops";
  return fallback;
}
