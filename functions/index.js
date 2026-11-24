const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");
initializeApp();
const db=getFirestore();
const REGION="asia-south1";
function authUser(req){if(!req.auth)throw new HttpsError("unauthenticated","Please sign in.");return req.auth;}
function requireRole(req,roles){const u=authUser(req);if(!roles.includes(u.token.role))throw new HttpsError("permission-denied","You do not have permission.");return u;}
async function closeShift(uid,active,reason="manual"){
 const now=Timestamp.now();
 let breakSeconds=active.totalBreakSeconds||0;
 if(active.currentBreak?.startTime) breakSeconds+=Math.max(0,Math.floor((now.toMillis()-active.currentBreak.startTime.toMillis())/1000));
 const totalSeconds=Math.max(0,Math.floor((now.toMillis()-active.loginTime.toMillis())/1000));
 const workSeconds=Math.max(0,totalSeconds-breakSeconds);
 const shiftRef=db.collection("shifts").doc(active.shiftId);
 await db.runTransaction(async tx=>{
  const snap=await tx.get(db.collection("activeShifts").doc(uid));
  if(!snap.exists || snap.data().shiftId!==active.shiftId) return;
  tx.set(shiftRef,{...active,logoutTime:now,totalSeconds,totalBreakSeconds:breakSeconds,workSeconds,status:"completed",closeReason:reason,closedBy:"server",currentBreak:null,updatedAt:now});
  tx.delete(db.collection("activeShifts").doc(uid));
 });
}
exports.startShift=onCall({region:REGION},async req=>{
 const u=authUser(req), now=Timestamp.now(), activeRef=db.collection("activeShifts").doc(u.uid), shiftRef=db.collection("shifts").doc();
 await db.runTransaction(async tx=>{
  const old=await tx.get(activeRef);
  if(old.exists)return;
  const profile=await tx.get(db.collection("users").doc(u.uid));
  if(!profile.exists)throw new HttpsError("failed-precondition","Your employee profile is missing.");
  const data={shiftId:shiftRef.id,userId:u.uid,displayName:profile.data().displayName,email:profile.data().email,role:u.token.role||"employee",loginTime:now,currentBreak:null,totalBreakSeconds:0,status:"working",createdAt:now};
  tx.set(activeRef,data);tx.set(shiftRef,{...data,logoutTime:null,totalSeconds:0,workSeconds:0});
 });
 return {ok:true,serverTime:now.toMillis()};
});
exports.startBreak=onCall({region:REGION},async req=>{
 const u=authUser(req),type=req.data?.type;
 if(!["Tea","Lunch","Short","Meeting"].includes(type))throw new HttpsError("invalid-argument","Choose a valid break type.");
 const ref=db.collection("activeShifts").doc(u.uid),now=Timestamp.now();
 await db.runTransaction(async tx=>{const s=await tx.get(ref);if(!s.exists)throw new HttpsError("failed-precondition","No active shift.");if(s.data().currentBreak)throw new HttpsError("failed-precondition","A break is already running.");tx.update(ref,{currentBreak:{type,startTime:now},status:"break",updatedAt:now});});
 return {ok:true};
});
exports.endBreak=onCall({region:REGION},async req=>{
 const u=authUser(req),ref=db.collection("activeShifts").doc(u.uid),now=Timestamp.now();
 await db.runTransaction(async tx=>{const s=await tx.get(ref);if(!s.exists||!s.data().currentBreak)throw new HttpsError("failed-precondition","No active break.");const secs=Math.max(0,Math.floor((now.toMillis()-s.data().currentBreak.startTime.toMillis())/1000));tx.update(ref,{currentBreak:null,status:"working",totalBreakSeconds:FieldValue.increment(secs),updatedAt:now,lastBreak:{...s.data().currentBreak,endTime:now,durationSeconds:secs}});});
 return {ok:true};
});
exports.endShift=onCall({region:REGION},async req=>{
 const u=authUser(req),ref=db.collection("activeShifts").doc(u.uid),s=await ref.get();
 if(!s.exists)throw new HttpsError("failed-precondition","No active shift.");
 await closeShift(u.uid,s.data(),"employee");
 return {ok:true};
});
exports.createEmployee=onCall({region:REGION},async req=>{
 const caller=requireRole(req,["admin"]),{name,email,password,role,department}=req.data||{};
 if(!name||!email||!password||password.length<8||!["employee","lead","admin"].includes(role))throw new HttpsError("invalid-argument","Provide a name, valid email, password (8+ chars), and valid role.");
 try{
  const user=await getAuth().createUser({email,password,displayName:name});
  await getAuth().setCustomUserClaims(user.uid,{role});
  await db.collection("users").doc(user.uid).set({displayName:name,email,role,department:department||"",createdAt:Timestamp.now(),createdBy:caller.uid});
  return {uid:user.uid};
 }catch(e){throw new HttpsError("already-exists",e.message);}
});

exports.updateMyProfile=onCall({region:REGION},async req=>{
 const u=authUser(req),name=String(req.data?.displayName||"").trim();
 if(name.length<2||name.length>60)throw new HttpsError("invalid-argument","Enter a name between 2 and 60 characters.");
 await getAuth().updateUser(u.uid,{displayName:name});
 await db.collection("users").doc(u.uid).set({displayName:name,updatedAt:Timestamp.now()},{merge:true});
 return {ok:true,displayName:name};
});

exports.nightlyCloseOpenShifts=onSchedule({schedule:"every day 23:59",timeZone:"Asia/Kolkata",region:REGION},async()=>{
 const snap=await db.collection("activeShifts").get();
 for(const d of snap.docs){try{await closeShift(d.id,d.data(),"automatic-nightly-close");}catch(e){console.error("Could not close shift",d.id,e);}}
});