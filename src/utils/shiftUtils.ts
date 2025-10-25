import { Shift } from "../types/types";

export const parseShiftPattern = (pattern: string): Shift[] => {
    if (!pattern) return [];
    return pattern
        .split('\n')
        .map(line => line.trim())
        .filter(line => line)
        .map(line => {
            const [dayOfWeek, name, start, end] = line.split(',');
            return { dayOfWeek: dayOfWeek?.trim(), name: name?.trim() || 'N/D', start: start?.trim(), end: end?.trim() };
        });
};