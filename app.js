/****************************************************
 * Student Form Viewer Secure Backend (Apps Script)
 * VERSION v5 FINAL + GRADES + LEARNER DEV + OFFLINE + SEAT MAP
 * Programmed by : GIL HILARIO
 * Programmed on : 2026-01-25
 * Last Updated  : 2026-02-07
 *
 * ==================================================
 * 🔐 SECURITY & AUTH
 * ==================================================
 * ✅ Google OAuth ID Token verification (tokeninfo)
 * ✅ Strict clientId allowlist enforcement
 * ✅ Users sheet allowlist (email + role)
 * ✅ Role-based access control:
 *    - admin
 *    - reviewer
 * ✅ Reviewer enforcement:
 *    - only assigned records visible/editable
 *
 * ==================================================
 * 📋 RECORDS API
 * ==================================================
 * ✅ listRecords()
 *    - server-side pagination
 *    - search (name/email/studentId)
 *    - filters (School Year / Term / Course)
 *    - cascade filter support
 *    - reviewer-only assigned filter
 *    - returns direct Drive photo links
 *
 * ✅ recordByEmail()
 *    - secure single-record fetch
 *    - reviewer assignment enforcement
 *
 * ✅ updateRecord()
 *    - remarks + done flag update
 *    - auto-assign reviewer if blank
 *    - writes Last Updated + By
 *
 * ==================================================
 * 🕓 HISTORY / AUDIT LOG
 * ==================================================
 * ✅ RemarksLog sheet tracking
 * ✅ appendHistory() logs:
 *    - UPDATE
 *    - ASSIGN
 *    - UPLOAD_EVIDENCE
 * ✅ getRemarksHistory() endpoint
 *
 * ==================================================
 * 🖼️ PHOTO SERVICES
 * ==================================================
 * ✅ serveStudentPhotoBase64()
 *    - bypass Drive permission preview issues
 *    - base64 image serving endpoint
 *    - supports restricted Drive files
 *
 * ==================================================
 * 📎 EVIDENCE SYSTEM
 * ==================================================
 * ✅ uploadEvidence() standard upload
 * ✅ Chunk upload system (>5MB files):
 *    - uploadEvidenceChunk
 *    - uploadEvidenceFinalize
 *    - temp chunk folder auto-managed
 *
 * ✅ Evidence metadata support:
 *    - URL
 *    - detected type (IMAGE / PDF / VIDEO / FILE)
 *    - uploadedAt
 *    - uploadedBy
 *
 * ✅ AppDB integration:
 *    - auto-create "Evidence Links" column
 *    - append multi-line URLs per record
 *
 * ==================================================
 * 🪑 SEAT MAP SYSTEM
 * ==================================================
 * ✅ listRooms()
 * ✅ getSeatMap()
 * ✅ saveSeatMap()
 *
 * ✅ Admin seat tools:
 *    - seatmapRoomAdd
 *    - seatmapRoomAddWithSeats (auto-generate seats)
 *    - seatmapRoomDelete
 *    - seatmapSeatDelete (safe delete — must be empty)
 *    - clear seat assignment supported
 *
 * ✅ seatmapMaster endpoint
 *    - master student list from AppDB
 *    - includes:
 *       studentId
 *       email
 *       name
 *       cellphone
 *       photo
 *       direct photo link
 *
 * ==================================================
 * 🧮 GRADES SYSTEM
 * ==================================================
 * ✅ Grades sheet auto-created
 * ✅ gradesSave_()
 *    - per student per item
 *    - upsert logic (update or insert)
 *    - stores:
 *       itemCode
 *       itemName
 *       max
 *       weight
 *       score
 *       updatedAt / updatedBy
 *
 * ✅ gradesLoad_()
 *    - loads saved scores per student
 *    - lightweight payload for UI recompute
 *
 * ==================================================
 * 📊 LEARNER DEVELOPMENT (RADAR DATA)
 * ==================================================
 * ✅ LearnerDev sheet auto-created
 * ✅ learnerDevSave_()
 *    - replaces all categories per student
 *    - stores:
 *       category
 *       score
 *       updatedAt / updatedBy
 *
 * ✅ learnerDevLoad_()
 *    - returns category + score list
 *    - used by radar chart UI
 *
 * ==================================================
 * 🧰 AUTO SETUP / SELF-HEALING
 * ==================================================
 * ✅ Auto-create missing sheets:
 *    - Users
 *    - RemarksLog
 *    - SeatMap
 *    - Grades
 *    - LearnerDev
 *
 * ✅ Auto-create missing columns:
 *    - Evidence Links (AppDB)
 *
 * ==================================================
 * 🧪 TEST UTILITIES
 * ==================================================
 * ✅ testVersion()
 * ✅ TEST_GRADES_SAVE_DIRECT()
 * ✅ FORCE_DRIVE_AUTH_TEST()
 *
 ****************************************************/

/* =================================================================================
   DOM ELEMENT REFERENCES
================================================================================= */

/* ===========================
   DOM — SCREENS / MAIN VIEWS
   Used by: showScreen(), navigation flow
=========================== */
const screenConfig = document.getElementById("screenConfig");
const screenFilters = document.getElementById("screenFilters");
const screenList = document.getElementById("screenList");
const screenDetails = document.getElementById("screenDetails");
const screenSeatMap = document.getElementById("screenSeatMap");
const screenExport = document.getElementById("screenExport");
const screenImport = document.getElementById("screenImport");
const screenMenu = document.getElementById("screenMenu");
const screenDash = document.getElementById("screenDash");
const tabContentGrades = document.getElementById("tabContentGrades");
const tabContentLearnerDev = document.getElementById("tabContentLearnerDev");

/* ===========================
   DOM — AUTH / LOGIN
=========================== */
const inpApiUrl = document.getElementById("inpApiUrl");
const inpClientId = document.getElementById("inpClientId");
const btnSaveConfig = document.getElementById("btnSaveConfig");
const btnClearConfig = document.getElementById("btnClearConfig");
const gsiButtonWrap = document.getElementById("gsiButtonWrap");
const userBadge = document.getElementById("userBadge");
const btnLogout = document.getElementById("btnLogout");

/* ===========================
   DOM — FILTER CONTROLS
=========================== */
const fSchoolYear = document.getElementById("fSchoolYear");
const fTerm = document.getElementById("fTerm");
const fCourseSubject = document.getElementById("fCourseSubject");
const fProgram = document.getElementById("fProgram");
const btnGoList = document.getElementById("btnGoList");
const btnBackToSetup = document.getElementById("btnBackToSetup");

/* ===========================
   DOM — RECORD LIST
=========================== */
const lblRecordCount = document.getElementById("lblRecordCount");
const btnChangeFilter = document.getElementById("btnChangeFilter");
const btnRefresh = document.getElementById("btnRefresh");
const btnOpenSeatMap = document.getElementById("btnOpenSeatMap");
const inpSearch = document.getElementById("inpSearch");
const chkNoRemarks = document.getElementById("chkNoRemarks");
const chkOnlyAssigned = document.getElementById("chkOnlyAssigned");
const chkNotDone = document.getElementById("chkNotDone");
const listWrap = document.getElementById("listWrap");
const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");
const lblPage = document.getElementById("lblPage");
const btnPrevTop = document.getElementById("btnPrevTop");
const btnNextTop = document.getElementById("btnNextTop");
const lblPageTop = document.getElementById("lblPageTop");
const selPageSize = document.getElementById("selPageSize");
const btnPrevRecord = document.getElementById("btnPrevRecord");
const btnNextRecord = document.getElementById("btnNextRecord");

/* ===========================
   DOM — DETAILS VIEW
=========================== */
const dName = document.getElementById("dName");
const dMeta = document.getElementById("dMeta");
const dPhoto = document.getElementById("dPhoto");
const dInfo = document.getElementById("dInfo");
const dRemarks = document.getElementById("dRemarks");
const dDone = document.getElementById("dDone");
const dLastUpdate = document.getElementById("dLastUpdate");
const btnBackToList = document.getElementById("btnBackToList");
const btnSave = document.getElementById("btnSave");
const btnHistory = document.getElementById("btnHistory");
const btnLDev = document.getElementById("btnLDev");
const btnGrades = document.getElementById("btnGrades");
const btnaddTaskRow = document.getElementById("btnaddTaskRow");
const btnsaveTaskGrades = document.getElementById("btnsaveTaskGrades");
const btnresetGradesUI = document.getElementById("btnresetGradesUI");
const btnaddLearnerDev = document.getElementById("btnaddLearnerDev");
const btnsaveLearnerDev = document.getElementById("btnsaveLearnerDev");
const historyWrap = document.getElementById("historyWrap");
const recordNavList = document.getElementById("recordNavList");

/* ===========================
   DOM — EVIDENCE
=========================== */
const inpEvidenceFile = document.getElementById("inpEvidenceFile");
const btnUploadEvidence = document.getElementById("btnUploadEvidence");
const evidenceList = document.getElementById("evidenceList");
const seatPreviewEvidenceFile = document.getElementById("seatPreviewEvidenceFile");
const btnSeatPreviewUpload = document.getElementById("btnSeatPreviewUpload");

/* ===========================
   DOM — DETAILS ACCORDIONS
=========================== */
const btnOtherInfo = document.getElementById("btnOtherInfo");
const otherInfoWrap = document.getElementById("otherInfoWrap");
const btnBasicInfo = document.getElementById("btnBasicInfo");
const basicInfoWrap = document.getElementById("basicInfoWrap");
const basicArrow = document.getElementById("basicArrow");
const otherArrow = document.getElementById("otherArrow");

/* ===========================
   DOM — MODALS
=========================== */
const photoModal = document.getElementById("photoModal");
const btnClosePhoto = document.getElementById("btnClosePhoto");
const modalPhoto = document.getElementById("modalPhoto");
const pdfModal = document.getElementById("pdfModal");
const btnClosePdf = document.getElementById("btnClosePdf");
const pdfFrame = document.getElementById("pdfFrame");
const helpModal = document.getElementById("helpModal");
const aboutModal = document.getElementById("aboutModal");
const supportModal = document.getElementById("supportModal");
const changelogModal = document.getElementById("changelogModal");
const debugModal = document.getElementById("debugModal");
const btnCloseHelp = document.getElementById("btnCloseHelp");
const btnCloseAbout = document.getElementById("btnCloseAbout");
const btnCloseSupport = document.getElementById("btnCloseSupport");
const btnCloseChangelog = document.getElementById("btnCloseChangelog");
const btnCloseDebug = document.getElementById("btnCloseDebug");
// PREVENT FLOATING PREVIEW FROM AUTO-CLOSING
const btnCloseSeatPreview = document.getElementById("btnCloseSeatPreview");
const seatPreviewFloat = document.getElementById("seatPreviewFloat");
// remarks preview - mobile
const btnPvMSave = document.getElementById("btnPvMSaveRemarks");
// remarks preview - desktop
const btnPvSave = document.getElementById("btnPvSaveRemarks");
const btnrunExport = document.getElementById("btnrunExport");
const btnclosescreenExport = document.getElementById("btnclosescreenExport");
const btnclosescreenImport = document.getElementById("btnclosescreenImport");
const btnhandleJsonUpload = document.getElementById("btnhandleJsonUpload");
const btndownloadAddin = document.getElementById("btndownloadAddin");
const btngoToMainMenu = document.getElementById("btngoToMainMenu");

/* ===========================
   DOM — SEAT MAP
=========================== */
const seatRoomLabel = document.getElementById("seatRoomLabel");
const selSeatRoom = document.getElementById("selSeatRoom");
const btnLoadSeatRoom = document.getElementById("btnLoadSeatRoom");
const btnSeatAddRoom = document.getElementById("btnSeatAddRoom");
const seatAddRoomWrap = document.getElementById("seatAddRoomWrap");
const btnCancelAddRoom = document.getElementById("btnCancelAddRoom");
const btnAddTable = document.getElementById("btnAddTable");
const addTableWrap = document.getElementById("addTableWrap");
const inpTableSeatNo = document.getElementById("inpTableSeatNo");
const inpTableStudentName = document.getElementById("inpTableStudentName");
const btnSaveTable = document.getElementById("btnSaveTable");
const btnCancelTable = document.getElementById("btnCancelTable");
const seatGrid = document.getElementById("seatGrid");
const btnSeatBack = document.getElementById("btnSeatBack");
const btnSeatEditToggle = document.getElementById("btnSeatEditToggle");

/* ===========================
   DOM — SEAT EDIT MODAL
=========================== */
const seatEditModal = document.getElementById("seatEditModal");
const btnCloseSeatEdit = document.getElementById("btnCloseSeatEdit");
const seatEditRoomLabel = document.getElementById("seatEditRoomLabel");
const editSeatNo = document.getElementById("editSeatNo");
const editStudentName = document.getElementById("editStudentName");
const editStudentEmail = document.getElementById("editStudentEmail");
const editStudentId = document.getElementById("editStudentId");
const btnSeatEditSave = document.getElementById("btnSeatEditSave");
const btnSeatEditDelete = document.getElementById("btnSeatEditDelete");
const btnSeatEditCancel = document.getElementById("btnSeatEditCancel");

/* ===========================
   DOM — SEAT ADMIN TOOLS
=========================== */
const seatAdminTools = document.getElementById("seatAdminTools");
const inpNewRoom = document.getElementById("inpNewRoom");
const btnAddRoom = document.getElementById("btnAddRoom");
const btnDeleteRoom = document.getElementById("btnDeleteRoom");
const btnAddSeatOnly = document.getElementById("btnAddSeatOnly");
const seatEditorWrap = document.getElementById("seatEditorWrap");
const inpSeatNo = document.getElementById("inpSeatNo");
const inpSeatEmail = document.getElementById("inpSeatEmail");
const inpSeatId = document.getElementById("inpSeatId");
const inpSeatName = document.getElementById("inpSeatName");
const btnSeatSave = document.getElementById("btnSeatSave");
const btnSeatClear = document.getElementById("btnSeatClear");
const btnRemoveSeat = document.getElementById("btnRemoveSeat");
const inpAddStudentId = document.getElementById("inpAddStudentId");
const inpAddStudentEmail = document.getElementById("inpAddStudentEmail");

/* ===========================
   DOM — MAIN MENU
=========================== */
const menuStudentInfo = document.getElementById("menuStudentInfo");
const menuSeatMapInfo = document.getElementById("menuSeatMapInfo");
const menuExport = document.getElementById("menuExport");
const menuExportMainList = document.getElementById("menuExportMainList");
const menuImportDownload = document.getElementById("menuImportDownload");
const exportCourse = document.getElementById("exportCourse");

/* ===========================
   DOM — DEBUG & SYNC PANEL
=========================== */
const dbgApiUrl = document.getElementById("dbgApiUrl");
const dbgPending = document.getElementById("dbgPending");
const dbgRoom = document.getElementById("dbgRoom");
const dbgSeats = document.getElementById("dbgSeats");
const pendingPanel = document.getElementById("pendingPanel");
const pendingList = document.getElementById("pendingList");
const pendingCountText = document.getElementById("pendingCountText");
const btnRetryAllPending = document.getElementById("btnRetryAllPending");
const btnClearPending = document.getElementById("btnClearPending");

/* ===========================
   DOM — STATUS BADGES
=========================== */
const netBadge = document.getElementById("netBadge");
const syncBadge = document.getElementById("syncBadge");

/* ===========================
   RUNTIME MAPS / MEMORY
=========================== */
const photoCache = new Map();
const pendingProgress = new Map();

/* ===========================
   DOM — TOPBAR / GLOBAL ACTION BUTTONS
   Header utility buttons
   Opens help/about/support/reset modals
=========================== */
const btnHelp = document.getElementById("btnHelp");
const btnAbout = document.getElementById("btnAbout");
const btnSupport = document.getElementById("btnSupport");
const btnChangelog = document.getElementById("btnChangelog");
const btnResetApp = document.getElementById("btnResetApp");

/* =================================================================================
   CONFIG CONSTANTS
================================================================================= */
const DB_NAME = "sf_cache_db";
const DB_VERSION = 1;
const LS_PENDING_UPDATES = "sf_pending_updates_v1";
const LS_SESSION = "sf_session_v1"; // ✅ keep login + current page on refresh

/* ===========================
   Google OAuth and Web API Base URL (Apps Script Web App)
=========================== */
const FIXED_API_URL = "https://script.google.com/macros/s/AKfycbxXC__2kB9B6VhTIE3pggIsDFbeX4-YFn7h9ew0TzTTk9ms22erbzeDZHQvQeLNL2we/exec";
const FIXED_CLIENT_ID = "157290002152-c2ngtbf8312no72eotpqo9j0nfvt5io1.apps.googleusercontent.com";

/* ===========================
   CONFIG — OFFLINE STORAGE
   Used by IndexedDB + Pending Sync Engine
=========================== */
const IDB_DB_NAME = "SFV4_OFFLINE_DB";
const IDB_STORE = "evidenceFiles";
const PENDING_SYNC_KEY = "pendingSyncQueue_v4";

/* ===========================
  SESSION VALIDITY
=========================== */
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

/* ===========================
  WEIGHT CONFIGURATION OBJECT
=========================== */
const gradeWeights = {
  "MIDTERM PERIOD": {
    "AUGUSTINIAN VALUE": 0.10,
    "QUIZ": 0.20,
    "CLASS PARTICIPATION": 0.30,
    "MIDTERM EXAM": 0.40
  },
  "FINAL PERIOD": {
    "AUGUSTINIAN VALUE": 0.10,
    "QUIZ": 0.20,
    "CLASS PARTICIPATION": 0.30,
    "FINAL EXAM": 0.40
  }
};

/* ===========================
   OFFLINE SYNC STORAGE KEYS
=========================== */
let netWatcherStarted = false;
let seatEditLock = false; // prevents infinite loop autofill
let lastScreenBeforeDetails = null;
let searchTimer = null;

/* =========================
   SEAT FLOATING PREVIEW
========================= */
let seatPreviewTimer = null;
let lastSeatClicked = null;
let learnerChart = null;

let gradeEditing = false;

let ALL_STUDENTS = []; // global cache

let modalZoom = {
  scale: 1,
  x: 0,
  y: 0,
  dragging: false,
  startX: 0,
  startY: 0
};

/* ===========================
   GLOBAL STATE
=========================== */
const state = {
  apiUrl: "",
  clientId: "",
  idToken: "",
  me: null,

  currentScreen: "menu", //config

  nav: {
    backTo: "menu" // "menu" | "list" | "seatmap"
  },

  filters: {
    schoolYear: "",
    term: "",
    courseSubject: ""
  },

  ui: {
    search: "",
    noRemarks: false,
    onlyAssigned: true,
    notDone: false
  },

  list: {
    page: 1,
    pageSize: "ALL",  // ✅ show ALL students
    total: 0,
    items: []
  },

  selected: null,

  seat: {
    room: "",
    editMode: false,
    seats: [],
    masterStudents: [],   // ✅ new
    editingSeat: null
  },

  grades: {
    items: [],     // grading model (Quiz, Exam, etc.)
    scores: {}     // per student scores { itemCode: score }
  },

  gradeTasks: [],

  learnerDev: {
    categories: [],
    scores: {}
  },

  gradeCategoryState: {},

  autoSaveTimer: null,

  exportData: {
    courses: [],
    students: [],
    loaded: false
  }
};

state.grades = state.grades || {};

state.categoryGrades = {
  "MIDTERM PERIOD": {},
  "FINAL PERIOD": {}
};

state.gradeCategoryState = state.gradeCategoryState || {};

state.subjectType = "minor"; // default

let masterPromise = null;
let API_LOCK = false;

/*******************************************************
* function name: apiPost
* parameter: actionOrParams (string|object), payload (object)
* return: <object>
* purpose: Sends a POST request to the API with action and idToken, handles auth failures, timeout, and JSON parsing.
********************************************************/
async function apiPost(actionOrParams, payload = {}) {

  let action = "";
  let idToken = "";

  if (typeof actionOrParams === "string") {
    action = actionOrParams;
    idToken = state.idToken || "";
  } else if (actionOrParams && typeof actionOrParams === "object") {
    action = actionOrParams.action || "";
    idToken = actionOrParams.idToken || state.idToken || "";
  }

  if (!action) throw new Error("Missing action in apiPost()");
  if (!state.apiUrl) throw new Error("Missing API URL (state.apiUrl)");

  // ✅ must be logged in
  if (!idToken || !String(idToken).trim()) {
    forceLogout("Not logged in. Please login again.");
    throw new Error("Not logged in. Please login again.");
  }

  const base = String(state.apiUrl || "").trim();
  if (!base.includes("/exec")) throw new Error("Invalid API URL. Must end with /exec");

  const url = `${base}?action=${encodeURIComponent(action)}&idToken=${encodeURIComponent(idToken)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 240000);

  try {
    const fd = new FormData();
    fd.append("payload", JSON.stringify(payload || {}));

    /*const res = await fetch(url, {
      method: "POST",
      body: fd,
      signal: controller.signal
    });*/
    const res = await fetch(url, {
      method: "POST",
      body: fd,
      mode: "cors",
      signal: controller.signal,
      credentials: "omit"
    });

    clearTimeout(timeout);

    const text = await res.text();

    let data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { status: "error", message: text };
    }

    const msg = String(data?.message || "").toLowerCase();

    const isDenied =
      msg.includes("access denied") ||
      msg.includes("not in users sheet") ||
      msg.includes("invalid token") ||
      msg.includes("aud mismatch") ||
      msg.includes("invalid client id") ||
      msg.includes("missing idtoken");

    const isHttpDenied = (res.status === 401 || res.status === 403);

    if (isDenied || isHttpDenied) {
      forceLogout(data?.message || "Access denied.");
      return { status: "error", message: "Access denied" };
    }

    return data;

  } catch (err) {
    clearTimeout(timeout);

    if (String(err).includes("AbortError")) {
      return { status: "error", message: "Request timeout. Please try again." };
    }

    return { status: "error", message: err.toString() };
  }
}

/*******************************************************
* function name: apiGet
* parameter: params (object)
* return: <object>
* purpose: Sends a GET request to the API with query parameters, parses response, and forces logout on auth/permission errors.
********************************************************/
/*async function apiGet(params = {}) {

  try {
    const url = buildUrl(params);
    const res = await fetch(url);

    const text = await res.text();
    let data = null;

    try { data = JSON.parse(text); }
    catch { data = { status: "error", message: text }; }

    const msg = String(data?.message || "").toLowerCase();

    const isDenied =
      msg.includes("access denied") ||
      msg.includes("not in users sheet") ||
      msg.includes("invalid token") ||
      msg.includes("aud mismatch") ||
      msg.includes("invalid client id") ||
      msg.includes("missing idtoken");

    const isHttpDenied = (res.status === 401 || res.status === 403);

    // logout ONLY if server explicitly says invalid token / access denied
    if (isDenied) {
      forceLogout(data?.message || "Access denied");
      return { status: "error", message: "Access denied" };
    }

    // DO NOT logout on plain HTTP error
    if (isHttpDenied) {
      console.warn("HTTP denied but not forcing logout");
      return { status: "error", message: "http_error" };
    }

    return data;

  } catch (err) {
    //return { status:"error", message: err.toString() };
    console.warn("apiGet network error:", err);
    return { status: "network_error", message: err.toString() };
  }
}*/

async function apiGet(params = {}) {

  if (API_LOCK) return { status: "blocked" };
  API_LOCK = true;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // ⏱ 30s timeout

  try {

    const url = state.apiUrl || FIXED_API_URL;

    // 🔥 ALWAYS INCLUDE TOKEN
    params.idToken = params.idToken || state.idToken;

    // 🔥 USE FormData (MATCHES Apps Script parseBody)
    const form = new FormData();
    form.append("payload", JSON.stringify(params));

    const res = await fetch(url, {
      method: "POST",
      body: form,
      signal: controller.signal
    });

    clearTimeout(timeout);

    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { status: "error", message: text };
    }

    const msg = String(data?.message || "").toLowerCase();

    const isDenied =
      msg.includes("access denied") ||
      msg.includes("denied") || // 🔥 improved detection
      msg.includes("not in users sheet") ||
      msg.includes("invalid token") ||
      msg.includes("aud mismatch") ||
      msg.includes("invalid client id") ||
      msg.includes("missing idtoken");

    const isHttpDenied = (res.status === 401 || res.status === 403);

    // 🔐 FORCE LOGOUT ONLY IF TOKEN ISSUE
    if (isDenied) {
      forceLogout(data?.message || "Access denied");
      return { status: "error", message: "access_denied" };
    }

    // 🚫 DO NOT LOOP ON HTTP ERRORS
    if (isHttpDenied) {
      console.warn("HTTP blocked:", res.status);
      return { status: "error", message: "http_error" };
    }

    return data;

  } catch (err) {

    clearTimeout(timeout);

    console.warn("apiGet network error:", err);

    if (String(err).includes("AbortError")) {
      return {
        status: "timeout",
        message: "Request timeout"
      };
    }

    return {
      status: "network_error",
      message: err.toString()
    };

  } finally {
    // ✅ ALWAYS RELEASE LOCK (no duplicate lines)
    API_LOCK = false;
  }
}

/*******************************************************
* function name: apiPostNoCors
* parameter: action (string), payload (object)
* return: <object>
* purpose: Sends a POST request using no-cors form encoding for endpoints that must avoid CORS preflight, assuming success response.
********************************************************/
async function apiPostNoCors(action, payload = {}) {

  if (!action) throw new Error("Missing action");
  if (!state.apiUrl) throw new Error("Missing API URL");
  //if (!state.idToken) throw new Error("Missing idToken");

  const base = String(state.apiUrl || "").trim();
  const url = `${base}?action=${encodeURIComponent(action)}&idToken=${encodeURIComponent(state.idToken)}`;

  // form-urlencoded (no CORS preflight)
  const form = new URLSearchParams();
  for (const k in (payload || {})) {
    form.append(k, typeof payload[k] === "object" ? JSON.stringify(payload[k]) : String(payload[k]));
  }

  // IMPORTANT: no-cors means we cannot read response
  await fetch(url, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: form.toString()
  });

  // assume success (server will handle it)
  return { status: "success" };
}

/*******************************************************
* function name: ensureMasterStudentsLoaded
* parameter: 
* return: 
* purpose: 
********************************************************/
async function ensureMasterStudentsLoaded() {

  if (state.seat.masterStudents?.length) return;

  if (masterPromise) return masterPromise;

  masterPromise = (async () => {

    /*const res = await apiGet({
      action: "seatmapMaster",
      idToken: state.idToken
    });*/
    const res = await apiPost("seatmapMaster", {});

    if (res?.status === "success") {
      state.seat.masterStudents = res.students || [];
    } else {
      state.seat.masterStudents = [];
    }

  })();

  return masterPromise;
}

/*******************************************************
 * UNIVERSAL AUTOCOMPLETE (NAME / ID / EMAIL)
 *******************************************************/
/*function setupAutocomplete(inputEl, type) {

  if (!inputEl) return;

  if (inputEl.dataset.autocompleteAttached) return;
  inputEl.dataset.autocompleteAttached = "true";

  let dropdown = document.createElement("div");
  dropdown.className = "autocomplete-dropdown";

  dropdown.style.position = "fixed";
  dropdown.style.background = "#fff";
  dropdown.style.border = "1px solid #bdbdbd";
  dropdown.style.borderRadius = "8px";
  dropdown.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.1)";
  dropdown.style.maxHeight = "220px";
  dropdown.style.overflowY = "auto";
  dropdown.style.zIndex = "2147483648";
  dropdown.style.display = "none";

  document.body.appendChild(dropdown);

  let activeIndex = -1;
  let currentList = [];

  function positionDropdown() {
    const rect = inputEl.getBoundingClientRect();
    dropdown.style.left = rect.left + "px";
    dropdown.style.top = rect.bottom + "px";
    dropdown.style.width = rect.width + "px";
  }

  function closeDropdown() {
    dropdown.style.display = "none";
    dropdown.innerHTML = "";
    activeIndex = -1;
    currentList = [];
  }

  function highlight(text, keyword) {
    if (!keyword) return text;
    const lower = text.toLowerCase();
    const idx = lower.indexOf(keyword);
    if (idx === -1) return text;

    return text.substring(0, idx)
      + "<strong>" + text.substring(idx, idx + keyword.length) + "</strong>"
      + text.substring(idx + keyword.length);
  }

  function renderList(list, keyword) {
    dropdown.innerHTML = "";
    currentList = list;
    activeIndex = -1;

    list.forEach((stu, index) => {
      const item = document.createElement("div");

      let display = "";

      if (type === "name") display = stu.studentName;
      if (type === "id") display = stu.studentId;
      if (type === "email") display = stu.studentEmail;

      item.innerHTML = highlight(display || "", keyword);

      item.style.padding = "10px";
      item.style.cursor = "pointer";

      item.onmouseover = () => setActive(index);
      item.onclick = () => selectItem(index);

      dropdown.appendChild(item);
    });

    dropdown.style.display = list.length ? "block" : "none";
  }

  function setActive(index) {
    const items = dropdown.children;
    if (!items.length) return;

    [...items].forEach(el => el.style.background = "#fff");

    activeIndex = index;

    const activeItem = items[index];
    activeItem.style.background = "#d2eafa";

    // 🔥 AUTO SCROLL INTO VIEW
    activeItem.scrollIntoView({
      block: "nearest",   // important (no jump)
      behavior: "smooth"  // optional (remove if you want instant)
    });
  }

  function selectItem(index) {
    const stu = currentList[index];
    if (!stu) return;

    applyStudentToModal(stu);
    closeDropdown();
  }

  function searchStudents(value) {
    const students = state.seat.masterStudents || [];

    return students.filter(s => {
      const name = (s.studentName || "").toLowerCase();
      const id = (s.studentId || "").toLowerCase();
      const email = (s.studentEmail || "").toLowerCase();

      return (
        name.includes(value) ||
        id.includes(value) ||
        email.includes(value)
      );
    }).slice(0, 10);
  }

  let debounceTimer;

  inputEl.addEventListener("input", () => {

    if (seatEditLock) return;

    const value = inputEl.value.trim().toLowerCase();

    clearTimeout(debounceTimer);

    if (value.length < 1) {
      closeDropdown();
      return;
    }

    debounceTimer = setTimeout(() => {
      const results = searchStudents(value);

      if (!results.length) {
        closeDropdown();
        return;
      }

      positionDropdown();
      renderList(results, value);
    }, 150);
  });

  inputEl.addEventListener("keydown", (e) => {

    const items = dropdown.children;
    if (!items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      setActive(activeIndex);
    }

    else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      setActive(activeIndex);
    }

    else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) {
        selectItem(activeIndex);
      }
    }

    else if (e.key === "Escape") {
      closeDropdown();
    }
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== inputEl) {
      closeDropdown();
    }
  });

  window.addEventListener("resize", positionDropdown);
  window.addEventListener("scroll", positionDropdown);
}*/
function setupAutocomplete(inputEl, type) {

  if (!inputEl) return;

  // 🔥 prevent duplicate attach
  if (inputEl.dataset.autocompleteAttached === "true") return;
  inputEl.dataset.autocompleteAttached = "true";

  let dropdown = document.createElement("div");
  dropdown.className = "autocomplete-dropdown";

  Object.assign(dropdown.style, {
    position: "fixed",
    background: "#fff",
    border: "1px solid #ccc",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    maxHeight: "220px",
    overflowY: "auto",
    zIndex: "2147483647",
    display: "none"
  });

  document.body.appendChild(dropdown);

  let activeIndex = -1;
  let currentList = [];
  let debounceTimer = null;

  // =========================
  // POSITION
  // =========================
  function positionDropdown() {
    const rect = inputEl.getBoundingClientRect();
    dropdown.style.left = rect.left + "px";
    dropdown.style.top = rect.bottom + "px";
    dropdown.style.width = rect.width + "px";
  }

  function closeDropdown() {
    dropdown.style.display = "none";
    dropdown.innerHTML = "";
    activeIndex = -1;
    currentList = [];
  }

  // =========================
  // HIGHLIGHT
  // =========================
  function highlight(text, keyword) {
    if (!keyword) return text;
    const idx = text.toLowerCase().indexOf(keyword);
    if (idx === -1) return text;

    return text.substring(0, idx) +
      "<strong>" + text.substring(idx, idx + keyword.length) + "</strong>" +
      text.substring(idx + keyword.length);
  }

  // =========================
  // RENDER
  // =========================
  function renderList(list, keyword) {
    dropdown.innerHTML = "";
    currentList = list;
    activeIndex = -1;

    list.forEach((stu, index) => {
      const item = document.createElement("div");

      item.innerHTML = `
        <div>👤 ${highlight(stu.studentName || "", keyword)}</div>
        <div style="font-size:12px;color:#64748b;">
          📧 ${highlight(stu.studentEmail || "", keyword)} • 
          🆔 ${highlight(stu.studentId || "", keyword)}
        </div>
      `;

      item.style.padding = "10px";
      item.style.cursor = "pointer";

      item.onmouseenter = () => setActive(index);
      item.onclick = () => selectItem(index, inputEl);

      dropdown.appendChild(item);
    });

    dropdown.style.display = list.length ? "block" : "none";
  }

  function setActive(index) {
    const items = dropdown.children;
    if (!items.length) return;

    [...items].forEach(el => el.style.background = "#fff");

    activeIndex = index;

    const activeItem = items[index];
    activeItem.style.background = "#d2eafa";

    activeItem.scrollIntoView({
      block: "nearest",   // important (no jump)
      behavior: "smooth"  // optional (remove if you want instant)
    });
  }

  // =========================
  // SELECT
  // =========================
  async function selectItem(index, inputEl) {
    const stu = currentList[index];
    if (!stu) return;

    seatEditLock = true;

    const name = stu.studentName || stu.fullName || "";

    // 🔥 INSTANT UI RESPONSE
    closeDropdown();

    if (inputEl) inputEl.value = name;

    state.ui.search = name;
    state.list.page = 1;

    applyStudentToModal(stu);

    await loadList(true);

    setTimeout(() => {
      seatEditLock = false;
    }, 0);
  }

  // =========================
  // SEARCH
  // =========================
  function searchStudents(value) {
    const students = state.seat.masterStudents || [];

    const exact = [];
    const partial = [];

    students.forEach(s => {
      const name = (s.studentName || "").toLowerCase();
      const id = (s.studentId || "").toLowerCase();
      const email = (s.studentEmail || "").toLowerCase();

      if (name.startsWith(value) || id.startsWith(value) || email.startsWith(value)) {
        exact.push(s);
      } else if (
        name.includes(value) ||
        id.includes(value) ||
        email.includes(value)
      ) {
        partial.push(s);
      }
    });

    return [...exact, ...partial].slice(0, 10);
  }

  // =========================
  // INPUT EVENT
  // =========================
  inputEl.addEventListener("input", () => {

    if (seatEditLock) return;

    const value = inputEl.value.trim().toLowerCase();

    clearTimeout(debounceTimer);

    if (!value) {
      closeDropdown();
      return;
    }

    debounceTimer = setTimeout(() => {
      const results = searchStudents(value);

      if (!results.length) return closeDropdown();

      positionDropdown();
      renderList(results, value);
    }, 200);
  });

  // =========================
  // KEYBOARD
  // =========================
  inputEl.addEventListener("keydown", (e) => {

    const items = dropdown.children;
    if (!items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      setActive(activeIndex);
    }

    else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      setActive(activeIndex);
    }

    else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) {
        selectItem(activeIndex, inputEl); // 🔥 FIXED
      }
    }

    else if (e.key === "Escape") {
      closeDropdown();
    }
  });

  // =========================
  // CLEAR BUTTON (FIXED WIDTH)
  // =========================
  if (!inputEl.dataset.clearAttached) {
    inputEl.dataset.clearAttached = "true";

    const wrapper = document.createElement("div");

    Object.assign(wrapper.style, {
      position: "relative",
      width: "50%"
    });

    inputEl.parentNode.insertBefore(wrapper, inputEl);
    wrapper.appendChild(inputEl);

    const btn = document.createElement("span");
    btn.innerHTML = "✕";

    Object.assign(btn.style, {
      position: "absolute",
      right: "10px",
      top: "50%",
      transform: "translateY(-50%)",
      cursor: "pointer",
      fontSize: "14px",
      color: "#999",
      display: "none"
    });

    wrapper.appendChild(btn);

    inputEl.addEventListener("input", () => {
      btn.style.display = inputEl.value ? "block" : "none";
    });

    btn.onclick = async () => {
      inputEl.value = "";
      state.ui.search = "";
      state.list.page = 1;

      await loadList(true);

      btn.style.display = "none";
      inputEl.focus();
    };
  }

  // =========================
  // OUTSIDE CLICK
  // =========================
  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== inputEl) {
      closeDropdown();
    }
  });

  window.addEventListener("resize", positionDropdown);
  window.addEventListener("scroll", positionDropdown);
}

/* ======================================================
   GRADES SYSTEM
====================================================== */
/* ===========================
   Rendering & UI
=========================== */
/*******************************************************
* function name: renderTaskGrades
* parameter: studentId (string)
* return: -
* purpose: Save all task grades for current student
*******************************************************/
function renderTaskGrades() {
  const tbody = document.getElementById("gradeTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const tasks = state.gradeTasks || [];
  if (!tasks.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#dc2626;">No grade items</td></tr>`; //#64748b
    return;
  }
  // ===== CATEGORY ORDER (EXCEL STYLE)
  const categoryOrder = ["AUGUSTINIAN VALUE", "QUIZ", "ASSIGNMENT", "EXERCISE", "PROJECT", "MIDTERM EXAM", "FINAL EXAM", "CLASS PARTICIPATION", "OTHERS"];

  // ===== GROUP BY PERIOD
  const periodGroups = {};
  tasks.forEach(t => {
    const period = (t.period || "MIDTERM PERIOD").toUpperCase();
    if (!periodGroups[period]) periodGroups[period] = [];
    periodGroups[period].push(t);
  });

  // ===== LOOP PERIODS
  Object.keys(periodGroups).forEach(period => {
    const periodTasks = periodGroups[period];

    // PERIOD HEADER
    const safePeriod = period.replace(/[^a-zA-Z0-9]/g, "_");
    const periodHeader = document.createElement("tr");
    periodHeader.className = "periodHeader";
    periodHeader.dataset.period = safePeriod;
    periodHeader.innerHTML = `<td colspan="6" style="background:#fde047; font-weight:900; font-size:16px; cursor:pointer;"><span id="periodArrow_${safePeriod}">▼</span>${period}</td>`;
    tbody.appendChild(periodHeader);

    // PERIOD HEADER COLLAPSE
    periodHeader.onclick = () => {
      const rows = document.querySelectorAll(".periodRow_" + safePeriod);
      const arrow = document.getElementById("periodArrow_" + safePeriod);
      const hidden = rows[0]?.classList.contains("hidden");
      rows.forEach(r => {
        r.classList.toggle("hidden");
      });
      arrow.textContent = hidden ? "▼" : "▶";
    };

    // ===== GROUP BY CATEGORY
    const grouped = {};
    periodTasks.forEach(t => {
      const cat = (t.category || "OTHERS").toUpperCase();
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(t);
    });

    // ===== SORT CATEGORY ORDER
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
      const ia = categoryOrder.indexOf(a);
      const ib = categoryOrder.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });

    // ===== LOOP CATEGORY
    sortedCategories.forEach(cat => {
      const safeCat = cat.replace(/[^a-zA-Z0-9]/g, "_");
      const catKey = safePeriod + "_" + safeCat;
      let totalScore = 0;
      let totalMax = 0;
      let missingCount = 0;
      if (state.gradeCategoryState[catKey] === undefined) {
        state.gradeCategoryState[catKey] = true;
      }

      // ===== COUNT MISSING
      grouped[cat].forEach(t => {
        if (isTaskMissing(t.score)) {
          missingCount++;
        }
      });

      // ===== CATEGORY HEADER
      const headerRow = document.createElement("tr");
      headerRow.className = "gradeCategoryHeader";
      headerRow.dataset.category = safeCat;
      headerRow.classList.add("periodRow_" + safePeriod);
      headerRow.innerHTML = `<td colspan="6" style=" background:#f1f5f9; font-weight:700; color:#334155; cursor:pointer;">
        <span id="catArrow_${safePeriod}_${safeCat}">${state.gradeCategoryState[catKey] ? "▼" : "▶"}</span>
        ${escapeHtml(cat)}${missingCount > 0 ? `<span class="missingBadge" style=" margin-left:10px; background:#fee2e2; color:#b42318; padding:3px 8px; border-radius:999px; font-size:12px; font-weight:700;">${missingCount} Missing</span>` : ""}</td>`;
      tbody.appendChild(headerRow);

      // ===== COLLAPSE
      headerRow.onclick = () => {
        const rows = document.querySelectorAll(".catRow_" + safePeriod + "_" + safeCat);
        const arrow = document.getElementById("catArrow_" + safePeriod + "_" + safeCat);
        const hidden = rows[0]?.classList.contains("hidden");
        rows.forEach(r => {
          r.classList.toggle("hidden");
        });
        state.gradeCategoryState[catKey] = !hidden;
        arrow.textContent = hidden ? "▶" : "▼";
      };

      // ===== TASK ROWS
      grouped[cat].forEach(t => {
        const tr = document.createElement("tr");
        tr.classList.add("catRow_" + safePeriod + "_" + safeCat);
        tr.classList.add("periodRow_" + safePeriod);

        if (state.gradeCategoryState[catKey] === undefined) {
          state.gradeCategoryState[catKey] = false;
        }
        if (state.gradeCategoryState[catKey] === false) {
          tr.classList.add("hidden");
        }
        tr.dataset.taskCode = t.taskCode;
        const percent = (!isTaskMissing(t.score) && Number(t.max) > 0) ? (Number(t.score) / Number(t.max)) * 100 : 0;
        if (!isTaskMissing(t.score) && Number(t.max) > 0) {
          totalScore += Number(t.score);
          totalMax += Number(t.max);
        }
        const isMissing = isTaskMissing(t.score);
        if (isMissing) {
          tr.style.background = "#fff1f2";
        }
        tr.innerHTML = `
          <td>${formatGradeDate(t.date)}</td>
          <td>${escapeHtml(t.category || "-")}</td>
          <td>
            ${escapeHtml(t.taskName || "-")}
            ${isMissing ? `<span class="notSubmitted" style="color:#b42318; font-weight:700; margin-left:8px;">⚠️ NOT SUBMITTED</span>` : ""}
          </td>
          <td>${t.max || 0}</td>
          <td><input class="gradeInput" type="number" min="0" max="${t.max || 0}" value="${t.score !== undefined ? t.score : ""}" data-taskcode="${t.taskCode}" /></td>
          <td class="gradeReadonly" id="taskPct_${t.taskCode}">${percent.toFixed(1)}%</td>
        `;
        tbody.appendChild(tr);
      });

      // ===== CATEGORY AVERAGE
      const transmuted = state.categoryGrades?.[period]?.[cat] !== undefined ? state.categoryGrades[period][cat] : 0;
      let avgColor = "#b42318";
      if (transmuted >= 75) avgColor = "#1f7a3f";
      else if (transmuted >= 50) avgColor = "#b26a00";
      const avgRow = document.createElement("tr");
      avgRow.classList.add("catAvgRow_" + safePeriod + "_" + safeCat);
      avgRow.classList.add("periodRow_" + safePeriod);
      avgRow.innerHTML = `<td colspan="5" style="text-align:right; font-weight:700; color:#475569; background:#f8fafc;">${escapeHtml(cat)} AVERAGE</td>
        <td class="catAvgRow" style="font-weight:900; background:#f8fafc; color:${avgColor}; font-size:16px;">${transmuted.toFixed(0)}</td>`; //shows transmutted
      //option
      //<td class="catAvgRow" style="font-weight:900; background:#f8fafc; color:${avgColor}; font-size:16px;">${avg.toFixed(1)}</td>`;
      //<td class="catAvgRow" style="font-weight:900; background:#f8fafc; color:${avgColor}; font-size:16px;">${transmuted.toFixed(0)}</td>`;
      tbody.appendChild(avgRow);
    });

    // ===== PERIOD AVERAGE (ONCE ONLY)
    const periodGrade = computePeriodGrade(period);
    const periodAvgRow = document.createElement("tr");
    periodAvgRow.classList.add("periodAvg_" + safePeriod);
    periodAvgRow.classList.add("periodRow_" + safePeriod);
    periodAvgRow.innerHTML = `<td colspan="5" style="text-align:right; font-weight:900; background:#e2e8f0; font-size:15px;">${period} AVERAGE</td>
      <td style="font-weight:900; font-size:18px; color:#1f7a3f;">${periodGrade.toFixed(1)}</td>`;
    tbody.appendChild(periodAvgRow);
  });

  // ===== INPUT EVENTS

  if (state.me?.role !== "student") {
    document.querySelectorAll(".gradeInput").forEach(input => {
      input.oninput = function () {
        updateGradeRealtime(this.dataset.taskcode, this);
        recomputeTaskFinal();
      };
    });
  }

  setTimeout(() => {
    recomputeAllGrades();
  }, 0);

  document.querySelectorAll('input[name="subjectType"]').forEach(radio => {
    radio.onchange = function () {
      state.subjectType = this.value;
      recomputeAllGrades();
    };
  });
}

/* OBSOLETE */
/*******************************************************
* function name: resetGradesUI
* parameter: none
* return: -
* purpose: Clears all grade scores in state, resets final grade and status display, and re-renders the grade table.
********************************************************/
/*function resetGradesUI() {
  state.grades.scores = {};

  const finalEl = document.getElementById("finalGradeValue");
  if (finalEl) finalEl.textContent = "0.00%";

  const statusEl = document.getElementById("finalGradeStatus");
  if (statusEl) {
    statusEl.textContent = "—";
    statusEl.className = "gradeStatus";
  }
}*/

/*******************************************************
* function name: resetGradeUI
* parameter: none
* return: -
* purpose: -
*******************************************************/
async function resetGradeUI() {

  // 1. Clear State
  state.gradeTasks = [];

  // 2. Load default template into state
  state.gradeTasks = getDefaultGradeTemplate();

  // 3. Reset computed values
  state.categoryGrades = {
    "MIDTERM PERIOD": {},
    "FINAL PERIOD": {}
  };
  state.gradeCategoryState = {};

  // 4. Clear table (optional, render will overwrite anyway)
  const tbody = document.getElementById("gradeTableBody");
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#94a3b8;">
          Loading...
        </td>
      </tr>
    `;
  }

  // 5. Re-render UI
  // Load Transmutation table
  if (!state.transmutationMajor) {
    await loadTransmutationTables();
  }
  renderTaskGrades();

  // 6. Recompute grades
  recomputeAllGrades();

  // 7. Reset final grade display
  // ✅ CLEAR FINAL GRADE
  const finalEl = document.getElementById("finalGradeValue");
  if (finalEl) {
    finalEl.textContent = "-";
    //finalEl.style.color = "#64748b";
    finalEl.style.color = "#1e5db6";
  }

  // ✅ CLEAR STATUS BADGE
  const badge = document.getElementById("finalGradeStatus");
  if (badge) {
    badge.textContent = "-";
    badge.classList.remove("passed", "failed", "incomplete");
  }

  // ✅ CLEAR STUDENT ID DISPLAY
  const idEl = document.getElementById("gradeStudentId");
  if (idEl) {
    idEl.textContent = "-";
  }

}

/* ===========================
   Recompute / Calculation Engine
=========================== */
/*******************************************************
* function name: recomputeAllGrades
* parameter: 
* return: -
* purpose: 
*******************************************************/
function recomputeAllGrades() {

  state.categoryGrades = {
    "MIDTERM PERIOD": {},
    "FINAL PERIOD": {}
  };

  const tasks = state.gradeTasks || [];

  // ✅ GROUP FIRST (NO FILTER BUGS)
  const grouped = {};

  tasks.forEach(t => {
    const period = normalize(t.period || "MIDTERM PERIOD");
    const category = normalize(t.category);

    if (!grouped[period]) grouped[period] = {};
    if (!grouped[period][category]) grouped[period][category] = [];

    grouped[period][category].push(t);
  });

  // ✅ COMPUTE PER CATEGORY
  Object.keys(grouped).forEach(period => {
    Object.keys(grouped[period]).forEach(category => {

      const tasksForCategory = grouped[period][category];

      if (!tasksForCategory.length) return;

      const type = getCategoryType(category);

      const result = computeCategoryGrade(tasksForCategory, type);

      // ✅ STORE USING NORMALIZED KEY
      state.categoryGrades[period][category] = result.grade;

      // ✅ UPDATE UI
      const safePeriod = period.replace(/[^a-zA-Z0-9]/g, "_");
      const safeCat = category.replace(/[^a-zA-Z0-9]/g, "_");

      const row = document.querySelector(`.catAvgRow_${safePeriod}_${safeCat}`);
      const cell = row ? row.querySelector(".catAvgRow") : null;

      if (cell) {
        const value = Number(result.grade) || 0;

        // update value
        cell.textContent = value.toFixed(0);
        if (value >= 85) cell.style.color = "#1f7a3f";      // green
        else if (value >= 75) cell.style.color = "#b26a00"; // orange
        else cell.style.color = "#b42318";                  // red
      }
    });
  });

  // ✅ PERIOD + FINAL
  recomputePeriodAverages();
  recomputeTaskFinal();
}

/*******************************************************
* function name: recomputeTaskFinal
* parameter: 
* return: -
* purpose: -color per row, - compute final grade, - update PASSED / FAILED badge
*******************************************************/
function recomputeTaskFinal() {
  let total = 0;
  let count = 0;

  (state.gradeTasks || []).forEach(task => {
    const score = Number.isFinite(Number(task.score)) ? Number(task.score) : "";
    const max = Number(task.max || 0);
    let pct = 0;

    // compute %
    if (score !== "" && max > 0) {
      pct = (score / max) * 100;
      total += pct;
      count++;
    }

    // save percent in memory
    task.percent = pct;
    // ===== UPDATE ROW % CELL =====
    const cell = document.getElementById("taskPct_" + task.taskCode);
    if (cell) {
      cell.textContent = pct.toFixed(1) + "%";
      if (pct >= 85) cell.style.color = "#1f7a3f";      // green
      else if (pct >= 75) cell.style.color = "#b26a00"; // orange
      else cell.style.color = "#b42318";                // red
    }
  });

  // ===== FINAL GRADE =====
  const midterm = computePeriodGrade("MIDTERM PERIOD") || 0;
  const finalPeriod = computePeriodGrade("FINAL PERIOD") || 0;
  const final = (midterm * 0.5) + (finalPeriod * 0.5);
  const finalEl = document.getElementById("finalGradeValue");
  if (finalEl) {
    finalEl.textContent = final.toFixed(2);
  }
  const noteE1 = document.getElementById("finalGradeNote");
  if (noteE1) {
    noteE1.textContent = "Please be advised that this is an unofficial list of Grades. In case of inconsistency, please contact your class adviser or assigned faculty."
  }
  // ===== BADGE =====
  const badge = document.getElementById("finalGradeStatus");
  if (!badge) return;
  // reset class safely
  badge.classList.remove("passed", "failed", "incomplete");
  // if no grade yet
  const hasMidterm = hasPeriodGrades("MIDTERM PERIOD");
  const hasFinal = hasPeriodGrades("FINAL PERIOD");

  if (!hasMidterm || !hasFinal) {
    badge.textContent = "INCOMPLETE";
    badge.classList.add("incomplete");
    return;
  }

  if (final >= 75) {
    badge.textContent = "PASSED";
    badge.classList.add("passed");
  } else {
    badge.textContent = "FAILED";
    badge.classList.add("failed");
  }
}

/*******************************************************
* function name: recomputePeriodAverages
* parameter: -
* return: -
* purpose: -
*******************************************************/
function recomputePeriodAverages() {
  ["MIDTERM PERIOD", "FINAL PERIOD"].forEach(period => {
    const safePeriod = period.replace(/[^a-zA-Z0-9]/g, "_");
    const grade = computePeriodGrade(period);

    const row = document.querySelector(".periodAvg_" + safePeriod);
    if (!row) return;

    const cell = row.querySelector("td:last-child");

    if (cell) {
      const value = Number(grade) || 0;
      // update value
      cell.textContent = value.toFixed(1);
      if (value >= 85) cell.style.color = "#1f7a3f";      // green
      else if (value >= 75) cell.style.color = "#b26a00"; // orange
      else cell.style.color = "#b42318";                  // red
    }
  });
}

/*******************************************************
* function name: computePeriodGrade
* parameter: -
* return: -
* purpose: -
*******************************************************/
function computePeriodGrade(period) {
  const weights = gradeWeights[period];
  const categories = state.categoryGrades[period] || {};

  let total = 0;

  Object.keys(weights).forEach(cat => {
    const grade = categories[cat] ?? categories[normalize(cat)];
    if (grade !== undefined) {
      total += grade * weights[cat];
    }
  });

  return total;
}

/*******************************************************
* function name: computeCategoryGrade
* parameter: 
* return: -
* purpose: -
*******************************************************/
function computeCategoryGrade(tasks, type = "minor") {

  let totalScore = 0;
  let totalMax = 0;

  tasks.forEach(t => {
    const rawScore = t.score;

    const score = rawScore === "" || rawScore === null || rawScore === undefined ? 0 : parseFloat(rawScore);

    const max = parseFloat(t.max);

    if (!isNaN(max) && max > 0) {
      totalScore += (isNaN(score) ? 0 : score);
      totalMax += max;
    }
  });

  const raw = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;

  const transmuted = transmute(raw, type);

  return {
    raw,                 // % (e.g. 77.5)
    grade: transmuted,   // transmuted (e.g. 88)
    totalScore,          // e.g. 31
    totalMax             // e.g. 40
  };
}

/*******************************************************
* function name: computeRawPercent
* parameter: -
* return: -
* purpose: -
*******************************************************/
function computeRawPercent(tasks) {
  let totalScore = 0;
  let totalMax = 0;
  tasks.forEach(t => {
    const score = Number(t.score);
    const max = Number(t.max);
    if (Number.isFinite(score) && max > 0) {
      totalScore += score;
      totalMax += max;
    }
  });
  if (totalMax === 0) return 0;
  return (totalScore / totalMax) * 100;
}

/*******************************************************
* function name: hasPeriodGrades
* parameter: 
* return: -
* purpose: 
*******************************************************/
function hasPeriodGrades(period) {
  return (state.gradeTasks || []).some(t => {
    const p = normalize(t.period || "MIDTERM PERIOD");
    const score = Number(t.score);
    const max = Number(t.max);

    return (
      p === normalize(period) &&
      Number.isFinite(score) &&
      max > 0
    );
  });
}

/*******************************************************
* function name: updateGradeRealtime
* parameter: 
* return: -
* purpose: 
*******************************************************/
function updateGradeRealtime(taskCode, input) {
  const raw = input.value.trim();
  const value = raw === "" ? "" : Number(raw);

  // ===== FIND TASK SAFE =====
  const task = (state.gradeTasks || []).find(t => String(t.taskCode).trim().toUpperCase() === String(taskCode).trim().toUpperCase());

  if (!task) {
    console.warn("Task not found:", taskCode);
    return;
  }

  // ===== UPDATE MEMORY =====
  task.score = value;

  // ===== ROW FIRST =====
  const row = input.closest("tr");

  // ===== REALTIME PERCENT CALC =====
  const max = Number(task.max) || 0;
  //console.log("max:",max);
  let pct = 0;
  const scoreNum = Number(input.value);
  if (Number.isFinite(scoreNum) && max > 0) {
    pct = (scoreNum / max) * 100;
  }

  // find percent cell
  const pctCell = document.getElementById("taskPct_" + task.taskCode);
  if (pctCell) {
    pctCell.textContent = pct.toFixed(1) + "%";
    // realtime color
    if (pct >= 75) pctCell.style.color = "#1f7a3f";         // green
    else if (pct >= 50) pctCell.style.color = "#b26a00";    // orange
    else pctCell.style.color = "#b42318";                   // red
  }

  // ===== ROW =====
  const isMissing = raw === "";

  // ===== BACKGROUND =====
  row.style.background = isMissing ? "#fff1f2" : "";

  // ===== NOT SUBMITTED =====
  const taskCell = row.children[2];
  taskCell.querySelectorAll(".notSubmitted").forEach(e => e.remove());

  if (isMissing) {
    taskCell.insertAdjacentHTML("beforeend", `<span class="notSubmitted" style="color:#b42318; font-weight:700; margin-left:8px;">⚠️ NOT SUBMITTED</span>`);
  }

  updateCategoryMissingBadge(task.category);

  // ===== FINAL =====
  recomputeAllGrades();
}

/*******************************************************
* function name: updateCategoryMissingBadge
* parameter: 
* return: -
* purpose: 
*******************************************************/
function updateCategoryMissingBadge(category) {
  const categoryUpper = category.toUpperCase();

  const periods = ["MIDTERM PERIOD", "FINAL PERIOD"];

  periods.forEach(period => {

    const safePeriod = period.replace(/[^a-zA-Z0-9]/g, "_");
    const safeCat = categoryUpper.replace(/[^a-zA-Z0-9]/g, "_");

    const rows = document.querySelectorAll(`.catRow_${safePeriod}_${safeCat}`);

    if (!rows.length) return;

    let missing = 0;

    rows.forEach(row => {
      const input = row.querySelector(".gradeInput");
      if (!input) return;

      const raw = input.value.trim();

      if (raw === "") {
        missing++;
      }
    });

    const header = document.querySelector(`.gradeCategoryHeader.periodRow_${safePeriod}[data-category="${safeCat}"]`);

    if (!header) return;

    const td = header.querySelector("td");

    // remove old badge
    td.querySelectorAll(".missingBadge").forEach(e => e.remove());

    // add new badge
    if (missing > 0) {
      const badge = document.createElement("span");
      badge.className = "missingBadge";
      badge.style.marginLeft = "10px";
      badge.style.background = "#fee2e2";
      badge.style.color = "#b42318";
      badge.style.padding = "3px 8px";
      badge.style.borderRadius = "999px";
      badge.style.fontSize = "12px";
      badge.style.fontWeight = "700";
      badge.textContent = missing + " Missing";
      td.appendChild(badge);
    }
  });
}

/* ===========================
   Load / Fetch
=========================== */
/*******************************************************
* function name: loadTaskGrades
* parameter: -
* return: -
* purpose: -
*******************************************************/
async function loadTaskGrades(studentId) {
  try {

    showLoading("Loading GRADES... Please wait!");

    // reset all fields
    resetGradeUI();

    // Stop API call if logged out
    if (!state.idToken) {
      //console.log("Skipped grades load - no session.");
      hideLoading();
      return;
    }

    const student = state.currentStudent;
    if (!student) {
      hideLoading();
      return;
    }

    // Load Transmutation table
    if (!state.transmutationMajor) {
      await loadTransmutationTables();
    }

    /*const res = await apiGet({
      action: "gradesTaskLoad",
      studentId,
      idToken: state.idToken
    });*/
    const res = await apiPost("gradesTaskLoad", { studentId });

    if (!res || res.status !== "success") {
      hideLoading();
      throw new Error(res?.message || "Load failed");
    }

    document.getElementById("gradeStudentId").textContent = state.currentStudent.studentId || "—";
    document.getElementById("courseStudentId").textContent = state.currentStudent.courseSubject || "-";

    // 🔥 ALWAYS RESET FIRST
    let items = res.items || [];

    // ===== CASE 1: NO DATA → USE TEMPLATE
    if (!items.length) {

      //console.log("⚠️ No sheet data → using default template");

      state.gradeTasks = getDefaultGradeTemplate();

      // 🔥 IMPORTANT
      //loadGradeCourses(student, res.items);
      renderTaskGrades();
      recomputeTaskFinal();
      applyRoleUI();
      hideLoading();
      return;
    }

    // ===== CASE 2: WITH DATA

    // 🔥 STEP 1: SET DEFAULT COURSE
    /* OBSOLETE */
    // AUTO COURSE OVERRIDE
    /*if (!state.filters.courseSubject) {
      const firstCourse = items.find(i => i.courseSubject)?.courseSubject;
      if (firstCourse) {
        state.filters.courseSubject = firstCourse;
        //console.log("state.filters.courseSubject = firstCourse: ", state.filters.courseSubject = firstCourse);
      }
    }*/

    // 🔥 STEP 2: FILTER
    const selectedCourse = state.filters.courseSubject;
    //const selectedCourse = state.currentStudent.courseSubject;

    let filtered = items.filter(item =>
      !selectedCourse || item.courseSubject === selectedCourse
    );

    // 🔥 NO MATCH, USE TEMPLATE
    if (!filtered.length) {
      console.warn("⚠️ No matching course → using default template");

      state.gradeTasks = getDefaultGradeTemplate();
    } else {
      state.gradeTasks = filtered;
    }

    //console.log("loadTaskGrades student: ", student);

    //if (!gradeEditing) {
    //loadGradeCourses(student, res.items);
    renderTaskGrades();
    recomputeTaskFinal();
    applyRoleUI();
    //}
    hideLoading();
  } catch (err) {
    //console.error("TASK LOAD ERROR:", err);
    state.gradeTasks = getDefaultGradeTemplate();
    renderTaskGrades();
    recomputeTaskFinal();
    applyRoleUI();
    hideLoading();
  }
}

/*******************************************************
* function name: loadGradeCourses
* parameter: 
* return: 
* purpose: 
*******************************************************/
/*async function loadGradeCourses(student, gradeItems) {

  const select = document.getElementById("newTaskCourseSection");
  select.innerHTML = '<option value="">-- Select Course/Section --</option>';

  let courseSet = new Set();

  try {
    // ✅ CALL NEW API
    const res = await apiGet({
      action: "getStudentCourses",
      studentId: student.studentId,
      idToken: state.idToken
    });

    if (res.status === "success") {
      (res.courses || []).forEach(c => {
        if (c) courseSet.add(c.trim());
      });
    }

  } catch (e) {
    console.error("Course load failed:", e);
  }

  // ✅ FALLBACK (grades)
  (gradeItems || []).forEach(item => {
    if (item.courseSubject) {
      courseSet.add(item.courseSubject.trim());
    }
  });

  // ✅ FALLBACK (student)
  if (student.courseSubject) {
    courseSet.add(student.courseSubject.trim());
  }

  const courses = [...courseSet].sort();

  console.log("FINAL COURSES:", courses);

  // ✅ POPULATE
  courses.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  });

  // ✅ DEFAULT
  if (!state.filters.courseSubject) {
    state.filters.courseSubject = courses[0] || "";
  }

  select.value = state.filters.courseSubject;

  select.onchange = function () {
    state.filters.courseSubject = this.value;
    loadTaskGrades(state.currentStudent.studentId);
  };
}*/

/*******************************************************
* function name: loadTransmutationTables
* parameter: -
* return: -
* purpose: -
*******************************************************/
async function loadTransmutationTables() {
  const res = await apiPost({
    action: "getTransmutationTables",
    idToken: state.idToken
  });

  state.transmutationMajor = res.major;
  state.transmutationMinor = res.minor;

}

/* ===========================
   Save / Modify
=========================== */
/*******************************************************
* function name: saveTaskGrades
* parameter: 
* return: -
* purpose: Save all task grades for current student
*******************************************************/
async function saveTaskGrades() {
  showLoading("Saving task grades...");

  try {
    const student = state.currentStudent;
    if (!student) {
      hideLoading();
      toast("No student selected");
      return;
    }

    const selectedCourse = document.getElementById("newTaskCourseSection").value;
    if (!selectedCourse) {
      hideLoading();
      toast("Please select a Course/Subject first");
      return;
    }

    // 🔥 STEP 1: GET ALL EXISTING DATA FIRST
    /*const resLoad = await apiGet({
      action: "gradesTaskLoad",
      studentId: student.studentId,
      idToken: state.idToken
    });*/
    const resLoad = await apiPost("gradesTaskLoad", { studentId: student.studentId });

    let allItems = resLoad?.items || [];

    // 🔥 STEP 2: REMOVE ONLY CURRENT COURSE
    allItems = allItems.filter(item =>
      (item.courseSubject || "").trim().toUpperCase() !== selectedCourse.trim().toUpperCase()
    );

    // 🔥 STEP 3: ADD UPDATED COURSE ITEMS
    const newItems = (state.gradeTasks || []).map(g => ({
      courseSubject: selectedCourse,
      period: g.period,
      date: g.date,
      category: g.category,
      taskCode: g.taskCode,
      taskName: g.taskName,
      max: g.max,
      score: g.score,
      percent: g.percent
    }));

    const finalItems = [...allItems, ...newItems];

    // 🔥 STEP 4: SAVE MERGED DATA
    const res = await apiPost(
      {
        action: "gradesTaskSave",
        idToken: state.idToken
      },
      {
        studentId: student.studentId,
        items: finalItems
      }
    );

    if (!res || res.status !== "success") {
      hideLoading();
      toast("❌ Save failed. " || res?.message);
      console.warn("❌ Save failed. " || res?.message);
      return;
    }

    toast("Grades Saved Successfully ✅");

    await loadTaskGrades(student.studentId);

    hideLoading();
  } catch (e) {
    hideLoading();
    //console.error(e);
    toast("❌ Save Failed: ", e.toString());
    console.warn("❌ Save Failed: ", e.toString());
  }
}

/*******************************************************
* function name: addTaskRow
* parameter: 
* return: -
* purpose: -
*******************************************************/
async function addTaskRow() {
  const period = document.getElementById("newTaskPeriod")?.value || "-- Select Category --";
  const category = document.getElementById("newTaskCategory")?.value || "-- Select Category --";
  const max = Number(document.getElementById("newTaskMax")?.value) || "Items";
  const upperCat = category.toUpperCase();
  const prefix = getCategoryPrefix(upperCat);

  if (period === "-- Select Category --") {
    toast("Please select period.");
    return;
  }

  if (upperCat === "-- SELECT CATEGORY --") {
    toast("Please select category.");
    return;
  }

  if (max === "Items") {
    toast("Please input items.");
    return;
  }

  let lastNumber = 0;

  (state.gradeTasks || []).forEach(t => {
    if ((t.category || "").toUpperCase() !== upperCat) return;
    const match = String(t.taskCode).match(/\d+$/);
    if (match) {
      const num = Number(match[0]);
      if (num > lastNumber) {
        lastNumber = num;
      }
    }
  });
  const next = lastNumber + 1;
  const newTaskCode = prefix + next;
  state.gradeTasks.push({
    period: period,
    date: new Date().toISOString().slice(0, 10),
    category: upperCat,
    taskCode: newTaskCode,
    taskName: prefix + next,
    max: max,
    score: ""
  });
  renderTaskGrades();
}

/* ===========================
   Helpers (Grades)
=========================== */
/*******************************************************
* function name: isTaskMissing
* parameter: -
* return: -
* purpose: -
*******************************************************/
function isTaskMissing(score) {
  if (score === "" || score === null || score === undefined) return true;
  if (Number.isNaN(Number(score))) return true;
  return false;
}

/*******************************************************
* function name: getCategoryType
* parameter: -
* return: -
* purpose: -
*******************************************************/
function getCategoryType(category) {
  return state.subjectType; // dynamic
}

/*******************************************************
* function name: getCategoryPrefix
* parameter: category
* return: -
* purpose: -
*******************************************************/
function getCategoryPrefix(category) {
  const map = {
    "AUGUSTINIAN VALUE": "Augustinian Value",
    "ASSIGNMENT": "Assign",
    "QUIZ": "Quiz",
    "MIDTERM EXAM": "Mid Exam",
    "FINAL EXAM": "Fin Exam",
    "PROJECT": "Proj",
    "EXERCISE": "Exer",
    "CLASS PARTICIPATION": "Participation"
  };
  return map[category.toUpperCase()] || category.toUpperCase();
}

/*******************************************************
* function name: getDefaultGradeTemplate
* parameter: -
* return: -
* purpose: -
*******************************************************/
function getDefaultGradeTemplate() {
  const today = new Date().toISOString().slice(0, 10);
  return [
    { date: today, period: "MIDTERM PERIOD", category: "AUGUSTINIAN VALUE", taskCode: "Augustinian Value1", taskName: "Augustinian Value1", max: 10, score: "" },
  ];
}

/*******************************************************
* function name: transmute
* parameter: none
* return: -
* purpose: -
*******************************************************/
function transmute(rawScore, subjectType = "minor") {

  let table = subjectType === "major" ? state.transmutationMajor : state.transmutationMinor;

  // ✅ HARD FAIL SAFE (DO NOT BREAK EXPORT)
  if (!Array.isArray(table) || !table.length) {
    console.warn("❌ Transmutation table missing. Using raw score.");
    return rawScore;
  }

  // ✅ CACHE CLEANED TABLE (PERFORMANCE BOOST)
  const cacheKey = subjectType === "major" ? "_cachedMajor" : "_cachedMinor";

  if (!state[cacheKey]) {

    const clean = [];

    table.forEach((row, i) => {
      if (!row || row.length < 2) return;

      const raw = Number(String(row[0]).trim());
      const grade = Number(String(row[1]).trim());

      if (!Number.isFinite(raw) || !Number.isFinite(grade)) {
        console.warn("🚨 INVALID ROW:", i, row);
        return;
      }

      clean.push({ raw, grade });
    });

    if (!clean.length) {
      console.error("❌ CLEAN TABLE EMPTY → fallback raw");
      return rawScore;
    }

    // ✅ SORT ONCE ONLY
    clean.sort((a, b) => b.raw - a.raw);

    state[cacheKey] = clean;
  }

  const cleanTable = state[cacheKey];

  // ✅ MATCH (UNCHANGED LOGIC)
  for (const row of cleanTable) {
    if (rawScore >= row.raw) {
      return row.grade;
    }
  }

  return cleanTable[cleanTable.length - 1].grade;
}

/*******************************************************
* function name: normalize
* parameter: none
* return: -
* purpose: -
*******************************************************/
function normalize(str) {
  return String(str || "").toUpperCase()
    .replace(/\s+/g, " ")   // remove extra spaces
    .trim();
}

/*******************************************************
* function name: formatGradeDate
* parameter: -
* return: -
* purpose: -
*******************************************************/
function formatGradeDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch (e) {
    return dateStr;
  }
}

/*******************************************************
* function name: preloadStudentCourses
* parameter: 
* return: -
* purpose: -
*******************************************************/
async function preloadStudentCourses(student) {
  try {
    /*const res = await apiGet({
      action: "getStudentCourses",
      studentId: student.studentId,
      idToken: state.idToken
    });*/
    const res = await apiPost("getStudentCourses", { studentId: student.studentId });

    if (res.status === "success") {
      state.cachedCourses = (res.courses || []).map(c => c.trim());
    } else {
      state.cachedCourses = [];
    }

  } catch (e) {
    console.error("Preload courses failed:", e);
    state.cachedCourses = [];
  }
}

/*******************************************************
* function name: populateCourseDropdown
* parameter: 
* return: -
* purpose: -
*******************************************************/
function populateCourseDropdown() {
  const select = document.getElementById("newTaskCourseSection");
  select.innerHTML = '<option value="">-- Select Course/Section --</option>';

  const courses = state.cachedCourses || [];

  courses.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  });

  if (!state.filters.courseSubject) {
    //state.filters.courseSubject = courses[0] || "";
    state.filters.courseSubject = state.currentStudent.courseSubject
  }

  select.value = state.filters.courseSubject;
  //select.value = state.currentStudent.courseSubject;
  //console.log("select.value = state.currentStudent.courseSubject: ", state.currentStudent.courseSubject);

  select.onchange = function () {
    state.filters.courseSubject = this.value;
    loadTaskGrades(state.currentStudent.studentId);
  };
}

/*******************************************************
* function name: handleJsonUpload
* parameter: 
* return: -
* purpose: -
*******************************************************/
async function handleJsonUpload() {
  const input = document.getElementById("importJsonFile");

  // ---------------------------------------
  // STEP 1: VALIDATE INPUT
  // ---------------------------------------
  if (!input || !input.files || !input.files.length) {
    toast("Please select a JSON file");
    return;
  }

  const file = input.files[0];

  // ---------------------------------------
  // STEP 2: VALIDATE FILE TYPE
  // ---------------------------------------
  if (!file.name.toLowerCase().endsWith(".json")) {
    toast("Invalid file type. Please upload a JSON file.");
    return;
  }

  try {
    // ---------------------------------------
    // STEP 3: READ FILE (MODERN WAY)
    // ---------------------------------------
    const text = await file.text(); // ✅ simpler than FileReader

    // ---------------------------------------
    // STEP 4: PROCESS
    // ---------------------------------------
    await processImportJSON(text);
    document.getElementById("importJsonFile").value = "";
  } catch (err) {
    console.error(err);
    toast("Failed to read file");
  }
}

/*******************************************************
* function name: processImportJSON
* parameter: 
* return: -
* purpose: -
*******************************************************/
async function processImportJSON(text) {
  showLoading("Importing grades...");

  try {
    // ---------------------------------------
    // STEP 1: PARSE JSON
    // ---------------------------------------
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error("Invalid JSON syntax");
    }

    // ---------------------------------------
    // STEP 2: NORMALIZE STRUCTURE
    // ---------------------------------------
    let students = [];

    if (Array.isArray(parsed)) {
      students = parsed;
    } else if (parsed.data && Array.isArray(parsed.data)) {
      students = parsed.data;
    } else if (parsed.studentId && parsed.items) {
      students = [parsed];
    } else {
      throw new Error("Invalid file structure");
    }

    if (!students.length) {
      throw new Error("No data found");
    }

    // ---------------------------------------
    // STEP 3: BUILD ROWS (BATCH)
    // ---------------------------------------
    const rows = [];

    students.forEach(student => {
      if (!student.studentId) return;

      (student.items || []).forEach(item => {

        const period = String(item.period || "").trim().toUpperCase();
        if (!period.includes("MIDTERM") && !period.includes("FINAL")) {
          console.warn("Invalid period skipped: ", item);
          return;
        }

        if (!item.category || item.score === "" || item.max === "") return;

        rows.push([
          student.studentId,
          item.courseSubject || "",
          period,
          item.date || new Date().toISOString().split("T")[0],
          String(item.category || "").trim().toUpperCase(),
          String(item.taskCode || "").trim(),
          String(item.taskName || "").trim(),
          Number(item.max),
          Number(item.score)
        ]);
      });
    });

    if (!rows.length) throw new Error("No valid rows");

    // ---------------------------------------
    // STEP 4: SEND TO API
    // ---------------------------------------
    const res = await apiPost(
      {
        action: "appendBatchToSheet",
        idToken: state.idToken
      },
      { rows }
    );

    if (res.status !== "success") {
      throw new Error(res.message || "Import failed");
    }

    // ---------------------------------------
    // STEP 5: DONE
    // ---------------------------------------
    hideLoading();
    toast(`Import successful ✅\nInserted: ${res.inserted || 0}\nUpdated: ${rows.updated || 0}`);

  } catch (err) {
    hideLoading();
    //console.error(err);
    toast("Invalid file format. " || err.message);
    console.warn("Invalid file format. " || err.message);
  }
}

/*******************************************************
* function name: downloadAddin
* parameter: 
* return: -
* purpose: 
********************************************************/
function downloadAddin() {
  const link = document.createElement("a");
  link.href = "assets/GradeSystem.xlam";
  link.download = "GradeSystem.xlam";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/*******************************************************
* function name: closescreenImport
* parameter: 
* return: -
* purpose: 
********************************************************/
function closescreenImport() {
  document.getElementById("screenImport").classList.add("hidden");
  showScreen(screenMenu);
}

/* OBSOLETE *?
/*******************************************************
* function name: recomputeGrades
* parameter: none
* return: -
* purpose: Recalculates per-item percentages and final weighted grade from current score inputs, updates UI cells, and refreshes pass/fail status badge.
********************************************************/
/* function recomputeGrades() {
  let final = 0;

  state.grades.items.forEach(item => {

    const score = Number(state.grades.scores[item.code] || 0);
    const pct = item.max > 0 ? (score / item.max) * 100 : 0;
    const weighted = pct * (item.weight / 100);
    final += weighted;

    const cell = document.getElementById("gradePct_" + item.code);
    if (cell) {
      cell.textContent = pct.toFixed(1) + "%";
      // ✅ optional: color per row %
      cell.style.color =
        pct >= 75 ? "#1f7a3f" :
          pct >= 50 ? "#b26a00" :
            "#b42318";
    }
  });

  // ===== FINAL VALUE =====
  const finalEl = document.getElementById("finalGradeValue");
  if (finalEl) {
    finalEl.textContent = final.toFixed(2) + "%";
  }

  // ===== STATUS BADGE =====
  updateGradeStatus(final);
}*/

/* OBSOLETE */
/*******************************************************
* function name: updateGradeStatus
* parameter: val (number)
* return: -
* purpose: Updates the final grade status badge text and style (passed/failed) based on computed percentage value.
********************************************************/
/*function updateGradeStatus(val) {
  const el = document.getElementById("finalGradeStatus");
  if (!el) return;

  let txt = "—";
  let cls = "gradeStatus";

  if (val >= 75) {
    txt = "PASSED";
    cls += " pass";
  }
  else if (val > 0) {
    txt = "FAILED";
    cls += " fail";
  }

  el.textContent = txt;
  el.className = cls;
}*/

/* OBSOLETE */
/*******************************************************
* function name: saveGrades
* parameter: none
* return: -
* purpose: Validates grade weights, builds grade payload from current scores, sends it to the backend for saving, and shows user feedback.
********************************************************/
/*async function saveGrades() {

  showLoading("Please wait, saving grades...");
  const student = state.currentStudent;
  if (!student) {
    hideLoading();
    alert("No student loaded");
    return;
  }

  const itemsPayload = state.grades.items.map(it => ({
    code: it.code,
    name: it.name,
    max: it.max,
    weight: it.weight,
    score: Number(state.grades.scores[it.code] || 0)
  }));

  console.log("GRADES PAYLOAD: ", itemsPayload);

  if (!validateWeights()) {
    hideLoading();
    return;
  }

  // call backend
  const res = await apiPost(
    "gradesSave",
    {
      studentId: student.studentId,
      items: itemsPayload
    }
  );

  if (res.status === "success") {
    hideLoading();
    alert("Grades saved");
  } else {
    hideLoading();
    alert("Save failed: " + (res.message || "unknown"));
  }
}*/

/* OBSOLETE */
/*******************************************************
* function name: loadGradesForStudent
* parameter: studentId (string)
* return: -
* purpose: Loads saved grade scores for a student from the API, merges them into state, and refreshes the grade table and computed totals.
********************************************************/
/*async function loadGradesForStudent(studentId) {
  if (!studentId) return;

  const res = await apiGet({
    action: "gradesLoad",
    idToken: state.idToken,
    studentId: studentId
  });

  if (res.status !== "success") {
    console.warn("gradesLoad failed", res);
    return;
  }

  // reset scores
  state.grades.scores = {};

  // merge scores into model
  (res.items || []).forEach(it => {
    state.grades.scores[it.code] = it.score;
  });

  // recompute
  renderGradeTable();
  recomputeGrades();
}*/

/* OBSOLETE */
/*******************************************************
* function name: validateWeights
* parameter: none
* return: boolean
* purpose: Validates that total grade item weights sum to exactly 100 percent before allowing save.
********************************************************/
/*function validateWeights() {
  const sum =
    state.grades.items.reduce((s, i) => s + i.weight, 0);

  if (sum !== 100) {
    alert("Total weight must be 100%");
    return false;
  }
  return true;
}*/

/* OBSOLETE */
/*******************************************************
* function name: addGradeItem
* parameter: none
* return: void
* purpose: Adds a new grade item from input fields into the grade model and refreshes the grade table.
********************************************************/
/*function addGradeItem() {

  const name = document.getElementById("newGradeName").value.trim();
  const max = Number(document.getElementById("newGradeMax").value);
  const weight = Number(document.getElementById("newGradeWeight").value);

  if (!name || !max || !weight) {
    alert("Complete fields required");
    return;
  }

  const code = name.toUpperCase().replace(/\s+/g, "_");

  state.grades.items.push({
    code,
    name,
    max,
    weight
  });

  // clear inputs
  document.getElementById("newGradeName").value = "";
  document.getElementById("newGradeMax").value = "";
  document.getElementById("newGradeWeight").value = "";

  //renderGradeTable();
}*/

/*******************************************************
* function name: renderGradeTable
* parameter: none
* return: void
* purpose: Builds and renders the grade table UI for the current student including inputs and computed percentage cells.
********************************************************/
/*function renderGradeTable(){
  const student = state.currentStudent;
  if (!student) return;

  if (student){
    let seatNo = "—";

    if (state.seat && Array.isArray(state.seat.seats)) {
      const found = state.seat.seats.find(s =>
        String(s.studentEmail || "").toLowerCase() ===
        String(student.email || "").toLowerCase()
      );

      if (found && found.seatNo) {
        seatNo = found.seatNo;
      }
    }

    document.getElementById("gradeSeatNo").textContent = seatNo;

    document.getElementById("gradeStudentId").textContent =
      student.studentId || "—";
  }

  const body = document.getElementById("gradeTableBody");
  if (!body) return;

  body.innerHTML = "";

  state.grades.items.forEach(item => {
    const tr = document.createElement("tr");

    const scoreVal = state.grades.scores[item.code] ?? "";

    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${item.max}</td>
      <td>${item.weight}%</td>
      <td>
        <input
          class="gradeInput gradeScoreInput"
          type="number"
          min="0"
          max="${item.max}"
          value="${scoreVal}"
          oninput="
            state.grades.scores['${item.code}']=Number(this.value||0);
            recomputeGrades();
          ">
      </td>
      <td class="gradeReadonly" id="gradePct_${item.code}">—</td>
    `;

    body.appendChild(tr);
  });

  recomputeGrades();
}*/

/* OBSOLETE */
/*******************************************************
* function name: onGradeScoreChange
* parameter: code (string), val (number|string)
* return: void
* purpose: Updates a single grade score in state when input changes and triggers recomputation.
********************************************************/
/*function onGradeScoreChange(code, val) {
  const num = Number(val);
  if (isNaN(num)) {
    delete state.grades.scores[code];
  } else {
    state.grades.scores[code] = num;
  }

  recomputeGrades();
}*/

/* ======================================================
   SEAT MAP SYSTEM
====================================================== */
/* ===========================
   Load / Data
=========================== */
/*******************************************************
* function name: loadSeatRoom
* parameter: room (string)
* return: -
* purpose: Loads seat map data for a room by fetching master student list and latest seat assignments, using cached seat data first for fast UI render, then refreshing from server and updating cache.
*******************************************************/
async function loadSeatRoom(room) {
  const key = "seatmap_" + room;

  // 1) Get first master students (with cellphone numbers)
  /*const masterRes = await apiGet({
    action: "seatmapMaster",
    idToken: state.idToken
  });

  if (masterRes.status === "success") {
    state.seat.masterStudents = masterRes.students || [];
  } else {
    state.seat.masterStudents = [];
  }*/
  await ensureMasterStudentsLoaded();

  // 2) load cached seats for quick load of UI
  const cached = await cacheGet(key);
  if (cached) {
    state.seat.seats = cached;
    renderSeatGrid();
  }

  // 3) Get latest seats from server
  /*const res = await apiGet({
    action: "seatmap",
    idToken: state.idToken,
    room: room
  });*/
  const res = await apiPost("seatmap", { room: room });

  if (res.status === "success") {
    state.seat.seats = res.seats || [];
    renderSeatGrid();
    await cacheSet(key, state.seat.seats);
  }
}

/*******************************************************
* function name: loadSeatMapMaster
* parameter: none
* return: <void>
* purpose: Loads master student list used for seat map matching and autofill.
********************************************************/
async function loadSeatMapMaster() {

  document.getElementById('tabContentGrades')?.classList.add('hidden');
  document.getElementById('tabContentLearnerDev')?.classList.add('hidden');
  try {
    /*const res = await apiGet({
      action: "seatmapMaster",
      idToken: state.idToken
    });

    if (res.status !== "success") {
      console.warn("seatmapMaster failed:", res.message);
      return;
    }

    state.seat.masterStudents = res.students || [];*/

    await ensureMasterStudentsLoaded();

  } catch (e) {
    console.warn("loadSeatMapMaster error:", e.toString());
  }
}

/*******************************************************
* function name: addRoom
* parameter: none
* return: <void>
* purpose: Creates a new room with default seats via admin API and loads it into the seat map view.
********************************************************/
async function addRoom() {

  showLoading("Please wait, saving room...");
  if (!state.me || state.me.role !== "admin") {
    hideLoading();
    toast("Admin only.");
    return;
  }

  const room = (inpNewRoom ? (inpNewRoom.value || "").trim() : "");
  if (!room) {
    hideLoading();
    toast("Room Name/Number is required.");
    return;
  }

  try {
    const res = await apiPost(
      { action: "seatmapRoomAddWithSeats", idToken: state.idToken },
      { room, startSeatNo: 1001, totalSeats: 50 }
    );

    if (res.status !== "success") {
      hideLoading();
      toast(res.message || "Add room failed");
      console.warn(res.message || "Add room failed");
      return;
    }

    if (inpNewRoom) inpNewRoom.value = "";
    await loadRooms();

    if (selSeatRoom) selSeatRoom.value = room;
    await loadSeatRoom(room);

    if (seatAddRoomWrap) seatAddRoomWrap.classList.add("hidden");

    hideLoading();
    toast("Room added! (50 seats created)");

  } catch (e) {
    hideLoading();
    toast("Add room error: " + e.toString());
  }
}

/*******************************************************
* function name: loadRooms
* parameter: none
* return: <void>
* purpose: Loads available seat map rooms from the API and populates the room selector dropdown.
********************************************************/
async function loadRooms() {

  try {
    /*const res = await apiGet({
      action: "rooms",
      idToken: state.idToken
    });*/
    const res = await apiPost("rooms", {});

    if (res.status !== "success") {
      console.warn("Rooms endpoint not ready:", res.message);
      toast("Rooms endpoint not ready:", res.message);
      return;
    }

    fillSelect(selSeatRoom, res.rooms || []);
  } catch (e) {
    console.warn("loadRooms failed:", e.toString());
    toast("loadRooms failed:", e.toString());
  }
}

/*******************************************************
* function name: deleteRoom
* parameter: none
* return: <void>
* purpose: Deletes the selected room and all its seats via admin-only API call and refreshes seat UI.
********************************************************/
async function deleteRoom() {

  showLoading("Please wait, deleting room...");

  if (!state.me || state.me.role !== "admin") {
    toast("Admin only.");
    hideLoading();
    return;
  }

  const room = selSeatRoom ? (selSeatRoom.value || "").trim() : "";
  if (!room) {
    toast("Select a room first.");
    hideLoading();
    return;
  }


  const ok = confirm(`Delete ROOM "${room}"?\n\nThis will remove ALL seats in this room.\nThis cannot be undone.`);
  if (!ok) {
    hideLoading();
    return;
  }

  try {
    const res = await apiPost(
      { action: "seatmapRoomDelete", idToken: state.idToken },
      { room }
    );

    if (res.status !== "success") {
      hideLoading();
      toast("Delete room failed. " || res.message);
      console.warn("Delete room failed. " || res.message);
      return;
    }

    // refresh dropdown + clear UI
    await loadRooms();

    if (seatRoomLabel) seatRoomLabel.textContent = "Room: -";
    if (seatGrid) seatGrid.innerHTML = "";
    state.seat.room = "";
    state.seat.seats = [];

    if (btnAddTable) btnAddTable.classList.add("hidden");
    if (addTableWrap) addTableWrap.classList.add("hidden");

    hideLoading();
    toast(`Room deleted! Seats removed: ${res.deleted || 0}`);
    console.warn(`Room deleted! Seats removed: ${res.deleted || 0}`);
  } catch (e) {
    hideLoading();
    toast("Delete room error: " + e.toString());
    console.warn("Delete room error: " + e.toString());
  }
}

/*******************************************************
* function name: removeLastSeat
* parameter: none
* return: <void>
* purpose: Removes the highest-numbered empty seat in the current room and reloads seat map.
********************************************************/
async function removeLastSeat() {

  try {
    showLoading("Please wait, removing seat...");
    const room = (state.seat.room || "").trim();
    if (!room) {
      hideLoading();
      toast("Please load a room first.");
      return;
    }

    const seats = state.seat.seats || [];
    if (seats.length === 0) {
      hideLoading();
      toast("No seats to remove.");
      return;
    }

    // get max seatNo
    let maxSeatNo = null;
    seats.forEach(s => {
      const n = parseInt(s?.seatNo, 10);
      if (!isNaN(n)) {
        if (maxSeatNo === null || n > maxSeatNo) maxSeatNo = n;
      }
    });

    if (!maxSeatNo) {
      hideLoading();
      toast("No seats to remove.");
      return;
    }

    // find seat object
    const target = seats.find(x => String(x.seatNo) === String(maxSeatNo));
    if (!target) {
      hideLoading();
      toast("Seat not found.");
      return;
    }

    // ❌ cannot delete if seat is not empty
    const hasStudent =
      (target.studentEmail && target.studentEmail.trim() !== "") ||
      (target.studentId && target.studentId.trim() !== "") ||
      (target.studentName && target.studentName.trim() !== "");

    if (hasStudent) {
      hideLoading();
      toast(`Cannot remove seat ${maxSeatNo}. Student is assigned. Please clear seat first.`);
      return;
    }

    // delete from sheet
    const res = await apiPost(
      { action: "seatmapSeatDelete", idToken: state.idToken },
      { room, seatNo: String(maxSeatNo) }
    );

    if (res.status !== "success") {
      hideLoading();
      toast(res.message || "Failed to remove seat.");
      console.warn(res.message || "Failed to remove seat.");
      return;
    }

    // ✅ Reload from backend to reflect real max seat
    await cacheDelete("seatmap_" + room);
    await loadSeatRoom(room);

    hideLoading();
    toast(`Seat ${maxSeatNo} removed.`);

  } catch (err) {
    toast("Error removing seat: " + err.message);
    console.warn("Error removing seat: " + err.message);
  }
}

/*******************************************************
* function name: computeBestCols
* parameter: perSide (number)
* return: number
* purpose: Computes ideal grid column count per side based on seat count with min/max limits.
********************************************************/
function computeBestCols(perSide) {

  // auto columns depending on perSide count
  // ex: 25 -> 5 cols, 36 -> 6 cols, 49 -> 7 cols
  const ideal = Math.ceil(Math.sqrt(perSide));
  return Math.max(5, Math.min(ideal, 10)); // min 5 cols, max 10 cols
}

/*******************************************************
* function name: renderSeatGrid
* parameter: none
* return: void
* purpose: Renders classroom-style seat grid layout with left/right sides, placeholders, and click behavior.
********************************************************/
function renderSeatGrid() {

  if (!seatGrid) return;
  seatGrid.innerHTML = "";

  const seats = Array.isArray(state.seat.seats) ? state.seat.seats : [];

  // Build seat map from backend seats
  const map = new Map();
  seats.forEach(s => {
    if (!s || !s.seatNo) return;
    const master = findStudentByEmail(s.studentEmail);

    const phone =
      master?.cellphoneNumber ||
      master?.cellphone ||
      master?.mobile ||
      master?.mobileNumber ||
      master?.contactNumber ||
      "";

    map.set(String(s.seatNo), {
      seatNo: String(s.seatNo),
      studentEmail: s.studentEmail || "",
      studentId: s.studentId || "",
      studentName: s.studentName || "",
      cellphoneNumber: phone
    });
  });

  // Find min/max seatNo from data (dynamic)
  let minSeat = 999999;
  let maxSeat = 0;

  for (const s of seats) {
    const n = parseInt(s?.seatNo, 10);
    if (!isNaN(n)) {
      minSeat = Math.min(minSeat, n);
      maxSeat = Math.max(maxSeat, n);
    }
  }

  // fallback if empty room
  if (!isFinite(minSeat) || minSeat === 999999) minSeat = 1001;
  if (!maxSeat || maxSeat < 1001) maxSeat = 1001;

  // IMPORTANT: always start at 1001
  if (minSeat > 1001) minSeat = 1001;

  // total seats count
  const totalSeats = (maxSeat - minSeat) + 1;

  // fixed 5 columns per side
  const cols = 5;
  const seatsPerRow = cols * 2; // left 5 + right 5

  // total rows needed
  const totalRows = Math.ceil(totalSeats / seatsPerRow);

  // Create FULL ordered list from minSeat..maxSeat
  const ordered = [];
  for (let i = minSeat; i <= maxSeat; i++) {
    const key = String(i);
    ordered.push(
      map.get(key) || {
        seatNo: key,
        studentEmail: "",
        studentId: "",
        studentName: ""
      }
    );
  }

  // renderSeatCard
  const renderSeatCard = (seat, idx) => {
    const div = document.createElement("div");
    div.className = "seat";

    const hasStudent = (seat.studentEmail || "").trim() !== "";

    div.setAttribute("data-tooltip", seat.studentName || seat.studentEmail || "Empty");

    div.innerHTML = `
      <div class="seatTopRow">
        <div class="seatNo">${escapeHtml(seat.seatNo)}</div>
        <div class="seatStatusDot ${hasStudent ? "on" : "off"}"></div>
      </div>

      <div class="seatMid">
        ${hasStudent
        ? `
              <div class="seatAvatar">
                <img class="seatPhoto"
                     data-email="${escapeHtml(seat.studentEmail)}"
                     alt="photo"
                     src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
                      <svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'>
                        <rect width='100%' height='100%' fill='#f1f5f9'/>
                        <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
                          font-family='Arial' font-size='36' fill='#64748b'>👤</text>
                      </svg>
                     `)}"
                />
              </div>

              <div class="seatName">${escapeHtml((seat.studentName || seat.studentEmail).toUpperCase())}</div>
              <div class="seatEmail muted">${escapeHtml(seat.studentEmail)}</div>
            `
        : `
              <div class="seatAvatar emptyIcon">👤</div>
              <div class="seatEmpty">Empty</div>
            `
      }
      </div>
    `;


    div.onclick = async (e) => {
      if (state.seat.editMode === true) {
        openSeatEditModal(seat);
        return;
      }

      const hasStudent = seat.studentEmail || seat.studentId || seat.studentName;

      if (!hasStudent) {
        toast("Seat is empty.");
        return;
      }

      if (!isMobile()) {
        if (lastSeatClicked && lastSeatClicked !== seat.seatNo) {
          lastSeatClicked = null;
        }

        if (lastSeatClicked === seat.seatNo) {
          closeSeatPreview();
          await openStudentDetailsByEmail(seat.studentEmail);
          lastSeatClicked = null;
          return;
        }

        lastSeatClicked = seat.seatNo;
        openSeatPreview(seat, e);

        clearTimeout(seatPreviewTimer);
        seatPreviewTimer = setTimeout(() => {
          lastSeatClicked = null;
        }, 350);

        return;
      }

      openMobilePreview(seat);
    };
    return div;
  };

  // ---- BUILD LEFT/RIGHT SIDES BY ROWS (CLASSROOM STYLE) ----
  // Each row consumes 10 seats:
  // LEFT gets first 5 seats of that row
  // RIGHT gets next 5 seats of that row
  const leftRows = [];
  const rightRows = [];

  let ptr = 0;

  for (let r = 0; r < totalRows; r++) {
    const leftRow = [];
    const rightRow = [];

    for (let c = 0; c < cols; c++) {
      if (ptr < ordered.length) leftRow.push(ordered[ptr++]);
      else leftRow.push({ __placeholder: true });
    }

    for (let c = 0; c < cols; c++) {
      if (ptr < ordered.length) rightRow.push(ordered[ptr++]);
      else rightRow.push({ __placeholder: true });
    }

    leftRows.push(leftRow);
    rightRows.push(rightRow);
  }

  // Reverse rows so bottom row is lowest seat numbers (1001..)
  leftRows.reverse();
  rightRows.reverse();

  // flatten
  const leftSeats = leftRows.flat();
  const rightSeats = rightRows.flat();

  // wrapper layout
  const wrap = document.createElement("div");
  wrap.className = "seatGridClassroom";

  const left = document.createElement("div");
  left.className = "seatSide";
  left.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

  const aisle = document.createElement("div");
  aisle.className = "seatAisle";

  const right = document.createElement("div");
  right.className = "seatSide";
  right.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

  // placeholders renderer
  const renderPlaceholder = () => {
    const div = document.createElement("div");
    div.className = "seat seatPlaceholder";
    div.innerHTML = "";
    return div;
  };

  leftSeats.forEach((s, i) => {
    if (s && s.__placeholder) left.appendChild(renderPlaceholder());
    else left.appendChild(renderSeatCard(s, i));
  });

  rightSeats.forEach((s, i) => {
    if (s && s.__placeholder) right.appendChild(renderPlaceholder());
    else right.appendChild(renderSeatCard(s, i));
  });

  wrap.appendChild(left);
  wrap.appendChild(aisle);
  wrap.appendChild(right);

  seatGrid.appendChild(wrap);

  // load photos after render
  loadSeatPhotosInGrid();
}

/*******************************************************
* function name: openSeatEditModal
* parameter: seat (object)
* return: void
* purpose: Opens the seat edit modal, populates form fields with selected seat data, and stores the editing reference in state.
********************************************************/
function openSeatEditModal(seat) {

  if (!seatEditModal) return;

  setSeatEditLocked(false); // ✅ unlock on open

  // Show room label
  if (seatEditRoomLabel) seatEditRoomLabel.textContent = `Room: ${state.seat.room || "-"}`;

  // Fill inputs
  if (editSeatNo) editSeatNo.value = seat.seatNo || "";
  if (editStudentName) editStudentName.value = seat.studentName || "";
  if (editStudentEmail) editStudentEmail.value = seat.studentEmail || "";
  if (editStudentId) editStudentId.value = seat.studentId || "";

  // Store currently editing seat reference
  state.seat.editingSeat = { ...seat };

  seatEditModal.classList.remove("hidden");
}

/*******************************************************
* function name: setSeatEditLocked
* parameter: isLocked (boolean)
* return: void
* purpose: Locks or unlocks the seat edit modal by enabling or disabling related buttons and input fields.
********************************************************/
function setSeatEditLocked(isLocked) {

  seatEditLock = isLocked;

  // disable buttons
  if (btnSeatEditSave) btnSeatEditSave.disabled = isLocked;
  if (btnSeatEditDelete) btnSeatEditDelete.disabled = isLocked;
  if (btnSeatEditCancel) btnSeatEditCancel.disabled = isLocked;
  if (btnCloseSeatEdit) btnCloseSeatEdit.disabled = isLocked;

  // disable inputs
  if (editSeatNo) editSeatNo.disabled = isLocked;
  if (editStudentId) editStudentId.disabled = isLocked;
  if (editStudentName) editStudentName.disabled = isLocked;
  if (editStudentEmail) editStudentEmail.disabled = isLocked;
}

/*******************************************************
* function name: closeSeatEditModal
* parameter: force (boolean)
* return: void
* purpose: Closes the seat edit modal and clears editing state, unless locked and not forced.
********************************************************/
function closeSeatEditModal(force = false) {

  if (!seatEditModal) return;

  // allow forced close
  if (seatEditLock && !force) return;

  seatEditLock = false; // 🔥 important
  seatEditModal.classList.add("hidden");
  state.seat.editingSeat = null;
}

/*******************************************************
* function name: updateSeatEditUI
* parameter: none
* return: void
* purpose: Updates seat map edit mode UI controls and button visibility based on admin role and edit mode state.
********************************************************/
function updateSeatEditUI() {

  const isAdmin = state.me && state.me.role === "admin";
  const on = !!state.seat.editMode;

  // 1) Edit Mode button label + color
  if (btnSeatEditToggle && isAdmin) {
    if (on) {
      btnSeatEditToggle.textContent = "Edit Mode: ON";
      btnSeatEditToggle.classList.remove("btnDanger");
      btnSeatEditToggle.classList.add("btnPrimary");
    } else {
      btnSeatEditToggle.textContent = "Edit Mode: OFF";
      btnSeatEditToggle.classList.remove("btnPrimary");
      btnSeatEditToggle.classList.add("btnDanger");
    }
  }

  // 2) Fix 25-B: Add Room disabled/hidden when Edit Mode ON
  if (btnSeatAddRoom) {
    if (on) btnSeatAddRoom.classList.add("hidden");
    else btnSeatAddRoom.classList.remove("hidden");
  }

  // 3) Keep Add Table ALWAYS visible (your choice B)
  // ❌ Do nothing here

  // 4) If editing is turned OFF, close the edit modal (clean)
  if (!on) {
    closeSeatEditModal();
  }

  if (btnRemoveSeat) {
    const isAdmin = state.me && state.me.role === "admin";
    if (isAdmin && state.seat.editMode === true) btnRemoveSeat.classList.remove("hidden");
    else btnRemoveSeat.classList.add("hidden");
  }

  updateDeleteRoomButtonVisibility();
}

/*******************************************************
* function name: addSeatEmpty
* parameter: none
* return: <void>
* purpose: Quickly creates an empty seat entry using the current seat number input.
********************************************************/
async function addSeatEmpty() {

  if (!state.seat.room) {
    toast("Select a room first.");
    return;
  }

  const seatNo = (inpSeatNo ? (inpSeatNo.value || "").trim() : "");
  if (!seatNo) {
    toast("Seat No is required to add empty seat.");
    return;
  }

  if (inpSeatEmail) inpSeatEmail.value = "";
  if (inpSeatId) inpSeatId.value = "";
  if (inpSeatName) inpSeatName.value = "";

  await saveSeat();
}

/* ======================================================
   LEARNER DEVELOPMENT (Radar Chart System)
====================================================== */
/* ===========================
   Load / Data
=========================== */
/*******************************************************
* function name: loadLearnerDev
* parameter: studentId (string)
* return: -
* purpose: Retrieves learner development records for a student from the API, maps categories and scores into state, and triggers radar chart rendering.
*******************************************************/
async function loadLearnerDev(studentId) {
  if (!state.idToken) return;
  /* const res = await apiGet({
    action: "learnerDevLoad",
    idToken: state.idToken,
    studentId
  });*/
  const res = await apiPost("learnerDevLoad", { studentId });

  if (res.status !== "success") {
    console.warn("learnerDevLoad failed", res);
    return;
  }

  const map = {};
  (res.items || []).forEach(x => {
    const cat = String(x.category || "").trim();
    if (!cat) return;
    map[cat] = Number(x.score || 0);
  });

  state.learnerDev.categories = Object.keys(map);
  state.learnerDev.scores = map;
  renderLearnerDevChart();
}

/*******************************************************
* function name: renderLearnerDevChart
* parameter: none
* return: -
* purpose: Renders or refreshes the learner development radar chart using current category and score data from state.
********************************************************/
function renderLearnerDevChart() {

  const labels = state.learnerDev.categories || [];
  const data = labels.map(c => state.learnerDev.scores[c] || 0);

  const ctx = document.getElementById("learnerDevChart");
  if (!ctx) return;

  // 🔥 CHECK IF NO DATA
  const hasData = data.some(v => v > 0);

  // 🔥 GET OR CREATE MESSAGE ELEMENT
  let msg = document.getElementById("learnerDevNoData");

  if (!hasData) {

    // destroy chart if exists
    if (learnerChart) {
      learnerChart.destroy();
      learnerChart = null;
    }

    // hide canvas
    ctx.style.display = "none";

    // create message if not exist
    if (!msg) {
      msg = document.createElement("div");
      msg.id = "learnerDevNoData";
      msg.style.textAlign = "center";
      msg.style.padding = "20px";
      msg.style.color = "#ee2525";
      msg.style.fontWeight = "600";
      msg.textContent = "No data found!";

      ctx.parentElement.appendChild(msg);
    }

    return;
  }

  // ✅ IF DATA EXISTS → SHOW CHART

  // remove message if exists
  if (msg) msg.remove();

  // show canvas
  ctx.style.display = "block";

  if (learnerChart) learnerChart.destroy();

  learnerChart = new Chart(ctx, {
    type: "radar",
    data: {
      labels,
      datasets: [{
        label: "Learner Development",
        data
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        legend: {
          labels: {
            font: {
              size: 16,
              weight: "bold"
            }
          }
        },
        tooltip: {
          bodyFont: { size: 14 },
          titleFont: { size: 14 }
        }
      },

      scales: {
        r: {
          pointLabels: {
            font: {
              size: 14,
              weight: "600"
            }
          },
          ticks: {
            stepSize: 1,
            font: {
              size: 12
            }
          },
          min: 0,
          max: 5
        }
      }
    }
  });

}

/*******************************************************
* function name: seedLearnerDevDefaults
* parameter: none
* return: void
* purpose: Initializes learner development categories and zero scores when not yet defined.
********************************************************/
function seedLearnerDevDefaults() {

  if (state.learnerDev.categories.length) return;

  const defaults = [
    "Physical",
    "Cognitive",
    "Language & Communication",
    "Psychosocial & Emotional",
    "Social",
    "Moral & Values"
  ];

  state.learnerDev.categories = defaults;
  defaults.forEach(c => state.learnerDev.scores[c] = 0);

  renderLearnerDevChart();
}

/*******************************************************
* function name: addLearnerDev
* parameter: none
* return: void
* purpose: Adds or updates a learner development category score from input fields and refreshes the chart.
********************************************************/
function addLearnerDev() {
  const cat = document.getElementById("ldCategory").value.trim();
  const score = Number(document.getElementById("ldScore").value || 0);
  if (!cat) return;
  if (!state.learnerDev.categories.includes(cat)) {
    state.learnerDev.categories.push(cat);
  }
  state.learnerDev.scores[cat] = score;
  renderLearnerDevChart();
}

/*******************************************************
* function name: saveLearnerDev
* parameter: none
* return: -
* purpose: Saves learner development category scores for the current student to the backend API.
********************************************************/
async function saveLearnerDev() {
  try {
    showLoading("Please wait, saving...");
    const student = state.currentStudent;

    const items = state.learnerDev.categories.map(c => ({
      category: c,
      score: state.learnerDev.scores[c] || 0
    }));

    await apiPost("learnerDevSave", {
      studentId: student.studentId,
      items
    });

    hideLoading();
    toast("Saved");
  } catch (err) {
    hideLoading();
    toast("Save error: " + err.toString());
    console.warn("Save error: " + err.toString());
  }
}

/* ======================================================
   EVIDENCE SYSTEM (Upload + Cache + Offline)
====================================================== */
/* ===========================
   Photo / Evidence
=========================== */
/*******************************************************
* function name: getPhotoCached
 parameter: email (string)
* return: dataUrl <string|null>
* purpose: Retrieves a student photo as data URL from local cache if available, otherwise downloads from API, caches it, and returns the encoded image.
*******************************************************/
async function getPhotoCached(email) {
  if (!email) return null;
  const key = "photo_" + email.toLowerCase();

  // 1) try cache
  const cached = await cacheGet(key);
  if (cached) return cached;

  // 2) fetch from API
  /*const res = await apiGet({
    action: "photo",
    idToken: state.idToken,
    email: email
  });*/
  const res = await apiPost("photo", { email: email });

  if (res.status !== "success") return null;
  const dataUrl = `data:${res.mimeType || "image/jpeg"};base64,${res.base64 || ""}`;

  // 3) save cache
  await cacheSet(key, dataUrl);
  return dataUrl;
}

/*******************************************************
* function name: idbPutEvidenceFile
* parameter: item (object)
* return: -
* purpose: Stores an evidence file record (blob + metadata) into the IndexedDB evidence store.
*******************************************************/
async function idbPutEvidenceFile(item) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(item);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/*******************************************************
* function name: idbGetEvidenceFile
* parameter: id (string)
* return: -
* purpose: Retrieves a stored evidence file record from IndexedDB by its offline id.
*******************************************************/
async function idbGetEvidenceFile(id) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/*******************************************************
* function name: idbDeleteEvidenceFile
* parameter: id (string)
* return: -
* purpose: Deletes an evidence file record from IndexedDB using its offline id.
*******************************************************/
async function idbDeleteEvidenceFile(id) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/*******************************************************
* function name: uploadEvidenceChunked
* parameter: payload (object), progressCb (function)
* return: <object>
* purpose: Uploads a large base64 evidence file using init–chunk–finalize API flow, reporting progress through callback.
********************************************************/
async function uploadEvidenceChunked(payload, progressCb) {

  // payload = { email,timestamp,studentId,fileName,mimeType,base64 }

  // 1) INIT upload session
  const initRes = await apiPost("uploadEvidenceInit", {
    email: payload.email,
    timestamp: payload.timestamp,
    studentId: payload.studentId,
    fileName: payload.fileName,
    mimeType: payload.mimeType,
    totalSize: payload.base64.length
  });

  if (initRes.status !== "success") throw new Error(initRes.message || "Init failed");
  const uploadId = initRes.uploadId;
  if (!uploadId) throw new Error("Missing uploadId");

  // 2) SEND chunks
  const chunks = base64ToChunks(payload.base64, 200000); // 200KB chunks
  const total = chunks.length;

  for (let i = 0; i < total; i++) {
    const partRes = await apiPost("uploadEvidenceChunk", {
      uploadId,
      index: i,
      total,
      chunk: chunks[i]
    });

    if (partRes.status !== "success") throw new Error(partRes.message || "Chunk upload failed");

    if (progressCb) {
      const percent = Math.floor(((i + 1) / total) * 90); // up to 90%
      progressCb(percent);
    }
  }

  // 3) FINALIZE
  const finRes = await apiPost("uploadEvidenceFinalize", {
    uploadId
  });

  if (finRes.status !== "success") throw new Error(finRes.message || "Finalize failed");

  return finRes;
}

/*******************************************************
* function name: handleUploadEvidence
* parameter: file (File)
* return: -
* purpose: Handles evidence upload flow by validating input, routing to offline queue when offline, or uploading immediately via API when online, then refreshing the evidence list UI.
********************************************************/
async function handleUploadEvidence(file) {
  showLoading("Please wait, uploading evidence...");
  try {
    if (!file) {
      hideLoading();
      toast("Please choose a file.");
      return;
    }

    const student = {
      email: state.selected.email,
      timestamp: state.selected.timestamp,
      studentId: state.selected.studentId
    };

    if (!student.studentId || !student.email) {
      hideLoading();
      throw new Error("Missing studentId/email in evidence upload payload");
    }

    // ✅ OFFLINE → store to IndexedDB
    if (!navigator.onLine) {
      hideLoading();
      await queueEvidenceUploadOffline(file, student);
      return;
    }

    // ✅ ONLINE → upload now
    const base64 = await blobToBase64(file);

    const payload = {
      ...student,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      base64
    };

    const res = await apiPost("uploadEvidence", payload);

    if (res.status !== "success") {
      hideLoading();
      throw new Error(res.message || "Upload failed");
    }

    toast("Evidence uploaded successfully!");
    clearEvidenceFileInput();
    await loadEvidenceList(); // ✅ add
    hideLoading();
  } catch (err) {
    hideLoading();
    //toast("Upload error: " + err.toString());
    toast("Upload error: " + err.toString());
    console.warn("Upload error: " + err.toString());
  }
}

/* ======================================================
   OFFLINE / CACHE / INDEXEDDB
====================================================== */
/* ===========================
   Storage + Cache
=========================== */
/*******************************************************
* function name: cacheSet
* parameter: key (string), value (any)
* return: -
* purpose: Stores a value in the IndexedDB key-value cache under the given key.
********************************************************/
async function cacheSet(key, value) {
  const db = await openCacheDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    const store = tx.objectStore("kv");
    store.put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/*******************************************************
* function name: cacheGet
* parameter: key (string)
* return: -
* purpose: Retrieves a cached value from IndexedDB key-value store by key.
********************************************************/
async function cacheGet(key) {
  const db = await openCacheDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readonly");
    const store = tx.objectStore("kv");
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

/*******************************************************
* function name: cacheDelete
* parameter: key (string)
* return: -
* purpose: Removes a specific cached entry from the IndexedDB key-value store.
********************************************************/
async function cacheDelete(key) {
  const db = await openCacheDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    const store = tx.objectStore("kv");
    store.delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/*******************************************************
* function name: cacheClearAll
* parameter: none
* return: -
* purpose: Clears all entries from the IndexedDB key-value cache store.
********************************************************/
async function cacheClearAll() {
  const db = await openCacheDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    const store = tx.objectStore("kv");
    store.clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/*******************************************************
* function name: deleteEvidenceDB
* parameter: none
* return: -
* purpose: Deletes the entire IndexedDB database used for offline evidence storage and resolves with success status.
********************************************************/
function deleteEvidenceDB() {

  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(IDB_DB_NAME);
    req.onsuccess = () => resolve(true);
    req.onerror = () => resolve(false);
    req.onblocked = () => resolve(false);
  });
}

/*******************************************************
* function name: openCacheDB
* parameter: none
* return: -
* purpose: Opens (and initializes if needed) the IndexedDB key-value cache database used for generic app caching.
********************************************************/
function openCacheDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")) {
        db.createObjectStore("kv");
        // key-value store
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ===========================
   IndexedDB
=========================== */
/*******************************************************
* function name: idbOpen
* parameter: none
* return: -
* purpose: Opens (and creates if needed) the IndexedDB database for evidence files and ensures the required object store exists.
*******************************************************/
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ======================================================
   AUTH / SESSION
====================================================== */
/* ===========================
   Session
=========================== */
/* ===========================
   GOOGLE LOGIN (GSI)
=========================== */
/*******************************************************
* function name: waitForGoogleThenRun
* parameter: fn (function)
* return: void
* purpose: Waits until Google Identity Services library is available before executing the provided function.
********************************************************/
function waitForGoogleThenRun(fn) {

  try {
    if (window.google && google.accounts && google.accounts.id) {
      fn();
      return;
    }
  } catch (e) { }
  setTimeout(() => waitForGoogleThenRun(fn), 150);
}

/*******************************************************
* function name: renderGoogleLoginButton
* parameter: none
* return: void
* purpose: Renders the Google Sign-In button and initializes Google Identity Services login flow.
********************************************************/
function renderGoogleLoginButton() {

  if (!state.clientId || !gsiButtonWrap) return;

  gsiButtonWrap.innerHTML = "";

  waitForGoogleThenRun(() => {
    google.accounts.id.initialize({
      client_id: state.clientId,
      callback: onGoogleCredential
    });

    google.accounts.id.renderButton(
      gsiButtonWrap,
      { theme: "outline", size: "large", text: "signin_with" }
    );
  });
}

/*******************************************************
* function name: onGoogleCredential
* parameter: resp (object)
* return: <void>
* purpose: Handles Google login credential response, validates user via API, initializes user state, and loads initial app data.
********************************************************/
async function onGoogleCredential(resp) {

  try {
    showLoading("Loading Google Sign-In...");
    state.idToken = resp.credential;

    // ✅ PERSISTENT LOGIN SAVE (1 week session)
    const now = Date.now();

    // update badge immediately
    refreshNetBadgeNow();

    /*const me = await apiGet({
      action: "me",
      idToken: state.idToken
    });*/
    const me = await apiPost("me", {});

    // ✅ HARD BLOCK if not allowlisted
    if (!me || me.status !== "success") {
      hideLoading();
      forceLogout(me?.message || "Access denied. Your email is not allowlisted.");
      return;
    }

    // ✅ store user
    state.me = me;
    applyRoleUI();

    localStorage.setItem("sf_id_token", state.idToken);
    localStorage.setItem("sf_user_email", me.email || "");
    document.body.classList.remove("student-mode");

    if (state.me?.role === "student") {
      document.body.classList.add("student-mode");
      try {

        // ✅ SHOW BADGE
        const displayName = (me.name || "").trim() || me.email;
        if (userBadge) {
          userBadge.textContent = `${displayName} (${me.role})`;
          userBadge.classList.remove("hidden");
        }

        // ✅ SHOW SAFE TOP BUTTONS
        if (btnHelp) btnHelp.classList.remove("hidden");
        if (btnAbout) btnAbout.classList.remove("hidden");
        if (btnSupport) btnSupport.classList.remove("hidden");
        if (btnChangelog) btnChangelog.classList.remove("hidden");
        if (btnResetApp) btnResetApp.classList.remove("hidden");
        if (btnLogout) btnLogout.classList.remove("hidden");

        // ❌ KEEP ADMIN TOOLS HIDDEN
        if (seatAdminTools) seatAdminTools.classList.add("hidden");
        if (btnSeatAddRoom) btnSeatAddRoom.classList.add("hidden");
        if (btnSeatEditToggle) btnSeatEditToggle.classList.add("hidden");

        // ❌ KEEP RECORD BUTTONS HIDDEN
        if (btnPrevRecord) btnPrevRecord.classList.add("hidden");
        if (btnNextRecord) btnNextRecord.classList.add("hidden");
        if (btnBackToList) btnBackToList.classList.add("hidden");

        // ❌ KEEP RECORD LIST PANEL HIDDEN
        const recordNav = document.querySelector(".recordNav");
        if (recordNav) recordNav.classList.add("hidden");

        // student flow
        //showScreen(screenDetails);
        await openStudentDetailsByEmail(state.me.email);
        saveSession();

        // ❌ KEEP MENU CARDS HIDDEN
        if (menuStudentInfo) menuStudentInfo.classList.add("hidden");
        if (menuSeatMapInfo) menuSeatMapInfo.classList.add("hidden");
        if (menuExport) menuExport.classList.add("hidden");
        if (menuImportDownload) menuImportDownload.classList.add("hidden");
        if (btnOpenSeatMap) btnOpenSeatMap.classList.add("hidden");
        if (btnGoList) btnGoList.classList.add("hidden");

        const gradeAdminTools = document.getElementById("gradeAdminTools");
        if (gradeAdminTools) gradeAdminTools.classList.add("hidden");

        const gradeAdminButtons = document.getElementById("gradeAdminButtons");
        if (gradeAdminButtons) gradeAdminButtons.classList.add("hidden");

        const ldAdminControls = document.getElementById("ldAdminControls");
        if (ldAdminControls) ldAdminControls.classList.add("hidden");

        //if (dPhoto) dPhoto.classList.add("hidden");

      } catch (e) {
        toast(e.stack);
        console.warn(e.stack);
      }
      return;
    } else {
      document.body.classList.remove("student-mode");
      if (menuStudentInfo) menuStudentInfo.classList.remove("hidden");
      if (menuSeatMapInfo) menuSeatMapInfo.classList.remove("hidden");
      if (menuExport) menuExport.classList.remove("hidden");
      if (menuImportDownload) menuImportDownload.classList.remove("hidden");
      if (btnOpenSeatMap) btnOpenSeatMap.classList.remove("hidden");
      if (btnGoList) btnGoList.classList.remove("hidden");

      if (btnPrevRecord) btnPrevRecord.classList.remove("hidden");
      if (btnNextRecord) btnNextRecord.classList.remove("hidden");
      if (btnBackToList) btnBackToList.classList.remove("hidden");

      const recordNav = document.querySelector(".recordNav");
      if (recordNav) recordNav.classList.remove("hidden");

      const gradeAdminTools = document.getElementById("gradeAdminTools");
      if (gradeAdminTools) gradeAdminTools.classList.remove("hidden");

      const gradeAdminButtons = document.getElementById("gradeAdminButtons");
      if (gradeAdminButtons) gradeAdminButtons.classList.remove("hidden");

      const ldAdminControls = document.getElementById("ldAdminControls");
      if (ldAdminControls) ldAdminControls.classList.remove("hidden");

      //if (dPhoto) dPhoto.classList.remove("hidden");
    }

    localStorage.setItem("sf_login_time", Date.now());

    const displayName = (me.name || "").trim() || me.email;
    if (userBadge) {
      userBadge.textContent = `${displayName} (${me.role})`;
      userBadge.classList.remove("hidden");
    }

    // show buttons
    if (btnHelp) btnHelp.classList.remove("hidden");
    if (btnAbout) btnAbout.classList.remove("hidden");
    if (btnSupport) btnSupport.classList.remove("hidden");
    if (btnChangelog) btnChangelog.classList.remove("hidden");
    if (btnResetApp) btnResetApp.classList.remove("hidden");
    if (btnLogout) btnLogout.classList.remove("hidden");

    // admin tools
    if (seatAdminTools) {
      if (state.me.role === "admin") seatAdminTools.classList.remove("hidden");
      else seatAdminTools.classList.add("hidden");
    }

    if (btnSeatAddRoom && btnSeatEditToggle) {
      if (state.me.role === "admin") {
        btnSeatAddRoom.classList.remove("hidden");
        btnSeatEditToggle.classList.remove("hidden");
      } else {
        btnSeatAddRoom.classList.add("hidden");
        btnSeatEditToggle.classList.add("hidden");
      }
    }

    // proceed app
    await loadRooms();
    await loadInitialFilters();
    await loadSeatMapMaster();

    showScreen(screenMenu);
    updateSeatEditUI();
    showNetBadge();
    saveSession();
    hideLoading();

  } catch (err) {
    hideLoading();
    forceLogout("Login error: " + err.toString());
  }
}

/* ======================================================
   RECORDS SYSTEM (Student Records API)
====================================================== */
/* ===========================
   ******
=========================== */


/* ======================================================
   HISTORY / AUDIT LOG
====================================================== */
/* ===========================
   ******
=========================== */


/* ======================================================
   EXPORT SYSTEM
====================================================== */
/* ===========================
   DOM
=========================== */
/*******************************************************
* function name: runExport
* parameter: 
* return: 
* purpose: 
********************************************************/
async function runExport() {
  state.subjectType = document.getElementById("subjectType")?.value || "minor";

  const type = document.getElementById("exportType").value;
  const scope = document.getElementById("exportScope").value;
  let section = (exportCourse?.value || state.filters.courseSubject || "").trim().toUpperCase();

  //let section = document.getElementById("exportCourse").value;
  let student = document.getElementById("exportStudent").value;

  let subjectType = 50

  // ✅ CLEAR when ALL is selected
  if (scope === "all") {
    section = "";
    student = "";
  }

  // ✅ CLEAR section when SINGLE STUDENT
  if (scope === "student") {
    section = "";
  }

  // ✅ Base check
  if (state.subjectType === "major") {
    subjectType = 60;
  }

  const students = await getStudentsForExport(scope, section, student);

  if (!students.length) {
    toast("No students found.");
    hideLoading();
    return;
  }


  if (type === "excel") {
    await exportExcel(students);
  } else if (type === "pdf") {
    await exportPDF(students);
  } else if (type === "csv") {
    exportCSV(students, subjectType);
  }
}

/*******************************************************
* function name: openscreenExport
* parameter: 
* return: -
* purpose: 
********************************************************/
async function openscreenExport() {
  document.getElementById("screenExport").classList.remove("hidden");

  // ensure dropdown is loaded
  await loadInitialFilters();

  if (exportCourse) {
    exportCourse.value = state.filters.courseSubject || "";
  }
}

/*******************************************************
* function name: closescreenExport
* parameter: 
* return: -
* purpose: 
********************************************************/
function closescreenExport() {
  document.getElementById("screenExport").classList.add("hidden");
  showScreen(screenMenu);
}

/*******************************************************
* function name: getStudentsForExport
* parameter: 
* return: 
* purpose: 
********************************************************/
async function getStudentsForExport(scope, section, name) {

  //const course = (exportCourse?.value || state.filters.courseSubject || "").trim().toUpperCase();

  /*const res = await apiGet({
    action: "exportGrades",

    // ✅ EXACT PARAM ALIGNMENT
    schoolYear: state.filters.schoolYear || "",
    term: state.filters.term || "",
    courseSubject: section || "",

    // 🔥 IMPORTANT: send BOTH for safety
    program: state.filters.program || "",
    section: state.filters.block || "",

    idToken: state.idToken
  });*/
  const res = await apiPost("exportGrades", {

    // ✅ EXACT PARAM ALIGNMENT
    schoolYear: state.filters.schoolYear || "",
    term: state.filters.term || "",
    courseSubject: section || "",

    // 🔥 IMPORTANT: send BOTH for safety
    program: state.filters.program || "",
    section: state.filters.block || ""
  });

  //console.log("res: ", res);

  // ✅ HANDLE ERROR PROPERLY
  if (!res || res.status !== "success") {
    console.error("Export API failed:", res);
    return [];
  }

  let list = res.items || [];

  // 🔥 NORMALIZE ALL DATA FIRST (VERY IMPORTANT)
  list = list.map(s => ({
    ...s,
    _course: String(s.courseSubject || s["course(subject)"] || "").trim().toUpperCase(),
    _name: String(s["lastname,firstnamem.i."] || "").trim().toUpperCase()
  }));

  //console.log("list: ", list);

  // ===== FILTERING =====
  // 🔹 PER STUDENT
  if (scope === "student" && name) {
    const target = String(name).trim().toUpperCase();

    list = list.filter(s => s._name === target);
  }

  // 🔹 PER SECTION / COURSE
  if (scope === "section" && section) {
    const target = String(section).trim().toUpperCase();

    list = list.filter(s => {
      const courseVal = String(s.courseSubject || s["course(subject)"] || s.coursesubject || "").trim().toUpperCase();

      return courseVal === target;
    });
  }

  return list;
}

/*******************************************************
* function name: loadGradesForExport
* parameter: 
* return: 
* purpose: 
********************************************************/
async function loadGradesForExport(studentId) {
  /*const res = await apiGet({
    action: "gradesTaskLoad",
    studentId,
    idToken: state.idToken
  });*/
  const res = await apiPost("gradesTaskLoad", { studentId });


  return res?.items || [];
}

/*******************************************************
* function name: normalizePeriod
* parameter: 
* return: 
* purpose: 
********************************************************/
function normalizePeriod(p) {
  return String(p || "").toUpperCase().includes("FINAL") ? "FINAL PERIOD" : "MIDTERM PERIOD";
}

/*******************************************************
* function name: normalizeCategory
* parameter: 
* return: 
* purpose: 
********************************************************/
function normalizeCategory(c, period) {
  c = String(c || "").toUpperCase();

  if (c.includes("AUG")) return "AUGUSTINIAN VALUE";
  if (c.includes("QUIZ")) return "QUIZ";

  if (c.includes("EXAM") && period === "MIDTERM PERIOD") return "MIDTERM EXAM";
  if (c.includes("EXAM") && period === "FINAL PERIOD") return "FINAL EXAM";

  if (c.includes("PARTICIPATION")) return "CLASS PARTICIPATION";

  return c;
}

/*******************************************************
* function name: getMaxScores
* parameter: 
* return: 
* purpose: 
********************************************************/
function getMaxScores(students, period, category) {
  let max = 0;

  students.forEach(s => {
    const tasks = s.grades || [];

    const count = tasks.filter(t => {
      const p = normalizePeriod(t.period);
      const c = normalizeCategory(t.category, p);

      return p === period && c === category;
    }).length;

    if (count > max) max = count;
  });

  return max;
}

/*******************************************************
* function name: exportExcel
* parameter: 
* return: 
* purpose: 
********************************************************/
// VERSION 2
async function exportExcel(students) {

  if (typeof XLSX === "undefined") {
    hideLoading();
    toast("XLSX not loaded");
    return;
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([]);

  // ================= CONFIG =================
  const categories = [
    "AUGUSTINIAN VALUE",
    "CLASS PARTICIPATION",
    "QUIZ",
    "MIDTERM EXAM"
  ];

  const START_COL = 3; // Column D

  // ================= HELPERS =================
  const normalizePeriod = p =>
    String(p || "").toUpperCase().includes("FINAL") ? "FINAL PERIOD" : "MIDTERM PERIOD";

  const normalizeCategory = (c, period) => {
    c = String(c || "").toUpperCase();

    if (c.includes("AUG")) return "AUGUSTINIAN VALUE";
    if (c.includes("QUIZ")) return "QUIZ";
    if (c.includes("PARTICIPATION")) return "CLASS PARTICIPATION";
    if (c.includes("EXAM")) return period === "FINAL PERIOD" ? "FINAL EXAM" : "MIDTERM EXAM";
    return c;
  };

  const colLetter = n => {
    let s = "";
    while (n >= 0) {
      s = String.fromCharCode((n % 26) + 65) + s;
      n = Math.floor(n / 26) - 1;
    }
    return s;
  };

  const getMaxScores = (students, period, category) => {
    let max = 0;

    students.forEach(s => {
      const count = (s.grades || []).filter(t => {
        const p = normalizePeriod(t.period);
        const c = normalizeCategory(t.category, p);
        return p === period && c === category;
      }).length;

      if (count > max) max = count;
    });

    return max;
  };

  // ================= HEADER BUILD =================
  let headerPeriod = ["NAME", "", ""];
  let headerCategory = ["Subject", ""];
  let headerLabels = ["", ""];
  let maxRow = ["LAST NAME", "FIRST NAME"];

  let colIndex = START_COL;

  // ===== MIDTERM =====
  let midStart = colIndex;

  categories.forEach(cat => {
    const max = getMaxScores(students, "MIDTERM PERIOD", cat);
    const span = max + 3;

    // Period
    headerPeriod.push(...Array(span).fill(""));

    // Category
    headerCategory.push(cat, ...Array(span - 1).fill(""));

    // Labels
    headerLabels.push(...Array(max).fill("Score"));

    const weight = gradeWeights?.["MIDTERM PERIOD"]?.[cat] || 0;

    headerLabels.push("Per", "Trans", `${weight * 100}%`);
    maxRow.push(...Array(span).fill(""));

    colIndex += span;
  });

  let midEnd = colIndex - 1;

  // MIDTERM GRADE
  headerPeriod.push("");
  headerCategory.push("MIDTERM PERIOD GRADE");
  headerLabels.push("");
  maxRow.push("");
  colIndex++;

  // spacer
  headerPeriod.push("");
  headerCategory.push("");
  headerLabels.push("");
  maxRow.push("");
  colIndex++;

  // ===== FINAL =====
  let finalStart = colIndex;

  categories.forEach(cat => {
    const realCat = cat === "MIDTERM EXAM" ? "FINAL EXAM" : cat;
    const max = getMaxScores(students, "FINAL PERIOD", realCat);
    const span = max + 3;

    headerPeriod.push(...Array(span).fill(""));
    headerCategory.push(realCat, ...Array(span - 1).fill(""));
    headerLabels.push(...Array(max).fill("Score"));

    const weight = gradeWeights?.["FINAL PERIOD"]?.[realCat] || 0;

    headerLabels.push("Per", "Trans", `${weight * 100}%`);
    maxRow.push(...Array(span).fill(""));

    colIndex += span;
  });

  let finalEnd = colIndex - 1;

  // FINAL GRADE
  headerPeriod.push("");
  headerCategory.push("FINAL PERIOD GRADES");
  headerLabels.push("");
  maxRow.push("");
  colIndex++;

  // spacer
  headerPeriod.push("");
  headerCategory.push("");
  headerLabels.push("");
  maxRow.push("");
  colIndex++;

  // ===== SUMMARY =====
  const colMG = colIndex++;
  const colMG50 = colIndex++;
  const colFG = colIndex++;
  const colFG50 = colIndex++;
  const colFINAL = colIndex++;

  headerLabels.push("", "", "", "", "FINAL GRADE");
  maxRow.push("MG", "", "", "", "");

  // ================= WRITE HEADERS =================
  XLSX.utils.sheet_add_aoa(ws, [headerPeriod], { origin: { r: 1, c: 1 } });
  XLSX.utils.sheet_add_aoa(ws, [headerCategory], { origin: { r: 2, c: 1 } });
  XLSX.utils.sheet_add_aoa(ws, [headerLabels], { origin: { r: 3, c: 1 } });
  XLSX.utils.sheet_add_aoa(ws, [maxRow], { origin: { r: 4, c: 1 } });

  // ================= MERGES =================
  ws["!merges"] = [];

  // PERIOD
  ws["!merges"].push(
    { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } },
    { s: { r: 1, c: midStart }, e: { r: 1, c: midEnd + 1 } },
    { s: { r: 1, c: finalStart }, e: { r: 1, c: finalEnd + 1 } }
  );

  let catCol = START_COL;

  // ===== MIDTERM CATEGORY =====
  categories.forEach(cat => {
    const max = getMaxScores(students, "MIDTERM PERIOD", cat);
    const span = max + 3;

    ws["!merges"].push({
      s: { r: 2, c: catCol },
      e: { r: 2, c: catCol + span - 1 }
    });

    catCol += span;
  });

  // skip MIDTERM GRADE + spacer
  catCol += 2;

  // ===== FINAL CATEGORY =====
  categories.forEach(cat => {
    const realCat = cat === "MIDTERM EXAM" ? "FINAL EXAM" : cat;
    const max = getMaxScores(students, "FINAL PERIOD", realCat);
    const span = max + 3;

    ws["!merges"].push({
      s: { r: 2, c: catCol },
      e: { r: 2, c: catCol + span - 1 }
    });

    catCol += span;
  });

  let transColPtr = START_COL;

  // ===== MIDTERM =====
  categories.forEach(cat => {

    const max = getMaxScores(students, "MIDTERM PERIOD", cat);

    const transCol = transColPtr + max + 1;
    const percentCol = transColPtr + max + 2;

    ws["!merges"].push({
      s: { r: 3, c: transCol },
      e: { r: 4, c: transCol }
    });

    ws["!merges"].push({
      s: { r: 3, c: percentCol },
      e: { r: 4, c: percentCol }
    });

    transColPtr += max + 3;
  });

  // skip MIDTERM GRADE + spacer
  transColPtr += 2;

  // ===== FINAL =====
  categories.forEach(cat => {

    const realCat = cat === "MIDTERM EXAM" ? "FINAL EXAM" : cat;
    const max = getMaxScores(students, "FINAL PERIOD", realCat);

    const transCol = transColPtr + max + 1;
    const percentCol = transColPtr + max + 2;

    ws["!merges"].push({
      s: { r: 3, c: transCol },
      e: { r: 4, c: transCol }
    });

    ws["!merges"].push({
      s: { r: 3, c: percentCol },
      e: { r: 4, c: percentCol }
    });

    transColPtr += max + 3;
  });

  // MIDTERM GRADE MERGE
  ws["!merges"].push({
    s: { r: 2, c: midEnd + 1 },
    e: { r: 4, c: midEnd + 1 }
  });

  // FINAL GRADE MERGE
  ws["!merges"].push({
    s: { r: 2, c: finalEnd + 1 },
    e: { r: 4, c: finalEnd + 1 }
  });

  // SUMMARY
  ws["!merges"].push({
    s: { r: 1, c: colMG },
    e: { r: 1, c: colFINAL }
  });

  // Midterm Period
  ws["!merges"].push({
    s: { r: 2, c: colMG },
    e: { r: 3, c: colMG + 1 }
  });

  // Final Period
  ws["!merges"].push({
    s: { r: 2, c: colFG },
    e: { r: 3, c: colFG + 1 }
  });

  // FINAL GRADE
  ws["!merges"].push({
    s: { r: 2, c: colFINAL },
    e: { r: 4, c: colFINAL }
  });

  // ================= LABELS =================
  ws[XLSX.utils.encode_cell({ r: 1, c: midStart })] = { t: "s", v: "MIDTERM PERIOD" };
  ws[XLSX.utils.encode_cell({ r: 1, c: finalStart })] = { t: "s", v: "FINAL PERIOD" };
  ws[XLSX.utils.encode_cell({ r: 1, c: colMG })] = { t: "s", v: "SUMMARY OF GRADES" };

  // ===== CENTER MIDTERM / FINAL GRADE HEADERS =====

  // MIDTERM PERIOD GRADE
  const midRef = XLSX.utils.encode_cell({ r: 2, c: midEnd + 1 });
  if (ws[midRef]) {
    ws[midRef].s = {
      ...(ws[midRef].s || {}),
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true }
    };
  }

  // FINAL PERIOD GRADE
  const finalRef = XLSX.utils.encode_cell({ r: 2, c: finalEnd + 1 });
  if (ws[finalRef]) {
    ws[finalRef].s = {
      ...(ws[finalRef].s || {}),
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true }
    };
  }

  // ================= DATA =================
  // ✅ SORT FIRST (PLACE HERE)
  students.sort((a, b) => {
    const [lastA = "", firstA = ""] =
      (a["lastname,firstnamem.i."] || "").toUpperCase().split(",");

    const [lastB = "", firstB = ""] =
      (b["lastname,firstnamem.i."] || "").toUpperCase().split(",");

    if (lastA < lastB) return -1;
    if (lastA > lastB) return 1;

    if (firstA < firstB) return -1;
    if (firstA > firstB) return 1;

    return 0;
  });

  let rowIndex = 5;
  let allMaxValues = [];

  students.forEach(s => {

    const tasks = s.grades || [];
    const [last, first] = (s["lastname,firstnamem.i."] || "").toUpperCase().split(",");

    let row = ["", last || "", first || ""];
    let rowMax = [];
    let col = START_COL;
    let midWeights = [];
    let finalWeights = [];

    const rowNum = rowIndex + 1;

    // ===== MIDTERM =====
    categories.forEach(cat => {

      const max = getMaxScores(students, "MIDTERM PERIOD", cat);

      const list = tasks.filter(t => {
        const p = normalizePeriod(t.period);
        const c = normalizeCategory(t.category, p);
        return p === "MIDTERM PERIOD" && c === cat;
      });

      const start = col;

      for (let i = 0; i < max; i++) {
        row.push(list[i]?.score ?? "");
        rowMax.push(list[i]?.max ?? "");
        col++;
      }

      const end = col - 1;

      const sum = `SUM(${colLetter(start)}${rowNum}:${colLetter(end)}${rowNum})`;
      const maxSum = `SUM(${colLetter(start)}5:${colLetter(end)}5)`;

      // %
      row.push({ f: `IFERROR((${sum}/${maxSum})*100,0)` }); rowMax.push("");
      col++;

      // trans
      const totalCol = colLetter(col - 1);
      const lookup = state.subjectType === "major"
        ? `LOOKUP(${totalCol}${rowNum},Transmutation!B4:B104,Transmutation!C4:C104)`
        : `LOOKUP(${totalCol}${rowNum},Transmutation!F4:F104,Transmutation!G4:G104)`;

      row.push({ f: `IFERROR(${lookup},0)` }); rowMax.push("");
      col++;

      // weighted
      const weight = gradeWeights?.["MIDTERM PERIOD"]?.[cat] || 0;
      row.push({ f: `${colLetter(col - 1)}${rowNum}*${weight}` }); rowMax.push("");

      midWeights.push(`${colLetter(col)}${rowNum}`);
      col++;
    });

    // MIDTERM GRADE
    row.push({ f: `SUM(${midWeights.join(",")})` }); rowMax.push("");
    const midCol = colLetter(col++);
    row.push(""); rowMax.push(""); col++;

    // ===== FINAL =====
    categories.forEach(cat => {

      const realCat = cat === "MIDTERM EXAM" ? "FINAL EXAM" : cat;
      const max = getMaxScores(students, "FINAL PERIOD", realCat);

      const list = tasks.filter(t => {
        const p = normalizePeriod(t.period);
        const c = normalizeCategory(t.category, p);
        return p === "FINAL PERIOD" && c === realCat;
      });

      const start = col;

      for (let i = 0; i < max; i++) {
        row.push(list[i]?.score ?? "");
        rowMax.push(list[i]?.max ?? "");
        col++;
      }

      const end = col - 1;

      const sum = `SUM(${colLetter(start)}${rowNum}:${colLetter(end)}${rowNum})`;
      const maxSum = `SUM(${colLetter(start)}5:${colLetter(end)}5)`;

      // %
      row.push({ f: `IFERROR((${sum}/${maxSum})*100,0)` }); rowMax.push("");
      col++;

      // trans
      const totalCol = colLetter(col - 1);
      const lookup = state.subjectType === "major"
        ? `LOOKUP(${totalCol}${rowNum},Transmutation!B4:B104,Transmutation!C4:C104)`
        : `LOOKUP(${totalCol}${rowNum},Transmutation!F4:F104,Transmutation!G4:G104)`;

      row.push({ f: `IFERROR(${lookup},0)` }); rowMax.push("");
      col++;

      // weighted
      const weight = gradeWeights?.["FINAL PERIOD"]?.[realCat] || 0;
      row.push({ f: `${colLetter(col - 1)}${rowNum}*${weight}` }); rowMax.push("");

      finalWeights.push(`${colLetter(col)}${rowNum}`);
      col++;
    });

    // FINAL GRADE
    row.push({ f: `SUM(${finalWeights.join(",")})` }); rowMax.push("");
    const finalCol = colLetter(col++);

    // ===== SUMMARY =====
    row.push(""); rowMax.push(""); col++;

    row.push({ f: `${midCol}${rowNum}` }); rowMax.push(""); col++;
    row.push({ f: `${midCol}${rowNum}*0.5` }); rowMax.push(""); col++;
    row.push({ f: `${finalCol}${rowNum}` }); rowMax.push(""); col++;
    row.push({ f: `${finalCol}${rowNum}*0.5` }); rowMax.push(""); col++;
    row.push({ f: `(${midCol}${rowNum}*0.5)+(${finalCol}${rowNum}*0.5)` }); rowMax.push("");

    // collect max row
    rowMax.forEach((v, i) => {
      if (!allMaxValues[i]) allMaxValues[i] = v || "";
    });

    XLSX.utils.sheet_add_aoa(ws, [row], { origin: rowIndex++ });

  });

  // ================= MAX ROW =================
  XLSX.utils.sheet_add_aoa(ws, [allMaxValues], { origin: { r: 4, c: 3 } });

  let fixCol = START_COL;

  // ===== MIDTERM =====
  categories.forEach(cat => {

    const max = getMaxScores(students, "MIDTERM PERIOD", cat);

    const start = fixCol;
    const end = fixCol + max - 1;
    const perCol = end + 1;

    if (max > 0) {
      const ref = XLSX.utils.encode_cell({ r: 4, c: perCol });

      ws[ref] = {
        t: "n",
        f: `SUM(${colLetter(start)}5:${colLetter(end)}5)`
      };
    }

    fixCol += max + 3;
  });

  // spacer (IMPORTANT — matches your layout)
  fixCol++;
  fixCol++;

  // ===== FINAL =====
  categories.forEach(cat => {

    const realCat = cat === "MIDTERM EXAM" ? "FINAL EXAM" : cat;

    const max = getMaxScores(students, "FINAL PERIOD", realCat);

    const start = fixCol;
    const end = fixCol + max - 1;
    const perCol = end + 1;

    if (max > 0) {
      const ref = XLSX.utils.encode_cell({ r: 4, c: perCol });

      ws[ref] = {
        t: "n",
        f: `SUM(${colLetter(start)}5:${colLetter(end)}5)`
      };
    }

    fixCol += max + 3;
  });

  ws[XLSX.utils.encode_cell({ r: 2, c: colMG })] = { t: "s", v: "Midterm Period" };
  ws[XLSX.utils.encode_cell({ r: 2, c: colFG })] = { t: "s", v: "Final Period" };
  ws[XLSX.utils.encode_cell({ r: 2, c: colFG50 + 1 })] = { t: "s", v: "FINAL GRADE" };
  ws[XLSX.utils.encode_cell({ r: 4, c: colMG })] = { t: "s", v: "MG" };
  ws[XLSX.utils.encode_cell({ r: 4, c: colMG50 })] = { t: "s", v: "50%" };
  ws[XLSX.utils.encode_cell({ r: 4, c: colFG })] = { t: "s", v: "FG" };
  ws[XLSX.utils.encode_cell({ r: 4, c: colFG50 })] = { t: "s", v: "50%" };

  // ================= STYLES =================

  const range = XLSX.utils.decode_range(ws["!ref"]);

  // ===== IDENTIFY IMPORTANT COLUMNS =====
  let ptr = START_COL;

  // MIDTERM BLOCKS
  categories.forEach(cat => {
    const max = getMaxScores(students, "MIDTERM PERIOD", cat);
    ptr += max + 3;
  });

  const midGradeCol = ptr;
  ptr++;

  const spacer1 = ptr;
  ptr++;

  // FINAL BLOCKS
  categories.forEach(cat => {
    const realCat = cat === "MIDTERM EXAM" ? "FINAL EXAM" : cat;
    const max = getMaxScores(students, "FINAL PERIOD", realCat);
    ptr += max + 3;
  });

  const finalGradeCol = ptr;
  ptr++;

  const spacer2 = ptr;

  const summaryFinalCol = colFINAL;

  // ================= MAIN LOOP =================

  let paintPtr = START_COL;

  for (let R = range.s.r; R <= range.e.r; R++) {
    let C = range.s.c;

    // ===== LOOP THROUGH ALL COLUMNS =====
    while (C <= range.e.c) {

      const ref = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[ref]) {
        C++;
        continue;
      }

      const isHeader = R >= 1 && R <= 4;
      const isName = (C === 1 || C === 2);
      const isColA = (C === 0);
      const isSpacer = (C === spacer1 || C === spacer2);

      let style = {
        alignment: { horizontal: isName ? "left" : "center", vertical: "center", }
      };

      // ===== MIDTERM + FINAL BLOCK COLORING =====
      let ptr = START_COL;

      const applyCategoryColors = (period) => {
        categories.forEach(cat => {

          const realCat = (period === "FINAL PERIOD" && cat === "MIDTERM EXAM") ? "FINAL EXAM" : cat;

          const max = getMaxScores(students, period, realCat);

          // 🔵 SCORE (BLUE)
          /*for (let i = 0; i < max; i++) {
            if (C === ptr + i && !isHeader) {
              style.fill = {
                patternType: "solid",
                fgColor: { rgb: "BDD7EE" }
              };
            }
          }*/

          // 🟡 PERCENT
          if (C === ptr + max && !isHeader) {
            style.fill = { patternType: "solid", fgColor: { rgb: "B7DEE8" } };
          }

          // 🔴 TRANSMUTATION
          if (C === ptr + max + 1 && !isHeader) {
            style.fill = { patternType: "solid", fgColor: { rgb: "B7DEE8" } };
          }

          // 🟣 WEIGHTED
          if (C === ptr + max + 2 && !isHeader) {
            style.fill = { patternType: "solid", fgColor: { rgb: "FFFF00" } };
          }

          ptr += max + 3;
        });
      };

      // APPLY BOTH PERIODS
      applyCategoryColors("MIDTERM PERIOD");

      // MIDTERM GRADE
      /*const midGradeCol = ptr;
      if (C === midGradeCol && !isHeader) {
        style.fill = { patternType: "solid", fgColor: { rgb: "FBD5B5" } };
        style.font = { bold: true };
      }*/
      // MIDTERM PERIOD GRADE
      const midRef = XLSX.utils.encode_cell({ r: 2, c: midEnd + 1 });
      if (ws[midRef]) {
        ws[midRef].s = {
          ...(ws[midRef].s || {}),
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          font: { bold: true }
        };
      }

      const midGradeCol = ptr;
      if (C === midGradeCol && !isHeader) {
        style.fill = {
          patternType: "solid",
          fgColor: { rgb: "FBD5B5" }
        };
        style.font = { bold: true };
      }

      ptr += 2; // grade + spacer

      applyCategoryColors("FINAL PERIOD");

      // FINAL GRADE
      /*const finalGradeCol = ptr;
      if (C === finalGradeCol && !isHeader) {
        style.fill = { patternType: "solid", fgColor: { rgb: "FBD5B5" } };
        style.font = { bold: true };
      }*/
      // FINAL PERIOD GRADE
      const finalRef = XLSX.utils.encode_cell({ r: 2, c: finalEnd + 1 });
      if (ws[finalRef]) {
        ws[finalRef].s = {
          ...(ws[finalRef].s || {}),
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          font: { bold: true }
        };
      }

      const finalGradeCol = ptr;
      if (C === finalGradeCol && !isHeader) {
        style.fill = {
          patternType: "solid",
          fgColor: { rgb: "FBD5B5" }
        };
        style.font = { bold: true };
      }

      ptr += 2;

      // SUMMARY FINAL GRADE (WRAP)
      const summaryRef = XLSX.utils.encode_cell({ r: 2, c: colFINAL });
      if (ws[summaryRef]) {
        ws[summaryRef].s = {
          ...(ws[summaryRef].s || {}),
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          font: { bold: true }
        };
      }

      // ===== HEADER STYLE =====
      /*if (isHeader && !isSpacer) {
        style.fill = { patternType: "solid", fgColor: { rgb: "A5A5A5" } };
        style.font = { bold: true };
      }*/
      if (!isSpacer) {

        const isRow1 = R === 1;
        const isRow2 = R === 2;
        const isRow5 = R === 4; // ✅ Per VALUE row

        const cellValue = ws[ref]?.v || "";
        const isWeight = String(cellValue).includes("%");

        const isGradeCol = C === midGradeCol || C === finalGradeCol;

        const isSummaryMain = C === colMG || C === colFG || C === colFINAL;

        // ===== DETECT PER COLUMN =====
        let isPerValue = false;
        let ptrCheck = START_COL;

        // MIDTERM
        categories.forEach(cat => {
          const max = getMaxScores(students, "MIDTERM PERIOD", cat);
          const perCol = ptrCheck + max;

          if (C === perCol && isRow5) {
            isPerValue = true;
          }

          ptrCheck += max + 3;
        });

        ptrCheck += 2;

        // FINAL
        categories.forEach(cat => {
          const realCat = cat === "MIDTERM EXAM" ? "FINAL EXAM" : cat;
          const max = getMaxScores(students, "FINAL PERIOD", realCat);
          const perCol = ptrCheck + max;

          if (C === perCol && isRow5) {
            isPerValue = true;
          }

          ptrCheck += max + 3;
        });

        // ===== HEADER COLOR =====
        if (isHeader) {
          style.fill = { patternType: "solid", fgColor: { rgb: "A5A5A5" } };
        }

        // ===== FINAL BOLD RULE =====
        if (isRow1 || isRow2 || isWeight || isGradeCol || isSummaryMain || isPerValue) {
          style.font = { bold: true };
        } else {
          style.font = { bold: false };
        }
      }

      // ===== BORDERS =====
      if (!isColA && !isSpacer) {
        style.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      }

      if (isName) {
        style.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      }

      // ===== SUMMARY COLORS and BOLD STYLES=====
      // MIDTERM PERIO GRADE + FINAL PERIOD GRADE
      if ((C === midGradeCol || C === finalGradeCol) && !isHeader) {
        style.font = { ...(style.font || {}), bold: true, sz: 12 };
      }

      // MG
      if (C === colMG && !isHeader) {
        style.fill = { patternType: "solid", fgColor: { rgb: "FCD5B4" } };
      }

      // 50% (mid)
      if (C === colMG50 && !isHeader) {
        style.fill = { patternType: "solid", fgColor: { rgb: "FFFF00" } };
      }

      // FG
      if (C === colFG && !isHeader) {
        style.fill = { patternType: "solid", fgColor: { rgb: "FCD5B4" } };
      }

      // 50% (final)
      if (C === colFG50 && !isHeader) {
        style.fill = { patternType: "solid", fgColor: { rgb: "FFFF00" } };
      }

      // FINAL GRADE
      if (C === colFINAL && !isHeader) {
        style.fill = { patternType: "solid", fgColor: { rgb: "B1A0C7" } };
        style.font = { ...(style.font || {}), bold: true, sz: 13 };
      }

      ws[ref].s = style;

      C++;
    }
  }

  // ================= 🔥 FIX SUMMARY (PLACE HERE) =================
  for (let R = 1; R <= range.e.r; R++) {
    for (let C = colMG; C <= colFINAL; C++) {

      const ref = XLSX.utils.encode_cell({ r: R, c: C });

      // ✅ ensure cell exists
      if (!ws[ref]) {
        ws[ref] = { t: "s", v: "" };
      }

      ws[ref].s = {
        ...(ws[ref].s || {}),
        border: {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" }
        }
      };
    }
  }

  // ===== NUMBER FORMATTING =====
  const range2 = XLSX.utils.decode_range(ws["!ref"]);

  for (let R = 5; R <= range2.e.r; R++) {
    for (let C = START_COL; C <= range2.e.c; C++) {

      const ref = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[ref]) continue;

      // DEFAULT → NO DECIMALS
      ws[ref].z = "0";

    }
  }

  // ===== APPLY 1 DECIMAL PLACES =====
  let formatCol = START_COL;

  // ===== MIDTERM =====
  categories.forEach(cat => {

    const max = getMaxScores(students, "MIDTERM PERIOD", cat);

    // move to next block
    formatCol += max + 3;
  });

  // MIDTERM GRADE COLUMN
  const midGradeColIndex = formatCol;

  // apply 1 decimal
  for (let R = 5; R <= range.e.r; R++) {
    const ref = XLSX.utils.encode_cell({ r: R, c: midGradeColIndex });
    if (ws[ref]) ws[ref].z = "0.0";
  }

  formatCol++;

  // spacer
  formatCol++;

  // ===== FINAL =====
  categories.forEach(cat => {

    const realCat = cat === "MIDTERM EXAM" ? "FINAL EXAM" : cat;
    const max = getMaxScores(students, "FINAL PERIOD", realCat);

    formatCol += max + 3;
  });

  // FINAL PERIOD GRADE COLUMN
  const finalGradeColIndex = formatCol;

  // apply 1 decimal
  for (let R = 5; R <= range.e.r; R++) {
    const ref = XLSX.utils.encode_cell({ r: R, c: finalGradeColIndex });
    if (ws[ref]) ws[ref].z = "0.0";
  }

  formatCol++;

  // spacer before summary
  formatCol++;

  // ===== FINAL GRADE (SUMMARY) =====
  const finalColIndex = formatCol + 4; // MG,50,FG,50 → FINAL

  for (let R = 5; R <= range.e.r; R++) {
    const ref = XLSX.utils.encode_cell({ r: R, c: finalColIndex });
    if (ws[ref]) ws[ref].z = "0.0";
  }

  // ===== COLUN SIZING =====
  //const range = XLSX.utils.decode_range(ws["!ref"]);

  ws["!cols"] = [];

  // loop all columns
  for (let C = 0; C <= range.e.c; C++) {

    let width = 5.38; // default

    if (C === 0 || C === spacer2) {
      width = 1.5;
    }

    // NAME columns
    if (C === 1) {
      width = 14.63;
    } else if (C === 2) {
      width = 29.38;
    }

    // SPACER columns
    if (C === spacer1) {
      width = 6.38;
    }

    // FINAL GRADE columns (important)
    if (C === midGradeCol || C === finalGradeCol || C === colFINAL) {
      width = 5.38;
    }

    ws["!cols"][C] = { wch: width };
  }

  // ================= LEGEND (FINAL - DYNAMIC) =================
  const finalRange = XLSX.utils.decode_range(ws["!ref"]);

  const legendCol = finalRange.e.c + 2;
  const labelCol = legendCol + 1;
  const valueCol = legendCol + 2;

  const startRow = 6;

  ws[XLSX.utils.encode_cell({ r: startRow, c: legendCol })] = {
    t: "s",
    v: "Legend"
  };

  const legendData = [
    ["MG-", "Midterm Grade"],
    ["FPG-", "Final Period Grade"],
    ["Per", "Percentile"],
    ["Trans-", "Transmutation"]
  ];

  legendData.forEach((row, i) => {
    const r = startRow + 1 + i;

    ws[XLSX.utils.encode_cell({ r, c: labelCol })] = { t: "s", v: row[0] };
    ws[XLSX.utils.encode_cell({ r, c: valueCol })] = { t: "s", v: row[1] };
  });

  legendData.forEach((row, i) => {
    const r = startRow + 1 + i;

    const labelRef = XLSX.utils.encode_cell({ r, c: labelCol });
    const valueRef = XLSX.utils.encode_cell({ r, c: valueCol });

    const isMain = row[0] === "MG-" || row[0] === "FPG-";

    // LABEL (BD)
    if (ws[labelRef]) {
      ws[labelRef].s = {
        alignment: { horizontal: "left" },
        font: { bold: isMain }
      };
    }

    // VALUE (BE)
    if (ws[valueRef]) {
      ws[valueRef].s = {
        alignment: { horizontal: "left" }
      };
    }
  });

  const newEndCol = valueCol;
  const newEndRow = startRow + legendData.length + 1;

  const updatedRange = XLSX.utils.decode_range(ws["!ref"]);

  updatedRange.e.c = Math.max(updatedRange.e.c, newEndCol);
  updatedRange.e.r = Math.max(updatedRange.e.r, newEndRow);

  ws["!ref"] = XLSX.utils.encode_range(updatedRange);

  ws["!cols"][legendCol] = { wch: 12 };
  ws["!cols"][labelCol] = { wch: 10 };
  ws["!cols"][valueCol] = { wch: 28 };

  // ================= COLUMN GROUPING =================
  // ensure !cols exists
  if (!ws["!cols"]) ws["!cols"] = [];

  // ===== MIDTERM GROUP =====
  for (let c = midStart; c <= midEnd + 1; c++) {
    if (!ws["!cols"][c]) ws["!cols"][c] = {};
    ws["!cols"][c].level = 1;
  }

  // ===== FINAL GROUP =====
  for (let c = finalStart; c <= finalEnd + 1; c++) {
    if (!ws["!cols"][c]) ws["!cols"][c] = {};
    ws["!cols"][c].level = 1;
  }

  // ===== SUMMARY GROUP =====
  for (let c = colMG; c <= colFINAL; c++) {
    if (!ws["!cols"][c]) ws["!cols"][c] = {};
    ws["!cols"][c].level = 1;
  }

  // ================= TRANSMUTATION =================
  const transSheet = XLSX.utils.aoa_to_sheet([]);

  // ✅ COMPLETE TRANSMUTATION TABLE (MAJOR + MINOR)
  const major = {
    0: 65, 1: 65, 2: 65, 3: 65, 4: 65, 5: 65, 6: 65, 7: 65, 8: 65, 9: 65, 10: 65,
    11: 65, 12: 65, 13: 65, 14: 65, 15: 65, 16: 65, 17: 65, 18: 65, 19: 65, 20: 65,
    21: 66, 22: 66, 23: 66, 24: 66, 25: 67, 26: 67, 27: 67, 28: 67, 29: 68, 30: 68,
    31: 68, 32: 68, 33: 69, 34: 69, 35: 69, 36: 69, 37: 70, 38: 70, 39: 70, 40: 70,
    41: 71, 42: 71, 43: 71, 44: 71, 45: 72, 46: 72, 47: 72, 48: 72, 49: 72, 50: 73,
    51: 73, 52: 73, 53: 73, 54: 73, 55: 74, 56: 74, 57: 74, 58: 74, 59: 74, 60: 75,
    61: 76, 62: 76, 63: 77, 64: 77, 65: 78, 66: 78, 67: 79, 68: 79, 69: 80, 70: 80,
    71: 81, 72: 81, 73: 82, 74: 82, 75: 83, 76: 83, 77: 84, 78: 84, 79: 85, 80: 85,
    81: 86, 82: 86, 83: 87, 84: 87, 85: 88, 86: 88, 87: 89, 88: 89, 89: 90, 90: 90,
    91: 91, 92: 91, 93: 92, 94: 92, 95: 93, 96: 93, 97: 94, 98: 94, 99: 95, 100: 95
  };

  const minor = {
    0: 65, 1: 65, 2: 65, 3: 65, 4: 65, 5: 65, 6: 65, 7: 65, 8: 65, 9: 65, 10: 65,
    11: 65, 12: 65, 13: 65, 14: 65, 15: 65, 16: 66, 17: 66, 18: 66, 19: 67, 20: 67,
    21: 67, 22: 68, 23: 68, 24: 68, 25: 68, 26: 69, 27: 69, 28: 69, 29: 69, 30: 70,
    31: 70, 32: 70, 33: 70, 34: 71, 35: 71, 36: 71, 37: 71, 38: 72, 39: 72, 40: 72,
    41: 72, 42: 73, 43: 73, 44: 73, 45: 73, 46: 74, 47: 74, 48: 74, 49: 74, 50: 75,
    51: 76, 52: 76, 53: 77, 54: 77, 55: 78, 56: 78, 57: 79, 58: 79, 59: 80, 60: 80,
    61: 81, 62: 81, 63: 82, 64: 82, 65: 83, 66: 83, 67: 84, 68: 84, 69: 85, 70: 85,
    71: 86, 72: 86, 73: 86, 74: 87, 75: 87, 76: 87, 77: 88, 78: 88, 79: 88, 80: 89,
    81: 89, 82: 89, 83: 90, 84: 90, 85: 90, 86: 91, 87: 91, 88: 91, 89: 92, 90: 92,
    91: 92, 92: 93, 93: 93, 94: 93, 95: 94, 96: 94, 97: 94, 98: 95, 99: 95, 100: 95
  };

  const transData = [["", "BASE 60 (Major Subject)", "", "", "", "BASE 50 (Minor Subject)"],
  ["", "RAW SCORE", "RATE", "", "", "RAW SCORE", "RATE"]];

  for (let i = 0; i <= 100; i++) {
    transData.push(["", i, major[i], "", "", i, minor[i]]);
  }

  XLSX.utils.sheet_add_aoa(transSheet, transData);

  // ================= SAVE =================
  XLSX.utils.book_append_sheet(wb, ws, "Grades");
  XLSX.utils.book_append_sheet(wb, transSheet, "Transmutation");

  XLSX.writeFile(wb, "Final_Report.xlsx", { cellFormula: true });
  hideLoading();
}

/*******************************************************
* function name: exportPDF
* parameter: 
* return: 
* purpose: Generate PDF EXACTLY SAME as Excel output
* method: Excel → HTML → PDF (preserves merges/layout)
* 
* FLOW:
* 1. GENERATE  → build Excel sheet (reuse logic)
* 2. CONVERT   → sheet → HTML
* 3. CLEAN     → apply Excel-like styling
* 4. RENDER    → HTML → PDF (A4 landscape)
*******************************************************/
async function exportPDF(students) {

  try {

    /*******************************************************
     * 1. GENERATE (REUSE YOUR EXACT EXCEL LOGIC)
     *******************************************************/
    if (typeof XLSX === "undefined") {
      toast("XLSX not loaded");
      hideLoading();
      return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);

    // 🔥 IMPORTANT: this must contain ALL your Excel logic
    await buildExcelSheet(ws, students);

    // ✅ SAFETY CHECK (prevents 'Sheet has no data')
    if (!ws["!ref"]) {
      console.error("Sheet has no data!");
      toast("Failed: Excel sheet is empty.");
      hideLoading();
      return;
    }

    XLSX.utils.book_append_sheet(wb, ws, "Grades");


    /*******************************************************
     * 2. CONVERT (SHEET → HTML)
     *******************************************************/
    const rawHTML = XLSX.utils.sheet_to_html(ws);


    /*******************************************************
     * 3. CLEAN (MAKE IT LOOK LIKE EXCEL)
     *******************************************************/
    const styledHTML = `
    <html>
    <head>
    <style>

      body {
        margin: 0;
        padding: 0;
        font-family: Arial, sans-serif;
      }

      .wrapper {
        width: 1600px; /* 🔥 prevents compression */
      }

      table {
        border-collapse: collapse;
        table-layout: fixed; /* 🔥 CRITICAL: no overlap */
        width: 1600px;
        font-size: 8px;
      }

      td, th {
        border: 1px solid #000; /* ✅ borders */
        padding: 2px;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
      }

      thead td {
        background: #A6A6A6;
        color: #fff;
        font-weight: bold;
      }

      /* NAME ALIGN LEFT */
      td:nth-child(2),
      td:nth-child(3) {
        text-align: left;
      }

      /* COLUMN WIDTH CONTROL */
      td {
        min-width: 40px;
      }

      td:nth-child(2) { min-width: 120px; }
      td:nth-child(3) { min-width: 160px; }

    </style>
    </head>
    <body>
      <div class="wrapper">
        ${rawHTML}
      </div>
    </body>
    </html>
    `;


    /*******************************************************
     * 4. RENDER (HTML → PDF)
     *******************************************************/
    if (!window.jspdf || !window.html2canvas) {
      toast("Missing jsPDF or html2canvas");
      hideLoading();
      return;
    }

    const { jsPDF } = window.jspdf;

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4"
    });

    await doc.html(styledHTML, {
      x: 10,
      y: 10,
      width: 820,              // ✅ fits A4
      windowWidth: 1600,       // ✅ match wrapper
      html2canvas: {
        scale: 0.6,            // ✅ prevents overlap
        useCORS: true
      },
      callback: function (doc) {
        doc.save("Final_Report.pdf");
        //console.log("PDF saving done.");
      }
    });

  } catch (err) {

    /*******************************************************
     * ERROR HANDLING
     *******************************************************/
    console.warn("PDF Export Error:", err);
    toast("PDF failed. " + err.toString());
  }
}

/*******************************************************
* function name: buildExcelSheet
* parameter: 
* return: 
* purpose: 
********************************************************/
async function buildExcelSheet(ws, students) {
  // 👉 COPY EVERYTHING inside exportExcel
  // EXCEPT:
  // ❌ remove XLSX.writeFile(...)
  // ❌ remove loading UI
  // ✔ keep all headers, merges, styles, formulas

  if (typeof XLSX === "undefined") {
    hideLoading();
    toast("XLSX not loaded");
    return;
  }

  const wb = XLSX.utils.book_new();
  //const ws = XLSX.utils.aoa_to_sheet([]);

  // ================= CONFIG =================
  const categories = [
    "AUGUSTINIAN VALUE",
    "CLASS PARTICIPATION",
    "QUIZ",
    "MIDTERM EXAM"
  ];

  const START_COL = 3; // Column D

  // ================= HELPERS =================
  const normalizePeriod = p =>
    String(p || "").toUpperCase().includes("FINAL") ? "FINAL PERIOD" : "MIDTERM PERIOD";

  const normalizeCategory = (c, period) => {
    c = String(c || "").toUpperCase();

    if (c.includes("AUG")) return "AUGUSTINIAN VALUE";
    if (c.includes("QUIZ")) return "QUIZ";
    if (c.includes("PARTICIPATION")) return "CLASS PARTICIPATION";

    if (c.includes("EXAM"))
      return period === "FINAL PERIOD" ? "FINAL EXAM" : "MIDTERM EXAM";

    return c;
  };

  const colLetter = n => {
    let s = "";
    while (n >= 0) {
      s = String.fromCharCode((n % 26) + 65) + s;
      n = Math.floor(n / 26) - 1;
    }
    return s;
  };

  const getMaxScores = (students, period, category) => {
    let max = 0;

    students.forEach(s => {
      const count = (s.grades || []).filter(t => {
        const p = normalizePeriod(t.period);
        const c = normalizeCategory(t.category, p);
        return p === period && c === category;
      }).length;

      if (count > max) max = count;
    });

    return max;
  };

  // ================= HEADER BUILD =================
  let headerPeriod = ["NAME", "", ""];
  let headerCategory = ["Subject", ""];
  let headerLabels = ["", ""];
  let maxRow = ["LAST NAME", "FIRST NAME"];

  let colIndex = START_COL;

  // ===== MIDTERM =====
  let midStart = colIndex;

  categories.forEach(cat => {
    const max = getMaxScores(students, "MIDTERM PERIOD", cat);
    const span = max + 3;

    // Period
    headerPeriod.push(...Array(span).fill(""));

    // Category
    headerCategory.push(cat, ...Array(span - 1).fill(""));

    // Labels
    headerLabels.push(...Array(max).fill("Score"));

    const weight = gradeWeights?.["MIDTERM PERIOD"]?.[cat] || 0;

    headerLabels.push("Per", "Trans", `${weight * 100}%`);
    maxRow.push(...Array(span).fill(""));

    colIndex += span;
  });

  let midEnd = colIndex - 1;

  // MIDTERM GRADE
  headerPeriod.push("");
  headerCategory.push("MIDTERM PERIOD GRADE");
  headerLabels.push("");
  maxRow.push("");
  colIndex++;

  // spacer
  headerPeriod.push("");
  headerCategory.push("");
  headerLabels.push("");
  maxRow.push("");
  colIndex++;

  // ===== FINAL =====
  let finalStart = colIndex;

  categories.forEach(cat => {
    const realCat = cat === "MIDTERM EXAM" ? "FINAL EXAM" : cat;
    const max = getMaxScores(students, "FINAL PERIOD", realCat);
    const span = max + 3;

    headerPeriod.push(...Array(span).fill(""));
    headerCategory.push(realCat, ...Array(span - 1).fill(""));
    headerLabels.push(...Array(max).fill("Score"));

    const weight = gradeWeights?.["FINAL PERIOD"]?.[realCat] || 0;

    headerLabels.push("Per", "Trans", `${weight * 100}%`);
    maxRow.push(...Array(span).fill(""));

    colIndex += span;
  });

  let finalEnd = colIndex - 1;

  // FINAL GRADE
  headerPeriod.push("");
  headerCategory.push("FINAL PERIOD GRADES");
  headerLabels.push("");
  maxRow.push("");
  colIndex++;

  // spacer
  headerPeriod.push("");
  headerCategory.push("");
  headerLabels.push("");
  maxRow.push("");
  colIndex++;

  // ===== SUMMARY =====
  const colMG = colIndex++;
  const colMG50 = colIndex++;
  const colFG = colIndex++;
  const colFG50 = colIndex++;
  const colFINAL = colIndex++;

  headerLabels.push("", "", "", "", "FINAL GRADE");
  maxRow.push("MG", "", "", "", "");

  // ================= WRITE HEADERS =================
  XLSX.utils.sheet_add_aoa(ws, [headerPeriod], { origin: { r: 1, c: 1 } });
  XLSX.utils.sheet_add_aoa(ws, [headerCategory], { origin: { r: 2, c: 1 } });
  XLSX.utils.sheet_add_aoa(ws, [headerLabels], { origin: { r: 3, c: 1 } });
  XLSX.utils.sheet_add_aoa(ws, [maxRow], { origin: { r: 4, c: 1 } });

  // ================= MERGES =================
  ws["!merges"] = [];

  // PERIOD
  ws["!merges"].push(
    { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } },
    { s: { r: 1, c: midStart }, e: { r: 1, c: midEnd + 1 } },
    { s: { r: 1, c: finalStart }, e: { r: 1, c: finalEnd + 1 } }
  );

  let catCol = START_COL;

  // ===== MIDTERM CATEGORY =====
  categories.forEach(cat => {
    const max = getMaxScores(students, "MIDTERM PERIOD", cat);
    const span = max + 3;

    ws["!merges"].push({
      s: { r: 2, c: catCol },
      e: { r: 2, c: catCol + span - 1 }
    });

    catCol += span;
  });

  // skip MIDTERM GRADE + spacer
  catCol += 2;

  // ===== FINAL CATEGORY =====
  categories.forEach(cat => {
    const realCat = cat === "MIDTERM EXAM" ? "FINAL EXAM" : cat;
    const max = getMaxScores(students, "FINAL PERIOD", realCat);
    const span = max + 3;

    ws["!merges"].push({
      s: { r: 2, c: catCol },
      e: { r: 2, c: catCol + span - 1 }
    });

    catCol += span;
  });

  let transColPtr = START_COL;

  // ===== MIDTERM =====
  categories.forEach(cat => {

    const max = getMaxScores(students, "MIDTERM PERIOD", cat);

    const transCol = transColPtr + max + 1;
    const percentCol = transColPtr + max + 2;

    ws["!merges"].push({
      s: { r: 3, c: transCol },
      e: { r: 4, c: transCol }
    });

    ws["!merges"].push({
      s: { r: 3, c: percentCol },
      e: { r: 4, c: percentCol }
    });

    transColPtr += max + 3;
  });

  // skip MIDTERM GRADE + spacer
  transColPtr += 2;

  // ===== FINAL =====
  categories.forEach(cat => {

    const realCat = cat === "MIDTERM EXAM" ? "FINAL EXAM" : cat;
    const max = getMaxScores(students, "FINAL PERIOD", realCat);

    const transCol = transColPtr + max + 1;
    const percentCol = transColPtr + max + 2;

    ws["!merges"].push({
      s: { r: 3, c: transCol },
      e: { r: 4, c: transCol }
    });

    ws["!merges"].push({
      s: { r: 3, c: percentCol },
      e: { r: 4, c: percentCol }
    });

    transColPtr += max + 3;
  });

  // MIDTERM GRADE MERGE
  ws["!merges"].push({
    s: { r: 2, c: midEnd + 1 },
    e: { r: 4, c: midEnd + 1 }
  });

  // FINAL GRADE MERGE
  ws["!merges"].push({
    s: { r: 2, c: finalEnd + 1 },
    e: { r: 4, c: finalEnd + 1 }
  });

  // SUMMARY
  ws["!merges"].push({
    s: { r: 1, c: colMG },
    e: { r: 1, c: colFINAL }
  });

  // Midterm Period
  ws["!merges"].push({
    s: { r: 2, c: colMG },
    e: { r: 3, c: colMG + 1 }
  });

  // Final Period
  ws["!merges"].push({
    s: { r: 2, c: colFG },
    e: { r: 3, c: colFG + 1 }
  });

  // FINAL GRADE
  ws["!merges"].push({
    s: { r: 2, c: colFINAL },
    e: { r: 4, c: colFINAL }
  });

  // ================= LABELS =================
  ws[XLSX.utils.encode_cell({ r: 1, c: midStart })] = { t: "s", v: "MIDTERM PERIOD" };
  ws[XLSX.utils.encode_cell({ r: 1, c: finalStart })] = { t: "s", v: "FINAL PERIOD" };
  ws[XLSX.utils.encode_cell({ r: 1, c: colMG })] = { t: "s", v: "SUMMARY OF GRADES" };

  // ===== CENTER MIDTERM / FINAL GRADE HEADERS =====

  // MIDTERM PERIOD GRADE
  const midRef = XLSX.utils.encode_cell({ r: 2, c: midEnd + 1 });
  if (ws[midRef]) {
    ws[midRef].s = {
      ...(ws[midRef].s || {}),
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true }
    };
  }

  // FINAL PERIOD GRADE
  const finalRef = XLSX.utils.encode_cell({ r: 2, c: finalEnd + 1 });
  if (ws[finalRef]) {
    ws[finalRef].s = {
      ...(ws[finalRef].s || {}),
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true }
    };
  }

  // ================= DATA =================
  // ✅ SORT FIRST (PLACE HERE)
  students.sort((a, b) => {
    const [lastA = "", firstA = ""] =
      (a["lastname,firstnamem.i."] || "").toUpperCase().split(",");

    const [lastB = "", firstB = ""] =
      (b["lastname,firstnamem.i."] || "").toUpperCase().split(",");

    if (lastA < lastB) return -1;
    if (lastA > lastB) return 1;

    if (firstA < firstB) return -1;
    if (firstA > firstB) return 1;

    return 0;
  });

  let rowIndex = 5;
  let allMaxValues = [];

  students.forEach(s => {

    const tasks = s.grades || [];
    const [last, first] = (s["lastname,firstnamem.i."] || "").toUpperCase().split(",");

    let row = ["", last || "", first || ""];
    let rowMax = [];
    let col = START_COL;
    let midWeights = [];
    let finalWeights = [];

    const rowNum = rowIndex + 1;

    // ===== MIDTERM =====
    categories.forEach(cat => {

      const max = getMaxScores(students, "MIDTERM PERIOD", cat);

      const list = tasks.filter(t => {
        const p = normalizePeriod(t.period);
        const c = normalizeCategory(t.category, p);
        return p === "MIDTERM PERIOD" && c === cat;
      });

      const start = col;

      for (let i = 0; i < max; i++) {
        row.push(list[i]?.score ?? "");
        rowMax.push(list[i]?.max ?? "");
        col++;
      }

      const end = col - 1;

      const sum = `SUM(${colLetter(start)}${rowNum}:${colLetter(end)}${rowNum})`;
      const maxSum = `SUM(${colLetter(start)}5:${colLetter(end)}5)`;

      // %
      row.push({ f: `IFERROR((${sum}/${maxSum})*100,0)` }); rowMax.push("");
      col++;

      // trans
      const totalCol = colLetter(col - 1);
      const lookup = state.subjectType === "major"
        ? `LOOKUP(${totalCol}${rowNum},Transmutation!B4:B104,Transmutation!C4:C104)`
        : `LOOKUP(${totalCol}${rowNum},Transmutation!F4:F104,Transmutation!G4:G104)`;

      row.push({ f: `IFERROR(${lookup},0)` }); rowMax.push("");
      col++;

      // weighted
      const weight = gradeWeights?.["MIDTERM PERIOD"]?.[cat] || 0;
      row.push({ f: `${colLetter(col - 1)}${rowNum}*${weight}` }); rowMax.push("");

      midWeights.push(`${colLetter(col)}${rowNum}`);
      col++;
    });

    // MIDTERM GRADE
    row.push({ f: `SUM(${midWeights.join(",")})` }); rowMax.push("");
    const midCol = colLetter(col++);
    row.push(""); rowMax.push(""); col++;

    // ===== FINAL =====
    categories.forEach(cat => {

      const realCat = cat === "MIDTERM EXAM" ? "FINAL EXAM" : cat;
      const max = getMaxScores(students, "FINAL PERIOD", realCat);

      const list = tasks.filter(t => {
        const p = normalizePeriod(t.period);
        const c = normalizeCategory(t.category, p);
        return p === "FINAL PERIOD" && c === realCat;
      });

      const start = col;

      for (let i = 0; i < max; i++) {
        row.push(list[i]?.score ?? "");
        rowMax.push(list[i]?.max ?? "");
        col++;
      }

      const end = col - 1;

      const sum = `SUM(${colLetter(start)}${rowNum}:${colLetter(end)}${rowNum})`;
      const maxSum = `SUM(${colLetter(start)}5:${colLetter(end)}5)`;

      // %
      row.push({ f: `IFERROR((${sum}/${maxSum})*100,0)` }); rowMax.push("");
      col++;

      // trans
      const totalCol = colLetter(col - 1);
      const lookup = state.subjectType === "major"
        ? `LOOKUP(${totalCol}${rowNum},Transmutation!B4:B104,Transmutation!C4:C104)`
        : `LOOKUP(${totalCol}${rowNum},Transmutation!F4:F104,Transmutation!G4:G104)`;

      row.push({ f: `IFERROR(${lookup},0)` }); rowMax.push("");
      col++;

      // weighted
      const weight = gradeWeights?.["FINAL PERIOD"]?.[realCat] || 0;
      row.push({ f: `${colLetter(col - 1)}${rowNum}*${weight}` }); rowMax.push("");

      finalWeights.push(`${colLetter(col)}${rowNum}`);
      col++;
    });

    // FINAL GRADE
    row.push({ f: `SUM(${finalWeights.join(",")})` }); rowMax.push("");
    const finalCol = colLetter(col++);

    // ===== SUMMARY =====
    row.push(""); rowMax.push(""); col++;

    row.push({ f: `${midCol}${rowNum}` }); rowMax.push(""); col++;
    row.push({ f: `${midCol}${rowNum}*0.5` }); rowMax.push(""); col++;
    row.push({ f: `${finalCol}${rowNum}` }); rowMax.push(""); col++;
    row.push({ f: `${finalCol}${rowNum}*0.5` }); rowMax.push(""); col++;
    row.push({ f: `(${midCol}${rowNum}*0.5)+(${finalCol}${rowNum}*0.5)` }); rowMax.push("");

    // collect max row
    rowMax.forEach((v, i) => {
      if (!allMaxValues[i]) allMaxValues[i] = v || "";
    });

    XLSX.utils.sheet_add_aoa(ws, [row], { origin: rowIndex++ });

  });

  // ================= MAX ROW =================
  XLSX.utils.sheet_add_aoa(ws, [allMaxValues], { origin: { r: 4, c: 3 } });

  let fixCol = START_COL;

  // ===== MIDTERM =====
  categories.forEach(cat => {

    const max = getMaxScores(students, "MIDTERM PERIOD", cat);

    const start = fixCol;
    const end = fixCol + max - 1;
    const perCol = end + 1;

    if (max > 0) {
      const ref = XLSX.utils.encode_cell({ r: 4, c: perCol });

      ws[ref] = {
        t: "n",
        f: `SUM(${colLetter(start)}5:${colLetter(end)}5)`
      };
    }

    fixCol += max + 3;
  });

  // spacer (IMPORTANT — matches your layout)
  fixCol++;
  fixCol++;

  // ===== FINAL =====
  categories.forEach(cat => {

    const realCat = cat === "MIDTERM EXAM" ? "FINAL EXAM" : cat;

    const max = getMaxScores(students, "FINAL PERIOD", realCat);

    const start = fixCol;
    const end = fixCol + max - 1;
    const perCol = end + 1;

    if (max > 0) {
      const ref = XLSX.utils.encode_cell({ r: 4, c: perCol });

      ws[ref] = {
        t: "n",
        f: `SUM(${colLetter(start)}5:${colLetter(end)}5)`
      };
    }

    fixCol += max + 3;
  });

  ws[XLSX.utils.encode_cell({ r: 2, c: colMG })] = { t: "s", v: "Midterm Period" };
  ws[XLSX.utils.encode_cell({ r: 2, c: colFG })] = { t: "s", v: "Final Period" };
  ws[XLSX.utils.encode_cell({ r: 2, c: colFG50 + 1 })] = { t: "s", v: "FINAL GRADE" };
  ws[XLSX.utils.encode_cell({ r: 4, c: colMG })] = { t: "s", v: "MG" };
  ws[XLSX.utils.encode_cell({ r: 4, c: colMG50 })] = { t: "s", v: "50%" };
  ws[XLSX.utils.encode_cell({ r: 4, c: colFG })] = { t: "s", v: "FG" };
  ws[XLSX.utils.encode_cell({ r: 4, c: colFG50 })] = { t: "s", v: "50%" };

  // ================= STYLES =================

  const range = XLSX.utils.decode_range(ws["!ref"]);

  // ===== IDENTIFY IMPORTANT COLUMNS =====
  let ptr = START_COL;

  // MIDTERM BLOCKS
  categories.forEach(cat => {
    const max = getMaxScores(students, "MIDTERM PERIOD", cat);
    ptr += max + 3;
  });

  const midGradeCol = ptr;
  ptr++;

  const spacer1 = ptr;
  ptr++;

  // FINAL BLOCKS
  categories.forEach(cat => {
    const realCat = cat === "MIDTERM EXAM" ? "FINAL EXAM" : cat;
    const max = getMaxScores(students, "FINAL PERIOD", realCat);
    ptr += max + 3;
  });

  const finalGradeCol = ptr;
  ptr++;

  const spacer2 = ptr;

  const summaryFinalCol = colFINAL;

  // ================= MAIN LOOP =================

  let paintPtr = START_COL;

  for (let R = range.s.r; R <= range.e.r; R++) {
    let C = range.s.c;

    // ===== LOOP THROUGH ALL COLUMNS =====
    while (C <= range.e.c) {

      const ref = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[ref]) {
        C++;
        continue;
      }

      const isHeader = R >= 1 && R <= 4;
      const isName = (C === 1 || C === 2);
      const isColA = (C === 0);
      const isSpacer = (C === spacer1 || C === spacer2);

      let style = {
        alignment: { horizontal: isName ? "left" : "center", vertical: "center", }
      };

      // ===== MIDTERM + FINAL BLOCK COLORING =====
      let ptr = START_COL;

      const applyCategoryColors = (period) => {
        categories.forEach(cat => {

          const realCat = (period === "FINAL PERIOD" && cat === "MIDTERM EXAM") ? "FINAL EXAM" : cat;

          const max = getMaxScores(students, period, realCat);

          // 🔵 SCORE (BLUE)
          /*for (let i = 0; i < max; i++) {
            if (C === ptr + i && !isHeader) {
              style.fill = {
                patternType: "solid",
                fgColor: { rgb: "BDD7EE" }
              };
            }
          }*/

          // 🟡 PERCENT
          if (C === ptr + max && !isHeader) {
            style.fill = { patternType: "solid", fgColor: { rgb: "B7DEE8" } };
          }

          // 🔴 TRANSMUTATION
          if (C === ptr + max + 1 && !isHeader) {
            style.fill = { patternType: "solid", fgColor: { rgb: "B7DEE8" } };
          }

          // 🟣 WEIGHTED
          if (C === ptr + max + 2 && !isHeader) {
            style.fill = { patternType: "solid", fgColor: { rgb: "FFFF00" } };
          }

          ptr += max + 3;
        });
      };

      // APPLY BOTH PERIODS
      applyCategoryColors("MIDTERM PERIOD");

      // MIDTERM GRADE
      /*const midGradeCol = ptr;
      if (C === midGradeCol && !isHeader) {
        style.fill = { patternType: "solid", fgColor: { rgb: "FBD5B5" } };
        style.font = { bold: true };
      }*/
      // MIDTERM PERIOD GRADE
      const midRef = XLSX.utils.encode_cell({ r: 2, c: midEnd + 1 });
      if (ws[midRef]) {
        ws[midRef].s = {
          ...(ws[midRef].s || {}),
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          font: { bold: true }
        };
      }

      const midGradeCol = ptr;
      if (C === midGradeCol && !isHeader) {
        style.fill = {
          patternType: "solid",
          fgColor: { rgb: "FBD5B5" }
        };
        style.font = { bold: true };
      }

      ptr += 2; // grade + spacer

      applyCategoryColors("FINAL PERIOD");

      // FINAL GRADE
      /*const finalGradeCol = ptr;
      if (C === finalGradeCol && !isHeader) {
        style.fill = { patternType: "solid", fgColor: { rgb: "FBD5B5" } };
        style.font = { bold: true };
      }*/
      // FINAL PERIOD GRADE
      const finalRef = XLSX.utils.encode_cell({ r: 2, c: finalEnd + 1 });
      if (ws[finalRef]) {
        ws[finalRef].s = {
          ...(ws[finalRef].s || {}),
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          font: { bold: true }
        };
      }

      const finalGradeCol = ptr;
      if (C === finalGradeCol && !isHeader) {
        style.fill = {
          patternType: "solid",
          fgColor: { rgb: "FBD5B5" }
        };
        style.font = { bold: true };
      }

      ptr += 2;

      // SUMMARY FINAL GRADE (WRAP)
      const summaryRef = XLSX.utils.encode_cell({ r: 2, c: colFINAL });
      if (ws[summaryRef]) {
        ws[summaryRef].s = {
          ...(ws[summaryRef].s || {}),
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          font: { bold: true }
        };
      }

      // ===== HEADER STYLE =====
      /*if (isHeader && !isSpacer) {
        style.fill = { patternType: "solid", fgColor: { rgb: "A5A5A5" } };
        style.font = { bold: true };
      }*/
      if (!isSpacer) {

        const isRow1 = R === 1;
        const isRow2 = R === 2;
        const isRow5 = R === 4; // ✅ Per VALUE row

        const cellValue = ws[ref]?.v || "";
        const isWeight = String(cellValue).includes("%");

        const isGradeCol = C === midGradeCol || C === finalGradeCol;

        const isSummaryMain = C === colMG || C === colFG || C === colFINAL;

        // ===== DETECT PER COLUMN =====
        let isPerValue = false;
        let ptrCheck = START_COL;

        // MIDTERM
        categories.forEach(cat => {
          const max = getMaxScores(students, "MIDTERM PERIOD", cat);
          const perCol = ptrCheck + max;

          if (C === perCol && isRow5) {
            isPerValue = true;
          }

          ptrCheck += max + 3;
        });

        ptrCheck += 2;

        // FINAL
        categories.forEach(cat => {
          const realCat = cat === "MIDTERM EXAM" ? "FINAL EXAM" : cat;
          const max = getMaxScores(students, "FINAL PERIOD", realCat);
          const perCol = ptrCheck + max;

          if (C === perCol && isRow5) {
            isPerValue = true;
          }

          ptrCheck += max + 3;
        });

        // ===== HEADER COLOR =====
        if (isHeader) {
          style.fill = { patternType: "solid", fgColor: { rgb: "A5A5A5" } };
        }

        // ===== FINAL BOLD RULE =====
        if (isRow1 || isRow2 || isWeight || isGradeCol || isSummaryMain || isPerValue) {
          style.font = { bold: true };
        } else {
          style.font = { bold: false };
        }
      }

      // ===== BORDERS =====
      if (!isColA && !isSpacer) {
        style.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      }

      if (isName) {
        style.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      }

      // ===== SUMMARY COLORS and BOLD STYLES=====
      // MIDTERM PERIO GRADE + FINAL PERIOD GRADE
      if ((C === midGradeCol || C === finalGradeCol) && !isHeader) {
        style.font = { ...(style.font || {}), bold: true, sz: 12 };
      }

      // MG
      if (C === colMG && !isHeader) {
        style.fill = { patternType: "solid", fgColor: { rgb: "FCD5B4" } };
      }

      // 50% (mid)
      if (C === colMG50 && !isHeader) {
        style.fill = { patternType: "solid", fgColor: { rgb: "FFFF00" } };
      }

      // FG
      if (C === colFG && !isHeader) {
        style.fill = { patternType: "solid", fgColor: { rgb: "FCD5B4" } };
      }

      // 50% (final)
      if (C === colFG50 && !isHeader) {
        style.fill = { patternType: "solid", fgColor: { rgb: "FFFF00" } };
      }

      // FINAL GRADE
      if (C === colFINAL && !isHeader) {
        style.fill = { patternType: "solid", fgColor: { rgb: "B1A0C7" } };
        style.font = { ...(style.font || {}), bold: true, sz: 13 };
      }

      ws[ref].s = style;

      C++;
    }
  }

  // ================= 🔥 FIX SUMMARY (PLACE HERE) =================
  for (let R = 1; R <= range.e.r; R++) {
    for (let C = colMG; C <= colFINAL; C++) {

      const ref = XLSX.utils.encode_cell({ r: R, c: C });

      // ✅ ensure cell exists
      if (!ws[ref]) {
        ws[ref] = { t: "s", v: "" };
      }

      ws[ref].s = {
        ...(ws[ref].s || {}),
        border: {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" }
        }
      };
    }
  }

  // ===== NUMBER FORMATTING =====
  const range2 = XLSX.utils.decode_range(ws["!ref"]);

  for (let R = 5; R <= range2.e.r; R++) {
    for (let C = START_COL; C <= range2.e.c; C++) {

      const ref = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[ref]) continue;

      // DEFAULT → NO DECIMALS
      ws[ref].z = "0";

    }
  }

  // ===== APPLY 1 DECIMAL PLACES =====
  let formatCol = START_COL;

  // ===== MIDTERM =====
  categories.forEach(cat => {

    const max = getMaxScores(students, "MIDTERM PERIOD", cat);

    // move to next block
    formatCol += max + 3;
  });

  // MIDTERM GRADE COLUMN
  const midGradeColIndex = formatCol;

  // apply 1 decimal
  for (let R = 5; R <= range.e.r; R++) {
    const ref = XLSX.utils.encode_cell({ r: R, c: midGradeColIndex });
    if (ws[ref]) ws[ref].z = "0.0";
  }

  formatCol++;

  // spacer
  formatCol++;

  // ===== FINAL =====
  categories.forEach(cat => {

    const realCat = cat === "MIDTERM EXAM" ? "FINAL EXAM" : cat;
    const max = getMaxScores(students, "FINAL PERIOD", realCat);

    formatCol += max + 3;
  });

  // FINAL PERIOD GRADE COLUMN
  const finalGradeColIndex = formatCol;

  // apply 1 decimal
  for (let R = 5; R <= range.e.r; R++) {
    const ref = XLSX.utils.encode_cell({ r: R, c: finalGradeColIndex });
    if (ws[ref]) ws[ref].z = "0.0";
  }

  formatCol++;

  // spacer before summary
  formatCol++;

  // ===== FINAL GRADE (SUMMARY) =====
  const finalColIndex = formatCol + 4; // MG,50,FG,50 → FINAL

  for (let R = 5; R <= range.e.r; R++) {
    const ref = XLSX.utils.encode_cell({ r: R, c: finalColIndex });
    if (ws[ref]) ws[ref].z = "0.0";
  }

  // ===== COLUN SIZING =====
  //const range = XLSX.utils.decode_range(ws["!ref"]);

  ws["!cols"] = [];

  // loop all columns
  for (let C = 0; C <= range.e.c; C++) {

    let width = 5.38; // default

    if (C === 0 || C === spacer2) {
      width = 1.5;
    }

    // NAME columns
    if (C === 1) {
      width = 14.63;
    } else if (C === 2) {
      width = 29.38;
    }

    // SPACER columns
    if (C === spacer1) {
      width = 6.38;
    }

    // FINAL GRADE columns (important)
    if (C === midGradeCol || C === finalGradeCol || C === colFINAL) {
      width = 5.38;
    }

    ws["!cols"][C] = { wch: width };
  }

  // ================= LEGEND (FINAL - DYNAMIC) =================
  const finalRange = XLSX.utils.decode_range(ws["!ref"]);

  const legendCol = finalRange.e.c + 2;
  const labelCol = legendCol + 1;
  const valueCol = legendCol + 2;

  const startRow = 6;

  ws[XLSX.utils.encode_cell({ r: startRow, c: legendCol })] = {
    t: "s",
    v: "Legend"
  };

  const legendData = [
    ["MG-", "Midterm Grade"],
    ["FPG-", "Final Period Grade"],
    ["Per", "Percentile"],
    ["Trans-", "Transmutation"]
  ];

  legendData.forEach((row, i) => {
    const r = startRow + 1 + i;

    ws[XLSX.utils.encode_cell({ r, c: labelCol })] = { t: "s", v: row[0] };
    ws[XLSX.utils.encode_cell({ r, c: valueCol })] = { t: "s", v: row[1] };
  });

  legendData.forEach((row, i) => {
    const r = startRow + 1 + i;

    const labelRef = XLSX.utils.encode_cell({ r, c: labelCol });
    const valueRef = XLSX.utils.encode_cell({ r, c: valueCol });

    const isMain = row[0] === "MG-" || row[0] === "FPG-";

    // LABEL (BD)
    if (ws[labelRef]) {
      ws[labelRef].s = {
        alignment: { horizontal: "left" },
        font: { bold: isMain }
      };
    }

    // VALUE (BE)
    if (ws[valueRef]) {
      ws[valueRef].s = {
        alignment: { horizontal: "left" }
      };
    }
  });

  const newEndCol = valueCol;
  const newEndRow = startRow + legendData.length + 1;

  const updatedRange = XLSX.utils.decode_range(ws["!ref"]);

  updatedRange.e.c = Math.max(updatedRange.e.c, newEndCol);
  updatedRange.e.r = Math.max(updatedRange.e.r, newEndRow);

  ws["!ref"] = XLSX.utils.encode_range(updatedRange);

  ws["!cols"][legendCol] = { wch: 12 };
  ws["!cols"][labelCol] = { wch: 10 };
  ws["!cols"][valueCol] = { wch: 28 };

  // ================= COLUMN GROUPING =================
  // ensure !cols exists
  if (!ws["!cols"]) ws["!cols"] = [];

  // ===== MIDTERM GROUP =====
  for (let c = midStart; c <= midEnd + 1; c++) {
    if (!ws["!cols"][c]) ws["!cols"][c] = {};
    ws["!cols"][c].level = 1;
  }

  // ===== FINAL GROUP =====
  for (let c = finalStart; c <= finalEnd + 1; c++) {
    if (!ws["!cols"][c]) ws["!cols"][c] = {};
    ws["!cols"][c].level = 1;
  }

  // ===== SUMMARY GROUP =====
  for (let c = colMG; c <= colFINAL; c++) {
    if (!ws["!cols"][c]) ws["!cols"][c] = {};
    ws["!cols"][c].level = 1;
  }

  // ================= TRANSMUTATION =================
  const transSheet = XLSX.utils.aoa_to_sheet([]);

  // ✅ COMPLETE TRANSMUTATION TABLE (MAJOR + MINOR)
  const major = {
    0: 65, 1: 65, 2: 65, 3: 65, 4: 65, 5: 65, 6: 65, 7: 65, 8: 65, 9: 65, 10: 65,
    11: 65, 12: 65, 13: 65, 14: 65, 15: 65, 16: 65, 17: 65, 18: 65, 19: 65, 20: 65,
    21: 66, 22: 66, 23: 66, 24: 66, 25: 67, 26: 67, 27: 67, 28: 67, 29: 68, 30: 68,
    31: 68, 32: 68, 33: 69, 34: 69, 35: 69, 36: 69, 37: 70, 38: 70, 39: 70, 40: 70,
    41: 71, 42: 71, 43: 71, 44: 71, 45: 72, 46: 72, 47: 72, 48: 72, 49: 72, 50: 73,
    51: 73, 52: 73, 53: 73, 54: 73, 55: 74, 56: 74, 57: 74, 58: 74, 59: 74, 60: 75,
    61: 76, 62: 76, 63: 77, 64: 77, 65: 78, 66: 78, 67: 79, 68: 79, 69: 80, 70: 80,
    71: 81, 72: 81, 73: 82, 74: 82, 75: 83, 76: 83, 77: 84, 78: 84, 79: 85, 80: 85,
    81: 86, 82: 86, 83: 87, 84: 87, 85: 88, 86: 88, 87: 89, 88: 89, 89: 90, 90: 90,
    91: 91, 92: 91, 93: 92, 94: 92, 95: 93, 96: 93, 97: 94, 98: 94, 99: 95, 100: 95
  };

  const minor = {
    0: 65, 1: 65, 2: 65, 3: 65, 4: 65, 5: 65, 6: 65, 7: 65, 8: 65, 9: 65, 10: 65,
    11: 65, 12: 65, 13: 65, 14: 65, 15: 65, 16: 66, 17: 66, 18: 66, 19: 67, 20: 67,
    21: 67, 22: 68, 23: 68, 24: 68, 25: 68, 26: 69, 27: 69, 28: 69, 29: 69, 30: 70,
    31: 70, 32: 70, 33: 70, 34: 71, 35: 71, 36: 71, 37: 71, 38: 72, 39: 72, 40: 72,
    41: 72, 42: 73, 43: 73, 44: 73, 45: 73, 46: 74, 47: 74, 48: 74, 49: 74, 50: 75,
    51: 76, 52: 76, 53: 77, 54: 77, 55: 78, 56: 78, 57: 79, 58: 79, 59: 80, 60: 80,
    61: 81, 62: 81, 63: 82, 64: 82, 65: 83, 66: 83, 67: 84, 68: 84, 69: 85, 70: 85,
    71: 86, 72: 86, 73: 86, 74: 87, 75: 87, 76: 87, 77: 88, 78: 88, 79: 88, 80: 89,
    81: 89, 82: 89, 83: 90, 84: 90, 85: 90, 86: 91, 87: 91, 88: 91, 89: 92, 90: 92,
    91: 92, 92: 93, 93: 93, 94: 93, 95: 94, 96: 94, 97: 94, 98: 95, 99: 95, 100: 95
  };

  const transData = [["", "BASE 60 (Major Subject)", "", "", "", "BASE 50 (Minor Subject)"],
  ["", "RAW SCORE", "RATE", "", "", "RAW SCORE", "RATE"]];

  for (let i = 0; i <= 100; i++) {
    transData.push(["", i, major[i], "", "", i, minor[i]]);
  }

  XLSX.utils.sheet_add_aoa(transSheet, transData);

  // ================= SAVE =================
  XLSX.utils.book_append_sheet(wb, ws, "Grades");
  XLSX.utils.book_append_sheet(wb, transSheet, "Transmutation");
}

/*******************************************************
* function name: exportCSV
* parameter: 
* return: 
* purpose: Export grading data into LONG CSV format
********************************************************/
function exportCSV(students, base = 60) {

  if (!students || students.length === 0) {
    hideLoading();
    toast("No data");
    return;
  }

  //console.log("students: ", students);

  let rows = [];

  // 🔷 SORT STUDENTS (A → Z by LAST NAME, then FIRST NAME)
  students.sort((a, b) => {

    const fullA = (a["lastname,firstnamem.i."] || "").toUpperCase();
    const fullB = (b["lastname,firstnamem.i."] || "").toUpperCase();

    const [lastA = "", firstA = ""] = fullA.split(",");
    const [lastB = "", firstB = ""] = fullB.split(",");

    // Compare last name first
    if (lastA < lastB) return -1;
    if (lastA > lastB) return 1;

    // If same last name, compare first name
    if (firstA < firstB) return -1;
    if (firstA > firstB) return 1;

    return 0;
  });

  // 🔷 METADATA (VERY IMPORTANT) 
  rows.push([`BASE=${base}`]);

  // 🔷 HEADER 
  rows.push([
    "StudentID",
    "LastName",
    "FirstName",
    "Course/Subject",
    "Period",
    "Category",
    "Item",
    "Score",
    "MaxScore"
  ]);

  // 🔷 DATA (FLAT FORMAT) 
  students.forEach(s => {

    const full = (s["lastname,firstnamem.i."] || "").toUpperCase();
    const [last, first] = full.split(",");

    (s.grades || []).forEach((g, index) => {

      rows.push([
        s.studentidnumber || "",
        last || "",
        first || "",
        g.courseSubject || "",
        g.period || "",
        g.category || "",
        index + 1,
        g.score ?? "",
        g.max ?? ""
      ]);

    });

  });

  // 🔷 CSV STRING 
  const csvContent = rows.map(r => r.join(",")).join("\n");

  // 🔷 DOWNLOAD 
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = "grades_data.csv";
  link.click();

  hideLoading();
}

/*******************************************************
* function name: updateExportUI
* parameter: 
* return: 
* purpose: 
********************************************************/
function updateExportUI() {
  const scope = document.getElementById("exportScope").value;

  document.getElementById("exportCourseWrap").classList.toggle("hidden", scope !== "section");

  document.getElementById("exportStudentWrap").classList.toggle("hidden", scope !== "student");
}

/*******************************************************
* function name: initExportForm
* parameter: 
* return: 
* purpose: 
********************************************************/
async function initExportForm() {

  /*const res = await apiGet({
    action: "exportGrades",
    schoolYear: state.filters.schoolYear || "",
    term: state.filters.term || "",
    idToken: state.idToken
  });*/
  const res = await apiPost("exportGrades", {
    schoolYear: state.filters.schoolYear || "",
    term: state.filters.term || ""
  });

  if (res?.status === "success") {
    ALL_STUDENTS = res.items || [];

    // ✅ load BOTH immediately
    loadCourses(ALL_STUDENTS);
    loadStudents(ALL_STUDENTS);
  }
}

/*******************************************************
* function name: loadCourses
* parameter: 
* return: 
* purpose: 
********************************************************/
function loadCourses(students) {
  const select = document.getElementById("exportCourse");

  // clear
  select.innerHTML = `<option value="">Select Course</option>`;

  const courses = [...new Set(students.map(s => s["course(subject)"]).filter(Boolean))].sort();

  courses.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  });
}

/*******************************************************
* function name: loadStudents
* parameter: 
* return: 
* purpose: 
********************************************************/
function loadStudents(students) {
  const select = document.getElementById("exportStudent");

  select.innerHTML = `<option value="">Select Student</option>`;

  let filtered = students; // ✅ ALWAYS DEFINED

  const scope = document.getElementById("exportScope")?.value;
  const selectedCourse = document.getElementById("exportCourse")?.value;

  // ✅ ONLY filter when NOT single student
  if (scope !== "student" && selectedCourse) {
    filtered = students.filter(s =>
      String(s["course(subject)"]).trim().toUpperCase() ===
      String(selectedCourse).trim().toUpperCase()
    );
  }

  // ✅ sort
  filtered.sort((a, b) => {
    const nameA = (a["lastname,firstnamem.i."] || "").toUpperCase();
    const nameB = (b["lastname,firstnamem.i."] || "").toUpperCase();
    return nameA.localeCompare(nameB);
  });

  filtered.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s["lastname,firstnamem.i."];
    opt.textContent = s["lastname,firstnamem.i."];
    select.appendChild(opt);
  });
}

/*******************************************************
* function name: getSafe
* parameter: 
* return: 
* purpose: 
********************************************************/
function getSafe(grades, period, category) {
  const p = normalize(period);
  const c = normalize(category);

  return (grades[p] && grades[p][c]) ? grades[p][c] : 0;
}

/*******************************************************
* function name: computePeriodFromGrades
* parameter: 
* return: 
* purpose: 
********************************************************/
function computePeriodFromGrades(grades, period) {
  const p = normalize(period);
  const categories = grades[p] || {};

  const weights = gradeWeights?.[period] || {};
  let total = 0;

  Object.keys(weights).forEach(cat => {
    const g = categories[normalize(cat)] || 0;
    total += g * weights[cat];
  });

  return total;
}

/*******************************************************
* function name: computeDistribution
* parameter: 
* return: 
* purpose: 
********************************************************/
function computeDistribution(transmuted, weight) {
  return transmuted * weight;
}

/*******************************************************
* function name: getMaxTasksMap
* parameter: 
* return: 
* purpose: 
********************************************************/
function getMaxTasksMap(students) {
  const map = {};

  students.forEach(s => {
    const tasks = Array.isArray(s.grades) ? s.grades : [];

    tasks.forEach(t => {
      const period = normalize(t.period || "").includes("FINAL")
        ? "FINAL PERIOD"
        : "MIDTERM PERIOD";

      let category = normalize(t.category || "");
      if (category.includes("aug")) category = "AUGUSTINIAN VALUE";
      if (category === "exam" && period === "MIDTERM PERIOD") category = "MIDTERM EXAM";
      if (category === "exam" && period === "FINAL PERIOD") category = "FINAL EXAM";

      const key = `${period}|${category}`;

      if (!map[key]) map[key] = 0;

      const count = tasks.filter(x => {
        const p = normalize(x.period || "").includes("FINAL")
          ? "FINAL PERIOD"
          : "MIDTERM PERIOD";

        let c = normalize(x.category || "");
        if (c.includes("aug")) c = "AUGUSTINIAN VALUE";
        if (c === "exam" && p === "MIDTERM PERIOD") c = "MIDTERM EXAM";
        if (c === "exam" && p === "FINAL PERIOD") c = "FINAL EXAM";

        return p === period && c === category;
      }).length;

      map[key] = Math.max(map[key], count);
    });
  });

  return map;
}

/*******************************************************
* function name: buildHeader
* parameter: 
* return: 
* purpose: 
********************************************************/
function buildHeader(maxMap) {

  const header = ["Student Name"];

  const categories = [
    ["MIDTERM PERIOD", "AUGUSTINIAN VALUE"],
    ["MIDTERM PERIOD", "QUIZ"],
    ["MIDTERM PERIOD", "MIDTERM EXAM"],
    ["MIDTERM PERIOD", "CLASS PARTICIPATION"],

    ["FINAL PERIOD", "AUGUSTINIAN VALUE"],
    ["FINAL PERIOD", "QUIZ"],
    ["FINAL PERIOD", "FINAL EXAM"],
    ["FINAL PERIOD", "CLASS PARTICIPATION"]
  ];

  categories.forEach(([period, cat]) => {

    const key = `${period}|${cat}`;
    const max = maxMap[key] || 0;

    // 🔥 dynamic score columns
    for (let i = 1; i <= max; i++) {
      header.push(`${cat} ${i}`);
    }

    // fixed columns
    header.push(`${cat} %`);
    header.push(`${cat} Trans`);
    header.push(`${cat} W`);
  });

  header.push("Final Grade");

  return header;
}

/*******************************************************
* function name: extractCategory
* parameter: 
* return: 
* purpose: 
********************************************************/
function extractCategory(tasks, period, category) {

  const list = tasks.filter(t => {
    const p = normalize(t.period || "").includes("FINAL")
      ? "FINAL PERIOD"
      : "MIDTERM PERIOD";

    let c = normalize(t.category || "");
    if (c.includes("aug")) c = "AUGUSTINIAN VALUE";
    if (c === "exam" && p === "MIDTERM PERIOD") c = "MIDTERM EXAM";
    if (c === "exam" && p === "FINAL PERIOD") c = "FINAL EXAM";

    return p === period && c === category;
  });

  let scores = [];
  let totalScore = 0;
  let totalMax = 0;

  list.forEach(t => {
    const score = Number(t.score || 0);
    const max = Number(t.max || 0);

    scores.push(score);
    totalScore += score;
    totalMax += max;
  });

  const percent = totalMax ? (totalScore / totalMax) * 100 : 0;
  const trans = transmute(percent, state.subjectType);
  const weight = gradeWeights?.[period]?.[category] || 0;
  const weighted = trans * weight;

  return {
    scores,
    percent,
    trans,
    weighted
  };
}

/*******************************************************
* function name: preloadExportData
* parameter: none
* return: -
* purpose: -
*******************************************************/
async function preloadExportData() {
  if (state.exportData.loaded) return;

  /*const res = await apiGet({
    action: "exportGrades",
    schoolYear: state.filters.schoolYear || "",
    term: state.filters.term || "",
    program: state.filters.program || "",
    section: state.filters.block || "",
    idToken: state.idToken
  });*/
  const res = await apiPost("exportGrades", {
    schoolYear: state.filters.schoolYear || "",
    term: state.filters.term || "",
    program: state.filters.program || "",
    section: state.filters.block || ""
  });

  if (!res || res.status !== "success") return;


  const items = res.items || [];

  const courses = new Set();
  const students = new Set();

  items.forEach(s => {
    const course = (s.courseSubject || s["course(subject)"] || "").trim();
    const name = (s["lastname,firstnamem.i."] || "").trim().toUpperCase();

    if (course) courses.add(course);
    if (name) students.add(name);
  });

  state.exportData.courses = [...courses].sort();
  state.exportData.students = [...students].sort();
  state.exportData.loaded = true;
}

/*******************************************************
* function name: populateExportDropdown
* parameter: list
* return: -
* purpose: -
*******************************************************/
function populateExportDropdown(selectId, list) {
  const select = document.getElementById(selectId);
  const current = select.value;

  select.innerHTML = '<option value="">-- Select --</option>';

  list.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });

  if (list.includes(current)) {
    select.value = current;
  }
}

/*******************************************************
* function name: exportStudentListCSV
* parameter: list
* return: -
* purpose: -
*******************************************************/
function exportStudentListCSV(students) {

  if (!students.length) {
    toast("No data to export");
    return;
  }

  // ---------------------------------------
  // STEP 1: REMOVE DUPLICATES
  // ---------------------------------------
  const map = new Map();

  students.forEach(s => {

    const studentId = s.studentId || s.studentid || s.studentnumber || s.studentidnumber || "";

    if (!studentId) return;

    // skip duplicates
    if (map.has(studentId)) return;

    // ---------------------------------------
    // STEP 2: PARSE NAME
    // format: "LASTNAME,FIRSTNAME M.I."
    // ---------------------------------------
    let full = String(s["lastname,firstnamem.i."] || "").trim().toUpperCase();

    let lastName = "";
    let firstName = "";

    if (full.includes(",")) {
      const parts = full.split(",");
      lastName = parts[0]?.trim() || "";
      firstName = parts[1]?.trim() || "";
    } else {
      firstName = full;
    }

    const course = String(s.courseSubject || s["course(subject)"] || "").trim();

    map.set(studentId, {
      studentId,
      lastName,
      firstName,
      course
    });

  });

  const list = Array.from(map.values());

  // ---------------------------------------
  // STEP 3: BUILD CSV
  // ---------------------------------------
  let csv = "StudentID,LastName,FirstName,Course/Subject\n";

  list.forEach(s => {
    csv += [
      s.studentId,
      s.lastName,
      s.firstName,
      s.course
    ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",") + "\n";
  });

  // ---------------------------------------
  // STEP 4: DOWNLOAD
  // ---------------------------------------
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "student_list.csv";
  a.click();

  URL.revokeObjectURL(url);
}

/* ===========================
   ON SCOPE CHANGE
=========================== */
function onExportScopeChange(scope) {

  //console.log("scope: ", scope);
  if (scope === "section") {
    populateExportDropdown("exportCourse", state.exportData.courses);
    //console.log("state.exportData.courses: ", state.exportData.courses);
  }

  if (scope === "student") {
    populateExportDropdown("exportStudent", state.exportData.students);
    //console.log("state.exportData.students: ", state.exportData.students);
  }
}

/* ======================================================
   APP SYSTEM / CORE STATE MANAGEMENT
====================================================== */
/* ===========================
   Global State
=========================== */


/* ===========================
   App Reset
=========================== */
/*******************************************************
* function name: resetApp
* parameter: none
* return: -
* purpose: Clears all IndexedDB caches and evidence storage, resets major state containers, shows reset notification, and navigates UI back to config screen.
*******************************************************/
async function resetApp() {
  await cacheClearAll();
  await deleteEvidenceDB();
  state.selected = null;
  state.list.items = [];
  state.list.total = 0;
  state.seat = { room: "", editMode: false, seats: [], masterStudents: [], editingSeat: null };
  toast("Cache cleared. Logging out.");
  showScreen(screenConfig);
  forceLogout();
}

/* ======================================================
   UI HELPERS (Generic)
====================================================== */
/*******************************************************
* function name: escapeHtml
* parameter: str (string)
* return: string
* purpose: Escapes special HTML characters in a string to prevent HTML injection when rendering dynamic text in the UI.
********************************************************/
function escapeHtml(str) {

  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/*******************************************************
* function name: toast
* parameter: msg (any)
* return: void
* purpose: Displays a simple user notification using alert with basic error protection.
********************************************************/
/*function toast(msg) {

  try {
    toast(String(msg));
  } catch (e) {
    console.error("toast failed:", e);
  }
}*/
function toast(msg) {

  try {

    const text = String(msg || "");

    // fallback if no UI yet
    if (!window._toastEl) {

      const el = document.createElement("div");
      el.style.position = "fixed";
      el.style.bottom = "20px";
      el.style.left = "50%";
      el.style.transform = "translateX(-50%)";
      el.style.background = "#111";
      el.style.color = "#fff";
      el.style.padding = "10px 16px";
      el.style.borderRadius = "8px";
      el.style.fontSize = "14px";
      el.style.zIndex = "999999";
      el.style.opacity = "0";
      el.style.transition = "opacity 0.3s ease";

      document.body.appendChild(el);
      window._toastEl = el;
    }

    const el = window._toastEl;

    el.textContent = text;
    el.style.opacity = "1";

    clearTimeout(el._timer);

    el._timer = setTimeout(() => {
      el.style.opacity = "0";
    }, 2500);

  } catch (e) {
    console.error("toast failed:", e);
  }
}

/*******************************************************
* function name: fillSelect
* parameter: selectEl (HTMLSelectElement), items (array)
* return: void
* purpose: Populates a select dropdown element with a blank option plus provided item values.
********************************************************/
function fillSelect(selectEl, items) {

  if (!selectEl) return;

  selectEl.innerHTML = "";

  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "-- Select --";
  selectEl.appendChild(blank);

  (items || []).forEach(v => {
    const opt = document.createElement("option");
    opt.value = v === "(Blank)" ? "" : v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
}

/*******************************************************
* function name: clearRemarksBox
* parameter: none
* return: void
* purpose: Clears the remarks textarea input field in the details view.
********************************************************/
function clearRemarksBox() {

  const el = document.getElementById("dRemarks");
  if (el) el.value = "";
}

/*******************************************************
* function name: toggleAccordion
* parameter: bodyEl (HTMLElement), arrowEl (HTMLElement)
* return: void
* purpose: Toggles accordion section visibility and arrow indicator state.
********************************************************/
function toggleAccordion(bodyEl, arrowEl) {

  if (!bodyEl || !arrowEl) return;

  const isHidden = bodyEl.classList.contains("hidden");
  if (isHidden) {
    bodyEl.classList.remove("hidden");
    arrowEl.textContent = "▴";
  } else {
    bodyEl.classList.add("hidden");
    arrowEl.textContent = "▾";
  }
}

/*******************************************************
* function name: showLoading
* parameter: msg (string)
* return: void
* purpose: Displays the global loading overlay with optional message text.
********************************************************/
function showLoading(msg = "Loading...") {
  const el = document.getElementById("globalLoading");
  if (!el) return;

  const txt = el.querySelector(".loadingText");
  if (txt) txt.textContent = msg;

  el.classList.remove("hidden");
}

/*******************************************************
* function name: hideLoading
* parameter: none
* return: void
* purpose: Hides the global loading overlay.
********************************************************/
function hideLoading() {
  const el = document.getElementById("globalLoading");
  if (!el) return;
  el.classList.add("hidden");
}

/* ======================================================
   MODAL SYSTEM
====================================================== */
/*******************************************************
* function name: openModal
* parameter: modalEl (HTMLElement)
* return: void
* purpose: Shows a modal element by removing its hidden class.
********************************************************/
function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.remove("hidden");
}

/*******************************************************
* function name: closeModal
* parameter: modalEl (HTMLElement)
* return: void
* purpose: Hides a modal element by adding its hidden class.
********************************************************/
function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.add("hidden");
}

/*******************************************************
* function name: attachModalBackdropClose
* parameter: modalEl (HTMLElement)
* return: void
* purpose: Attaches a backdrop click handler to a modal so clicking outside content closes it.
********************************************************/
function attachModalBackdropClose(modalEl) {
  if (!modalEl) return;
  modalEl.onclick = (e) => {
    if (e.target === modalEl) closeModal(modalEl);
  };
}

/*******************************************************
* function name: closePdfModal
* parameter: none
* return: -
* purpose: Closes the PDF preview modal and clears the iframe source to release the loaded document.
*******************************************************/
function closePdfModal() {
  pdfFrame.src = "";
  pdfModal.classList.add("hidden");
}

/*******************************************************
* function name: applyModalTransform
* parameter: none
* return: void
* purpose: Applies current zoom and pan transform values to the modal image element.
********************************************************/
function applyModalTransform() {

  const img = document.getElementById("modalPhoto");
  if (!img) return;
  img.style.transform = `translate(${modalZoom.x}px, ${modalZoom.y}px) scale(${modalZoom.scale})`;
}

/*******************************************************
* function name: openEvidenceFile
* parameter: url (string)
* return: void
* purpose: Opens an evidence file by routing PDFs to PDF modal and images to image modal viewer.
********************************************************/
function openEvidenceFile(url) {

  if (!url) {
    toast("No file available.");
    return;
  }

  // PDF → open new tab
  if (isPdfUrl(url)) {
    //window.open(url, "_blank", "noopener,noreferrer");
    openPdfModal(url);
    return;
  }

  // IMAGE → open modal
  openImageModalFromUrl(url);
}

/*******************************************************
* function name: openImageModalFromUrl
* parameter: url (string)
* return: void
* purpose: Opens image preview modal using either base64 data URL or converted Google Drive direct link.
********************************************************/
function openImageModalFromUrl(url) {

  if (!url) {
    toast("No file available.");
    return;
  }

  let fixed = String(url).trim();

  // If already BASE64 data URL
  if (fixed.startsWith("data:image/")) {
    if (modalPhoto) modalPhoto.src = fixed;
    if (photoModal) photoModal.classList.remove("hidden");
    return;
  }

  // Convert drive link to direct view
  const fileId = extractDriveFileId(fixed);
  if (fileId) {
    fixed = "https://drive.google.com/uc?export=view&id=" + fileId;
  }

  if (modalPhoto) modalPhoto.src = fixed;
  if (photoModal) photoModal.classList.remove("hidden");
}

/*******************************************************
* function name: openPdfModal
* parameter: previewUrl (string)
* return: void
* purpose: Opens the PDF preview modal and loads the given URL into the iframe viewer.
********************************************************/
function openPdfModal(previewUrl) {

  if (!pdfModal || !pdfFrame) return;
  pdfFrame.src = previewUrl;
  pdfModal.classList.remove("hidden");
}

/*******************************************************
* function name: resetModalZoom
* parameter: none
* return: void
* purpose: Resets modal image zoom and pan values to defaults and reapplies transform.
********************************************************/
function resetModalZoom() {

  modalZoom.scale = 1;
  modalZoom.x = 0;
  modalZoom.y = 0;
  applyModalTransform();
}

/* OBSOLETE */
/*******************************************************
* function name: isSessionValid
* parameter: none
* return: -
* purpose: -
*******************************************************/
/*function isSessionValid() {
  const token = localStorage.getItem("sf_id_token");
  const loginTime = Number(localStorage.getItem("sf_login_time") || 0);

  if (!token || !loginTime) return false;

  return (Date.now() - loginTime) < SESSION_MAX_AGE_MS;
}*/

btnClosePdf.onclick = closePdfModal;

// click outside to close
pdfModal.addEventListener("click", (e) => {
  if (e.target === pdfModal) closePdfModal();
});

/*******************************************************
* function name: getPendingQueue
* parameter: none
* return: -
* purpose: Reads and parses the pending offline sync queue from localStorage.
********************************************************/
function getPendingQueue() {
  return JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || "[]");
}

/*******************************************************
* function name: setPendingQueue
* parameter: arr (array)
* return: -
* purpose: Saves the pending offline sync queue array into localStorage.
********************************************************/
function setPendingQueue(arr) {
  localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(arr));
}

/*******************************************************
* function name: showScreen
* parameter: el (HTMLElement)
* return: -
* purpose: Switches visible UI screen by hiding all registered screens and showing the target element, updates related UI badges and buttons, tracks current screen state, and saves session snapshot.
********************************************************/
function showScreen(el) {
  const screens = [
    screenConfig,
    screenMenu,
    screenDash,
    screenFilters,
    screenList,
    screenDetails,
    screenSeatMap,
    screenExport,
    screenImport,
    tabContentGrades,
    tabContentLearnerDev
  ];

  screens.forEach(s => s && s.classList.add("hidden"));
  if (el) el.classList.remove("hidden");

  // hide grades
  //document.getElementById('tabContentGrades')?.classList.add('hidden');
  //document.getElementById('tabContentLearnerDev')?.classList.add('hidden');

  // ✅ FIX: hide Online badge when logged out (Setup/Login screen)
  if (el === screenConfig) {
    hideNetBadge();
  } else {
    showNetBadge();
  }

  // ✅ Track current screen for refresh restore
  if (el === screenMenu) {
    state.currentScreen = "menu";
    loadDashboard();
    document.getElementById("screenDash")?.classList.remove("hidden");
  }
  else if (el === screenFilters) state.currentScreen = "filters";
  else if (el === screenList) state.currentScreen = "list";
  else if (el === screenDetails) state.currentScreen = "details";
  else if (el === screenSeatMap) {   // ✅ update Delete Room button visibility ONLY when seat map is shown
    state.currentScreen = "seatmap";
    selSeatRoom.value = "";
    //await loadRooms();
    updateDeleteRoomButtonVisibility();
  }
  else if (el === screenExport) state.currentScreen = "export"
  else if (el === screenImport) state.currentScreen = "import"
  else if (el === screenConfig) state.currentScreen = "config"; //Log in
  //else state.currentScreen = "config";
  else state.currentScreen = "menu";
  /*else {
    state.currentScreen = "menu";
    loadList(true);
    document.getElementById("screenDash")?.classList.remove("hidden");
  }*/

  // ✅ Save session every time screen changes
  saveSession();
}

if (btnCloseSeatPreview && seatPreviewFloat) {
  btnCloseSeatPreview.addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();
    closeSeatPreview();
  });

  seatPreviewFloat.addEventListener("click", e => {
    e.stopPropagation();
  });
}

document.addEventListener("click", e => {
  if (!e.target.closest(".seat") &&
    !e.target.closest("#seatPreviewFloat") &&
    !e.target.closest(".seatPreviewMobile")) {
    closeSeatPreview();
  }
});

/*******************************************************
* function name: isMobile
* parameter: none
* return: -
* purpose: Detects whether the current viewport width is within mobile breakpoint threshold.
********************************************************/
function isMobile() {
  return window.innerWidth <= 768;
}

/*******************************************************
* function name: clearEvidenceFileInput
* parameter: none
* return: -
* purpose: Resets the evidence file input element so the same file can be selected again or to clear pending selection.
********************************************************/
function clearEvidenceFileInput() {

  //const inp = document.getElementById("inpEvidence");
  //if (inp) inp.value = "";
  if (inpEvidenceFile) inpEvidenceFile.value = "";
}

/*******************************************************
* function name: queueEvidenceUploadOffline
* parameter: file (File), student (object)
* return: -
* purpose: Stores an evidence file and its metadata into IndexedDB and adds a corresponding job into the offline sync queue for later upload when connectivity is restored.
********************************************************/
async function queueEvidenceUploadOffline(file, student) {

  const offlineId = crypto.randomUUID();

  // Save file blob to IndexedDB
  await idbPutEvidenceFile({
    id: offlineId,
    fileBlob: file,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    email: student.email,
    timestamp: student.timestamp,
    studentId: student.studentId,
    createdAt: new Date().toISOString()
  });

  // Add metadata to queue (small data only)
  const q = getPendingQueue();
  q.push({
    type: "uploadEvidence",
    offlineId,
    email: student.email,
    timestamp: student.timestamp,
    studentId: student.studentId,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    createdAt: new Date().toISOString()
  });
  setPendingQueue(q);
  renderPendingUI();

  clearEvidenceFileInput();
  toast("Offline: Evidence saved to Pending Sync. It will upload when online.");
}

/*******************************************************
* function name: isPdfFile
* parameter: name (string), mime (string)
* return: boolean
* purpose: Determines whether a file should be treated as a PDF based on filename extension or MIME type.
********************************************************/
function isPdfFile(name = "", mime = "") {

  const n = String(name).toLowerCase();
  const m = String(mime).toLowerCase();
  return n.endsWith(".pdf") || m.includes("pdf");
}

/*******************************************************
* function name: isImageFile
* parameter: name (string), mime (string)
* return: boolean
* purpose: Determines whether a file is an image based on MIME type prefix or common image file extensions.
********************************************************/
function isImageFile(name = "", mime = "") {

  const n = String(name).toLowerCase();
  const m = String(mime).toLowerCase();
  return m.startsWith("image/") || n.match(/\.(png|jpg|jpeg|gif|webp)$/);
}

/*******************************************************
* function name: syncPendingQueue
* parameter: opts (object)
* return: -
* purpose: Processes and synchronizes all pending offline queue jobs (updates, seat map saves, and chunked evidence uploads) to the server, tracking progress and keeping failed jobs in the queue.
********************************************************/
async function syncPendingQueue(opts = {}) {

  if (!navigator.onLine) return;

  const onlyKey = opts.onlyKey || null;

  let q = getPendingQueue();
  if (!q.length) {
    renderPendingUI();
    return;
  }

  const remaining = [];

  for (let i = 0; i < q.length; i++) {
    const item = q[i];
    const key = getQueueItemKey(item, i);

    // If only syncing one key, skip others
    if (onlyKey && key !== onlyKey) {
      remaining.push(item);
      continue;
    }

    try {
      pendingProgress.set(key, {
        status: "syncing",
        percent: 10,
        message: "Preparing..."
      });
      renderPendingUI();

      // UPDATE RECORD
      if (item.type === "updateRecord") {
        pendingProgress.set(key, { status: "syncing", percent: 40, message: "Uploading update..." });
        renderPendingUI();

        const res = await apiPost("update", item.payload);

        if (res.status !== "success") throw new Error(res.message || "Update failed");
      }

      // SEATMAP SAVE
      if (item.type === "seatmapSave") {
        pendingProgress.set(key, { status: "syncing", percent: 40, message: "Saving seat..." });
        renderPendingUI();

        const res = await apiPost("seatmapSave", item.payload);
        if (res.status !== "success") throw new Error(res.message || "Seat save failed");
      }


      // EVIDENCE UPLOAD (CHUNKED)
      if (item.type === "uploadEvidence") {
        pendingProgress.set(key, { status: "syncing", percent: 20, message: "Reading offline file..." });
        renderPendingUI();

        const stored = await idbGetEvidenceFile(item.offlineId);
        if (!stored || !stored.fileBlob) throw new Error("Missing offline file");

        const blob = stored.fileBlob;

        // ✅ chunk settings
        const CHUNK_SIZE = 200 * 1024; // 200KB safer for Apps Script
        const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);

        // unique upload id
        const uploadId = "UP_" + Date.now() + "_" + Math.random().toString(16).slice(2);

        // upload chunks
        for (let c = 0; c < totalChunks; c++) {
          const start = c * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, blob.size);
          const chunkBlob = blob.slice(start, end);

          let chunkBase64 = await blobToBase64(chunkBlob);
          //chunkBase64 = chunkBase64.split(",")[1] || chunkBase64; // remove data:* prefix

          const percent = Math.floor((c / totalChunks) * 70) + 20;
          pendingProgress.set(key, {
            status: "syncing",
            percent,
            message: `Uploading chunk ${c + 1}/${totalChunks}...`
          });
          renderPendingUI();

          const chunkPayload = {
            uploadId,
            chunkIndex: c,
            totalChunks,
            email: stored.email,
            timestamp: stored.timestamp,
            studentId: stored.studentId,
            fileName: stored.fileName,
            mimeType: stored.mimeType,
            chunkBase64
          };

          const cres = await apiPost("uploadEvidenceChunk", chunkPayload);

          if (cres.status !== "success") throw new Error(cres.message || "Chunk upload failed");
        }

        // finalize
        pendingProgress.set(key, {
          status: "syncing",
          percent: 95,
          message: "Finalizing file..."
        });
        renderPendingUI();

        const finalizePayload = {
          uploadId,
          totalChunks,
          email: stored.email,
          timestamp: stored.timestamp,
          studentId: stored.studentId,
          fileName: stored.fileName,
          mimeType: stored.mimeType
        };

        const fres = await apiPost("uploadEvidenceFinalize", finalizePayload);

        if (fres.status !== "success") throw new Error(fres.message || "Finalize failed");

        // delete offline file only if finalize success
        await idbDeleteEvidenceFile(item.offlineId);

        // ✅ REFRESH UI after successful upload
        if (state.selected && state.selected.studentId === stored.studentId) {
          await loadEvidenceList();
        }
      } // ✅ THIS closing brace

      // Success
      pendingProgress.set(key, {
        status: "done",
        percent: 100,
        message: "Synced ✔"
      });
      renderPendingUI();

      // small delay para makita progress
      await new Promise(r => setTimeout(r, 250));

    } catch (err) {
      //console.log("Sync failed:", item, err);
      toast("Sync failed.");

      pendingProgress.set(key, {
        status: "error",
        percent: 100,
        message: "Failed: " + err.message
      });

      remaining.push(item);
      renderPendingUI();
    }
  }

  setPendingQueue(remaining);

  // Cleanup progress for removed jobs
  if (remaining.length === 0) {
    pendingProgress.clear();
  }

  renderPendingUI();
}

/*******************************************************
* function name: blobToBase64
* parameter: blob (Blob)
* return: -
* purpose: Converts a Blob/File object into a base64 string without the data URL prefix using FileReader.
********************************************************/
function blobToBase64(blob) {

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      // result is usually: "data:application/pdf;base64,AAA..."
      const pureBase64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(pureBase64);
    };

    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/*******************************************************
* function name: splitBlobIntoChunks
* parameter: blob (Blob), chunkSize (number)
* return: Blob[]
* purpose: Splits a Blob into multiple smaller Blob chunks of the specified size for safer incremental upload.
********************************************************/
function splitBlobIntoChunks(blob, chunkSize = 300 * 1024) {

  const chunks = [];
  let offset = 0;

  while (offset < blob.size) {
    chunks.push(blob.slice(offset, offset + chunkSize));
    offset += chunkSize;
  }
  return chunks;
}

/*******************************************************
* function name: blobToBase64NoPrefix
* parameter: blob (Blob)
* return: -
* purpose: Converts a Blob to base64 and ensures any data URL prefix is removed, returning only the raw base64 payload.********************************************************/
async function blobToBase64NoPrefix(blob) {

  const b64 = await blobToBase64(blob);
  // remove: data:xxx;base64,
  return b64.split(",")[1] || "";
}

/*******************************************************
* function name: base64ToChunks
* parameter: base64 (string), chunkSize (number)
* return: -
* purpose: Splits a long base64 string into fixed-size string chunks for chunked upload APIs.
********************************************************/
function base64ToChunks(base64, chunkSize = 200000) {

  const chunks = [];
  for (let i = 0; i < base64.length; i += chunkSize) {
    chunks.push(base64.slice(i, i + chunkSize));
  }
  return chunks;
}

/*******************************************************
* function name: resetAppData
* parameter: none
* return: void
* purpose: Clears setup, session, and pending sync data from localStorage after confirmation and reloads the app.
********************************************************/
function resetAppData() {

  const ok = confirm(
    "RESET APP?\n\nThis will clear:\n- Session\n- Pending Sync Queue\n- Cached setup\n\nYou will need to login again."
  );
  if (!ok) return;

  // clear local storage
  localStorage.removeItem("sf_apiUrl");
  localStorage.removeItem("sf_clientId");
  localStorage.removeItem(LS_SESSION);
  localStorage.removeItem(LS_PENDING_UPDATES);

  // optional: clear everything
  // localStorage.clear();

  toast("Reset done. Reloading app...");
  location.reload();
}

/*******************************************************
* function name: refreshDebugInfo
* parameter: none
* return: void
* purpose: Updates debug info UI fields with current API URL, pending counts, and seat map stats.
********************************************************/
function refreshDebugInfo() {
  if (dbgApiUrl) dbgApiUrl.textContent = state.apiUrl || "-";
  if (dbgPending) dbgPending.textContent = String(getPendingCount());
  if (dbgRoom) dbgRoom.textContent = state.seat.room || "-";
  if (dbgSeats) dbgSeats.textContent = String((state.seat.seats || []).length);
}

/*******************************************************
* function name: norm
* parameter: s (string)
* return: string
* purpose: Normalizes a string for comparisons by trimming and converting to lowercase.
********************************************************/
function norm(s) {

  return String(s || "").trim().toLowerCase();
}

/*******************************************************
* function name: findStudentById
* parameter: id (string)
* return: object|null
* purpose: Finds a student in master student list by normalized studentId.
********************************************************/
function findStudentById(id) {

  const target = norm(id);
  if (!target) return null;

  return (state.seat.masterStudents || []).find(x =>
    norm(x.studentId) === target
  ) || null;
}

/*******************************************************
* function name: findStudentByEmail
* parameter: email (string)
* return: object|null
* purpose: Finds a student in master student list by normalized email address.
********************************************************/
function findStudentByEmail(email) {

  const target = norm(email);
  if (!target) return null;

  return (state.seat.masterStudents || []).find(x =>
    norm(x.studentEmail) === target
  ) || null;
}

/*******************************************************
* function name: findStudentByName
* parameter: name (string)
* return: object|null
* purpose: Finds a student by name using exact match first, then partial match fallback.
********************************************************/
function findStudentByName(name) {

  const target = norm(name);
  if (!target) return null;

  // exact match first
  let exact = (state.seat.masterStudents || []).find(x =>
    norm(x.studentName) === target
  );
  if (exact) return exact;

  // fallback: contains match
  return (state.seat.masterStudents || []).find(x =>
    norm(x.studentName).includes(target)
  ) || null;
}

/*******************************************************
* function name: updateDeleteRoomButtonVisibility
* parameter: none
* return: void
* purpose: Shows or hides the delete room button based on admin role and edit mode status.
********************************************************/
function updateDeleteRoomButtonVisibility() {

  const btn = document.getElementById("btnDeleteRoom");
  if (!btn) return;

  const isAdmin = (state.me && state.me.role === "admin");
  const editModeOff = (state.seat.editMode === false);

  if (isAdmin && editModeOff) {
    btn.classList.remove("hidden");
  } else {
    btn.classList.add("hidden");
  }
}

/*******************************************************
* function name: buildUrl
* parameter: params (object)
* return: string
* purpose: Builds a request URL by combining base API URL with provided query parameters.
********************************************************/
function buildUrl(params = {}) {

  const base = (state.apiUrl || "").trim();
  if (!base) throw new Error("API URL is not set. Please Setup first.");

  const url = new URL(base);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

/* ===========================
   OFFLINE QUEUE
=========================== */
/*******************************************************
* function name: loadPendingUpdates
* parameter: none
* return: array
* purpose: Loads pending remark/update jobs from localStorage with safe JSON parsing.
********************************************************/
function loadPendingUpdates() {

  try {
    return JSON.parse(localStorage.getItem(LS_PENDING_UPDATES) || "[]");
  } catch (e) {
    return [];
  }
}

/*******************************************************
* function name: savePendingUpdates
* parameter: items (array)
* return: void
* purpose: Saves pending remark/update jobs array into localStorage.
********************************************************/
function savePendingUpdates(items) {

  localStorage.setItem(LS_PENDING_UPDATES, JSON.stringify(items || []));
}

/*******************************************************
* function name: getPendingCount
* parameter: none
* return: number
* purpose: Returns total count of all pending offline jobs including updates and uploads.
********************************************************/
function getPendingCount() {

  const a = loadPendingUpdates().length;
  const b = getPendingQueue().length;
  return a + b;
}

/*******************************************************
* function name: updateSyncBadge
* parameter: none
* return: void
* purpose: Updates the pending sync badge text and visibility based on pending job counts.
********************************************************/
function updateSyncBadge() {

  if (!syncBadge) return;

  const a = loadPendingUpdates().length;
  const b = getPendingQueue().length;
  const total = a + b;

  if (total > 0) {
    syncBadge.textContent = `Pending Sync: ${total} (remarks:${a}, uploads:${b})`;
    syncBadge.classList.remove("hidden");
  } else {
    syncBadge.textContent = "Pending Sync: 0";
    syncBadge.classList.add("hidden");
  }
}

/* ===========================
   ONLINE / OFFLINE BADGE (Fix 22)
=========================== */
/*******************************************************
* function name: setNetBadge
* parameter: status (string)
* return: void
* purpose: Updates the online/offline status badge text and style.
********************************************************/
function setNetBadge(status) {

  if (!netBadge) return;

  if (status === "online") {
    netBadge.classList.remove("offline");
    netBadge.textContent = "● Online";
  } else if (status === "offline") {
    netBadge.classList.add("offline");
    netBadge.textContent = "● Offline";
  } else {
    netBadge.classList.remove("offline");
    netBadge.textContent = "● Checking...";
  }
}

/*******************************************************
* function name: getQueueItemKey
* parameter: item (object), idx (number)
* return: string
* purpose: Generates a stable display key for a pending queue item based on its type and identifiers.
********************************************************/
function getQueueItemKey(item, idx) {

  // stable key
  if (item.type === "uploadEvidence") return "evidence:" + (item.offlineId || idx);
  if (item.type === "updateRecord") return "update:" + (item.createdAt || idx);
  if (item.type === "seatmapSave") return "seatmap:" + (item.createdAt || idx);
  return "job:" + idx;
}

/*******************************************************
* function name: renderPendingUI
* parameter: none
* return: void
* purpose: Renders the pending sync panel list with progress bars, metadata, and retry/delete controls.
********************************************************/
function renderPendingUI() {

  if (!pendingPanel || !pendingList || !pendingCountText) return;

  const q = getPendingQueue();

  // Hide panel if no pending jobs
  if (!q.length) {
    pendingPanel.classList.add("hidden");
    pendingList.innerHTML = "";
    pendingCountText.textContent = "";
    return;
  }

  pendingPanel.classList.remove("hidden");
  pendingCountText.textContent = `(${q.length} waiting)`;
  pendingList.innerHTML = "";

  // ✅ declare once
  const isOnline = navigator.onLine;

  q.forEach((item, idx) => {
    const key = getQueueItemKey(item, idx);

    // Default progress info
    let info = pendingProgress.get(key) || {
      status: "waiting",
      percent: 0,
      message: "Waiting..."
    };

    // ✅ If OFFLINE, force waiting message (avoid "Failed to fetch")
    if (!isOnline) {
      info = {
        status: "waiting",
        percent: 0,
        message: "Waiting for online..."
      };
    }

    const title =
      item.type === "uploadEvidence"
        ? `Evidence Upload: ${item.fileName || "file"}`
        : item.type === "updateRecord"
          ? `Save Remarks / Done`
          : item.type === "seatmapSave"
            ? `Seat Map Save`
            : `Pending Job`;

    const meta =
      item.type === "uploadEvidence"
        ? `${item.email || "-"} • ${item.studentId || "-"}`
        : item.type === "updateRecord"
          ? `${item.payload?.email || "-"} • ${item.payload?.studentId || "-"}`
          : item.type === "seatmapSave"
            ? `${item.payload?.room || "-"} • Seat ${item.payload?.seatNo || "-"}`
            : "";

    const div = document.createElement("div");
    div.className = "pendingItem";

    div.innerHTML = `
      <div class="pendingTopRow">
        <div>
          <div class="pendingTitle">${escapeHtml(title)}</div>
          <div class="pendingMeta">${escapeHtml(meta)}</div>
        </div>

        <div class="pendingBtns">
          <button class="btnPrimary"
                  data-action="retry"
                  data-key="${escapeHtml(key)}"
                  ${isOnline ? "" : "disabled"}>
            Retry
          </button>

          <button class="btnDanger"
                  data-action="delete"
                  data-key="${escapeHtml(key)}">
            Delete
          </button>
        </div>
      </div>

      <div class="progressWrap">
        <div class="progressBar">
          <div class="progressFill" style="width:${info.percent || 0}%"></div>
        </div>
        <div class="progressText">${escapeHtml(info.message || "")}</div>
      </div>
    `;

    pendingList.appendChild(div);
  });

  // Re-attach button events every render
  pendingList.querySelectorAll("button[data-action]").forEach(btn => {
    btn.onclick = async () => {
      const action = btn.getAttribute("data-action");
      const key = btn.getAttribute("data-key");

      if (action === "retry") {
        await retrySinglePending(key);
      }

      if (action === "delete") {
        deleteSinglePending(key);
      }
    };
  });
}

/*******************************************************
* function name: deleteSinglePending
* parameter: key (string)
* return: void
* purpose: Removes a specific pending queue item and its offline file (if any) after user confirmation.
********************************************************/
function deleteSinglePending(key) {

  const q = getPendingQueue();

  const idx = q.findIndex((item, i) => getQueueItemKey(item, i) === key);
  if (idx < 0) return;

  const item = q[idx];

  const ok = confirm("Delete this pending item?\n\nThis will remove it from queue.");
  if (!ok) return;

  // If evidence, also delete file from IndexedDB
  if (item.type === "uploadEvidence" && item.offlineId) {
    idbDeleteEvidenceFile(item.offlineId).catch(() => { });
  }

  q.splice(idx, 1);
  setPendingQueue(q);

  pendingProgress.delete(key);
  renderPendingUI();
}

/*******************************************************
* function name: retrySinglePending
* parameter: key (string)
* return: Promise<void>
* purpose: Retries syncing a single pending queue item when online.
********************************************************/
async function retrySinglePending(key) {

  if (!navigator.onLine) {
    toast("You are offline. Cannot retry now.");
    return;
  }

  const q = getPendingQueue();
  const idx = q.findIndex((item, i) => getQueueItemKey(item, i) === key);
  if (idx < 0) return;

  // Try sync only that one item
  await syncPendingQueue({ onlyKey: key });
}

/*******************************************************
* function name: refreshNetBadgeNow
* parameter: none
* return: void
* purpose: Immediately refreshes network status badge based on current navigator online state.
********************************************************/
function refreshNetBadgeNow() {

  setNetBadge(navigator.onLine ? "online" : "offline");
}

/*******************************************************
* function name: startNetWatcherOnce
* parameter: none
* return: void
* purpose: Starts one-time network status watchers and triggers automatic sync when connection is restored.
********************************************************/
function startNetWatcherOnce() {

  if (netWatcherStarted) return;
  netWatcherStarted = true;

  refreshNetBadgeNow();

  if (navigator.onLine) {
    syncPendingQueue();
  }

  window.addEventListener("online", async () => {
    setNetBadge("online");
    await syncPendingUpdates(); // remarks/done
    await syncPendingQueue();   // evidence + seatmapSave + updateRecord
  });

  window.addEventListener("offline", () => {
    setNetBadge("offline");
  });
}

/*******************************************************
* function name: showNetBadge
* parameter: none
* return: void
* purpose: Makes the network status badge visible.
********************************************************/
function showNetBadge() {

  if (!netBadge) return;
  netBadge.classList.remove("hidden");
}

/*******************************************************
* function name: hideNetBadge
* parameter: none
* return: void
* purpose: Hides the network status badge element.
********************************************************/
function hideNetBadge() {

  if (!netBadge) return;
  netBadge.classList.add("hidden");
}

/* ===========================
   LOCAL STORAGE (Setup)
=========================== */
/*******************************************************
* function name: saveSetup
* parameter: apiUrl (string), clientId (string)
* return: void
* purpose: Stores API configuration values into localStorage.
********************************************************/
function saveSetup(apiUrl, clientId) {

  localStorage.setItem("sf_apiUrl", apiUrl);
  localStorage.setItem("sf_clientId", clientId);
}

/*******************************************************
* function name: loadSetup
* parameter: none
* return: object
* purpose: Loads fixed API configuration into state and localStorage and returns it.
********************************************************/
function loadSetup() {

  state.apiUrl = FIXED_API_URL;
  state.clientId = FIXED_CLIENT_ID;

  // optional: also store (for compatibility)
  localStorage.setItem("sf_apiUrl", state.apiUrl);
  localStorage.setItem("sf_clientId", state.clientId);

  return {
    apiUrl: state.apiUrl,
    clientId: state.clientId
  };
}

/*******************************************************
* function name: clearSetup
* parameter: none
* return: void
* purpose: Removes stored API configuration values from localStorage.
********************************************************/
function clearSetup() {

  localStorage.removeItem("sf_apiUrl");
  localStorage.removeItem("sf_clientId");
}

/* ===========================
   SESSION SAVE/RESTORE (Stay logged in on refresh)
=========================== */
/*******************************************************
* function name: saveSession
* parameter: none
* return: void
* purpose: Saves current app session state snapshot into localStorage for restore after refresh.
********************************************************/
function saveSession() {
  try {
    const data = {
      apiUrl: state.apiUrl || "",
      clientId: state.clientId || "",
      idToken: state.idToken || "",
      filters: state.filters || {},
      ui: state.ui || {},
      list: {
        page: state.list.page || 1,
        pageSize: state.list.pageSize || 20
      },
      selectedEmail: state.selected?.email || "",
      selectedIdx: state.selected?.idxInList ?? 0,
      lastScreenBeforeDetails: lastScreenBeforeDetails || "",
      currentScreen: state.currentScreen || "menu",

      room: state.seat.room || ""
    };
    localStorage.setItem(LS_SESSION, JSON.stringify(data));
  } catch (e) {
    console.error("saveSession error: ", e);
  }
}

/*******************************************************
* function name: loadSession
* parameter: none
* return: object
* purpose: Loads previously saved session snapshot from localStorage.
********************************************************/
function loadSession() {

  try {
    return JSON.parse(localStorage.getItem(LS_SESSION) || "{}");
  } catch (e) {
    return {};
  }
}

/*******************************************************
* function name: clearSession
* parameter: none
* return: void
* purpose: Removes saved session snapshot from localStorage.
********************************************************/
function clearSession() {

  localStorage.removeItem(LS_SESSION);
}

/* ===========================
   DRIVE FILE ID EXTRACT
=========================== */
/*******************************************************
* function name: extractDriveFileId
* parameter: url (string)
* return: string
* purpose: Extracts a Google Drive file ID from multiple possible share URL formats.
********************************************************/
function extractDriveFileId(url) {

  if (!url) return "";

  const str = String(url);

  // /d/FILEID/
  let m = str.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (m && m[1]) return m[1];

  // id=FILEID
  m = str.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (m && m[1]) return m[1];

  // open?id=FILEID
  m = str.match(/open\?id=([a-zA-Z0-9_-]{10,})/);
  if (m && m[1]) return m[1];

  // fallback any long id
  m = str.match(/[-\w]{25,}/);
  if (m && m[0]) return m[0];

  return "";
}

/*******************************************************
* function name: isPdfUrl
* parameter: url (string)
* return: boolean
* purpose: Checks whether a URL likely points to a PDF file.
********************************************************/
function isPdfUrl(url = "") {

  return String(url).toLowerCase().includes(".pdf");
}

/*******************************************************
* function name: isImageUrl
* parameter: url (string)
* return: boolean
* purpose: Checks whether a URL likely points to a supported image file.
********************************************************/
function isImageUrl(url = "") {

  return String(url).toLowerCase().match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/);
}

const btnFullscreenPhoto = document.getElementById("btnFullscreenPhoto");

if (btnFullscreenPhoto) {
  btnFullscreenPhoto.onclick = (ev) => {
    ev.preventDefault();
    if (!modalPhoto || !modalPhoto.src) return;
    window.open(modalPhoto.src, "_blank");
  };
}

/* ===========================
   API HELPERS
=========================== */
/*******************************************************
* function name: openSeatPreview
* parameter: seat (object), event (MouseEvent)
* return: void
* purpose: Opens the desktop floating seat preview panel, loads student record and cached photo, and binds full-profile navigation.
********************************************************/
function openSeatPreview(seat, event) {

  state.seat.currentSeat = seat;

  if (!seat || !seat.studentEmail) return;
  if (state.seat.editMode) return;
  if (isMobile()) {
    openMobilePreview(seat);
    return;
  }

  const pv = document.getElementById("seatPreviewFloat");
  const img = document.getElementById("pvPhoto");
  if (!pv || !img) return;

  // reset image
  img.src = SEAT_PLACEHOLDER;

  // fill text fields
  document.getElementById("pvSeatNo").textContent = `Seat ${seat.seatNo}`;
  document.getElementById("pvName").textContent = (seat.studentName || "—").toUpperCase();
  document.getElementById("pvStudentId").textContent = seat.studentId || "—";
  document.getElementById("pvEmail").textContent = seat.studentEmail || "—";
  document.getElementById("pvPhone").textContent = seat.cellphoneNumber || "—";
  // load remarks from record cache if available
  document.getElementById("pvRemarks").value = ""; // clear remarks

  const emailLower = String(seat.studentEmail || "").trim().toLowerCase();
  const idLower = String(seat.studentId || "").trim().toLowerCase();

  //document.getElementById("pvPhone").textContent = "Loading...";


  (async () => {
    //try {
    /*const res = await apiGet({
      action: "recordByEmail",
      idToken: state.idToken,
      email: seat.studentEmail
    });*/
    const res = await apiPost("recordByEmail", { email: seat.studentEmail });

    if (res.status === "success" && res.item) {
      const rec = res.item;

      //const phone = res.item.cellphoneNumber || "—";
      //document.getElementById("pvPhone").textContent = phone;

      // ✅ v6 FIX — full identifiers
      state.selected = rec;

    } /*else {
    document.getElementById("pvPhone").textContent = "—";
  }
    } catch (e) {
      console.warn("Phone load failed:", e);
      document.getElementById("pvPhone").textContent = "—";
    }*/
  })();

  // show preview first
  pv.classList.remove("hidden");
  positionFloatingPreview(event, pv);

  // 🔥 PHOTO LOAD (NO API, NO EMAIL)
  const email = seat.studentEmail.toLowerCase();
  const stu = (state.seat.masterStudents || []).find(
    s => String(s.studentEmail || "").toLowerCase() === email
  );
  if (!stu) return;

  const raw = stu.picture2x2_direct || stu.picture2x2 || "";

  if (!raw) return;

  const fileId = extractDriveFileId(raw);
  if (!fileId) return;

  (async () => {
    try {
      const cached = await cacheGet("photo_" + fileId);
      if (cached) {
        img.src = cached;
        photoCache.set(fileId, cached);
        return;
      }

      /*const res = await apiGet({
        action: "photo",
        idToken: state.idToken,
        fileId
      });*/
      const res = await apiPost("photo", { fileId });

      if (res.status !== "success") return;

      const mime = res.mimeType || "image/jpeg";
      const dataUrl = `data:${mime};base64,${res.base64}`;

      img.src = dataUrl;

      photoCache.set(fileId, dataUrl);
      await cacheSet("photo_" + fileId, dataUrl);

    } catch (e) {
      console.warn("Preview photo failed:", e);
    }
  })();

  // ✅ bind full profile button
  const btn = document.getElementById("btnOpenFullProfileDesktop");
  if (btn) {
    btn.onclick = () => {
      openSeatFullProfile(seat);
      closeSeatPreview();
    };
  }
}

const SEAT_PLACEHOLDER =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
      <rect width="100%" height="100%" fill="#e5e7eb"/>
      <text x="50%" y="52%" text-anchor="middle"
        font-size="24" fill="#9ca3af">?</text>
    </svg>
  `);

/*******************************************************
* function name: readBlobAsBase64
* parameter: blob (Blob)
* return: <string>
* purpose: Reads a Blob and returns its base64 content without the data URL prefix.
********************************************************/
function readBlobAsBase64(blob) {

  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const dataUrl = r.result || "";
      const base64 = String(dataUrl).split(",")[1] || "";
      resolve(base64);
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/*******************************************************
* function name: makeUploadId
* parameter: none
* return: string
* purpose: Generates a unique upload identifier string for chunked upload sessions.
********************************************************/
function makeUploadId() {

  return "up_" + Date.now() + "_" + Math.random().toString(16).slice(2);
}

/*******************************************************
* function name: uploadEvidenceInChunks
* parameter: options (object)
* return: <object>
* purpose: Uploads an evidence file blob to the server using init–chunk–finalize flow with progress callback support.
********************************************************/
async function uploadEvidenceInChunks({ email, timestamp, studentId, fileName, mimeType, fileBlob, onProgress }) {

  // 350KB base64-safe chunk (small para iwas limit)
  const CHUNK_SIZE = 250 * 1024; // 250KB raw binary

  const uploadId = makeUploadId();
  const totalSize = fileBlob.size;
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

  // 1) INIT
  let initRes = await apiPost("uploadEvidenceInit", {
    uploadId,
    email,
    timestamp,
    studentId,
    fileName,
    mimeType,
    totalChunks
  });

  if (initRes.status !== "success") {
    throw new Error(initRes.message || "Init upload failed");
  }

  // 2) UPLOAD CHUNKS
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalSize);
    const chunkBlob = fileBlob.slice(start, end);

    const chunkBase64 = await readBlobAsBase64(chunkBlob);

    const chunkRes = await apiPost("uploadEvidenceChunk", {
      uploadId,
      chunkIndex: i,
      chunkBase64
    });

    if (chunkRes.status !== "success") {
      throw new Error(chunkRes.message || `Chunk ${i + 1}/${totalChunks} failed`);
    }

    if (onProgress) {
      const percent = Math.round(((i + 1) / totalChunks) * 100);
      onProgress(percent);
    }
  }

  // 3) FINALIZE (merge chunks -> upload to Drive)
  const doneRes = await apiPost("uploadEvidenceFinalize", {
    uploadId
  });

  if (doneRes.status !== "success") {
    throw new Error(doneRes.message || "Finalize upload failed");
  }

  return doneRes;
}

/*******************************************************
* function name: forceLogout
* parameter: message (string)
* return: void
* purpose: Clears login/session state, hides protected UI, returns app to config screen, and shows logout message.
********************************************************/
function forceLogout(message) {

  try {
    clearSession();
    // keep offline pending items, do NOT delete
    // localStorage.removeItem(LS_PENDING_UPDATES);
    // setPendingQueue([]);

    localStorage.removeItem("sf_id_token");
    localStorage.removeItem("sf_login_time");
    localStorage.removeItem("sf_user_email");
    localStorage.removeItem("sf_last_screen");
    localStorage.removeItem("sf_last_state");

    state.idToken = "";
    state.me = null;
    state.selected = null;
    state.currentStudent = null;
    state.gradeTasks = [];
    state.learnerDev = {
      categories: [],
      scores: {}
    };

    if (userBadge) userBadge.classList.add("hidden");
    if (btnHelp) btnHelp.classList.add("hidden");
    if (btnAbout) btnAbout.classList.add("hidden");
    if (btnSupport) btnSupport.classList.add("hidden");
    if (btnChangelog) btnChangelog.classList.add("hidden");
    if (btnResetApp) btnResetApp.classList.add("hidden");
    if (btnLogout) btnLogout.classList.add("hidden");

    if (seatAdminTools) seatAdminTools.classList.add("hidden");
    if (btnSeatAddRoom) btnSeatAddRoom.classList.add("hidden");
    if (btnSeatEditToggle) btnSeatEditToggle.classList.add("hidden");

    // hide menu cards if any
    if (menuStudentInfo) menuStudentInfo.classList.add("hidden");
    if (menuSeatMapInfo) menuSeatMapInfo.classList.add("hidden");
    if (menuExport) menuExport.classList.add("hidden");
    if (menuImportDownload) menuImportDownload.classList.add("hidden");

    showScreen(screenConfig);
    hideNetBadge();

    if (message) toast(message);
  } catch (e) {
    //console.log("forceLogout error:", e);
    toast("Session ended. Force Logout");
  }
}

/*******************************************************
* function name: denyAccess
* parameter: message (string)
* return: void
* purpose: Denies access by triggering forced logout with message.
********************************************************/
function denyAccess(message) {

  forceLogout(message || "Access denied.");
}

/*******************************************************
* function name: driveToImageUrl
* parameter: url (string)
* return: string|null
* purpose: Converts a Google Drive share URL into a direct image view URL when possible.
********************************************************/
function driveToImageUrl(url) {

  if (!url) return null;

  // file/d/FILEID
  let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return "https://drive.google.com/uc?export=view&id=" + match[1];
  }

  // id=FILEID
  match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) {
    return "https://drive.google.com/uc?export=view&id=" + match[1];
  }

  return null;
}

/* ===========================
   FILTER DROPDOWNS
=========================== */
/*******************************************************
* function name: loadInitialFilters
* parameter: none
* return: <void>
* purpose: Loads initial dropdown filter values from the API and populates filter select elements.
********************************************************/
async function loadInitialFilters() {

  /*const res = await apiGet({
    action: "filters",
    idToken: state.idToken
  });*/
  const res = await apiPost("filters", {});

  if (res.status !== "success") {
    toast(res.message || "Failed loading dropdown filters");
    console.warn(res.message || "Failed loading dropdown filters");
    return;
  }

  fillSelect(fSchoolYear, res.schoolYears);
  fillSelect(fTerm, res.terms);
  fillSelect(fCourseSubject, res.courseSubjects);
  //fillSelect(exportCourse, res.courseSubjects);
  fillSelect(fProgram, res.program);

  if (fSchoolYear) fSchoolYear.value = state.filters.schoolYear || "";
  if (fTerm) fTerm.value = state.filters.term || "";
  if (fCourseSubject) fCourseSubject.value = state.filters.courseSubject || "";
  //if (exportCourse) exportCourse.value = state.filters.courseSubject || "";
  if (fProgram) fProgram.value = state.filters.program || "";
}

/*******************************************************
* function name: loadCascadeOptions
* parameter: none
* return: <void>
* purpose: Loads dependent filter options based on current selections and updates dropdowns while preserving valid selections.
********************************************************/
async function loadCascadeOptions() {

  const currentSY = fSchoolYear ? (fSchoolYear.value || "") : "";
  const currentTerm = fTerm ? (fTerm.value || "") : "";
  const currentCourse = fCourseSubject ? (fCourseSubject.value || "") : "";
  const currentProgram = fProgram ? (fProgram.value || "") : "";

  /*const res = await apiGet({
    action: "cascade",
    idToken: state.idToken,
    schoolYear: currentSY,
    term: currentTerm,
    courseSubject: currentCourse,
    program: currentProgram
  });*/

  const res = await apiPost("cascade", {
    schoolYear: currentSY,
    term: currentTerm,
    courseSubject: currentCourse,
    program: currentProgram
  });

  if (res.status !== "success") {
    console.warn("Cascade error:", res.message);
    return;
  }

  // refresh dropdown options
  fillSelect(fTerm, res.terms);
  fillSelect(fCourseSubject, res.courseSubjects);

  // restore selected values ONLY if they still exist
  if (fTerm) {
    const termExists = Array.from(fTerm.options).some(o => o.value === currentTerm);
    fTerm.value = termExists ? currentTerm : "";
  }

  if (fCourseSubject) {
    const courseExists = Array.from(fCourseSubject.options).some(o => o.value === currentCourse);
    fCourseSubject.value = courseExists ? currentCourse : "";
  }

  if (fProgram) {
    const programExists = Array.from(fProgram.options).some(o => o.value === currentProgram);
    fProgram.value = programExists ? currentProgram : "";
  }

  // always keep SY
  if (fSchoolYear) fSchoolYear.value = currentSY;

  // sync state + save
  state.filters.schoolYear = currentSY;
  state.filters.term = fTerm ? (fTerm.value || "") : "";
  state.filters.courseSubject = fCourseSubject ? (fCourseSubject.value || "") : "";
  state.filters.program = fProgram ? (fProgram.value || "") : "";

  saveSession();
}


/* ===========================
   LIST LOADING
=========================== */
/*******************************************************
* function name: loadList
* parameter: resetPage (boolean)
* return: <void>
* purpose: Loads filtered record list with cache-first strategy, renders results, and updates cache and session.
********************************************************/
/*async function loadList(resetPage = false) {

  if (resetPage) state.list.page = 1;

  const noFilter =
    !state.filters.schoolYear &&
    !state.filters.term &&
    !state.filters.courseSubject &&
    !state.filters.program &&
    !state.ui.search;

  // ✅ cache key depends on filters/search/page
  const cacheKey =
    `list_sy${state.filters.schoolYear}_t${state.filters.term}_c${state.filters.courseSubject}_p${state.filters.program}` +
    `_p${state.list.page}_s${state.list.pageSize}` +
    `_q${state.ui.search}_nr${state.ui.noRemarks}_oa${state.ui.onlyAssigned}_nd${state.ui.notDone}`;

  let cached = null;

  if (!noFilter) {
    // 1) SHOW CACHED FIRST (FAST)
    cached = await cacheGet(cacheKey);
  }

  if (cached && cached.items && Array.isArray(cached.items)) {
    state.list.total = cached.total || 0;
    state.list.items = cached.items || [];

    // ✅ SORT 
    state.list.items.sort((a, b) => {
      const getLast = (name) => String(name || "").split(",")[0].trim().toUpperCase();
      return getLast(a.fullName).localeCompare(getLast(b.fullName));
    });

    renderList();
  }

  // 2) FETCH LATEST ONLINE
  /*const res = await apiGet({
    action: "list",
    idToken: state.idToken,
 
    page: state.list.page,
    pageSize: state.list.pageSize,
 
    q: state.ui.search || "",
    noRemarks: state.ui.noRemarks ? "true" : "false",
    onlyAssigned: state.ui.onlyAssigned ? "true" : "false",
    notDone: state.ui.notDone ? "true" : "false",
 
    schoolYear: state.filters.schoolYear || "",
    term: state.filters.term || "",
    courseSubject: state.filters.courseSubject || "",
    program: state.filters.program || ""
  });*/
/*const res = await apiPost("list", {
  page: state.list.page,
  pageSize: state.list.pageSize,

  q: state.ui.search || "",
  noRemarks: state.ui.noRemarks ? "true" : "false",
  onlyAssigned: state.ui.onlyAssigned ? "true" : "false",
  notDone: state.ui.notDone ? "true" : "false",

  schoolYear: state.filters.schoolYear || "",
  term: state.filters.term || "",
  courseSubject: state.filters.courseSubject || "",
  program: state.filters.program || ""
});

if (res.status !== "success") {
  toast(res.message || "List load failed");
  return;
}

state.list.total = res.total || 0;
state.list.items = res.items || [];
state.list.page = res.page;
state.list.maxPage = res.maxPage;

// ✅ SORT 
state.list.items.sort((a, b) => {
  const getLast = (name) => String(name || "").split(",")[0].trim().toUpperCase();
  return getLast(a.fullName).localeCompare(getLast(b.fullName));
});

// ✅ RENDER LIST 
renderList();

if (res.status === "success" && state.currentScreen === "menu") {
  // ✅ RENDER DASHBOARD
  renderDashboard();
}

// ✅ SAVE STATE
saveSession();

if (!noFilter) {
  // 3) SAVE TO CACHE (NEXT OPEN = FAST)
  await cacheSet(cacheKey, {
    total: state.list.total,
    items: state.list.items,
    savedAt: new Date().toISOString()
  });
}

btnNextTop.disabled = state.list.page >= state.list.maxPage;
btnNext.disabled = state.list.page >= state.list.maxPage;
btnPrevTop.disabled = state.list.page <= 1;
btnPrev.disabled = state.list.page <= 1;
}*/
let LIST_ABORT = null;
let LIST_REQUEST_ID = 0;

async function loadList(resetPage = false) {

  if (resetPage) state.list.page = 1;

  const requestId = ++LIST_REQUEST_ID;

  const noFilter =
    !state.filters.schoolYear &&
    !state.filters.term &&
    !state.filters.courseSubject &&
    !state.filters.program &&
    !state.ui.search;

  const cacheKey =
    `list_sy${state.filters.schoolYear}_t${state.filters.term}_c${state.filters.courseSubject}_p${state.filters.program}` +
    `_p${state.list.page}_s${state.list.pageSize}` +
    `_q${state.ui.search}_nr${state.ui.noRemarks}_oa${state.ui.onlyAssigned}_nd${state.ui.notDone}`;

  // ======================================
  // 1. INSTANT CACHE RENDER (NON-BLOCKING)
  // ======================================
  if (!noFilter) {
    cacheGet(cacheKey).then(cached => {
      if (requestId !== LIST_REQUEST_ID) return;

      if (cached?.items?.length) {
        state.list.total = cached.total || 0;
        state.list.items = cached.items;

        sortList();
        renderList();
      }
    });
  }

  // ======================================
  // 2. CANCEL PREVIOUS REQUEST
  // ======================================
  if (LIST_ABORT) {
    LIST_ABORT.abort();
  }

  LIST_ABORT = new AbortController();

  try {

    // ======================================
    // 3. FETCH (MAIN DATA)
    // ======================================
    const res = await apiPost("list", {
      page: state.list.page,
      pageSize: state.list.pageSize === "ALL" ? "ALL" : state.list.pageSize,

      q: state.ui.search || "",
      noRemarks: state.ui.noRemarks ? "true" : "false",
      onlyAssigned: state.ui.onlyAssigned ? "true" : "false",
      notDone: state.ui.notDone ? "true" : "false",

      schoolYear: state.filters.schoolYear || "",
      term: state.filters.term || "",
      courseSubject: state.filters.courseSubject || "",
      program: state.filters.program || ""
    });

    // ❌ outdated request protection
    if (requestId !== LIST_REQUEST_ID) return;

    if (res.status !== "success") {
      toast(res.message || "List load failed");
      console.warn(res.message || "List load failed");
      return;
    }

    // ======================================
    // 4. UPDATE STATE (SAFE)
    // ======================================
    state.list.total = res.total || 0;
    state.list.items = res.items || [];
    state.list.page = res.page || 1;
    state.list.maxPage = res.maxPage || 1;

    // ======================================
    // 5. SORT ONCE (FAST)
    // ======================================
    sortList();

    // ======================================
    // 6. RENDER LIST IMMEDIATELY
    // ======================================
    renderList();

    // ======================================
    // 7. SAVE CACHE (BACKGROUND)
    // ======================================
    if (!noFilter) {
      cacheSet(cacheKey, {
        total: state.list.total,
        items: state.list.items,
        savedAt: new Date().toISOString()
      });
    }

    // ======================================
    // 8. UPDATE PAGINATION BUTTONS
    // ======================================
    updatePaginationButtons();

    // ======================================
    // 9. SAVE SESSION
    // ======================================
    saveSession();

  } catch (err) {

    if (err.name === "AbortError") return;

    console.error("loadList error:", err);
    toast("Network error");
  }
}

/*******************************************************
* function name: sortList
* parameter: 
* return: 
* purpose: 
********************************************************/
function sortList() {
  state.list.items.sort((a, b) => {
    const getLast = (name) =>
      String(name || "").split(",")[0].trim().toUpperCase();

    return getLast(a.fullName).localeCompare(getLast(b.fullName));
  });
}

/*******************************************************
* function name: updatePaginationButtons
* parameter: 
* return: 
* purpose: 
********************************************************/
function updatePaginationButtons() {
  const p = state.list.page;
  const max = state.list.maxPage;

  if (btnNextTop) btnNextTop.disabled = p >= max;
  if (btnNext) btnNext.disabled = p >= max;
  if (btnPrevTop) btnPrevTop.disabled = p <= 1;
  if (btnPrev) btnPrev.disabled = p <= 1;
}

/*******************************************************
* function name: renderList
* parameter: none
* return: void
* purpose: Renders the main record list UI with photo thumbnails, tags, and click handlers for details view.
********************************************************/
function renderList() {

  if (!listWrap) return;

  let start, end;

  if (state.list.pageSize === "ALL") {
    start = state.list.total > 0 ? 1 : 0;
    end = state.list.total;
  } else {
    const pageSize = Number(state.list.pageSize || 0);
    const page = Number(state.list.page || 1);
    const total = Number(state.list.total || 0);

    start = total === 0 ? 0 : (page - 1) * pageSize + 1;
    end = Math.min(start + pageSize - 1, total);
  }

  if (lblRecordCount) {
    //lblRecordCount.textContent = `Record ${state.list.items.length} of ${state.list.total}`;
    lblRecordCount.textContent = `Showing ${start || 0} to ${end || 0} of ${state.list.total || 0}`;
  }
  if (lblPage) lblPage.textContent = `Page ${state.list.page}`;
  if (lblPageTop) lblPageTop.textContent = `Page ${state.list.page}`;


  if (!state.list.items.length) {
    listWrap.innerHTML = `<div class="muted">No records found.</div>`;
    return;
  }

  state.list.items.forEach((item, idx) => {
    const div = document.createElement("div");
    div.className = "list-item";

    const nameCaps = String(item.fullName || "").toUpperCase();
    const tagRemarks = (item.remarks || "").trim() ? "WITH REMARKS" : "NO REMARKS";

    // ✅ NEW: Right side date/time label
    const rightDate = item.timestamp || item.dateSubmitted || item.submittedAt || "";

    div.innerHTML = `
		  <div class="listRow">
			
			<!-- LEFT PHOTO -->
			<div class="listPhotoWrap">
			  <img class="listPhoto" 
				   data-photo="${escapeHtml(item.picture2x2_direct || item.picture2x2 || "")}"
				   alt="photo" />
			</div>

			<!-- RIGHT INFO -->
			<div class="listLeft">
			  <div class="list-title">${escapeHtml(nameCaps)}</div>
			  <div class="list-sub muted">${escapeHtml(item.email)} • ${escapeHtml(item.studentId)}</div>

			  <div class="list-tags">
				<span class="tag">${escapeHtml(item.courseSubject || "-")}</span>
				<span class="tag">${escapeHtml(item.term || "-")}</span>
				<span class="tag">${escapeHtml(tagRemarks)}</span>
			  </div>
			</div>

			<div class="listRight muted">
			  ${escapeHtml(rightDate)}
			</div>

		  </div>
		`;

    div.onclick = () => {
      showScreen(screenDetails); // instant switch
      openDetailsByIndex(idx);   // loads data after
    };
    listWrap.appendChild(div);

    const img = div.querySelector(".listPhoto");
    if (img) {
      loadListPhoto(img, item);
    }

  });

}

/* ===========================
   DETAILS + PHOTO
=========================== */
/*******************************************************
* function name: buildRecordKey
* parameter: item (object)
* return: string
* purpose: Builds a unique record key string from email, timestamp, and studentId.
********************************************************/
function buildRecordKey(item) {

  return `${item.email}|${item.timestamp}|${item.studentId}`;
}

/*******************************************************
* function name: loadStudentPhotoInto
* parameter: imgEl (HTMLImageElement), item (object)
* return: <void>
* purpose: Loads a student photo into an image element using Drive fileId with IndexedDB caching fallback.
********************************************************/
async function loadStudentPhotoInto(imgEl, item) {

  try {
    if (!imgEl) return;

    // show nothing first (placeholder already set in openDetails)
    const photoRaw = item.picture2x2_direct || item.picture2x2 || "";
    const fileId = extractDriveFileId(photoRaw);

    if (!fileId) throw new Error("No fileId extracted from 2X2 Picture");

    // ✅ CACHE: if already loaded, instant show
    const cached = await cacheGet("photo_" + fileId);
    if (cached) {
      imgEl.src = cached;
      photoCache.set(fileId, cached);
      return;
    }

    /*const res = await apiGet({
      action: "photo",
      idToken: state.idToken,
      fileId: fileId
    });*/
    const res = await apiPost("photo", { fileId: fileId });

    if (res.status !== "success") throw new Error(res.message || "Photo API error");

    const mime = res.mimeType || "image/jpeg";
    const dataUrl = `data:${mime};base64,${res.base64}`;

    imgEl.src = dataUrl;

    // ✅ store cache
    //photoCache.set(fileId, dataUrl);
    await cacheSet("photo_" + fileId, dataUrl);

  } catch (err) {
    //console.warn("Photo load failed:", err);

    if (!imgEl) return;
    imgEl.src =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
          <rect width="100%" height="100%" fill="#f8fbff"/>
          <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
            font-family="Arial" font-size="72" fill="#64748b">
            👤
          </text>
        </svg>
      `);
  }
}

/*******************************************************
* function name: loadListPhoto
* parameter: imgEl (HTMLImageElement), item (object)
* return: <void>
* purpose: Loads and caches student thumbnail photo for list view with placeholder fallback.
********************************************************/
async function loadListPhoto(imgEl, item) {

  try {
    if (!imgEl) return;

    // placeholder muna
    imgEl.src =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
          <rect width="100%" height="100%" fill="#f1f5f9"/>
          <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
            font-family="Arial" font-size="56" fill="#64748b">
            👤
          </text>
        </svg>
      `);

    const photoRaw = item.picture2x2_direct || item.picture2x2 || "";
    const fileId = extractDriveFileId(photoRaw);

    if (!fileId) return;

    const cached = await cacheGet("photo_" + fileId);

    // cache reuse (same cache as details photo)
    if (cached) {
      imgEl.src = cached;
      photoCache.set(fileId, cached); // keep RAM too
      return;
    }

    /*const res = await apiGet({
      action: "photo",
      idToken: state.idToken,
      fileId
    });*/
    const res = await apiPost("photo", { fileId });

    if (res.status !== "success") return;

    const mime = res.mimeType || "image/jpeg";
    const dataUrl = `data:${mime};base64,${res.base64}`;

    imgEl.src = dataUrl;

    // ✅ save BOTH RAM + IndexedDB
    photoCache.set(fileId, dataUrl);
    await cacheSet("photo_" + fileId, dataUrl);

  } catch (err) {
    // ignore errors (keep placeholder)
  }
}

/*******************************************************
* function name: openDetailsByIndex
* parameter: idx (number)
* return: void
* purpose: Opens the details view for a record using its index in the current list.
********************************************************/
function openDetailsByIndex(idx) {

  const item = state.list.items[idx];
  if (!item) return;
  openDetails(item, idx);
  saveSession();
}

/*******************************************************
* function name: renderRecordNav
* parameter: activeIdx (number)
* return: void
* purpose: Renders the left-side record navigation list and highlights the active record.
********************************************************/
function renderRecordNav(activeIdx) {

  if (!recordNavList) return;

  recordNavList.innerHTML = "";

  const items = state.list.items || [];
  if (!items.length) {
    recordNavList.innerHTML = `<div class="muted">No records loaded.</div>`;
    return;
  }

  items.forEach((x, i) => {
    const div = document.createElement("div");
    div.className = "recordNavItem" + (i === activeIdx ? " active" : "");
    div.textContent = String(x.fullName || "").toUpperCase();
    div.onclick = () => openDetailsByIndex(i);
    recordNavList.appendChild(div);
  });
}

/*******************************************************
* function name: renderLongField
* parameter: label (string), value (string)
* return: string
* purpose: Builds HTML block for displaying long text fields in the details history/info layout.
********************************************************/
function renderLongField(label, value) {

  const v = String(value || "").trim();
  if (!v) return "";
  return `
    <div class="history-item">
      <div><b>${escapeHtml(label)}</b></div>
      <div class="muted" style="white-space:pre-wrap;">${escapeHtml(v)}</div>
    </div>
  `;
}

/*******************************************************
* function name: renderFacebookField
* parameter: label (string), value (string)
* return: string
* purpose: Builds HTML block for Facebook field, rendering clickable link when value is a URL.
********************************************************/
function renderFacebookField(label, value) {

  const v = String(value || "").trim();
  if (!v) return "";

  const isUrl = /^https?:\/\//i.test(v);

  if (isUrl) {
    return `
      <div class="history-item">
        <div><b>${escapeHtml(label)}</b></div>
        <div class="muted" style="white-space:pre-wrap;">
          <a class="valueLink" href="${escapeHtml(v)}" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(v)}
          </a>
        </div>
      </div>
    `;
  }

  return `
    <div class="history-item">
      <div><b>${escapeHtml(label)}</b></div>
      <div class="muted" style="white-space:pre-wrap;">${escapeHtml(v)}</div>
    </div>
  `;
}

/*******************************************************
* function name: openDetails
* parameter: item (object), idxInList (number)
* return: <void>
* purpose: Opens and populates the student details screen, loads photo, grades, learner dev, and evidence data.
********************************************************/
async function openDetails(item, idxInList = 0) {

  try {
    //document.getElementById('tabContentGrades')?.classList.add('hidden');
    //document.getElementById('tabContentLearnerDev')?.classList.add('hidden');

    state.selected = { ...item, recordKey: buildRecordKey(item), idxInList };

    // ✅ GRADES CONTEXT
    state.currentStudent = item;
    state.selectedEmail = item.email;

    //updateGradeSeat();
    //saveSession();

    renderRecordNav(idxInList);

    if (dName) dName.textContent = String(item.fullName || "Student Details").toUpperCase();
    if (dMeta) dMeta.textContent = `${item.email || ""} • ${item.studentId || ""}`;

    if (dInfo) {
      dInfo.innerHTML = `
        <div class="infoGrid">
          <div class="infoCard"><div class="label">School Year</div><div class="value">${escapeHtml(item.schoolYear || "-")}</div></div>
          <div class="infoCard"><div class="label">Term</div><div class="value">${escapeHtml(item.term || "-")}</div></div>
          <div class="infoCard"><div class="label">Course (Subject)</div><div class="value">${escapeHtml(item.courseSubject || "-")}</div></div>
          <div class="infoCard"><div class="label">Program</div><div class="value">${escapeHtml(item.program || "-")}</div></div>
          <div class="infoCard"><div class="label">Year Level</div><div class="value">${escapeHtml(item.yearLevel || "-")}</div></div>
          <div class="infoCard">
            <div class="label">Proof of Enrollment</div>
            <a class="valueLink" href="#" id="btnProofOpen">Open</a>
          </div>
        </div>
      `;
    }

    if (otherInfoWrap) {
      otherInfoWrap.innerHTML = `
        ${renderLongField("Cellphone Number", item.cellphoneNumber)}
        ${renderFacebookField("Facebook Name", item.facebookName)}
        ${renderLongField("Motto", item.motto)}
        ${renderLongField("Course Expectation/s", item.courseExpectations)}
        ${renderLongField("Talent/s and/or Skill/s", item.talentsSkills)}
        ${renderLongField("What do you know about the Course?", item.knowAboutCourse)}
        ${renderLongField("Most excited about/interested in", item.excitedAbout)}
        ${renderLongField("Challenges / Worries", item.challenges)}
        ${renderLongField("Anything else", item.anythingElse)}
      `;
    }

    if (dRemarks) dRemarks.value = item.remarks || "";
    clearRemarksBox(); // ✅ auto clear after save

    if (dDone) dDone.checked = !!item.done;

    // ✅ STEP 6 — student read-only mode
    if (state.me && state.me.role === "student") {
      if (dRemarks) dRemarks.disabled = true;
      if (dDone) dDone.disabled = true;
      if (btnSave) btnSave.classList.add("hidden");
    } else {
      if (dRemarks) dRemarks.disabled = false;
      if (dDone) dDone.disabled = false;
      if (btnSave) btnSave.classList.remove("hidden");
    }

    const btnProofOpen = document.getElementById("btnProofOpen");
    if (btnProofOpen) {
      btnProofOpen.onclick = async (ev) => {
        showLoading("Loading Proof of Enrollment...");
        ev.preventDefault();
        try {
          const proofRaw = item.enrollmentProof_direct || item.enrollmentProof || "";
          const fileId = extractDriveFileId(proofRaw);

          if (!fileId) {
            toast("No Proof of Enrollment file found.");
            hideLoading();
            return;
          }

          /*const res = await apiGet({
            action: "photo",
            idToken: state.idToken,
            fileId: fileId
          });*/
          const res = await apiPost("photo", { fileId: fileId });

          if (res.status !== "success") {
            hideLoading();
            throw new Error(res.message || "Failed to load proof");
          }

          const mime = res.mimeType || "image/jpeg";
          const dataUrl = `data:${mime};base64,${res.base64}`;
          openImageModalFromUrl(dataUrl);
          hideLoading();
        } catch (err) {
          hideLoading();
          toast("Proof open failed: " + err.toString());
          console.warn("Proof open failed: " + err.toString());
        }
      };
    }

    if (btnPrevRecord) {
      btnPrevRecord.onclick = () => {
        const i = state.selected.idxInList || 0;
        if (i <= 0) return toast("This is the first record.");
        openDetailsByIndex(i - 1);
      };
      document.getElementById('tabContentGrades')?.classList.add('hidden');
      document.getElementById('tabContentLearnerDev')?.classList.add('hidden');
    }

    if (btnNextRecord) {
      btnNextRecord.onclick = () => {
        const i = state.selected.idxInList || 0;
        if (i >= state.list.items.length - 1) return toast("This is the last record.");
        openDetailsByIndex(i + 1);
      };
      document.getElementById('tabContentGrades')?.classList.add('hidden');
      document.getElementById('tabContentLearnerDev')?.classList.add('hidden');
    }

    if (dLastUpdate) {
      dLastUpdate.textContent = item.lastUpdated
        ? `Last Updated: ${item.lastUpdated} by ${item.lastUpdatedBy || "-"}`
        : "";
    }

    if (historyWrap) {
      historyWrap.classList.add("hidden");
      historyWrap.innerHTML = "";
    }

    if (dPhoto) {
      dPhoto.src =
        "data:image/svg+xml;charset=utf-8," +
        encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
        <rect width="100%" height="100%" fill="#f8fbff"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
          font-family="Arial" font-size="22" fill="#64748b">
          Loading photo...
        </text>
        </svg>
      `);
    }

    // ✅ Clear evidence upload field when switching profiles
    if (inpEvidenceFile) inpEvidenceFile.value = "";

    // ✅ Reset evidence list UI while loading new student
    if (evidenceList) {
      evidenceList.classList.add("hidden");
      evidenceList.innerHTML = "";
    }

    showScreen(screenDetails);
    // load photo in background (no blocking)
    loadStudentPhotoInto(dPhoto, item);

    // ============================
    // LOAD GRADES TAB (UI ONLY)
    // ============================
    state.currentStudent = item;   // grades context

    // ✅ LEARNER DEVELOPMENT LOAD
    await loadLearnerDev(item.studentId);
    // fallback only if empty from sheet
    if (!state.learnerDev.categories.length) {
      seedLearnerDevDefaults();
    }

    const room = (state.seat.room || selSeatRoom?.value || "").trim();

    if (!room) {
      console.warn("No room selected. Skipping seat load.");
    } else {
      state.seat.room = room;
      //console.log("Loading room: ", state.seat.room);
      await loadSeatRoom(state.seat.room);
    }
    //renderGradeTable();            // build table
    //if (state.currentStudent?.studentId) {
    //  if(!gradeEditing){
    //    await loadTaskGrades(state.currentStudent.studentId);
    //    console.log("await loadTaskGrades called");
    //  }
    //}

    saveSession();

    // load evidence in background (no blocking)
    loadEvidenceList();
    applyRoleUI();
  } catch (e) {
    console.error("🔥 openDetails crash:", e.stack);
    toast(e.stack);
    throw e;
  }
}

if (btnSeatPreviewUpload) {
  btnSeatPreviewUpload.onclick = async () => {
    try {
      if (!state.selected) {
        toast("No student selected.");
        seatPreviewEvidenceFile.value = "";
        return;
      }

      const file = seatPreviewEvidenceFile.files[0];
      /*f (!file) {
        hideLoading();
        toast("Please choose a file.");
        return;
      }*/

      await handleUploadEvidence(file);

      seatPreviewEvidenceFile.value = "";

    } catch (err) {
      toast("Upload error: " + err.message);
      console.warn("Upload error: " + err.message);
    }
  };
}

/*******************************************************
* function name: closeSeatPreview
* parameter: none
* return: void
* purpose: Closes both desktop and mobile seat preview panels and clears preview evidence input.
********************************************************/
function closeSeatPreview() {
  const pv = document.getElementById("seatPreviewFloat");
  if (pv) pv.classList.add("hidden");

  const m = document.getElementById("seatPreviewMobile");
  if (m) m.classList.add("hidden");

  if (seatPreviewEvidenceFile) {
    seatPreviewEvidenceFile.value = "";
  }
}

/*******************************************************
* function name: openMobilePreview
* parameter: seat (object)
* return: <void>
* purpose: Opens the mobile seat preview panel with student info, phone lookup, and cached photo loading.
********************************************************/
async function openMobilePreview(seat) {
  state.seat.currentSeat = seat;

  const pv = document.getElementById("seatPreviewMobile");
  pv.classList.remove("hidden");

  const img = document.getElementById("pvMPhoto");
  img.src = SEAT_PLACEHOLDER;

  const email = seat.studentEmail?.toLowerCase();
  if (!email) return;

  // fill text fields
  document.getElementById("pvMSeatNo").textContent = seat.seatNo ? `Seat ${seat.seatNo}` : "Seat —";
  document.getElementById("pvMName").textContent = (seat.studentName || "—").toUpperCase();
  document.getElementById("pvMStudentId").textContent = seat.studentId || "—";
  document.getElementById("pvMEmail").textContent = seat.studentEmail || "—";
  document.getElementById("pvMRemarks").value = ""; // clear remarks
  /*let phone = "—";
 
  try {*/
  /*const res = await apiGet({
    action: "recordByEmail",
    idToken: state.idToken,
    email: email
  });*/
  /*const res = await apiPost("recordByEmail", { email: email });
 
  if (res.status === "success" && res.item) {
    const rec = res.item;
 
    phone =
      rec.cellphoneNumber ||
      rec.cellphone ||
      rec.mobile ||
      rec.mobileNumber ||
      rec.contactNumber ||
      "—";
  }
} catch (e) {
  console.warn("Mobile preview phone load failed:", e);
}*/

  document.getElementById("pvMPhone").textContent = seat.cellphoneNumber;
  document.getElementById("pvMRemarks").value = seat.remarks || "";

  const stu = (state.seat.masterStudents || []).find(
    s => String(s.studentEmail || "").toLowerCase() === email
  );

  if (stu) {
    const raw =
      stu.picture2x2_direct ||
      stu.picture2x2 ||
      "";

    const fileId = extractDriveFileId(raw);

    if (fileId) {
      (async () => {
        try {
          const cached = await cacheGet("photo_" + fileId);
          if (cached) {
            img.src = cached;
            photoCache.set(fileId, cached);
            return;
          }

          /*const res = await apiGet({
            action: "photo",
            idToken: state.idToken,
            fileId
          });*/
          const res = await apiPost("photo", { fileId });

          if (res.status !== "success") return;

          const mime = res.mimeType || "image/jpeg";
          const dataUrl = `data:${mime};base64,${res.base64}`;

          img.src = dataUrl;
          photoCache.set(fileId, dataUrl);
          await cacheSet("photo_" + fileId, dataUrl);

        } catch (e) {
          console.warn("Mobile preview photo failed:", e);
        }
      })();
    }
  }
  // ✅ bind mobile full profile button
  const btn = document.getElementById("btnOpenFullProfileMobile");
  if (btn) {
    btn.onclick = () => {
      openSeatFullProfile(seat);
      closeMobilePreview();
    };
  }
}

/*******************************************************
* function name: openSeatFullProfile
* parameter: seat (object)
* return: <void>
* purpose: Opens the full student profile from seat preview by email and navigates to details screen.
********************************************************/
async function openSeatFullProfile(seat) {
  if (!seat?.studentEmail) return;

  // para tama ang Back button behavior
  lastScreenBeforeDetails = "seatmap";
  showLoading("Loading profile...");
  await openStudentDetailsByEmail(seat.studentEmail);
  hideLoading();
}

/*******************************************************
* function name: closeMobilePreview
* parameter: none
* return: void
* purpose: Closes the mobile seat preview panel.
********************************************************/
function closeMobilePreview() {

  const pv = document.getElementById("seatPreviewMobile");
  if (pv) pv.classList.add("hidden");
}

/*******************************************************
* function name: positionFloatingPreview
* parameter: event (MouseEvent), el (HTMLElement)
* return: void
* purpose: Positions floating preview panel near cursor while keeping it inside viewport bounds.
********************************************************/
function positionFloatingPreview(event, el) {
  const padding = 20;
  let x = event.clientX + 14;
  let y = event.clientY + 14;

  if (x + el.offsetWidth > window.innerWidth)
    x = event.clientX - el.offsetWidth - padding;

  if (y + el.offsetHeight > window.innerHeight)
    y = event.clientY - el.offsetHeight - padding;

  el.style.left = x + "px";
  el.style.top = y + "px";
}

/*******************************************************
* function name: openDetailsTab
* parameter: tab (string)
* return: void
* purpose: Switches details screen tab content and triggers grade and chart rendering when needed.
********************************************************/
async function openDetailsTab(tab) {

  // Hide all tab contents
  document.getElementById("tabContentLearnerDev")?.classList.add("hidden");
  document.getElementById("tabContentGrades")?.classList.add("hidden");

  if (tab === "learner") {

    document.getElementById("tabContentLearnerDev")?.classList.remove("hidden");
    setTimeout(renderLearnerDevChart, 50);
  }
  if (tab === "grades") {
    applyRoleUI();
    const student = state.currentStudent;
    if (!student) return;
    // Load courses first
    await preloadStudentCourses(student);

    // Render dropdown
    populateCourseDropdown();

    // Clear table (optional, render will overwrite anyway)
    const tbody = document.getElementById("gradeTableBody");
    if (tbody) {
      tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#94a3b8;">
          Loading...
        </td>
      </tr>
    `;
    }

    document.getElementById("gradeStudentId").textContent = "—";
    document.getElementById("courseStudentId").textContent = "—";

    document.getElementById("tabContentGrades")?.classList.remove("hidden");

    // Load grades
    loadTaskGrades(student.studentId);
  }

  //if (tab === "grades") {
  //  const student = state.currentStudent;
  //  if (!student) return;

  //loadGradesForStudent(student.studentId); -> old
  //  loadTaskGrades(student.studentId);
  //  document.getElementById("tabContentGrades")?.classList.remove("hidden");
  //  setTimeout(renderLearnerDevChart, 50);
  //alert("Grading Summary is still under constructions!");
  //}

  //if (tab === "info") {
  //  document.getElementById("tabContentInfo")?.classList.remove("hidden");
  //}
}

/* ===========================
   EVIDENCE
=========================== */
/*******************************************************
* function name: fileToBase64
* parameter: file (File)
* return: <string>
* purpose: Converts a File object into base64 string without data URL prefix.
********************************************************/
function fileToBase64(file) {

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/*******************************************************
* function name: loadEvidenceList
* parameter: none
* return: <void>
* purpose: Loads and renders the evidence file list for the selected student with view handlers.
********************************************************/
async function loadEvidenceList() {

  if (!state.idToken) return;
  if (!state.selected) return;
  if (!evidenceList) return;

  /*const res = await apiGet({
    action: "evidence",
    idToken: state.idToken,
    email: state.selected.email,
    timestamp: state.selected.timestamp,
    studentId: state.selected.studentId
  });*/
  const res = await apiPost("evidence", {
    email: state.selected.email,
    timestamp: state.selected.timestamp,
    studentId: state.selected.studentId
  });

  if (res.status !== "success") return;

  const items = res.items || [];
  if (!items.length) {
    evidenceList.classList.add("hidden");
    evidenceList.innerHTML = "";
    return;
  }

  evidenceList.classList.remove("hidden");
  evidenceList.innerHTML = `
		${items.map((ev, i) => {
    const url = ev.url || "";
    const type = ev.type || "FILE";
    const uploadedAt = ev.uploadedAt || "—";

    return `
			<div class="history-item">
			  <div><b>Evidence ${i + 1}</b></div>
			  <div class="evidenceMeta">${escapeHtml(type)} • Uploaded: ${escapeHtml(uploadedAt)}</div>
			  <a href="#"
				 class="valueLink"
				 data-url="${escapeHtml(url)}">
				 View
			  </a>
			</div>
		  `;
  }).join("")}
  `;

  evidenceList.querySelectorAll("a[data-url]").forEach(a => {
    a.onclick = async (ev) => {
      ev.preventDefault();

      try {
        showLoading("Loading evidence...");
        const url = a.getAttribute("data-url") || "";
        const fileId = extractDriveFileId(url);

        if (!fileId) {
          toast("Invalid evidence link (no fileId).");
          return;
        }

        // PDF = open new tab
        const lower = url.toLowerCase();
        const isPdf = lower.includes(".pdf");

        if (isPdf) {
          hideLoading();
          const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
          window.open(previewUrl, "_blank");
          return;
        }

        // IMAGE = load as base64 then open modal viewer
        /*const res = await apiGet({
          action: "photo",
          idToken: state.idToken,
          fileId: fileId
        });*/
        const res = await apiPost("photo", { fileId: fileId });

        if (res.status !== "success") {
          toast(res.message || "Failed to load evidence image.");
          console.warn(res.message || "Failed to load evidence image.");
          return;
        }

        const mime = res.mimeType || "";
        const base64 = res.base64 || "";

        // PDF → open using Blob URL (fix about:blank#blocked)
        if (mime.includes("pdf")) {
          const byteChars = atob(base64);
          const byteNumbers = new Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) {
            byteNumbers[i] = byteChars.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: "application/pdf" });

          const blobUrl = URL.createObjectURL(blob);

          const w = window.open(blobUrl, "_blank");
          if (!w) {
            // fallback if popup blocked
            window.location.href = blobUrl;
          }
        } else {
          // IMAGE → open in modal zoom
          hideLoading();
          const dataUrl = `data:${mime || "image/jpeg"};base64,${base64}`;
          openImageModalFromUrl(dataUrl);
        }
      } catch (err) {
        hideLoading();
        toast("Evidence view error: " + err.toString());
        console.warn("Evidence view error: " + err.toString());
      }
    };
  });
}

/* ===========================
   HISTORY
=========================== */
/*******************************************************
* function name: loadHistory
* parameter: none
* return: <void>
* purpose: Loads and displays remarks history entries for the selected record.
********************************************************/
async function loadHistory() {

  if (!state.selected) return;
  if (!historyWrap) return;

  showLoading("Loading history...");

  /*const res = await apiGet({
    action: "history",
    idToken: state.idToken,
    recordKey: state.selected.recordKey
  });*/
  const res = await apiPost("history", { recordKey: state.selected.recordKey });

  if (res.status !== "success") {
    toast(res.message || "History load failed");
    console.warn(res.message || "History load failed");
    return;
  }

  const items = res.items || [];

  historyWrap.innerHTML = `
    <h3>Remarks History</h3>
    ${items.map(x => `
      <div class="history-item">
        <div><b>${escapeHtml(x.updatedBy)}</b> • ${escapeHtml(x.timestamp)}</div>
        <div class="muted">${escapeHtml(x.action)}</div>
        <div>${escapeHtml(x.remarks)}</div>
        <div class="muted">Done: ${escapeHtml(x.done)}</div>
      </div>
    `).join("")}
  `;

  hideLoading();
  historyWrap.classList.remove("hidden");
}

/* ===========================
   SAVE RECORD
=========================== */
/*******************************************************
* function name: saveCurrent
* parameter: none
* return: <void>
* purpose: Saves current student remarks and done status, supports offline queueing and online API update.
********************************************************/
async function saveCurrent() {
  showLoading("Please wait, saving remarks...");
  if (!state.selected) return;

  if (state.me.role === "student") {
    hideLoading();
    toast("Students cannot edit remarks.");
    return;
  }

  if (!dRemarks.value) {
    hideLoading();
    toast("Please input a remarks or message.");
    return;
  }

  const body = {
    email: state.selected.email,
    timestamp: state.selected.timestamp,
    studentId: state.selected.studentId,
    remarks: dRemarks ? (dRemarks.value || "") : "",
    done: dDone ? dDone.checked : false
  };

  if (!navigator.onLine) {
    hideLoading();
    const pending = loadPendingUpdates();
    pending.push({
      type: "update",
      idToken: state.idToken,
      body,
      queuedAt: new Date().toISOString()
    });

    savePendingUpdates(pending);
    updateSyncBadge();
    hideLoading();
    toast("Saved offline. Will sync when online.");
    showScreen(screenDetails);
    return;
  }

  const res = await apiPost("update", body);

  if (res.status !== "success") {
    hideLoading();
    toast(res.message || "Save failed");
    console.warn(res.message || "Save failed");
    return;
  }

  toast("Saved!");
  // ✅ stay on details screen
  showScreen(screenDetails);

  // refresh list silently (optional, para updated done/remarks)
  loadList(false);

  // reopen same student details para updated values
  openStudentDetailsByEmail(state.selected.email);
  clearRemarksBox(); // ✅ auto clear after save
  hideLoading();
}

/*******************************************************
* function name: syncPendingUpdates
* parameter: none
* return: <void>
* purpose: Sends queued offline remark updates to the server when connection is restored.
********************************************************/
async function syncPendingUpdates() {

  if (!navigator.onLine) return;

  const pending = loadPendingUpdates();
  if (!pending.length) return;

  let failed = [];

  for (const job of pending) {
    try {
      if (job.type === "update") {
        const res = await apiPost(
          { action: "update", idToken: job.idToken },
          job.body
        );

        if (res.status !== "success") failed.push(job);
      } else {
        failed.push(job);
      }
    } catch (err) {
      failed.push(job);
    }
  }

  savePendingUpdates(failed);
  updateSyncBadge();
}

/*******************************************************
* function name: loadSeatPhotosInGrid
* parameter: none
* return: <void>
* purpose: Loads and caches student photos for all rendered seat cards using master student data.
********************************************************/
async function loadSeatPhotosInGrid() {

  try {
    if (!seatGrid) return;

    //console.log("Seat photo load start:", (state.seat.masterStudents || []).length, "master students");

    const imgs = seatGrid.querySelectorAll("img.seatPhoto[data-email]");
    if (!imgs.length) return;

    const master = (state.seat.masterStudents || []).filter(Boolean);

    const mapByEmail = new Map(
      master.map(s => [String(s.studentEmail || s.email || "").trim().toLowerCase(), s])
    );

    for (const img of imgs) {
      const email = (img.getAttribute("data-email") || "").trim().toLowerCase();
      if (!email) continue;

      const stu = mapByEmail.get(email);

      //console.log("Seat email:", email, "matched:", !!stu);

      if (!stu) continue;

      const photoRaw =
        stu.picture2x2_direct ||
        stu.picture2x2 ||
        stu.picture2x2Direct ||
        stu.picture2x2Link ||
        stu.picture2x2_url ||
        stu.picture ||
        stu.photo ||
        "";

      const fileId = extractDriveFileId(photoRaw);
      if (!fileId) continue;

      // RAM cache
      if (photoCache.has(fileId)) {
        img.src = photoCache.get(fileId);
        continue;
      }

      // IndexedDB cache
      const cached = await cacheGet("photo_" + fileId);
      if (cached) {
        img.src = cached;
        photoCache.set(fileId, cached);
        continue;
      }

      // API fetch
      /*const res = await apiGet({
        action: "photo",
        idToken: state.idToken,
        fileId
      });*/
      const res = await apiPost("photo", { fileId });

      if (res.status !== "success") continue;

      const mime = res.mimeType || "image/jpeg";
      const dataUrl = `data:${mime};base64,${res.base64}`;

      img.src = dataUrl;
      photoCache.set(fileId, dataUrl);
      await cacheSet("photo_" + fileId, dataUrl);
    }
  } catch (err) {
    //console.warn("Seat photo load failed:", err);
    toast("Seat photo load failed: " + err.toString());
    console.warn("Seat photo load failed: " + err.toString());
  }
}

/*******************************************************
* function name: openStudentDetailsByEmail
* parameter: email (string)
* return: <void>
* purpose: Fetches a student record by email and opens the details screen view.
********************************************************/
async function openStudentDetailsByEmail(email) {
  showLoading("Loading profile...");
  if (!email) {
    hideLoading();
    toast("Missing student email.");
    return;
  }

  try {
    /*const res = await apiGet({
      action: "recordByEmail",
      idToken: state.idToken,
      email: email
    });*/
    const res = await apiPost("recordByEmail", { email: email });

    if (!res || res.status !== "success" || !res.item) {
      toast(res?.message || "Student not found.");
      console.warn(res?.message || "Student not found.");
      return;
    }

    const item = res.item;

    if (!lastScreenBeforeDetails) {
      lastScreenBeforeDetails = state.currentScreen;
    }
    await openDetails(item, 0);
    clearRemarksBox();
    hideLoading();
  } catch (err) {
    toast("Open student error: " + err.toString());
    console.warn("Open student error: " + err.toString());
    hideLoading();
  }
}

/*******************************************************
* function name: saveSeat
* parameter: none
* return: <void>
* purpose: Saves or updates a seat assignment for the current room via seat map API.
********************************************************/
async function saveSeat() {
  showLoading();
  if (!state.seat.room) {
    toast("Select a room first.");
    hideLoading();
    return;
  }
  const seatNo = (inpSeatNo ? (inpSeatNo.value || "").trim() : "");
  if (!seatNo) {
    toast("Seat No is required.");
    hideLoading();
    return;
  }

  const body = {
    room: state.seat.room,
    seatNo: seatNo,
    studentEmail: inpSeatEmail ? (inpSeatEmail.value || "").trim() : "",
    studentId: inpSeatId ? (inpSeatId.value || "").trim() : "",
    studentName: inpSeatName ? (inpSeatName.value || "").trim() : ""
  };

  try {
    const res = await apiPost("seatmapSave", body);

    if (res.status !== "success") {
      toast(res.message || "Save seat failed");
      console.warn(res.message || "Save seat failed");
      hideLoading();
      return;
    }

    toast("Seat saved!");
    await loadSeatRoom(state.seat.room);
    hideLoading();
  } catch (e) {
    toast("Save seat error: " + e.toString());
    console.warn("Save seat error: " + e.toString());
    hideLoading();
  }
}

/*******************************************************
* function name: clearSeatEditor
* parameter: none
* return: void
* purpose: Clears all seat editor input fields.
********************************************************/
function clearSeatEditor() {
  if (inpSeatNo) inpSeatNo.value = "";
  if (inpSeatEmail) inpSeatEmail.value = "";
  if (inpSeatId) inpSeatId.value = "";
  if (inpSeatName) inpSeatName.value = "";
}

/*******************************************************
* function name: applyRoleUI
* parameter: -
* return: -
* purpose: -
********************************************************/
function applyRoleUI() {

  if (!state.me) return;

  const role = String(state.me.role || "").toLowerCase();

  // ===== STUDENT MODE =====
  if (role === "student") {

    // hide left record nav
    document.querySelectorAll(".recordNav").forEach(el => el.classList.add("hidden"));

    // hide header nav buttons
    document.querySelectorAll(".detailsHeaderBtns").forEach(el => el.classList.add("hidden"));

    // hide photo card
    document.querySelectorAll(".photo-card").forEach(el => el.classList.add("hidden"));

    // force single-column layout
    document.querySelectorAll(".details-grid").forEach(el => el.classList.add("student-mode"));

    // disable admin inputs
    if (dRemarks) dRemarks.disabled = true;
    if (dDone) dDone.disabled = true;

    // hide admin buttons
    if (btnSave) btnSave.classList.add("hidden");
    if (btnHistory) btnHistory.classList.add("hidden");
    if (btnLDev) btnLDev.classList.add("hidden");

    //disable grade inputs
    document.querySelectorAll(".gradeInput").forEach(input => {
      input.setAttribute("readonly", true);
    });

    //Hide editting buttons
    if (btnsaveTaskGrades) btnsaveTaskGrades.style.display = "none";
    if (btnaddTaskRow) btnaddTaskRow.style.display = "none";
    if (btnresetGradesUI) btnresetGradesUI.style.display = "none";

  }

  // ===== REVIEWER / ADMIN =====
  else {

    document.querySelectorAll(".recordNav").forEach(el => el.classList.remove("hidden"));

    document.querySelectorAll(".detailsHeaderBtns").forEach(el => el.classList.remove("hidden"));

    document.querySelectorAll(".photo-card").forEach(el => el.classList.remove("hidden"));

    document.querySelectorAll(".details-grid").forEach(el => el.classList.remove("student-mode"));

    if (dRemarks) dRemarks.disabled = false;
    if (dDone) dDone.disabled = false;

    if (btnSave) btnSave.classList.remove("hidden");
    if (btnHistory) btnHistory.classList.remove("hidden");
    if (btnLDev) btnLDev.classList.remove("hidden");
  }
}

/*******************************************************
* function name: applyStudentToModal
* parameter: stu (object)
* return: void
* purpose: Applies selected student data into seat edit modal fields with lock protection.
********************************************************/
function applyStudentToModal(stu) {

  if (!stu) return;

  seatEditLock = true;

  if (editStudentId) editStudentId.value = stu.studentId || "";
  if (editStudentEmail) editStudentEmail.value = stu.studentEmail || "";
  if (editStudentName) editStudentName.value = stu.studentName || "";

  seatEditLock = false;
}

/*******************************************************
* function name: goToMainMenu
* parameter: 
* return: 
* purpose: 
********************************************************/
function goToMainMenu() {

  showScreen(screenMenu);
}

/* ===========================
   DASHBOARD
=========================== */
/*******************************************************
* function name: buildDashboardData
* parameter: 
* return: 
* purpose: Build analytics from backend dashboardAll data
********************************************************/
function buildDashboardData() {

  const students = state.dashboard || [];

  const total = students.length;

  let failing = [];
  let passing = [];
  let pending = [];

  let withSeat = 0;
  let withoutSeat = 0;

  let pendingBreakdown = {
    noRemarks: 0,
    notDone: 0,
    noProof: 0
  };

  students.forEach(stu => {

    const grade = Number(stu.finalGrade || 0);

    // ✅ SEAT
    if (stu.hasSeat) withSeat++;
    else withoutSeat++;

    // ✅ GRADES
    if (grade > 0 && grade < 75) failing.push(stu);
    else if (grade >= 75) passing.push(stu);

    // ✅ PENDING
    const issues = [];

    if (!stu.hasRemarks) {
      issues.push("No remarks");
      pendingBreakdown.noRemarks++;
    }

    if (!stu.done) {
      issues.push("Not done");
      pendingBreakdown.notDone++;
    }

    if (!stu.hasProof) { // ← ensure backend sends this
      issues.push("No proof");
      pendingBreakdown.noProof++;
    }

    if (issues.length) {
      pending.push({
        ...stu,
        issues
      });
    }

  });

  return {
    total,
    failing,
    passing,
    pending,
    withSeat,
    withoutSeat,
    pendingBreakdown
  };
}

/*******************************************************
* function name: renderDashboard
* parameter: 
* return: 
* purpose: Render dashboard UI using backend data
********************************************************/
function renderDashboard() {

  const wrap = document.getElementById("dashboardWrap");
  if (!wrap) return;

  const d = buildDashboardData();

  const passRate = d.total ? ((d.passing.length / d.total) * 100).toFixed(1) : 0;

  const failRate = d.total ? ((d.failing.length / d.total) * 100).toFixed(1) : 0;

  wrap.innerHTML = `
    <div class="dashboardAnalytics">

      ${renderKPI("Total Students", d.total)}
      ${renderKPI("Passing", d.passing.length, passRate + "%")}
      ${renderKPI("Pending", d.pending.length)}
      ${renderKPI("Failing", d.failing.length, failRate + "%")}

      ${renderProgress("Pass Rate", passRate)}
      ${renderProgress("Fail Rate", failRate)}

      ${renderSeatAnalytics(d)}
      ${renderPendingBreakdown(d)}

      ${renderTopList("⚠️ Failing Students", d.failing)}
      ${renderTopList("📝 Pending Students", d.pending, true)}

    </div>
  `;
}

function renderKPI(title, value, sub = "") {
  return `
    <div class="kpiCard">
      <div class="kpiTitle">${title}</div>
      <div class="kpiValue">${value}</div>
      ${sub ? `<div class="kpiSub">${sub}</div>` : ""}
    </div>
  `;
}

function renderProgress(title, percent) {
  return `
    <div class="progressCard">
      <div class="progressTitle">${title} (${percent}%)</div>
      <div class="progressBar">
        <div class="progressFill" style="width:${percent}%"></div>
      </div>
    </div>
  `;
}

function renderSeatAnalytics(d) {
  const total = d.withSeat + d.withoutSeat;

  const assigned = total ? ((d.withSeat / total) * 100).toFixed(1) : 0;

  return `
    <div class="dashboardCard">
      <div class="dashboardTitle">Seat Assignment</div>

      <div class="progressBar">
        <div class="progressFill" style="width:${assigned}%"></div>
      </div>

      <div class="muted">
        ${d.withSeat} assigned / ${d.withoutSeat} unassigned
      </div>
    </div>
  `;
}

function renderPendingBreakdown(d) {
  const p = d.pendingBreakdown;

  return `
    <div class="dashboardCard">
      <div class="dashboardTitle">Pending Breakdown</div>

      <div class="muted">No Remarks: ${p.noRemarks}</div>
      <div class="muted">Not Done: ${p.notDone}</div>
      <div class="muted">No Proof of Enrollment: ${p.noProof}</div>
    </div>
  `;
}

function renderTopList(title, list, showIssues = false) {
  lastScreenBeforeDetails = "menu";
  return `
    <div class="dashboardCard">
      <div class="dashboardTitle">${title}</div>

      <div class="dashboardList">
        ${list.slice(0, 10).map(stu => `
          <div class="dashboardItem" onclick="openStudentDetailsByEmail('${stu.email}')">

            <b>${(stu.fullName || stu.studentName).toUpperCase()}</b><br>
            <span>${stu.studentId || ""}</span>

            ${showIssues && stu.issues ? `<div style="color:#ef4444;font-size:11px;">${stu.issues.join(", ")}</div>` : ""}
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

/*******************************************************
* function name: loadDashboard
* parameter: 
* return: 
* purpose: 
********************************************************/
async function loadDashboard() {

  const wrap = document.getElementById("dashboardWrap");
  if (!wrap) return;

  // show loading text while waiting
  if (wrap) wrap.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:#94a3b8;">
          Loading...
        </td>
      </tr>
    `;

  const res = await apiPost("dashboardAll", {
    schoolYear: state.filters.schoolYear || "",
    term: state.filters.term || "",
    courseSubject: state.filters.courseSubject || ""
  });

  if (res.status !== "success") {
    toast(res.message || "Dashboard load failed");
    console.warn("Dashboard load failed: ", res.message);
    return;
  }

  state.dashboard = res.students || [];

  // 🔥 IMPORTANT FIX
  state.list.items = res.students.map(s => ({
    studentId: s.studentId,
    fullName: s.fullName,
    email: s.email || "",        // must exist (see backend fix below)
    remarks: s.hasRemarks ? "✔" : "",
    done: s.done,
    enrollmentProof: s.hasProof ? "✔" : ""
  }));

  renderDashboard();
}

/* ===========================
   EVENTS
=========================== */
if (btnSaveConfig) {
  btnSaveConfig.onclick = () => {
    state.apiUrl = (inpApiUrl ? (inpApiUrl.value || "").trim() : "");
    state.clientId = (inpClientId ? (inpClientId.value || "").trim() : "");

    if (!state.apiUrl || !state.clientId) {
      toast("Please input API URL and Client ID.");
      return;
    }

    saveSetup(state.apiUrl, state.clientId);
    toast("Setup saved!");
    renderGoogleLoginButton();
  };
}

if (selPageSize) {
  selPageSize.onchange = async () => {
    /*const n = parseInt(selPageSize.value, 10);
    state.list.pageSize = isNaN(n) ? 20 : n;
    state.list.page = 1; // reset to first page*/
    const val = selPageSize.value;

    state.list.pageSize = (val === "ALL") ? "ALL" : parseInt(val, 10);
    state.list.page = 1;
    saveSession();
    await loadList(true);
  };
}

if (btnClearConfig) {
  btnClearConfig.onclick = () => {
    clearSetup();
    if (inpApiUrl) inpApiUrl.value = "";
    if (inpClientId) inpClientId.value = "";
    toast("Setup cleared.");
  };
}

if (btnHelp) {
  btnHelp.onclick = () => {
    if (!helpModal) return;
    helpModal.classList.remove("hidden");
  };
}

if (btnAbout) btnAbout.onclick = () => openModal(aboutModal);
if (btnSupport) btnSupport.onclick = () => openModal(supportModal);
if (btnChangelog) btnChangelog.onclick = () => openModal(changelogModal);

if (btnCloseHelp) {
  btnCloseHelp.onclick = () => {
    if (!helpModal) return;
    helpModal.classList.add("hidden");
  };
}

// click outside closes modal
if (helpModal) {
  helpModal.onclick = (e) => {
    if (e.target === helpModal) helpModal.classList.add("hidden");
  };
}

if (btnCloseAbout) btnCloseAbout.onclick = () => closeModal(aboutModal);
if (btnCloseSupport) btnCloseSupport.onclick = () => closeModal(supportModal);
if (btnCloseChangelog) btnCloseChangelog.onclick = () => closeModal(changelogModal);
if (btnCloseDebug) btnCloseDebug.onclick = () => closeModal(debugModal);

attachModalBackdropClose(helpModal);
attachModalBackdropClose(aboutModal);
attachModalBackdropClose(supportModal);
attachModalBackdropClose(changelogModal);
attachModalBackdropClose(debugModal);

if (btnResetApp) btnResetApp.onclick = async () => {
  const ok = confirm(
    "RESET APP?\n\nThis will clear:\n- Session\n- Pending Sync Queue\n- Cached data (IndexedDB)\n\nYou will need to login again."
  );
  if (!ok) return;

  await cacheClearAll(); // ✅ clear IndexedDB cache
  await deleteEvidenceDB();     // ✅ delete offline evidence DB too

  localStorage.removeItem("sf_apiUrl");
  localStorage.removeItem("sf_clientId");
  localStorage.removeItem(LS_SESSION);
  localStorage.removeItem(LS_PENDING_UPDATES);
  localStorage.removeItem(PENDING_SYNC_KEY);

  toast("Reset done. Reloading app...");
  location.reload();
  forceLogout();
};

if (netBadge) {
  netBadge.ondblclick = () => {
    if (!state.me || state.me.role !== "admin") return;
    refreshDebugInfo();
    openModal(debugModal);
  };
}

if (btnLogout) {
  btnLogout.onclick = () => {

    // ✅ Clear saved session + offline queue
    clearSession();
    localStorage.removeItem(LS_PENDING_UPDATES);
    localStorage.removeItem(PENDING_SYNC_KEY);
    localStorage.removeItem("sf_id_token");
    localStorage.removeItem("sf_login_time");

    // ✅ Reset auth
    state.idToken = "";
    state.me = null;
    state.selected = null;
    state.currentStudent = null;
    state.gradeTasks = [];
    state.learnerDev = {
      categories: [],
      scores: {}
    };

    // ✅ Reset filters + UI
    state.filters.schoolYear = "";
    state.filters.term = "";
    state.filters.courseSubject = "";
    state.filters.program = "";

    state.ui.search = "";
    state.ui.noRemarks = false;
    state.ui.onlyAssigned = true;
    state.ui.notDone = false;

    // ✅ Reset list
    state.list.page = 1;
    state.list.total = 0;
    state.list.items = [];

    // ✅ Reset seat map
    state.seat.room = "";
    state.seat.editMode = false;
    state.seat.seats = [];
    state.seat.editingSeat = null;

    // reset navigation memory
    lastScreenBeforeDetails = null;

    // ✅ Clear UI elements
    if (inpSearch) inpSearch.value = "";
    if (chkNoRemarks) chkNoRemarks.checked = false;
    if (chkOnlyAssigned) chkOnlyAssigned.checked = true;
    if (chkNotDone) chkNotDone.checked = false;

    if (fSchoolYear) fSchoolYear.value = "";
    if (fTerm) fTerm.value = "";
    if (fCourseSubject) fCourseSubject.value = "";
    if (fProgram) fProgram.value = "";

    if (listWrap) listWrap.innerHTML = "";
    if (recordNavList) recordNavList.innerHTML = "";
    if (evidenceList) evidenceList.innerHTML = "";
    if (historyWrap) {
      historyWrap.classList.add("hidden");
      historyWrap.innerHTML = "";
    }

    // seat UI cleanup
    if (seatRoomLabel) seatRoomLabel.textContent = "Room: -";
    if (seatGrid) seatGrid.innerHTML = "";
    if (selSeatRoom) selSeatRoom.innerHTML = "";
    clearSeatEditor();

    // hide user badge + logout button
    if (userBadge) userBadge.classList.add("hidden");
    if (btnHelp) btnHelp.classList.add("hidden");
    if (btnAbout) btnAbout.classList.add("hidden");
    if (btnSupport) btnSupport.classList.add("hidden");
    if (btnChangelog) btnChangelog.classList.add("hidden");
    if (btnResetApp) btnResetApp.classList.add("hidden");
    if (btnLogout) btnLogout.classList.add("hidden");

    // hide badges
    hideNetBadge();
    if (syncBadge) syncBadge.classList.add("hidden");

    // hide grading summary, learner dev
    //document.getElementById('tabContentGrades')?.classList.add('hidden');
    //document.getElementById('tabContentLearnerDev')?.classList.add('hidden');
    document.body.classList.remove("student-mode");

    // go back to login/setup screen
    showScreen(screenConfig);
  };
}

//if (btnBackToSetup) btnBackToSetup.onclick = () => showScreen(screenConfig);   // ✅ back to MAIN MENU
if (btnBackToSetup) {
  btnBackToSetup.onclick = () => {
    state.ui = state.ui || {};
    state.ui.lastMenu = "menu";
    state.currentScreen = "menu";
    saveSession();
    showScreen(screenMenu);
  };
}

if (fSchoolYear) {
  fSchoolYear.onchange = async () => {
    state.filters.schoolYear = fSchoolYear.value;
    await loadCascadeOptions();
    saveSession();
  };
}
if (fTerm) {
  fTerm.onchange = async () => {
    state.filters.term = fTerm.value;
    await loadCascadeOptions();
    saveSession();
  };
}

if (fCourseSubject) {
  fCourseSubject.onchange = async () => {
    state.filters.courseSubject = fCourseSubject.value;
    await loadCascadeOptions();
    saveSession();
  };
}

if (fProgram) {
  fProgram.onchange = async () => {
    state.filters.program = fProgram.value;
    await loadCascadeOptions();
    saveSession();
  };
}

if (btnGoList) {
  btnGoList.onclick = async () => {
    state.filters.schoolYear = fSchoolYear ? fSchoolYear.value : "";
    state.filters.term = fTerm ? fTerm.value : "";
    state.filters.courseSubject = fCourseSubject ? fCourseSubject.value : "";
    state.filters.program = fProgram ? fProgram.value : "";
    state.ui.search = "";
    inpSearch.value = "";

    state.list.page = 1;

    showLoading("Loading Records...");

    showScreen(screenList);
    await loadList(true);

    hideLoading();
  };
}

if (btnChangeFilter) btnChangeFilter.onclick = () => showScreen(screenFilters);
if (btnRefresh) btnRefresh.onclick = async () => await loadList(true);

if (inpSearch) {
  setupAutocomplete(inpSearch, "name");
  inpSearch.oninput = () => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(async () => {
      const value = inpSearch.value.trim();

      // Do not call API if short text (prevents quota error)
      if (value.length < 2) return;

      state.ui.search = value || "";

      await loadList(true);
    }, 0); // 100ms wait after typing
  };
}

if (chkNoRemarks) {
  chkNoRemarks.onchange = async () => {
    state.ui.noRemarks = chkNoRemarks.checked;
    await loadList(true);
  };
}

if (chkOnlyAssigned) {
  chkOnlyAssigned.onchange = async () => {
    state.ui.onlyAssigned = chkOnlyAssigned.checked;
    await loadList(true);
  };
}

if (chkNotDone) {
  chkNotDone.onchange = async () => {
    state.ui.notDone = chkNotDone.checked;
    await loadList(true);
  };
}

if (btnPrev) {
  btnPrev.onclick = async () => {
    showLoading();
    if (state.list.page <= 1) return;
    if (state.list.page > 1) {
      state.list.page--;
      await loadList(false);
      hideLoading();
    }
  };
}

if (btnNext) {
  btnNext.onclick = async () => {
    showLoading();
    if (state.list.page >= state.list.maxPage) return;
    state.list.page++;
    await loadList(false);
    hideLoading();
  };
}

if (btnPrevTop) {
  btnPrevTop.onclick = async () => {
    showLoading();
    if (state.list.page <= 1) return;
    if (state.list.page > 1) {
      state.list.page--;
      await loadList(false);
      hideLoading();
    }
  };
}

if (btnNextTop) {
  btnNextTop.onclick = async () => {
    showLoading();
    if (state.list.page >= state.list.maxPage) return;
    state.list.page++;
    await loadList(false);
    hideLoading();
  };
}

if (btnBackToList) {
  btnBackToList.onclick = () => {
    if (lastScreenBeforeDetails === "seatmap") {
      //document.getElementById('tabContentGrades')?.classList.add('hidden');
      showScreen(screenSeatMap);
      lastScreenBeforeDetails = null;
      return;
    } else if (lastScreenBeforeDetails === "menu") {
      //document.getElementById('tabContentGrades')?.classList.add('hidden');
      showScreen(screenMenu);
    } else {
      //document.getElementById('tabContentGrades')?.classList.add('hidden');
      showScreen(screenList);
    }
  };
}

if (btnSave) btnSave.onclick = saveCurrent;
if (btnHistory) btnHistory.onclick = loadHistory;
if (btnLDev) btnLDev.onclick = () => openDetailsTab("learner");
if (btnGrades) btnGrades.onclick = () => openDetailsTab("grades");
if (btnUploadEvidence) {
  btnUploadEvidence.onclick = async () => {
    try {
      if (!state.selected) {
        toast("No student selected.");
        return;
      }
      const file = inpEvidenceFile ? inpEvidenceFile.files[0] : null;
      /*if (!file) {
        hideLoading();
        toast("Please choose a file first.");
        return;
      }*/

      await handleUploadEvidence(file);
      await loadEvidenceList();
    } catch (err) {
      toast("Upload error: " + err.toString());
      console.warn("Upload error: " + err.toString());
    }
  };
}

if (btnaddTaskRow) btnaddTaskRow.onclick = () => addTaskRow();
if (btnsaveTaskGrades) btnsaveTaskGrades.onclick = () => saveTaskGrades();
if (btnresetGradesUI) btnresetGradesUI.onclick = () => resetGradeUI();   //resetGradesUI -> resetGradeUI
if (btnaddLearnerDev) btnaddLearnerDev.onclick = () => addLearnerDev();
if (btnsaveLearnerDev) btnsaveLearnerDev.onclick = () => saveLearnerDev();

if (btnrunExport) btnrunExport.onclick = () => {
  showLoading("Exporting GRADES. Please wait...");
  runExport();
}

if (btnclosescreenExport) btnclosescreenExport.onclick = () => closescreenExport();

if (btnhandleJsonUpload) btnhandleJsonUpload.onclick = () => handleJsonUpload();
if (btndownloadAddin) btndownloadAddin.onclick = () => downloadAddin();
if (btnclosescreenImport) btnclosescreenImport.onclick = () => closescreenImport();

if (btngoToMainMenu) btngoToMainMenu.onclick = () => goToMainMenu();

if (btnPvSave) {
  btnPvSave.onclick = async () => {
    if (state.me.role === "student") {
      toast("Students cannot edit remarks.");
      return;
    }
    if (!state.seat.currentSeat) return;

    const text = document.getElementById("pvRemarks").value.trim();
    if (!text) {
      toast("Please input a remarks or message.");
      return;
    }

    const seat = state.seat.currentSeat;

    // 🔥 get real record first (with timestamp)
    /*const recRes = await apiGet({
      action: "recordByEmail",
      idToken: state.idToken,
      email: seat.studentEmail
    });*/
    const recRes = await apiPost("recordByEmail", { email: seat.studentEmail });

    if (recRes.status !== "success" || !recRes.item) {
      toast("Record not found");
      return;
    }

    const rec = recRes.item;

    const res = await apiPost("update", {
      email: rec.email,
      studentId: rec.studentId,
      timestamp: rec.timestamp,   // ✅ REAL timestamp
      remarks: text,
      done: rec.done || false
    });

    if (res.status === "success") {
      seat.remarks = text;
      document.getElementById("pvRemarks").value = "";
      toast("Remarks saved ✔");
    } else {
      toast("Save failed. " || res.message);
      console.warn("Save failed. " || res.message);
    }
  };
}

if (btnPvMSave) {
  btnPvMSave.onclick = async () => {
    if (state.me.role === "student") {
      toast("Students cannot edit remarks.");
      return;
    }

    if (!state.seat.currentSeat) return;

    const text = document.getElementById("pvMRemarks").value.trim();
    if (!text) {
      toast("Please input a remarks or message.");
      return;
    }

    const seat = state.seat.currentSeat;

    /*const recRes = await apiGet({
      action: "recordByEmail",
      idToken: state.idToken,
      email: seat.studentEmail
    });*/
    const recRes = await apiPost("recordByEmail", { email: seat.studentEmail });

    if (recRes.status !== "success" || !recRes.item) {
      toast("Record not found");
      return;
    }

    const rec = recRes.item;

    const res = await apiPost("update", {
      email: rec.email,
      studentId: rec.studentId,
      timestamp: rec.timestamp,
      remarks: text,
      done: rec.done || false
    });

    if (res.status === "success") {
      seat.remarks = text;
      document.getElementById("pvMRemarks").value = "";
      toast("Remarks saved ✔");
    } else {
      toast("Save failed. " || res.message);
      console.warn("Save failed. " || res.message);
    }
  };
}

// Fullscreen photo modal
if (dPhoto) {
  dPhoto.style.cursor = "zoom-in";
  dPhoto.onclick = () => {
    if (!dPhoto.src) return;
    modalPhoto.src = dPhoto.src;
    openModal(photoModal);
  };
}

if (btnClosePhoto) {
  btnClosePhoto.onclick = () => {
    if (photoModal) photoModal.classList.add("hidden");
  };
}

if (photoModal) {
  photoModal.onclick = (e) => {
    if (e.target === photoModal) photoModal.classList.add("hidden");
  };
}

// Accordions
if (btnBasicInfo) btnBasicInfo.onclick = () => toggleAccordion(basicInfoWrap, basicArrow);
if (btnOtherInfo) btnOtherInfo.onclick = () => toggleAccordion(otherInfoWrap, otherArrow);

// Seat Map open
if (btnOpenSeatMap) {
  btnOpenSeatMap.onclick = async () => {
    showScreen(screenSeatMap);
    updateDeleteRoomButtonVisibility();
    await loadSeatMapMaster();

    // ✅ Always show add seat button if admin
    if (state.me && state.me.role === "admin" && btnAddTable) {
      btnAddTable.classList.remove("hidden");
    }
  };
}

if (btnLoadSeatRoom) {
  btnLoadSeatRoom.onclick = async () => {
    const room = selSeatRoom ? (selSeatRoom.value || "").trim() : "";

    showLoading("Loading Room " + room + "...");

    if (!room) {
      hideLoading();
      toast("Select a room.");
      if (btnAddTable) btnAddTable.classList.add("hidden");
      if (seatRoomLabel) seatRoomLabel.textContent = "Room: -";
      state.seat.room = "";
      return;
    }

    // ✅ SET CURRENT ROOM STATE
    state.seat.room = room;
    selSeatRoom.value = room;

    // Loading room

    // ✅ UPDATE ROOM LABEL SA UI
    if (seatRoomLabel) seatRoomLabel.textContent = `Room: ${room}`;

    // show Add Seat button (admin tools)
    if (btnAddTable) btnAddTable.classList.remove("hidden");

    // show loading text while waiting
    if (seatGrid) seatGrid.innerHTML = `<div class="muted">Loading seats from Room ${room}...</div>`;

    updateDeleteRoomButtonVisibility();

    // background load master list
    loadSeatMapMaster();

    // load seats (cached first, then online)
    await loadSeatRoom(room);

    // refresh debug info if open
    refreshDebugInfo();

    saveSession();

    hideLoading();
  };
}

if (btnSeatBack) {
  btnSeatBack.onclick = () => {
    state.nav.backTo = "menu";
    showScreen(screenMenu);

    // reset room label until loaded
    if (seatRoomLabel) seatRoomLabel.textContent = "Room: -";

    // clear state
    state.seat.room = "";
    state.seat.seats = [];

    // clear grid
    if (seatGrid) seatGrid.innerHTML = "";
  };
}

if (menuStudentInfo) {
  menuStudentInfo.onclick = () => {
    showScreen(screenFilters); // Student info -> filter screen
  };
}

if (menuSeatMapInfo) {
  menuSeatMapInfo.onclick = () => {
    showScreen(screenSeatMap); // Seat map screen
  };
}

if (menuExport) {
  menuExport.onclick = async () => {
    showScreen(screenExport); // Export to excel/pdf

    await preloadExportData();

    const scopeSelect = document.getElementById("exportScope").value;
    if (scopeSelect) scopeSelect.value = "section";

    // default = section
    onExportScopeChange(scopeSelect);
  };
}

if (menuExportMainList) {
  menuExportMainList.onclick = async () => {
    showLoading("Exporting student main list");
    //showScreen(screenSeatMap); // Seat map screen
    const studList = await getStudentsForExport("", "", "");

    exportStudentListCSV(studList);
    hideLoading();
  };
}

if (menuImportDownload) {
  menuImportDownload.onclick = () => {
    showScreen(screenImport); // Import JSON
  };
}

if (btnSeatAddRoom) {
  btnSeatAddRoom.onclick = () => {
    seatAddRoomWrap.classList.remove("hidden");
    inpNewRoom.focus();
  };
}

if (btnCancelAddRoom) {
  btnCancelAddRoom.onclick = () => {
    seatAddRoomWrap.classList.add("hidden");
    inpNewRoom.value = "";
  };
}

if (btnAddTable) {
  btnAddTable.onclick = async () => {
    showLoading();

    // must have room selected
    const room = ((state.seat.room || "").trim() || (selSeatRoom ? (selSeatRoom.value || "").trim() : ""));
    if (!room) {
      hideLoading();
      toast("Please load/select a room first.");
      return;
    }

    // EDIT MODE only
    if (state.seat.editMode !== true) {
      hideLoading();
      toast("Turn ON Edit Mode to add seat.");
      return;
    }

    // get current seats
    const seats = Array.isArray(state.seat.seats) ? state.seat.seats : [];

    // find max seatNo (numeric)
    let maxSeat = 0;
    for (const s of seats) {
      const n = parseInt(s?.seatNo, 10);
      if (!isNaN(n)) maxSeat = Math.max(maxSeat, n);
    }

    // if no seats yet, start at 1001
    const nextSeatNo = (maxSeat > 0 ? maxSeat + 1 : 1001);

    try {
      // ✅ SAVE EMPTY SEAT TO GSHEET
      const body = {
        room: room,
        seatNo: String(nextSeatNo),
        studentEmail: "",
        studentId: "",
        studentName: ""
      };

      const res = await apiPost("seatmapSave", body);

      if (res.status !== "success") {
        hideLoading();
        toast(res.message || "Failed adding seat.");
        console.warn(res.message || "Failed adding seat.");
        return;
      }

      // ✅ Reload from sheet so UI is always correct
      await loadSeatRoom(room);

      hideLoading();
      toast(`Seat ${nextSeatNo} added!`);

    } catch (err) {
      hideLoading();
      toast("Add seat error: " + err.toString());
      console.warn("Add seat error: " + err.toString());
    }
  };
}

if (btnRemoveSeat) btnRemoveSeat.onclick = removeLastSeat;

if (btnCancelTable) {
  btnCancelTable.onclick = () => {
    addTableWrap.classList.add("hidden");
  };
}

if (btnSaveTable) {
  btnSaveTable.onclick = async () => {
    const room = selSeatRoom ? (selSeatRoom.value || "") : "";
    const seatNo = inpTableSeatNo ? inpTableSeatNo.value.trim() : "";

    const studentId = inpAddStudentId ? inpAddStudentId.value.trim() : "";
    const studentEmail = inpAddStudentEmail ? inpAddStudentEmail.value.trim() : "";
    const studentName = inpTableStudentName ? inpTableStudentName.value.trim() : "";

    if (!room) return toast("Please select a room first.");
    if (!seatNo) return toast("Please enter Table/Seat No.");
    if (!studentId) return toast("Please enter Student ID.");
    if (!studentEmail) return toast("Please enter Student E-mail address (student@sscr.edu).");
    if (!studentName) return toast("Please enter Student Name.");

    try {
      const body = {
        room,
        seatNo,
        studentEmail,
        studentId,
        studentName
      };

      const res = await apiPost("seatmapSave", body);

      if (res.status !== "success") {
        toast(res.message || "Failed saving table.");
        console.warn(res.message || "Failed saving table.");
        return;
      }

      toast("Table saved!");
      await loadSeatRoom(room);

      // clear + hide
      if (addTableWrap) addTableWrap.classList.add("hidden");
      if (inpTableSeatNo) inpTableSeatNo.value = "";
      if (inpTableStudentName) inpTableStudentName.value = "";
      if (inpAddStudentId) inpAddStudentId.value = "";
      if (inpAddStudentEmail) inpAddStudentEmail.value = "";

    } catch (err) {
      toast("Save table error: " + err.toString());
      console.warn("Save table error: " + err.toString());
    }
  };
}

if (selSeatRoom) {
  selSeatRoom.onchange = () => {
    // hide add table UI
    // keep visible for admin even if room not loaded yet
    if (btnAddTable) {
      if (state.me && state.me.role === "admin") btnAddTable.classList.remove("hidden");
      else btnAddTable.classList.add("hidden");
    }
  };
}

if (btnSeatEditToggle) {
  btnSeatEditToggle.onclick = () => {
    if (!state.me || state.me.role !== "admin") {
      toast("Admin only.");
      return;
    }

    state.seat.editMode = !state.seat.editMode;
    updateSeatEditUI(); // ✅ apply Fix 25 behavior

    // update Delete Room button visibility
    updateDeleteRoomButtonVisibility();
  };
}

if (editStudentId) {
  editStudentId.oninput = () => {
    if (seatEditLock) return;
    const stu = findStudentById(editStudentId.value);
    if (stu) applyStudentToModal(stu);
  };
}

if (editStudentEmail) {
  editStudentEmail.oninput = () => {
    if (seatEditLock) return;
    const stu = findStudentByEmail(editStudentEmail.value);
    if (stu) applyStudentToModal(stu);
  };
}

/* OBSOLETE */
/*if (editStudentName) {
  editStudentName.oninput = () => {
    if (seatEditLock) return;
    const stu = findStudentByName(editStudentName.value);
    if (stu) applyStudentToModal(stu);
  };
}*/

if (btnCloseSeatEdit) {
  btnCloseSeatEdit.onclick = () => closeSeatEditModal(true);
}

if (btnSeatEditCancel) {
  btnSeatEditCancel.onclick = () => closeSeatEditModal(true);
}
if (btnDeleteRoom) btnDeleteRoom.onclick = deleteRoom;

if (seatEditModal) {
  setupAutocomplete(editStudentName, "name");
  setupAutocomplete(editStudentId, "id");
  setupAutocomplete(editStudentEmail, "email");
  seatEditModal.addEventListener("click", e => {
    if (e.target === seatEditModal) {
      closeSeatEditModal(true);
    }
  });
}

if (btnSeatEditSave) {
  btnSeatEditSave.onclick = async () => {
    if (!state.me || state.me.role !== "admin") {
      toast("Admin only.");
      return;
    }

    if (!state.seat.room) {
      toast("No room loaded.");
      return;
    }

    const seatNo = editSeatNo ? editSeatNo.value.trim() : "";
    if (!seatNo) {
      toast("Seat No is required.");
      return;
    }

    const body = {
      room: state.seat.room,
      seatNo: seatNo,
      studentEmail: editStudentEmail ? editStudentEmail.value.trim() : "",
      studentId: editStudentId ? editStudentId.value.trim() : "",
      studentName: editStudentName ? editStudentName.value.trim() : ""
    };

    try {

      setSeatEditLocked(true); // ✅ lock

      const res = await apiPost("seatmapSave", body);

      if (res.status !== "success") {
        throw new Error("Save failed. " || res.message);
      }

      toast("✅ Seat updated!");
      closeSeatEditModal();
      await loadSeatRoom(state.seat.room);

    } catch (err) {
      toast("Save error: " + err.toString());
      console.warn("Save error: " + err.toString());
    } finally {
      setSeatEditLocked(false); // ✅ Always unlock
    }
  };
}

if (btnSeatEditDelete) {
  btnSeatEditDelete.onclick = async () => {

    // ✅ CONFIRMATION FIRST
    const ok = confirm("Are you sure you want to delete this seat assignment?\n\nThis will clear the student info from this seat.");
    if (!ok) return;

    if (!state.me || state.me.role !== "admin") {
      toast("Admin only.");
      return;
    }

    if (!state.seat.room) {
      toast("No room loaded.");
      return;
    }

    const seatNo = editSeatNo ? editSeatNo.value.trim() : "";
    if (!seatNo) {
      toast("Seat No is required.");
      return;
    }

    // ✅ Clear student fields but keep seatNo
    const body = {
      room: state.seat.room,
      seatNo: seatNo,
      studentEmail: "",
      studentId: "",
      studentName: ""
    };

    try {
      setSeatEditLocked(true); // ✅ lock

      const res = await apiPost("seatmapSave", body);

      if (res.status !== "success") {
        throw new Error(res.message || "Clear failed");
      }

      toast("Seat cleared!");
      closeSeatEditModal();
      await loadSeatRoom(state.seat.room);

    } catch (err) {
      toast("Clear error: " + err.toString());
      console.warn("Clear error: " + err.toString());
    } finally {
      setSeatEditLocked(false); // ✅ Always unlock
    }
  };
}

/* OBSOLETE */
/*******************************************************
* function name: setupAddTableAutofill
* parameter: none
* return: void
* purpose: Enables autofill linking between student ID, name, and email fields in add-seat form.
********************************************************/
/*function setupAddTableAutofill() {
 
  const inpId = document.getElementById("inpAddStudentId");
  const inpName = document.getElementById("inpTableStudentName"); // ✅ correct
  const inpEmail = document.getElementById("inpAddStudentEmail");
 
  if (!inpId || !inpName || !inpEmail) return;
 
  const students = state.seat.masterStudents || [];
  let lock = false;
 
  const findById = (id) => {
    const key = String(id || "").trim().toLowerCase();
    return students.find(s => String(s.studentId || "").trim().toLowerCase() === key);
  };
 
  const findByName = (name) => {
    const key = String(name || "").trim().toLowerCase();
    return students.find(s => String(s.studentName || "").trim().toLowerCase() === key);
  };
 
  inpId.oninput = () => {
    if (lock) return;
    const match = findById(inpId.value);
    if (match) {
      lock = true;
      inpName.value = match.studentName || "";
      inpEmail.value = match.studentEmail || "";
      lock = false;
    }
  };
 
  inpName.oninput = () => {
    if (lock) return;
    const match = findByName(inpName.value);
    if (match) {
      lock = true;
      inpId.value = match.studentId || "";
      inpEmail.value = match.studentEmail || "";
      lock = false;
    }
  };
}*/

if (btnRetryAllPending) {
  btnRetryAllPending.onclick = async () => {
    if (!navigator.onLine) {
      toast("Offline pa. Mag online muna bago mag Retry All.");
      return;
    }
    await syncPendingQueue();
  };
}

if (btnClearPending) {
  btnClearPending.onclick = () => {
    const ok = confirm("Clear ALL pending sync items?\n\nThis will delete all offline evidence too.");
    if (!ok) return;

    const q = getPendingQueue();

    // delete offline evidence blobs
    q.forEach(item => {
      if (item.type === "uploadEvidence" && item.offlineId) {
        idbDeleteEvidenceFile(item.offlineId).catch(() => { });
      }
    });

    setPendingQueue([]);
    pendingProgress.clear();
    renderPendingUI();
  };
}

if (btnSeatSave) btnSeatSave.onclick = saveSeat;
if (btnSeatClear) btnSeatClear.onclick = clearSeatEditor;

/* Fix 18: Add Room + Add Seat */
if (btnAddRoom) btnAddRoom.onclick = addRoom;
if (btnAddSeatOnly) btnAddSeatOnly.onclick = addSeatEmpty;

/* ===========================
   INIT
=========================== */
/*******************************************************
* function name: init
* parameter: none
* return: void
* purpose: Initializes app configuration, restores session, validates token, loads base data, and routes initial screen.
********************************************************/
(function init() {

  const cfg = loadSetup();

  // ✅ strict token restore check (no ghost session)
  const token = localStorage.getItem("sf_id_token");
  const loginTime = Number(localStorage.getItem("sf_login_time") || 0);

  const isValid = token && loginTime && (Date.now() - loginTime < SESSION_MAX_AGE_MS);

  if (isValid) {
    state.idToken = token;
  } else {
    state.idToken = "";
  }

  startNetWatcherOnce();
  // ===========================
  // PHOTO MODAL EVENTS
  // ===========================
  attachModalBackdropClose(photoModal);

  if (btnClosePhoto) {
    btnClosePhoto.onclick = () => closeModal(photoModal);
  }
  updateSyncBadge();

  state.apiUrl = cfg.apiUrl;
  state.clientId = cfg.clientId;

  // ✅ Restore session if available (stay logged in on refresh)
  const sess = loadSession();

  // ✅ SESSION EXPIRY CHECK
  const age = Date.now() - loginTime;

  if (sess.apiUrl) state.apiUrl = sess.apiUrl;
  if (sess.clientId) state.clientId = sess.clientId;
  if (sess.idToken) state.idToken = sess.idToken;

  if (sess.filters) state.filters = sess.filters;
  if (sess.ui) state.ui = sess.ui;

  if (sess.list?.page) state.list.page = sess.list.page;
  if (sess.list?.pageSize) state.list.pageSize = sess.list.pageSize;

  if (selPageSize) selPageSize.value = String(state.list.pageSize || 20);

  if (sess.room) state.seat.room = sess.room;

  // reflect restored config in inputs
  if (inpApiUrl) inpApiUrl.value = state.apiUrl;
  if (inpClientId) inpClientId.value = state.clientId;

  // ✅ Always render Google button if setup exists
  if (state.apiUrl && state.clientId) {
    renderGoogleLoginButton();
  }

  // ✅ IF may token, wag muna show screenConfig (avoid flicker)
  if (isValid) {
    // show temporary loading screen (best is Menu)
    //showScreen(screenMenu);

    (async () => {
      try {

        // prevent login screen flash during refresh restore
        document.body.classList.add("app-booting");
        showLoading("Loading, after refresh");
        refreshNetBadgeNow();

        //let me = await apiGet({ action: "me", idToken: state.idToken });
        let me = await apiPost("me", {});

        if (me.status === "network_error") {
          console.warn("me() network error — retrying once...");
          await new Promise(r => setTimeout(r, 800));
          //me = await apiGet({ action: "me", idToken: state.idToken });
          me = await apiPost("me", {});
        }

        if (!me || me.status !== "success") {
          forceLogout();
          hideLoading();
          return;
        }

        state.me = me;
        updateSeatEditUI();
        applyRoleUI();

        document.body.classList.remove("student-mode");
        if (state.me?.role === "student") {
          document.body.classList.add("student-mode");
        }

        const displayName = (me.name || "").trim() || me.email;
        if (userBadge) {
          userBadge.textContent = `${displayName} (${me.role})`;
          userBadge.classList.remove("hidden");
        }
        // ✅ SHOW TOP BUTTONS EVEN AFTER REFRESH (not only after login)
        if (btnHelp) btnHelp.classList.remove("hidden");
        if (btnAbout) btnAbout.classList.remove("hidden");
        if (btnSupport) btnSupport.classList.remove("hidden");
        if (btnChangelog) btnChangelog.classList.remove("hidden");
        if (btnResetApp) btnResetApp.classList.remove("hidden");
        if (btnLogout) btnLogout.classList.remove("hidden");

        if (seatAdminTools) {
          if (state.me.role === "admin") seatAdminTools.classList.remove("hidden");
          else seatAdminTools.classList.add("hidden");
        }

        // if student
        if (state.me?.role === "student") {
          try {
            // ❌ KEEP ADMIN TOOLS HIDDEN
            if (seatAdminTools) seatAdminTools.classList.add("hidden");
            if (btnSeatAddRoom) btnSeatAddRoom.classList.add("hidden");
            if (btnSeatEditToggle) btnSeatEditToggle.classList.add("hidden");

            // ❌ KEEP RECORD BUTTONS HIDDEN
            if (btnPrevRecord) btnPrevRecord.classList.add("hidden");
            if (btnNextRecord) btnNextRecord.classList.add("hidden");
            if (btnBackToList) btnBackToList.classList.add("hidden");

            // ❌ KEEP RECORD LIST PANEL HIDDEN
            const recordNav = document.querySelector(".recordNav");
            if (recordNav) recordNav.classList.add("hidden");

            // student flow
            //showScreen(screenDetails);

            // ❌ KEEP MENU CARDS HIDDEN
            if (menuStudentInfo) menuStudentInfo.classList.add("hidden");
            if (menuSeatMapInfo) menuSeatMapInfo.classList.add("hidden");
            if (btnOpenSeatMap) btnOpenSeatMap.classList.add("hidden");
            if (btnGoList) btnGoList.classList.add("hidden");

            const gradeAdminTools = document.getElementById("gradeAdminTools");
            if (gradeAdminTools) gradeAdminTools.classList.add("hidden");

            const gradeAdminButtons = document.getElementById("gradeAdminButtons");
            if (gradeAdminButtons) gradeAdminButtons.classList.add("hidden");

            const ldAdminControls = document.getElementById("ldAdminControls");
            if (ldAdminControls) ldAdminControls.classList.add("hidden");

            await loadTransmutationTables();
            //if (dPhoto) dPhoto.classList.add("hidden");
            await openStudentDetailsByEmail(state.me.email);

          } catch (e) {
            console.warn("Init me() failed:", e);
            forceLogout("Session check failed. Please login again.");
            hideLoading();
          }
          return;
        } else {
          if (menuStudentInfo) menuStudentInfo.classList.remove("hidden");
          if (menuSeatMapInfo) menuSeatMapInfo.classList.remove("hidden");
          if (btnOpenSeatMap) btnOpenSeatMap.classList.remove("hidden");
          if (btnGoList) btnGoList.classList.remove("hidden");

          if (btnPrevRecord) btnPrevRecord.classList.remove("hidden");
          if (btnNextRecord) btnNextRecord.classList.remove("hidden");
          if (btnBackToList) btnBackToList.classList.remove("hidden");

          const recordNav = document.querySelector(".recordNav");
          if (recordNav) recordNav.classList.remove("hidden");

          const gradeAdminTools = document.getElementById("gradeAdminTools");
          if (gradeAdminTools) gradeAdminTools.classList.remove("hidden");

          const gradeAdminButtons = document.getElementById("gradeAdminButtons");
          if (gradeAdminButtons) gradeAdminButtons.classList.remove("hidden");

          const ldAdminControls = document.getElementById("ldAdminControls");
          if (ldAdminControls) ldAdminControls.classList.remove("hidden");

          //if (dPhoto) dPhoto.classList.remove("hidden");
        }

        // ✅ Load in background (faster)
        await loadRooms();
        loadInitialFilters();
        loadSeatMapMaster();
        renderPendingUI();

        //if (state.idToken) {
        //console.log("Preloading Seat Master");

        /*const res = await apiGet({
          action: "seatmapMaster",
          idToken: state.idToken
        });
 
        if (res?.status === "success") {
          state.seat.masterStudents = res.students || [];*/

        ensureMasterStudentsLoaded();
        setupAutocomplete(editStudentName, "name");
        setupAutocomplete(editStudentId, "id");
        setupAutocomplete(editStudentEmail, "email");
        //}
        //}

        // ✅ RESTORE CURRENT SCREEN (default: list)
        const target = sess.currentScreen || "menu";

        if (target === "details" && sess.selectedEmail) {
          await openStudentDetailsByEmail(sess.selectedEmail);
        }
        else if (target === "menu") {
          showScreen(screenMenu);
        }
        else if (target === "filters") {
          showScreen(screenFilters);
        }
        else if (target === "seatmap") {
          showScreen(screenSeatMap);
        }
        else if (target === "export") {
          showScreen(screenExport);
        }
        else if (target === "import") {
          showScreen(screenImport);
        }
        else {
          //showScreen(screenList);
          showScreen(screenMenu);
        }

        // ✅ Load list if screen needs it
        if (target === "list" || target === "details") {
          await loadList(false);
        }

        saveSession();
        showNetBadge();
        document.body.classList.remove("app-booting");
        hideLoading();

      } catch (e) {
        console.warn("Init me() failed:", e);
        showScreen(screenMenu); // stay inside app
        hideLoading();
      }
    })();
    return; // ✅ stop here (important)
  }

  // ✅ No token = show setup/login
  if (isValid) {
    showScreen(screenConfig);
    hideNetBadge();
  }
})();

/* ===========================
   EVENT HANDLER
=========================== */

// ✅ GLOBAL MODAL CLOSE HANDLER (SAFE)
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-close]");
  if (!btn) return;

  const modal = btn.closest(".modal");
  if (!modal) return;

  modal.classList.add("hidden");

  // special cleanup
  const iframe = modal.querySelector("iframe");
  if (iframe) iframe.src = "";

  const img = modal.querySelector("img");
  if (img) img.src = "";
});

//document.getElementById("exportScope").onchange = updateExportUI;

/*
document.getElementById("exportScope").addEventListener("click", async () => {
  openscreenExport();
  initExportForm();
});*/

/*document.getElementById("menuExport").addEventListener("change", async () => {
  //const students = await getStudentsForExport("section", "", "");
  //loadStudents(students);
});*/

document.getElementById("exportCourse").addEventListener("change", () => {

  if (!ALL_STUDENTS.length) return; // 🔥

  const scope = document.getElementById("exportScope").value;
  if (scope !== "section") return;

  const course = document.getElementById("exportCourse").value;

  let filtered = ALL_STUDENTS;

  if (course) {
    filtered = ALL_STUDENTS.filter(s => String(s["course(subject)"]).toUpperCase() === String(course).toUpperCase());
  }

  loadStudents(filtered);
});

/* OBSOLETE */
/*document.getElementById("exportScope").addEventListener("change", () => {
 
  const scope = document.getElementById("exportScope").value;
 
  if (scope === "student") {
    // ✅ show ALL students immediately
    loadStudents(ALL_STUDENTS);
  } else {
    // ✅ wait for course selection
    loadStudents([]);
  }
});*/

document.getElementById("exportScope").addEventListener("change", (e) => {
  const scope = e.target.value;

  if (!state.exportData) return;

  updateExportUI();
  onExportScopeChange(scope);
});


/* ===========================
   SESSION ACTIVITY REFRESH (1-week inactivity timeout support)
=========================== */
/*******************************************************
* function name: refreshActivityStamp
* parameter: none
* return: void
* purpose: Updates last activity timestamp in localStorage to extend session lifetime.
********************************************************/
function refreshActivityStamp() {
  if (state.idToken) {
    localStorage.setItem("sf_login_time", Date.now());
  }
}

document.addEventListener("click", refreshActivityStamp);
document.addEventListener("keydown", refreshActivityStamp);