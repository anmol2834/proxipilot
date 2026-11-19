"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  IconArrowLeft,
  IconKey,
  IconMailOpened,
  IconLockPassword,
  IconAlertCircle,
  IconInfoCircle,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api";
import { startFreshSession } from "@/lib/query/session-cache";
import { ProxiPilotLogo } from "@/components/ui/ProxiPilotLogo";
import f from "./forgot-password.module.css";

type Step = "email" | "code" | "password" | "done";

const CODE_LENGTH = 6;
/** Hands the email between sign-in and reset within this tab only (never in the URL). */
export const AUTH_EMAIL_KEY = "pp:authEmail";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const UNAVAILABLE =
  "We can’t reach ProxiPilot right now, so nothing was sent. Please try again in a few minutes. If it keeps happening, contact us.";

/** Show the server's own message for expected problems (wrong code, wait time); never raw
 *  technical text like "Not Found" for outages, missing routes or network failures. */
function errorText(err: unknown, fallback: string) {
  const status =
    err && typeof err === "object" && "statusCode" in err ? Number((err as { statusCode: unknown }).statusCode) : 0;
  if (!status || status === 404 || status === 499 || status >= 500) return UNAVAILABLE;
  if (status === 400 || status === 429) {
    return err instanceof Error && err.message ? err.message : fallback;
  }
  return fallback;
}

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Seconds left on a countdown that ends at `until` (ms epoch). */
function useCountdown(until: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [until]);
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
}

function passwordChecks(pw: string) {
  return {
    length: pw.length >= 8,
    mixed: /[a-z]/.test(pw) && /[A-Z]/.test(pw),
    number: /\d/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  };
}

function strength(pw: string) {
  if (!pw) return { score: 0, label: "", color: "#e2e8f0" };
  const c = passwordChecks(pw);
  let score = [c.length, c.mixed, c.number, c.symbol].filter(Boolean).length;
  if (pw.length >= 12 && score >= 3) score = 4;
  if (!c.length) score = Math.min(score, 1);
  const levels = [
    { label: "Too short", color: "#ef4444" },
    { label: "Weak", color: "#ef4444" },
    { label: "Fair", color: "#f59e0b" },
    { label: "Good", color: "#3562f5" },
    { label: "Strong", color: "#10b981" },
  ];
  return { score, ...levels[score] };
}

