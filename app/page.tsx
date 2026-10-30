// Public landing page: presents the platform and its features, with
// floating buttons to log in — same structure as TASKS's landing page. A
// logged-in account never sees it (the middleware sends it to /dashboard).
import Link from "next/link";
import Logo from "./components/Logo";
import { APP_NAME, pageTitle } from "@/lib/constants";

export const metadata = {
  title: pageTitle("Import de contacts et campagnes SMS / e-mail"),
  description: "Transformez un fichier client en campagne SMS ou e-mail personnalisée, envoyée et suivie, en quelques clics.",
};

const stroke = { fill: "none", stroke: "var(--color-primary)", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Icon({ children, size = 26 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      {children}
    </svg>
  );
}

const STEPS = [
  {
    title: "Importez votre fichier",
    text: "Déposez un fichier CSV ou Excel contenant vos clients : nom, numéro, e-mail, identifiant… La première ligne donne les colonnes.",
    icon: (
      <Icon size={22}>
        <path d="M12 15V4" />
        <path d="M7.5 8.5L12 4l4.5 4.5" />
        <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
      </Icon>
    ),
  },
  {
    title: "Vérifiez les contacts",
    text: "Colonnes téléphone et e-mail détectées, numéros mis au format international, doublons et désinscrits retirés automatiquement.",
    icon: (
      <Icon size={22}>
        <path d="M9 11.5l2 2 4-4.5" />
        <rect x="4" y="4" width="16" height="16" rx="3" />
      </Icon>
    ),
  },
  {
    title: "Rédigez la campagne",
    text: "SMS, e-mail ou les deux, personnalisés avec les colonnes du fichier : « Bonjour {{nom}} ». Aperçu réel et envoi test.",
    icon: (
      <Icon size={22}>
        <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
        <path d="M13.5 6.5l4 4" />
      </Icon>
    ),
  },
  {
    title: "Suivez les résultats",
    text: "Envoyés, livrés, échoués, ouvertures : le tableau de bord se met à jour en direct, les échecs se relancent en un clic.",
    icon: (
      <Icon size={22}>
        <path d="M5 20V11" />
        <path d="M12 20V4" />
        <path d="M19 20v-7" />
      </Icon>
    ),
  },
];

const FEATURES = [
  {
    title: "Import CSV et Excel",
    text: "Séparateur et encodage détectés, choix de la feuille, aperçu triable des données avant enregistrement.",
    icon: (
      <Icon>
        <path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8L14 3.5Z" />
        <path d="M14 3.5V8h4.5" />
        <path d="M9 12.5h6M9 16h6" />
      </Icon>
    ),
  },
  {
    title: "Nettoyage automatique",
    text: "Numéros au format +241, e-mails vérifiés, doublons retirés, rapport des lignes rejetées exportable.",
    icon: (
      <Icon>
        <path d="M4 7h16M7 12h10M10 17h4" />
      </Icon>
    ),
  },
  {
    title: "SMS et e-mails personnalisés",
    text: "Variables issues du fichier, valeur de secours, compteur de caractères et de SMS, envoi immédiat ou programmé.",
    icon: (
      <Icon>
        <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
        <path d="M4 7l8 6 8-6" />
      </Icon>
    ),
  },
  {
    title: "Suivi et relances",
    text: "Statut de chaque message, ouvertures des e-mails, relance des échecs, rapport en CSV ou Excel.",
    icon: (
      <Icon>
        <path d="M20 12a8 8 0 1 1-2.34-5.66" />
        <path d="M20 4v4.5h-4.5" />
      </Icon>
    ),
  },
  {
    title: "Équipes et groupes",
    text: "L'administrateur crée des groupes et nomme leur chef ; le chef ajoute ses agents et suit leurs campagnes.",
    icon: (
      <Icon>
        <circle cx="8.5" cy="8" r="3" />
        <circle cx="16" cy="9" r="2.4" />
        <path d="M2.8 19.5c1-3.2 3.2-4.8 5.7-4.8s4.7 1.6 5.7 4.8" />
        <path d="M14.8 15.1c2 .2 3.5 1.6 4.2 3.7" />
      </Icon>
    ),
  },
  {
    title: "Notifications",
    text: "L'agent et son chef sont prévenus du lancement, du démarrage et de la fin de chaque campagne, sur la cloche et en push.",
    icon: (
      <Icon>
        <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" />
        <path d="M10 19a2 2 0 0 0 4 0" />
      </Icon>
    ),
  },
  {
    title: "Désinscriptions et consentement",
    text: "Lien de désinscription dans chaque e-mail, mention STOP pour les SMS, désinscrits exclus de toutes les campagnes.",
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="8" />
        <path d="M6.5 17.5l11-11" />
      </Icon>
    ),
  },
  {
    title: "Application installable",
    text: "Installez la plateforme sur téléphone ou ordinateur comme une application, et recevez les notifications même fermée.",
    icon: (
      <Icon>
        <rect x="7" y="3" width="10" height="18" rx="2" />
        <path d="M11 17.5h2" />
      </Icon>
    ),
  },
];

