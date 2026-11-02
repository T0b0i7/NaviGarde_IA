import { FormEvent, useState } from "react";
import { Anchor, ArrowRight, KeyRound, LockKeyhole, Waves } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const login = trpc.localAuth.login.useMutation({
    onSuccess: () => navigate("/", { replace: true }),
    onError: () => setError("Adresse e-mail ou mot de passe incorrect."),
  });

  const requestReset = trpc.localAuth.requestPasswordReset.useMutation({
    onSuccess: (data) => {
      setResetMode(false);
      if (data.resetToken) {
        setResetToken(data.resetToken);
        setError("Jeton de récupération affiché ci-dessous (mode développement).");
      } else {
        setError("Si ce compte existe, un jeton a été généré.");
      }
    },
    onError: () => setError("Échec de la demande de réinitialisation."),
  });

  const finishRecovery = trpc.localAuth.resetPassword.useMutation({
    onSuccess: () => {
      setResetMode(false);
      setError("Mot de passe réinitialisé avec succès. Vous pouvez vous connecter.");
    },
    onError: () => setError("Échec de la réinitialisation du mot de passe."),
  });

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    login.mutate({ email, password });
  };

  const handleRequestReset = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    requestReset.mutate({ email });
  };

  const handleFinishRecovery = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    finishRecovery.mutate({ token: resetToken, password: newPassword });
  };

  return (
    <>
      <div className="login-page">
        <div className="login-visual">
          <div className="login-brand">
            <div className="brand-mark">
              <Waves size={36} /><Anchor size={15} className="brand-anchor" />
            </div>
            <div>
              <strong>NaviGarde IA</strong>
              <span>Sécurité maritime · Bénin</span>
            </div>
          </div>
          <div className="login-visual-copy">
            <span className="eyebrow">Maritime intelligence platform</span>
            <h1>Chaque signal compte.<br /><em>Chaque décision protège.</em></h1>
            <p>Le cockpit opérationnel qui transforme les inspections, alertes et signaux terrain en décisions traçables.</p>
            <div className="login-proof">
              <div><strong>24/7</strong><span>veille opérationnelle</span></div>
              <div><strong>RBAC</strong><span>accès par rôle</span></div>
              <div><strong>100%</strong><span>actions tracées</span></div>
            </div>
          </div>
        </div>
        <div className="login-wave"><Waves size={240} strokeWidth={0.8} /></div>
      </div>
      <main className="login-panel">
        <div className="login-panel-inner">
          <div className="login-mobile-brand">
            <Waves size={29} /><strong>NaviGarde IA</strong>
          </div>
          <div className="login-heading">
            <span className="eyebrow">Espace sécurisé</span>
            <h2>Bon retour, officier.</h2>
            <p>Connectez-vous avec votre compte NaviGarde.</p>
          </div>
          {resetMode ? (
            <form onSubmit={handleFinishRecovery} className="login-form">
              <label className="field">
                <span>Jeton de récupération</span>
                <div className="login-input">
                  <KeyRound size={17} />
                  <input value={resetToken} onChange={(e) => setResetToken(e.target.value)} required />
                </div>
              </label>
              <label className="field">
                <span>Nouveau mot de passe</span>
                <div className="login-input">
                  <LockKeyhole size={17} />
                  <input type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={12} required />
                </div>
              </label>
              {error && <div className="ai-error">{error}</div>}
              <div className="modal-actions">
                <Anchor href="#" onClick={(e) => { e.preventDefault(); setResetMode(false); }} className="secondary-button">Annuler</Anchor>
                <button type="submit" className="primary-button">Réinitialiser</button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="login-form">
              <label className="field">
                <span>Adresse e-mail</span>
                <div className="login-input">
                  <span>@</span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </label>
              <label className="field">
                <span>Mot de passe</span>
                <div className="login-input">
                  <LockKeyhole size={17} />
                  <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
              </label>
              {error && <div className="ai-error">{error}</div>}
              <div className="modal-actions">
                <Anchor href="#" onClick={(e) => { e.preventDefault(); setResetMode(true); setError(""); }} className="secondary-button">Mot de passe oublié ?</Anchor>
                <button type="submit" className="primary-button">
                  Se connecter <ArrowRight size={15} />
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
