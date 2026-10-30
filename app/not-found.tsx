import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 24, textAlign: "center" }}>
      <h1>Page introuvable</h1>
      <p className="muted">L&apos;élément demandé n&apos;existe pas, a été supprimé ou ne vous est pas accessible.</p>
      <Link href="/dashboard">Retour au tableau de bord</Link>
    </div>
  );
}
