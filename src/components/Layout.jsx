
import React, { useState } from "react";

import {
  CalendarDays,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
  X,
  UserRound,
  Save
} from "lucide-react";

import { useAuth } from "../auth";
import { endShift } from "../api";

export default function Layout({ tab, setTab, children }) {
  const { profile, logout, saveName } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const displayName = profile?.displayName || "";

  const canViewTeam =
    profile?.role === "lead" || profile?.role === "admin";

  const items = [
    ["overview", "Overview", LayoutDashboard],
    ["history", "My history", CalendarDays],
    ...(canViewTeam
      ? [["team", "Team attendance", Users]]
      : []),
    ...(profile?.role === "admin"
      ? [["employees", "Employees", ShieldCheck]]
      : [])
  ];

  const openProfile = () => {
    setName(displayName);
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const closeProfile = () => {
    if (!saving) setModalOpen(false);
  };

  const handleSave = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await saveName(name);
      setSuccess("Your name has been saved!");
      setTimeout(() => setModalOpen(false), 1000);
    } catch (err) {
      console.error("Name update error:", err);
      setError(
        err.message || "Could not save your name. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const safeLogout = async () => {
    try {
      await endShift();
    } catch (error) {
      if (error.code !== "functions/failed-precondition") {
        console.error(error);
      }
    } finally {
      await logout();
    }
  };

  return (
    <div className="app-shell">

      <aside className="sidebar">
        <div className="brand">
          <img
            src="/digitide-logo.png"
            alt="DigiTide Logo"
            style={{
              width: "42px",
              height: "42px",
              objectFit: "contain",
              borderRadius: "50%",
              flexShrink: 0
            }}
          />
          <span>DigiTide</span>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav>
          {items.map(([id, label, Icon]) => (
            <button
              key={id}
              className={`nav-item ${tab === id ? "active" : ""}`}
              onClick={() => setTab(id)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        <div className="side-bottom">
          <div className="secure">
            <ShieldCheck size={16} />
            <span>
              DigiTide workspace
              <br />
              <small>Secure attendance</small>
            </span>
          </div>

          <button
            className="nav-item logout"
            onClick={safeLogout}
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">

        <header className="topbar">
          <div>
            <div className="eyebrow">
              WORKSPACE / {tab.toUpperCase()}
            </div>

            <div className="top-title">
              {tab === "overview"
                ? "Dashboard"
                : tab === "history"
                ? "My shift history"
                : tab === "team"
                ? "Team attendance"
                : "Employee management"}
            </div>
          </div>

          <button
            type="button"
            className="user-chip"
            onClick={openProfile}
            title="Edit your profile"
            style={{
              cursor: "pointer",
              border: "none",
              font: "inherit",
              textAlign: "left"
            }}
          >
            <div className="avatar">
              {(displayName || "U").charAt(0).toUpperCase()}
            </div>

            <div>
              <b>{displayName || "Set your name"}</b>
              <small>
                {profile?.role === "lead"
                  ? "Team Lead"
                  : profile?.role === "admin"
                  ? "Admin"
                  : profile?.role || "Employee"}
              </small>
            </div>
          </button>
        </header>

        <div className="content">
          {children}
        </div>
      </main>

      {modalOpen && (
        <div
          onClick={closeProfile}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px"
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              background: "#ffffff",
              color: "#18202b",
              padding: "28px",
              borderRadius: "18px",
              width: "100%",
              maxWidth: "420px",
              boxSizing: "border-box",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px"
              }}
            >
              <h2 style={{ margin: 0 }}>My Profile</h2>

              <button
                type="button"
                onClick={closeProfile}
                disabled={saving}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer"
                }}
              >
                <X size={22} />
              </button>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "24px"
              }}
            >
              <UserRound size={36} />

              <div>
                <strong>{profile?.email}</strong>
                <div style={{ fontSize: "13px", color: "#667085" }}>
                  DigiTide employee
                </div>
              </div>
            </div>

            <form onSubmit={handleSave}>
              <label
                htmlFor="employeeName"
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: 600
                }}
              >
                Employee full name
              </label>

              <input
                id="employeeName"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your full name"
                minLength={2}
                maxLength={80}
                required
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "13px",
                  border: "1px solid #d0d5dd",
                  borderRadius: "9px",
                  marginBottom: "16px",
                  fontSize: "15px"
                }}
              />

              {error && (
                <p style={{ color: "#dc2626", fontSize: "13px" }}>
                  {error}
                </p>
              )}

              {success && (
                <p style={{ color: "#15803d", fontSize: "13px" }}>
                  {success}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                style={{
                  width: "100%",
                  padding: "13px",
                  border: "none",
                  borderRadius: "9px",
                  background: "#3156d3",
                  color: "#ffffff",
                  fontWeight: 600,
                  cursor: saving ? "wait" : "pointer"
                }}
              >
                <Save
                  size={16}
                  style={{
                    verticalAlign: "middle",
                    marginRight: "8px"
                  }}
                />
                {saving ? "Saving..." : "Save changes"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
