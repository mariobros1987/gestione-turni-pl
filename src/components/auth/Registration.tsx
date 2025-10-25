import React, { useState } from 'react';
import { profileApiService } from '../../services/profileApiService';
import { authService, RegistrationData } from '../../services/authService';

interface RegistrationProps {
    onRegister: (success: boolean, message?: string) => void;
    onSwitchToLogin: () => void;
}

export const Registration: React.FC<RegistrationProps> = ({ onRegister, onSwitchToLogin }) => {
    const [formData, setFormData] = useState<RegistrationData>({
        email: '',
        password: '',
        confirmPassword: '',
        firstName: '',
        lastName: '',
        badgeNumber: '',
        department: '',
        rank: '',
        phoneNumber: ''
    });
    const [errors, setErrors] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Pulisci errori quando l'utente inizia a digitare
        if (errors.length > 0) {
            setErrors([]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrors([]);

        try {
            const result = await authService.register(formData);
            if (result.success) {
                // Dopo la registrazione, forza subito la sincronizzazione del profilo
                try {
                    await profileApiService.syncProfile({ prefer: 'server' });
                } catch (syncErr) {
                    setErrors(["Registrazione riuscita, ma errore nel caricamento del profilo. Riprova dal login."]);
                    onRegister(false, "Registrazione riuscita, ma errore nel caricamento del profilo.");
                    setIsLoading(false);
                    return;
                }
                onRegister(true, result.message);
            } else {
                // Gestione specifica errore 409/email già registrata
                if (result.message && result.message.toLowerCase().includes('email già registrata')) {
                    setErrors(['Questa email è già registrata. Usa un’altra email o accedi.']);
                } else {
                    setErrors([result.message]);
                }
                onRegister(false, result.message);
            }
        } catch (error) {
            const errorMessage = 'Errore durante la registrazione. Riprova.';
            setErrors([errorMessage]);
            onRegister(false, errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-form">
                <h1>Crea un Account</h1>
                <p className="auth-subtitle">Registrazione per Agenti di Polizia Locale</p>
                
                {errors.length > 0 && (
                    <div className="error-message">
                        {errors.map((error, index) => (
                            <p key={index}>{error}</p>
                        ))}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* Informazioni personali */}
                    <div className="form-section">
                        <h3>Informazioni Personali</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="firstName">Nome *</label>
                                <input
                                    type="text"
                                    id="firstName"
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleInputChange}
                                    placeholder="Mario"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="lastName">Cognome *</label>
                                <input
                                    type="text"
                                    id="lastName"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleInputChange}
                                    placeholder="Rossi"
                                    required
                                />
                            </div>
                        </div>
                        
                        <div className="form-group">
                            <label htmlFor="email">Email *</label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                placeholder="mario.rossi@comune.esempio.it"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="phoneNumber">Telefono</label>
                            <input
                                type="tel"
                                id="phoneNumber"
                                name="phoneNumber"
                                value={formData.phoneNumber}
                                onChange={handleInputChange}
                                placeholder="333 123 4567"
                            />
                        </div>
                    </div>

                    {/* Informazioni professionali */}
                    <div className="form-section">
                        <h3>Informazioni Professionali</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="badgeNumber">Matricola *</label>
                                <input
                                    type="text"
                                    id="badgeNumber"
                                    name="badgeNumber"
                                    value={formData.badgeNumber}
                                    onChange={handleInputChange}
                                    placeholder="PL001234"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="rank">Qualifica</label>
                                <select
                                    id="rank"
                                    name="rank"
                                    value={formData.rank}
                                    onChange={handleInputChange}
                                >
                                    <option value="">Seleziona qualifica</option>
                                    <option value="Agente">Agente</option>
                                    <option value="Agente Scelto">Agente Scelto</option>
                                    <option value="Assistente">Assistente</option>
                                    <option value="Assistente Scelto">Assistente Scelto</option>
                                    <option value="Sovrintendente">Sovrintendente</option>
                                    <option value="Sovrintendente Capo">Sovrintendente Capo</option>
                                    <option value="Ispettore">Ispettore</option>
                                    <option value="Ispettore Superiore">Ispettore Superiore</option>
                                    <option value="Commissario">Commissario</option>
                                    <option value="Commissario Capo">Commissario Capo</option>
                                </select>
                            </div>
                        </div>
                        
                        <div className="form-group">
                            <label htmlFor="department">Comando di Appartenenza *</label>
                            <input
                                type="text"
                                id="department"
                                name="department"
                                value={formData.department}
                                onChange={handleInputChange}
                                placeholder="Polizia Locale Comune di..."
                                required
                            />
                        </div>
                    </div>

                    {/* Sicurezza */}
                    <div className="form-section">
                        <h3>Sicurezza</h3>
                        <div className="form-group">
                            <label htmlFor="password">Password *</label>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                placeholder="Almeno 8 caratteri con maiuscole, minuscole, numeri e simboli"
                                required
                                minLength={8}
                            />
                            <small className="password-requirements">
                                La password deve contenere: almeno 8 caratteri, una maiuscola, una minuscola, un numero e un carattere speciale
                            </small>
                        </div>
                        
                        <div className="form-group">
                            <label htmlFor="confirmPassword">Conferma Password *</label>
                            <input
                                type="password"
                                id="confirmPassword"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleInputChange}
                                placeholder="Ripeti la password"
                                required
                                minLength={8}
                            />
                        </div>
                    </div>

                    <button type="submit" disabled={isLoading}>
                        {isLoading ? 'Registrazione in corso...' : 'Crea Account'}
                    </button>
                </form>
                
                <p className="switch-auth">
                    Hai già un account?{' '}
                    <button onClick={onSwitchToLogin} disabled={isLoading}>
                        Accedi
                    </button>
                </p>
            </div>
        </div>
    );
};