import { useState } from 'react';
import './auth.css';

export function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string || '';
    const confirmPassword = formData.get('confirm_password') as string || '';

    if (password !== confirmPassword) {
      setFieldErrors({ confirm_password: 'Passwords do not match.' });
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.get('email') as string,
          password,
          name: formData.get('name') as string || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        window.location.href = '/login';
        return;
      }

      if (data.errors) setFieldErrors(data.errors);
      if (data.error) setError(data.error);
      else if (!data.errors || Object.keys(data.errors).length === 0) {
        setError('Registration failed. Please try again.');
      }
    } catch {
      setError('Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Create account</h1>

        {error && <p className="auth-error">{error}</p>}

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
            {fieldErrors.email && (
              <p className="auth-field-error">{fieldErrors.email}</p>
            )}
          </div>

          <div className="auth-field">
            <label htmlFor="name" className="auth-label">Name</label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              disabled={isSubmitting}
              className="auth-input"
            />
            {fieldErrors.name && (
              <p className="auth-field-error">{fieldErrors.name}</p>
            )}
          </div>

          <div className="auth-field">
            <label htmlFor="password" className="auth-label">Password</label>
            <div className="auth-input-wrapper">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                disabled={isSubmitting}
                className="auth-input"
              />
              <button
                type="button"
                className="auth-reveal-toggle"
                onClick={() => setShowPassword(v => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.3536 2.35355C13.5488 2.15829 13.5488 1.84171 13.3536 1.64645C13.1583 1.45118 12.8417 1.45118 12.6464 1.64645L10.6828 3.61012C9.70652 3.21671 8.63759 3 7.5 3C4.30786 3 1.65639 4.70638 0.0760002 7.23501C-0.0253338 7.39715 -0.0253338 7.60288 0.0760002 7.76501C0.902945 9.08812 2.02314 10.1861 3.36061 10.9323L1.64645 12.6464C1.45118 12.8417 1.45118 13.1583 1.64645 13.3536C1.84171 13.5488 2.15829 13.5488 2.35355 13.3536L13.3536 2.35355ZM4.06189 10.2312C5.18132 10.886 6.4628 11 7.5 11C10.1971 11 12.4705 9.62184 13.9038 7.50001C13.1214 6.33105 12.1222 5.41406 10.9923 4.81567L9.42724 6.38073C9.78558 6.6953 10 7.11769 10 7.5C10 8.32843 8.88071 9 7.5 9C7.11769 9 6.6953 8.78558 6.38073 8.42724L4.06189 10.2312ZM9.02166 5.97834C8.6244 5.36835 8.1098 5 7.5 5C6.11929 5 5 6.39543 5 7.5C5 8.1098 5.36835 8.6244 5.97834 9.02166L9.02166 5.97834Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 11C4.80285 11 2.52952 9.62184 1.09622 7.50001C2.52952 5.37816 4.80285 4 7.5 4C10.1971 4 12.4705 5.37816 13.9038 7.50001C12.4705 9.62184 10.1971 11 7.5 11ZM7.5 3C4.30786 3 1.65639 4.70638 0.0760002 7.23501C-0.0253338 7.39715 -0.0253338 7.60288 0.0760002 7.76501C1.65639 10.2936 4.30786 12 7.5 12C10.6921 12 13.3436 10.2936 14.924 7.76501C15.0253 7.60288 15.0253 7.39715 14.924 7.23501C13.3436 4.70638 10.6921 3 7.5 3ZM7.5 9.5C8.60457 9.5 9.5 8.60457 9.5 7.5C9.5 6.39543 8.60457 5.5 7.5 5.5C6.39543 5.5 5.5 6.39543 5.5 7.5C5.5 8.60457 6.39543 9.5 7.5 9.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"/></svg>
                )}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="auth-field-error">{fieldErrors.password}</p>
            )}
          </div>

          <div className="auth-field">
            <label htmlFor="confirm_password" className="auth-label">Confirm password</label>
            <input
              id="confirm_password"
              name="confirm_password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              disabled={isSubmitting}
              className="auth-input"
            />
            {fieldErrors.confirm_password && (
              <p className="auth-field-error">{fieldErrors.confirm_password}</p>
            )}
          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        <div className="auth-links">
          <a href="/login">Already have an account? Log in</a>
        </div>
      </div>
    </div>
  );
}
