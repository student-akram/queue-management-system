
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import API from "../api/axios";
import "./Auth.css";

const Register = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
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
      await API.post("/auth/register", formData);
      navigate("/login");
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Registration failed. Please try again."
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
            <span className="auth-overline">GET STARTED</span>
            <h1>
              Your queue.
              <br />
              <span>Your control.</span>
            </h1>
            <p>
              Create your manager account and start organizing your service
              operations with QueueFlow.
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
              <span className="auth-eyebrow">CREATE YOUR ACCOUNT</span>
              <h2>Manager registration</h2>
              <p>Enter your details to set up your account.</p>
            </div>

            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label htmlFor="register-name">Full name</label>
                <div className="auth-input-wrap">
                  <UserRound size={18} />
                  <input
                    id="register-name"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                    autoComplete="name"
                    required
                  />
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="register-email">Email address</label>
                <div className="auth-input-wrap">
                  <Mail size={18} />
                  <input
                    id="register-email"
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
                <label htmlFor="register-password">Password</label>
                <div className="auth-input-wrap">
                  <LockKeyhole size={18} />
                  <input
                    id="register-password"
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Minimum 6 characters"
                    minLength={6}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="auth-submit"
              >
                <span>{loading ? "Creating account..." : "Create account"}</span>
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>

            <p className="auth-switch">
              Already registered?{" "}
              <Link to="/login">Login</Link>
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

export default Register;
