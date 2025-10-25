import React, { useState } from 'react';
import { authService, UserData } from '../../services/authService';

interface UserProfileProps {
    onLogout: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ onLogout }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');

    const currentUser = authService.getCurrentUser();

    if (!currentUser) {
        return null;
    }

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (newPassword !== confirmPassword) {
            setMessage('Le nuove password non coincidono');
            return;
        }

        const result = authService.changePassword(currentPassword, newPassword);
        setMessage(result.message);
        
        if (result.success) {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setShowChangePassword(false);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const formatLastLogin = (lastLogin?: string) => {
        if (!lastLogin) return 'Mai';
        const date = new Date(lastLogin);
        return date.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="user-profile-container">
            <button 
                className="user-profile-button"
                onClick={() => setIsOpen(!isOpen)}
                title={`${currentUser.firstName} ${currentUser.lastName}`}
            >
                <span className="user-avatar">
                    {currentUser.firstName.charAt(0)}{currentUser.lastName.charAt(0)}
                </span>
                <span className="user-name">
                    {currentUser.firstName} {currentUser.lastName}
                </span>
                <span className="dropdown-arrow">▼</span>
            </button>

            {isOpen && (
                <div className="user-profile-dropdown">
                    <div className="user-profile-header">
                        <div className="user-avatar-large">
                            {currentUser.firstName.charAt(0)}{currentUser.lastName.charAt(0)}
                        </div>
                        <div className="user-info">
                            <h4>{currentUser.firstName} {currentUser.lastName}</h4>
                            <p className="user-badge">Mat. {currentUser.badgeNumber}</p>
                            <p className="user-rank">{currentUser.rank || 'Agente'}</p>
                            <p className="user-department">{currentUser.department}</p>
                        </div>
                    </div>

                    <div className="user-profile-details">
                        <div className="detail-item">
                            <strong>Email:</strong> {currentUser.email}
                        </div>
                        {currentUser.phoneNumber && (
                            <div className="detail-item">
                                <strong>Telefono:</strong> {currentUser.phoneNumber}
                            </div>
                        )}
                        <div className="detail-item">
                            <strong>Ultimo accesso:</strong> {formatLastLogin(currentUser.lastLogin)}
                        </div>
                        <div className="detail-item">
                            <strong>Registrato il:</strong> {new Date(currentUser.createdAt).toLocaleDateString('it-IT')}
                        </div>
                    </div>

                    {message && (
                        <div className={`profile-message ${message.toLowerCase().includes('errore') ? 'error' : 'success'}`}>
                            {message}
                        </div>
                    )}

                    <div className="user-profile-actions">
                        <button 
                            onClick={() => setShowChangePassword(!showChangePassword)}
                            className="btn-secondary"
                        >
                            🔒 Cambia Password
                        </button>
                        
                        <button 
                            onClick={onLogout}
                            className="btn-logout"
                        >
                            🚪 Esci
                        </button>
                    </div>

                    {showChangePassword && (
                        <form onSubmit={handleChangePassword} className="change-password-form">
                            <h4>Cambia Password</h4>
                            <div className="form-group">
                                <label>Password Corrente:</label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Nuova Password:</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Almeno 8 caratteri con maiuscole, minuscole, numeri e simboli"
                                    required
                                    minLength={8}
                                />
                            </div>
                            <div className="form-group">
                                <label>Conferma Nuova Password:</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    minLength={8}
                                />
                            </div>
                            <div className="change-password-actions">
                                <button type="submit" className="btn-primary">
                                    Cambia Password
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setShowChangePassword(false)}
                                    className="btn-secondary"
                                >
                                    Annulla
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            {/* Overlay per chiudere il dropdown */}
            {isOpen && (
                <div 
                    className="profile-overlay"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
};