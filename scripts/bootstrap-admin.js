// Run once from a trusted machine after setting GOOGLE_APPLICATION_CREDENTIALS.
// Usage: node scripts/bootstrap-admin.js admin@company.com "Full Name"
const admin=require("firebase-admin");
const email=process.argv[2];
const displayName=(process.argv[3]||"").trim();
if(!email)throw new Error("Usage: node scripts/bootstrap-admin.js admin@company.com");
admin.initializeApp();
(async()=>{
 const user=await admin.auth().getUserByEmail(email);
 if(displayName) await admin.auth().updateUser(user.uid,{displayName});
 await admin.auth().setCustomUserClaims(user.uid,{role:"admin"});
 await admin.firestore().collection("users").doc(user.uid).set({
  displayName:displayName||user.displayName||"Administrator",email:user.email,role:"admin",department:"Administration",createdAt:admin.firestore.FieldValue.serverTimestamp()
 },{merge:true});
 console.log("Admin role assigned to",email);
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});