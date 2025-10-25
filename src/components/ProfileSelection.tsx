import React, { useState } from 'react';

interface ProfileSelectionProps {
    profiles: string[];
    onSelect: (name: string) => void;
    onCreate: (name: string) => void;
    onDelete: (name: string) => void;
}
export const ProfileSelection: React.FC<ProfileSelectionProps> = ({ profiles, onSelect, onCreate, onDelete }) => {
    const [newName, setNewName] = useState('');

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (newName.trim() && !profiles.includes(newName.trim())) {
            onCreate(newName.trim());
            setNewName('');
        } else {
            alert("Nome profilo non valido o già esistente.");
        }
    };

    return (
        <div className="profile-selection-screen">
            <h1>Seleziona o Crea un Profilo</h1>
            {profiles.length > 0 ? (
                <ul className="profile-list">
                    {profiles.map(name => (
                        <li key={name} className="profile-item">
                            <span>{name}</span>
                            <div className="profile-actions">
                                <button onClick={() => onSelect(name)} className="btn-select-profile">Seleziona</button>
                                <button onClick={() => onDelete(name)} className="btn-delete">🗑️</button>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>Nessun profilo trovato. Creane uno per iniziare.</p>
            )}
            <form onSubmit={handleCreate} className="create-profile-form">
                <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Nome del nuovo profilo"
                    required
                />
                <button type="submit" className="btn-add">Crea ➕</button>
            </form>
        </div>
    );
}