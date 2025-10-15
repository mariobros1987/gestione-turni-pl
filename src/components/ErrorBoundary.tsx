import React from 'react';

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('💥 CRASH RILEVATO:', error, errorInfo);
        console.error('💥 Stack trace:', error.stack);
        console.error('💥 Component stack:', errorInfo.componentStack);
        
        // Aggiungi info sul dispositivo
        console.error('💥 User agent:', navigator.userAgent);
        console.error('💥 Platform:', navigator.platform);
        console.error('💥 Screen:', window.screen.width + 'x' + window.screen.height);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ 
                    padding: '20px', 
                    textAlign: 'center',
                    backgroundColor: '#fff',
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <h1 style={{ color: '#e74c3c' }}>❌ Errore applicazione</h1>
                    <p style={{ marginBottom: '20px' }}>
                        L'app ha riscontrato un errore sui dispositivi mobili. 
                        Controlla la console per i dettagli.
                    </p>
                    <button 
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#3498db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        🔄 Ricarica pagina
                    </button>
                    <details style={{ 
                        marginTop: '20px', 
                        textAlign: 'left',
                        maxWidth: '90%',
                        padding: '10px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '5px'
                    }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                            Dettagli errore (per debug)
                        </summary>
                        <pre style={{ 
                            fontSize: '12px', 
                            overflow: 'auto',
                            maxHeight: '200px',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {this.state.error?.toString()}<br/>
                            {this.state.error?.stack}
                        </pre>
                    </details>
                </div>
            );
        }
        
        return this.props.children;
    }
}