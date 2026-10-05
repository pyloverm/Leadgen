# LeadGen Portugal

Générateur de leads pour web designers / agences : choisissez **un lieu au Portugal** et **un rayon**, l'app liste
**tous les commerces** de la zone, indique **ceux qui n'ont pas de site web** (ou seulement une page Facebook /
Instagram) et **analyse automatiquement les sites existants** pour repérer ceux **à refaire** ou **améliorables**.

**100 % gratuit, aucune clé d'API**, aucun compte à créer.

## Fonctionnalités

- 🔎 **Recherche par lieu + rayon** (100 m → 10 km) : ville, quartier, adresse ou coordonnées `38.72,-9.14`,
  ou clic directement sur la carte.
- 🏪 **7 familles de commerces** : restauration, commerces, hébergement, santé & beauté, services & artisans,
  auto & moto, loisirs. Option pour **exclure les chaînes** (Pingo Doce, McDonald's, Galp…).
- 🕵️ **Recherche automatique des sites manquants** : OpenStreetMap ne connaît pas toujours le site d'un commerce,
  alors l'app le cherche elle-même :
  1. le **domaine de l'email pro** (`info@casasilva.pt` → `casasilva.pt`) ;
  2. des **noms de domaine devinés** à partir du nom (`opescador.pt`, `restauranteopescador.com`,
     `pescadorlagos.pt`…), testés en DNS ;
  3. chaque domaine actif est ouvert et **comparé au commerce** (même téléphone, nom dans le titre, même ville ou
     code postal) → confiance « élevée » ou « à confirmer ».
  Elle repère aussi les **domaines réservés au nom du commerce mais vides** : un argument de vente en or.
- 🌐 **Statut du site web** pour chaque commerce :
  | Statut | Signification |
  | --- | --- |
  | **Sans site** | aucun site, même après la recherche automatique |
  | **Réseaux seulement** | uniquement Facebook, Instagram, TripAdvisor, ancien site Google Business… |
  | **À refaire** | site hors ligne, domaine expiré, en construction, non adapté au mobile, très daté… |
  | **Améliorable** | site correct mais avec des manques (SEO, HTTPS, lenteur, images lourdes…) |
  | **Correct** | site moderne |
  | **Non analysable** | site protégé contre les robots (Cloudflare…) : à vérifier à la main |
- 🩺 **Audit de site (score /100)**, uniquement avec des requêtes HTTP classiques :
  - HTTPS et certificat, technologies obsolètes (Flash, frames), HTML ancien (`<font>`, tableaux) ;
  - **vrai test responsive** : balise viewport **et** lecture des feuilles CSS (règles `@media`, largeur fixe) ;
  - **poids réel des images** (WebP/AVIF ou pas) ;
  - **historique gratuit via l'Internet Archive** : « en ligne depuis 2009, page d'accueil identique depuis 2016 » ;
  - année du copyright, CMS / jQuery obsolètes (WordPress 4, Drupal 7, Joomla 3…), sous-domaine gratuit
    (Wix, Jimdo…), domaine parqué ou « em construção », titre / meta description / H1, contact en un clic…
- 🎯 **Score de potentiel 0–100** par commerce : situation du site, joignabilité (téléphone / email),
  valeur du secteur (hôtels, cliniques… > kiosques), chaînes pénalisées. Tri par défaut sur ce score.
- 📇 **Contacts** : téléphone, email, réseaux sociaux (fiche OSM + extraits du site), lien WhatsApp pour les
  mobiles portugais.
- ✉️ **Message d'approche en portugais** généré à partir des problèmes détectés (copier / envoyer par email).
- 🗺️ **Carte** colorée par statut, filtres, liens directs vers PageSpeed et la Wayback Machine.
- 📤 **Export CSV** (séparateur `;`, s'ouvre directement dans Excel).
- 💾 La dernière recherche est conservée dans le navigateur.

## Démarrage

Prérequis : Node.js 20+.

```bash
npm install
npm run dev
```

Puis ouvrez <http://localhost:3000>. C'est tout : aucune clé, aucun `.env` obligatoire.

## Sources (toutes gratuites)

| Source | Utilisation |
| --- | --- |
| **OpenStreetMap** — Nominatim | Trouver le lieu au Portugal |
| **OpenStreetMap** — Overpass | Lister les commerces du rayon (nom, catégorie, adresse, téléphone, email, site, réseaux) |
| **DNS** | Tester les noms de domaine devinés |
| **Les sites eux-mêmes** | Vérifier le site trouvé, l'auditer, lire ses CSS, mesurer ses images, extraire emails / téléphones |
| **Internet Archive** (Wayback Machine) | Âge du site et date de la dernière modification de la page d'accueil |

Les résultats sont mis en cache côté serveur (recherches 30 min, sites 6 h, découvertes et historiques 24 h) pour
ménager ces services gratuits.

## Variables d'environnement (optionnelles)

Voir [`.env.example`](.env.example) : uniquement des réglages avancés (serveurs OpenStreetMap à utiliser,
User-Agent).

## Comment le score est calculé

Chaque site part de 100 points ; chaque problème retire des points selon sa gravité
(critique : −20 à −30, important : −5 à −15, mineur : −2 à −4). Le verdict :

- **À refaire** : score < 50, ou site non adapté au mobile **et** daté (technos obsolètes, copyright ancien,
  page inchangée depuis des années), ou site hors ligne / parqué / en erreur / domaine introuvable / certificat
  invalide ;
- **Améliorable** : score entre 50 et 79 ;
- **Correct** : score ≥ 80.

Le code de l'audit est dans [`src/lib/audit/analyze.ts`](src/lib/audit/analyze.ts), celui de la recherche de sites
dans [`src/lib/discovery/`](src/lib/discovery) : faciles à ajuster.

## Structure

```
src/
  app/
    page.tsx                 # interface
    api/geocode/route.ts     # lieu → coordonnées (Nominatim, limité au Portugal)
    api/places/route.ts      # commerces dans le rayon (Overpass)
    api/discover/route.ts    # recherche du site d'un commerce (email, domaines devinés, vérification)
    api/audit/route.ts       # audit d'un site web
  components/                # LeadFinder (état + file de traitement), SearchPanel, MapView, LeadsTable, LeadDrawer
  lib/
    providers/               # nominatim, overpass
    discovery/               # candidates (domaines possibles), verify (est-ce bien ce commerce ?)
    audit/                   # safe-fetch (anti-SSRF), analyze (règles), assets (CSS, images), wayback
    categories.ts            # familles de commerces ↔ tags OSM
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

- OpenStreetMap et l'Internet Archive sont gratuits mais partagés : évitez les rayons énormes en rafale.
- Un site « trouvé – à confirmer » a le bon nom mais rien ne prouve encore que c'est le même établissement
  (ville ou téléphone absents de la page) : jetez-y un œil avant d'appeler.
- Prospection : au Portugal comme dans toute l'UE, le RGPD s'applique aux emails nominatifs. Privilégiez les
  contacts professionnels génériques, présentez-vous clairement et proposez toujours de ne plus être recontacté.
