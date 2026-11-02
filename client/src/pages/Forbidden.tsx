import { ArrowLeft, LockKeyhole, ShieldAlert } from "lucide-react";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";

export default function Forbidden() {
  return (
    <AppShell>
      <div className="login-page">
        <div className="login-hero">
          <div className="hero-overlay"></div>
          <div className="hero-content">
            <div className="brand">
              <div className="brand-mark">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12c0-2.8 1.3-5.3 3.3-6.9l-1.1-1.1C1.1 4.5 0 7.1 0 12c0 5.1 3.9 9.3 9 9.9.2.1.4.1.6.1.3 0 .6 0 .9-.1 5.3-.7 9.5-5.1 9.5-10.5 0-4.6-2.6-8.5-6.5-10.4l-1.1 1.1C6.3 7.6 9.6 4.1 12 4.1c4.1 0 7.5 3.4 7.5 7.5Z" /><path d="M12 19v3M12 3v3" /></svg>
              </div>
              <div className="brand-text">
                <div className="brand-title">NaviGarde IA</div>
                <div className="brand-subtitle">Sécurité maritime - Bénin</div>
              </div>
            </div>
            <h1 className="hero-title">Accès réservé</h1>
            <p className="hero-subtitle">Votre rôle actuel ne possède pas la permission de consulter cette zone.</p>
          </div>
        </div>
        <div className="login-form-panel">
          <div className="login-header">
            <span className="eyebrow">Contrôle d'accès RBAC</span>
            <h2>Accès réservé</h2>
            <p>Votre rôle actuel ne possède pas la permission de consulter cette zone. Demandez une élévation au superviseur ou à l'administrateur.</p>
          </div>
          <div className="modal-actions">
            <Link href="/" className="btn btn-primary"><ArrowLeft size={16} /> Retour au cockpit</Link>
            <Link href="/parametres" className="btn btn-secondary"><ShieldAlert size={16} /> Voir mon rôle</Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