function EyeButton({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="pp-input-action-btn"
      onClick={onToggle}
      aria-label={shown ? "Hide password" : "Show password"}
    >
      {shown ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

function Alert({ tone, children }: { tone: "error" | "info"; children: React.ReactNode }) {
  return (
    <div
      className={`${f.alert} ${tone === "error" ? f.alertError : f.alertInfo}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {tone === "error" ? <IconAlertCircle size={16} /> : <IconInfoCircle size={16} />}
      <span>{children}</span>
    </div>
  );
}

const STEPS: { key: Exclude<Step, "done">; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "code", label: "Verify code" },
  { key: "password", label: "New password" },
];

function Progress({ step }: { step: Step }) {
  const current = step === "done" ? 3 : STEPS.findIndex((s) => s.key === step);
  return (
    <ol className={f.progress} aria-label="Reset progress">
      {STEPS.map((s, i) => (
        <li
          key={s.key}
          className={`${f.progressStep} ${i < current ? f.progressDone : ""} ${i === current ? f.progressCurrent : ""}`}
          aria-current={i === current ? "step" : undefined}
        >
          <span className={f.progressBar}>
            <span />
          </span>
          <span className={f.progressLabel}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function ForgotPasswordFlow() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(""));
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  const resendIn = useCountdown(resendAt);
  const expiresIn = useCountdown(expiresAt);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const boxRefs = useRef<(HTMLInputElement | null)[]>([]);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const emailClean = email.trim().toLowerCase();
  const emailValid = EMAIL_RE.test(emailClean);
  const code = digits.join("");
  const checks = useMemo(() => passwordChecks(password), [password]);
  const meter = useMemo(() => strength(password), [password]);
  const matches = confirm.length > 0 && confirm === password;
  const canReset = checks.length && matches && !loading;

  // Prefill the email typed on the sign-in page, if any.
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(AUTH_EMAIL_KEY);
      if (saved) setEmail((cur) => cur || saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Move focus to the right place whenever the step changes.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (step === "email") emailRef.current?.focus();
      else if (step === "code") boxRefs.current[0]?.focus();
      else if (step === "password") passwordRef.current?.focus();
      else headingRef.current?.focus();
    }, 60);
    return () => window.clearTimeout(t);
  }, [step]);

  const go = (next: Step) => {
    setError("");
    setInfo("");
    setStep(next);
  };

  /* ---------- step 1: request a code ---------- */

  const sendCode = useCallback(
    async (isResend = false) => {
      setError("");
      setInfo("");
      setLoading(true);
      try {
        const res = await authApi.requestPasswordReset(emailClean);
        setChallengeId(res.challenge_id);
        setResendAt(Date.now() + res.cooldown_seconds * 1000);
        setExpiresAt(Date.now() + res.expires_in_seconds * 1000);
        setDigits(Array(CODE_LENGTH).fill(""));
        setCodeError(false);
        if (isResend) {
          setInfo("We sent a new code. Earlier codes no longer work.");
          boxRefs.current[0]?.focus();
        } else {
          go("code");
        }
      } catch (err) {
        setError(errorText(err, "We couldn't send a code right now. Please try again in a moment."));
      } finally {
        setLoading(false);
      }
    },
    [emailClean],
  );

  const onEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    if (!emailValid) {
      emailRef.current?.focus();
      return;
    }
    void sendCode(false);
  };

  /* ---------- step 2: verify the code ---------- */

  const verify = useCallback(
    async (value: string) => {
      if (value.length !== CODE_LENGTH || loading) return;
      setError("");
      setInfo("");
      setLoading(true);
      try {
        const res = await authApi.verifyPasswordReset({ email: emailClean, challenge_id: challengeId, otp: value });
        setResetToken(res.reset_token);
        go("password");
      } catch (err) {
        setCodeError(true);
        setShakeKey((k) => k + 1);
        setDigits(Array(CODE_LENGTH).fill(""));
        setError(errorText(err, "That code didn't work. Please check it and try again."));
        window.setTimeout(() => boxRefs.current[0]?.focus(), 30);
      } finally {
        setLoading(false);
      }
    },
    [challengeId, emailClean, loading],
  );

  const setDigitsFrom = (start: number, raw: string) => {
    const chars = raw.replace(/\D/g, "").slice(0, CODE_LENGTH - start).split("");
    if (!chars.length) return;
    const next = [...digits];
    chars.forEach((c, i) => (next[start + i] = c));
    setDigits(next);
    setCodeError(false);
    const nextIndex = Math.min(start + chars.length, CODE_LENGTH - 1);
    boxRefs.current[nextIndex]?.focus();
    const joined = next.join("");
    if (joined.length === CODE_LENGTH && !next.includes("")) void verify(joined);
  };

  const onBoxKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];
      if (next[i]) {
        next[i] = "";
      } else if (i > 0) {
        next[i - 1] = "";
        boxRefs.current[i - 1]?.focus();
      }
      setDigits(next);
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      boxRefs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < CODE_LENGTH - 1) {
      e.preventDefault();
      boxRefs.current[i + 1]?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      void verify(code);
    }
  };

  /* ---------- step 3: new password ---------- */

  const onResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canReset) return;
    setError("");
    setLoading(true);
    try {
      await authApi.resetPassword({ reset_token: resetToken, new_password: password });
      // Every session was just signed out; drop anything cached for the old one.
      startFreshSession(queryClient);
      setPassword("");
      setConfirm("");
      try {
        window.sessionStorage.setItem(AUTH_EMAIL_KEY, emailClean);
      } catch {
        /* storage unavailable */
      }
      go("done");
    } catch (err) {
      setError(errorText(err, "We couldn't update your password. Please start again."));
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setChallengeId("");
    setResetToken("");
    setDigits(Array(CODE_LENGTH).fill(""));
    setPassword("");
    setConfirm("");
    setResendAt(null);
    setExpiresAt(null);
    go("email");
  };

  /* ---------- render ---------- */

  const backTarget =
    step === "code" ? (
      <button type="button" className={f.back} onClick={() => go("email")}>
        <IconArrowLeft size={16} /> Change email
      </button>
    ) : (
      <Link href="/signin" className={f.back}>
        <IconArrowLeft size={16} /> Back to sign in
      </Link>
    );

  return (
    <div className={`pp-signin-form-panel ${f.panel}`}>
      <div className={f.top}>
        {step === "done" ? <span /> : backTarget}
        <ProxiPilotLogo size={30} href="/" textSize="1.15rem" />
      </div>

      <div className="pp-signup-form-wrapper">
        {step !== "done" && <Progress step={step} />}

        {step === "email" && (
          <div className={f.step} key="email">
            <div className={f.iconTile} aria-hidden="true">
              <IconKey size={24} stroke={1.8} />
            </div>
            <h1 className={f.title} ref={headingRef} tabIndex={-1}>
              Forgot your password?
            </h1>
            <p className={f.subtitle}>
              No problem. Enter the email you use for ProxiPilot and we&rsquo;ll send you a 6-digit code to reset it.
            </p>

            {error && <Alert tone="error">{error}</Alert>}

            <form onSubmit={onEmailSubmit} noValidate>
              <div className="pp-form-group">
                <label htmlFor="fp-email" className="pp-form-label">
                  Work email
                </label>
                <div className="pp-input-container">
                  <input
                    ref={emailRef}
                    id="fp-email"
                    type="email"
                    inputMode="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setEmailTouched(true)}
                    autoComplete="email"
                    className={emailTouched && email && !emailValid ? "has-error" : undefined}
                    aria-invalid={emailTouched && !emailValid}
                    aria-describedby="fp-email-msg"
                  />
                </div>
                {emailTouched && !emailValid && (
                  <span id="fp-email-msg" className="pp-form-error-msg">
                    {email ? "Enter a valid email address, like name@company.com." : "Enter your email address."}
                  </span>
                )}
              </div>

              <button type="submit" className="pp-signup-submit-btn" disabled={loading} style={{ marginTop: 18 }}>
                {loading ? "Sending code…" : "Send reset code"}
              </button>
            </form>

            <p className={f.hint}>
              Signed up with Google or Microsoft? You can keep using those buttons on the sign-in page, or reset here to
              add a password.
            </p>
            <p className={f.footerNote}>
              Remembered it? <Link href="/signin">Sign in</Link>
            </p>
          </div>
        )}

        {step === "code" && (
          <div className={f.step} key="code">
            <div className={f.iconTile} aria-hidden="true">
              <IconMailOpened size={24} stroke={1.8} />
            </div>
            <h1 className={f.title} ref={headingRef} tabIndex={-1}>
              Check your inbox
            </h1>
            <p className={f.subtitle}>
              If an account exists for <strong>{emailClean}</strong>, we&rsquo;ve sent it a 6-digit code.
              {expiresIn > 0 ? (
                <>
                  {" "}
                  It expires in <span className={f.timer}>{formatTime(expiresIn)}</span>.
                </>
              ) : (
                " This code has expired, so request a new one below."
              )}
            </p>

            {error && <Alert tone="error">{error}</Alert>}
            {info && <Alert tone="info">{info}</Alert>}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void verify(code);
              }}
              noValidate
            >
              <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
                <legend className="pp-form-label" style={{ marginBottom: 8 }}>
                  Verification code
                </legend>
                <div
                  key={shakeKey}
                  className={`${f.otp} ${codeError ? `${f.otpError} ${f.shake}` : ""}`}
                  role="group"
                  aria-label="6-digit verification code"
                >
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        boxRefs.current[i] = el;
                      }}
                      className={`${f.otpBox} ${d ? f.otpFilled : ""}`}
                      value={d}
                      inputMode="numeric"
                      autoComplete={i === 0 ? "one-time-code" : "off"}
                      maxLength={CODE_LENGTH}
                      aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`}
                      disabled={loading}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) {
                          const next = [...digits];
                          next[i] = "";
                          setDigits(next);
                          return;
                        }
                        // Typing replaces this box; autofill/paste can bring several digits at once.
                        setDigitsFrom(i, v.length > 1 && d ? v.replace(d, "") || v : v);
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        setDigitsFrom(i, e.clipboardData.getData("text"));
                      }}
                      onKeyDown={(e) => onBoxKeyDown(i, e)}
                      onFocus={(e) => e.target.select()}
                    />
                  ))}
                </div>
              </fieldset>

              <button
                type="submit"
                className="pp-signup-submit-btn"
                disabled={loading || code.length !== CODE_LENGTH}
                style={{ marginTop: 18 }}
              >
                {loading ? "Checking…" : "Verify code"}
              </button>
            </form>

            <div className={f.row}>
              <span>Didn&rsquo;t get it? Check your spam folder.</span>
              <button
                type="button"
                className={f.linkBtn}
                onClick={() => void sendCode(true)}
                disabled={resendIn > 0 || loading}
              >
                {resendIn > 0 ? (
                  <>
                    Resend in <span className={f.timer}>{formatTime(resendIn)}</span>
                  </>
                ) : (
                  "Resend code"
                )}
              </button>
            </div>
          </div>
        )}

        {step === "password" && (
          <div className={f.step} key="password">
            <div className={f.iconTile} aria-hidden="true">
              <IconLockPassword size={24} stroke={1.8} />
            </div>
            <h1 className={f.title} ref={headingRef} tabIndex={-1}>
              Create a new password
            </h1>
            <p className={f.subtitle}>
              Code verified for <strong>{emailClean}</strong>. Choose a password you don&rsquo;t use anywhere else.
            </p>

            {error && (
              <Alert tone="error">
                {error}{" "}
                <button type="button" className={f.linkBtn} onClick={startOver}>
                  Start again
                </button>
              </Alert>
            )}

            <form onSubmit={onResetSubmit} noValidate>
              {/* Hidden username field helps password managers save the new password to the right account. */}
              <input type="email" value={emailClean} autoComplete="username" readOnly hidden />

              <div className="pp-form-group">
                <label htmlFor="fp-new" className="pp-form-label">
                  New password
                </label>
                <div className="pp-input-container">
                  <input
                    ref={passwordRef}
                    id="fp-new"
                    type={showPw ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    aria-describedby="fp-strength fp-rules"
                  />
                  <EyeButton shown={showPw} onToggle={() => setShowPw((s) => !s)} />
                </div>

                <div className={f.meter} aria-hidden="true">
                  {[1, 2, 3, 4].map((n) => (
                    <span key={n} style={{ background: meter.score >= n ? meter.color : undefined }} />
                  ))}
                </div>
                <div className={f.meterLabel} id="fp-strength" aria-live="polite">
                  <span>Password strength</span>
                  <strong style={{ color: password ? meter.color : undefined }}>{meter.label || "—"}</strong>
                </div>

                <ul className={f.rules} id="fp-rules">
                  {[
                    { ok: checks.length, text: "At least 8 characters" },
                    { ok: checks.mixed, text: "Upper & lowercase" },
                    { ok: checks.number, text: "A number" },
                    { ok: checks.symbol, text: "A symbol" },
                  ].map((r) => (
                    <li key={r.text} className={`${f.rule} ${r.ok ? f.ruleMet : ""}`}>
                      <span className={f.ruleIcon} aria-hidden="true">
                        {r.ok && <IconCheck size={11} stroke={3} />}
                      </span>
                      {r.text}
                      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                        {r.ok ? "(done)" : "(not yet)"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pp-form-group" style={{ marginTop: 14 }}>
                <label htmlFor="fp-confirm" className="pp-form-label">
                  Confirm new password
                </label>
                <div className="pp-input-container">
                  <input
                    id="fp-confirm"
                    type={showPw ? "text" : "password"}
                    placeholder="Type it again"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    className={confirm && !matches && confirm.length >= password.length ? "has-error" : undefined}
                    aria-describedby="fp-match"
                  />
                </div>
                {confirm && (
                  <span
                    id="fp-match"
                    className={`${f.match} ${matches ? f.matchOk : f.matchBad}`}
                    aria-live="polite"
                  >
                    {matches ? <IconCheck size={13} stroke={2.6} /> : <IconX size={13} stroke={2.6} />}
                    {matches ? "Passwords match" : "Passwords don’t match yet"}
                  </span>
                )}
              </div>

              <button type="submit" className="pp-signup-submit-btn" disabled={!canReset} style={{ marginTop: 18 }}>
                {loading ? "Updating password…" : "Reset password"}
              </button>
              <p className={f.hint} style={{ textAlign: "center" }}>
                For your security, you&rsquo;ll be signed out on all other devices.
              </p>
            </form>
          </div>
        )}

        {step === "done" && (
          <div className={`${f.step} ${f.success}`} key="done">
            <div className={f.successBadge} aria-hidden="true">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                <path d="M5 12.5l4.2 4.2L19 7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className={f.title} ref={headingRef} tabIndex={-1}>
              Password updated
            </h1>
            <p className={f.subtitle}>
              Your new password is ready, and you&rsquo;ve been signed out on your other devices. Sign in to pick up where
              you left off.
            </p>
            <Link
              href="/signin"
              className="pp-signup-submit-btn"
              style={{ textDecoration: "none" }}
            >
              Continue to sign in
            </Link>
          </div>
        )}
      </div>

      <div className="pp-signup-footer">2026 ProxiPilot, All right Reserved</div>
    </div>
  );
}
