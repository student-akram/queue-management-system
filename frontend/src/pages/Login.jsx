
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, ArrowRight, LockKeyhole, Mail } from "lucide-react";
import API from "../api/axios";
import "./Auth.css";

const Login = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await API.post("/auth/login", formData);

      localStorage.setItem("token", response.data.token);
      localStorage.setItem(
        "manager",
        JSON.stringify(response.data.manager)
      );

      navigate("/dashboard");
    } catch (error) {
      setError(
        error.response?.data?.message || "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-brand-panel">
          <div className="auth-brand">
            <div className="auth-brand-icon">
              <Activity size={24} />
            </div>
            <span>QueueFlow</span>
          </div>

          <div className="auth-brand-content">
            <span className="auth-overline">QUEUE MANAGEMENT SYSTEM</span>
            <h1>
              Make every
              <br />
              <span>minute count.</span>
            </h1>
            <p>
              A simpler way to organize queues, manage service flow, and keep
              your customers moving.
            </p>
          </div>

          <div className="auth-brand-footer">
            <span className="auth-footer-dot" />
            Organized service. Better experience.
          </div>
        </section>

        <section className="auth-form-panel">
          <div className="auth-form-card">
            <div className="auth-mobile-brand">
              <div className="auth-brand-icon">
                <Activity size={22} />
              </div>
              <span>QueueFlow</span>
            </div>

            <div className="auth-heading">
              <span className="auth-eyebrow">WELCOME BACK</span>
              <h2>Manager login</h2>
              <p>Enter your account details to continue.</p>
            </div>

            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label htmlFor="login-email">Email address</label>
                <div className="auth-input-wrap">
                  <Mail size={18} />
                  <input
                    id="login-email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="manager@example.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="login-password">Password</label>
                <div className="auth-input-wrap">
                  <LockKeyhole size={18} />
                  <input
                    id="login-password"
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="auth-submit"
              >
                <span>{loading ? "Logging in..." : "Login to dashboard"}</span>
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>

            <p className="auth-switch">
              Don’t have an account?{" "}
              <Link to="/register">Create account</Link>
            </p>

            <div className="auth-security-note">
              <LockKeyhole size={14} />
              <span>Your account is securely protected.</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Login;
