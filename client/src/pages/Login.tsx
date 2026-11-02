import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, User } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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
      setError("Si ce compte existe, un jeton de récupération a été généré.");
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
    <div className="login-page">
      {/* ============ LEFT: Hero with ship image ============ */}
      <div className="login-hero">
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <div className="brand">
            <div className="brand-mark">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="brand-icon">
                <path d="M3 12c0-2.8 1.3-5.3 3.3-6.9l-1.1-1.1C1.1 4.5 0 7.1 0 12c0 5.1 3.9 9.3 9 9.9.2.1.4.1.6.1.3 0 .6 0 .9-.1 5.3-.7 9.5-5.1 9.5-10.5 0-4.6-2.6-8.5-6.5-10.4l-1.1 1.1c2 1.6 3.3 4.1 3.3 6.9 0 4.1-3.4 7.5-7.5 7.5-4.1 0-7.5-3.4-7.5-7.5Z" />
                <path d="M12 19v3M12 3v3" />
              </svg>
            </div>
            <div className="brand-text">
              <div className="brand-title">NaviGarde IA</div>
              <div className="brand-subtitle">Sécurité maritime - Bénin</div>
            </div>
          </div>

          <h1 className="hero-title">Ensemble pour une mer plus sûre et plus durable</h1>
          <p className="hero-subtitle">
            Une plateforme intelligente pour inspecter, surveiller et sécuriser
            les activités maritimes au Bénin.
          </p>

          <div className="features">
            <div className="feature">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              </div>
              <div className="feature-text">
                <div className="feature-title">Inspection intelligente</div>
              </div>
            </div>
            <div className="feature">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 13c0-2.8-1.1-5.3-2.8-7.2"/><path d="M13 13c0 2.8-1.1 5.3-2.8 7.2"/><circle cx="12" cy="12" r="1"/></svg>
              </div>
              <div className="feature-text">
                <div className="feature-title">Analyse IA avancée</div>
              </div>
            </div>
            <div className="feature">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </div>
              <div className="feature-text">
                <div className="feature-title">Alertes en temps réel</div>
              </div>
            </div>
            <div className="feature">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              <div className="feature-text">
                <div className="feature-title">Rapports sécurisés</div>
              </div>
            </div>
          </div>

          <div className="hero-footer">
            NaviGarde IA — Pour des océans plus sûrs, un avenir plus serein
          </div>
        </div>
      </div>

      {/* ============ RIGHT: Sign-in card ============ */}
      <div className="login-card">
        <div className="card-header">
          <h2 className="card-title">Connexion à NaviGarde IA</h2>
          <p className="card-subtitle">Accédez à votre espace sécurisé</p>
          <div className="logo-ship">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ship-icon">
              <path d="M3 12c0-2.8 1.3-5.3 3.3-6.9l-1.1-1.1C1.1 4.5 0 7.1 0 12c0 5.1 3.9 9.3 9 9.9.2.1.4.1.6.1.3 0 .6 0 .9-.1 5.3-.7 9.5-5.1 9.5-10.5 0-4.6-2.6-8.5-6.5-10.4l-1.1 1.1c2 1.6 3.3 4.1 3.3 6.9 0 4.1-3.4 7.5-7.5 7.5-4.1 0-7.5-3.4-7.5-7.5Z" />
              <path d="M12 19v3M12 3v3" />
            </svg>
          </div>
        </div>

        <div className="card-body">
          {resetMode ? (
            <form onSubmit={handleFinishRecovery} className="auth-form">
              <div className="field">
                <label className="field-label">Jeton de récupération</label>
                <div className="field-input">
                  <Mail size={18} className="field-icon" />
                  <input
                    type="text"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    required
                    placeholder="Collez votre jeton"
                  />
                </div>
              </div>
              <div className="field">
                <label className="field-label">Nouveau mot de passe</label>
                <div className="field-input">
                  <LockKeyhole size={18} className="field-icon" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={12}
                    placeholder="••••••••"
                  />
                </div>
              </div>
              {error && <div className="field-error">{error}</div>}
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setResetMode(false)}>Annuler</button>
                <button type="submit" className="btn-primary">Réinitialiser</button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="auth-form">
              <div className="field">
                <label className="field-label">Adresse e-mail ou nom d'utilisateur</label>
                <div className="field-input">
                  <User size={18} className="field-icon" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="example@navigarde.bj"
                  />
                </div>
              </div>
              <div className="field">
                <label className="field-label">Mot de passe</label>
                <div className="field-input password-input">
                  <LockKeyhole size={18} className="field-icon" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Votre mot de passe"
                  />
                  <button type="button" className="btn-toggle-password" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="field field-remember">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Se souvenir de moi</span>
                </label>
                <a href="#" className="forgot-link" onClick={(e) => { e.preventDefault(); setResetMode(true); setError(""); }}>
                  Mot de passe oublié ?
                </a>
              </div>
              {error && <div className="field-error">{error}</div>}
              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  <ArrowRight size={18} className="btn-icon" />
                  Se connecter
                </button>
              </div>
            </form>
          )}

          <div className="divider">
            <span>Ou se connecter avec</span>
          </div>

          <button type="button" className="btn-manus">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="manus-icon">
              <circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0-9.95 9.95L12 23v2M12 2v3M12 19v2M4.93 4.93l2.83 2.83M19.07 19.07l2.83-2.83M4.93 19.07l2.83-2.83M19.07 4.93l-2.83 2.83" />
            </svg>
            Manus
          </button>

          <p className="no-account">
            Vous n’avez pas de compte ? <a href="#" className="no-account-link">Contacter l’administrateur</a>
          </p>
        </div>
      </div>
    </div>
  );
}
