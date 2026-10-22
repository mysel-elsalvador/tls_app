import type { AgentState, ConsoleState, StationSummary } from "@/lib/types";
import { ago } from "@/lib/format";

type Tone = "good" | "critical" | "neutral";

// Status is never color alone: each badge has an icon and a label.
const ICON: Record<Tone, string> = { good: "●", critical: "▲", neutral: "○" };

export function Badge({ tone, children, title }: { tone: Tone; children: React.ReactNode; title?: string }) {
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

/** Agent and console badges of a station (a station is one console). */
export function StationStatus({ s }: { s: StationSummary }) {
  const [tone, label] = AGENT[s.agent.state];
  const [ct, cl] = CONSOLE[s.console.state];
  return (
    <div className="badges">
      <Badge tone={tone} title={`Último latido: ${ago(s.agent.last_heartbeat_at)}`}>
        {label}
      </Badge>
      {s.console.id === null ? (
        <Badge tone="neutral" title="La estación no tiene consola asignada">
          Consola sin asignar
        </Badge>
      ) : (
        <Badge tone={ct} title={s.console.state === "unknown" ? "El agente no está en línea" : undefined}>
          Consola {cl}
        </Badge>
      )}
    </div>
  );
}
