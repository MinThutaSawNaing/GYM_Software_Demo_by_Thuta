import React, { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { logoutApi } from "../api/authApi";
import { clearRequestCache } from "../api/axiosClient";
import AppScrollbar from "../components/AppScrollbar";
import PageTransition from "../components/PageTransition";
import "./AdminLayout.css";

// Prefetch admin page chunks ONLY when they are actually likely to be needed:
//  - the current page + the most common next page (Users) while the browser is idle
//  - a page as soon as the user hovers/focuses its sidebar link
// This keeps tab switching instant WITHOUT downloading every admin chunk at
// login (the old "preload all" approach caused a large network burst right
// after sign-in, which is exactly what made the UI feel laggy).
const ADMIN_PAGE_IMPORTERS = {
  "/admin/dashboard": () => import("../pages/admin/AdminDashboard"),
  "/admin/users": () => import("../pages/admin/AdminUsers"),
  "/admin/subscriptions": () => import("../pages/admin/AdminSubscriptions"),
  "/admin/subscriptions/classes": () => import("../pages/admin/AdminClassSubscriptions"),
  "/admin/pricing": () => import("../pages/admin/AdminPricing"),
  "/admin/trainer-bookings": () => import("../pages/admin/AdminTrainerBookings"),
  "/admin/boxing-bookings": () => import("../pages/admin/AdminBoxingBookings"),
  "/admin/attendance": () => import("../pages/admin/AdminAttendance"),
  "/admin/points": () => import("../pages/admin/AdminPoints"),
  "/admin/messages": () => import("../pages/admin/AdminMessages"),
  "/admin/blogs": () => import("../pages/admin/AdminBlogs"),
  "/admin/settings": () => import("../pages/admin/AdminSettings"),
};

const prefetchedAdminPages = new Set();

function prefetchAdminPage(pathname) {
  const loader = ADMIN_PAGE_IMPORTERS[pathname];
  if (!loader || prefetchedAdminPages.has(pathname)) return;
  prefetchedAdminPages.add(pathname);
  loader().catch(() => prefetchedAdminPages.delete(pathname)); // allow a retry on failure
}

export default function AdminLayout() {
  const nav = useNavigate();
  const location = useLocation();

  const sidebarRef = useRef(null);

  // Prefetch the current page + most likely next page (Users) when the
  // browser is idle, so the network is not saturated right after login.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 1000));
    const id = idle(() => {
      prefetchAdminPage(location.pathname);
      prefetchAdminPage("/admin/users");
    }, { timeout: 2000 });

    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(id);
      else clearTimeout(id);
    };
  }, [location.pathname]);

  // Prefetch a sidebar page the moment the user hovers or focuses its link,
  // so clicking still feels instant ("Loading page..." never appears).
  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return undefined;

    const onHover = (event) => {
      const link = event.target?.closest?.('a[href^="/admin/"]');
      if (link) prefetchAdminPage(link.getAttribute("href"));
    };

    sidebar.addEventListener("mouseover", onHover, { passive: true });
    sidebar.addEventListener("focusin", onHover);
    return () => {
      sidebar.removeEventListener("mouseover", onHover);
      sidebar.removeEventListener("focusin", onHover);
    };
  }, []);

  // Smoothly animate content when switching between sidebar links
  const locationKey = location.pathname + location.search;

  const logout = async () => {
    try {
      await logoutApi();
    } catch {
      // Ignore API errors — local auth state is cleared below regardless.
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    clearRequestCache();
    nav("/login");
  };

  return (
    <div className="admin-shell d-flex">
      {/* Sidebar */}
      <aside ref={sidebarRef} className="admin-sidebar">
        <AppScrollbar className="admin-sidebar-scroll" style={{ maxHeight: "100%" }}>
          <div className="p-3">
            <div className="mb-3 text-center">
              <i className="bi bi-snow3 admin-logo" aria-hidden="true" />
              <div className="admin-brand">WINTER ARC</div>
              <div className="admin-subtitle">Admin Dashboard</div>
            </div>

            <div className="d-flex flex-column gap-2">
              <NavLink to="/admin/dashboard" className={({isActive}) => `admin-link ${isActive ? "active" : ""}`}>
                <i className="bi bi-speedometer2"></i> Dashboard
              </NavLink>

              <NavLink to="/admin/users" className={({isActive}) => `admin-link ${isActive ? "active" : ""}`}>
                <i className="bi bi-people"></i> Users
              </NavLink>

              <NavLink to="/admin/subscriptions" className={({isActive}) => `admin-link ${isActive ? "active" : ""}`}>
                <i className="bi bi-credit-card-2-front"></i> Memberships
              </NavLink>

              <NavLink to="/admin/subscriptions/classes" className={({isActive}) => `admin-link ${isActive ? "active" : ""}`}>
                <i className="bi bi-collection-play"></i> Class Memberships
              </NavLink>

              <NavLink to="/admin/pricing" className={({isActive}) => `admin-link ${isActive ? "active" : ""}`}>
                <i className="bi bi-cash-coin"></i> Pricing
              </NavLink>

              <NavLink to="/admin/trainer-bookings" className={({isActive}) => `admin-link ${isActive ? "active" : ""}`}>
                <i className="bi bi-calendar-check"></i> Trainer Bookings
              </NavLink>
              
              <NavLink to="/admin/boxing-bookings" className={({isActive}) => `admin-link ${isActive ? "active" : ""}`}>
                <i className="bi bi-lightning-charge"></i> Boxing Bookings
              </NavLink>

              <NavLink to="/admin/attendance" className={({isActive}) => `admin-link ${isActive ? "active" : ""}`}>
                <i className="bi bi-credit-card-2-front-fill"></i> Attendance
              </NavLink>

              <NavLink to="/admin/points" className={({isActive}) => `admin-link ${isActive ? "active" : ""}`}>
                <i className="bi bi-award"></i> Points
              </NavLink>

              <NavLink to="/admin/messages" className={({isActive}) => `admin-link ${isActive ? "active" : ""}`}>
                <i className="bi bi-chat-dots"></i> Messages
              </NavLink>

              <NavLink to="/admin/blogs" className={({isActive}) => `admin-link ${isActive ? "active" : ""}`}>
                <i className="bi bi-journal-text"></i> Blogs
              </NavLink>

              <NavLink to="/admin/settings" className={({isActive}) => `admin-link ${isActive ? "active" : ""}`}>
                <i className="bi bi-gear"></i> Settings
              </NavLink>
            </div>

            <hr style={{ borderColor: "rgba(255,255,255,0.15)" }} />

            <button className="btn btn-outline-light w-100" onClick={logout}>
              <i className="bi bi-box-arrow-right me-2"></i> Logout
            </button>
          </div>
        </AppScrollbar>
      </aside>

      {/* Main */}
      <main className="admin-main">
        <AppScrollbar className="admin-main-scroll" style={{ maxHeight: "100%" }}>
          <div className="admin-main-inner">
            <div className="admin-topbar d-flex align-items-center justify-content-between mb-3">
              <div>
                <div style={{ fontWeight: 600 }}>Welcome, Admin</div>
                <div className="admin-muted small">Manage your gym system here</div>
              </div>
              <div className="small admin-muted">
                <i className="bi bi-shield-lock me-1"></i> Secure Admin
              </div>
            </div>

            <PageTransition transitionKey={locationKey}>
              <Outlet />
            </PageTransition>
          </div>
        </AppScrollbar>
      </main>
    </div>
  );
}
