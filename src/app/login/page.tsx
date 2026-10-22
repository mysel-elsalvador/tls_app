"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { confirmSignIn, getCurrentUser, signIn } from "aws-amplify/auth";
import { setupAuth } from "@/lib/auth";

// Users are created by an administrator with a temporary password, so the
// first sign-in asks for a new one (NEW_PASSWORD_REQUIRED).
type Step = "credentials" | "new_password";

export default function Login() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setupAuth();
    getCurrentUser()
      .then(() => router.replace("/"))
      .catch(() => {});
  }, [router]);

  async function next(nextStep: string) {
    if (nextStep === "DONE") router.replace("/");
    else if (nextStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") setStep("new_password");
    else setError(`Paso de inicio de sesión no soportado (${nextStep}). Contacte a soporte.`);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (step === "new_password" && newPassword !== repeat) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      setupAuth();
      const res =
        step === "credentials"
          ? await signIn({ username: email.trim(), password })
          : await confirmSignIn({ challengeResponse: newPassword });
      await next(res.nextStep.signInStep);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="card login-card" onSubmit={submit}>
        <h1>hub</h1>
        <p className="muted">Monitoreo de tanques</p>

        {step === "credentials" ? (
          <>
            <label>
              Correo
              <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          </>
        ) : (
          <>
            <p>Elija una contraseña nueva (mínimo 12 caracteres, con mayúsculas, minúsculas y números).</p>
            <label>
              Contraseña nueva
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <label>
              Repetir contraseña
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
              />
            </label>
          </>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? "Ingresando…" : step === "credentials" ? "Ingresar" : "Guardar e ingresar"}
        </button>
      </form>
    </main>
  );
}

function message(err: unknown): string {
  const name = (err as { name?: string })?.name;
  switch (name) {
    case "NotAuthorizedException":
    case "UserNotFoundException":
      return "Correo o contraseña incorrectos.";
    case "InvalidPasswordException":
      return "La contraseña no cumple los requisitos.";
    case "PasswordResetRequiredException":
      return "Debe restablecer su contraseña. Contacte a soporte.";
    case "LimitExceededException":
    case "TooManyRequestsException":
      return "Demasiados intentos. Espere unos minutos.";
    case "NetworkError":
      return "Sin conexión. Revise su red.";
    default:
      return "No se pudo iniciar sesión. Intente de nuevo.";
  }
}
