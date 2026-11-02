import { ArrowLeft, LockKeyhole, ShieldAlert } from "lucide-react";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";

export default function Forbidden() {
  return <AppShell><div className="forbidden-page"><div className="forbidden-orb"><LockKeyhole size={30} /></div><span className="eyebrow">Contrôle d’accès RBAC</span><h1>Accès réservé</h1><p>Votre rôle actuel ne possède pas la permission de consulter cette zone. Demandez une élévation au superviseur ou à l’administrateur.</p><div className="forbidden-actions"><Link href="/" className="primary-button"><ArrowLeft size={16} /> Retour au cockpit</Link><Link href="/parametres" className="secondary-button"><ShieldAlert size={16} /> Voir mon rôle</Link></div></div></AppShell>
}
