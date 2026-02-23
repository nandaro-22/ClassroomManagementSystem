/****************************************************
 * Student Form Viewer Secure Backend (Apps Script)
 * VERSION v5 FINAL + OFFLINE + SEAT MAP + EVIDENCE ENHANCEMENTS
 * Programmed by : GIL
 * Programmed on : 01/25/26
 *
 * CORE FEATURES:
 * ✅ Google OAuth ID Token verification (secure)
 * ✅ Allowlist users (Users sheet)
 * ✅ Role-based access: admin / reviewer
 * ✅ Reviewer enforcement (assigned records only)
 *
 * RECORDS API:
 * ✅ listRecords()
 *    - server-side pagination + search + filters
 *    - cascade filters (School Year / Term / Course Subject)
 *    - returns photo direct links for UI preview
 * ✅ recordByEmail() endpoint (fetch record by student email)
 * ✅ updateRecord() (remarks + done + last updated info)
 * ✅ assignRecord() (admin assigns reviewer)
 *
 * HISTORY / AUDIT LOG:
 * ✅ RemarksLog sheet for tracking updates
 * ✅ appendHistory() logs:
 *    - UPDATE
 *    - ASSIGN
 *    - UPLOAD_EVIDENCE
 *
 * PHOTOS:
 * ✅ serveStudentPhotoBase64() endpoint
 *    - supports Drive restricted files by serving base64
 *
 * EVIDENCE:
 * ✅ uploadEvidence() (normal upload)
 * ✅ uploadEvidenceChunk() + uploadEvidenceFinalize() (large file upload)
 * ✅ getEvidenceLinks() enhanced:
 *    - returns evidence URL
 *    - detects file type (PDF / IMAGE / FILE) via Drive mimeType
 *    - returns uploaded timestamp + uploader (from RemarksLog)
 *
 * SEAT MAP:
 * ✅ listRooms() / getSeatMap() / saveSeatMap()
 * ✅ Admin seat tools:
 *    - addSeatRoom / addSeatRoomWithSeats
 *    - deleteSeatRoom / seatmapSeatDelete
 *    - clear seat assignment support
 * ✅ seatmapMasterList_() enhanced:
 *    - includes student photo (picture2x2 + direct link)
 *
 * AUTO SETUP:
 * ✅ Auto-create missing sheets: Users / RemarksLog / SeatMap
 * ✅ Auto-create missing AppDB column: Evidence Links
 ****************************************************/


const SHEET_MAIN = "AppDB";
const SHEET_USERS = "Users";
const SHEET_LOG = "RemarksLog";
const SHEET_SEATMAP = "SeatMap";
const SHEET_GRADES = "Grades";
const SHEET_LEARNER_DEV = "LearnerDev";
const SHEET_GRADES_TASKS = "GradesTasks";

// ✅ Stand-alone Spreadsheet ID
const SPREADSHEET_ID = "1DGBfKdXRzJvbMNhkVCGtdvJ6KcNx-3cQ9uNw1sc9FD0";

// ✅ Your OAuth Web Client ID(s)
const ALLOWED_CLIENT_IDS = [
  "157290002152-c2ngtbf8312no72eotpqo9j0nfvt5io1.apps.googleusercontent.com"
];

// ✅ Evidence folder ID (IMPORTANT: must be folder ID only, not full URL)
const EVIDENCE_FOLDER_ID = "1wlCd3nVzBQtZbzqeu1vs1fJPZJeXOSkA";

