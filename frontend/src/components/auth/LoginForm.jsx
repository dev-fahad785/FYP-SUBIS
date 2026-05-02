import { useMemo, useState } from 'react';
import { Button, Input } from '../ui';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

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

export default function LoginForm({
  email: initialEmail,
  onSuccess,
  onSwitchToRegister,
}) {
  const [form, setForm] = useState({
    email: initialEmail || '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = useMemo(() => {
    return Boolean(form.email && form.password.length >= 6);
  }, [form]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      const nextName = data.name || form.email.split('@')[0];
      const nextEmail = data.email || form.email;
      const nextRole = data.role || 'STUDENT';
      const nextUserId = data.userId || decodeJwtPayload(data.access_token)?.sub || '';

      onSuccess({
        token: data.access_token,
        userId: nextUserId,
        email: nextEmail,
        name: nextName,
        role: nextRole,
      });
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Input
        type="email"
        label="Email"
        placeholder="you@university.edu"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        required
      />

      <Input
        type="password"
        label="Password"
        placeholder="Your password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        minLength={6}
        required
      />

      <Button
        type="submit"
        disabled={!canSubmit || isSubmitting}
        className="w-full"
      >
        {isSubmitting ? 'Logging in…' : 'Log in'}
      </Button>

      <p className="text-sm text-slate-400 text-center">
        Need an account?{' '}
        <Button
          type="button"
          variant="link"
          onClick={onSwitchToRegister}
          className="p-0"
        >
          Sign up
        </Button>
      </p>
    </form>
  );
}
