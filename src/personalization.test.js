import { describe, expect, it } from "vitest";
import {
  calculateBmi,
  calculateNutritionTargets,
  evaluateWeightGoal,
  profileVariant,
  recommendedRecipeServing,
} from "./personalization";

const man = {
  sex: "Masculino",
  age: 25,
  height: 181,
  weight: 70,
  goal: "Ganhar massa",
  activity: "Moderadamente ativo",
  meals: 4,
  level: "Iniciante",
};
const woman = {
  ...man,
  sex: "Feminino",
  height: 163,
  weight: 57,
};

describe("personalização inicial", () => {
  it("calcula o IMC e reconhece que ele é apenas parte do perfil", () => {
    expect(calculateBmi(man)).toEqual({ value: 21.4, category: "Faixa adequada" });
    expect(calculateBmi(woman)).toEqual({ value: 21.5, category: "Faixa adequada" });
  });

  it("gera metas diferentes para pessoas com medidas e sexo diferentes", () => {
    const manTargets = calculateNutritionTargets(man);
    const womanTargets = calculateNutritionTargets(woman);
    expect(manTargets.calories).toBeGreaterThan(womanTargets.calories);
    expect(manTargets.protein).toBeGreaterThan(womanTargets.protein);
    expect(manTargets.calories).not.toBe(womanTargets.calories);
  });

  it("usa peso alvo e prazo para calcular um superávit limitado", () => {
    const targets = calculateNutritionTargets(
      { ...woman, targetWeight: 60, targetDate: "2026-10-14" },
      new Date("2026-08-14T12:00:00"),
    );
    expect(targets.pace.target).toBe(60);
    expect(targets.pace.dailyAdjustment).toBeGreaterThan(0);
    expect(targets.pace.status).toBe("attention");
    expect(targets.pace.dailyAdjustment).toBeLessThanOrEqual(500);
    expect(targets.calories).toBeGreaterThan(targets.maintenance);
  });

  it("sinaliza e limita uma meta de ganho excessivamente rápida", () => {
    const evaluation = evaluateWeightGoal(
      { ...woman, targetWeight: 65, targetDate: "2026-09-14" },
      new Date("2026-08-14T12:00:00"),
    );
    expect(evaluation.status).toBe("blocked");
    expect(evaluation.feasible).toBe(false);
    expect(evaluation.suggestedDate).toBeTruthy();
  });

  it("personaliza a porção da mesma receita", () => {
    const recipe = { kcal: 500 };
    expect(recommendedRecipeServing(man, recipe)).toBeGreaterThanOrEqual(
      recommendedRecipeServing(woman, recipe),
    );
  });

  it("produz variantes estáveis de treino pelo perfil", () => {
    expect(profileVariant(man)).toBe(profileVariant(man));
    expect(profileVariant(man)).not.toBe(profileVariant(woman));
  });
});
