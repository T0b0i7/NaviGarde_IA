import { FormEvent, useState } from "react";
import { Anchor, ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole } from "lucide-react";
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
    <div className="login-split">
      {/* Left hero panel */}
      <div className="login-hero">
        <div className="hero-content">
          <h1>Chaque décision protège.</h1>
          <p>
            Le cockpit opérationnel qui transforme les inspections, alertes et
            signaux terrain en décisions traçables.
          </p>
          <div className="hero-stats">
            <div className="stat">
              <div className="stat-value">24/7</div>
              <div className="stat-label">veille opérationnelle</div>
            </div>
            <div className="stat">
              <div className="stat-value">RBAC</div>
              <div className="stat-label">accès par rôle</div>
            </div>
            <div className="stat">
              <div className="stat-value">100%</div>
              <div className="stat-label">actions tracées</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right sign-in panel */}
      <div className="login-form-panel">
        <div className="login-header">
          <span className="eyebrow">ESPACE SÉCURISÉ</span>
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
              <span>ADRESSE E-MAIL</span>
              <div className="login-input">
                <span>@</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </label>
            <label className="field">
              <span>MOT DE PASSE</span>
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
    </div>
  );
}
