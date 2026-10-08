export function startOfCurrentWeek(now = new Date()) {
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function sessionsInCurrentWeek(sessions = [], now = new Date()) {
  const start = startOfCurrentWeek(now);
  return sessions.filter((session) => {
    const completed = new Date(session.completed_at);
    return !Number.isNaN(completed.getTime()) && completed >= start;
  });
}

export function selectCurrentWorkout(
  plan = [],
  sessions = [],
  now = new Date(),
) {
  if (!Array.isArray(plan) || !plan.length) return null;
  const completed = sessionsInCurrentWeek(sessions, now).length;
  return plan[completed % plan.length] || plan[0];
}

export function caloriesRemaining(target, foodLogs = []) {
  const consumed = Math.round(
    foodLogs.reduce((total, item) => total + (Number(item.calories) || 0), 0),
  );
  return {
    consumed,
    remaining: Math.max(0, Math.round(Number(target) || 0) - consumed),
  };
}

export function hasCurrentWeekCheckin(checkin, now = new Date()) {
  if (!checkin?.week_start) return false;
  const date = new Date(`${checkin.week_start}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date >= startOfCurrentWeek(now);
}

export function parseSetCount(detail, fallback = 3) {
  const count = Number(String(detail || "").match(/\d+/)?.[0]);
  return Number.isFinite(count) && count > 0 && count <= 20 ? count : fallback;
}

export function measurementDelta(before, after) {
  if (before == null || after == null || before === "" || after === "")
    return null;
  const delta = Number(after) - Number(before);
  return Number.isFinite(delta) ? +delta.toFixed(1) : null;
}
