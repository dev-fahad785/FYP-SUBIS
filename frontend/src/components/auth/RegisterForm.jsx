import { useMemo, useState } from 'react';
import { Button, Input, Select } from '../ui';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export default function RegisterForm({
  onSuccess,
  onSwitchToLogin,
}) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'STUDENT',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = useMemo(() => {
    return Boolean(form.name && form.email && form.password.length >= 6);
  }, [form]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      onSuccess({
        email: form.email,
        name: form.name,
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
        type="text"
        label="Name"
        placeholder="Jane Doe"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
      />

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
        placeholder="At least 6 characters"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        minLength={6}
        required
      />

      <Select
        label="Role"
        value={form.role}
        onChange={(e) => setForm({ ...form, role: e.target.value })}
        options={[
          { value: 'STUDENT', label: 'Student' },
          { value: 'ADMIN', label: 'Admin' },
        ]}
      />

      <Button
        type="submit"
        disabled={!canSubmit || isSubmitting}
        className="w-full"
      >
        {isSubmitting ? 'Sending OTP…' : 'Send OTP'}
      </Button>

      <p className="text-sm text-slate-400 text-center mt-4">
        Already verified?{' '}
        <Button
          type="button"
          variant="link"
          onClick={onSwitchToLogin}
          className="p-0"
        >
          Go to login
        </Button>
      </p>

      <Button
        type="button"
        variant="ghost"
        onClick={onSwitchToLogin}
        className="w-full"
      >
        Go to login
      </Button>
    </form>
  );
}
