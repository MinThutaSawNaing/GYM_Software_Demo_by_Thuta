import React, { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Loading from "./components/Loading";
import PageLoadingOverlay from "./components/PageLoadingOverlay";

const Login = lazy(() => import("./pages/public/Login"));
const Register = lazy(() => import("./pages/public/Register"));
const VerifyEmail = lazy(() => import("./pages/public/VerifyEmail"));

/* Admin */
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminSubscriptions = lazy(() => import("./pages/admin/AdminSubscriptions"));
const AdminClassSubscriptions = lazy(() => import("./pages/admin/AdminClassSubscriptions"));
const AdminPricing = lazy(() => import("./pages/admin/AdminPricing"));
const AdminTrainerBookings = lazy(() =>import("./pages/admin/AdminTrainerBookings"));
const AdminBoxingBookings = lazy(() =>import("./pages/admin/AdminBoxingBookings"));
const AdminAttendance = lazy(() => import("./pages/admin/AdminAttendance"));
const AdminRfidRegister = lazy(() => import("./pages/admin/RfidRegister"));
const AdminMessages = lazy(() => import("./pages/admin/AdminMessages"));
const AdminBlogs = lazy(() => import("./pages/admin/AdminBlogs"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminUserHistory = lazy(() => import("./pages/admin/AdminUserHistory"));
const AdminPoints = lazy(() => import("./pages/admin/AdminPoints"));

/* Trainer */
const TrainerLayout = lazy(() => import("./layouts/TrainerLayout"));
const TrainerHome = lazy(() => import("./pages/trainer/TrainerHome"));
const TrainerScan = lazy(() => import("./pages/trainer/TrainerScan"));
const TrainerMessages = lazy(() => import("./pages/trainer/TrainerMessages"));
const TrainerBookings = lazy(() => import("./pages/trainer/TrainerBookings"));
const TrainerBlogDetails = lazy(() =>
  import("./pages/trainer/TrainerBlogDetails")
);
const TrainerSettings = lazy(() => import("./pages/trainer/TrainerSettings"));
const Notifications = lazy(() => import("./pages/shared/Notifications"));

/* User */
const UserLayout = lazy(() => import("./layouts/UserLayout"));
const UserHome = lazy(() => import("./pages/user/UserHome"));
const UserScan = lazy(() => import("./pages/user/UserScan"));
const UserBlogDetails = lazy(() => import("./pages/user/UserBlogDetails"));
const UserAttendance = lazy(() => import("./pages/user/UserAttendance"));
const UserSubsBookings = lazy(() => import("./pages/user/UserSubsBookings"));
const UserMessages = lazy(() => import("./pages/user/UserMessages"));
const UserSettings = lazy(() => import("./pages/user/UserSettings"));
const UserClassSubscriptions = lazy(() => import("./pages/user/UserClassSubscriptions"));

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}
function getUser() {
  const raw = localStorage.getItem("user") || sessionStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normRole(role) {
  return String(role || "").trim().toLowerCase();
}

function getDefaultRouteByRole(user) {
  const role = normRole(user?.role);

  if (role === "administrator" || role === "admin") return "/admin/dashboard";
  if (role === "trainer") return "/trainer/home";
  return "/user/home";
}

function Protected({ children }) {
  const token = getToken();
  return token ? children : <Navigate to="/login" replace />;
}

function PublicOnly({ children }) {
  const token = getToken();
  if (!token) return children;

  const user = getUser();
  return <Navigate to={getDefaultRouteByRole(user)} replace />;
}

function RoleOnly({ role, children }) {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;

  const need = normRole(role);
  const have = normRole(user.role);

  // allow "admin" alias
  if (need === "administrator" && (have === "administrator" || have === "admin"))
    return children;

  return have === need ? children : <Navigate to="/login" replace />;
}

// Warm up all lazy chunks after first paint so switching tabs never hits
// the network — this is what makes tab-to-tab navigation feel instant.
const lazyImports = [
  () => import("./pages/public/Login"),
  () => import("./pages/public/Register"),
  () => import("./pages/public/VerifyEmail"),
  () => import("./layouts/AdminLayout"),
  () => import("./pages/admin/AdminDashboard"),
  () => import("./pages/admin/AdminUsers"),
  () => import("./pages/admin/AdminSubscriptions"),
  () => import("./pages/admin/AdminClassSubscriptions"),
  () => import("./pages/admin/AdminPricing"),
  () => import("./pages/admin/AdminTrainerBookings"),
  () => import("./pages/admin/AdminBoxingBookings"),
  () => import("./pages/admin/AdminAttendance"),
  () => import("./pages/admin/RfidRegister"),
  () => import("./pages/admin/AdminMessages"),
  () => import("./pages/admin/AdminBlogs"),
  () => import("./pages/admin/AdminSettings"),
  () => import("./pages/admin/AdminUserHistory"),
  () => import("./pages/admin/AdminPoints"),
  () => import("./layouts/TrainerLayout"),
  () => import("./pages/trainer/TrainerHome"),
  () => import("./pages/trainer/TrainerScan"),
  () => import("./pages/trainer/TrainerMessages"),
  () => import("./pages/trainer/TrainerBookings"),
  () => import("./pages/trainer/TrainerBlogDetails"),
  () => import("./pages/trainer/TrainerSettings"),
  () => import("./pages/shared/Notifications"),
  () => import("./layouts/UserLayout"),
  () => import("./pages/user/UserHome"),
  () => import("./pages/user/UserScan"),
  () => import("./pages/user/UserBlogDetails"),
  () => import("./pages/user/UserAttendance"),
  () => import("./pages/user/UserSubsBookings"),
  () => import("./pages/user/UserMessages"),
  () => import("./pages/user/UserSettings"),
  () => import("./pages/user/UserClassSubscriptions"),
];

export default function App() {
  // Preload all lazy chunks as early as possible (in the background).
  useEffect(() => {
    const id = window.setTimeout(() => {
      Promise.allSettled(lazyImports.map((load) => load()));
    }, 400);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <Suspense fallback={<Loading full text="Loading page..." />}>
      <PageLoadingOverlay minMs={250} text="Refreshing...">
        <Routes>
        <Route
          path="/"
          element={
            getToken() ? (
              <Navigate to={getDefaultRouteByRole(getUser())} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Public */}
        <Route
          path="/login"
          element={
            <PublicOnly>
              <Login />
            </PublicOnly>
          }
        />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        {/* Admin */}
        <Route
          path="/admin"
          element={
            <Protected>
              <RoleOnly role="administrator">
                <AdminLayout />
              </RoleOnly>
            </Protected>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="users/:id/history" element={<AdminUserHistory />} />
          <Route path="trainers/:id/history" element={<AdminUserHistory />} />
          <Route path="subscriptions" element={<AdminSubscriptions />} />
          <Route path="subscriptions/classes" element={<AdminClassSubscriptions />} />
          <Route path="pricing" element={<AdminPricing />} />
          <Route path="trainer-bookings" element={<AdminTrainerBookings />} />
          <Route path="boxing-bookings" element={<AdminBoxingBookings />} />
          <Route path="attendance" element={<AdminAttendance />} />
          <Route path="attendance/rfid-register" element={<AdminRfidRegister />} />
          <Route path="messages" element={<AdminMessages />} />
          <Route path="blogs" element={<AdminBlogs />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="points" element={<AdminPoints />} />
        </Route>

        {/* User ✅ FIXED (nested routes correctly under /user) */}
        <Route
          path="/user"
          element={
            <Protected>
              <RoleOnly role="user">
                <UserLayout />
              </RoleOnly>
            </Protected>
          }
        >
          <Route index element={<Navigate to="/user/home" replace />} />
          <Route path="home" element={<UserHome />} />
          <Route path="scan" element={<UserScan />} />
          <Route path="blogs/:id" element={<UserBlogDetails />} />
          <Route path="attendance" element={<UserAttendance />} />
          <Route path="subs-books" element={<UserSubsBookings />} />
          <Route path="class-subscriptions" element={<UserClassSubscriptions />} />
          <Route path="subscriptions" element={<Navigate to="/user/subs-books" replace />} />
          <Route path="bookings" element={<Navigate to="/user/subs-books" replace />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="messages" element={<UserMessages />} />
          <Route path="settings" element={<UserSettings />} />
        </Route>

        {/* Trainer */}
        <Route
          path="/trainer"
          element={
            <Protected>
              <RoleOnly role="trainer">
                <TrainerLayout />
              </RoleOnly>
            </Protected>
          }
        >
          <Route index element={<Navigate to="/trainer/home" replace />} />
          <Route path="home" element={<TrainerHome />} />
          <Route path="scan" element={<TrainerScan />} />
          <Route path="messages" element={<TrainerMessages />} />
          <Route path="bookings" element={<TrainerBookings />} />
          <Route path="blogs/:id" element={<TrainerBlogDetails />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<TrainerSettings />} />
        </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </PageLoadingOverlay>
    </Suspense>
  );
}
