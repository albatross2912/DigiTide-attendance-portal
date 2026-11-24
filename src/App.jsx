import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import "./styles.css";
function Guard({children,roles}) {
  const {user,profile,loading}=useAuth();
  if(loading) return <div className="loader">Loading DigiTide…</div>;
  if(!user) return <Navigate to="/login" replace/>;
  if(!profile) return <div className="loader">Unable to load your account profile. Contact an administrator.</div>;
  if(roles && !roles.includes(profile.role)) return <Navigate to="/" replace/>;
  return children;
}
export default function App(){
 const {user,loading}=useAuth();
 if(loading) return <div className="loader">Loading DigiTide…</div>;
 return <Routes>
  <Route path="/login" element={user?<Navigate to="/" replace/>:<Login/>}/>
  <Route path="/*" element={<Guard><Dashboard/></Guard>}/>
 </Routes>;
}