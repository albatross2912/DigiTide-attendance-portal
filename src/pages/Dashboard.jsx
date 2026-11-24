
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import {
  CalendarDays,
  Clock3,
  Coffee,
  Download,
  LogOut,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  Timer,
  Users,
} from "lucide-react";

import { db } from "../firebase";
import { useAuth } from "../auth";
import {
  startShift,
  startBreak,
  endBreak,
  endShift,
} from "../api";

import { duration, dateLabel, csvDownload } from "../utils";
import Layout from "../components/Layout";

const breakTypes = ["Tea", "Lunch", "Short", "Meeting"];

function Stat({
  label,
  value,
  sub,
  icon: Icon,
  tint = "blue",
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tint}`}>
        <Icon size={19} />
      </div>

      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function DashboardHome({
  profile,
  active,
  shifts,
  refreshProfile,
  logout,
}) {
  const [displayName, setDisplayName] = useState(
    profile.displayName || ""
  );

  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [breakChoice, setBreakChoice] = useState("Tea");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setDisplayName(profile.displayName || "");
  }, [profile.displayName]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const elapsed = active
    ? Math.max(
        0,
        now - (active.loginTime?.toMillis?.() || now)
      )
    : 0;

  const currentBreak = active?.currentBreak;

  const breakElapsed = currentBreak
    ? Math.max(
        0,
        now - (currentBreak.startTime?.toMillis?.() || now)
      )
    : 0;

  const totalBreak =
    (active?.totalBreakSeconds || 0) * 1000 +
    breakElapsed;

  const working = Math.max(0, elapsed - totalBreak);

  async function saveName(event) {
    event.preventDefault();

    setProfileBusy(true);
    setProfileMessage("");

    try {
      await refreshProfile(displayName.trim());
      setProfileMessage("Your name has been saved.");
    } catch (error) {
      setProfileMessage(
        error.message || "Could not save your name."
      );
    } finally {
      setProfileBusy(false);
    }
  }

  async function act(callback) {
    setBusy(true);
    setNotice("");

    try {
      await callback();
    } catch (error) {
      setNotice(error.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="welcome-row">
        <div>
          <div className="eyebrow">YOUR WORKDAY</div>

          <h1>
            Good{" "}
            {new Date().getHours() < 12
              ? "morning"
              : new Date().getHours() < 17
              ? "afternoon"
              : "evening"}
            {profile.displayName
              ? `, ${profile.displayName.split(" ")[0]}`
              : ""}
            {" "}
            <span>✦</span>
          </h1>

          <p>
            Here's your DigiTide attendance overview for today.
          </p>
        </div>

        <div
          className={`status-badge ${
            active
              ? currentBreak
                ? "break"
                : "working"
              : "offline"
          }`}
        >
          <i />
          {!active
            ? "Shift not started"
            : currentBreak
            ? `On ${currentBreak.type} break`
            : "Currently working"}
        </div>
      </div>

      <div className="stats-grid">
        <Stat
          label="SHIFT DURATION"
          value={active ? duration(elapsed) : "00:00:00"}
          sub={
            active
              ? "Since shift started"
              : "Start your shift to track time"
          }
          icon={Clock3}
        />

        <Stat
          label="WORKING TIME"
          value={active ? duration(working) : "00:00:00"}
          sub="Excludes recorded breaks"
          icon={Timer}
          tint="green"
        />

        <Stat
          label="BREAK TIME"
          value={active ? duration(totalBreak) : "00:00:00"}
          sub={
            currentBreak
              ? "Break is running"
              : "Today's total break time"
          }
          icon={Coffee}
          tint="orange"
        />

        <Stat
          label="RECENT SHIFTS"
          value={shifts.length}
          sub="Your latest 14 records"
          icon={CalendarDays}
          tint="purple"
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel shift-panel">
          <div className="panel-head">
            <div>
              <h3>Shift tracker</h3>
              <p>Manage your work session</p>
            </div>

            <span className="live-label">
              <i /> LIVE
            </span>
          </div>

          <div className="timer-area">
            <div className="timer-ring">
              <div>
                <span>
                  {!active
                    ? "READY TO START"
                    : currentBreak
                    ? "ON BREAK"
                    : "WORKING"}
                </span>

                <strong>
                  {active
                    ? duration(
                        currentBreak ? breakElapsed : working
                      )
                    : "00:00:00"}
                </strong>

                <small>
                  {!active
                    ? "Your timer appears here"
                    : currentBreak
                    ? `${currentBreak.type} break duration`
                    : "Net working time"}
                </small>
              </div>
            </div>
          </div>

          {notice && <div className="alert">{notice}</div>}

          {!active ? (
            <button
              className="primary-btn full"
              disabled={busy}
              onClick={() => act(startShift)}
            >
              <PlayCircle size={18} />
              {busy ? "Starting…" : "Start my shift"}
            </button>
          ) : currentBreak ? (
            <button
              className="primary-btn full"
              disabled={busy}
              onClick={() => act(endBreak)}
            >
              <PlayCircle size={18} />
              {busy ? "Updating…" : "Back to work"}
            </button>
          ) : (
            <div className="break-controls">
              <select
                value={breakChoice}
                onChange={(event) =>
                  setBreakChoice(event.target.value)
                }
              >
                {breakTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              <button
                className="secondary-btn"
                disabled={busy}
                onClick={() =>
                  act(() => startBreak(breakChoice))
                }
              >
                <PauseCircle size={18} />
                Start break
              </button>

              <button
                className="danger-btn"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await endShift();
                    await logout();
                  })
                }
              >
                <LogOut size={17} />
                End shift
              </button>
            </div>
          )}

          <div className="shift-foot">
            <span>
              <ShieldCheck size={14} />
              Attendance tracking
            </span>

            <span>
              {active
                ? `Started ${dateLabel(active.loginTime)}`
                : "Ready when you are"}
            </span>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h3>Recent activity</h3>
              <p>Your latest completed shifts</p>
            </div>

            <CalendarDays size={19} className="muted-icon" />
          </div>

          {shifts.slice(0, 5).length === 0 ? (
            <div className="empty">
              <CalendarDays size={26} />
              <b>No shifts yet</b>
              <span>
                Your completed shifts will appear here.
              </span>
            </div>
          ) : (
            <div className="activity-list">
              {shifts.slice(0, 5).map((shift) => (
                <div className="activity-item" key={shift.id}>
                  <div className="activity-icon">
                    <Clock3 size={17} />
                  </div>

                  <div className="activity-copy">
                    <b>
                      {dateLabel(shift.loginTime).split(",")[0]}
                    </b>

                    <small>
                      {dateLabel(shift.loginTime)} –{" "}
                      {shift.logoutTime
                        ? dateLabel(shift.logoutTime)
                        : "In progress"}
                    </small>
                  </div>

                  <div className="activity-time">
                    {duration(
                      (shift.workSeconds || 0) * 1000
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="panel form-panel">
        <div className="panel-head">
          <div>
            <h3>My profile</h3>
            <p>Update your display name</p>
          </div>

          <div className="stat-icon">
            <ShieldCheck size={19} />
          </div>
        </div>

        <form onSubmit={saveName} className="employee-form">
          <div className="field">
            <label>Full name</label>

            <input
              type="text"
              value={displayName}
              onChange={(event) =>
                setDisplayName(event.target.value)
              }
              minLength={2}
              maxLength={60}
              required
              placeholder="Enter your full name"
            />
          </div>

          <button
            type="submit"
            className="primary-btn"
            disabled={profileBusy}
          >
            {profileBusy ? "Saving…" : "Save profile"}
          </button>
        </form>

        {profileMessage && (
          <div className="alert">{profileMessage}</div>
        )}
      </section>

      <div className="tip">
        <div className="tip-icon">
          <ShieldCheck size={18} />
        </div>

        <div>
          <b>Attendance information</b>
          <p>
            Your attendance records are stored in Firebase
            Firestore. Refreshing the page will not remove
            saved records.
          </p>
        </div>
      </div>
    </>
  );
}

function History({ shifts }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>My shift history</h3>
          <p>Your last 14 completed or active shifts</p>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>DATE</th>
              <th>START</th>
              <th>END</th>
              <th>WORKED</th>
              <th>BREAK</th>
              <th>STATUS</th>
            </tr>
          </thead>

          <tbody>
            {shifts.map((shift) => (
              <tr key={shift.id}>
                <td>
                  {dateLabel(shift.loginTime).split(",")[0]}
                </td>

                <td>
                  {dateLabel(shift.loginTime)
                    .split(",")
                    .slice(1)
                    .join(",")}
                </td>

                <td>
                  {shift.logoutTime
                    ? dateLabel(shift.logoutTime)
                        .split(",")
                        .slice(1)
                        .join(",")
                    : "—"}
                </td>

                <td>
                  <b>
                    {duration(
                      (shift.workSeconds || 0) * 1000
                    )}
                  </b>
                </td>

                <td>
                  {Math.round(
                    (shift.totalBreakSeconds || 0) / 60
                  )}{" "}
                  min
                </td>

                <td>
                  <span
                    className={`table-status ${
                      shift.logoutTime ? "done" : "working"
                    }`}
                  >
                    {shift.logoutTime
                      ? "Completed"
                      : "Active"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!shifts.length && (
          <div className="empty">
            No shift records found.
          </div>
        )}
      </div>
    </section>
  );
}

function Team({ rows, shifts, month, setMonth }) {
  const activeCount = rows.filter(
    (employee) => employee.active
  ).length;

  const breakingCount = rows.filter(
    (employee) => employee.breaking
  ).length;

  const exportRows = shifts
    .filter((shift) => {
      const date = shift.loginTime?.toDate?.();

      if (!date) return false;

      const shiftMonth = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;

      return shiftMonth === month;
    })
    .map((shift) => {
      const employee = rows.find(
        (row) => row.uid === shift.userId
      );

      return {
        ...shift,
        name: employee?.displayName || "Employee",
        email: employee?.email || "",
        role: employee?.role || "employee",
        start: dateLabel(shift.loginTime),
        end: dateLabel(shift.logoutTime),
        work: duration(
          (shift.workSeconds || 0) * 1000
        ),
        breaks:
          Math.round(
            (shift.totalBreakSeconds || 0) / 60
          ) + " min",
        status: shift.logoutTime
          ? "Completed"
          : "Active",
      };
    });

  return (
    <>
      <div className="stats-grid">
        <Stat
          label="TOTAL EMPLOYEES"
          value={rows.length}
          sub="Registered accounts"
          icon={Users}
        />

        <Stat
          label="ON SHIFT"
          value={activeCount}
          sub="Currently active"
          icon={Clock3}
          tint="green"
        />

        <Stat
          label="ON BREAK"
          value={breakingCount}
          sub="Currently on a break"
          icon={Coffee}
          tint="orange"
        />

        <Stat
          label="MONTH RECORDS"
          value={exportRows.length}
          sub="Selected month"
          icon={CalendarDays}
          tint="purple"
        />
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>Live team attendance</h3>
            <p>
              Attendance visibility for your workspace
            </p>
          </div>

          <span className="live-label">
            <i /> LIVE UPDATES
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>EMPLOYEE</th>
                <th>ROLE</th>
                <th>STATUS</th>
                <th>SHIFT START</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((employee) => (
                <tr key={employee.uid}>
                  <td>
                    <div className="person">
                      <div className="avatar">
                        {(employee.displayName || "U")[0]}
                      </div>

                      <div>
                        <b>{employee.displayName}</b>
                        <small>{employee.email}</small>
                      </div>
                    </div>
                  </td>

                  <td>{employee.role}</td>

                  <td>
                    <span
                      className={`table-status ${
                        employee.breaking
                          ? "break"
                          : employee.active
                          ? "working"
                          : "done"
                      }`}
                    >
                      {employee.breaking
                        ? "On break"
                        : employee.active
                        ? "Working"
                        : "Off shift"}
                    </span>
                  </td>

                  <td>
                    {employee.loginTime
                      ? dateLabel(employee.loginTime)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!rows.length && (
            <div className="empty">
              No employees found.
            </div>
          )}
        </div>
      </section>

      <section className="panel report-panel">
        <div>
          <h3>Monthly attendance report</h3>
          <p>
            Export shift records as a CSV spreadsheet.
          </p>
        </div>

        <div className="report-actions">
          <input
            type="month"
            value={month}
            onChange={(event) =>
              setMonth(event.target.value)
            }
          />

          <button
            className="primary-btn"
            onClick={() =>
              csvDownload(
                exportRows,
                `attendance-${month}.csv`
              )
            }
          >
            <Download size={17} />
            Download CSV
          </button>
        </div>
      </section>
    </>
  );
}

function EmployeeSetupInfo() {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>Employee account setup</h3>
          <p>
            Create employee accounts through Firebase
            Authentication.
          </p>
        </div>

        <div className="stat-icon">
          <Users size={19} />
        </div>
      </div>

      <div className="tip">
        <ShieldCheck size={18} />

        <div>
          <b>Administrator setup required</b>
          <p>
            Employee accounts and their roles must be
            configured by an authorized administrator.
            This Spark-only version does not create accounts
            or grant roles from the browser.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function Dashboard() {
  const {
    profile,
    logout,
    saveName,
  } = useAuth();

  const [tab, setTab] = useState("overview");

  const [active, setActive] = useState(null);
  const [shifts, setShifts] = useState([]);

  const [teamProfiles, setTeamProfiles] = useState([]);
  const [teamActive, setTeamActive] = useState({});

  const [teamShifts, setTeamShifts] = useState([]);

  const [month, setMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  useEffect(() => {
    if (!profile?.uid) return;

    const unsubscribe = onSnapshot(
      doc(db, "activeShifts", profile.uid),
      (snapshot) => {
        setActive(
          snapshot.exists() ? snapshot.data() : null
        );
      },
      (error) => {
        console.error("Active shift error:", error);
      }
    );

    return unsubscribe;
  }, [profile?.uid]);

  useEffect(() => {
    if (!profile?.uid) return;

    const shiftsQuery = query(
      collection(db, "shifts"),
      where("userId", "==", profile.uid),
      orderBy("loginTime", "desc")
    );

    const unsubscribe = onSnapshot(
      shiftsQuery,
      (snapshot) => {
        setShifts(
          snapshot.docs
            .slice(0, 14)
            .map((document) => ({
              id: document.id,
              ...document.data(),
            }))
        );
      },
      (error) => {
        console.error("Shift history error:", error);
      }
    );

    return unsubscribe;
  }, [profile?.uid]);

  useEffect(() => {
    if (
      !profile?.uid ||
      profile.role === "employee"
    ) {
      setTeamProfiles([]);
      setTeamActive({});
      setTeamShifts([]);
      return;
    }

    const unsubscribeUsers = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        setTeamProfiles(
          snapshot.docs.map((document) => ({
            uid: document.id,
            ...document.data(),
          }))
        );
      },
      (error) => {
        console.error("Team users error:", error);
      }
    );

    const unsubscribeActive = onSnapshot(
      collection(db, "activeShifts"),
      (snapshot) => {
        const activeMap = {};

        snapshot.docs.forEach((document) => {
          activeMap[document.id] = document.data();
        });

        setTeamActive(activeMap);
      },
      (error) => {
        console.error("Team active shifts error:", error);
      }
    );

    const allShiftsQuery = query(
      collection(db, "shifts"),
      orderBy("loginTime", "desc")
    );

    const unsubscribeShifts = onSnapshot(
      allShiftsQuery,
      (snapshot) => {
        setTeamShifts(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          }))
        );
      },
      (error) => {
        console.error("Team shifts error:", error);
      }
    );

    return () => {
      unsubscribeUsers();
      unsubscribeActive();
      unsubscribeShifts();
    };
  }, [profile?.uid, profile?.role]);

  const team = useMemo(() => {
    return teamProfiles.map((employee) => {
      const current = teamActive[employee.uid];

      return {
        ...employee,
        active: !!current,
        breaking: !!current?.currentBreak,
        loginTime: current?.loginTime || null,
      };
    });
  }, [teamProfiles, teamActive]);

  async function refreshProfile(name) {
    await saveName(name);
  }

  if (!profile) {
    return null;
  }

  return (
    <Layout tab={tab} setTab={setTab}>
      {tab === "overview" ? (
        <DashboardHome
          profile={profile}
          active={active}
          shifts={shifts}
          refreshProfile={refreshProfile}
          logout={logout}
        />
      ) : tab === "history" ? (
        <History shifts={shifts} />
      ) : tab === "team" ? (
        <Team
          rows={team}
          shifts={teamShifts}
          month={month}
          setMonth={setMonth}
        />
      ) : (
        <EmployeeSetupInfo />
      )}
    </Layout>
  );
}
