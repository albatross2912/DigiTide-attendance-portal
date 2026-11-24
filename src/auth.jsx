
import React, {
  createContext,
  useContext,
  useEffect,
  useState
} from "react";

import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "./firebase";
import { updateMyProfile } from "./api";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", currentUser.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          setProfile(null);
          return;
        }

        const data = snap.data();

        setProfile({
          uid: currentUser.uid,
          email: currentUser.email || data.email || "",
          displayName: data.displayName || currentUser.displayName || "",
          role: data.role || "employee",
          department: data.department || "—"
        });
      } catch (error) {
        console.error("Profile loading error:", error);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const saveName = async (name) => {
    const cleanName = String(name || "").trim();

    if (cleanName.length < 2 || cleanName.length > 60) {
      throw new Error("Name must contain between 2 and 60 characters.");
    }

    await updateMyProfile(cleanName);

    setProfile((previous) => ({
      ...previous,
      displayName: cleanName
    }));
  };

  const logout = () => signOut(auth);

  return (
    <Ctx.Provider
      value={{
        user,
        profile,
        loading,
        logout,
        saveName
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
