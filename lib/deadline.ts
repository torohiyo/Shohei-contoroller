export function slotToTime(slot: number): string {
  if (slot >= 48) return "24:00";
  const h = Math.floor(slot / 2);
  const m = slot % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
}

export function timeToSlot(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 2 + (m >= 30 ? 1 : 0);
}

// Parse shorthand: "2dl" = 2 days later, "1wl" = 1 week later, "1ml" = 1 month later, "1yl" = 1 year later
// Parse MMDD: "0504" = May 4th current year
export function parseDateInput(input: string): Date | null {
  const s = input.trim();

  const shorthand = s.match(/^(\d+)(d|w|m|y)l$/i);
  if (shorthand) {
    const n = parseInt(shorthand[1]);
    const unit = shorthand[2].toLowerCase();
    const d = new Date();
    if (unit === "d") d.setDate(d.getDate() + n);
    else if (unit === "w") d.setDate(d.getDate() + n * 7);
    else if (unit === "m") d.setMonth(d.getMonth() + n);
    else if (unit === "y") d.setFullYear(d.getFullYear() + n);
    return d;
  }

  const mmdd = s.match(/^(\d{2})(\d{2})$/);
  if (mmdd) {
    const month = parseInt(mmdd[1]) - 1;
    const day = parseInt(mmdd[2]);
    const d = new Date();
    d.setMonth(month, day);
    return d;
  }

  return null;
}

export function formatDateLabel(date: Date): string {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return "今日";
  if (date.toDateString() === tomorrow.toDateString()) return "明日";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function buildDeadlineISO(date: Date, slot: number): string {
  const d = new Date(date);
  if (slot >= 48) {
    d.setHours(23, 59, 59, 0);
  } else {
    const h = Math.floor(slot / 2);
    const m = slot % 2 === 0 ? 0 : 30;
    d.setHours(h, m, 0, 0);
  }
  return d.toISOString();
}
