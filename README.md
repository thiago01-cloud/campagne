# CAMPAGNES — Web

Plateforme d'import de contacts (CSV, Excel) et de campagnes SMS / e-mail, multi-entreprise (Next.js, App Router,
TypeScript, Tailwind CSS, Prisma). Même structure que TASKS. L'import PDF (lot 4) viendra plus tard.

By EasyX Corporate, JLNM 2026

## Démarrage (local)

1. Installer les dépendances :

   ```bash
   npm install
   ```

2. Récupérer les variables du projet Vercel (base Neon comprise), comme TASKS :

   ```bash
   vercel link
   vercel env pull .env
   ```

   Puis créer `.env.local` (réglages du poste, non écrasés par `vercel env pull`) :

   ```
   APP_URL="http://localhost:3000"
   QUEUE_INTERNAL="1"
   CRON_SECRET=""
   ```

3. Appliquer le schéma à la base :

   ```bash
   npm run db:migrate
   ```

4. Lancer le serveur de développement :

   ```bash
   npm run dev
   ```

L'application est disponible sur [http://localhost:3000](http://localhost:3000) : la page de présentation, puis
« Créer un compte » → création de l'entreprise → tableau de bord (vous en êtes le propriétaire).

Avec `QUEUE_INTERNAL="1"`, l'application traite elle-même la file d'envoi toutes les 10 secondes :
rien d'autre à lancer.

## Structure

- `app/page.tsx` — page de présentation publique
- `app/signup/`, `app/create-company/` — inscription puis création de l'entreprise
- `app/login/` (+ `choose-company/`), `app/set-password/` — connexion (téléphone ou e-mail), choix de l'entreprise,
  choix du mot de passe après invitation
- `app/dashboard/` — espace connecté : tableau de bord, listes, campagnes, désinscriptions, équipe, paramètres, journal,
  mon compte, mes entreprises
