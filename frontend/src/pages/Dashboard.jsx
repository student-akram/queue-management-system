import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Plus,
  LogOut,
  Users,
  ArrowRight,
  Layers,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";
import API from "../api/axios";
import "./Dashboard.css";

const Dashboard = () => {
  const navigate = useNavigate();

  const [queues, setQueues] = useState([]);
  const [queueName, setQueueName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const manager = JSON.parse(localStorage.getItem("manager") || "{}");

  const fetchQueues = async () => {
    try {
      setError("");

      const response = await API.get("/queues");

      const queueData = Array.isArray(response.data)
        ? response.data
        : response.data.queues || [];

      setQueues(queueData);
    } catch (error) {
      setError(error.response?.data?.message || "Failed to load queues");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueues();
  }, []);

  const handleCreateQueue = async (event) => {
    event.preventDefault();

    if (!queueName.trim()) return;

    try {
      setCreating(true);
      setError("");

      await API.post("/queues", {
        name: queueName.trim(),
      });

      setQueueName("");
      await fetchQueues();
    } catch (error) {
      setError(error.response?.data?.message || "Failed to create queue");
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("manager");
    navigate("/login");
  };

  return (
    <div className="dashboard-page">
      {/* Top navigation */}
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <Link to="/dashboard" className="dashboard-brand">
            <div className="brand-icon">
              <Layers size={21} />
            </div>

            <div>
              <h1>QueueFlow</h1>
              <p>Queue Management</p>
            </div>
          </Link>

          <div className="header-actions">
            <div className="manager-info">
              <div className="manager-avatar">
                {(manager.name || "M").charAt(0).toUpperCase()}
              </div>

              <div className="manager-details">
                <span className="manager-label">Signed in as</span>
                <strong>{manager.name || "Manager"}</strong>
              </div>
            </div>

            <button className="logout-button" onClick={handleLogout}>
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        {/* Welcome */}
        <section className="welcome-section">
          <div className="welcome-content">
            <div className="welcome-label">
              <Sparkles size={15} />
              <span>MANAGER WORKSPACE</span>
            </div>

            <h2>
              Welcome back{manager.name ? `, ${manager.name}` : ""}
            </h2>

            <p>
              Keep your service queues organized and your customers moving.
            </p>
          </div>

          <div className="welcome-summary">
            <div className="summary-icon">
              <Layers size={19} />
            </div>

            <div>
              <span>Total queues</span>
              <strong>{queues.length}</strong>
            </div>
          </div>
        </section>

        {/* Create Queue */}
        <section className="create-queue-section">
          <div className="create-queue-heading">
            <div className="create-icon">
              <Plus size={20} />
            </div>

            <div>
              <h3>Create a new queue</h3>
              <p>Set up a queue for a service or department.</p>
            </div>
          </div>

          <form onSubmit={handleCreateQueue} className="create-queue-form">
            <input
              type="text"
              value={queueName}
              onChange={(event) => setQueueName(event.target.value)}
              placeholder="e.g. General Service"
              required
              maxLength={60}
            />

            <button type="submit" disabled={creating}>
              <Plus size={18} />
              {creating ? "Creating..." : "Create Queue"}
            </button>
          </form>
        </section>

        {/* Error */}
        {error && (
          <div className="dashboard-error">
            <span>{error}</span>
          </div>
        )}

        {/* Queues */}
        <section className="queues-section">
          <div className="queues-heading">
            <div>
              <div className="queues-title-row">
                <LayoutDashboard size={19} />
                <h3>Your queues</h3>
              </div>

              <p>Open a queue to manage tokens and service activity.</p>
            </div>

            <span className="queue-count">
              {queues.length} {queues.length === 1 ? "queue" : "queues"}
            </span>
          </div>

          {loading ? (
            <div className="queue-loading">
              <div className="loading-spinner" />
              <span>Loading your queues...</span>
            </div>
          ) : queues.length === 0 ? (
            <div className="empty-queues">
              <div className="empty-icon">
                <Users size={27} />
              </div>

              <h4>Your workspace is ready</h4>

              <p>
                Create your first queue above to start managing people.
              </p>
            </div>
          ) : (
            <div className="queues-grid">
              {queues.map((queue, index) => (
                <Link
                  key={queue.id}
                  to={`/queues/${queue.id}`}
                  className="queue-card"
                >
                  <div className="queue-card-top">
                    <div className="queue-card-icon">
                      <Users size={22} />
                    </div>

                    <span className="queue-card-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="queue-card-content">
                    <h4>{queue.name}</h4>
                    <p>Manage tokens and service status</p>
                  </div>

                  <div className="queue-card-footer">
                    <span>Open queue</span>

                    <div className="queue-card-arrow">
                      <ArrowRight size={16} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <footer className="dashboard-footer">
          <span>QueueFlow</span>
          <span>Queue management made simple.</span>
        </footer>
      </main>
    </div>
  );
};

export default Dashboard;