export default function Home() {
  return (
    <div className="home-page">
      <div className="floating-buttons">
        <Link href="/login" className="button-secondary button">Se connecter</Link>
        <Link href="/signup" className="button">Créer un compte</Link>
      </div>

      <header className="home-header">
        <Logo size="large" />
        <h1 className="home-title">Du fichier client à la campagne envoyée et suivie, en quelques clics</h1>
        <p className="home-subtitle">
          {APP_NAME} transforme un fichier CSV ou Excel de contacts en campagne SMS ou e-mail personnalisée. Importez, vérifiez, rédigez, envoyez,
          puis suivez chaque message, avec votre équipe organisée en groupes. Créez votre compte et votre entreprise en quelques minutes.
        </p>
        <div className="home-cta">
          <Link href="/signup" className="button">Créer un compte</Link>
          <Link href="/login" className="button-secondary button">Se connecter</Link>
        </div>
      </header>

      <section className="home-section">
        <h2 className="section-title">Comment ça marche</h2>
        <p className="section-subtitle">Créez votre compte et votre entreprise, invitez votre équipe, puis quatre étapes jusqu&apos;au rapport d&apos;envoi.</p>
        <div className="steps-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))" }}>
          {STEPS.map((s, i) => (
            <div key={s.title} className="step-card">
              <span className="step-number">{i + 1}</span>
              <div className="step-icon">{s.icon}</div>
              <h3>{s.title}</h3>
              <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 14 }}>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section scroll-target" id="fonctionnalites">
        <h2 className="section-title">Tout ce qu&apos;il faut pour vos campagnes</h2>
        <p className="section-subtitle">Une plateforme pensée pour les équipes qui contactent leurs clients au quotidien.</p>
        <div className="features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature-card">
              {f.icon}
              <h3>{f.title}</h3>
              <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 13.5 }}>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section">
        <h2 className="section-title">Une équipe, des rôles clairs</h2>
        <p className="section-subtitle">Chacun voit et gère ce qui le concerne.</p>
        <div className="features-grid">
          {[
            ["Propriétaire et administrateurs", "Invitent les membres, créent les groupes, nomment les chefs, règlent les paramètres et voient toute l'activité de l'entreprise."],
            ["Chef de groupe", "Ajoute ses agents, suit et gère leurs listes et campagnes, reçoit leurs notifications."],
            ["Agent", "Importe ses fichiers, crée et lance ses campagnes, reçoit les retours de ses envois."],
            ["Lecteur", "Consulte les listes, les campagnes et les rapports, sans pouvoir envoyer."],
          ].map(([title, text]) => (
            <div key={title} className="feature-card">
              <h3>{title}</h3>
              <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 13.5 }}>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <h2>Prêt à lancer votre première campagne ?</h2>
        <p>Créez votre compte et votre entreprise en quelques minutes, puis invitez votre équipe.</p>
        <Link href="/signup" className="button" style={{ background: "var(--color-accent)" }}>Créer un compte gratuitement</Link>
      </section>
    </div>
  );
}