- `app/api/` — routes API (auth, entreprises, membres, groupes, listes, campagnes, notifications, push, webhooks, cron)
- `app/components/` — composants partagés (Logo, Footer, PhoneField, DataTable, ui)
- `lib/` — logique partagée : `auth.ts` (sessions), `token.ts` (jetons signés), `team.ts` (hiérarchie et visibilité),
  `notifications.ts` + `push.ts`, `campaigns.ts`, `queue.ts` (file d'envoi), `import/` (lecture, nettoyage),
  `messages/` (variables, SMS, e-mail), `providers/` (connecteur SMS / e-mail), `enums.ts`, `constants.ts`, `phone.ts`
- `middleware.ts` — protège `/dashboard`, gère la connexion en deux étapes (choix / création d'entreprise), prolonge la session
- `instrumentation.ts` — traitement automatique de la file d'envoi en local
- `prisma/schema.prisma` — modèle de données
- `public/` — `manifest.json`, `sw.js` et icônes de la PWA

Conventions (identiques à TASKS) : noms de code en anglais, textes affichés en français ; champs « enum » en `String`
validés dans `lib/enums.ts` ; JSON stocké en texte (`lib/json.ts`) pour fonctionner en SQLite comme en PostgreSQL.

## Comptes et entreprises

Même modèle que TASKS : un **compte** (User) se connecte par téléphone ou e-mail ; il peut **posséder** une ou plusieurs
entreprises (Company) et/ou en être **membre** (Agent, avec un rôle propre à chaque entreprise). À la connexion : une seule
entreprise → tableau de bord ; plusieurs → choix ; aucune → création. « Mes entreprises » permet de basculer, renommer,
supprimer (propriétaire) ou créer une entreprise. Listes, campagnes, groupes, désinscriptions, paramètres et journal sont
cloisonnés par entreprise.

## Équipe et rôles (dans une entreprise)

| Rôle | Droits |
|---|---|
| Propriétaire | Tout, y compris nommer des administrateurs, renommer ou supprimer l'entreprise |
| Administrateur | Membres, groupes et chefs, paramètres, journal ; voit et gère toutes les listes et campagnes |
| Chef de groupe | Ajoute des agents dans ses groupes ; voit et gère ses listes et campagnes et celles de ses agents |
| Agent | Importe des listes, crée et lance ses campagnes ; ne voit que les siennes |
| Lecteur | Consulte toutes les listes, campagnes et rapports, sans rien envoyer ni modifier |

Un agent nommé chef d'un groupe devient « Chef de groupe » ; un chef qui ne dirige plus aucun groupe redevient agent.
« Ajouter un membre » : si la personne a déjà un compte (même téléphone ou e-mail), elle est rattachée à l'entreprise ;
sinon son compte est créé et elle reçoit un lien (WhatsApp ou copie) pour choisir son mot de passe. Un membre est
bloqué plutôt que supprimé.

## Notifications et PWA

Les retours d'une campagne (lancement, démarrage d'un envoi programmé, fin d'envoi, annulation) sont envoyés à son
auteur et au chef de son groupe : dans la cloche, et en push sur les appareils où la personne a activé les
notifications (« Mon compte »). Pour le push, générer une paire de clés une seule fois :

```bash
npx web-push generate-vapid-keys
```

et la reporter dans `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`. L'application s'installe comme une
application (manifeste + service worker), sur iPhone via Safari → Partager → Sur l'écran d'accueil.

## File d'envoi

Pas de Redis : la file est la table `sends` (statut `PENDING`). Chaque passage simule les accusés (mode simulation),
prépare les campagnes programmées arrivées à échéance, puis envoie au débit des Paramètres dans la limite du plafond
quotidien, avec 3 tentatives (30 s puis 1 min d'attente). Chaque message est verrouillé avant l'envoi : jamais
d'envoi en double.

## Fournisseurs

Par défaut `SMS_PROVIDER="simulation"` et `EMAIL_PROVIDER="simulation"` : rien n'est envoyé, mais tout se comporte
comme avec un vrai fournisseur. `EMAIL_PROVIDER="smtp"` envoie de vrais e-mails. Pour brancher le fournisseur SMS
retenu : `lib/providers/<nom>.ts` implémentant `sendSms(phone, message)`, déclaré dans `lib/providers/index.ts`.

Webhooks (en-tête `x-webhook-secret: <WEBHOOK_SECRET>`) :

- `POST /api/webhooks/status` — `{ "providerId": "...", "status": "delivered" | "failed" | "sent", "error": "..." }`
- `POST /api/webhooks/stop` — `{ "phone": "077000000", "message": "STOP" }`

## Déploiement (Vercel + Neon)

Même procédure que TASKS. Le schéma cible désormais PostgreSQL (`directUrl` pour les migrations) : la base locale
SQLite n'est plus utilisée, le développement local se fait sur la base Neon (`vercel env pull .env`).

1. Projet Vercel relié au dépôt GitHub, puis Storage → Neon : `DATABASE_URL` / `DATABASE_URL_UNPOOLED` sont créées
   automatiquement. Ajouter `JWT_SECRET`, `CRON_SECRET`, `WEBHOOK_SECRET`, les clés VAPID et les fournisseurs. Ne pas
   définir `QUEUE_INTERNAL`. `APP_URL` est facultative (par défaut : le domaine de production Vercel).
2. En local : supprimer `prisma/migrations` (anciennes migrations SQLite) et `prisma/dev.db`, `vercel env pull .env`,
   puis `npm run db:migrate -- --name init` (migrations PostgreSQL, à committer). Les réglages propres au poste
   (`QUEUE_INTERNAL="1"`, `APP_URL="http://localhost:3000"`) vont dans `.env.local`, que `vercel env pull` n'écrase pas.
3. `git push` : le build applique les migrations (`prisma migrate deploy`).
4. File d'envoi :
   - une campagne lancée part aussitôt et va jusqu'au bout seule : chaque traitement (50 s maximum) relance le suivant
     via `/api/cron/send-queue` tant qu'il reste des messages ;
   - `vercel.json` déclenche aussi la file une fois par jour (limite du plan Hobby), par sécurité ;
   - pour que les campagnes **programmées** partent à l'heure, un appel chaque minute est nécessaire : service gratuit
     comme cron-job.org, URL `https://<app>/api/cron/send-queue?key=<CRON_SECRET>` (ou le plan Pro, avec
     `"schedule": "* * * * *"` dans `vercel.json`).

## Points encore à valider (cahier des charges §7)

- Fournisseurs SMS et e-mail, domaine d'envoi
- Validation des campagnes par le chef de groupe avant envoi (prévue plus tard)
- Abonnements / offres par entreprise (comme TASKS), si la plateforme est commercialisée
- Taille maximale de fichier et nombre de contacts par campagne (réglables dans Paramètres)
"# campagne" 
