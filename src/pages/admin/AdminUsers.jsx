import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import Loading from "../../components/Loading";

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.users)) return payload.users;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
}

// Detect whether the backend returns Laravel-style pagination
// ({ data: [...], current_page, last_page, total, ... }) or a plain array.
// Returns { users, mode: "server"|"client" } (+ pagination metadata).
function parseUsersResponse(payload) {
  const envelopes = [];
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    envelopes.push(payload);
    // Some APIs wrap the metadata under payload.data instead.
    if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
      envelopes.push(payload.data);
    }
  }

  for (const envelope of envelopes) {
    const rows = Array.isArray(envelope.data)
      ? envelope.data
      : Array.isArray(envelope.users)
        ? envelope.users
        : Array.isArray(envelope.items)
          ? envelope.items
          : null;
    if (!rows) continue;

    const meta = envelope.meta || envelope.pagination || null;
    const perPage =
      Number(envelope.per_page) ||
      Number(envelope.perPage) ||
      Number(meta?.per_page) ||
      10;
    const rawTotal =
      envelope.total ?? envelope.total_count ?? meta?.total ?? meta?.total_count ?? null;
    const total = rawTotal === null || rawTotal === undefined ? null : Number(rawTotal);
    const lastPage =
      Number(envelope.last_page) ||
      Number(envelope.lastPage) ||
      Number(meta?.last_page) ||
      (total !== null && perPage > 0 ? Math.max(1, Math.ceil(total / perPage)) : null);

    const isPaginated =
      envelope.current_page !== undefined ||
      envelope.last_page !== undefined ||
      envelope.lastPage !== undefined ||
      envelope.total !== undefined ||
      meta !== null;

    if (isPaginated) {
      return {
        users: rows,
        mode: "server",
        page: Math.max(1, Number(envelope.current_page) || Number(meta?.current_page) || 1),
        perPage,
        total,
        lastPage: lastPage ?? 1,
      };
    }
  }

  return { users: normalizeList(payload), mode: "client" };
}

const emptyCreate = {
  user_id: "",
  card_id: "",
  name: "",
  email: "",
  phone: "",
  role: "user",
  password: "",
  password_confirmation: "",
};

const emptyEdit = {
  id: null,
  user_id: "",
  name: "",
  email: "",
  phone: "",
  role: "user",
  password: "",
  password_confirmation: "",
};

const sanitizeNameInput = (value = "") => value.replace(/[^a-zA-Z0-9\s]/g, "");
const normalizeName = (value = "") => sanitizeNameInput(value).replace(/\s+/g, " ").trim();

function roleBadge(roleRaw) {
  const role = (roleRaw || "").toLowerCase();
  if (role === "administrator" || role === "admin")
    return <span className="badge bg-danger">Admin</span>;
  if (role === "trainer")
    return <span className="badge bg-info text-dark">Trainer</span>;
  return <span className="badge bg-secondary">User</span>;
}

function getUserRecordId(user) {
  // ✅ CRITICAL: Always use the database primary key 'id' field
  // This is the actual users.id from the database, NOT the custom user_id field
  
  // Priority order: direct id > nested user.id > member_id > user_id (fallback only)
  const directId = user?.id ?? user?.user?.id ?? user?.member_id ?? null;
  
  if (directId !== null && directId !== undefined) {
    return directId;
  }
  
  // FALLBACK: user_id is NOT the database ID, but use it if nothing else is available
  const fallbackUserId = user?.user_id ?? null;
  
  return fallbackUserId;
}


/**
 * ✅ Stable & unique row key (NEVER Math.random, NEVER array index)
 * - Prefer real DB id
 * - Else fallback to user_id
 * - Else fallback to email
 */
function getStableRowKey(u) {
  const recordId = u?.id ?? u?.user?.id ?? u?.member_id ?? null;
  if (recordId !== null && recordId !== undefined) return `id:${recordId}`;

  const userId = u?.user_id ?? null;
  if (userId !== null && userId !== undefined && String(userId).trim() !== "")
    return `user_id:${String(userId)}`;

  const email = (u?.email || "").trim().toLowerCase();
  if (email) return `email:${email}`;

  // last-resort stable-ish: name+phone
  const name = (u?.name || "").trim().toLowerCase();
  const phone = (u?.phone || "").trim();
  return `fallback:${name}:${phone}`;
}

