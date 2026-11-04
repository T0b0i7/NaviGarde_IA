import { FormEvent, useState } from "react";
import { BarChart3, Bell, Eye, EyeOff, FileText, Lock, LogIn, ShieldCheck, User } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import logoIcon from "@/assets/logo-icon.png";
import "./login.css";

export default function Login() {
  const { t } = useLang();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState(() => { try { return localStorage.getItem("navigarde_remember_email") ?? ""; } catch { return ""; } });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => { try { return Boolean(localStorage.getItem("navigarde_remember_email")); } catch { return false; } });
  const [resetMode, setResetMode] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const login = trpc.localAuth.login.useMutation({
    onSuccess: async () => {
      try {
        if (rememberMe) localStorage.setItem("navigarde_remember_email", email.trim().toLowerCase());
        else localStorage.removeItem("navigarde_remember_email");
      } catch {}
      try {
        await utils.auth.me.refetch();
      } catch {}
      navigate("/", { replace: true });
    },
    onError: () => setError(t("login.error")),
  });
  const requestReset = trpc.localAuth.requestPasswordReset.useMutation({
    onSuccess: () => setError(t("login.tokenSent")),
    onError: () => setError(t("login.reqFail")),
  });
  const finishRecovery = trpc.localAuth.resetPassword.useMutation({
    onSuccess: () => { setResetMode(false); setError(t("login.resetOk")); },
    onError: () => setError(t("login.resetFail")),
  });

  const handleLogin = (e: FormEvent) => { e.preventDefault(); setError(""); login.mutate({ email, password, remember: rememberMe }); };
  const handleRequestReset = (e: FormEvent) => { e.preventDefault(); setError(""); requestReset.mutate({ email }); };
  const handleFinishRecovery = (e: FormEvent) => { e.preventDefault(); setError(""); finishRecovery.mutate({ token: resetToken, password: newPassword }); };

  return (
    <div className="ng-login">
      <aside className="ng-left" aria-label="NaviGarde IA">
        <div className="ng-left-bg" aria-hidden="true" />
        <div className="ng-left-shade" aria-hidden="true" />
        <div className="ng-left-inner">
          <div className="ng-brand">
            <img src={logoIcon} alt="NaviGarde IA logo" className="ng-brand-logo" />
            <div className="ng-brand-text">
              <div className="ng-brand-title">NaviGarde <span>IA</span></div>
              <div className="ng-brand-sub">{t("nav.brandSub")}</div>
            </div>
          </div>

          <div className="ng-hero-spacer" />

          <h1 className="ng-hero-title">{t("login.heroTitleA")}<br /><span>{t("login.heroTitleB")}</span></h1>
          <p className="ng-hero-desc">{t("login.heroSub")}</p>

          <div className="ng-features">
            <div className="ng-feature"><ShieldCheck size={30} strokeWidth={1.8} /><span style={{ whiteSpace: "pre-line" }}>{t("login.f1")}</span></div>
            <div className="ng-feature"><BarChart3 size={30} strokeWidth={1.8} /><span style={{ whiteSpace: "pre-line" }}>{t("login.f2")}</span></div>
            <div className="ng-feature"><Bell size={30} strokeWidth={1.8} /><span style={{ whiteSpace: "pre-line" }}>{t("login.f3")}</span></div>
            <div className="ng-feature"><FileText size={30} strokeWidth={1.8} /><span style={{ whiteSpace: "pre-line" }}>{t("login.f4")}</span></div>
          </div>

          <div className="ng-left-footer"><strong>NaviGarde IA</strong> <em>{t("login.footer")}</em></div>
        </div>
        <div className="ng-curve" aria-hidden="true" />
      </aside>

      <main className="ng-right" aria-labelledby="login-title">
        <div className="ng-waves" aria-hidden="true">
          <svg viewBox="0 0 800 220" preserveAspectRatio="none"><path d="M0 120 C 150 90, 250 150, 400 120 S 650 80, 800 130 L800 220 L0 220 Z" fill="var(--ng-surface)" opacity="0.7" /><path d="M0 150 C 160 120, 300 175, 480 145 S 680 115, 800 155 L800 220 L0 220 Z" fill="var(--ng-line-2)" opacity="0.8" /></svg>
        </div>
        <div style={{ position: "absolute", top: 18, right: 22, zIndex: 5 }}><LanguageSwitcher /></div>

        <div className="ng-card">
          <h1 className="ng-card-title" id="login-title">
            {resetMode ? t("login.recoverTitle") : <>{t("login.title")} <span>NaviGarde IA</span></>}
          </h1>
          <p className="ng-card-sub">{resetMode ? t("login.recoverSub") : t("login.sub")}</p>

          <div className="ng-logo-divider" aria-hidden="true">
            <i /><img src={logoIcon} alt="" /><i />
          </div>

          {!resetMode ? (
            <form onSubmit={handleLogin} className="ng-form" autoComplete="on">
              <div className="ng-field">
                <label htmlFor="login-email"><User size={18} /> {t("login.email")}</label>
                <input id="login-email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder={t("login.emailPh")} autoComplete="username" />
              </div>
              <div className="ng-field">
                <label htmlFor="login-password"><Lock size={18} /> {t("login.password")}</label>
                <div className="ng-pass-wrap">
                  <input id="login-password" name="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder={t("login.passwordPh")} autoComplete="current-password" />
                  <button type="button" className="ng-eye" onClick={() => setShowPassword(!showPassword)} aria-label="toggle">{showPassword ? <Eye size={20} /> : <EyeOff size={20} />}</button>
                </div>
              </div>
              <div className="ng-row">
                <label className="ng-check"><input type="checkbox" checked={rememberMe} onChange={(e) => { setRememberMe(e.target.checked); if (!e.target.checked) { try { localStorage.removeItem("navigarde_remember_email"); } catch {} } }} /><span>{t("login.remember")}</span></label>
                <a href="#" onClick={(e) => { e.preventDefault(); setResetMode(true); setError(""); }}>{t("login.forgot")}</a>
              </div>
              {error && <div className="ng-error" role="alert">{error}</div>}
              <button type="submit" className="ng-submit" disabled={login.isPending}><LogIn size={19} /> {login.isPending ? t("login.signing") : t("login.submit")}</button>
            </form>
          ) : resetToken ? (
            <form onSubmit={handleFinishRecovery} className="ng-form">
              <div className="ng-field">
                <label htmlFor="reset-token"><Lock size={18} /> {t("login.token")}</label>
                <input id="reset-token" type="text" value={resetToken} onChange={(e) => setResetToken(e.target.value)} required placeholder={t("login.tokenPh")} autoComplete="one-time-code" />
              </div>
              <div className="ng-field">
                <label htmlFor="new-password"><Lock size={18} /> {t("login.newPassword")}</label>
                <input id="new-password" type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={12} placeholder="••••••••" autoComplete="new-password" />
              </div>
              {error && <div className="ng-error" role="alert">{error}</div>}
              <div className="ng-double">
                <button type="button" className="ng-ghost" onClick={() => { setResetMode(false); setResetToken(""); setError(""); }}>{t("c.cancel")}</button>
                <button type="submit" className="ng-submit" disabled={finishRecovery.isPending}><LogIn size={19} /> {finishRecovery.isPending ? "…" : t("login.resetBtn")}</button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRequestReset} className="ng-form">
              <div className="ng-field">
                <label htmlFor="reset-email"><User size={18} /> {t("login.accountEmail")}</label>
                <input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder={t("login.emailPh")} autoComplete="email" />
              </div>
              {error && <div className="ng-error" role="alert">{error}</div>}
              <div className="ng-double">
                <button type="button" className="ng-ghost" onClick={() => { setResetMode(false); setError(""); }}>{t("c.back")}</button>
                <button type="submit" className="ng-submit" disabled={requestReset.isPending}>{requestReset.isPending ? t("login.sending") : t("login.sendToken")}</button>
              </div>
              <button type="button" className="ng-linklike" onClick={() => setResetToken(" ")}>{t("login.haveToken")}</button>
            </form>
          )}

          <p className="ng-noaccount">{t("login.noAccount")} <a href="mailto:admin@navigarde.bj">{t("login.contactAdmin")}</a></p>
        </div>

        <div className="ng-mobile-brand"><img src={logoIcon} alt="NaviGarde IA" /><div><strong>NaviGarde <span>IA</span></strong><small>{t("nav.brandSub")}</small></div></div>
      </main>
    </div>
  );
}
