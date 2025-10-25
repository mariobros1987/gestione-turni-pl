import React, { useState } from 'react';
import { authService, LoginCredentials } from '../../services/authService';
import { authService as apiAuthService } from '../../services/apiAuthService';
import { SimpleDebug } from '../SimpleDebug';

interface LoginProps {
    onLogin: (success: boolean, message?: string) => void;
    onSwitchToRegister: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, onSwitchToRegister }) => {
    const [credentials, setCredentials] = useState<LoginCredentials>({
        email: '',
        password: ''
    });
    const [errors, setErrors] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    
    // Stati per il debug
    const [debugInfo, setDebugInfo] = useState<any>(null);
    const [debugLoading, setDebugLoading] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setCredentials(prev => ({
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
            const result = await authService.login(credentials);
            
            if (result.success) {
                onLogin(true, result.message);
            } else {
                setErrors([result.message]);
                onLogin(false, result.message);
            }
        } catch (error) {
            const errorMessage = 'Errore durante il login. Riprova.';
            setErrors([errorMessage]);
            onLogin(false, errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = () => {
        if (!credentials.email.trim()) {
            setErrors(['Inserisci la tua email per il recupero password.']);
            return;
        }

        // Simulazione invio email di recupero
        alert(`Email di recupero password inviata a: ${credentials.email}`);
        setShowForgotPassword(false);
    };

    const handleTestSystem = async () => {
        setDebugLoading(true);
        try {
            console.log('🔍 Avvio test sistema...');
            
            // Test 1: Health check
            const health = await apiAuthService.checkDatabaseStatus();
            console.log('Health check:', health);
            
            // Test 2: Lista utenti
            let users: { success: boolean; users?: any[]; message: string } = { success: false, users: [], message: '' };
            try {
                users = await apiAuthService.getAllUsers();
                console.log('Lista utenti:', users);
            } catch (err) {
                users = { success: false, users: [], message: 'Endpoint debug non disponibile' };
                console.warn('Endpoint debug non disponibile');
            }
            
            // Test 3: Utente corrente
            const currentUser = apiAuthService.getCurrentUser();
            console.log('Utente corrente:', currentUser);
            
            setDebugInfo({
                health,
                users,
                currentUser,
                timestamp: new Date().toLocaleString()
            });
        } catch (error) {
            console.error('Errore durante i test:', error);
            setDebugInfo({
                error: error instanceof Error ? error.message : 'Errore sconosciuto',
                timestamp: new Date().toLocaleString()
            });
        } finally {
            setDebugLoading(false);
        }
    };

    const handleTestRegistration = async () => {
        setDebugLoading(true);
        try {
            const testUser = {
                email: `test.${Date.now()}@polizialocale.it`,
                password: 'TestPass123!',
                confirmPassword: 'TestPass123!',
                firstName: 'Mario',
                lastName: 'Test',
                badgeNumber: `TEST${Date.now()}`,
                department: 'Test Department',
                rank: 'Test Rank'
            };

            console.log('🧪 Test registrazione con:', testUser);
            const result = await apiAuthService.register(testUser);
            console.log('Risultato registrazione:', result);
            
            // Dopo la registrazione, aggiorna la lista utenti
            await handleTestSystem();
        } catch (error) {
            console.error('Errore test registrazione:', error);
            setDebugInfo({
                error: error instanceof Error ? error.message : 'Errore test registrazione',
                timestamp: new Date().toLocaleString()
            });
        } finally {
            setDebugLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-form">
                <h1>Accedi</h1>
                <p className="auth-subtitle">Gestione Turni P.L.</p>
                
                {errors.length > 0 && (
                    <div className="error-message">
                        {errors.map((error, index) => (
                            <p key={index}>{error}</p>
                        ))}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={credentials.email}
                            onChange={handleInputChange}
                            placeholder="mario.rossi@comune.esempio.it"
                            required
                            disabled={isLoading}
                        />
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={credentials.password}
                            onChange={handleInputChange}
                            placeholder="••••••••"
                            required
                            disabled={isLoading}
                        />
                    </div>
                    
                    <div className="form-actions">
                        <button 
                            type="button" 
                            className="forgot-password-btn"
                            onClick={() => setShowForgotPassword(!showForgotPassword)}
                            disabled={isLoading}
                        >
                            Password dimenticata?
                        </button>
                    </div>

                    {showForgotPassword && (
                        <div className="forgot-password-section">
                            <p>Inserisci la tua email per ricevere le istruzioni di recupero password.</p>
                            <button 
                                type="button" 
                                onClick={handleForgotPassword}
                                className="btn-secondary"
                                disabled={isLoading}
                            >
                                Invia Email di Recupero
                            </button>
                        </div>
                    )}

                    <button type="submit" disabled={isLoading}>
                        {isLoading ? 'Accesso in corso...' : 'Accedi'}
                    </button>
                </form>
                
                <p className="switch-auth">
                    Non hai un account?{' '}
                    <button onClick={onSwitchToRegister} disabled={isLoading}>
                        Registrati
                    </button>
                </p>

                {/* Informazioni demo */}
                <div className="demo-info">
                    <h4>🚀 Demo Account</h4>
                    <p>Per testare l'app, puoi:</p>
                    <ul>
                        <li>Registrare un nuovo account</li>
                        <li>Usare le credenziali di test:</li>
                        <li><strong>Email:</strong> test@polizialocale.it</li>
                        <li><strong>Password:</strong> 123456</li>
                    </ul>
                    
                    {/* Test Database */}
                    <SimpleDebug 
                        onTestSystem={handleTestSystem}
                        onTestRegistration={handleTestRegistration}
                        loading={debugLoading}
                        debugInfo={debugInfo}
                    />
                    
                    {/* Debug localStorage (legacy) */}
                    <div style={{ marginTop: '1rem', padding: '0.5rem', backgroundColor: '#f0f0f0', fontSize: '0.8rem' }}>
                        <button 
                            type="button"
                            onClick={() => authService.debugUsers()}
                            style={{ marginRight: '0.5rem', fontSize: '0.7rem' }}
                        >
                            🔍 Debug localStorage
                        </button>
                        <button 
                            type="button"
                            onClick={() => authService.testPasswordHash('123456')}
                            style={{ marginRight: '0.5rem', fontSize: '0.7rem' }}
                        >
                            🔑 Test Hash
                        </button>
                        <button 
                            type="button"
                            onClick={() => authService.createTestUser()}
                            style={{ fontSize: '0.7rem' }}
                        >
                            👤 Crea Utente localStorage
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};