// =========================
//   Helpers
// =========================
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function outputJson(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSS() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet(name) {
  const ss = getSS();
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error("Missing sheet: " + name);
  return sh;
}

function learnerDevLoad_(e) {
  try {
    const studentId = s(
      (e.parameter && e.parameter.studentId) ||
      (e.postData && parseBody(e).studentId)
    ).trim();

    if (!studentId) throw new Error("Missing studentId");

    const sh = getSheet(SHEET_LEARNER_DEV);
    const values = sh.getDataRange().getValues();
    if (values.length < 2) {
      return json({ status:"success", items: [] });
    }

    const rows = values.slice(1);

    const items = rows
      .filter(r => s(r[0]) === studentId)
      .map(r => ({
        category: s(r[1]),
        score: Number(r[2] || 0)
      }));

    return json({ status:"success", items });

  } catch(err) {
    return json({ status:"error", message: err.toString() });
  }
}

function learnerDevSave_(body, userEmail) {

  const studentId = s(body.studentId);
  const items = body.items || [];

  const sh = getSheet(SHEET_LEARNER_DEV);
  const now = new Date();

  // delete old rows for student
  const values = sh.getDataRange().getValues();
  for (let r = sh.getLastRow(); r >= 2; r--) {
    if (s(sh.getRange(r,1).getValue()) === studentId) {
      sh.deleteRow(r);
    }
  }

  // insert new
  items.forEach(it => {
    sh.appendRow([
      studentId,
      it.category,
      Number(it.score || 0),
      now,
      userEmail
    ]);
  });

  return json({ status:"success" });
}

function getOrCreateSheet(name, headers) {
  const ss = getSS();
  let sh = ss.getSheetByName(name);

  if (!sh) {
    sh = ss.insertSheet(name);
  }

  // Ensure header row exists
  if (headers && headers.length > 0) {
    const lastCol = Math.max(headers.length, sh.getLastColumn());
    const firstRow = sh.getRange(1, 1, 1, lastCol).getValues()[0];

    const empty = firstRow.every(v => String(v || "").trim() === "");
    if (empty) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }

  return sh;
}

function parseBody(e) {
  let body = {};

  try {
    // A) If payload is in parameter (form-urlencoded)
    if (e && e.parameter && e.parameter.payload) {
      return JSON.parse(e.parameter.payload);
    }

    // B) If raw postData exists
    if (e && e.postData && e.postData.contents) {
      const raw = String(e.postData.contents || "").trim();

      // If raw is JSON already
      if (raw.startsWith("{") || raw.startsWith("[")) {
        return JSON.parse(raw);
      }

      // If raw looks like: payload=%7B...%7D
      if (raw.startsWith("payload=")) {
        const encoded = raw.substring("payload=".length);
        const decoded = decodeURIComponent(encoded);
        return JSON.parse(decoded);
      }

      // If raw looks like: a=1&payload=....
      if (raw.includes("payload=")) {
        const parts = raw.split("&");
        const payloadPart = parts.find(p => p.startsWith("payload="));
        if (payloadPart) {
          const encoded = payloadPart.substring("payload=".length);
          const decoded = decodeURIComponent(encoded);
          return JSON.parse(decoded);
        }
      }
    }

  } catch (err) {
    // ignore, return {}
  }

  return body;
}

function ensureRequiredSheets() {
  // Users sheet
  getOrCreateSheet(SHEET_USERS, ["email", "role", "name"]);

  // RemarksLog sheet
  getOrCreateSheet(SHEET_LOG, ["timestamp", "responseId", "updatedBy", "action", "remarks", "done"]);

  // SeatMap sheet
  getOrCreateSheet(SHEET_SEATMAP, ["room", "seatNo", "studentEmail", "studentId", "studentName", "updatedAt", "updatedBy"]);

  // GRADES sheet
  getOrCreateSheet(SHEET_GRADES_TASKS, ["studentId", "date", "category", "taskCode", "taskName","max", "score", "percent", "updatedAt", "updatedBy"]);

  // Learner Development
  getOrCreateSheet(SHEET_LEARNER_DEV, ["studentId", "category", "score", "updatedAt", "updatedBy"]);

  // ✅ ensure AppDB has Evidence Links column
  ensureColumnExists_(SHEET_MAIN, "Evidence Links");
}

function s(v) {
  return (v === null || v === undefined) ? "" : v.toString();
}

function bool(v) {
  if (v === true) return true;
  const x = s(v).toLowerCase().trim();
  return x === "true" || x === "yes" || x === "1";
}

function driveToDirectLink(url) {
  if (!url) return "";
  const str = url.toString();
  if (str.includes("uc?export=view")) return str;
  const match = str.match(/[-\w]{25,}/);
  if (!match) return str;
  const fileId = match[0];
  return "https://drive.google.com/uc?export=view&id=" + fileId;
}

/**
 * ✅ SAFE COLUMN GETTER
 * This prevents empty Other Info or errors if column not found.
 */
function getRowValue(row, headers, headerName) {
  const i = headers.indexOf(headerName);
  if (i < 0) return "";
  return s(row[i]);
}

function buildRecordKey(email, timestamp, studentId) {
  return `${email}|${timestamp}|${studentId}`;
}

function appendHistory(recordKey, updatedBy, action, remarks, done) {
  const log = getOrCreateSheet(SHEET_LOG, ["timestamp", "responseId", "updatedBy", "action", "remarks", "done"]);

  // Ensure header row is correct (force fix)
  const headers = log.getRange(1, 1, 1, 6).getValues()[0].map(x => s(x).trim().toLowerCase());

  const expected = ["timestamp", "responseid", "updatedby", "action", "remarks", "done"];
  const ok = expected.every((h, i) => headers[i] === h);

  if (!ok) {
    // Force rewrite header safely
    log.getRange(1, 1, 1, 6).setValues([["timestamp", "responseId", "updatedBy", "action", "remarks", "done"]]);
  }

  log.appendRow([new Date(), recordKey, updatedBy, action, remarks, done]);
}

// =========================
// Auth: Verify Google ID Token
// =========================
function verifyIdToken(idToken) {
  if (!idToken) throw new Error("Missing idToken");

  const verifyUrl =
    "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken);

  const res = UrlFetchApp.fetch(verifyUrl, { muteHttpExceptions: true });
  const data = JSON.parse(res.getContentText() || "{}");

  if (!data.email) throw new Error("Invalid token (no email)");
  if (!data.aud) throw new Error("Invalid token (no aud)");

  if (!ALLOWED_CLIENT_IDS.includes(data.aud)) {
    throw new Error("Invalid client ID (aud mismatch)");
  }

  return {
    email: data.email,
    name: data.name || ""
  };
}

/**
 * Returns profile object:
 * { email, role, name }
 */
function getUserProfile(email) {
  const sh = getSheet(SHEET_USERS);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return null;

  const headers = values[0].map(h => s(h).toLowerCase().trim());

  const emailCol = headers.indexOf("email");
  const roleCol = headers.indexOf("role");
  const nameCol = headers.indexOf("name"); // optional

  if (emailCol < 0 || roleCol < 0) {
    throw new Error("Users sheet must have headers: email, role (optional: name)");
  }

  const target = s(email).toLowerCase().trim();

  for (let i = 1; i < values.length; i++) {
    const rowEmail = s(values[i][emailCol]).toLowerCase().trim();
    if (rowEmail === target) {
      return {
        email: s(values[i][emailCol]).trim(),
        role: s(values[i][roleCol]).trim(),
        name: nameCol >= 0 ? s(values[i][nameCol]).trim() : ""
      };
    }
  }

  return null;
}

function requireAdmin(role) {
  if (role !== "admin") throw new Error("Admin only");
}

function getRecordByEmail(e, userEmail, role) {
  const targetEmail = String(e.parameter.email || "").trim().toLowerCase();
  if (!targetEmail) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: "Missing email" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const sh = getSheet(SHEET_MAIN); // AppDB

  if (!sh) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: "MAIN sheet not found" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const values = sh.getDataRange().getValues();
  if (values.length < 2) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "not_found", message: "No records found" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const headers = values[0].map(h => String(h || "").trim());
  const rows = values.slice(1);

  const col = (name) => headers.indexOf(name);

  const idxEmail = col("Email Address");
  if (idxEmail < 0) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: "Email Address column not found" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const row = rows.find(r => String(r[idxEmail] || "").trim().toLowerCase() === targetEmail);
  if (!row) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: "Student not found" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (role === "student") {
    if (targetEmail !== String(userEmail || "").toLowerCase()) {
      return ContentService
        .createTextOutput(JSON.stringify({ status:"error", message:"Access denied" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // OPTIONAL: reviewer access enforcement
  const idxAssignedTo = col("Assigned To");
  if (role !== "admin" && idxAssignedTo >= 0) {
    const assignedTo = String(row[idxAssignedTo] || "").trim().toLowerCase();
    const me = String(userEmail || "").trim().toLowerCase();
    if (assignedTo && assignedTo !== me) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: "error", message: "Not assigned to you" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  const getVal = (name) => {
    const i = col(name);
    if (i < 0) return "";
    return String(row[i] || "");
  };

  const item = {
    timestamp: getVal("Timestamp"),
    email: getVal("Email Address"),
    fullName: getVal("Last Name, First Name M.I."),
    studentId: getVal("Student ID Number"),

    schoolYear: getVal("School Year"),
    term: getVal("Term"),
    courseSubject: getVal("COURSE (Subject)"),

    program: getVal("Program"),
    yearLevel: getVal("Year Level"),

    remarks: getVal("Remarks"),
    done: getVal("Done") === "TRUE" || getVal("Done") === "true" || getVal("Done") === "1",

    picture2x2: getVal("2X2 Picture"),
    enrollmentProof: getVal("Upload Proof of Enrollment"),

    lastUpdated: getVal("Last Updated"),
    lastUpdatedBy: getVal("Last Updated By"),

    cellphoneNumber: getVal("Cellphone Number"),
    facebookName: getVal("Facebook Name"),
    motto: getVal("Motto"),
    courseExpectations: getVal("Course Expectation/s"),
    talentsSkills: getVal("Talent/s and/or Skill/s that you think will give you an edge throughout this course."),
    knowAboutCourse: getVal("What do you know about the Course?"),
    excitedAbout: getVal("What are you most excited about/interested in from this course?"),
    challenges: getVal("What challenges do you anticipate/What are you worried about in this course?"),
    anythingElse: getVal("Anything else you would like to tell about yourself?")
  };

  return ContentService
    .createTextOutput(JSON.stringify({ status: "success", item: item }))
    .setMimeType(ContentService.MimeType.JSON);
}

function ensureColumnExists_(sheetName, headerName) {
  const sh = getSheet(sheetName);
  const lastCol = Math.max(1, sh.getLastColumn());
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(x => s(x).trim());

  // already exists
  if (headers.includes(headerName)) return;

  // add new column at end
  sh.getRange(1, lastCol + 1).setValue(headerName);

  // optional: set width for readability
  sh.setColumnWidth(lastCol + 1, 320);
}

// =========================
// Routes
// =========================
function doGet(e) {
  try {
    ensureRequiredSheets();

    const action = e.parameter.action || "list";
    console.log("ACTION = ", action);
    const idToken = e.parameter.idToken || "";

    const user = verifyIdToken(idToken);
    const profile = getUserProfile(user.email);

    if (!profile || !profile.role) {
      return json({ status: "error", message: "Access denied (not in Users sheet)" });
    }

    const role = profile.role;

    if (action === "me") {
      return json({
        status: "success",
        email: profile.email,
        role: profile.role,
        name: profile.name || ""
      });
    }

    if (action === "filters") return getFilterOptions();
    if (action === "cascade") return getCascadeOptions(e);
    if (action === "list") return listRecords(e, profile.email, role);
    if (action === "history") return getRemarksHistory(e);

    if (action === "users") {
      requireAdmin(role);
      return listUsers();
    }

    if (action === "photo") return serveStudentPhotoBase64(e);
    if (action === "evidence") return getEvidenceLinks(e);

    // SEAT MAP
    if (action === "rooms") return listRooms();
    if (action === "seatmap") return getSeatMap(e);
    if (action === "seatmapMaster") return seatmapMasterList_();

    if (action === "recordByEmail") {
      return getRecordByEmail(e, profile.email, role);
    }

    // ✅ GRADES LOAD
    /*if (action === "gradesLoad") {
      return gradesLoad_(e, profile.email, role);
    }*/

    // ✅ GRADES SAVE (TEMP via GET)
    /*if (action === "gradesSave") {
      const body = parseBody(e);
      return gradesSave_(body, profile.email, role);
    }*/

    // ✅ GRADES LOAD
    if (action === "gradesTaskLoad") {
      return gradesTaskLoad_(e, profile.email, role);
    }

    // ✅ LearnerDev
    if (action === "learnerDevLoad") {
      return learnerDevLoad_(e);
    }

    return json({ status: "error", message: "Invalid action" });

  } catch (err) {
    return json({ status: "error", message: err.toString() });
  }
}

/* =========================
   SEAT MAP: Master Students (GET)
   action = seatmapMaster
========================= */
/* old version */
/*function seatmapMasterList_() {
  const sh = getSheet(SHEET_MAIN); // AppDB
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return json({ status: "success", students: [] });

  const headers = values[0].map(h => s(h).trim());
  const rows = values.slice(1);

  const iEmail = headers.indexOf("Email Address");
  const iName = headers.indexOf("Last Name, First Name M.I.");
  const iId = headers.indexOf("Student ID Number");
  const iPic = headers.indexOf("2X2 Picture");
  const idxCellphone = headers.indexOf("Cellphone Number");

  if (iEmail < 0 || iName < 0 || iId < 0) {
    return json({
      status: "error",
      message: "AppDB missing columns: Email Address, Last Name, First Name M.I., Student ID Number"
    });
  }

  const students = rows
    .map(r => {
      const pic = iPic >= 0 ? s(r[iPic]).trim() : "";

      return {
        studentEmail: s(r[iEmail]).trim(),
        studentName: s(r[iName]).trim(),
        studentId: s(r[iId]).trim(),
        picture2x2: pic,
        picture2x2_direct: driveToDirectLink(pic),
        cellphoneNumber: idxCellphone >= 0 ? s(r[idxCellphone]).trim() : ""
      };
    })
    .filter(x => x.studentId || x.studentEmail || x.studentName);

  return json({ status: "success", students });
}*/

/* new version */
function seatmapMasterList_() {
  const sh = getSheet(SHEET_MAIN); // AppDB
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return json({ status: "success", students: [] });

  const headers = values[0].map(h => s(h).trim());
  const rows = values.slice(1);

  // helper para hanapin exact column name sa sheet
  const col = (name) => headers.indexOf(name);

  const iEmail = col("Email Address");
  const iName  = col("Last Name, First Name M.I.");
  const iId    = col("Student ID Number");
  const iPic   = col("2X2 Picture");
  const iCell  = col("Cellphone Number");

  if (iEmail < 0 || iName < 0 || iId < 0) {
    return json({
      status: "error",
      message: "Missing required columns in AppDB"
    });
  }

  const students = rows.map(r => {
    const pic = iPic >= 0 ? s(r[iPic]).trim() : "";

    return {
      studentEmail: s(r[iEmail]).trim(),
      studentName:  s(r[iName]).trim(),
      studentId:    s(r[iId]).trim(),
      picture2x2: pic,
      picture2x2_direct: driveToDirectLink(pic),
      cellphoneNumber: iCell >= 0 ? s(r[iCell]).trim() : ""
    };
  })
  .filter(x => x.studentEmail || x.studentId || x.studentName);

  return json({ status: "success", students });
}

/* Grades */
/*function gradesSave_(body, userEmail, role) {
  try {
    const studentId = s(body.studentId).trim();
    const items = body.items || [];

    if (!studentId) throw new Error("Missing studentId");
    if (!Array.isArray(items) || !items.length) {
      throw new Error("No grade items");
    }

    const sh = getOrCreateSheet(SHEET_GRADES, [
      "studentId","itemCode","itemName",
      "max","weight","score","updatedAt","updatedBy"
    ]);

    const values = sh.getDataRange().getValues();
    const headers = values[0].map(h => s(h).trim());

    const cStudent = headers.indexOf("studentId");
    const cCode = headers.indexOf("itemCode");

    const now = new Date();

    items.forEach(it => {
      const code = s(it.code).trim();
      if (!code) return;

      // find existing row
      let foundRow = -1;

      for (let r = 1; r < values.length; r++) {
        if (
          s(values[r][cStudent]) === studentId &&
          s(values[r][cCode]) === code
        ) {
          foundRow = r + 1;
          break;
        }
      }

      const rowData = [
        studentId,
        code,
        s(it.name),
        Number(it.max || 0),
        Number(it.weight || 0),
        Number(it.score || 0),
        now,
        userEmail
      ];

      if (foundRow > 0) {
        sh.getRange(foundRow, 1, 1, rowData.length)
          .setValues([rowData]);
      } else {
        sh.appendRow(rowData);
      }
    });

    console.log("GRADES SAVE BODY: ",JSON.stringify(body));
    return json({ status: "success" });

  } catch (err) {
    return json({ status: "error", message: err.toString() });
  }
}
*/

function gradesTaskSave_(body, userEmail) {

const studentId = s(body.studentId);
const items = body.items || [];
if (!studentId) throw new Error("Missing studentId");

const sh = getSheet(SHEET_GRADES_TASKS);
const now = new Date();

// delete old rows for student
const values = sh.getDataRange().getValues();
for (let i = values.length; i >= 2; i--) {
if (s(values[i-1][0]) === studentId) {
sh.deleteRow(i);
}
}

items.forEach(it => {

const max = Number(it.max || 0);
const score = it.score === "" ? "" : Number(it.score || 0);
const percent = (score === "" || max === 0)
? 0
: Math.round((score / max) * 100);

sh.appendRow([
studentId,
it.date,
it.category,
it.taskCode,
it.taskName,
max,
score,
percent,
now,
userEmail
]);
});

return json({ status:"success" });
}

/*function gradesLoad_(e, userEmail, role) {
  try {
    const studentId = s(e.parameter.studentId).trim();
    if (!studentId) throw new Error("Missing studentId");

    const sh = getSheet(SHEET_GRADES);
    const values = sh.getDataRange().getValues();
    if (values.length < 2) {
      return json({ status: "success", items: [] });
    }

    const headers = values[0].map(h => s(h).trim());

    const cStudent = headers.indexOf("studentId");
    const cCode = headers.indexOf("itemCode");
    const cScore = headers.indexOf("score");

    const items = values.slice(1)
      .filter(r => s(r[cStudent]) === studentId)
      .map(r => ({
        code: s(r[cCode]),
        score: Number(r[cScore] || 0)
      }));

    return json({ status: "success", items });

  } catch (err) {
    return json({ status: "error", message: err.toString() });
  }
}
*/

function gradesTaskLoad_(e, userEmail, role) {
  try {

    const studentId = s(e.parameter.studentId).trim();
    if (!studentId) throw new Error("Missing studentId");

    const sh = getSheet("GradesTasks");
    const values = sh.getDataRange().getValues();

    if (values.length < 2) {
      return json({ status:"success", items: [] });
    }

    const rows = values.slice(1);

    const items = rows
    .filter(r => s(r[0]) === studentId)
    .map(r => ({
      date: s(r[1]),
      category: s(r[2]),
      taskCode: s(r[3]),
      taskName: s(r[4]),
      max: Number(r[5] || 0),
      score: r[6] === "" ? "" : Number(r[6]),
      percent: Number(r[7] || 0)
    }));

    return json({ status:"success", items });

  } catch(err) {
    return json({ status:"error", message: err.toString() });
  }
}

function doPost(e) {
  try {
    ensureRequiredSheets();

    console.log("POST PARAMS:",JSON.stringify(e.parameter));
    console.log("doPost ACTION =",e.parameter.action);

    const action = e.parameter.action || "update";
    const idToken = e.parameter.idToken || "";

    const user = verifyIdToken(idToken);
    const profile = getUserProfile(user.email);

    if (!profile || !profile.role) {
      return json({ status: "error", message: "Access denied (not in Users sheet)" });
    }

    const role = profile.role;

    // ✅ FIX: parse payload safely (json OR form-urlencoded)
    const body = parseBody(e);

    if (action === "update") return updateRecord(body, profile.email, role);

    if (action === "assign") {
      requireAdmin(role);
      return assignRecord(body, profile.email);
    }

    if (action === "uploadEvidence") return uploadEvidence(e, profile.email);

    // ✅ CHUNKED EVIDENCE UPLOAD (>5MB)
    if (action === "uploadEvidenceChunk") {
      return uploadEvidenceChunk_(body, profile.email);
    }

    if (action === "uploadEvidenceFinalize") {
      return uploadEvidenceFinalize_(body, profile.email);
    }

    if (action === "seatmapSave") {
      requireAdmin(role);
      return saveSeatMap(body, profile.email);
    }

    if (action === "seatmapRoomAdd") {
      requireAdmin(role);
      return addSeatRoom(body, profile.email);
    }

    if (action === "seatmapRoomAddWithSeats") {
      requireAdmin(role);
      return addSeatRoomWithSeats(body, profile.email);
    }

    if (action === "seatmapRoomDelete") {
      requireAdmin(role);
      return deleteSeatRoom(body, profile.email);
    }

    if (action === "seatmapDelete") {
      requireAdmin(role);
      return deleteSeatMap(body, profile.email);
    }

    if (action === "seatmapSeatDelete") {
      requireAdmin(role);
      return seatmapSeatDelete_(body, profile.email);
    }

    /*if (action === "gradesSave") {
      return gradesSave_(body, profile.email, role);
    }*/
    if (action === "gradesTaskSave") {
      return gradesTaskSave_(body, profile.email);
    }

    // ✅ LearnerDev
    if (action === "learnerDevSave") {
      return learnerDevSave_(body, profile.email);
    }
  
    return json({ status: "error", message: "Invalid action" });

  } catch (err) {
    return json({ status: "error", message: err.toString() });
  }
}

// =========================
// DROPDOWN FILTER OPTIONS
// =========================
function getFilterOptions() {
  const sh = getSheet(SHEET_MAIN);
  const values = sh.getDataRange().getValues();

  if (!values || values.length < 2) {
    return json({
      status: "success",
      schoolYears: ["(Blank)"],
      terms: ["(Blank)"],
      courseSubjects: ["(Blank)"],
      program: ["(Blank)"]
    });
  }

  const headers = values[0];
  const rows = values.slice(1);

  const colSchoolYear = headers.indexOf("School Year");
  const colTerm = headers.indexOf("Term");
  const colCourse = headers.indexOf("COURSE (Subject)");
  const colProgram = headers.indexOf("Program");

  if (colSchoolYear < 0 || colTerm < 0 || colCourse < 0 || colProgram < 0) {
    return json({
      status: "error",
      message: "Missing filter columns. Required: School Year, Term, COURSE (Subject)"
    });
  }

  const normalize = (v) => {
    const t = s(v).trim();
    return t === "" ? "(Blank)" : t;
  };

  const uniqSorted = (arr) => [...new Set(arr)].sort();

  return json({
    status: "success",
    schoolYears: uniqSorted(rows.map(r => normalize(r[colSchoolYear]))),
    terms: uniqSorted(rows.map(r => normalize(r[colTerm]))),
    courseSubjects: uniqSorted(rows.map(r => normalize(r[colCourse]))),
    program: uniqSorted(rows.map(r => normalize(r[colProgram])))
  });
}

function seatmapSeatDelete_(body, updatedBy) {
  try {
    const room = s(body.room).trim();
    const seatNo = s(body.seatNo).trim();

    if (!room) return json({ status: "error", message: "Room required." });
    if (!seatNo) return json({ status: "error", message: "SeatNo required." });

    const sh = getSheet(SHEET_SEATMAP);
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return json({ status: "error", message: "No SeatMap data." });

    // read first 5 cols: room, seatNo, studentEmail, studentId, studentName
    const values = sh.getRange(2, 1, lastRow - 1, 5).getValues();

    for (let i = values.length - 1; i >= 0; i--) {
      const rRoom = s(values[i][0]).trim();
      const rSeat = s(values[i][1]).trim();

      const rEmail = s(values[i][2]).trim();
      const rId = s(values[i][3]).trim();
      const rName = s(values[i][4]).trim();

      if (rRoom === room && rSeat === seatNo) {

        // ❌ bawal delete pag may student assigned
        const hasStudent = (rEmail || rId || rName);
        if (hasStudent) {
          return json({
            status: "error",
            message: `Cannot remove seat ${seatNo}. Student is assigned. Please clear seat first.`
          });
        }

        sh.deleteRow(i + 2);
        return json({ status: "success", message: `Seat ${seatNo} deleted.` });
      }
    }

    return json({ status: "error", message: "Seat not found in sheet." });

  } catch (err) {
    return json({ status: "error", message: "Delete error: " + err.toString() });
  }
}

function getCascadeOptions(e) {
  const sh = getSheet(SHEET_MAIN);
  const values = sh.getDataRange().getValues();

  if (!values || values.length < 2) {
    return json({ status: "success", terms: ["(Blank)"], courseSubjects: ["(Blank)"] });
  }

  const headers = values[0];
  const rows = values.slice(1);

  const colSchoolYear = headers.indexOf("School Year");
  const colTerm = headers.indexOf("Term");
  const colCourse = headers.indexOf("COURSE (Subject)");
  const colProgram = headers.indexOf("Program");

  if (colSchoolYear < 0 || colTerm < 0 || colCourse < 0 || colProgram < 0) {
    return json({ status: "error", message: "Missing columns. Required: School Year, Term, COURSE (Subject), Program." });
  }

  const normalize = (v) => {
    const t = s(v).trim();
    return t === "" ? "(Blank)" : t;
  };

  const selectedSY = normalize(e.parameter.schoolYear || "");
  const selectedTerm = normalize(e.parameter.term || "");
  const selectedCourse = normalize(e.parameter.courseSubject || "");

  let filtered = rows.map(r => ({
    sy: normalize(r[colSchoolYear]),
    term: normalize(r[colTerm]),
    course: normalize(r[colCourse]),
    program: normalize(r[colProgram])
  }));

  if (e.parameter.schoolYear) filtered = filtered.filter(x => x.sy === selectedSY);
  if (e.parameter.term) filtered = filtered.filter(x => x.term === selectedTerm);
  if (e.parameter.courseSubject) filtered = filtered.filter(x => x.course === selectedCourse);

  const uniqSorted = (arr) => [...new Set(arr)].sort();

  return json({
    status: "success",
    terms: uniqSorted(filtered.map(x => x.term)),
    courseSubjects: uniqSorted(filtered.map(x => x.course))
  });
}

// =========================
// LIST Records (Fix 6 applied)
// =========================
function listRecords(e, userEmail, role) {
  const sh = getSheet(SHEET_MAIN);
  const values = sh.getDataRange().getValues();

  if (values.length < 2) {
    return json({ status: "success", total: 0, page: 1, pageSize: 50, items: [] });
  }

  const headers = values[0];
  const rows = values.slice(1);

  const q = s(e.parameter.q).toLowerCase().trim();
  const page = Math.max(parseInt(e.parameter.page || "1", 10), 1);
  const pageSize = Math.min(Math.max(parseInt(e.parameter.pageSize || "50", 10), 10), 200);

  const onlyAssigned = s(e.parameter.onlyAssigned || "true") === "true";
  const noRemarks = s(e.parameter.noRemarks || "false") === "true";
  const notDone = s(e.parameter.notDone || "false") === "true";

  const schoolYear = s(e.parameter.schoolYear).trim();
  const term = s(e.parameter.term).trim();
  const courseSubject = s(e.parameter.courseSubject).trim();

  const idx = {
    timestamp: headers.indexOf("Timestamp"),
    email: headers.indexOf("Email Address"),
    fullName: headers.indexOf("Last Name, First Name M.I."),
    studentId: headers.indexOf("Student ID Number"),
    cellphone: headers.indexOf("Cellphone Number"),
    program: headers.indexOf("Program"),
    yearLevel: headers.indexOf("Year Level"),

    courseSubject: headers.indexOf("COURSE (Subject)"),
    term: headers.indexOf("Term"),

    picture2x2: headers.indexOf("2X2 Picture"),
    enrollmentProof: headers.indexOf("Upload Proof of Enrollment"),

    schoolYear: headers.indexOf("School Year"),
    assignedTo: headers.indexOf("Assigned To"),
    remarks: headers.indexOf("Remarks"),
    done: headers.indexOf("Done"),
    lastUpdated: headers.indexOf("Last Updated"),
    lastUpdatedBy: headers.indexOf("Last Updated By")
  };

  if (idx.schoolYear < 0 || idx.assignedTo < 0 || idx.remarks < 0 || idx.done < 0) {
    return json({
      status: "error",
      message: "Missing columns. Add: School Year, Assigned To, Remarks, Done, Last Updated, Last Updated By"
    });
  }

  let filtered = rows.filter(r => r.join("") !== "");

  if (schoolYear) filtered = filtered.filter(r => s(r[idx.schoolYear]).trim() === schoolYear);
  if (term) filtered = filtered.filter(r => s(r[idx.term]).trim() === term);
  if (courseSubject) filtered = filtered.filter(r => s(r[idx.courseSubject]).trim() === courseSubject);

  if (role !== "admin" && onlyAssigned) {
    const me = userEmail.toLowerCase().trim();
    filtered = filtered.filter(r => s(r[idx.assignedTo]).toLowerCase().trim() === me);
  }

  if (role === "student") {
    return json({
      status: "error",
      message: "Students cannot access record list"
    });
  }

  if (q) {
    filtered = filtered.filter(r => {
      const name = s(r[idx.fullName]).toLowerCase();
      const email = s(r[idx.email]).toLowerCase();
      const sid = s(r[idx.studentId]).toLowerCase();
      return name.includes(q) || email.includes(q) || sid.includes(q);
    });
  }

  if (noRemarks) filtered = filtered.filter(r => s(r[idx.remarks]).trim() === "");
  if (notDone) filtered = filtered.filter(r => !bool(r[idx.done]));

  filtered.reverse();

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);

  const pageItems = filtered.slice(start, end).map((r) => {
    const pic = s(r[idx.picture2x2]);
    const proof = s(r[idx.enrollmentProof]);

    return {
      timestamp: s(r[idx.timestamp]),
      email: s(r[idx.email]),
      fullName: s(r[idx.fullName]),
      studentId: s(r[idx.studentId]),
      //cellphoneNumber: idx.cellphone >= 0 ? s(r[idx.cellphone]) : "",
      program: s(r[idx.program]),
      yearLevel: s(r[idx.yearLevel]),

      schoolYear: s(r[idx.schoolYear]),
      term: s(r[idx.term]),
      courseSubject: s(r[idx.courseSubject]),

      assignedTo: s(r[idx.assignedTo]),
      remarks: s(r[idx.remarks]),
      done: bool(r[idx.done]),

      picture2x2: pic,
      picture2x2_direct: driveToDirectLink(pic),

      enrollmentProof: proof,
      enrollmentProof_direct: driveToDirectLink(proof),

      lastUpdated: s(r[idx.lastUpdated]),
      lastUpdatedBy: s(r[idx.lastUpdatedBy]),

      // Other info (safe)
      cellphoneNumber: getRowValue(r, headers, "Cellphone Number"),
      facebookName: getRowValue(r, headers, "Facebook Name"),
      motto: getRowValue(r, headers, "Motto"),
      courseExpectations: getRowValue(r, headers, "Course Expectation/s"),
      talentsSkills: getRowValue(r, headers, "Talent/s and/or Skill/s that you think will give you an edge throughout this course."),
      knowAboutCourse: getRowValue(r, headers, "What do you know about the Course?"),
      excitedAbout: getRowValue(r, headers, "What are you most excited about/interested in from this course?"),
      challenges: getRowValue(r, headers, "What challenges do you anticipate/What are you worried about in this course?"),
      anythingElse: getRowValue(r, headers, "Anything else you would like to tell about yourself?")
    };
  });

  return json({ status: "success", total, page, pageSize, items: pageItems });
}

// =========================
// UPDATE Record
// =========================
function updateRecord(body, userEmail, role) {
  const sh = getSheet(SHEET_MAIN);
  const values = sh.getDataRange().getValues();
  const headers = values[0];

  const emailCol = headers.indexOf("Email Address") + 1;
  const timestampCol = headers.indexOf("Timestamp") + 1;
  const studentIdCol = headers.indexOf("Student ID Number") + 1;

  const remarksCol = headers.indexOf("Remarks") + 1;
  const doneCol = headers.indexOf("Done") + 1;
  const lastUpdatedCol = headers.indexOf("Last Updated") + 1;
  const lastUpdatedByCol = headers.indexOf("Last Updated By") + 1;
  const assignedToCol = headers.indexOf("Assigned To") + 1;

  if (
    emailCol < 1 || timestampCol < 1 || studentIdCol < 1 ||
    remarksCol < 1 || doneCol < 1 || lastUpdatedCol < 1 ||
    lastUpdatedByCol < 1 || assignedToCol < 1
  ) {
    throw new Error("Missing required columns in AppDB. Check headers: Email Address, Timestamp, Student ID Number, Remarks, Done, Last Updated, Last Updated By, Assigned To");
  }

  const recordEmail = s(body.email).trim();
  const recordTimestamp = s(body.timestamp).trim();
  const recordStudentId = s(body.studentId).trim();

  const remarks = s(body.remarks);
  const done = body.done === true;

  let rowIndex = -1;

  for (let r = 2; r <= values.length; r++) {
    const eVal = s(sh.getRange(r, emailCol).getValue()).trim();
    const tVal = s(sh.getRange(r, timestampCol).getValue()).trim();
    const sVal = s(sh.getRange(r, studentIdCol).getValue()).trim();

    if (eVal === recordEmail && tVal === recordTimestamp && sVal === recordStudentId) {
      rowIndex = r;
      break;
    }
  }

  if (rowIndex < 0) return json({ status: "not_found" });

  // Reviewer enforcement
  if (role !== "admin") {
    const assignedTo = s(sh.getRange(rowIndex, assignedToCol).getValue()).toLowerCase().trim();
    if (assignedTo && assignedTo !== userEmail.toLowerCase().trim()) {
      return json({ status: "error", message: "Not assigned to you" });
    }
  }

  // Auto assign if blank
  const currentAssigned = s(sh.getRange(rowIndex, assignedToCol).getValue()).trim();
  if (!currentAssigned) {
    sh.getRange(rowIndex, assignedToCol).setValue(userEmail);
  }

  sh.getRange(rowIndex, remarksCol).setValue(remarks);
  sh.getRange(rowIndex, doneCol).setValue(done);
  sh.getRange(rowIndex, lastUpdatedCol).setValue(new Date());
  sh.getRange(rowIndex, lastUpdatedByCol).setValue(userEmail);

  const recordKey = buildRecordKey(recordEmail, recordTimestamp, recordStudentId);
  appendHistory(recordKey, userEmail, "UPDATE", remarks, done);

  return json({ status: "success" });
}

// =========================
// ADMIN Assign
// =========================
function assignRecord(body, userEmail) {
  const sh = getSheet(SHEET_MAIN);
  const values = sh.getDataRange().getValues();
  const headers = values[0];

  const emailCol = headers.indexOf("Email Address") + 1;
  const timestampCol = headers.indexOf("Timestamp") + 1;
  const studentIdCol = headers.indexOf("Student ID Number") + 1;
  const assignedToCol = headers.indexOf("Assigned To") + 1;

  const recordEmail = s(body.email).trim();
  const recordTimestamp = s(body.timestamp).trim();
  const recordStudentId = s(body.studentId).trim();
  const assignedTo = s(body.assignedTo).trim();

  let rowIndex = -1;
  for (let r = 2; r <= values.length; r++) {
    const eVal = s(sh.getRange(r, emailCol).getValue()).trim();
    const tVal = s(sh.getRange(r, timestampCol).getValue()).trim();
    const sVal = s(sh.getRange(r, studentIdCol).getValue()).trim();

    if (eVal === recordEmail && tVal === recordTimestamp && sVal === recordStudentId) {
      rowIndex = r;
      break;
    }
  }
  if (rowIndex < 0) return json({ status: "not_found" });

  sh.getRange(rowIndex, assignedToCol).setValue(assignedTo);

  const recordKey = buildRecordKey(recordEmail, recordTimestamp, recordStudentId);
  appendHistory(recordKey, userEmail, "ASSIGN", `Assigned to: ${assignedTo}`, "");

  return json({ status: "success" });
}

// =========================
// HISTORY
// =========================
function getRemarksHistory(e) {
  const recordKey = s(e.parameter.recordKey).trim();
  if (!recordKey) return json({ status: "error", message: "Missing recordKey" });

  const log = getSheet(SHEET_LOG);
  const values = log.getDataRange().getValues();
  if (values.length < 2) return json({ status: "success", items: [] });

  const headers = values[0];
  const rows = values.slice(1);

  const idx = {
    timestamp: headers.indexOf("timestamp"),
    responseId: headers.indexOf("responseId"),
    updatedBy: headers.indexOf("updatedBy"),
    action: headers.indexOf("action"),
    remarks: headers.indexOf("remarks"),
    done: headers.indexOf("done")
  };

  const filtered = rows
    .filter(r => s(r[idx.responseId]).trim() === recordKey)
    .sort((a, b) => new Date(b[idx.timestamp]) - new Date(a[idx.timestamp]));

  const items = filtered.map(r => ({
    timestamp: s(r[idx.timestamp]),
    updatedBy: s(r[idx.updatedBy]),
    action: s(r[idx.action]),
    remarks: s(r[idx.remarks]),
    done: s(r[idx.done])
  }));

  return json({ status: "success", items });
}

// =========================
// USERS (Admin dropdown)
// =========================
function listUsers() {
  const sh = getSheet(SHEET_USERS);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return json({ status: "success", items: [] });

  const headers = values[0].map(h => s(h).trim().toLowerCase());
  const rows = values.slice(1);

  const emailCol = headers.indexOf("email");
  const roleCol = headers.indexOf("role");
  const nameCol = headers.indexOf("name");

  const items = rows
    .filter(r => s(r[emailCol]).trim() !== "")
    .map(r => ({
      email: s(r[emailCol]).trim(),
      role: s(r[roleCol]).trim(),
      name: nameCol >= 0 ? s(r[nameCol]).trim() : ""
    }));

  return json({ status: "success", items });
}

// =========================
// PHOTO Base64 Endpoint
// =========================
function serveStudentPhotoBase64(e) {
  try {
    const fileId = (e.parameter.fileId || "").trim();
    if (!fileId) return json({ status: "error", message: "Missing fileId" });

    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();

    const mimeType = blob.getContentType() || "image/jpeg";
    const base64 = Utilities.base64Encode(blob.getBytes());

    return json({
      status: "success",
      fileId,
      mimeType,
      base64
    });

  } catch (err) {
    return json({ status: "error", message: "Photo error: " + err.toString() });
  }
}

// =========================
// Evidence Links (GET)
// =========================
function getEvidenceLinks(e) {
  const email = s(e.parameter.email);
  const timestamp = s(e.parameter.timestamp);
  const studentId = s(e.parameter.studentId);

  if (!email || !timestamp || !studentId) {
    return json({ status: "error", message: "Missing record identifiers" });
  }

  const recordKey = buildRecordKey(email, timestamp, studentId);

  // 1) get evidence URLs from AppDB
  const sh = getSheet(SHEET_MAIN);
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(h => s(h).trim());

  const colEmail = headers.indexOf("Email Address");
  const colTimestamp = headers.indexOf("Timestamp");
  const colStudentId = headers.indexOf("Student ID Number");
  const colEvidence = headers.indexOf("Evidence Links");

  if (colEvidence < 0) return json({ status: "success", items: [] });

  let urls = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (
      s(row[colEmail]) === email &&
      s(row[colTimestamp]) === timestamp &&
      s(row[colStudentId]) === studentId
    ) {
      const raw = s(row[colEvidence]).trim();
      urls = raw ? raw.split("\n").map(x => x.trim()).filter(Boolean) : [];
      break;
    }
  }

  if (!urls.length) return json({ status: "success", items: [] });

  // 2) read RemarksLog and map evidence url -> upload timestamp/by
  const log = getSheet(SHEET_LOG);
  const logValues = log.getDataRange().getValues();
  if (logValues.length < 2) {
    // fallback: no history
    const fallback = urls.map(u => ({
      url: u,
      type: guessEvidenceType_(u),
      uploadedAt: "",
      uploadedBy: ""
    }));
    return json({ status: "success", items: fallback });
  }

  const h = logValues[0].map(x => s(x).trim().toLowerCase());
  const rows = logValues.slice(1);

  const iTime = h.indexOf("timestamp");
  const iKey = h.indexOf("responseid");
  const iBy = h.indexOf("updatedby");
  const iAction = h.indexOf("action");
  const iRemarks = h.indexOf("remarks");

  const uploads = rows
    .filter(r => s(r[iKey]).trim() === recordKey)
    .filter(r => s(r[iAction]).trim() === "UPLOAD_EVIDENCE")
    .map(r => ({
      uploadedAt: s(r[iTime]),
      uploadedBy: s(r[iBy]),
      url: s(r[iRemarks]).trim()
    }));

  const items = urls.map(u => {
    const found = uploads.find(x => x.url === u);
    return {
      url: u,
      type: guessEvidenceType_(u),
      uploadedAt: found ? found.uploadedAt : "",
      uploadedBy: found ? found.uploadedBy : ""
    };
  });

  return json({ status: "success", items });
}

// helper: determine if pdf/image based on url
function guessEvidenceType_(url) {
  const fileId = extractDriveFileId_(url);
  if (!fileId) return "FILE";

  try {
    const f = DriveApp.getFileById(fileId);
    const mime = (f.getMimeType() || "").toLowerCase();

    if (mime.includes("pdf")) return "PDF";
    if (mime.startsWith("image/")) return "IMAGE";
    if (mime.includes("video")) return "VIDEO";
    return "FILE";
  } catch (e) {
    return "FILE";
  }
}

function extractDriveFileId_(url) {
  const str = s(url);
  const match = str.match(/[-\w]{25,}/);
  return match ? match[0] : "";
}

// =========================
// Evidence Upload (POST)
// =========================
function uploadEvidence(e, userEmail) {
  const data = parseBody(e);

  const email = s(data.email);
  const timestamp = s(data.timestamp);
  const studentId = s(data.studentId);

  const base64 = s(data.base64);
  const fileName = s(data.fileName) || "evidence.jpg";
  const mimeType = s(data.mimeType) || "image/jpeg";

  if (!email || !timestamp || !studentId) {
    throw new Error("Missing record identifiers (email/timestamp/studentId)");
  }

  if (!base64) throw new Error("Missing file base64");
  if (!EVIDENCE_FOLDER_ID) throw new Error("Missing EVIDENCE_FOLDER_ID in Code.gs");

  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, mimeType, fileName);

  const folder = DriveApp.getFolderById(EVIDENCE_FOLDER_ID);
  const file = folder.createFile(blob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = file.getId();
  let fileUrl = "https://drive.google.com/file/d/" + fileId + "/view";

  if (mimeType.startsWith("image/")) {
    fileUrl = "https://drive.google.com/uc?export=view&id=" + fileId;
  }


  // Save link into AppDB Evidence Links column
  const sh = getSheet(SHEET_MAIN);
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(h => s(h).trim());

  const colEmail = headers.indexOf("Email Address");
  const colTimestamp = headers.indexOf("Timestamp");
  const colStudentId = headers.indexOf("Student ID Number");
  const colEvidence = headers.indexOf("Evidence Links");

  if (colEvidence < 0) {
    ensureColumnExists_(SHEET_MAIN, "Evidence Links");

    // reload headers after adding
    const values2 = sh.getDataRange().getValues();
    const headers2 = values2[0].map(h => s(h).trim());
    const newColEvidence = headers2.indexOf("Evidence Links");

    if (newColEvidence < 0) throw new Error("Failed to auto-create Evidence Links column");
  }

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (
      s(row[colEmail]) === email &&
      s(row[colTimestamp]) === timestamp &&
      s(row[colStudentId]) === studentId
    ) {
      const oldVal = s(row[colEvidence]).trim();
      const newVal = oldVal ? (oldVal + "\n" + fileUrl) : fileUrl;

      sh.getRange(r + 1, colEvidence + 1).setValue(newVal);

      const recordKey = buildRecordKey(email, timestamp, studentId);
      appendHistory(recordKey, userEmail, "UPLOAD_EVIDENCE", fileUrl, false);

      return json({ status: "success", fileUrl });
    }
  }

  throw new Error("Record not found for evidence upload");
}

/* =========================
   SEAT MAP: Rooms
========================= */
function listRooms() {
  const sh = getSheet(SHEET_SEATMAP);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return json({ status: "success", rooms: [] });

  const headers = values[0].map(h => s(h).trim().toLowerCase());
  const rows = values.slice(1);

  const roomCol = headers.indexOf("room");
  if (roomCol < 0) throw new Error("SeatMap missing header: room");

  const rooms = [...new Set(rows.map(r => s(r[roomCol]).trim()).filter(Boolean))].sort();
  return json({ status: "success", rooms });
}

/* =========================
   SEAT MAP: Add Room (ADMIN)
   action = seatmapRoomAdd
========================= */
function addSeatRoom(body, updatedBy) {
  const room = s(body.room).trim();
  if (!room) return json({ status: "error", message: "Missing room" });

  const sh = getSheet(SHEET_SEATMAP);

  // Ensure header exists
  if (sh.getLastRow() < 1) {
    sh.appendRow(["room", "seatNo", "studentEmail", "studentId", "studentName", "updatedAt", "updatedBy"]);
  }

  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(h => s(h).trim().toLowerCase().replace(/\s+/g, ""));

  const roomCol = headers.indexOf("room") + 1;
  if (roomCol < 1) throw new Error("SeatMap sheet must have header: room");

  // Check if room already exists
  const lastRow = sh.getLastRow();
  if (lastRow >= 2) {
    const roomValues = sh.getRange(2, roomCol, lastRow - 1, 1).getValues();
    const exists = roomValues.some(r => s(r[0]).trim().toLowerCase() === room.toLowerCase());
    if (exists) {
      return json({ status: "success", message: "Room already exists", room });
    }
  }

  // Create a placeholder row so the room appears in listRooms()
  // seatNo is set to "1" but empty student info.
  const now = new Date();
  sh.appendRow([room, "1", "", "", "", now, updatedBy]);

  return json({ status: "success", message: "Room added", room });
}

/* =========================
   SEAT MAP: Add Room + Auto Create Seats (ADMIN)
   action = seatmapRoomAddWithSeats
   Default: 1001–1050 (50 seats)
========================= */
function addSeatRoomWithSeats(body, updatedBy) {
  const room = s(body.room).trim();
  const startSeatNo = parseInt(body.startSeatNo || "1001", 10);
  const totalSeats = parseInt(body.totalSeats || "50", 10);

  if (!room) return json({ status: "error", message: "Missing room" });
  if (isNaN(startSeatNo) || startSeatNo <= 0) {
    return json({ status: "error", message: "Invalid startSeatNo" });
  }
  if (isNaN(totalSeats) || totalSeats <= 0 || totalSeats > 200) {
    return json({ status: "error", message: "Invalid totalSeats (max 200)" });
  }

  const sh = getSheet(SHEET_SEATMAP);

  // Ensure header exists
  if (sh.getLastRow() < 1) {
    sh.appendRow(["room", "seatNo", "studentEmail", "studentId", "studentName", "updatedAt", "updatedBy"]);
  }

  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(h => s(h).trim().toLowerCase().replace(/\s+/g, ""));

  const roomCol = headers.indexOf("room") + 1;
  const seatCol = headers.indexOf("seatno") + 1;

  if (roomCol < 1 || seatCol < 1) {
    throw new Error("SeatMap sheet must have headers: room, seatNo");
  }

  // Check if room already exists
  const lastRow = sh.getLastRow();
  if (lastRow >= 2) {
    const roomValues = sh.getRange(2, roomCol, lastRow - 1, 1).getValues();
    const exists = roomValues.some(r => s(r[0]).trim().toLowerCase() === room.toLowerCase());
    if (exists) {
      return json({
        status: "success",
        message: "Room already exists",
        room,
        created: 0
      });
    }
  }

  // Create 50 seats: 1001–1050 (empty student info)
  const rowsToAdd = [];
  for (let i = 0; i < totalSeats; i++) {
    const seatNo = String(startSeatNo + i);
    rowsToAdd.push([room, seatNo, "", "", "", "", ""]);
  }

  sh.getRange(sh.getLastRow() + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);

  return json({
    status: "success",
    message: `Room added with ${totalSeats} seats (${startSeatNo}-${startSeatNo + totalSeats - 1})`,
    room,
    created: totalSeats
  });
}

/* =========================
   SEAT MAP: Delete Room (ADMIN)
   action = seatmapRoomDelete
========================= */
function deleteSeatRoom(body, updatedBy) {
  const room = s(body.room).trim();
  if (!room) return json({ status: "error", message: "Missing room" });

  const sh = getSheet(SHEET_SEATMAP);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) {
    return json({ status: "success", message: "Room deleted (no data)", room, deleted: 0 });
  }

  const headers = values[0].map(h => s(h).trim().toLowerCase());
  const roomCol = headers.indexOf("room");

  if (roomCol < 0) {
    return json({ status: "error", message: "SeatMap missing header: room" });
  }

  // Delete from bottom to top to avoid row shifting
  let deleted = 0;
  for (let r = sh.getLastRow(); r >= 2; r--) {
    const rRoom = s(sh.getRange(r, roomCol + 1).getValue()).trim();
    if (rRoom === room) {
      sh.deleteRow(r);
      deleted++;
    }
  }

  return json({
    status: "success",
    message: deleted > 0 ? "Room deleted" : "Room not found",
    room,
    deleted
  });
}

/* =========================
   SEAT MAP: Load
========================= */
function getSeatMap(e) {
  const room = s(e.parameter.room).trim();
  if (!room) return json({ status: "error", message: "Missing room" });

  const sh = getSheet(SHEET_SEATMAP);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return json({ status: "success", room, seats: [] });

  const headers = values[0].map(h => s(h).trim().toLowerCase());
  const rows = values.slice(1);

  const roomCol = headers.indexOf("room");
  const seatCol = headers.indexOf("seatno");
  const emailCol = headers.indexOf("studentemail");
  const sidCol = headers.indexOf("studentid");
  const nameCol = headers.indexOf("studentname");

  if (roomCol < 0 || seatCol < 0) {
    throw new Error("SeatMap sheet must have headers: room, seatNo");
  }

  const seats = rows
    .filter(r => s(r[roomCol]).trim() === room)
    .map(r => ({
      seatNo: s(r[seatCol]).trim(),
      studentEmail: emailCol >= 0 ? s(r[emailCol]).trim() : "",
      studentId: sidCol >= 0 ? s(r[sidCol]).trim() : "",
      studentName: nameCol >= 0 ? s(r[nameCol]).trim() : ""
    }))
    .filter(x => x.seatNo !== "");

  // sort seatNo numeric if possible
  seats.sort((a, b) => {
    const an = parseInt(a.seatNo, 10);
    const bn = parseInt(b.seatNo, 10);
    if (!isNaN(an) && !isNaN(bn)) return an - bn;
    return String(a.seatNo).localeCompare(String(b.seatNo));
  });

  return json({ status: "success", room, seats });
}

/* =========================
   SEAT MAP: Save (ADMIN)
========================= */
function saveSeatMap(body, updatedBy) {
  const room = s(body.room).trim();
  const seatNo = s(body.seatNo).trim();

  const studentEmail = s(body.studentEmail).trim();
  const studentId = s(body.studentId).trim();
  const studentName = s(body.studentName).trim();

  if (!room || !seatNo) {
    return json({ status: "error", message: "Missing room or seatNo" });
  }

  const sh = getSheet(SHEET_SEATMAP);

  // ensure header exists
  if (sh.getLastRow() < 1) {
    sh.appendRow(["room", "seatNo", "studentEmail", "studentId", "studentName", "updatedAt", "updatedBy"]);
  }

  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(h => s(h).trim().toLowerCase());

  const roomCol = headers.indexOf("room") + 1;
  const seatCol = headers.indexOf("seatno") + 1;
  const emailCol = headers.indexOf("studentemail") + 1;
  const sidCol = headers.indexOf("studentid") + 1;
  const nameCol = headers.indexOf("studentname") + 1;
  const updatedAtCol = headers.indexOf("updatedat") + 1;
  const updatedByCol = headers.indexOf("updatedby") + 1;

  if (roomCol < 1 || seatCol < 1) {
    throw new Error("SeatMap sheet must have headers: room, seatNo");
  }

  let foundRow = -1;

  for (let r = 2; r <= sh.getLastRow(); r++) {
    const rRoom = s(sh.getRange(r, roomCol).getValue()).trim();
    const rSeat = s(sh.getRange(r, seatCol).getValue()).trim();
    if (rRoom === room && rSeat === seatNo) {
      foundRow = r;
      break;
    }
  }

  const now = new Date();
  // ✅ Detect if this is a DELETE/CLEAR action
  const isClear =
    studentEmail === "" &&
    studentId === "" &&
    studentName === "";

  // If not found, create seat
  if (foundRow < 0) {
    sh.appendRow([
      room,
      seatNo,
      studentEmail,
      studentId,
      studentName,
      isClear ? "" : now,
      isClear ? "" : updatedBy
    ]);
    return json({ status: "success", message: isClear ? "Seat created (empty)" : "Seat created" });
  }

  if (emailCol > 0) sh.getRange(foundRow, emailCol).setValue(studentEmail);
  if (sidCol > 0) sh.getRange(foundRow, sidCol).setValue(studentId);
  if (nameCol > 0) sh.getRange(foundRow, nameCol).setValue(studentName);

  // ✅ If DELETE → clear updatedAt/updatedBy
  if (isClear) {
    if (updatedAtCol > 0) sh.getRange(foundRow, updatedAtCol).setValue("");
    if (updatedByCol > 0) sh.getRange(foundRow, updatedByCol).setValue("");
  } else {
    // ✅ Normal save → update updatedAt/updatedBy
    if (updatedAtCol > 0) sh.getRange(foundRow, updatedAtCol).setValue(now);
    if (updatedByCol > 0) sh.getRange(foundRow, updatedByCol).setValue(updatedBy);
  }

  return json({ status: "success", message: isClear ? "Seat cleared" : "Seat updated" });

}

/* =========================
   SEAT MAP: Delete (ADMIN)
   action = seatmapDelete
========================= */
function deleteSeatMap(body, updatedBy) {
  const room = s(body.room).trim();
  const seatNo = s(body.seatNo).trim();

  if (!room || !seatNo) {
    return json({ status: "error", message: "Missing room or seatNo" });
  }

  const sh = getSheet(SHEET_SEATMAP);

  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(h => s(h).trim().toLowerCase());

  const roomCol = headers.indexOf("room") + 1;
  const seatCol = headers.indexOf("seatno") + 1;

  if (roomCol < 1 || seatCol < 1) {
    throw new Error("SeatMap sheet must have headers: room, seatNo");
  }

  for (let r = 2; r <= sh.getLastRow(); r++) {
    const rRoom = s(sh.getRange(r, roomCol).getValue()).trim();
    const rSeat = s(sh.getRange(r, seatCol).getValue()).trim();

    if (rRoom === room && rSeat === seatNo) {
      sh.deleteRow(r);
      return json({ status: "success", message: "Seat deleted" });
    }
  }

  return json({ status: "not_found", message: "Seat not found" });
}

/* ======================================================
   EVIDENCE CHUNK UPLOAD (supports >5MB)
   action = uploadEvidenceChunk
   action = uploadEvidenceFinalize
====================================================== */

// Temporary folder for chunks (auto create inside Evidence folder)
function getOrCreateChunksFolder_() {
  const parent = DriveApp.getFolderById(EVIDENCE_FOLDER_ID);
  const folders = parent.getFoldersByName("_CHUNKS_TEMP");
  if (folders.hasNext()) return folders.next();
  return parent.createFolder("_CHUNKS_TEMP");
}

function uploadEvidenceChunk_(body, userEmail) {
  try {
    const uploadId = s(body.uploadId).trim();
    const chunkIndex = parseInt(body.chunkIndex || "0", 10);
    const totalChunks = parseInt(body.totalChunks || "0", 10);

    const email = s(body.email);
    const timestamp = s(body.timestamp);
    const studentId = s(body.studentId);

    const fileName = s(body.fileName) || "evidence.bin";
    const mimeType = s(body.mimeType) || "application/octet-stream";
    const chunkBase64 = s(body.chunkBase64);

    if (!uploadId) throw new Error("Missing uploadId");
    if (!email || !timestamp || !studentId) throw new Error("Missing record identifiers");
    if (!chunkBase64) throw new Error("Missing chunkBase64");
    if (!totalChunks || totalChunks < 1) throw new Error("Invalid totalChunks");

    const bytes = Utilities.base64Decode(chunkBase64);
    const blob = Utilities.newBlob(bytes, mimeType, `${uploadId}__chunk_${chunkIndex}`);

    const chunksFolder = getOrCreateChunksFolder_();
    const f = chunksFolder.createFile(blob);

    return json({
      status: "success",
      message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded`,
      uploadId,
      chunkIndex,
      totalChunks,
      chunkFileId: f.getId(),
      receivedBytes: bytes.length
    });

  } catch (err) {
    return json({ status: "error", message: "Chunk upload error: " + err.toString() });
  }
}

function uploadEvidenceFinalize_(body, userEmail) {
  try {
    const uploadId = s(body.uploadId).trim();

    const email = s(body.email);
    const timestamp = s(body.timestamp);
    const studentId = s(body.studentId);

    const fileName = s(body.fileName) || "evidence.bin";
    const mimeType = s(body.mimeType) || "application/octet-stream";
    const totalChunks = parseInt(body.totalChunks || "0", 10);

    if (!uploadId) throw new Error("Missing uploadId");
    if (!email || !timestamp || !studentId) throw new Error("Missing record identifiers");
    if (!totalChunks || totalChunks < 1) throw new Error("Invalid totalChunks");

    const chunksFolder = getOrCreateChunksFolder_();
    const files = chunksFolder.getFiles();

    // collect chunk files for this uploadId
    const chunkMap = {};
    while (files.hasNext()) {
      const f = files.next();
      const name = f.getName();
      if (name.startsWith(uploadId + "__chunk_")) {
        const idx = parseInt(name.split("__chunk_")[1], 10);
        if (!isNaN(idx)) chunkMap[idx] = f;
      }
    }

    // validate all chunks exist
    for (let i = 0; i < totalChunks; i++) {
      if (!chunkMap[i]) {
        throw new Error(`Missing chunk ${i + 1}/${totalChunks}`);
      }
    }

    // assemble bytes
    const allBytes = [];
    for (let i = 0; i < totalChunks; i++) {
      const blob = chunkMap[i].getBlob();
      const b = blob.getBytes();
      for (let k = 0; k < b.length; k++) allBytes.push(b[k]);
    }

    const finalBlob = Utilities.newBlob(allBytes, mimeType, fileName);

    // save final file to evidence folder
    const folder = DriveApp.getFolderById(EVIDENCE_FOLDER_ID);
    const finalFile = folder.createFile(finalBlob);
    finalFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileId = finalFile.getId();
    let fileUrl = "https://drive.google.com/file/d/" + fileId + "/view";

    if (mimeType.startsWith("image/")) {
      fileUrl = "https://drive.google.com/uc?export=view&id=" + fileId;
    }



    // Save link into AppDB Evidence Links column
    const sh = getSheet(SHEET_MAIN);
    const values = sh.getDataRange().getValues();
    const headers = values[0].map(h => s(h).trim());

    const colEmail = headers.indexOf("Email Address");
    const colTimestamp = headers.indexOf("Timestamp");
    const colStudentId = headers.indexOf("Student ID Number");
    const colEvidence = headers.indexOf("Evidence Links");

    if (colEvidence < 0) {
      ensureColumnExists_(SHEET_MAIN, "Evidence Links");
    }

    const values2 = sh.getDataRange().getValues();
    const headers2 = values2[0].map(h => s(h).trim());
    const colEvidence2 = headers2.indexOf("Evidence Links");

    for (let r = 1; r < values2.length; r++) {
      const row = values2[r];
      if (
        s(row[colEmail]) === email &&
        s(row[colTimestamp]) === timestamp &&
        s(row[colStudentId]) === studentId
      ) {
        const oldVal = s(row[colEvidence2]).trim();
        const newVal = oldVal ? (oldVal + "\n" + fileUrl) : fileUrl;
        sh.getRange(r + 1, colEvidence2 + 1).setValue(newVal);

        const recordKey = buildRecordKey(email, timestamp, studentId);
        appendHistory(recordKey, userEmail, "UPLOAD_EVIDENCE", fileUrl, false);

        // cleanup chunks
        for (let i = 0; i < totalChunks; i++) {
          try { chunkMap[i].setTrashed(true); } catch (e) {}
        }

        return json({
          status: "success",
          message: "Evidence finalized",
          fileUrl
        });
      }
    }

    throw new Error("Record not found for finalize");

  } catch (err) {
    return json({ status: "error", message: "Finalize error: " + err.toString() });
  }
}

/* =========================
   Testing version
========================= */
function testVersion() {
  console.log("VERSION = 2026-02-01 GRADES READY");
}

function TEST_GRADES_SAVE_DIRECT() {
  const body = {
    studentId: "TEST1",
    items: [
      { code: "QUIZ", name: "Quiz", max:50, weight:20, score:40 }
    ]
  };

  Logger.log(gradesSave_(body,"TEST@ADMIN.COM","ADMIN"));
}

/* =========================
   Manual Drive Auth Test
========================= */
function FORCE_DRIVE_AUTH_TEST() {
  const testFileId = "1WO1Ii-d8t1ospE2IOoUe9hSrHOXjyuHx"; // replace if needed
  const f = DriveApp.getFileById(testFileId);
  Logger.log("File name: " + f.getName());
  Logger.log("MimeType: " + f.getMimeType());
  return f.getName();
}
