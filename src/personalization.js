const numberOr = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

export function calculateBmi(data) {
  const weight = numberOr(data.weight, 70);
  const heightM = numberOr(data.height, 170) / 100;
  const value = weight / heightM ** 2;
  const category =
    value < 18.5
      ? "Abaixo do peso"
      : value < 25
        ? "Faixa adequada"
        : value < 30
          ? "Sobrepeso"
          : "Obesidade";
  return { value: +value.toFixed(1), category };
}

export function profileVariant(data, total = 3) {
  const signature = `${data.sex}|${data.age}|${data.height}|${data.weight}|${data.goal}|${data.level}`;
  const hash = [...signature].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    7,
  );
  return hash % Math.max(1, total);
}

export function evaluateWeightGoal(data, now = new Date()) {
  const current = numberOr(data.weight, 70);
  const target = Number(data.targetWeight);
  const targetDate = data.targetDate ? new Date(`${data.targetDate}T12:00:00`) : null;
  if (!Number.isFinite(target) || target <= 0 || !targetDate || Number.isNaN(targetDate.getTime()))
    return { status: "incomplete" };
  const days = Math.ceil((targetDate.getTime() - now.getTime()) / 86400000);
  if (days < 7) return { status: "blocked", reason: "Escolha uma data com pelo menos 7 dias de prazo." };
  const delta = target - current;
  const directionMatches =
    (data.goal === "Ganhar massa" && delta > 0) ||
    (data.goal === "Emagrecer" && delta < 0) ||
    (data.goal === "Recomposição" && Math.abs(delta) <= current * 0.03);
  if (!directionMatches)
    return {
      status: "blocked",
      reason:
        data.goal === "Ganhar massa"
          ? "Para ganhar massa, o peso alvo deve ser maior que o peso atual."
          : data.goal === "Emagrecer"
            ? "Para emagrecer, o peso alvo deve ser menor que o peso atual."
            : "Na recomposição, mantenha o peso alvo próximo ao peso atual.",
    };
  const weeks = days / 7;
  const requestedWeekly = delta / weeks;
  const recommendedRate = data.goal === "Ganhar massa" ? 0.005 : 0.0075;
  const allowedRate = data.goal === "Ganhar massa" ? 0.0075 : 0.01;
  const recommendedWeekly = current * recommendedRate;
  const allowedWeekly = current * allowedRate;
  const absoluteRequested = Math.abs(requestedWeekly);
  const status =
    absoluteRequested <= recommendedWeekly
      ? "recommended"
      : absoluteRequested <= allowedWeekly
        ? "attention"
        : "blocked";
  const plannedWeekly = status === "blocked"
    ? Math.sign(delta) * allowedWeekly
    : requestedWeekly;
  const rawDailyAdjustment = (plannedWeekly * 7700) / 7;
  const dailyAdjustment =
    data.goal === "Ganhar massa"
      ? Math.max(150, Math.min(500, rawDailyAdjustment))
      : data.goal === "Emagrecer"
        ? Math.min(-250, Math.max(-750, rawDailyAdjustment))
        : 0;
  const projectedWeeks = Math.abs(delta) / Math.max(0.01, Math.abs(plannedWeekly));
  const projectedDate = new Date(now.getTime() + projectedWeeks * 7 * 86400000);
  return {
    status,
    current,
    target,
    delta: +delta.toFixed(1),
    days,
    requestedWeekly: +requestedWeekly.toFixed(2),
    plannedWeekly: +plannedWeekly.toFixed(2),
    dailyAdjustment: Math.round(dailyAdjustment),
    feasible: status !== "blocked",
    suggestedDate: projectedDate.toISOString().slice(0, 10),
    requestedPercent: +((absoluteRequested / current) * 100).toFixed(2),
  };
}

function goalPace(data, maintenance, now) {
  const evaluation = evaluateWeightGoal(data, now);
  if (!["recommended", "attention"].includes(evaluation.status)) return null;
  return { ...evaluation, maintenance: Math.round(maintenance) };
}

export function calculateNutritionTargets(data, now = new Date()) {
  const weight = numberOr(data.weight, 70);
  const height = numberOr(data.height, 170);
  const age = numberOr(data.age, 30);
  const sexOffset =
    data.sex === "Masculino" ? 5 : data.sex === "Feminino" ? -161 : -78;
  const bmr = 10 * weight + 6.25 * height - 5 * age + sexOffset;
  const activityFactors = {
    "Pouco ativo": 1.2,
    "Levemente ativo": 1.375,
    "Moderadamente ativo": 1.55,
    "Muito ativo": 1.725,
  };
  const maintenance = bmr * (activityFactors[data.activity] || 1.55);
  const { value: bmi } = calculateBmi(data);
  const pace = goalPace(data, maintenance, now);
  let adjustment = 1;
  if (data.goal === "Emagrecer") adjustment = bmi < 18.5 ? 1 : 0.85;
  if (data.goal === "Ganhar massa")
    adjustment = bmi < 18.5 ? 1.15 : bmi < 25 ? 1.1 : 1.05;
  const minimum = data.sex === "Feminino" ? 1200 : 1500;
  const calculatedCalories = pace
    ? maintenance + pace.dailyAdjustment
    : maintenance * adjustment;
  const calories = Math.max(
    minimum,
    Math.round(calculatedCalories / 50) * 50,
  );
  const proteinFactor =
    data.goal === "Ganhar massa" ? 1.8 : data.goal === "Emagrecer" ? 2 : 1.7;
  const protein = Math.round(weight * proteinFactor);
  const fat = Math.round(weight * (data.goal === "Ganhar massa" ? 0.9 : 0.8));
  const carbs = Math.max(
    80,
    Math.round((calories - protein * 4 - fat * 9) / 4),
  );
  const water = Math.round((weight * 35) / 100) * 100;
  return {
    calories,
    protein,
    fat,
    carbs,
    water,
    bmr: Math.round(bmr),
    maintenance: Math.round(maintenance),
    bmi,
    pace,
  };
}

export function recommendedRecipeServing(data, recipe) {
  const meals = Math.max(3, Math.min(6, Number(data.meals) || 4));
  const mealTarget = calculateNutritionTargets(data).calories / meals;
  const raw = mealTarget / Math.max(1, Number(recipe?.kcal) || 1);
  return Math.max(0.5, Math.min(2, Math.round(raw * 4) / 4));
}
