import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock3,
  Loader2,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  Users,
  XCircle,
} from "lucide-react";
import API from "../api/axios";
import "./QueueDetails.css";

function QueueDetails() {
  const { queueId } = useParams();
  const navigate = useNavigate();

  const [queue, setQueue] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [personName, setPersonName] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load queue tokens and analytics
  const loadQueueData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [tokensRes, analyticsRes] = await Promise.all([
        API.get(`/queues/${queueId}/tokens`),
        API.get(`/queues/${queueId}/analytics`),
      ]);

      const tokenData = Array.isArray(tokensRes.data)
        ? tokensRes.data
        : Array.isArray(tokensRes.data.tokens)
          ? tokensRes.data.tokens
          : [];

      const normalizedTokens = tokenData.map((item) => {
        const row = item?.dataValues || item;

        return {
          ...row,
          id: row.id ?? row.tokenId ?? row.token_id ?? row.TokenId,
        };
      });

      setTokens(normalizedTokens);
      setAnalytics(analyticsRes.data);

      if (analyticsRes.data.queue) {
        setQueue(analyticsRes.data.queue);
      }
    } catch (err) {
      console.error("Loading queue data failed:", err);
      setError(
        err.response?.data?.message ||
          "Unable to load queue data. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [queueId]);

  useEffect(() => {
    loadQueueData();
  }, [loadQueueData]);

  const showSuccess = (message) => {
    setSuccess(message);
    setError("");
  };

  // Add person
  const handleAddPerson = async (event) => {
    event.preventDefault();

    if (!personName.trim()) {
      setError("Please enter the person's name.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      await API.post(`/queues/${queueId}/tokens`, {
        personName: personName.trim(),
      });

      setPersonName("");
      showSuccess("Person added to the queue successfully.");
      await loadQueueData();
    } catch (err) {
      console.error("Adding person failed:", err);
      setError(
        err.response?.data?.message ||
          "Unable to add person. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Call next waiting token
  const handleCallNext = async () => {
    try {
      setActionLoading("call-next");
      setError("");
      setSuccess("");

      const response = await API.post(`/queues/${queueId}/call-next`);

      showSuccess(response.data.message || "Next token called.");
      await loadQueueData();
    } catch (err) {
      console.error("Call next failed:", err);
      setError(
        err.response?.data?.message ||
          "Unable to call the next token."
      );
    } finally {
      setActionLoading(null);
    }
  };

  // Move waiting token
  const handleMoveToken = async (tokenId, direction) => {
    if (tokenId === undefined || tokenId === null || tokenId === "") {
      setError("Token database ID is missing. Check the tokens API response.");
      setSuccess("");
      return;
    }

    try {
      setActionLoading(`${tokenId}-${direction}`);
      setError("");
      setSuccess("");

      const response = await API.patch(`/tokens/${tokenId}/move`, {
        direction,
      });

      setSuccess(
        response.data.message || `Token moved ${direction} successfully.`
      );

      await loadQueueData();
    } catch (err) {
      console.error("Move token failed:", err);
      setSuccess("");
      setError(
        err.response?.data?.message ||
          "Unable to move token. Please try again."
      );
    } finally {
      setActionLoading(null);
    }
  };

  // Complete serving token
  const handleCompleteToken = async (tokenId) => {
    try {
      setActionLoading(`${tokenId}-complete`);
      setError("");
      setSuccess("");

      const response = await API.patch(`/tokens/${tokenId}/complete`);

      showSuccess(response.data.message || "Service completed.");
      await loadQueueData();
    } catch (err) {
      console.error("Complete token failed:", err);
      setError(
        err.response?.data?.message ||
          "Unable to complete this token."
      );
    } finally {
      setActionLoading(null);
    }
  };

  // Cancel waiting token
  const handleCancelToken = async (tokenId) => {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this token?"
    );

    if (!confirmed) return;

    try {
      setActionLoading(`${tokenId}-cancel`);
      setError("");
      setSuccess("");

      const response = await API.patch(`/tokens/${tokenId}/cancel`);

      showSuccess(response.data.message || "Token cancelled.");
      await loadQueueData();
    } catch (err) {
      console.error("Cancel token failed:", err);
      setError(
        err.response?.data?.message ||
          "Unable to cancel this token."
      );
    } finally {
      setActionLoading(null);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("manager");
    navigate("/login");
  };

  // Sort tokens by position
  const sortedTokens = [...tokens].sort(
    (a, b) => Number(a.position) - Number(b.position)
  );

  const waitingTokens = sortedTokens.filter(
    (token) => token.status === "WAITING"
  );

  const servingToken = sortedTokens.find(
    (token) => token.status === "SERVING"
  );

  const completedCount =
    analytics?.completedCount ??
    sortedTokens.filter((token) => token.status === "COMPLETED").length;

  const waitingCount = analytics?.waitingCount ?? waitingTokens.length;

  const servingCount =
    analytics?.servingCount ?? (servingToken ? 1 : 0);

  const averageWaitingTime = analytics?.averageWaitingTimeMinutes ?? 0;
  const averageServiceTime = analytics?.averageServiceTimeMinutes ?? 0;

  const getStatusStyles = (status) => {
    switch (status) {
      case "WAITING":
        return "status-waiting";
      case "SERVING":
        return "status-serving";
      case "COMPLETED":
        return "status-completed";
      case "CANCELLED":
        return "status-cancelled";
      default:
        return "status-default";
    }
  };

  const formatMinutes = (value) => {
    const minutes = Number(value || 0);
    return `${minutes.toFixed(1)} min`;
  };

  return (
    <main className="queue-details-page">
      <div className="queue-details-container">
        {/* Header */}
        <header className="qd-header">
          <div className="qd-header-left">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="qd-icon-button qd-back-button"
              aria-label="Back to dashboard"
            >
              <ArrowLeft size={19} />
            </button>

            <div>
              <p className="qd-eyebrow">Queue Management</p>

              <h1>{queue?.name || "Queue Dashboard"}</h1>

              <p className="qd-subtitle">
                Manage waiting tokens and monitor service activity.
              </p>
            </div>
          </div>

          <div className="qd-header-actions">
            <button
              type="button"
              onClick={loadQueueData}
              disabled={loading}
              className="qd-button qd-button-secondary"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : ""}
              />
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="qd-button qd-button-secondary"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </header>

        {/* Messages */}
        {error && (
          <div className="qd-message qd-message-error">
            <XCircle size={18} />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="qd-message qd-message-success">
            <CheckCircle2 size={18} />
            <p>{success}</p>
          </div>
        )}

        {/* Overview */}
        <section className="qd-overview-section">
          <div className="qd-section-heading">
            <div>
              <h2>Queue Overview</h2>
              <p>Live summary of your queue.</p>
            </div>
          </div>

          <div className="qd-stats-grid">
            <div className="qd-stat-card">
              <div className="qd-stat-top">
                <span>Waiting</span>
                <div className="qd-stat-icon qd-icon-amber">
                  <Users size={19} />
                </div>
              </div>
              <strong>{waitingCount}</strong>
              <small>People in queue</small>
            </div>

            <div className="qd-stat-card">
              <div className="qd-stat-top">
                <span>Serving</span>
                <div className="qd-stat-icon qd-icon-purple">
                  <Play size={18} />
                </div>
              </div>
              <strong>{servingCount}</strong>
              <small>Currently being served</small>
            </div>

            <div className="qd-stat-card">
              <div className="qd-stat-top">
                <span>Completed</span>
                <div className="qd-stat-icon qd-icon-green">
                  <CheckCircle2 size={19} />
                </div>
              </div>
              <strong>{completedCount}</strong>
              <small>Services completed</small>
            </div>

            <div className="qd-stat-card">
              <div className="qd-stat-top">
                <span>Avg. Waiting</span>
                <div className="qd-stat-icon qd-icon-blue">
                  <Clock3 size={19} />
                </div>
              </div>
              <strong>{formatMinutes(averageWaitingTime)}</strong>
              <small>Average wait time</small>
            </div>
          </div>
        </section>

        {/* Add person and service controls */}
        <section className="qd-actions-grid">
          {/* Add Person */}
          <div className="qd-panel qd-add-panel">
            <div className="qd-panel-heading">
              <div className="qd-panel-icon qd-panel-icon-purple">
                <Plus size={19} />
              </div>
              <div>
                <h2>Add Person</h2>
                <p>Create a new token for someone joining the queue.</p>
              </div>
            </div>

            <form onSubmit={handleAddPerson} className="qd-add-form">
              <label htmlFor="personName">Person name</label>

              <input
                id="personName"
                type="text"
                value={personName}
                onChange={(event) => setPersonName(event.target.value)}
                placeholder="Enter person's name"
              />

              <button
                type="submit"
                disabled={submitting || !personName.trim()}
                className="qd-button qd-button-primary qd-full-button"
              >
                {submitting ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Plus size={17} />
                )}
                {submitting ? "Adding..." : "Add to Queue"}
              </button>
            </form>
          </div>

          {/* Service Controls */}
          <div className="qd-panel qd-service-panel">
            <div className="qd-panel-heading">
              <div className="qd-panel-icon qd-panel-icon-green">
                <Play size={19} />
              </div>
              <div>
                <h2>Service Controls</h2>
                <p>Call the next waiting person or complete the current service.</p>
              </div>
            </div>

            <div className="qd-service-actions">
              <button
                type="button"
                onClick={handleCallNext}
                disabled={
                  actionLoading === "call-next" ||
                  waitingTokens.length === 0 ||
                  Boolean(servingToken)
                }
                className="qd-button qd-button-primary qd-full-button"
              >
                {actionLoading === "call-next" ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Play size={17} />
                )}
                Call Next Token
              </button>

              {servingToken && (
                <button
                  type="button"
                  onClick={() => handleCompleteToken(servingToken.id)}
                  disabled={
                    actionLoading === `${servingToken.id}-complete`
                  }
                  className="qd-button qd-button-success qd-full-button"
                >
                  {actionLoading === `${servingToken.id}-complete` ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={17} />
                  )}
                  Complete Current Service
                </button>
              )}
            </div>

            {servingToken ? (
              <div className="qd-serving-banner">
                <div className="qd-serving-indicator" />
                <div>
                  <span>Currently serving</span>
                  <strong>
                    Token #{servingToken.tokenNumber} —{" "}
                    {servingToken.personName}
                  </strong>
                </div>
              </div>
            ) : (
              <div className="qd-empty-serving">
                <Clock3 size={17} />
                <span>No person is currently being served.</span>
              </div>
            )}
          </div>
        </section>

        {/* Queue Tokens */}
        <section className="qd-token-panel">
          <div className="qd-token-header">
            <div>
              <h2>Queue Tokens</h2>
              <p>Manage token order and service status.</p>
            </div>

            <span className="qd-token-count">
              {tokens.length} total tokens
            </span>
          </div>

          {loading && tokens.length === 0 ? (
            <div className="qd-loading-state">
              <Loader2 size={20} className="animate-spin" />
              <span>Loading queue...</span>
            </div>
          ) : sortedTokens.length === 0 ? (
            <div className="qd-empty-state">
              <div className="qd-empty-icon">
                <Users size={25} />
              </div>
              <h3>No tokens yet</h3>
              <p>Add a person to start managing this queue.</p>
            </div>
          ) : (
            <div className="qd-table-wrapper">
              <table className="qd-token-table">
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>Token</th>
                    <th>Person</th>
                    <th>Status</th>
                    <th className="qd-actions-column">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {sortedTokens.map((token) => {
                    const isWaiting = token.status === "WAITING";

                    const waitingIndex = waitingTokens.findIndex(
                      (item) => item.id === token.id
                    );

                    const isFirstWaiting = waitingIndex === 0;
                    const isLastWaiting =
                      waitingIndex === waitingTokens.length - 1;

                    return (
                      <tr key={token.id}>
                        <td>
                          <span className="qd-position">
                            {token.position}
                          </span>
                        </td>

                        <td>
                          <span className="qd-token-number">
                            #{token.tokenNumber}
                          </span>
                        </td>

                        <td>
                          <span className="qd-person-name">
                            {token.personName}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`qd-status ${getStatusStyles(
                              token.status
                            )}`}
                          >
                            <span className="qd-status-dot" />
                            {token.status}
                          </span>
                        </td>

                        <td>
                          <div className="qd-token-actions">
                            {isWaiting && (
                              <>
                                <button
                                  type="button"
                                  title="Move up"
                                  aria-label={`Move token ${token.tokenNumber} up`}
                                  onClick={() =>
                                    handleMoveToken(token.id, "up")
                                  }
                                  disabled={
                                    isFirstWaiting ||
                                    actionLoading === `${token.id}-up`
                                  }
                                  className="qd-icon-button"
                                >
                                  {actionLoading === `${token.id}-up` ? (
                                    <Loader2
                                      size={16}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <ArrowUp size={16} />
                                  )}
                                </button>

                                <button
                                  type="button"
                                  title="Move down"
                                  aria-label={`Move token ${token.tokenNumber} down`}
                                  onClick={() =>
                                    handleMoveToken(token.id, "down")
                                  }
                                  disabled={
                                    isLastWaiting ||
                                    actionLoading === `${token.id}-down`
                                  }
                                  className="qd-icon-button"
                                >
                                  {actionLoading === `${token.id}-down` ? (
                                    <Loader2
                                      size={16}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <ArrowDown size={16} />
                                  )}
                                </button>

                                <button
                                  type="button"
                                  title="Cancel token"
                                  aria-label={`Cancel token ${token.tokenNumber}`}
                                  onClick={() =>
                                    handleCancelToken(token.id)
                                  }
                                  disabled={
                                    actionLoading === `${token.id}-cancel`
                                  }
                                  className="qd-icon-button qd-cancel-button"
                                >
                                  {actionLoading === `${token.id}-cancel` ? (
                                    <Loader2
                                      size={16}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <XCircle size={16} />
                                  )}
                                </button>
                              </>
                            )}

                            {token.status === "SERVING" && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleCompleteToken(token.id)
                                }
                                disabled={
                                  actionLoading === `${token.id}-complete`
                                }
                                className="qd-button qd-button-success qd-complete-button"
                              >
                                {actionLoading === `${token.id}-complete` ? (
                                  <Loader2
                                    size={14}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <CheckCircle2 size={14} />
                                )}
                                Complete
                              </button>
                            )}

                            {!isWaiting && token.status !== "SERVING" && (
                              <span className="qd-no-actions">No actions</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Average service time */}
        <div className="qd-footer">
          Average service time: {formatMinutes(averageServiceTime)}
        </div>
      </div>
    </main>
  );
}

export default QueueDetails;