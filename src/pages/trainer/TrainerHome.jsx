import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  FiArrowRight,
  FiBell,
  FiCalendar,
  FiClock,
  FiImage,
  FiLogIn,
  FiUsers,
} from "react-icons/fi";
import axiosClient from "../../api/axiosClient";
import { getBlogs } from "../../api/trainerApi";
import useRealtimePolling from "../../hooks/useRealtimePolling";
import "./TrainerHome.css";

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.blogs)) return payload.blogs;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
}

function normalizeBookings(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.bookings)) return payload.bookings;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.bookings)) return payload.data.bookings;
  if (Array.isArray(payload?.bookings?.data)) return payload.bookings.data;
  return [];
}

function getServerOrigin() {
  const apiBase =
    import.meta.env.VITE_API_URL || "https://api.unityfitnessmyanmar.online/api";
  return apiBase.replace(/\/api\/?$/, "");
}

function buildImageUrl(value) {
  if (!value || ["attach photo", "attach image", "no image", "null"].includes(String(value).trim().toLowerCase())) {
    return null;
  }

  const raw = String(value).trim();
  if (/^https?:\/\//.test(raw)) return raw;

  const cleaned = raw.replace(/^\/+/, "");
  return `${getServerOrigin()}/${cleaned.startsWith("storage/") ? cleaned : `storage/${cleaned}`}`;
}

function resolveBlogImage(blog) {
  return buildImageUrl(
    blog?.cover_image_url ||
      blog?.coverImageUrl ||
      blog?.image_url ||
      blog?.imageUrl ||
      blog?.cover_image_path ||
      blog?.coverImagePath ||
      blog?.cover_image ||
      blog?.image
  );
}

function getBookingDate(booking) {
  const value =
    booking?.session_datetime ||
    booking?.session_time ||
    booking?.datetime ||
    booking?.date_time ||
    booking?.starts_at ||
    booking?.start_time ||
    booking?.date ||
    booking?.start_date;
  if (!value) return null;
  const parsed = new Date(String(value).includes("T") ? value : String(value).replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getMemberName(booking) {
  return booking?.member_name || booking?.member?.name || booking?.user?.name || "Member";
}

function getTrainerName() {
  try {
    const raw = localStorage.getItem("user") || sessionStorage.getItem("user");
    return raw ? JSON.parse(raw)?.name?.split(" ")[0] || "Trainer" : "Trainer";
  } catch {
    return "Trainer";
  }
}

function isSameDay(a, b) {
  return a?.getFullYear() === b.getFullYear() &&
    a?.getMonth() === b.getMonth() &&
    a?.getDate() === b.getDate();
}

function formatArticleDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date)
    : "";
}

async function getBoxingBookings() {
  try {
    return await axiosClient.get("/trainer/boxing-bookings");
  } catch (error) {
    if (![404, 405].includes(error?.response?.status)) throw error;
    return axiosClient.get("/trainer/boxing-subscriptions");
  }
}

const BlogThumbnail = memo(function BlogThumbnail({ src, alt }) {
  const [failed, setFailed] = useState(false);

  return (
    <span className="trainer-home-update-image">
      {src && !failed ? (
        <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <FiImage aria-hidden="true" />
      )}
    </span>
  );
});

export default function TrainerHome() {
  const navigate = useNavigate();
  const { unreadCount = 0 } = useOutletContext() || {};
  const signatureRef = useRef("");
  const [blogs, setBlogs] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const fetchDashboard = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setErr("");

    const results = await Promise.allSettled([
      getBlogs(),
      axiosClient.get("/trainer/subscriptions"),
      getBoxingBookings(),
    ]);

    const [blogResult, trainerResult, boxingResult] = results;
    if (blogResult.status === "fulfilled") {
      const sorted = normalizeList(blogResult.value.data).sort((a, b) =>
        new Date(b?.published_at || b?.publish_date || b?.updated_at || 0) -
        new Date(a?.published_at || a?.publish_date || a?.updated_at || 0)
      );
      const signature = sorted.map((blog) => `${blog?.id}:${blog?.updated_at || blog?.title}`).join("|");
      if (signature !== signatureRef.current) {
        signatureRef.current = signature;
        setBlogs(sorted);
      }
    }

    const nextBookings = [trainerResult, boxingResult].flatMap((result) =>
      result.status === "fulfilled" ? normalizeBookings(result.value.data) : []
    );
    setBookings(nextBookings);

    if (results.every((result) => result.status === "rejected")) {
      setErr("Dashboard data could not be loaded. Please try again.");
    }
    if (!silent) setLoading(false);
  }, []);

  useRealtimePolling(fetchDashboard, 15000, [fetchDashboard]);

  const today = useMemo(() => new Date(), []);
  const todayBookings = bookings
    .filter((booking) => isSameDay(getBookingDate(booking), today))
    .sort((a, b) => getBookingDate(a) - getBookingDate(b));
  const activeBookings = bookings.filter((booking) =>
    !/(complete|cancel|expired)/i.test(String(booking?.status || ""))
  ).length;
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="trainer-home-page">
      <header className="trainer-home-header">
        <div>
          <p className="trainer-home-eyebrow">{greeting}</p>
          <h1>{getTrainerName()}</h1>
          <p className="trainer-home-date">
            {new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(today)}
          </p>
        </div>
        <button
          type="button"
          className="trainer-home-alert-button"
          onClick={() => navigate("/trainer/notifications")}
          aria-label={`${unreadCount} unread alert${unreadCount === 1 ? "" : "s"}`}
        >
          <FiBell aria-hidden="true" />
          {unreadCount > 0 && <span className="trainer-home-alert-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
        </button>
      </header>

      <button type="button" className="trainer-home-checkin" onClick={() => navigate("/trainer/scan")}>
        <span><FiLogIn aria-hidden="true" /></span>
        <span>
          <strong>Check in a member</strong>
          <small>Scan QR or RFID attendance</small>
        </span>
        <FiArrowRight aria-hidden="true" />
      </button>

      <section className="trainer-home-stats" aria-label="Today at a glance">
        <article>
          <FiCalendar aria-hidden="true" />
          <span><strong>{loading ? "–" : todayBookings.length}</strong><small>Sessions today</small></span>
        </article>
        <article>
          <FiUsers aria-hidden="true" />
          <span><strong>{loading ? "–" : activeBookings}</strong><small>Active bookings</small></span>
        </article>
      </section>

      {err && <div className="trainer-home-error" role="alert">{err}</div>}

      <section className="trainer-home-section" aria-labelledby="today-schedule-title">
        <div className="trainer-home-section-heading">
          <div>
            <p>Schedule</p>
            <h2 id="today-schedule-title">Today’s sessions</h2>
          </div>
          <button type="button" onClick={() => navigate("/trainer/bookings")}>See all</button>
        </div>

        {loading ? (
          <div className="trainer-home-skeleton" aria-label="Loading schedule" />
        ) : todayBookings.length === 0 ? (
          <div className="trainer-home-empty">
            <FiCalendar aria-hidden="true" />
            <div><strong>No sessions today</strong><span>Your schedule is clear for now.</span></div>
          </div>
        ) : (
          <div className="trainer-home-schedule-list">
            {todayBookings.slice(0, 3).map((booking, index) => {
              const date = getBookingDate(booking);
              return (
                <button type="button" key={booking?.id ?? index} onClick={() => navigate("/trainer/bookings")}>
                  <span className="trainer-home-time"><FiClock aria-hidden="true" />{date?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <span><strong>{getMemberName(booking)}</strong><small>{booking?.package_name || booking?.package?.name || "Training session"}</small></span>
                  <FiArrowRight aria-hidden="true" />
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="trainer-home-section" aria-labelledby="latest-updates-title">
        <div className="trainer-home-section-heading">
          <div>
            <p>Stay informed</p>
            <h2 id="latest-updates-title">Latest updates</h2>
          </div>
        </div>

        {loading ? (
          <div className="trainer-home-skeleton" aria-label="Loading updates" />
        ) : blogs.length === 0 ? (
          <div className="trainer-home-empty"><FiImage aria-hidden="true" /><div><strong>No updates yet</strong><span>New announcements will appear here.</span></div></div>
        ) : (
          <div className="trainer-home-update-list">
            {blogs.slice(0, 3).map((blog, index) => {
              const id = blog?.id;
              const date = blog?.published_at || blog?.publish_date || blog?.updated_at;
              return (
                <button type="button" key={id ?? index} onClick={() => id && navigate(`/trainer/blogs/${id}`, { state: { blog } })}>
                  <BlogThumbnail src={resolveBlogImage(blog)} alt="" />
                  <span className="trainer-home-update-copy">
                    <strong>{blog?.title || "Untitled update"}</strong>
                    <small>{formatArticleDate(date)}</small>
                  </span>
                  <FiArrowRight aria-hidden="true" />
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
