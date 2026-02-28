import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/auth.css';

export default function SignupPage() {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [terms, setTerms] = useState(false);
    const [newsletter, setNewsletter] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [loading, setLoading] = useState(false);
    const [strength, setStrength] = useState({ level: 0, label: 'Password strength', color: '#ef4444', width: '0' });
    const { signup, signInWithProvider } = useAuth();
    const navigate = useNavigate();

    const showMessage = (text, type = 'error') => setMessage({ text, type });

    const checkPasswordStrength = useCallback((pw) => {
        if (!pw) { setStrength({ level: 0, label: 'Password strength', color: '#ef4444', width: '0' }); return; }
        let s = 0;
        if (pw.length >= 8) s++;
        if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
        if (/[0-9]/.test(pw)) s++;
        if (/[^a-zA-Z0-9]/.test(pw)) s++;
        const colors = ['#ef4444', '#f59e0b', '#eab308', '#10b981'];
        const labels = ['Weak', 'Fair', 'Good', 'Strong'];
        const widths = ['25%', '50%', '75%', '100%'];
        setStrength({
            level: s,
            label: labels[s - 1] || 'Very weak',
            color: colors[s - 1] || '#ef4444',
            width: widths[s - 1] || '10%'
        });
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) { showMessage('Passwords do not match'); return; }
        if (password.length < 8) { showMessage('Password must be at least 8 characters'); return; }
        if (!terms) { showMessage('Please accept the Terms of Service'); return; }

        setLoading(true);
        try {
            // Metadata feeds the DB trigger handle_new_user() → profiles table.
            // The trigger reads: raw_user_meta_data->>'first_name', ->>'last_name',
            //                    ->>'full_name', ->>'avatar_url'
            const result = await signup(email, password, {
                first_name: firstName,
                last_name: lastName,
                full_name: `${firstName} ${lastName}`,
            });
            if (!result?.success) {
                showMessage(result?.error || 'Failed to create account. Please try again.');
                return;
            }

            // If email-confirm is disabled in Supabase, we get a session immediately.
            if (result.session) {
                showMessage('Account created! Redirecting...', 'success');
                setTimeout(() => navigate('/dashboard'), 1000);
            } else {
                showMessage(
                    result?.message || 'Account created! Please check your email to verify your account.',
                    'success'
                );
            }
        } catch (error) {
            showMessage(error.message || 'Failed to create account. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleOAuth = async (provider) => {
        try {
            const result = await signInWithProvider(provider);
            if (!result?.success) {
                showMessage(result?.error || `${provider} sign-up failed`);
            }
        } catch (error) {
            showMessage(error.message || `${provider} sign-up failed`);
        }
    };

    const CheckSvg = () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    );

    const UserSvg = () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
    );

    const LockSvg = () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    );

    return (
        <div className="auth-container">
            <div className="auth-branding">
                <div className="branding-content">
                    <Link to="/" className="brand-logo">
                        <div className="logo-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <span>EcoMonitor</span>
                    </Link>
                    <h1>Join EcoMonitor</h1>
                    <p>Create your free account and start monitoring environmental conditions in your area with AI-powered insights.</p>
                    <div className="branding-features">
                        <div className="feature"><CheckSvg /><span>Free forever for personal use</span></div>
                        <div className="feature"><CheckSvg /><span>No credit card required</span></div>
                        <div className="feature"><CheckSvg /><span>Setup in under 2 minutes</span></div>
                    </div>
                </div>
                <div className="branding-footer"><p>&copy; 2026 EcoMonitor. Open Source.</p></div>
            </div>

            <div className="auth-form-container">
                <div className="auth-form-wrapper">
                    <div className="auth-header">
                        <h2>Create your account</h2>
                        <p>Already have an account? <Link to="/login">Sign in</Link></p>
                    </div>

                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="first-name">First name</label>
                                <div className="input-wrapper"><UserSvg /><input type="text" id="first-name" placeholder="John" required value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="last-name">Last name</label>
                                <div className="input-wrapper"><UserSvg /><input type="text" id="last-name" placeholder="Doe" required value={lastName} onChange={e => setLastName(e.target.value)} /></div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">Email address</label>
                            <div className="input-wrapper">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                                </svg>
                                <input type="email" id="email" placeholder="you@example.com" required value={email} onChange={e => setEmail(e.target.value)} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <div className="input-wrapper">
                                <LockSvg />
                                <input type={showPassword ? 'text' : 'password'} id="password" placeholder="Min. 8 characters" required minLength={8}
                                    value={password} onChange={e => { setPassword(e.target.value); checkPasswordStrength(e.target.value); }} />
                                <button type="button" className="toggle-password" onClick={() => setShowPassword(v => !v)}>
                                    {!showPassword ? (
                                        <svg className="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                                        </svg>
                                    ) : (
                                        <svg className="eye-off-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                            <div className="password-strength" id="password-strength">
                                <div className="strength-bar"><span style={{ width: strength.width, backgroundColor: strength.color }}></span></div>
                                <span className="strength-text">{strength.label}</span>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirm-password">Confirm password</label>
                            <div className="input-wrapper">
                                <LockSvg />
                                <input type="password" id="confirm-password" placeholder="Confirm your password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                            </div>
                        </div>

                        <div className="form-group checkbox-group">
                            <label className="checkbox-label">
                                <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} required />
                                <span className="checkmark"></span>
                                <span>I agree to the <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a></span>
                            </label>
                        </div>

                        <div className="form-group checkbox-group">
                            <label className="checkbox-label">
                                <input type="checkbox" checked={newsletter} onChange={e => setNewsletter(e.target.checked)} />
                                <span className="checkmark"></span>
                                <span>Send me environmental alerts and product updates</span>
                            </label>
                        </div>

                        <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                            <span>{loading ? 'Creating account...' : 'Create account'}</span>
                            {!loading && (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                                </svg>
                            )}
                        </button>

                        {message.text && <div className={`form-message ${message.type}`} style={{ display: 'block' }}>{message.text}</div>}
                    </form>

                    <div className="divider"><span>or sign up with</span></div>

                    <div className="social-auth">
                        <button type="button" className="btn btn-social" onClick={() => handleOAuth('google')}>
                            <svg viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            <span>Google</span>
                        </button>
                        <button type="button" className="btn btn-social" onClick={() => handleOAuth('github')}>
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                            <span>GitHub</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
