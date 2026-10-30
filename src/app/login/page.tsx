"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { confirmResetPassword, confirmSignIn, getCurrentUser, resetPassword, signIn } from "aws-amplify/auth";
import { setupAuth } from "@/lib/auth";

// Users are created by an administrator with a temporary password, so the
// first sign-in asks for a new one (NEW_PASSWORD_REQUIRED). A forgotten
// password is reset with a code Cognito emails to the (verified) address.
type Step = "credentials" | "new_password" | "forgot" | "reset";

const RULES = "mínimo 12 caracteres, con mayúsculas, minúsculas y números";

export default function Login() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  // Where the code went, as Cognito masks it (e.g. "g***@g***").
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setupAuth();
    getCurrentUser()
      .then(() => router.replace("/"))
      .catch(() => {});
  }, [router]);

  function go(s: Step) {
    setStep(s);
    setError(null);
    setInfo(null);
    setCode("");
    setNewPassword("");
    setRepeat("");
  }

  async function next(nextStep: string) {
    if (nextStep === "DONE") router.replace("/");
    else if (nextStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") setStep("new_password");
    else setError(`Paso de inicio de sesión no soportado (${nextStep}). Contacte a soporte.`);
  }

  /** Asks Cognito to email a code. Unknown addresses get the same answer (no user enumeration). */
  async function sendCode() {
    const res = await resetPassword({ username: email.trim() });
    if (res.nextStep.resetPasswordStep === "DONE") {
      go("credentials");
      setInfo("Contraseña restablecida. Ingrese con la nueva.");
      return;
    }
    setSentTo(res.nextStep.codeDeliveryDetails?.destination ?? null);
    go("reset");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if ((step === "new_password" || step === "reset") && newPassword !== repeat) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      setupAuth();
      if (step === "forgot") {
        await sendCode();
      } else if (step === "reset") {
        const username = email.trim();
        await confirmResetPassword({ username, confirmationCode: code.trim(), newPassword });
        const res = await signIn({ username, password: newPassword });
        await next(res.nextStep.signInStep);
      } else {
        const res =
          step === "credentials"
            ? await signIn({ username: email.trim(), password })
            : await confirmSignIn({ challengeResponse: newPassword });
        await next(res.nextStep.signInStep);
      }
    } catch (err) {
      // An administrator forced a reset: same flow as a forgotten password.
      if (step === "credentials" && (err as { name?: string })?.name === "PasswordResetRequiredException") {
        go("forgot");
        setInfo("Debe restablecer su contraseña. Le enviaremos un código a su correo.");
      } else {
        setError(message(err, step));
      }
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      setupAuth();
      await sendCode();
      setInfo("Le enviamos un código nuevo.");
    } catch (err) {
      setError(message(err, "forgot"));
    } finally {
      setBusy(false);
    }
  }

  const newPasswordFields = (
    <>
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
  );
  const emailField = (
    <label>
      Correo
      <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
    </label>
  );
  const back = (
    <button type="button" className="link-button" onClick={() => go("credentials")} disabled={busy}>
      Volver a iniciar sesión
    </button>
  );

  return (
    <main className="login">
      <form className="card login-card" onSubmit={submit}>
        <h1>hub</h1>
        <p className="muted">Monitoreo de tanques</p>

        {step === "credentials" && (
          <>
            {emailField}
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
        )}
        {step === "new_password" && (
          <>
            <p>Elija una contraseña nueva ({RULES}).</p>
            {newPasswordFields}
          </>
        )}
        {step === "forgot" && (
          <>
            <p>Escriba su correo y le enviaremos un código para elegir una contraseña nueva.</p>
            {emailField}
          </>
        )}
        {step === "reset" && (
          <>
            <p>
              Si el correo está registrado, le enviamos un código{sentTo ? ` a ${sentTo}` : ""}. Escríbalo y elija una
              contraseña nueva ({RULES}).
            </p>
            <label>
              Código
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            {newPasswordFields}
          </>
        )}

        {info && (
          <p className="muted" role="status">
            {info}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? "Procesando…" : LABEL[step]}
        </button>

        {step === "credentials" && (
          <button type="button" className="link-button" onClick={() => go("forgot")} disabled={busy}>
            ¿Olvidó su contraseña?
          </button>
        )}
        {step === "forgot" && back}
        {step === "reset" && (
          <>
            <button type="button" className="link-button" onClick={resend} disabled={busy}>
              Reenviar código
            </button>
            {back}
          </>
        )}
      </form>
    </main>
  );
}

const LABEL: Record<Step, string> = {
  credentials: "Ingresar",
  new_password: "Guardar e ingresar",
  forgot: "Enviar código",
  reset: "Cambiar contraseña e ingresar",
};

function message(err: unknown, step: Step): string {
  const name = (err as { name?: string })?.name;
  switch (name) {
    case "NotAuthorizedException":
    case "UserNotFoundException":
      // Reset of a user who never signed in (still on the temporary password).
      if (step === "forgot" || step === "reset")
        return "No se puede restablecer la contraseña de esta cuenta. Ingrese con la contraseña temporal que recibió o contacte a soporte.";
      return "Correo o contraseña incorrectos.";
    case "CodeMismatchException":
      return "El código no es correcto.";
    case "ExpiredCodeException":
      return "El código expiró. Pida uno nuevo.";
    case "InvalidPasswordException":
      return "La contraseña no cumple los requisitos.";
    case "InvalidParameterException":
      return step === "forgot"
        ? "Esta cuenta no tiene un correo verificado. Contacte a soporte."
        : "Datos inválidos. Revise e intente de nuevo.";
    case "LimitExceededException":
    case "TooManyRequestsException":
    case "TooManyFailedAttemptsException":
      return "Demasiados intentos. Espere unos minutos.";
    case "NetworkError":
      return "Sin conexión. Revise su red.";
    default:
      return step === "forgot" || step === "reset"
        ? "No se pudo restablecer la contraseña. Intente de nuevo."
        : "No se pudo iniciar sesión. Intente de nuevo.";
  }
}
