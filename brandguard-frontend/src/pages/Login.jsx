
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../services/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await loginUser(email.trim(), password);

      if (data.success) {
        navigate('/dashboard');
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError(err.message || 'Unable to connect to the server');
    } finally {
      setLoading(false);
    }
  }

  const demoAccounts = [
    { role: 'Admin', email: 'admin@brandguard.demo', password: 'BrandGuardAI_Admin' },
    { role: 'Creator', email: 'creator@brandguard.demo', password: 'BG_Creator_2026' },
    { role: 'Manager', email: 'manager@brandguard.demo', password: 'BG_Manager_2026' },
    { role: 'Reviewer', email: 'reviewer@brandguard.demo', password: 'BG_Reviewer_2026' }
  ];

  return (
    <div className="login-layout">

      {/* LEFT BRAND AND WORKFLOW SECTION */}
      <div className="login-brand">

        <div className="brand-name">
          BrandGuard AI
        </div>

        <div className="brand-message">
          <h1>
            Build Trust.<br />
            Protect Your Brand.
          </h1>

          <p>
            Intelligent brand governance for consistent,
            compliant and trustworthy content.
          </p>
        </div>

        <div className="brand-illustration">
          <div className="illustration-card login-workflow-card">

            <h3>Explore BrandGuard AI</h3>

            <p className="workflow-intro">
              Understand how our intelligent brand governance
              and content approval platform works.
            </p>

            <div className="login-workflow-list">

              <div className="login-workflow-item">
                <span>01</span>
                <div>
                  <strong>Content Submission</strong>
                  <p>Creators submit content for AI analysis.</p>
                </div>
              </div>

              <div className="login-workflow-item">
                <span>02</span>
                <div>
                  <strong>AI Analysis</strong>
                  <p>Identifies potential brand guideline issues.</p>
                </div>
              </div>

              <div className="login-workflow-item">
                <span>03</span>
                <div>
                  <strong>Review & Approval</strong>
                  <p>Reviewers inspect content and make decisions.</p>
                </div>
              </div>

              <div className="login-workflow-item">
                <span>04</span>
                <div>
                  <strong>Management</strong>
                  <p>Managers monitor submissions and progress.</p>
                </div>
              </div>

            </div>

          </div>
        </div>

        <div className="brand-footer">
          Intelligent Brand Governance Platform
        </div>

      </div>

      {/* RIGHT LOGIN SECTION */}
      <div className="login-form-section">

        <div className="login-form-container">

          <div className="login-demo-access">
            <div className="login-demo-heading">
              <h3>Demo Login Credentials</h3>
              <span>4 Roles</span>
            </div>

            <p>Use the credentials below to explore each role.</p>

            <div className="login-demo-grid">
              {demoAccounts.map(account => (
                <div className="login-demo-item" key={account.role}>
                  <strong>{account.role}</strong>
                  <span>{account.email}</span>
                  <span>Password: {account.password}</span>
                </div>
              ))}
            </div>
          </div>

          <h2>Welcome Back!</h2>

          <p className="login-subtitle">
            Please sign in to continue
          </p>

          <form onSubmit={handleLogin}>

            <label>Email Address</label>

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label>Password</label>

            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            {error && (
              <p style={{ color: 'red', marginTop: '10px' }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In'}
            </button>

          </form>

          <p className="login-bottom-text">
            Secure access to your brand workspace
          </p>

          <div className="login-legal">
            <span>Privacy Policy</span>
            <span>Terms</span>
            <span>Help</span>
          </div>

        </div>

      </div>

    </div>
  );
}
