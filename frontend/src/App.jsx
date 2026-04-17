import { useEffect, useMemo, useState } from 'react';
import AdminDashboard from './components/AdminDashboard';
import LiveMap from './components/LiveMap';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const TOKEN_KEY = 'auth_token';
const EMAIL_KEY = 'auth_email';
const NAME_KEY = 'auth_name';
const ROLE_KEY = 'auth_role';

function App() {
  const [step, setStep] = useState('register');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState('');

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
    const storedName = localStorage.getItem(NAME_KEY);
    const storedRole = localStorage.getItem(ROLE_KEY);

    if (storedToken) {
      setAuthToken(storedToken);
      setCurrentUserEmail(storedEmail || '');
      setCurrentUserName(storedName || '');
      setCurrentUserRole(storedRole || '');
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
      localStorage.setItem(NAME_KEY, registerForm.name);
      setCurrentUserName(registerForm.name);
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

      const nextName = data.name || currentUserName || loginForm.email.split('@')[0];
      const nextEmail = data.email || loginForm.email;
      const nextRole = data.role || 'STUDENT';

      setAuthToken(data.access_token);
      setCurrentUserEmail(nextEmail);
      setCurrentUserName(nextName);
      setCurrentUserRole(nextRole);

      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(EMAIL_KEY, nextEmail);
      localStorage.setItem(NAME_KEY, nextName);
      localStorage.setItem(ROLE_KEY, nextRole);

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
    setCurrentUserName('');
    setCurrentUserRole('');
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(NAME_KEY);
    localStorage.removeItem(ROLE_KEY);
    setStepAndClear('login');
  };

  const title = {
    register: 'Create your account',
    otp: 'Verify your email',
    login: 'Welcome back',
    home: currentUserRole === 'ADMIN' ? 'Admin Dashboard' : 'Home',
  }[step];

  const lede = {
    register:
      'Sign up to access the student bus information system. We will email you a 6-digit code to verify your account.',
    otp: 'Enter the 6-digit code we sent to your email. Codes expire in 5 minutes.',
    login: 'Use your verified email to sign in.',
    home:
      currentUserRole === 'ADMIN'
        ? 'Oversee real-time bus operations, telemetry, and route data.'
        : 'You are signed in. Explore the live student map or log out.',
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

        {step === 'home' &&
          (currentUserRole === 'ADMIN' ? (
            <AdminDashboard
              authToken={authToken}
              currentUserName={currentUserName}
              onLogout={handleLogout}
            />
          ) : (
            <div className="home-layout">
              <div className="home-header">
                <div>
                  <div className="pill">Live Map</div>
                  <h2>Welcome{currentUserEmail ? `, ${currentUserEmail}` : ''}!</h2>
                </div>
                <button className="ghost" type="button" onClick={handleLogout}>
                  Log out
                </button>
              </div>

              <div className="map-container">
                <LiveMap userName={currentUserName || currentUserEmail.split('@')[0] || 'Student'} />
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

export default App;