const UserRow = React.memo(function UserRow({ user, onOpenHistory, onEdit, onRestore, onDelete }) {
  const recordId = getUserRecordId(user);
  const userId = user?.user_id ?? "-";
  const isDeleted = !!user?.deleted_at;

  return (
    <tr onClick={() => onOpenHistory(user)} style={{ cursor: "pointer" }} title="Click to view user history">
      <td>{userId}</td>
      <td>{user?.name ?? "-"}</td>
      <td className="text-break">{user?.email ?? "-"}</td>
      <td>{user?.phone ?? "-"}</td>
      <td>{roleBadge(user?.role)}</td>
      <td>
        {isDeleted ? (
          <span className="badge bg-warning text-dark">Deleted</span>
        ) : (
          <span className="badge bg-success">Active</span>
        )}
      </td>

      <td style={{ verticalAlign: "middle" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            flexWrap: "nowrap",
            whiteSpace: "nowrap",
            minHeight: "100%",
          }}
        >
          <button
            className="btn btn-sm btn-outline-info"
            onClick={(event) => {
              event.stopPropagation();
              onEdit(user);
            }}
            disabled={isDeleted}
            title={isDeleted ? "Restore user first to update" : "Update"}
            style={{ minWidth: 70 }}
          >
            Update
          </button>

          {isDeleted ? (
            <button
              className="btn btn-sm btn-outline-warning"
              onClick={(event) => {
                event.stopPropagation();
                onRestore(recordId ?? userId);
              }}
              style={{ minWidth: 70 }}
            >
              Restore
            </button>
          ) : (
            <button
              className="btn btn-sm btn-outline-danger"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(recordId ?? userId);
              }}
              style={{ minWidth: 70 }}
            >
              Delete
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

export default function AdminUsers() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  // Set when the backend returns Laravel-style pagination metadata; when null
  // the table keeps running in pure client-side mode (previous behaviour).
  const [serverMeta, setServerMeta] = useState(null);

  // Always keep the latest `load` here so stable (useCallback) row handlers
  // can trigger a refresh without recreating themselves every render.
  const loadRef = useRef(null);
  
  // Force disable autofill for search input
  const searchInputRef = React.useRef(null);

  // Pagination (client-side)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const [savingCreate, setSavingCreate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const [createForm, setCreateForm] = useState({ ...emptyCreate });
  const [editForm, setEditForm] = useState({ ...emptyEdit });
  const [editOriginal, setEditOriginal] = useState({ ...emptyEdit });

  const handleCreateUserIdChange = (value) => {
    const sanitized = value.replace(/\D/g, "").slice(0, 5);
    setCreateForm((prev) => ({ ...prev, user_id: sanitized }));
  };

  const load = async (options = {}) => {
    setMsg(null);
    setLoading(true);
    try {
      const params = {};
      const term = (options.search ?? query).trim();
      if (term) params.search = term;
      // Send pagination hints. If the backend supports them it returns a
      // paginated envelope and we switch to server mode; if it ignores them
      // it returns a plain array and we keep working in client mode.
      params.page = options.page ?? page;
      params.per_page = pageSize;

      const res = await axiosClient.get("/users", { params });
      const parsed = parseUsersResponse(res.data);
      const list = parsed.users;

      // 🔍 DEBUG: Check if backend returns database 'id' field
      if (list.length > 0) {
        const sampleUser = list[0];
        if (!("id" in sampleUser)) {
          console.error("❌ CRITICAL: Backend /users endpoint does NOT return 'id' field!");
          console.error("❌ This will cause user history mismatch. Backend must return database primary key as 'id'.");
        }
      }
  
      setUsers(list);
      setServerMeta(
        parsed.mode === "server"
          ? {
              page: parsed.page,
              perPage: parsed.perPage,
              total: parsed.total,
              lastPage: parsed.lastPage,
            }
          : null
      );
      if (options.resetPage) setPage(1);
    } catch (e) {
      setMsg({
        type: "danger",
        text:
          e?.response?.data?.message ||
          `Failed to load users (status: ${e?.response?.status || "unknown"}).`,
      });
    } finally {
      setLoading(false);
    }
  };

  // Keep the latest `load` reference up to date so stable handlers can use it.
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Server mode: refetch when page / page-size / search change. Debounced so
  // typing a search term doesn't fire a request per keystroke.
  useEffect(() => {
    if (!serverMeta) return undefined;
    const timer = window.setTimeout(() => load(), 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, page, pageSize]);

  // Disable autocomplete attribute on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.setAttribute('autocomplete', 'off');
      searchInputRef.current.setAttribute('data-lpignore', 'true');
    }
  }, []);

  const filtered = useMemo(() => {
    // Server mode: the backend already filtered + paged the results.
    if (serverMeta) return users;
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const vals = [u?.user_id, u?.name, u?.email, u?.phone, u?.role].map((v) =>
        (v || "").toString().toLowerCase()
      );
      return vals.some((v) => v.includes(q));
    });
  }, [users, query, serverMeta]);

  useEffect(() => setPage(1), [query, pageSize]);

  const totalPages = serverMeta
    ? Math.max(1, Number(serverMeta.lastPage) || 1)
    : Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = useMemo(() => {
    // Server mode: rows already paged server-side.
    if (serverMeta) return users;
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [serverMeta, users, filtered, page, pageSize]);

  const goTo = (p) => setPage(Math.min(Math.max(1, p), totalPages));

  // --------- Create ----------
  const openCreate = () => {
    setMsg(null);
    setCreateForm({ ...emptyCreate });
    setShowCreate(true);
  };

  const closeCreate = () => {
    setShowCreate(false);
    setSavingCreate(false);
  };

  const submitCreate = async () => {
    setMsg(null);
    setSavingCreate(true);
    try {
      if (!createForm.user_id) {
        setMsg({ type: "danger", text: "User ID is required." });
        setSavingCreate(false);
        return;
      }

      await axiosClient.post("/admin/register", {
        user_id: createForm.user_id || undefined,
        card_id: createForm.card_id || undefined,
        name: normalizeName(createForm.name),
        email: createForm.email,
        phone: createForm.phone,
        role: createForm.role,
        password: createForm.password,
        password_confirmation: createForm.password_confirmation,
      });

      setMsg({ type: "success", text: "User created successfully." });
      setShowCreate(false);
      await load();
    } catch (e) {
      setMsg({ type: "danger", text: e?.response?.data?.message || "Create failed." });
    } finally {
      setSavingCreate(false);
    }
  };

  // --------- Edit ----------
  const openEdit = useCallback((u) => {
    setMsg(null);

    const recordId = getUserRecordId(u);
    if (!recordId) {
      setMsg({ type: "danger", text: "This user is missing a server ID. Please refresh the list." });
      return;
    }

    const next = {
      id: recordId,
      user_id: u?.user_id ?? "",
      name: u?.name || "",
      email: u?.email || "",
      phone: u?.phone || "",
      role: (u?.role || "user").toLowerCase(),
      password: "",
      password_confirmation: "",
    };

    setEditForm(next);
    setEditOriginal(next);
    setShowEdit(true);
  }, []);

  const closeEdit = () => {
    setShowEdit(false);
    setSavingEdit(false);
  };

  const submitEdit = async () => {
    setMsg(null);
    setSavingEdit(true);

    try {
      if (!editForm.id) {
        setMsg({ type: "danger", text: "Missing user id for this record." });
        setSavingEdit(false);
        return;
      }

      const trimmedPassword = editForm.password.trim();
      const trimmedConfirmation = editForm.password_confirmation.trim();

      if (!trimmedPassword && trimmedConfirmation) {
        setMsg({ type: "danger", text: "Please enter a new password to confirm." });
        setSavingEdit(false);
        return;
      }

      if (trimmedPassword && trimmedPassword !== trimmedConfirmation) {
        setMsg({ type: "danger", text: "Passwords do not match." });
        setSavingEdit(false);
        return;
      }

      const payload = {};
      const trimmedName = normalizeName(editForm.name);
      const trimmedEmail = editForm.email.trim();
      const trimmedPhone = editForm.phone.trim();

      const originalName = (editOriginal.name || "").trim();
      const originalEmail = (editOriginal.email || "").trim();
      const originalPhone = (editOriginal.phone || "").trim();
      const originalRole = (editOriginal.role || "").trim();

      if (trimmedName !== originalName) payload.name = trimmedName;
      if (trimmedEmail !== originalEmail) payload.email = trimmedEmail;
      if (trimmedPhone !== originalPhone) payload.phone = trimmedPhone;
      if (editForm.role !== originalRole) payload.role = editForm.role;

      if (trimmedPassword) {
        payload.password = trimmedPassword;
        payload.password_confirmation = trimmedConfirmation;
      }

      if (Object.keys(payload).length === 0) {
        setMsg({ type: "danger", text: "No changes detected." });
        setSavingEdit(false);
        return;
      }

      await axiosClient.patch(`/users/${editForm.id}`, payload);

      setMsg({ type: "success", text: "User updated successfully." });
      setShowEdit(false);
      await load();
    } catch (e) {
      if (e?.response?.status === 404) {
        setMsg({ type: "danger", text: "This user no longer exists. Please refresh the list." });
        setShowEdit(false);
        await load();
        return;
      }
      setMsg({
        type: "danger",
        text:
          e?.response?.data?.message ||
          `Update failed (status: ${e?.response?.status || "unknown"}).`,
      });
    } finally {
      setSavingEdit(false);
    }
  };

  // --------- Delete / Restore ----------
  const destroy = useCallback(async (id) => {
    if (!id) {
      setMsg({ type: "danger", text: "This user is missing a server ID. Please refresh the list." });
      return;
    }
    if (!confirm("Delete this user?")) return;

    setMsg(null);
    try {
      await axiosClient.delete(`/users/${id}/force`);
      setMsg({ type: "success", text: "User deleted successfully." });
      await loadRef.current?.();
    } catch (e) {
      setMsg({ type: "danger", text: e?.response?.data?.message || "Delete failed." });
    }
  }, []);

  const restore = useCallback(async (id) => {
    if (!id) {
      setMsg({ type: "danger", text: "This user is missing a server ID. Please refresh the list." });
      return;
    }
    setMsg(null);
    try {
      await axiosClient.post(`/users/${id}/restore`);
      setMsg({ type: "success", text: "User restored." });
      await loadRef.current?.();
    } catch (e) {
      setMsg({ type: "danger", text: e?.response?.data?.message || "Restore failed." });
    }
  }, []);

  const openHistory = useCallback((u) => {
    const recordId = getUserRecordId(u);
    const userRole = String(u?.role || "").toLowerCase();

    if (!recordId) {
      setMsg({ type: "danger", text: "This user is missing a users.id value. Please refresh the list." });
      return;
    }
    
    // Navigate to appropriate history page based on role
    if (userRole === "trainer") {
      navigate(`/admin/trainers/${recordId}/history`, { state: { trainer: u, user: u } });
    } else {
      navigate(`/admin/users/${recordId}/history`, { state: { user: u } });
    }
  }, [navigate]);

  return (
    <div className="admin-card p-4">
      {/* Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h4 className="mb-1">Users Mangement</h4>
        </div>

        <div className="d-flex gap-2">
          <button className="btn btn-outline-light" onClick={load} disabled={loading}>
            <i className="bi bi-arrow-clockwise me-2"></i>
            {loading ? <Loading inline size={16} text="" /> : "Refresh"}
          </button>

          <button className="btn btn-primary" onClick={openCreate}>
            <i className="bi bi-person-plus me-2"></i>Create User
          </button>
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Search + page size */}
      <div className="row g-2 align-items-center mb-3">
        <div className="col-md-6">
          <input
            ref={searchInputRef}
            type="search"
            className="form-control admin-search-input"
            placeholder="Search name / email / phone / role"
            value={query}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            name="admin-user-search-filter"
            id="admin-user-search"
            data-form-type="other"
            data-lpignore="true"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="col-md-6 d-flex justify-content-md-end gap-2">
          <div className="d-flex align-items-center gap-2">
            <span className="text-white small">Rows</span>
            <select
              className="form-select form-select-sm bg-dark"
              style={{ width: 90 }}
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={5} className="text-light fw-bold">5</option>
              <option value={10} className="text-light fw-bold">10</option>
              <option value={20} className="text-light fw-bold">20</option>
              <option value={50} className="text-light fw-bold">50</option>
            </select>
          </div>

          <div className="text-white small align-self-center">
            Total: <b>{filtered.length}</b>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive">
        <table className="table table-dark table-hover align-middle mb-0">
          <thead>
            <tr>
              <th style={{ width: 120 }}>User ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th style={{ width: 140 }}>Role</th>
              <th style={{ width: 140 }}>Status</th>
              <th style={{ width: 130 }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center text-muted py-4">
                  {loading ? <Loading inline size={20} text="Loading..." /> : "No users found."}
                </td>
              </tr>
            ) : (
              pageItems.map((u) => {
                const rowKey = getStableRowKey(u); // ✅ FIXED KEY
                return (
                  <UserRow
                    key={rowKey}
                    user={u}
                    onOpenHistory={openHistory}
                    onEdit={openEdit}
                    onRestore={restore}
                    onDelete={destroy}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
        <div className="text-white small">
          Page <b>{page}</b> of <b>{totalPages}</b>
        </div>

        <div className="btn-group">
          <button className="btn btn-outline-light btn-sm fw-bold" onClick={() => goTo(1)} disabled={page === 1}>
            « First
          </button>
          <button className="btn btn-outline-light btn-sm fw-bold" onClick={() => goTo(page - 1)} disabled={page === 1}>
            ‹ Prev
          </button>
          <button className="btn btn-outline-light btn-sm fw-bold" onClick={() => goTo(page + 1)} disabled={page === totalPages}>
            Next ›
          </button>
          <button className="btn btn-outline-light btn-sm fw-bold" onClick={() => goTo(totalPages)} disabled={page === totalPages}>
            Last »
          </button>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content bg-dark text-white admin-modal">
                <div className="modal-header">
                  <h5 className="modal-title fw-bold">Create User</h5>
                  <button className="btn-close btn-close-white" onClick={closeCreate}></button>
                </div>

                <div className="modal-body">
                  <div className="mb-2">
                    <label className="form-label fw-bold">User ID</label>
                    <input
                      className="form-control"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={5}
                      autoComplete="off"
                      name="create-user-id"
                      value={createForm.user_id}
                      onChange={(e) => handleCreateUserIdChange(e.target.value)}
                      placeholder="Up to 5 digits"
                      required
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label fw-bold">Name</label>
                    <input
                      className="form-control"
                      autoComplete="off"
                      name="create-name"
                      placeholder="Enter user name"
                      value={createForm.name}
                      title="Name can contain letters, numbers, and spaces only."
                      onChange={(e) =>
                        setCreateForm({ ...createForm, name: sanitizeNameInput(e.target.value) })
                      }
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label fw-bold">Card ID</label>
                    <input
                      className="form-control"
                      value={createForm.card_id}
                      autoComplete="off"
                      name="create-card-id"
                      onChange={(e) => setCreateForm({ ...createForm, card_id: e.target.value })}
                      placeholder="RFID card ID (optional)"
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label fw-bold">Email</label>
                    <input
                      className="form-control"
                      type="email"
                      value={createForm.email}
                      autoComplete="off"
                      name="create-email"
                      placeholder="Enter user email"
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label fw-bold">Phone</label>
                    <input
                      className="form-control"
                      autoComplete="new-password"
                      name="create-phone"
                      placeholder="Enter user phone number"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label fw-bold">Role</label>
                    <select
                      className="form-select bg-dark text-white"
                      style={{ backgroundColor: "#212529", color: "#fff" }}
                      value={createForm.role}
                      onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    >
                     <option value="user" className="fw-bold text-white" style={{ color: "#fff", backgroundColor: "#212529" }}>User</option>
                      <option value="trainer" className="fw-bold text-white" style={{ color: "#fff", backgroundColor: "#212529" }}>Trainer</option>
                    </select>
                  </div>

                  <div className="mb-2">
                    <label className="form-label fw-bold">Password</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Enter user password"
                      value={createForm.password}
                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="form-label fw-bold">Confirm Password</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Confirm user password"
                      value={createForm.password_confirmation}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, password_confirmation: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button className="btn btn-outline-light" onClick={closeCreate} disabled={savingCreate}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={submitCreate} disabled={savingCreate}>
                    {savingCreate ? "Saving..." : "Create"}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content bg-dark text-white admin-modal">
                <div className="modal-header">
                  <h5 className="modal-title">Update User</h5>
                  <button className="btn-close btn-close-white" onClick={closeEdit}></button>
                </div>

                <div className="modal-body">
                  <div className="mb-2">
                    <label className="form-label fw-bold">User ID</label>
                    <input className="form-control" value={editForm.user_id || ""} disabled readOnly />
                  </div>

                  <div className="mb-2">
                    <label className="form-label fw-bold">Name</label>
                    <input
                      className="form-control"
                      value={editForm.name}
                      title="Name can contain letters, numbers, and spaces only."
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: sanitizeNameInput(e.target.value) })
                      }
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label fw-bold">Email</label>
                    <input
                      className="form-control"
                      value={editForm.email}
                      autoComplete="off"
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label fw-bold">Phone</label>
                    <input
                      className="form-control"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="form-label fw-bold">Role</label>
                    <select
                     className="form-select bg-dark text-white"
                      style={{ backgroundColor: "#212529", color: "#fff" }}
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    >
                      <option value="user" className="fw-bold text-white" style={{ color: "#fff", backgroundColor: "#212529" }}>User</option>
                      <option value="trainer" className="fw-bold text-white" style={{ color: "#fff", backgroundColor: "#212529" }}>Trainer</option>
                    </select>
                  </div>

                  <div className="mt-2">
                    <label className="form-label fw-bold">New Password</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Enter user password"
                      autoComplete="new-password"
                      value={editForm.password}
                      onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    />
                  </div>

                  <div className="mt-2">
                    <label className="form-label fw-bold">Confirm Password</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Confirm user password"
                      autoComplete="new-password"
                      value={editForm.password_confirmation}
                      onChange={(e) =>
                        setEditForm({ ...editForm, password_confirmation: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button className="btn btn-outline-light" onClick={closeEdit} disabled={savingEdit}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={submitEdit} disabled={savingEdit}>
                    {savingEdit ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}
    </div>
  );
}
