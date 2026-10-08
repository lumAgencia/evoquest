import { describe, expect, it } from "vitest";
import {
  caloriesRemaining,
  hasCurrentWeekCheckin,
  measurementDelta,
  parseSetCount,
  selectCurrentWorkout,
  sessionsInCurrentWeek,
  startOfCurrentWeek,
} from "./domain";

const now = new Date("2026-08-13T12:00:00-03:00");
const plan = [{ id: "A" }, { id: "B" }, { id: "C" }];

describe("regras de estabilização do painel", () => {
  it("calcula a segunda-feira como início da semana", () => {
    expect(startOfCurrentWeek(now).getDay()).toBe(1);
    expect(startOfCurrentWeek(now).getDate()).toBe(10);
  });

  it("ignora sessões antigas e datas inválidas", () => {
    const sessions = [
      { completed_at: "2026-08-12T10:00:00-03:00" },
      { completed_at: "2026-08-09T10:00:00-03:00" },
      { completed_at: "inválida" },
    ];
    expect(sessionsInCurrentWeek(sessions, now)).toHaveLength(1);
  });

  it("sempre escolhe um treino existente na prancheta atual", () => {
    const sessions = [{ completed_at: "2026-08-11T10:00:00-03:00" }];
    expect(selectCurrentWorkout(plan, sessions, now)).toEqual({ id: "B" });
    expect(selectCurrentWorkout([], sessions, now)).toBeNull();
  });

  it("não deixa calorias restantes negativas e tolera valores inválidos", () => {
    expect(
      caloriesRemaining(2500, [{ calories: 300 }, { calories: "200" }]),
    ).toEqual({ consumed: 500, remaining: 2000 });
    expect(
      caloriesRemaining(400, [{ calories: 500 }, { calories: "x" }]).remaining,
    ).toBe(0);
  });

  it("aceita somente check-in da semana vigente", () => {
    expect(hasCurrentWeekCheckin({ week_start: "2026-08-10" }, now)).toBe(true);
    expect(hasCurrentWeekCheckin({ week_start: "2026-08-03" }, now)).toBe(
      false,
    );
  });

  it("extrai a quantidade de séries com limites seguros", () => {
    expect(parseSetCount("4 séries × 8–12")).toBe(4);
    expect(parseSetCount("sem definição")).toBe(3);
    expect(parseSetCount("99 séries")).toBe(3);
  });

  it("calcula diferenças corporais sem inventar dados ausentes", () => {
    expect(measurementDelta(80.4, 77.1)).toBe(-3.3);
    expect(measurementDelta(null, 77)).toBeNull();
  });
});
