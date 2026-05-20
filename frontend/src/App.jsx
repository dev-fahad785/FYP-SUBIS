import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import AdminDashboard from './components/AdminDashboard';
// import LiveMap from './components/LiveMap';
import LiveMap from './components/LiveMap-refactored';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const TOKEN_KEY = 'auth_token';
const USER_ID_KEY = 'auth_user_id';
const EMAIL_KEY = 'auth_email';
const NAME_KEY = 'auth_name';
const ROLE_KEY = 'auth_role';

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = window.atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function App() {
  const [step, setStep] = useState('register');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
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
    const storedUserId = localStorage.getItem(USER_ID_KEY);
    const storedEmail = localStorage.getItem(EMAIL_KEY);
    const storedName = localStorage.getItem(NAME_KEY);
    const storedRole = localStorage.getItem(ROLE_KEY);

    if (storedToken) {
      const decoded = decodeJwtPayload(storedToken);
      setAuthToken(storedToken);
      setCurrentUserId(storedUserId || decoded?.sub || '');
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
      const nextUserId = data.userId || decodeJwtPayload(data.access_token)?.sub || '';

      setAuthToken(data.access_token);
      setCurrentUserId(nextUserId);
      setCurrentUserEmail(nextEmail);
      setCurrentUserName(nextName);
      setCurrentUserRole(nextRole);

      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_ID_KEY, nextUserId);
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
    setCurrentUserId('');
    setCurrentUserEmail('');
    setCurrentUserName('');
    setCurrentUserRole('');
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
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

  const isAuthStep = step !== 'home';

  if (!isAuthStep && currentUserRole !== 'ADMIN') {
    return (
      <LiveMap
        userId={currentUserId}
        userName={currentUserName || currentUserEmail.split('@')[0] || 'Student'}
        onLogout={handleLogout}
      />
    );
  }

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

  const authHighlights = [
    {
      label: 'Secure access',
      value: 'Email + OTP',
      detail: 'Verification keeps student and admin accounts tied to the university address you use.',
    },
    {
      label: 'Fast setup',
      value: '6-digit code',
      detail: 'Registration stays lightweight so first-time users can complete onboarding in minutes.',
    },
    {
      label: 'Live operations',
      value: 'Real-time map',
      detail: 'Verified users land directly in the control surface with live tracking and alerts.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 grid place-items-center p-8">
      <div className="w-full max-w-5xl rounded-2xl border border-white/10 backdrop-blur-lg shadow-2xl bg-white/4 p-8">
        {isAuthStep ? (
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-6 auto-rows-start lg:auto-rows-stretch">
            <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-9 grid gap-6 content-start">
              <p className="text-blue-400 text-xs uppercase tracking-[0.18em] font-bold">SUBIS · Authentication</p>
              <h1 className="text-4xl lg:text-5xl font-bold leading-tight tracking-tight max-w-xs text-white">{title}</h1>
              <p className="text-slate-300 text-base max-w-2xl leading-relaxed">{lede}</p>

              <div className="grid md:grid-cols-3 gap-3 mt-2">
                {authHighlights.map((item) => (
                  <article key={item.label} className="rounded-xl border border-blue-500/20 bg-blue-500/8 p-4 grid gap-2">
                    <span className="text-blue-300 text-xs uppercase tracking-wider font-bold">{item.label}</span>
                    <strong className="text-blue-100 text-base">{item.value}</strong>
                    <p className="text-slate-300 text-sm leading-relaxed m-0">{item.detail}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-950/60 p-6 grid gap-4 content-start">
              <div className="flex justify-between items-center gap-3">
                <span className="inline-flex items-center rounded-full px-3 py-1.5 bg-blue-500/20 text-blue-200 text-xs uppercase tracking-wider font-bold">Secure access</span>
                <span className="inline-flex items-center rounded-full px-3 py-1.5 bg-amber-500/20 text-amber-200 text-xs uppercase tracking-wider font-bold">OTP enabled</span>
              </div>

              {message && <div className="rounded-lg p-3 bg-emerald-500/15 border border-emerald-500/35 text-emerald-200 font-semibold text-sm">{message}</div>}
              {error && <div className="rounded-lg p-3 bg-red-500/15 border border-red-500/35 text-red-200 font-semibold text-sm">{error}</div>}

              {step === 'register' && (
                <form className="grid gap-4" onSubmit={handleRegister}>
                  <label className="grid gap-1.5">
                    <span className="text-slate-300 text-sm">Name</span>
                    <input
                      type="text"
                      name="name"
                      placeholder="Jane Doe"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                      className="rounded-lg border border-white/10 bg-white/5 text-white p-3 text-sm placeholder-white/40 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition"
                      required
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-slate-300 text-sm">Email</span>
                    <input
                      type="email"
                      name="email"
                      placeholder="you@university.edu"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      className="rounded-lg border border-white/10 bg-white/5 text-white p-3 text-sm placeholder-white/40 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition"
                      required
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-slate-300 text-sm">Password</span>
                    <input
                      type="password"
                      name="password"
                      placeholder="At least 6 characters"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      className="rounded-lg border border-white/10 bg-white/5 text-white p-3 text-sm placeholder-white/40 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition"
                      minLength={6}
                      required
                    />
                  </label>

                  <button className="h-12 rounded-lg font-bold bg-gradient-to-r from-blue-500 to-blue-600 text-slate-950 disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-500/20 transition transform hover:-translate-y-0.5" type="submit" disabled={!canSubmitRegister || isSubmitting}>
                    {isSubmitting ? 'Sending OTP…' : 'Send OTP'}
                  </button>

                  <p className="text-slate-400 text-sm mt-2">
                    Already verified?{' '}
                    <button type="button" className="bg-none border-none text-blue-300 font-bold cursor-pointer p-0 hover:text-blue-200 transition" onClick={() => setStepAndClear('login')}>
                      Go to login
                    </button>
                  </p>
                </form>
              )}

              {step === 'otp' && (
                <form className="grid gap-4" onSubmit={handleVerifyOtp}>
                  <label className="grid gap-1.5">
                    <span className="text-slate-300 text-sm">Email</span>
                    <input
                      type="email"
                      name="email"
                      placeholder="you@university.edu"
                      value={otpForm.email}
                      onChange={(e) => setOtpForm({ ...otpForm, email: e.target.value })}
                      className="rounded-lg border border-white/10 bg-white/5 text-white p-3 text-sm placeholder-white/40 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition"
                      required
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-slate-300 text-sm">6-digit code</span>
                    <input
                      type="text"
                      name="otp"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      placeholder="123456"
                      value={otpForm.otp}
                      onChange={(e) => setOtpForm({ ...otpForm, otp: e.target.value.replace(/\D/g, '') })}
                      className="rounded-lg border border-white/10 bg-white/5 text-white p-3 text-sm placeholder-white/40 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition"
                      required
                    />
                  </label>

                  <div className="flex gap-3">
                    <button className="flex-1 h-10 rounded-lg font-bold border border-white/15 bg-white/5 text-white hover:bg-white/10 transition transform hover:-translate-y-0.5" type="button" onClick={() => setStep('register')}>
                      Change email
                    </button>
                    <button className="flex-1 h-10 rounded-lg font-bold bg-gradient-to-r from-blue-500 to-blue-600 text-slate-950 disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-500/20 transition transform hover:-translate-y-0.5" type="submit" disabled={!canSubmitOtp || isSubmitting}>
                      {isSubmitting ? 'Verifying…' : 'Verify OTP'}
                    </button>
                  </div>
                </form>
              )}

              {step === 'login' && (
                <form className="grid gap-4" onSubmit={handleLogin}>
                  <label className="grid gap-1.5">
                    <span className="text-slate-300 text-sm">Email</span>
                    <input
                      type="email"
                      name="email"
                      placeholder="you@university.edu"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      className="rounded-lg border border-white/10 bg-white/5 text-white p-3 text-sm placeholder-white/40 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition"
                      required
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-slate-300 text-sm">Password</span>
                    <input
                      type="password"
                      name="password"
                      placeholder="Your password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="rounded-lg border border-white/10 bg-white/5 text-white p-3 text-sm placeholder-white/40 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition"
                      minLength={6}
                      required
                    />
                  </label>

                  <button className="h-12 rounded-lg font-bold bg-gradient-to-r from-blue-500 to-blue-600 text-slate-950 disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-500/20 transition transform hover:-translate-y-0.5" type="submit" disabled={!canSubmitLogin || isSubmitting}>
                    {isSubmitting ? 'Logging in…' : 'Log in'}
                  </button>

                  <p className="text-slate-400 text-sm mt-2">
                    Need an account?{' '}
                    <button type="button" className="bg-none border-none text-blue-300 font-bold cursor-pointer p-0 hover:text-blue-200 transition" onClick={() => setStepAndClear('register')}>
                      Sign up
                    </button>
                  </p>
                </form>
              )}
            </section>
          </div>
        ) : currentUserRole === 'ADMIN' && (
          <AdminDashboard
            authToken={authToken}
            currentUserName={currentUserName}
            onLogout={handleLogout}
          />
        )}
      </div>
    </div>
  );
}

export default App;
