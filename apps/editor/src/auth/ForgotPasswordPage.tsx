import { useState } from 'react';
import './auth.css';

export function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      const response = await fetch('/api/auth/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.get('email') as string,
        }),
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        const data = await response.json();
        setError(data.error || 'Recovery failed. Please try again.');
      }
    } catch (err) {
      console.error('[Auth] Recovery error:', err);
      setError('Recovery failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Reset password</h1>

        {submitted && (
          <p className="auth-info">
            If an account with that email exists, we sent a recovery code.
            Check your email.
          </p>
        )}

        {error && <p className="auth-error">{error}</p>}

        {!submitted && (
          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="email" className="auth-label">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                disabled={isSubmitting}
                className="auth-input"
              />
            </div>

            <button
              type="submit"
              className="auth-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Send recovery code'}
            </button>
          </form>
        )}

        <div className="auth-links">
          <a href="/login">Back to login</a>
        </div>
      </div>
    </div>
  );
}
