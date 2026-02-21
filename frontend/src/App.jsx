import { useMemo, useState } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function App() {
  const [step, setStep] = useState('register');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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

  const canSubmitRegister = useMemo(() => {
    const { name, email, password } = registerForm;
    return Boolean(name && email && password.length >= 6);
  }, [registerForm]);

  const canSubmitOtp = useMemo(() => {
    const { email, otp } = otpForm;
    return Boolean(email && otp.length === 6);
  }, [otpForm]);

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
      setMessage(data.message || 'Account verified successfully.');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="glass">
        <header className="header">
          <p className="eyebrow">SUBIS · Authentication</p>
          <h1>{step === 'register' ? 'Create your account' : 'Verify your email'}</h1>
          <p className="lede">
            {step === 'register'
              ? 'Sign up to access the student bus information system. We will email you a 6-digit code to verify your account.'
              : 'Enter the 6-digit code we sent to your email. Codes expire in 5 minutes.'}
          </p>
        </header>

        {message && <div className="banner success">{message}</div>}
        {error && <div className="banner error">{error}</div>}

        {step === 'register' ? (
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
          </form>
        ) : (
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
      </div>
    </div>
  );
}

export default App;
