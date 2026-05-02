import { useEffect, useState } from 'react';
import AdminDashboard from './components/AdminDashboard';
import AuthLayout from './components/auth/AuthLayout';
import RegisterForm from './components/auth/RegisterForm';
import OtpForm from './components/auth/OtpForm';
import LoginForm from './components/auth/LoginForm';
import StudentHome from './components/student/StudentHome';

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
  const [step, setStep] = useState('login');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState('');

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
    setStep('login');
    setMessage('');
    setError('');
  };

  if (step === 'home') {
    return currentUserRole === 'ADMIN' ? (
      <AdminDashboard
        authToken={authToken}
        currentUserName={currentUserName}
        onLogout={handleLogout}
      />
    ) : (
      <StudentHome
        userId={currentUserId}
        userName={currentUserName || currentUserEmail?.split('@')[0] || 'Student'}
        userEmail={currentUserEmail}
        onLogout={handleLogout}
      />
    );
  }

  const titles = {
    register: 'Create your account',
    otp: 'Verify your email',
    login: 'Welcome back',
  };

  const ledes = {
    register: 'Sign up to access the student bus information system. We will email you a 6-digit code to verify your account.',
    otp: 'Enter the 6-digit code we sent to your email. Codes expire in 5 minutes.',
    login: 'Use your verified email to sign in.',
  };

  return (
    <AuthLayout
      title={titles[step]}
      lede={ledes[step]}
      message={message}
      messageType={error ? 'error' : 'success'}
      error={error}
    >
      {step === 'register' && (
        <RegisterForm
          onSuccess={({ email, name }) => {
            localStorage.setItem(NAME_KEY, name);
            setCurrentUserName(name);
            setMessage('OTP sent to your email.');
            setError('');
            setStep('otp');
          }}
          onSwitchToLogin={() => {
            setStep('login');
            setMessage('');
            setError('');
          }}
        />
      )}

      {step === 'otp' && (
        <OtpForm
          email={currentUserEmail}
          onSuccess={({ email }) => {
            setMessage('Account verified successfully. Please log in.');
            setError('');
            setStep('login');
          }}
          onBack={() => {
            setStep('register');
            setMessage('');
            setError('');
          }}
        />
      )}

      {step === 'login' && (
        <LoginForm
          email={currentUserEmail}
          onSuccess={({ token, userId, email, name, role }) => {
            setAuthToken(token);
            setCurrentUserId(userId);
            setCurrentUserEmail(email);
            setCurrentUserName(name);
            setCurrentUserRole(role);

            localStorage.setItem(TOKEN_KEY, token);
            localStorage.setItem(USER_ID_KEY, userId);
            localStorage.setItem(EMAIL_KEY, email);
            localStorage.setItem(NAME_KEY, name);
            localStorage.setItem(ROLE_KEY, role);

            setMessage('Logged in successfully.');
            setError('');
            setStep('home');
          }}
          onSwitchToRegister={() => {
            setStep('register');
            setMessage('');
            setError('');
          }}
        />
      )}
    </AuthLayout>
  );
}

export default App;
