import { useEffect, useState } from "react";
import {
  listTickets,
  updateTicket,
  UnauthorizedError,
  type Ticket,
  type TicketStatus,
  type TicketTier,
} from "./api";

const STORAGE_KEY = "leo-dashboard-admin-key";

function LoginScreen({ onSubmit }: { onSubmit: (key: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="login-screen">
      <form
        className="login-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onSubmit(value.trim());
        }}
      >
        <h1>LEO AI Chatbot</h1>
        <p>Support Dashboard</p>
        <input
          type="password"
          placeholder="Admin key"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <button type="submit">Sign in</button>
      </form>
    </div>
  );
}

function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`badge badge-${status}`}>{status.replace("_", " ")}</span>;
}

function TicketRow({
  ticket,
  onUpdate,
}: {
  ticket: Ticket;
  onUpdate: (id: string, updates: { status?: TicketStatus; tier?: TicketTier; assignee?: string }) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [tier, setTier] = useState<TicketTier | "">(ticket.tier ?? "");
  const [assignee, setAssignee] = useState(ticket.assignee ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onUpdate(ticket.id, {
        status,
        tier: tier || undefined,
        assignee: assignee || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <tr className="ticket-row" onClick={() => setExpanded((v) => !v)}>
        <td>{ticket.subject}</td>
        <td>{ticket.applicationId}</td>
        <td>
          <StatusBadge status={ticket.status} />
        </td>
        <td>{ticket.tier ?? "—"}</td>
        <td>{ticket.assignee ?? "—"}</td>
        <td>{new Date(ticket.createdAt).toLocaleString()}</td>
      </tr>
      {expanded && (
        <tr className="ticket-detail-row">
          <td colSpan={6}>
            <div className="ticket-detail">
              <p className="description">{ticket.description}</p>
              <div className="edit-fields">
                <label>
                  Status
                  <select value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)}>
                    <option value="open">open</option>
                    <option value="in_progress">in progress</option>
                    <option value="closed">closed</option>
                  </select>
                </label>
                <label>
                  Tier
                  <select value={tier} onChange={(e) => setTier(e.target.value as TicketTier | "")}>
                    <option value="">unassigned</option>
                    <option value="L1">L1</option>
                    <option value="L2">L2</option>
                    <option value="L3">L3</option>
                  </select>
                </label>
                <label>
                  Assignee
                  <input
                    type="text"
                    placeholder="agent@mojro.com"
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                  />
                </label>
                <button type="button" disabled={saving} onClick={handleSave}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function App() {
  const [adminKey, setAdminKey] = useState<string | null>(() => sessionStorage.getItem(STORAGE_KEY));
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function loadTickets(key: string) {
    setLoading(true);
    setError(null);
    listTickets(key)
      .then(setTickets)
      .catch((err) => {
        if (err instanceof UnauthorizedError) {
          sessionStorage.removeItem(STORAGE_KEY);
          setAdminKey(null);
          setError("Invalid admin key.");
        } else {
          setError("Could not load tickets: " + err.message);
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (adminKey) loadTickets(adminKey);
  }, [adminKey]);

  function handleLogin(key: string) {
    sessionStorage.setItem(STORAGE_KEY, key);
    setAdminKey(key);
  }

  async function handleUpdate(
    id: string,
    updates: { status?: TicketStatus; tier?: TicketTier; assignee?: string }
  ) {
    if (!adminKey) return;
    const updated = await updateTicket(adminKey, id, updates);
    setTickets((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  if (!adminKey) {
    return <LoginScreen onSubmit={handleLogin} />;
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Support Tickets</h1>
        <button
          type="button"
          className="link-button"
          onClick={() => {
            sessionStorage.removeItem(STORAGE_KEY);
            setAdminKey(null);
          }}
        >
          Sign out
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}
      {loading && <div className="loading">Loading...</div>}

      {!loading && tickets.length === 0 && !error && <p className="empty">No tickets yet.</p>}

      {tickets.length > 0 && (
        <table className="ticket-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>App</th>
              <th>Status</th>
              <th>Tier</th>
              <th>Assignee</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} onUpdate={handleUpdate} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
