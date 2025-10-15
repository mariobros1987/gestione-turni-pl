export const parseDateAsUTC = (dateString: string): Date => {
    if (!dateString || typeof dateString !== 'string' || !dateString.includes('-')) {
        return new Date(0); // Ritorna una data non valida o epoch per input errati
    }
    const parts = dateString.split('-');
    if (parts.length !== 3) return new Date(0);
    const [year, month, day] = parts.map(Number);
    // Importante: il mese è 0-indexed in Date.UTC
    return new Date(Date.UTC(year, month - 1, day));
};

export const calculateHours = (date: string, startTime: string, endTime: string): number => {
    if (!date || !startTime || !endTime) return 0;

    // Se gli orari sono identici, la durata è zero. Questo previene un calcolo di 24 ore.
    if (startTime === endTime) {
        return 0;
    }

    const startDateTime = new Date(`${date}T${startTime}`);
    let endDateTime = new Date(`${date}T${endTime}`);

    // Se l'orario di fine è precedente a quello di inizio, si assume che sia il giorno successivo (superamento della mezzanotte)
    if (endDateTime < startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1);
    }

    const diffMs = endDateTime.getTime() - startDateTime.getTime();
    return parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
};