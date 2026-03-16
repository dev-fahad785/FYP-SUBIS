import { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const TOKEN_KEY = 'auth_token';
const EMAIL_KEY = 'auth_email';

function App() {
  const [step, setStep] = useState('register');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [currentUserEmail, setCurrentUserEmail] = useState('');

  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'STUDENT',
  });

  const [otpForm, setOtpForm] = useState({
    email: '',
    otp: '',
  });

  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedEmail = localStorage.getItem(EMAIL_KEY);
    if (storedToken) {
      setAuthToken(storedToken);
      setCurrentUserEmail(storedEmail || '');
      setStep('home');
    }
  }, []);

  const setStepAndClear = (nextStep) => {
    setStep(nextStep);
    setMessage('');
    setError('');
  };

  const canSubmitRegister = useMemo(() => {
    const { name, email, password } = registerForm;
    return Boolean(name && email && password.length >= 6);
  }, [registerForm]);

  const canSubmitOtp = useMemo(() => {
    const { email, otp } = otpForm;
    return Boolean(email && otp.length === 6);
  }, [otpForm]);

  const canSubmitLogin = useMemo(() => {
    const { email, password } = loginForm;
    return Boolean(email && password.length >= 6);
  }, [loginForm]);

  const handleRegister = async (event) => {
    event.preventDefault();
    if (!canSubmitRegister) return;
    setIsSubmitting(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }
      setMessage(data.message || 'OTP sent to your email.');
      setOtpForm((prev) => ({ ...prev, email: registerForm.email }));
      setStep('otp');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    if (!canSubmitOtp) return;
    setIsSubmitting(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(otpForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'OTP verification failed');
      }
      setMessage(data.message || 'Account verified successfully. Please log in.');
      setLoginForm((prev) => ({ ...prev, email: otpForm.email }));
      setStep('login');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    if (!canSubmitLogin) return;
    setIsSubmitting(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }
      setAuthToken(data.access_token);
      setCurrentUserEmail(loginForm.email);
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(EMAIL_KEY, loginForm.email);
      setMessage('Logged in successfully.');
      setStep('home');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    setAuthToken('');
    setCurrentUserEmail('');
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    setStepAndClear('login');
  };

  const title = {
    register: 'Create your account',
    otp: 'Verify your email',
    login: 'Welcome back',
    home: 'Home',
  }[step];

  const lede = {
    register:
      'Sign up to access the student bus information system. We will email you a 6-digit code to verify your account.',
    otp: 'Enter the 6-digit code we sent to your email. Codes expire in 5 minutes.',
    login: 'Use your verified email to sign in.',
    home: 'You are signed in. Explore the app or log out.',
  }[step];

  return (
    <div className="page">
      <div className="glass">
        <header className="header">
          <p className="eyebrow">SUBIS · Authentication</p>
          <h1>{title}</h1>
          <p className="lede">{lede}</p>
        </header>

        {message && <div className="banner success">{message}</div>}
        {error && <div className="banner error">{error}</div>}

        {step === 'register' && (
          <form className="form" onSubmit={handleRegister}>
            <label className="field">
              <span>Name</span>
              <input
                type="text"
                name="name"
                placeholder="Jane Doe"
                value={registerForm.name}
                onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                required
              />
            </label>

            <label className="field">
              <span>Email</span>
              <input
                type="email"
                name="email"
                placeholder="you@university.edu"
                value={registerForm.email}
                onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                required
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                type="password"
                name="password"
                placeholder="At least 6 characters"
                value={registerForm.password}
                onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                minLength={6}
                required
              />
            </label>

            <label className="field">
              <span>Role</span>
              <select
                name="role"
                value={registerForm.role}
                onChange={(e) => setRegisterForm({ ...registerForm, role: e.target.value })}
              >
                <option value="STUDENT">Student</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>

            <button className="primary" type="submit" disabled={!canSubmitRegister || isSubmitting}>
              {isSubmitting ? 'Sending OTP…' : 'Send OTP'}
            </button>

            <p className="muted">
              Already verified?{' '}
              <button type="button" className="link" onClick={() => setStepAndClear('login')}>
                Go to login
              </button>
            </p>

            <button
              type="button"
              className="ghost"
              onClick={() => setStepAndClear('login')}
              style={{ marginTop: '4px' }}
            >
              Go to login
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form className="form" onSubmit={handleVerifyOtp}>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                name="email"
                placeholder="you@university.edu"
                value={otpForm.email}
                onChange={(e) => setOtpForm({ ...otpForm, email: e.target.value })}
                required
              />
            </label>

            <label className="field">
              <span>6-digit code</span>
              <input
                type="text"
                name="otp"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="123456"
                value={otpForm.otp}
                onChange={(e) => setOtpForm({ ...otpForm, otp: e.target.value.replace(/\D/g, '') })}
                required
              />
            </label>

            <div className="actions">
              <button className="ghost" type="button" onClick={() => setStep('register')}>
                Change email
              </button>
              <button className="primary" type="submit" disabled={!canSubmitOtp || isSubmitting}>
                {isSubmitting ? 'Verifying…' : 'Verify OTP'}
              </button>
            </div>
          </form>
        )}

        {step === 'login' && (
          <form className="form" onSubmit={handleLogin}>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                name="email"
                placeholder="you@university.edu"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                required
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                type="password"
                name="password"
                placeholder="Your password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                minLength={6}
                required
              />
            </label>

            <button className="primary" type="submit" disabled={!canSubmitLogin || isSubmitting}>
              {isSubmitting ? 'Logging in…' : 'Log in'}
            </button>

            <p className="muted">
              Need an account?{' '}
              <button type="button" className="link" onClick={() => setStepAndClear('register')}>
                Sign up
              </button>
            </p>
          </form>
        )}

        {step === 'home' && (
          <div className="home-card">
            <div className="pill">Signed in</div>
            <h2>Welcome{currentUserEmail ? `, ${currentUserEmail}` : ''}!</h2>
            <p className="lede">You are authenticated. Continue to the app or sign out.</p>
            <div className="actions">
              <button className="ghost" type="button" onClick={() => setStepAndClear('login')}>
                Switch account
              </button>
              <button className="primary" type="button" onClick={handleLogout}>
                Log out
              </button>
            </div>
            {authToken && (
              <p className="token-note">Token stored in memory for this session.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
