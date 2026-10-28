import type {
  AgentState,
  ConsoleState,
  ControllerState,
  StationSummary,
} from "@/lib/types";
import { ago } from "@/lib/format";

type Tone = "good" | "critical" | "neutral";

// Status is never color alone: each badge has an icon and a label.
const ICON: Record<Tone, string> = { good: "●", critical: "▲", neutral: "○" };

export function Badge({
  tone,
  children,
  title,
}: {
  tone: Tone;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      <span aria-hidden="true">{ICON[tone]}</span> {children}
    </span>
  );
}

const AGENT: Record<AgentState, [Tone, string]> = {
  online: ["good", "Agente en línea"],
  offline: ["critical", "Agente sin conexión"],
  never: ["neutral", "Agente sin datos aún"],
};

const CONSOLE: Record<ConsoleState, [Tone, string]> = {
  online: ["good", "en línea"],
  offline: ["critical", "sin respuesta"],
  unknown: ["neutral", "desconocida"],
};

const CONTROLLER: Record<ControllerState, [Tone, string]> = {
  online: ["good", "en línea"],
  offline: ["critical", "fuera de línea"],
};

/**
 * Agent badge plus one badge per device of the station: its console and/or
 * its VOX controller. has_console and controller are missing from APIs
 * deployed before them: a console, no controller.
 */
export function StationStatus({ s }: { s: StationSummary }) {
  const [tone, label] = AGENT[s.agent.state];
  const [ct, cl] = CONSOLE[s.console.state];
  const controller = s.controller ?? null;
  return (
    <div className="badges">
      <Badge
        tone={tone}
        title={`Último latido: ${ago(s.agent.last_heartbeat_at)}`}
      >
        {label}
      </Badge>
      {s.has_console === false ? null : s.console.id === null ? (
        <Badge tone="neutral" title="La estación no tiene consola asignada">
          Consola sin asignar
        </Badge>
      ) : (
        <Badge
          tone={ct}
          title={
            s.console.state === "unknown"
              ? "El agente no está en línea"
              : undefined
          }
        >
          Consola {cl}
        </Badge>
      )}
      {controller && (
        <Badge
          tone={CONTROLLER[controller.state][0]}
          title={
            s.agent.state !== "online" ? "El agente no está en línea" : undefined
          }
        >
          Controlador {CONTROLLER[controller.state][1]}
        </Badge>
      )}
    </div>
  );
}
