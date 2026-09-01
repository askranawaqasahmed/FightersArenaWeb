export function addMinutes(date: Date, minutes: number) { return new Date(date.getTime() + minutes * 60_000); }
export function addDays(date: Date, days: number) { return new Date(date.getTime() + days * 86_400_000); }
