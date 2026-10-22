import { alarmLabel, alarmSubject, ago, consoleTime } from "@/lib/format";
import type { Alarm } from "@/lib/types";
import { Badge } from "./Status";

export function AlarmTable({ alarms }: { alarms: Alarm[] }) {
  if (alarms.length === 0) {
    return (
      <p>
        <Badge tone="good">Sin alarmas activas</Badge>
      </p>
    );
  }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Alarma</th>
            <th>Sobre</th>
            <th>Desde (hora consola)</th>
            <th>Vista por primera vez</th>
          </tr>
        </thead>
        <tbody>
          {alarms.map((a, i) => {
            const l = alarmLabel(a);
            return (
              <tr key={`${a.category}-${a.type}-${a.number}-${a.alarm_time}-${i}`}>
                <td>
                  <Badge tone="critical">{l.text}</Badge>
                  {!l.documented && <span className="muted small"> (sin documentar)</span>}
                </td>
                <td>{alarmSubject(a)}</td>
                <td className="num">{consoleTime(a.alarm_time)}</td>
                <td>{ago(a.first_seen_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
