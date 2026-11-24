
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

import { updateProfile } from "firebase/auth";
import { auth, db } from "./firebase";

const breakTypes = ["Tea", "Lunch", "Short", "Meeting"];

function requireUser() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please sign in.");
  }

  return user;
}

export async function startShift() {
  const user = requireUser();

  const activeRef = doc(db, "activeShifts", user.uid);
  const shiftRef = doc(collection(db, "shifts"));
  const profileRef = doc(db, "users", user.uid);

  await runTransaction(db, async (transaction) => {
    const activeSnap = await transaction.get(activeRef);
    const profileSnap = await transaction.get(profileRef);

    if (activeSnap.exists()) {
      throw new Error("You already have an active shift.");
    }

    if (!profileSnap.exists()) {
      throw new Error("Your employee profile is missing.");
    }

    const profile = profileSnap.data();

    const shiftData = {
      shiftId: shiftRef.id,
      userId: user.uid,
      displayName: profile.displayName || user.displayName || "",
      email: user.email || "",
      role: profile.role || "employee",
      loginTime: serverTimestamp(),
      currentBreak: null,
      totalBreakSeconds: 0,
      status: "working",
      createdAt: serverTimestamp(),
    };

    transaction.set(activeRef, shiftData);

    transaction.set(shiftRef, {
      ...shiftData,
      logoutTime: null,
      totalSeconds: 0,
      workSeconds: 0,
    });
  });

  return { ok: true };
}

export async function startBreak(type) {
  const user = requireUser();

  if (!breakTypes.includes(type)) {
    throw new Error("Choose a valid break type.");
  }

  const activeRef = doc(db, "activeShifts", user.uid);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(activeRef);

    if (!snap.exists()) {
      throw new Error("No active shift found.");
    }

    const active = snap.data();

    if (active.currentBreak) {
      throw new Error("A break is already running.");
    }

    if (active.status !== "working") {
      throw new Error("Your shift is not currently working.");
    }

    transaction.update(activeRef, {
      currentBreak: {
        type,
        startTime: serverTimestamp(),
      },
      status: "break",
      updatedAt: serverTimestamp(),
    });
  });

  return { ok: true };
}

export async function endBreak() {
  const user = requireUser();

  const activeRef = doc(db, "activeShifts", user.uid);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(activeRef);

    if (!snap.exists()) {
      throw new Error("No active shift found.");
    }

    const active = snap.data();
    const currentBreak = active.currentBreak;

    if (!currentBreak?.startTime) {
      throw new Error("No active break found.");
    }

    const now = Timestamp.now();

    const seconds = Math.max(
      0,
      Math.floor(
        (now.toMillis() - currentBreak.startTime.toMillis()) / 1000
      )
    );

    transaction.update(activeRef, {
      currentBreak: null,
      status: "working",
      totalBreakSeconds:
        (active.totalBreakSeconds || 0) + seconds,
      lastBreak: {
        type: currentBreak.type,
        startTime: currentBreak.startTime,
        endTime: serverTimestamp(),
        durationSeconds: seconds,
      },
      updatedAt: serverTimestamp(),
    });
  });

  return { ok: true };
}

export async function endShift() {
  const user = requireUser();

  const activeRef = doc(db, "activeShifts", user.uid);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(activeRef);

    if (!snap.exists()) {
      throw new Error("No active shift found.");
    }

    const active = snap.data();

    if (!active.loginTime || !active.shiftId) {
      throw new Error("The active shift data is incomplete.");
    }

    const now = Timestamp.now();

    const totalSeconds = Math.max(
      0,
      Math.floor(
        (now.toMillis() - active.loginTime.toMillis()) / 1000
      )
    );

    let breakSeconds = active.totalBreakSeconds || 0;

    if (active.currentBreak?.startTime) {
      breakSeconds += Math.max(
        0,
        Math.floor(
          (now.toMillis() -
            active.currentBreak.startTime.toMillis()) / 1000
        )
      );
    }

    const workSeconds = Math.max(
      0,
      totalSeconds - breakSeconds
    );

    const shiftRef = doc(db, "shifts", active.shiftId);

    transaction.update(shiftRef, {
      logoutTime: serverTimestamp(),
      totalSeconds,
      totalBreakSeconds: breakSeconds,
      workSeconds,
      currentBreak: null,
      status: "completed",
      updatedAt: serverTimestamp(),
    });

    transaction.delete(activeRef);
  });

  return { ok: true };
}

export async function updateMyProfile(displayName) {
  const user = requireUser();

  const cleanName = String(displayName || "").trim();

  if (cleanName.length < 2 || cleanName.length > 60) {
    throw new Error(
      "Name must contain between 2 and 60 characters."
    );
  }

  await updateDoc(doc(db, "users", user.uid), {
    displayName: cleanName,
    updatedAt: serverTimestamp(),
  });

  await updateProfile(user, {
    displayName: cleanName,
  });

  return { ok: true };
}
