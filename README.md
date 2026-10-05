# LeadGen Portugal

Générateur de leads pour web designers / agences : choisissez **un lieu au Portugal** et **un rayon**, l'app liste
**tous les commerces** de la zone, indique **ceux qui n'ont pas de site web** (ou seulement une page Facebook /
Instagram) et **analyse automatiquement les sites existants** pour repérer ceux **à refaire** ou **améliorables**.

## Fonctionnalités

- 🔎 **Recherche par lieu + rayon** (100 m → 10 km) : ville, quartier, adresse ou coordonnées `38.72,-9.14`,
  ou clic directement sur la carte.
- 🏪 **7 familles de commerces** : restauration, commerces, hébergement, santé & beauté, services & artisans,
  auto & moto, loisirs. Option pour **exclure les chaînes** (Pingo Doce, McDonald's, Galp…).
- 🌐 **Statut du site web** pour chaque commerce :
  | Statut | Signification | Opportunité |
  | --- | --- | --- |
  | **Sans site** | aucun site connu | 🔥 Chaud |
  | **Réseaux seulement** | uniquement Facebook, Instagram, TripAdvisor, ancien site Google Business… | 🔥 Chaud |
  | **À refaire** | site hors ligne, domaine expiré, en construction, non adapté au mobile, très daté… | 🔥 Chaud |
  | **Améliorable** | site correct mais avec des manques (SEO, HTTPS, lenteur, contact…) | ♨️ Tiède |
  | **Correct** | site moderne | ❄️ Froid |
  | **Non analysable** | site protégé contre les robots (Cloudflare…) : à vérifier à la main | ? |
- 🩺 **Audit de site (score /100)** : HTTPS et certificat, adaptation mobile, technologies obsolètes (Flash, frames),
  année du copyright, HTML ancien (`<font>`, tableaux), temps de réponse, contenu, titre / meta description / H1,
  contact en un clic, sous-domaine gratuit (Wix, Jimdo…), CMS ou jQuery obsolètes, Open Graph, schema.org…
  Détection des domaines **parqués / à vendre** et des pages **« em construção »**.
- 📇 **Contacts** : téléphone, email, réseaux sociaux (depuis la fiche + extraits du site), lien WhatsApp pour les
  mobiles portugais.
- ⚡ **Google PageSpeed (mobile)** à la demande dans la fiche d'un commerce.
- ✉️ **Message d'approche en portugais** généré à partir des problèmes détectés (copier / envoyer par email).
- 🗺️ **Carte** avec les commerces colorés par statut, filtres, tri par opportunité.
- 📤 **Export CSV** (séparateur `;`, s'ouvre directement dans Excel).
- 💾 La dernière recherche est conservée dans le navigateur.

## Démarrage

Prérequis : Node.js 20+.

```bash
npm install
cp .env.example .env.local   # optionnel
npm run dev
```

Puis ouvrez <http://localhost:3000>.

## Sources de données

| Source | Coût | Remarques |
| --- | --- | --- |
| **OpenStreetMap** (Nominatim + Overpass) | Gratuit, sans clé | Très bonne couverture des commerces, mais le champ « site web » est souvent incomplet : un commerce « sans site » dans OSM peut en avoir un. Utilisez le bouton **Vérifier sur Google** de la fiche avant de démarcher. |
| **Google Places API (New)** | Payant (quota gratuit mensuel) | Bien plus fiable pour les sites web, téléphones, notes et avis. Activez *Places API (New)* dans Google Cloud et mettez la clé dans `GOOGLE_PLACES_API_KEY`. |

Avec Google, l'API renvoie 20 lieux maximum par requête : l'app découpe automatiquement les zones denses en
sous-zones. Le nombre de requêtes par recherche est plafonné par `GOOGLE_MAX_REQUESTS` (60 par défaut) pour
maîtriser la facture — chaque requête « Nearby Search » avec site web et téléphone est facturée au tarif *Enterprise*
de Google, consultez leur grille tarifaire.

## Variables d'environnement

Voir [`.env.example`](.env.example). Toutes sont optionnelles.

| Variable | Rôle |
| --- | --- |
| `GOOGLE_PLACES_API_KEY` | Active la source Google Places |
| `GOOGLE_MAX_REQUESTS` | Plafond de requêtes Google par recherche (défaut 60) |
| `PAGESPEED_API_KEY` | Clé PageSpeed Insights (sans clé, le quota partagé est souvent épuisé) |
| `OVERPASS_URLS` | Serveurs Overpass à utiliser (séparés par des virgules) |
| `NOMINATIM_URL` | Serveur Nominatim |
| `LEADGEN_USER_AGENT` | User-Agent envoyé à OpenStreetMap (mettez-y votre email de contact) |

## Comment le score est calculé

Chaque site part de 100 points ; chaque problème retire des points selon sa gravité
(critique : −20 à −30, important : −5 à −15, mineur : −2 à −4). Le verdict :

- **À refaire** : score < 50, ou site non adapté au mobile **et** au design daté, ou site hors ligne / parqué / en
  erreur / domaine introuvable / certificat invalide ;
- **Améliorable** : score entre 50 et 79 ;
- **Correct** : score ≥ 80.

Le code de l'audit est dans [`src/lib/audit/analyze.ts`](src/lib/audit/analyze.ts) : facile à ajuster.

## Structure

```
src/
  app/
    page.tsx                 # interface
    api/geocode/route.ts     # lieu → coordonnées (Nominatim, limité au Portugal)
    api/places/route.ts      # commerces dans le rayon (OSM ou Google)
    api/audit/route.ts       # audit d'un site web
    api/pagespeed/route.ts   # Google PageSpeed Insights
  components/                # LeadFinder (état), SearchPanel, MapView (Leaflet), LeadsTable, LeadDrawer
  lib/
    providers/               # nominatim, overpass, google
    audit/                   # safe-fetch (anti-SSRF), analyze (règles), pagespeed
    categories.ts            # familles de commerces ↔ tags OSM / types Google
    leads.ts, csv.ts, pitch.ts
```

## Scripts

```bash
npm run dev        # développement
npm run build      # build de production
npm start          # serveur de production
npm test           # tests unitaires (Vitest)
npm run lint       # ESLint
npm run typecheck  # TypeScript
```

## Bon usage

- Les serveurs publics OpenStreetMap sont gratuits mais partagés : évitez les rayons énormes en rafale
  (les résultats sont mis en cache 30 min côté serveur).
- Prospection : au Portugal comme dans toute l'UE, le RGPD s'applique aux emails nominatifs. Privilégiez les
  contacts professionnels génériques, présentez-vous clairement et proposez toujours de ne plus être recontacté.
