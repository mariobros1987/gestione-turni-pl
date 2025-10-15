import React from 'react';

const filterOptions = [
    { key: 'ferie', label: 'Ferie' },
    { key: 'permessi', label: 'Permessi' },
    { key: 'straordinario', label: 'Straordinario' },
    { key: 'reperibilita', label: 'Reperibilità' },
    { key: 'progetto', label: 'Progetto' },
    { key: 'appuntamento', label: 'Appuntamenti' },
    { key: 'shifts', label: 'Turni' }
];

interface CalendarFiltersProps {
    filters: Record<string, boolean>;
    setFilters: (filters: Record<string, boolean>) => void;
}

export const CalendarFilters: React.FC<CalendarFiltersProps> = ({ filters, setFilters }) => {
    const handleFilterChange = (key: string) => {
        setFilters({ ...filters, [key]: !filters[key] });
    };

    return (
        <div className="calendar-filters">
            {filterOptions.map(option => (
                <button
                    key={option.key}
                    onClick={() => handleFilterChange(option.key)}
                    className={`filter-btn ${option.key} ${filters[option.key] ? 'active' : ''}`}
                    aria-pressed={filters[option.key]}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
};