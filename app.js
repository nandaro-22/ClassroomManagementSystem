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
const screenMenu = document.getElementById("screenMenu");

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
const btnGrades = document.getElementById("tabGrades");
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
//const FIXED_API_URL = "https://script.google.com/macros/s/AKfycbwjtnD9r1uPmOgEe7c3oE1__UazCfJOvseJZzrfvNCODIPXBMCvbnlvHxAcj3VfNC9DYQ/exec";
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

/* ===========================
   GLOBAL STATE
=========================== */
const state = {
  apiUrl: "",
  clientId: "",
  idToken: "",
  me: null,
  
  currentScreen: "config",

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
    pageSize: 20,  // ✅ show only 20 students per page
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
  }
};

/*state.learnerDev = {
  categories: [],
  scores: {}
};*/

//state.gradeTasks = [];

state.grades = state.grades || {};

/* ===========================
   UI HELPERS
=========================== */

/*******************************************************
* function name: formatShortDate
* parameter: -
* return: -
* purpose: -
*******************************************************/
function formatShortDate(d){
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date)) return d;
  return date.toISOString().split("T")[0];
}

/*******************************************************
* function name: formatGradeDate
* parameter: -
* return: -
* purpose: -
*******************************************************/
function formatGradeDate(dateStr){

  if(!dateStr) return "-";

  try{

    const d=new Date(dateStr);

    return d.toLocaleDateString("en-PH",{
    year:"numeric",
    month:"short",
    day:"numeric"
  });

  }catch(e){

    return dateStr;

  }

}

/*******************************************************
* function name: getDefaultGradeTemplate
* parameter: -
* return: -
* purpose: -
*******************************************************/
function getDefaultGradeTemplate() {
  return [
    { date:"2026-01-15", category:"ASSIGNMENT", taskCode:"ASS1", taskName:"Blog Entry", max:20, score:"" },
    { date:"2026-02-13", category:"ASSIGNMENT", taskCode:"ASS2", taskName:"Movie Review", max:50, score:"" },
    { date:"2026-02-02", category:"QUIZ", taskCode:"QUIZ1", taskName:"Quiz 1", max:20, score:"" },
    { date:"2026-02-15", category:"EXAM", taskCode:"EXAM1", taskName:"Midterm Exam", max:100, score:"" }
  ];
}

/*******************************************************
* function name: updateGradeSeat
* parameter: -
* return: -
* purpose: -
*******************************************************/
async function updateGradeSeat(){

  //const student = state.currentStudent;
  const student = state.selected;

  if (!state.idToken){
    console.log("Seat skipped - no token yet!");
    return;
  }

  if(!student) return;

  // ============================
  // FIND SEAT
  // ============================
  let seatNo="—";
  const found = (state.seat.masterStudents || []).find(s=>String(s.studentEmail||"").toLowerCase() === String(student.email||"").toLowerCase());
    if(found?.seatNo){
      seatNo=found.seatNo;
    }

  // ============================
  // UPDATE UI
  // ============================
  document.getElementById("gradeStudentId").textContent = student.studentId || "—";
  document.getElementById("gradeSeatNo").textContent = seatNo;
}

/*******************************************************
* function name: renderTaskGrades
* parameter: studentId (string)
* return: -
* purpose: Save all task grades for current student
*******************************************************/
function renderTaskGrades(){

  const tbody = document.getElementById("gradeTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const tasks = state.gradeTasks || [];

  if (!tasks.length){

    tbody.innerHTML = `
    <tr>
      <td colspan="6" style="text-align:center;color:#64748b;">
        No grade items
      </td>
    </tr>
    `;

    return;
  }

  // build rows
  tasks.forEach((t,index)=>{

    const tr=document.createElement("tr");

    const percent = (t.score!=="" && Number(t.max)>0) ? ((Number(t.score)/Number(t.max))*100).toFixed(1) : "0.0";

    tr.innerHTML=`

      <td>${formatGradeDate(t.date)}</td>
      <td>${escapeHtml(t.category||"-")}</td>
      <td>${escapeHtml(t.taskName||"-")}</td>
      <td>${t.max||0}</td>
      <td>
        <input
        class="gradeInput"
        type="number"
        min="0"
        max="${t.max||0}"
        value="${t.score ?? ""}"

        oninput="
        state.gradeTasks[${index}].score=this.value === '' ? '' : Number(this.value);
        recomputeTaskFinal();
        "
        />
      </td>

      <td
        class="gradeReadonly"
        id="taskPct_${t.taskCode}"
        >
        ${percent}%
      </td>
    `;

    tbody.appendChild(tr);

  });

  recomputeTaskFinal();

}

/*******************************************************
* function name: updateFinalGradeUI
* parameter: -
* return: -
* purpose: -
*******************************************************/
function updateFinalGradeUI(val){

  const gradeEl = document.getElementById("finalGradeValue");
  const statusEl = document.getElementById("finalGradeStatus");

  if (gradeEl){
    gradeEl.textContent = val.toFixed(2) + "%";
  }

  if (statusEl){
    if (val >= 75){
      statusEl.textContent = "PASSED";
      statusEl.className = "tag pass";
    } else {
      statusEl.textContent = "FAILED";
      statusEl.className = "tag fail";
    }
  }
}

/*******************************************************
* function name: loadTaskGrades
* parameter: -
* return: -
* purpose: -
*******************************************************/
async function loadTaskGrades(studentId) {

  try {

  // Stop API call if logged out
  if (!state.idToken) {
    console.log("Skipped grades load - no session.");
    return;
  }

  const student = state.currentStudent;
  if (!student) return;

  const res = await apiGet({
    action: "gradesTaskLoad",
    studentId,
    idToken: state.idToken
  });

  console.log("GRADES LOAD:", res);
  showLoading("Loading grades, please wait...");

  if (!res || res.status !== "success") {
    hideLoading();
    throw new Error(res?.message || "Load failed");
  }

  if (!res.items || res.items.length === 0) {
    console.log("No sheet data. Using default template.");
    state.gradeTasks = getDefaultGradeTemplate();
  } else {
    state.gradeTasks = res.items;
  }

  document.getElementById("gradeStudentId").textContent = student.studentId || "—";

  renderTaskGrades();
  //updateGradeSeat();
  recomputeTaskFinal();
  hideLoading();
  } catch (err) {

    console.error("TASK LOAD ERROR:", err);
    hideLoading();

    state.gradeTasks = getDefaultGradeTemplate();
    renderTaskGrades();
    recomputeTaskFinal();
  }
}

/*******************************************************
* function name: recomputeTaskFinal
* parameter: 
* return: -
* purpose: -color per row, - compute final grade, - update PASSED / FAILED badge
*******************************************************/
function recomputeTaskFinal(){

  let total = 0;
  let count = 0;

  (state.gradeTasks || []).forEach(task=>{

    const score = task.score === "" ? "" : Number(task.score);
    const max = Number(task.max || 0);
    let pct = 0;

    // compute %
    if(score !== "" && max > 0){
      pct = (score/max)*100;
      total += pct;
      count++;
    }

    // save percent in memory
    task.percent = pct;

    // ===== UPDATE ROW % CELL =====
    const cell = document.getElementById("taskPct_"+task.taskCode);

    if(cell){
      cell.textContent = pct.toFixed(1)+"%";
      if(pct>=75){
        cell.style.color="#1f7a3f"; // green
      }
      else if(pct>=50){
        cell.style.color="#b26a00"; // orange
      }
      else{
        cell.style.color="#b42318"; // red
      }
    }
  });


  // ===== FINAL GRADE =====
  const final = count ? (total/count) : 0;

  // FINAL VALUE
  const finalEl = document.getElementById("finalGradeValue");

  if(finalEl){
    finalEl.textContent = final.toFixed(2)+"%";
  }

  // ===== BADGE =====
  const badge = document.getElementById("finalGradeStatus");
  if (!badge) return;

  // reset class safely
  badge.classList.remove("passed","failed");

  // if no grade yet
  if (count === 0) {
    badge.textContent="-";
    return;
  }

  if(final>=75){
    badge.textContent="PASSED";
    badge.classList.add("passed");
  } else{
    badge.textContent="FAILED";
    badge.classList.add("failed");
  }
}

/*******************************************************
* function name: saveTaskGrades
* parameter: 
* return: -
* purpose: Save all task grades for current student
*******************************************************/
async function saveTaskGrades(){

showLoading("Saving task grades...");

  try{

    const student = state.currentStudent;
    if(!student){
      hideLoading();
      alert("No student loaded");
      return;
    }

    const res = await apiPost(
    "gradesTaskSave",
      {
        studentId: student.studentId,
        items: state.gradeTasks
      }
    );

    console.log("TASK SAVE RESPONSE:",res);
    hideLoading();
    if(res.status==="success"){
      alert("Grades saved");
    }else{

      alert("Save failed: "+(res.message||"unknown"));
    }
  }catch(err){
    hideLoading();
    alert("Save error: "+err.message);
  }
}

/*******************************************************
* function name: addTaskRow
* parameter: 
* return: -
* purpose: -
*******************************************************/
async function addTaskRow(){

  state.gradeTasks.push({
    date: new Date().toISOString().slice(0,10),
    category: "ASSIGNMENT",
    taskCode: "TASK"+new Date().toISOString().slice(0,10),
    taskName: "New Task",
    max: 20,
    score: ""
  });

  renderTaskGrades();
}

/*******************************************************
* function name: isSessionValid
* parameter: none
* return: -
* purpose: -
*******************************************************/
function isSessionValid() {
  const token = localStorage.getItem("sf_id_token");
  const loginTime = Number(localStorage.getItem("sf_login_time") || 0);

  if (!token || !loginTime) return false;

  return (Date.now() - loginTime) < SESSION_MAX_AGE_MS;
}

/* New */
/*******************************************************
* function name: loadSeatRoom
* parameter: room (string)
* return: -
* purpose: Loads seat map data for a room by fetching master student list and latest seat assignments, using cached seat data first for fast UI render, then refreshing from server and updating cache.
*******************************************************/
async function loadSeatRoom(room){

  const key = "seatmap_" + room;

  // 🔥 1) kunin muna master students (may cellphone numbers)
  const masterRes = await apiGet({
    action: "seatmapMaster",
    idToken: state.idToken
  });

  if (masterRes.status === "success") {
    state.seat.masterStudents = masterRes.students || [];
    //console.log("MASTER STUDENTS LOADED:", state.seat.masterStudents);
  } else {
    state.seat.masterStudents = [];
  }

  // 2) load cached seats para mabilis ang UI
  const cached = await cacheGet(key);
  if (cached) {
    state.seat.seats = cached;
    renderSeatGrid();
  }

  // 3) kunin latest seats mula server
  const res = await apiGet({
    action: "seatmap",
    idToken: state.idToken,
    room: room
  });

  if (res.status === "success") {
    state.seat.seats = res.seats || [];
    renderSeatGrid();
    await cacheSet(key, state.seat.seats);
  }
}

/*******************************************************
* function name: loadLearnerDev
* parameter: studentId (string)
* return: -
* purpose: Retrieves learner development records for a student from the API, maps categories and scores into state, and triggers radar chart rendering.
*******************************************************/
async function loadLearnerDev(studentId){

  if (!state.idToken) return;
  
  const res = await apiGet({
    action: "learnerDevLoad",
    idToken: state.idToken,
    studentId
  });

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
* function name: resetApp
* parameter: none
* return: -
* purpose: Clears all IndexedDB caches and evidence storage, resets major state containers, shows reset notification, and navigates UI back to config screen.
*******************************************************/
async function resetApp(){

  await cacheClearAll();
  await deleteEvidenceDB();

  state.selected = null;
  state.list.items = [];
  state.list.total = 0;
  state.seat = { room:"", editMode:false, seats:[], masterStudents:[], editingSeat:null };

  toast("Cache cleared. Logging out.");
  showScreen(screenConfig);
}

/*******************************************************
* function name: getPhotoCached
 parameter: email (string)
* return: dataUrl <string|null>
* purpose: Retrieves a student photo as data URL from local cache if available, otherwise downloads from API, caches it, and returns the encoded image.
*******************************************************/
async function getPhotoCached(email){

  if (!email) return null;

  const key = "photo_" + email.toLowerCase();

  // 1) try cache
  const cached = await cacheGet(key);
  if (cached) return cached;

  // 2) fetch from API
  const res = await apiGet({
    action: "photo",
    idToken: state.idToken,
    email: email
  });

  if (res.status !== "success") return null;

  const dataUrl = `data:${res.mimeType || "image/jpeg"};base64,${res.base64 || ""}`;

  // 3) save cache
  await cacheSet(key, dataUrl);

  return dataUrl;
}

btnClosePdf.onclick = closePdfModal;

// click outside to close
pdfModal.addEventListener("click", (e) => {
  if (e.target === pdfModal) closePdfModal();
});

/*******************************************************
* function name: idbOpen
* parameter: none
* return: -
* purpose: Opens (and creates if needed) the IndexedDB database for evidence files and ensures the required object store exists.
*******************************************************/
function idbOpen(){

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

/*******************************************************
* function name: idbPutEvidenceFile
* parameter: item (object)
* return: -
* purpose: Stores an evidence file record (blob + metadata) into the IndexedDB evidence store.
*******************************************************/
async function idbPutEvidenceFile(item){

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
async function idbGetEvidenceFile(id){

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
async function idbDeleteEvidenceFile(id){

  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/*******************************************************
* function name: closePdfModal
* parameter: none
* return: -
* purpose: Closes the PDF preview modal and clears the iframe source to release the loaded document.
*******************************************************/
function closePdfModal(){

  pdfFrame.src = "";
  pdfModal.classList.add("hidden");
}

/*******************************************************
* function name: getPendingQueue
* parameter: none
* return: -
* purpose: Reads and parses the pending offline sync queue from localStorage.
********************************************************/
function getPendingQueue(){

  return JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || "[]");
}

/*******************************************************
* function name: setPendingQueue
* parameter: arr (array)
* return: -
* purpose: Saves the pending offline sync queue array into localStorage.
********************************************************/
function setPendingQueue(arr){

  localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(arr));
}

/* ===========================
   cache
=========================== */
/*******************************************************
* function name: openCacheDB
* parameter: none
* return: -
* purpose: Opens (and initializes if needed) the IndexedDB key-value cache database used for generic app caching.
********************************************************/
function openCacheDB(){

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

/*******************************************************
* function name: cacheSet
* parameter: key (string), value (any)
* return: -
* purpose: Stores a value in the IndexedDB key-value cache under the given key.
********************************************************/
async function cacheSet(key, value){

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
async function cacheGet(key){

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
async function cacheDelete(key){

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
async function cacheClearAll(){

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
* function name: showScreen
* parameter: el (HTMLElement)
* return: -
* purpose: Switches visible UI screen by hiding all registered screens and showing the target element, updates related UI badges and buttons, tracks current screen state, and saves session snapshot.
********************************************************/
function showScreen(el){

  const screens = [
    screenConfig,
    screenMenu,
    screenFilters,
    screenList,
    screenDetails,
    screenSeatMap
  ];

  // hide grades
  document.getElementById('tabContentGrades')?.classList.add('hidden');

  screens.forEach(s => s && s.classList.add("hidden"));
  if (el) el.classList.remove("hidden");

  // ✅ update Delete Room button visibility ONLY when seat map is shown
  if (el === screenSeatMap) {
    updateDeleteRoomButtonVisibility();
  }

  // ✅ FIX: hide Online badge when logged out (Setup/Login screen)
  if (el === screenConfig) {
    hideNetBadge();
  } else {
    showNetBadge();
  }

  // ✅ NEW: Track current screen for refresh restore
	if (el === screenMenu) state.currentScreen = "menu";
	else if (el === screenFilters) state.currentScreen = "filters";
	else if (el === screenList) state.currentScreen = "list";
	else if (el === screenDetails) state.currentScreen = "details";
	else if (el === screenSeatMap) state.currentScreen = "seatmap";
	//else if (el === screenConfig) state.currentScreen = "config";
  //else state.currentScreen = "config";
  else state.currentScreen = "menu";

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
function isMobile(){
  return window.innerWidth <= 768;
}

/*******************************************************
* function name: clearEvidenceFileInput
* parameter: none
* return: -
* purpose: Resets the evidence file input element so the same file can be selected again or to clear pending selection.
********************************************************/
function clearEvidenceFileInput(){

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
async function queueEvidenceUploadOffline(file, student){

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
  alert("Offline: Evidence saved to Pending Sync. It will upload when online.");
}

/*******************************************************
* function name: isPdfFile
* parameter: name (string), mime (string)
* return: boolean
* purpose: Determines whether a file should be treated as a PDF based on filename extension or MIME type.
********************************************************/
function isPdfFile(name = "", mime = ""){

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
function isImageFile(name = "", mime = ""){

  const n = String(name).toLowerCase();
  const m = String(mime).toLowerCase();
  return m.startsWith("image/") || n.match(/\.(png|jpg|jpeg|gif|webp)$/);
}

/*******************************************************
* function name: handleUploadEvidence
* parameter: file (File)
* return: -
* purpose: Handles evidence upload flow by validating input, routing to offline queue when offline, or uploading immediately via API when online, then refreshing the evidence list UI.
********************************************************/
async function handleUploadEvidence(file){

  try {
    if (!file) {
      alert("Please choose a file.");
      return;
    }

	const student = {
	  email: state.selected.email,
	  timestamp: state.selected.timestamp,
	  studentId: state.selected.studentId
	};

    // ✅ OFFLINE → store to IndexedDB
    if (!navigator.onLine) {
      await queueEvidenceUploadOffline(file, student);
      return;
    }

	if (!student.studentId || !student.email) {
	  throw new Error("Missing studentId/email in evidence upload payload");
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
      throw new Error(res.message || "Upload failed");
    }

    alert("Evidence uploaded successfully!");
    clearEvidenceFileInput();
	  await loadEvidenceList(); // ✅ add

  } catch (err) {
    alert("Upload error: " + err);
  }
}

/*******************************************************
* function name: deleteEvidenceDB
* parameter: none
* return: -
* purpose: Deletes the entire IndexedDB database used for offline evidence storage and resolves with success status.
********************************************************/
function deleteEvidenceDB(){

  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(IDB_DB_NAME);
    req.onsuccess = () => resolve(true);
    req.onerror = () => resolve(false);
    req.onblocked = () => resolve(false);
  });
}

/*******************************************************
* function name: syncPendingQueue
* parameter: opts (object)
* return: -
* purpose: Processes and synchronizes all pending offline queue jobs (updates, seat map saves, and chunked evidence uploads) to the server, tracking progress and keeping failed jobs in the queue.
********************************************************/
async function syncPendingQueue(opts = {}){

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
      console.log("Sync failed:", item, err);

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
* function name: renderLearnerDevChart
* parameter: none
* return: -
* purpose: Renders or refreshes the learner development radar chart using current category and score data from state.
********************************************************/
function renderLearnerDevChart(){

  const labels = state.learnerDev.categories;
  const data = labels.map(c => state.learnerDev.scores[c] || 0);

  const ctx = document.getElementById("learnerDevChart");
  if (!ctx) return;

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
              size: 16,     // ✅ dataset label font
              weight: "bold"
            }
          }
        },
        tooltip: {
          bodyFont: {
            size: 14
          },
          titleFont: {
            size: 14
          }
        }
      },

      scales: {
        r: {
          pointLabels: {
            font: {
              size: 14,     // ✅ category labels around radar
              weight: "600"
            }
          },
          ticks: {
            stepSize: 1,
            font: {
              size: 12      // ✅ numeric scale labels
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
* function name: blobToBase64
* parameter: blob (Blob)
* return: -
* purpose: Converts a Blob/File object into a base64 string without the data URL prefix using FileReader.
********************************************************/
function blobToBase64(blob){

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
function splitBlobIntoChunks(blob, chunkSize = 300 * 1024){

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
async function blobToBase64NoPrefix(blob){

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
function base64ToChunks(base64, chunkSize = 200000){

  const chunks = [];
  for (let i = 0; i < base64.length; i += chunkSize) {
    chunks.push(base64.slice(i, i + chunkSize));
  }
  return chunks;
}

/*******************************************************
* function name: recomputeGrades
* parameter: none
* return: -
* purpose: Recalculates per-item percentages and final weighted grade from current score inputs, updates UI cells, and refreshes pass/fail status badge.
********************************************************/
function recomputeGrades(){
  let final = 0;

  state.grades.items.forEach(item => {

    const score = Number(state.grades.scores[item.code] || 0);

    const pct = item.max > 0
      ? (score / item.max) * 100
      : 0;

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
}

/*******************************************************
* function name: updateGradeStatus
* parameter: val (number)
* return: -
* purpose: Updates the final grade status badge text and style (passed/failed) based on computed percentage value.
********************************************************/
function updateGradeStatus(val){
  const el = document.getElementById("finalGradeStatus");
  if (!el) return;

  let txt = "—";
  let cls = "gradeStatus";

  if (val >= 75){
    txt = "PASSED";
    cls += " pass";
  }
  else if (val > 0){
    txt = "FAILED";
    cls += " fail";
  }

  el.textContent = txt;
  el.className = cls;
}

/*******************************************************
* function name: resetGradesUI
* parameter: none
* return: -
* purpose: Clears all grade scores in state, resets final grade and status display, and re-renders the grade table.
********************************************************/
function resetGradesUI(){
  state.grades.scores = {};

  const finalEl = document.getElementById("finalGradeValue");
  if (finalEl) finalEl.textContent = "0.00%";

  const statusEl = document.getElementById("finalGradeStatus");
  if (statusEl){
    statusEl.textContent = "—";
    statusEl.className = "gradeStatus";
  }

  renderGradeTable();
}

/*******************************************************
* function name: saveGrades
* parameter: none
* return: -
* purpose: Validates grade weights, builds grade payload from current scores, sends it to the backend for saving, and shows user feedback.
********************************************************/
async function saveGrades(){

  showLoading("Please wait, saving grades...");
  const student = state.currentStudent;
  if (!student){
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

  if (!validateWeights()){
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
}

/*******************************************************
* function name: loadGradesForStudent
* parameter: studentId (string)
* return: -
* purpose: Loads saved grade scores for a student from the API, merges them into state, and refreshes the grade table and computed totals.
********************************************************/
async function loadGradesForStudent(studentId){
  if(!studentId) return;

  const res = await apiGet({
    action: "gradesLoad",
    idToken: state.idToken,
    studentId: studentId
  });

  if (res.status !== "success") {
    console.warn("gradesLoad failed",res);
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
}

/*******************************************************
* function name: uploadEvidenceChunked
* parameter: payload (object), progressCb (function)
* return: <object>
* purpose: Uploads a large base64 evidence file using init–chunk–finalize API flow, reporting progress through callback.
********************************************************/
async function uploadEvidenceChunked(payload, progressCb){

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
* function name: escapeHtml
* parameter: str (string)
* return: string
* purpose: Escapes special HTML characters in a string to prevent HTML injection when rendering dynamic text in the UI.
********************************************************/
function escapeHtml(str){

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
function toast(msg){

  try {
    alert(String(msg));
  } catch (e) {
    console.error("toast failed:", e);
  }
}

/*******************************************************
* function name: openSeatEditModal
* parameter: seat (object)
* return: void
* purpose: Opens the seat edit modal, populates form fields with selected seat data, and stores the editing reference in state.
********************************************************/
function openSeatEditModal(seat){

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
function setSeatEditLocked(isLocked){

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
function closeSeatEditModal(force = false){

  if (!seatEditModal) return;

  // allow forced close
  if (seatEditLock && !force) return;

  seatEditLock = false; // 🔥 important
  seatEditModal.classList.add("hidden");
  state.seat.editingSeat = null;
}

/*******************************************************
* function name: fillSelect
* parameter: selectEl (HTMLSelectElement), items (array)
* return: void
* purpose: Populates a select dropdown element with a blank option plus provided item values.
********************************************************/
function fillSelect(selectEl, items){

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
* function name: updateSeatEditUI
* parameter: none
* return: void
* purpose: Updates seat map edit mode UI controls and button visibility based on admin role and edit mode state.
********************************************************/
function updateSeatEditUI(){

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
* function name: validateWeights
* parameter: none
* return: boolean
* purpose: Validates that total grade item weights sum to exactly 100 percent before allowing save.
********************************************************/
function validateWeights(){
  const sum =
    state.grades.items.reduce((s,i)=>s+i.weight,0);

  if(sum !== 100){
    alert("Total weight must be 100%");
    return false;
  }
  return true;
}

/*******************************************************
* function name: addGradeItem
* parameter: none
* return: void
* purpose: Adds a new grade item from input fields into the grade model and refreshes the grade table.
********************************************************/
function addGradeItem(){

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

  renderGradeTable();
}

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

/*******************************************************
* function name: onGradeScoreChange
* parameter: code (string), val (number|string)
* return: void
* purpose: Updates a single grade score in state when input changes and triggers recomputation.
********************************************************/
function onGradeScoreChange(code, val){
  const num = Number(val);
  if (isNaN(num)) {
    delete state.grades.scores[code];
  } else {
    state.grades.scores[code] = num;
  }

  recomputeGrades();
}

/*******************************************************
* function name: openModal
* parameter: modalEl (HTMLElement)
* return: void
* purpose: Shows a modal element by removing its hidden class.
********************************************************/
function openModal(modalEl){
  if (!modalEl) return;
  modalEl.classList.remove("hidden");
}

/*******************************************************
* function name: closeModal
* parameter: modalEl (HTMLElement)
* return: void
* purpose: Hides a modal element by adding its hidden class.
********************************************************/
function closeModal(modalEl){
  if (!modalEl) return;
  modalEl.classList.add("hidden");
}

/*******************************************************
* function name: attachModalBackdropClose
* parameter: modalEl (HTMLElement)
* return: void
* purpose: Attaches a backdrop click handler to a modal so clicking outside content closes it.
********************************************************/
function attachModalBackdropClose(modalEl){
  if (!modalEl) return;
  modalEl.onclick = (e) => {
    if (e.target === modalEl) closeModal(modalEl);
  };
}

/*******************************************************
* function name: resetAppData
* parameter: none
* return: void
* purpose: Clears setup, session, and pending sync data from localStorage after confirmation and reloads the app.
********************************************************/
function resetAppData(){

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

  alert("Reset done. Reloading app...");
  location.reload();
}

/*******************************************************
* function name: refreshDebugInfo
* parameter: none
* return: void
* purpose: Updates debug info UI fields with current API URL, pending counts, and seat map stats.
********************************************************/
function refreshDebugInfo(){
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
function norm(s){

  return String(s || "").trim().toLowerCase();
}

/*******************************************************
* function name: findStudentById
* parameter: id (string)
* return: object|null
* purpose: Finds a student in master student list by normalized studentId.
********************************************************/
function findStudentById(id){

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
function findStudentByEmail(email){

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
function findStudentByName(name){

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
function updateDeleteRoomButtonVisibility(){

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
function buildUrl(params = {}){

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
function loadPendingUpdates(){

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
function savePendingUpdates(items){

  localStorage.setItem(LS_PENDING_UPDATES, JSON.stringify(items || []));
}

/*******************************************************
* function name: getPendingCount
* parameter: none
* return: number
* purpose: Returns total count of all pending offline jobs including updates and uploads.
********************************************************/
function getPendingCount(){

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
function updateSyncBadge(){

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
function setNetBadge(status){

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
function getQueueItemKey(item, idx){

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
function renderPendingUI(){

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
* function name: seedLearnerDevDefaults
* parameter: none
* return: void
* purpose: Initializes learner development categories and zero scores when not yet defined.
********************************************************/
function seedLearnerDevDefaults(){

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
function addLearnerDev(){

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
* return: Promise<void>
* purpose: Saves learner development category scores for the current student to the backend API.
********************************************************/
async function saveLearnerDev(){
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
    alert("Saved");
  } catch  (err) {
    hideLoading();
    toast("Save error: " + err.toString());
  }
}

/*******************************************************
* function name: clearRemarksBox
* parameter: none
* return: void
* purpose: Clears the remarks textarea input field in the details view.
********************************************************/
function clearRemarksBox(){

  const el = document.getElementById("dRemarks");
  if (el) el.value = "";
}

/*******************************************************
* function name: deleteSinglePending
* parameter: key (string)
* return: void
* purpose: Removes a specific pending queue item and its offline file (if any) after user confirmation.
********************************************************/
function deleteSinglePending(key){

  const q = getPendingQueue();

  const idx = q.findIndex((item, i) => getQueueItemKey(item, i) === key);
  if (idx < 0) return;

  const item = q[idx];

  const ok = confirm("Delete this pending item?\n\nThis will remove it from queue.");
  if (!ok) return;

  // If evidence, also delete file from IndexedDB
  if (item.type === "uploadEvidence" && item.offlineId) {
    idbDeleteEvidenceFile(item.offlineId).catch(() => {});
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
async function retrySinglePending(key){

  if (!navigator.onLine) {
    alert("You are offline. Cannot retry now.");
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
function refreshNetBadgeNow(){

  setNetBadge(navigator.onLine ? "online" : "offline");
}

/*******************************************************
* function name: startNetWatcherOnce
* parameter: none
* return: void
* purpose: Starts one-time network status watchers and triggers automatic sync when connection is restored.
********************************************************/
function startNetWatcherOnce(){

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
function showNetBadge(){

  if (!netBadge) return;
  netBadge.classList.remove("hidden");
}

/*******************************************************
* function name: hideNetBadge
* parameter: none
* return: void
* purpose: Hides the network status badge element.
********************************************************/
function hideNetBadge(){

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
function saveSetup(apiUrl, clientId){

  localStorage.setItem("sf_apiUrl", apiUrl);
  localStorage.setItem("sf_clientId", clientId);
}

/*******************************************************
* function name: loadSetup
* parameter: none
* return: object
* purpose: Loads fixed API configuration into state and localStorage and returns it.
********************************************************/
function loadSetup(){

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
function clearSetup(){

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
function saveSession(){
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
      currentScreen: state.currentScreen || "menu"
    };
    localStorage.setItem(LS_SESSION, JSON.stringify(data));
  } catch (e) {}
}

/*******************************************************
* function name: loadSession
* parameter: none
* return: object
* purpose: Loads previously saved session snapshot from localStorage.
********************************************************/
function loadSession(){

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
function clearSession(){

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
function extractDriveFileId(url){

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

let modalZoom = {
  scale: 1,
  x: 0,
  y: 0,
  dragging: false,
  startX: 0,
  startY: 0
};

/*******************************************************
* function name: applyModalTransform
* parameter: none
* return: void
* purpose: Applies current zoom and pan transform values to the modal image element.
********************************************************/
function applyModalTransform(){

  const img = document.getElementById("modalPhoto");
  if (!img) return;
  img.style.transform = `translate(${modalZoom.x}px, ${modalZoom.y}px) scale(${modalZoom.scale})`;
}

/*******************************************************
* function name: resetModalZoom
* parameter: none
* return: void
* purpose: Resets modal image zoom and pan values to defaults and reapplies transform.
********************************************************/
function resetModalZoom(){

  modalZoom.scale = 1;
  modalZoom.x = 0;
  modalZoom.y = 0;
  applyModalTransform();
}

/*******************************************************
* function name: openEvidenceFile
* parameter: url (string)
* return: void
* purpose: Opens an evidence file by routing PDFs to PDF modal and images to image modal viewer.
********************************************************/
function openEvidenceFile(url){

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
* function name: isPdfUrl
* parameter: url (string)
* return: boolean
* purpose: Checks whether a URL likely points to a PDF file.
********************************************************/
function isPdfUrl(url = ""){

  return String(url).toLowerCase().includes(".pdf");
}

/*******************************************************
* function name: isImageUrl
* parameter: url (string)
* return: boolean
* purpose: Checks whether a URL likely points to a supported image file.
********************************************************/
function isImageUrl(url = ""){

  return String(url).toLowerCase().match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/);
}

/*******************************************************
* function name: openImageModalFromUrl
* parameter: url (string)
* return: void
* purpose: Opens image preview modal using either base64 data URL or converted Google Drive direct link.
********************************************************/
function openImageModalFromUrl(url){

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
function openPdfModal(previewUrl){

  if (!pdfModal || !pdfFrame) return;
  pdfFrame.src = previewUrl;
  pdfModal.classList.remove("hidden");
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
* function name: apiGet
* parameter: params (object)
* return: <object>
* purpose: Sends a GET request to the API with query parameters, parses response, and forces logout on auth/permission errors.
********************************************************/
async function apiGet(params = {}){

  try {
    const url = buildUrl(params);
    const res = await fetch(url);

    const text = await res.text();
    let data = null;

    try { data = JSON.parse(text); }
    catch { data = { status:"error", message:text }; }

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
      return { status:"error", message:"Access denied" };
    }

    // DO NOT logout on plain HTTP error
    if (isHttpDenied) {
      console.warn("HTTP denied but not forcing logout");
      return { status:"error", message:"http_error" };
    }

    return data;

  } catch (err) {
    //return { status:"error", message: err.toString() };
    console.warn("apiGet network error:", err);
    return { status:"network_error", message: err.toString() };
  }
}

/*******************************************************
* function name: openSeatPreview
* parameter: seat (object), event (MouseEvent)
* return: void
* purpose: Opens the desktop floating seat preview panel, loads student record and cached photo, and binds full-profile navigation.
********************************************************/
function openSeatPreview(seat, event){

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
  // load remarks from record cache if available
  document.getElementById("pvRemarks").value = ""; // clear remarks

  const emailLower = String(seat.studentEmail || "").trim().toLowerCase();
  const idLower    = String(seat.studentId || "").trim().toLowerCase();

  document.getElementById("pvPhone").textContent = "Loading...";

  (async () => {
    try {
      const res = await apiGet({
        action: "recordByEmail",
        idToken: state.idToken,
        email: seat.studentEmail
      });

      if (res.status === "success" && res.item) {
        const rec = res.item;

        const phone = res.item.cellphoneNumber || "—";
        document.getElementById("pvPhone").textContent = phone;

        // ✅ v6 FIX — full identifiers
        state.selected = rec;

      } else {
        document.getElementById("pvPhone").textContent = "—";
      }
    } catch (e) {
      console.warn("Phone load failed:", e);
      document.getElementById("pvPhone").textContent = "—";
    }
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

  const raw =
  stu.picture2x2_direct ||
  stu.picture2x2 ||
  "";

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

      const res = await apiGet({
        action: "photo",
        idToken: state.idToken,
        fileId
      });

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
* function name: apiPost
* parameter: actionOrParams (string|object), payload (object)
* return: <object>
* purpose: Sends a POST request to the API with action and idToken, handles auth failures, timeout, and JSON parsing.
********************************************************/
async function apiPost(actionOrParams, payload = {}){

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

    const res = await fetch(url, {
      method: "POST",
      body: fd,
      signal: controller.signal
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
* function name: apiPostNoCors
* parameter: action (string), payload (object)
* return: <object>
* purpose: Sends a POST request using no-cors form encoding for endpoints that must avoid CORS preflight, assuming success response.
********************************************************/
async function apiPostNoCors(action, payload = {}){

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
* function name: readBlobAsBase64
* parameter: blob (Blob)
* return: <string>
* purpose: Reads a Blob and returns its base64 content without the data URL prefix.
********************************************************/
function readBlobAsBase64(blob){

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
function makeUploadId(){

  return "up_" + Date.now() + "_" + Math.random().toString(16).slice(2);
}

/*******************************************************
* function name: uploadEvidenceInChunks
* parameter: options (object)
* return: <object>
* purpose: Uploads an evidence file blob to the server using init–chunk–finalize flow with progress callback support.
********************************************************/
async function uploadEvidenceInChunks({ email, timestamp, studentId, fileName, mimeType, fileBlob, onProgress }){

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

/* ===========================
   GOOGLE LOGIN (GSI)
=========================== */
/*******************************************************
* function name: waitForGoogleThenRun
* parameter: fn (function)
* return: void
* purpose: Waits until Google Identity Services library is available before executing the provided function.
********************************************************/
function waitForGoogleThenRun(fn){

  try {
    if (window.google && google.accounts && google.accounts.id) {
      fn();
      return;
    }
  } catch (e) {}
  setTimeout(() => waitForGoogleThenRun(fn), 150);
}

/*******************************************************
* function name: renderGoogleLoginButton
* parameter: none
* return: void
* purpose: Renders the Google Sign-In button and initializes Google Identity Services login flow.
********************************************************/
function renderGoogleLoginButton(){

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
async function onGoogleCredential(resp){

  try {
    state.idToken = resp.credential;

    // ✅ PERSISTENT LOGIN SAVE (1 week session)
    const now = Date.now();

    // update badge immediately
    refreshNetBadgeNow();

    const me = await apiGet({
      action: "me",
      idToken: state.idToken
    });

    // ✅ HARD BLOCK if not allowlisted
    if (!me || me.status !== "success") {
      forceLogout(me?.message || "Access denied. Your email is not allowlisted.");
      return;
    }

    // ✅ store user
    state.me = me;
    applyRoleUI();

    showLoading("Loading Google Sign-In...");
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
        alert(e.stack);
      }
      return;
    } else {
      document.body.classList.remove("student-mode");
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

    localStorage.setItem("sf_login_time", Date.now());

    showLoading();

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

/*******************************************************
* function name: forceLogout
* parameter: message (string)
* return: void
* purpose: Clears login/session state, hides protected UI, returns app to config screen, and shows logout message.
********************************************************/
function forceLogout(message){

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
      categories:[],
      scores:{}
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

    showScreen(screenConfig);
    hideNetBadge();

    if (message) toast(message);
  } catch (e) {
    console.log("forceLogout error:", e);
  }
}

/*******************************************************
* function name: denyAccess
* parameter: message (string)
* return: void
* purpose: Denies access by triggering forced logout with message.
********************************************************/
function denyAccess(message){

  forceLogout(message || "Access denied.");
}

/*******************************************************
* function name: driveToImageUrl
* parameter: url (string)
* return: string|null
* purpose: Converts a Google Drive share URL into a direct image view URL when possible.
********************************************************/
function driveToImageUrl(url){

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
async function loadInitialFilters(){

  const res = await apiGet({
    action: "filters",
    idToken: state.idToken
  });

  if (res.status !== "success") {
    toast(res.message || "Failed loading dropdown filters");
    return;
  }

  fillSelect(fSchoolYear, res.schoolYears);
  fillSelect(fTerm, res.terms);
  fillSelect(fCourseSubject, res.courseSubjects);
  fillSelect(fProgram, res.program);

  if (fSchoolYear) fSchoolYear.value = state.filters.schoolYear || "";
  if (fTerm) fTerm.value = state.filters.term || "";
  if (fCourseSubject) fCourseSubject.value = state.filters.courseSubject || "";
  if (fProgram ) fProgram .value = state.filters.program || "";
}

/*******************************************************
* function name: loadCascadeOptions
* parameter: none
* return: <void>
* purpose: Loads dependent filter options based on current selections and updates dropdowns while preserving valid selections.
********************************************************/
async function loadCascadeOptions(){

  const currentSY = fSchoolYear ? (fSchoolYear.value || "") : "";
  const currentTerm = fTerm ? (fTerm.value || "") : "";
  const currentCourse = fCourseSubject ? (fCourseSubject.value || "") : "";
  const currentProgram = fProgram ? (fProgram.value || "") : "";

  const res = await apiGet({
    action: "cascade",
    idToken: state.idToken,
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
async function loadList(resetPage = false){

  if (resetPage) state.list.page = 1;

  // ✅ cache key depends on filters/search/page
const cacheKey =
  `list_sy${state.filters.schoolYear}_t${state.filters.term}_c${state.filters.courseSubject}_p${state.filters.program}` +
  `_p${state.list.page}_s${state.list.pageSize}` +
  `_q${state.ui.search}_nr${state.ui.noRemarks}_oa${state.ui.onlyAssigned}_nd${state.ui.notDone}`;


  // 1) SHOW CACHED FIRST (FAST)
  const cached = await cacheGet(cacheKey);
  if (cached && cached.items && Array.isArray(cached.items)) {
    state.list.total = cached.total || 0;
    state.list.items = cached.items || [];
    renderList();
  }

  // 2) FETCH LATEST ONLINE
  const res = await apiGet({
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
  });

  if (res.status !== "success") {
    toast(res.message || "List load failed");
    return;
  }

  state.list.total = res.total || 0;
  state.list.items = res.items || [];
  renderList();
  saveSession();

  // 3) SAVE TO CACHE (NEXT OPEN = FAST)
  await cacheSet(cacheKey, {
    total: state.list.total,
    items: state.list.items,
    savedAt: new Date().toISOString()
  });
}

/*******************************************************
* function name: renderList
* parameter: none
* return: void
* purpose: Renders the main record list UI with photo thumbnails, tags, and click handlers for details view.
********************************************************/
function renderList(){

  if (!listWrap) return;

  listWrap.innerHTML = "";

  if (lblRecordCount) {
    lblRecordCount.textContent = `Record ${state.list.items.length} of ${state.list.total}`;
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
function buildRecordKey(item){

  return `${item.email}|${item.timestamp}|${item.studentId}`;
}

/*******************************************************
* function name: loadStudentPhotoInto
* parameter: imgEl (HTMLImageElement), item (object)
* return: <void>
* purpose: Loads a student photo into an image element using Drive fileId with IndexedDB caching fallback.
********************************************************/
async function loadStudentPhotoInto(imgEl, item){

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

    const res = await apiGet({
      action: "photo",
      idToken: state.idToken,
      fileId: fileId
    });

    if (res.status !== "success") throw new Error(res.message || "Photo API error");

    const mime = res.mimeType || "image/jpeg";
    const dataUrl = `data:${mime};base64,${res.base64}`;

    imgEl.src = dataUrl;

    // ✅ store cache
    //photoCache.set(fileId, dataUrl);
	await cacheSet("photo_" + fileId, dataUrl);

  } catch (err) {
    console.warn("Photo load failed:", err);

    if (!imgEl) return;
    imgEl.src =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
          <rect width="100%" height="100%" fill="#f8fbff"/>
          <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
            font-family="Arial" font-size="22" fill="#64748b">
            Photo not available
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
async function loadListPhoto(imgEl, item){

  try {
    if (!imgEl) return;

    // placeholder muna
    imgEl.src =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
          <rect width="100%" height="100%" fill="#f1f5f9"/>
          <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
            font-family="Arial" font-size="14" fill="#64748b">
            ...
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

    const res = await apiGet({
	  action: "photo",
	  idToken: state.idToken,
	  fileId
	});

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
function openDetailsByIndex(idx){

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
function renderRecordNav(activeIdx){

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
function renderLongField(label, value){

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
function renderFacebookField(label, value){

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
async function openDetails(item, idxInList = 0){

  try {
    document.getElementById('tabContentGrades')?.classList.add('hidden');

    state.selected = { ...item, recordKey: buildRecordKey(item), idxInList };

    // ✅ GRADES CONTEXT
    state.currentStudent = item;
    state.selectedEmail = item.email;

    //updateGradeSeat();
    saveSession();

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
        ev.preventDefault();
        try {
          const proofRaw = item.enrollmentProof_direct || item.enrollmentProof || "";
          const fileId = extractDriveFileId(proofRaw);

          if (!fileId) {
            toast("No Proof of Enrollment file found.");
            return;
          }
          
          showLoading("Loading Proof of Enrollment...");

          const res = await apiGet({
            action: "photo",
            idToken: state.idToken,
            fileId: fileId
          });

          hideLoading();
          
          if (res.status !== "success") throw new Error(res.message || "Failed to load proof");

          const mime = res.mimeType || "image/jpeg";
          const dataUrl = `data:${mime};base64,${res.base64}`;
          openImageModalFromUrl(dataUrl);
        } catch (err) {
          hideLoading();
          toast("Proof open failed: " + err.toString());
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
    }

    if (btnNextRecord) {
      btnNextRecord.onclick = () => {
        const i = state.selected.idxInList || 0;
        if (i >= state.list.items.length - 1) return toast("This is the last record.");
        openDetailsByIndex(i + 1);
      };
      document.getElementById('tabContentGrades')?.classList.add('hidden');
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

        await loadSeatRoom(state.seat.room);
        //renderGradeTable();            // build table
        if (state.currentStudent?.studentId) {
          await loadTaskGrades(state.currentStudent.studentId);
        }

        saveSession();

        // load evidence in background (no blocking)
        loadEvidenceList();
        applyRoleUI();
  } catch (e) {
    console.error("🔥 openDetails crash:", e.stack);
    alert(e.stack);
    throw e;
  }
}

if (btnSeatPreviewUpload) {
  btnSeatPreviewUpload.onclick = async () => {
    try {

      if (!state.selected) {
        alert("No student selected.");
        return;
      }

      const file = seatPreviewEvidenceFile.files[0];
      if (!file) {
        alert("Please choose a file.");
        return;
      }

      showLoading("Please wait, uploading evidence...");

      await handleUploadEvidence(file);

      seatPreviewEvidenceFile.value = "";
      
      hideLoading();
    } catch (err) {
      hideLoading();
      alert("Upload error: " + err.message);
    }
  };
}

/*******************************************************
* function name: closeSeatPreview
* parameter: none
* return: void
* purpose: Closes both desktop and mobile seat preview panels and clears preview evidence input.
********************************************************/
function closeSeatPreview(){
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
async function openMobilePreview(seat){
  state.seat.currentSeat = seat;
  const pv = document.getElementById("seatPreviewMobile");
  pv.classList.remove("hidden");

    const img = document.getElementById("pvMPhoto");
    img.src = SEAT_PLACEHOLDER;

    const email = seat.studentEmail?.toLowerCase();
    if (!email) return;

    // fill text fields
    document.getElementById("pvMSeatNo").textContent =   seat.seatNo ? `Seat ${seat.seatNo}` : "Seat —";
    document.getElementById("pvMName").textContent =  (seat.studentName || "—").toUpperCase();
    document.getElementById("pvMStudentId").textContent = seat.studentId || "—";
    document.getElementById("pvMEmail").textContent = seat.studentEmail || "—";
    document.getElementById("pvMRemarks").value = ""; // clear remarks
    let phone = "—";

    try {
      const res = await apiGet({
        action: "recordByEmail",
        idToken: state.idToken,
        email: email
      });

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
    }

    document.getElementById("pvMPhone").textContent = phone;
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

          const res = await apiGet({
            action: "photo",
            idToken: state.idToken,
            fileId
          });

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
async function openSeatFullProfile(seat){
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
function closeMobilePreview(){

  const pv = document.getElementById("seatPreviewMobile");
  if (pv) pv.classList.add("hidden");
}

/*******************************************************
* function name: positionFloatingPreview
* parameter: event (MouseEvent), el (HTMLElement)
* return: void
* purpose: Positions floating preview panel near cursor while keeping it inside viewport bounds.
********************************************************/
function positionFloatingPreview(event, el){
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
function openDetailsTab(tab){

  // hide all tab contents first
  document.querySelectorAll(".tabContent").forEach(el => el.classList.add("hidden"));

  if (tab === "grades") {
    const student = state.currentStudent;
    if (!student) return;

    //loadGradesForStudent(student.studentId); -> old
    loadTaskGrades(student.studentId);
    document.getElementById("tabContentGrades")?.classList.remove("hidden");
    setTimeout(renderLearnerDevChart, 50);
    alert("Grading Summary is still under constructions!");
  }

  if (tab === "info") {
    document.getElementById("tabContentInfo")?.classList.remove("hidden");
  }
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
function fileToBase64(file){

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
async function loadEvidenceList(){

  if (!state.idToken) return;
  if (!state.selected) return;
  if (!evidenceList) return;

  const res = await apiGet({
    action: "evidence",
    idToken: state.idToken,
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
        const res = await apiGet({
          action: "photo",
          idToken: state.idToken,
          fileId: fileId
        });

        if (res.status !== "success") {
          toast(res.message || "Failed to load evidence image.");
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
async function loadHistory(){

  if (!state.selected) return;
  if (!historyWrap) return;

  showLoading("Loading history...");

  const res = await apiGet({
    action: "history",
    idToken: state.idToken,
    recordKey: state.selected.recordKey
  });

  if (res.status !== "success") {
    toast(res.message || "History load failed");
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
async function saveCurrent(){

  if (!state.selected) return;

  if (state.me.role === "student") {
    toast("Students cannot edit remarks.");
    return;
  }

  showLoading("Please wait, saving remarks...");

  const body = {
    email: state.selected.email,
    timestamp: state.selected.timestamp,
    studentId: state.selected.studentId,
    remarks: dRemarks ? (dRemarks.value || "") : "",
    done: dDone ? dDone.checked : false
  };

  if (!navigator.onLine) {
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

  const res = await apiPost(
    { action: "update", idToken: state.idToken },
    body
  );

  if (res.status !== "success") {
    hideLoading();
    toast(res.message || "Save failed");
    return;
  }
  
  hideLoading();
	toast("Saved!");
	// ✅ stay on details screen
	showScreen(screenDetails);

	// refresh list silently (optional, para updated done/remarks)
	loadList(false);

	// reopen same student details para updated values
	openStudentDetailsByEmail(state.selected.email);
    clearRemarksBox(); // ✅ auto clear after save
}

/*******************************************************
* function name: syncPendingUpdates
* parameter: none
* return: <void>
* purpose: Sends queued offline remark updates to the server when connection is restored.
********************************************************/
async function syncPendingUpdates(){

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

/* ===========================
   SEAT MAP (API)
=========================== */
/*******************************************************
* function name: loadRooms
* parameter: none
* return: <void>
* purpose: Loads available seat map rooms from the API and populates the room selector dropdown.
********************************************************/
async function loadRooms(){

  try {
    const res = await apiGet({
      action: "rooms",
      idToken: state.idToken
    });

    if (res.status !== "success") {
      console.warn("Rooms endpoint not ready:", res.message);
      return;
    }

    fillSelect(selSeatRoom, res.rooms || []);
  } catch (e) {
    console.warn("loadRooms failed:", e.toString());
  }
}

/* ✅ DELETE ROOM (ADMIN) */
/*******************************************************
* function name: deleteRoom
* parameter: none
* return: <void>
* purpose: Deletes the selected room and all its seats via admin-only API call and refreshes seat UI.
********************************************************/
async function deleteRoom(){

  if (!state.me || state.me.role !== "admin") {
    toast("Admin only.");
    return;
  }

  const room = selSeatRoom ? (selSeatRoom.value || "").trim() : "";
  if (!room) {
    toast("Select a room first.");
    return;
  }

  showLoading("Please wait, deleting room...");
  const ok = confirm(`Delete ROOM "${room}"?\n\nThis will remove ALL seats in this room.\nThis cannot be undone.`);
  if (!ok) return;

  try {
    const res = await apiPost(
      { action: "seatmapRoomDelete", idToken: state.idToken },
      { room }
    );

    if (res.status !== "success") {
      toast(res.message || "Delete room failed");
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

  } catch (e) {
    hideLoading();
    toast("Delete room error: " + e.toString());
  }
}

/*******************************************************
* function name: removeLastSeat
* parameter: none
* return: <void>
* purpose: Removes the highest-numbered empty seat in the current room and reloads seat map.
********************************************************/
async function removeLastSeat(){

  try {
    showLoading("Please wait, removing seat...");
    const room = (state.seat.room || "").trim();
    if (!room) {
      hideLoading();
      alert("Please load a room first.");
      return;
    }

    const seats = state.seat.seats || [];
    if (seats.length === 0) {
      hideLoading();
      alert("No seats to remove.");
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
      alert("No seats to remove.");
      return;
    }

    // find seat object
    const target = seats.find(x => String(x.seatNo) === String(maxSeatNo));
    if (!target) {
      hideLoading();
      alert("Seat not found.");
      return;
    }

    // ❌ cannot delete if seat is not empty
    const hasStudent =
      (target.studentEmail && target.studentEmail.trim() !== "") ||
      (target.studentId && target.studentId.trim() !== "") ||
      (target.studentName && target.studentName.trim() !== "");

    if (hasStudent) {
      hideLoading();
      alert(`Cannot remove seat ${maxSeatNo}. Student is assigned. Please clear seat first.`);
      return;
    }

    // delete from sheet
    const res = await apiPost(
      { action: "seatmapSeatDelete", idToken: state.idToken },
      { room, seatNo: String(maxSeatNo) }
    );

    if (res.status !== "success") {
      hideLoading();
      alert(res.message || "Failed to remove seat.");
      return;
    }

    // ✅ Reload from backend to reflect real max seat
    await cacheDelete("seatmap_" + room);
    await loadSeatRoom(room);

    hideLoading();
    alert(`Seat ${maxSeatNo} removed.`);

  } catch (err) {
    alert("Error removing seat: " + err.message);
  }
}

/*******************************************************
* function name: computeBestCols
* parameter: perSide (number)
* return: number
* purpose: Computes ideal grid column count per side based on seat count with min/max limits.
********************************************************/
function computeBestCols(perSide){

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
function renderSeatGrid(){

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
        ${
          hasStudent
            ? `
              <div class="seatAvatar">
                <img class="seatPhoto"
                     data-email="${escapeHtml(seat.studentEmail)}"
                     alt="photo"
                     src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
                      <svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'>
                        <rect width='100%' height='100%' fill='#f1f5f9'/>
                        <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
                          font-family='Arial' font-size='12' fill='#64748b'>...</text>
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

        const hasStudent =
          seat.studentEmail || seat.studentId || seat.studentName;

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
* function name: loadSeatPhotosInGrid
* parameter: none
* return: <void>
* purpose: Loads and caches student photos for all rendered seat cards using master student data.
********************************************************/
async function loadSeatPhotosInGrid(){

  try {
    if (!seatGrid) return;

    console.log("Seat photo load start:", (state.seat.masterStudents || []).length, "master students");

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

      console.log("Seat email:", email, "matched:", !!stu);

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
      const res = await apiGet({
        action: "photo",
        idToken: state.idToken,
        fileId
      });

      if (res.status !== "success") continue;

      const mime = res.mimeType || "image/jpeg";
      const dataUrl = `data:${mime};base64,${res.base64}`;

      img.src = dataUrl;
      photoCache.set(fileId, dataUrl);
      await cacheSet("photo_" + fileId, dataUrl);
    }
  } catch (err) {
    console.warn("Seat photo load failed:", err);
  }
}

/*******************************************************
* function name: openStudentDetailsByEmail
* parameter: email (string)
* return: <void>
* purpose: Fetches a student record by email and opens the details screen view.
********************************************************/
async function openStudentDetailsByEmail(email){

  if (!email) {
    toast("Missing student email.");
    return;
  }

  showLoading("Loading profile...");

  try {
    const res = await apiGet({
      action: "recordByEmail",
      idToken: state.idToken,
      email: email
    });

    hideLoading();

    if (!res || res.status !== "success" || !res.item) {
      toast(res?.message || "Student not found.");
      return;
    }

    const item = res.item;

    if (!lastScreenBeforeDetails) {
      lastScreenBeforeDetails = state.currentScreen;
    }
    console.log("items: ", item);
    await openDetails(item, 0);
    //updateGradeSeat();
    clearRemarksBox();
  } catch (err) {
    toast("Open student error: " + err.toString());
  }
}

/*******************************************************
* function name: saveSeat
* parameter: none
* return: <void>
* purpose: Saves or updates a seat assignment for the current room via seat map API.
********************************************************/
async function saveSeat(){

  if (!state.seat.room) {
    toast("Select a room first.");
    return;
  }

  const seatNo = (inpSeatNo ? (inpSeatNo.value || "").trim() : "");
  if (!seatNo) {
    toast("Seat No is required.");
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
      return;
    }

    toast("Seat saved!");
    await loadSeatRoom(state.seat.room);
  } catch (e) {
    toast("Save seat error: " + e.toString());
  }
}

/*******************************************************
* function name: clearSeatEditor
* parameter: none
* return: void
* purpose: Clears all seat editor input fields.
********************************************************/
function clearSeatEditor(){

  if (inpSeatNo) inpSeatNo.value = "";
  if (inpSeatEmail) inpSeatEmail.value = "";
  if (inpSeatId) inpSeatId.value = "";
  if (inpSeatName) inpSeatName.value = "";
}

/*******************************************************
* function name: addSeatEmpty
* parameter: none
* return: <void>
* purpose: Quickly creates an empty seat entry using the current seat number input.
********************************************************/
async function addSeatEmpty(){

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

/*******************************************************
* function name: addRoom
* parameter: none
* return: <void>
* purpose: Creates a new room with default seats via admin API and loads it into the seat map view.
********************************************************/
async function addRoom(){

  showLoading("Please wait, saving room...");
  if (!state.me || state.me.role !== "admin") {
    hideLoading();
    toast("Admin only.");
    return;
  }

  const room = (inpNewRoom ? (inpNewRoom.value || "").trim() : "");
  if (!room) {
    hideLoading();
    toast("Room is required.");
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
* function name: loadSeatMapMaster
* parameter: none
* return: <void>
* purpose: Loads master student list used for seat map matching and autofill.
********************************************************/
async function loadSeatMapMaster(){

  document.getElementById('tabContentGrades')?.classList.add('hidden');
  try {
    const res = await apiGet({
      action: "seatmapMaster",
      idToken: state.idToken
    });

    //console.log("MASTER STUDENTS SAMPLE:", res.students[0]);
    //console.log("MASTER STUDENTS SAMPLE:", (res.students || [])[0]);

    if (res.status !== "success") {
      console.warn("seatmapMaster failed:", res.message);
      return;
    }

    state.seat.masterStudents = res.students || [];
    console.log("Loaded master students:", state.seat.masterStudents.length);

  } catch (e) {
    console.warn("loadSeatMapMaster error:", e.toString());
  }
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
    document.querySelectorAll(".recordNav")
      .forEach(el => el.classList.add("hidden"));

    // hide header nav buttons
    document.querySelectorAll(".detailsHeaderBtns")
      .forEach(el => el.classList.add("hidden"));

    // hide photo card
    document.querySelectorAll(".photo-card")
      .forEach(el => el.classList.add("hidden"));

    // force single-column layout
    document.querySelectorAll(".details-grid")
      .forEach(el => el.classList.add("student-mode"));

    // disable admin inputs
    if (dRemarks) dRemarks.disabled = true;
    if (dDone) dDone.disabled = true;

    // hide admin buttons
    if (btnSave) btnSave.classList.add("hidden");
    if (btnHistory) btnHistory.classList.add("hidden");

  }

  // ===== REVIEWER / ADMIN =====
  else {

    document.querySelectorAll(".recordNav")
      .forEach(el => el.classList.remove("hidden"));

    document.querySelectorAll(".detailsHeaderBtns")
      .forEach(el => el.classList.remove("hidden"));

    document.querySelectorAll(".photo-card")
      .forEach(el => el.classList.remove("hidden"));

    document.querySelectorAll(".details-grid")
      .forEach(el => el.classList.remove("student-mode"));

    if (dRemarks) dRemarks.disabled = false;
    if (dDone) dDone.disabled = false;

    if (btnSave) btnSave.classList.remove("hidden");
    if (btnHistory) btnHistory.classList.remove("hidden");
  }
}

/* ===========================
   ACCORDION
=========================== */
/*******************************************************
* function name: toggleAccordion
* parameter: bodyEl (HTMLElement), arrowEl (HTMLElement)
* return: void
* purpose: Toggles accordion section visibility and arrow indicator state.
********************************************************/
function toggleAccordion(bodyEl, arrowEl){

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
    const n = parseInt(selPageSize.value, 10);
    state.list.pageSize = isNaN(n) ? 20 : n;
    state.list.page = 1; // reset to first page
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

  alert("Reset done. Reloading app...");
  location.reload();
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
      categories:[],
      scores:{}
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

    // hide grading summary
    document.getElementById('tabContentGrades')?.classList.add('hidden');
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
  };
}
if (fTerm) {
  fTerm.onchange = async () => {
    state.filters.term = fTerm.value;
    await loadCascadeOptions();
  };
}
if (fCourseSubject) {
  fCourseSubject.onchange = async () => {
    state.filters.courseSubject = fCourseSubject.value;
    await loadCascadeOptions();
  };
}

if (fProgram) {
  fProgram.onchange = async () => {
    state.filters.program = fProgram.value;
    await loadCascadeOptions();
  };
}

if (btnGoList) {
  btnGoList.onclick = async () => {
    state.filters.schoolYear = fSchoolYear ? fSchoolYear.value : "";
    state.filters.term = fTerm ? fTerm.value : "";
    state.filters.courseSubject = fCourseSubject ? fCourseSubject.value : "";
    state.filters.program = fProgram ? fProgram.value : "";

    state.list.page = 1;

    showLoading("Loading Records...");

    showScreen(screenList);
    await loadList(true);

    hideLoading();
  };
}

if (btnChangeFilter) btnChangeFilter.onclick = () => showScreen(screenFilters);
if (btnRefresh) btnRefresh.onclick = async () => await loadList(false);

if (inpSearch) {
  inpSearch.oninput = () => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(async () => {
      state.ui.search = inpSearch.value || "";
      await loadList(true);
    }, 300); // 300ms wait after typing
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
    if (state.list.page > 1) {
      state.list.page--;
      await loadList(false);
    }
  };
}

if (btnNext) {
  btnNext.onclick = async () => {
    state.list.page++;
    await loadList(false);
  };
}

if (btnPrevTop) {
  btnPrevTop.onclick = async () => {
    if (state.list.page > 1) {
      state.list.page--;
      await loadList(false);
    }
  };
}

if (btnNextTop) {
  btnNextTop.onclick = async () => {
    state.list.page++;
    await loadList(false);
  };
}

if (btnBackToList) {
	btnBackToList.onclick = () => {
	  if (lastScreenBeforeDetails === "seatmap") {
    document.getElementById('tabContentGrades')?.classList.add('hidden');
		showScreen(screenSeatMap);
		lastScreenBeforeDetails = null;
		return;
	  } else {
    document.getElementById('tabContentGrades')?.classList.add('hidden');
	  showScreen(screenList);
    }
	};
}

if (btnSave) btnSave.onclick = saveCurrent;
if (btnHistory) btnHistory.onclick = loadHistory;
if (btnGrades) {
  btnGrades.onclick = () => {
    //console.log("GRADES BUTTON CLICKED — UNDER CONSTRUCTION");
    openDetailsTab("grades");
    //alert("Grades module — UNDER CONSTRUCTION");
  };
}

if (btnUploadEvidence) {
  btnUploadEvidence.onclick = async () => {
    try {
      if (!state.selected) return;

      const file = inpEvidenceFile ? inpEvidenceFile.files[0] : null;
      if (!file) {
        toast("Please choose a file first.");
        return;
      }

      showLoading("Please wait, uploading evidence...");

      await handleUploadEvidence(file);

      await loadEvidenceList();

      hideLoading();
    } catch (err) {
      hideLoading();
      toast("Upload error: " + err.toString());
    }
  };
}

// remarks preview - desktop
const btnPvSave = document.getElementById("btnPvSaveRemarks");

if (btnPvSave) {
  btnPvSave.onclick = async () => {
    if (state.me.role === "student") {
      alert("Students cannot edit remarks.");
      return;
    }
    if (!state.seat.currentSeat) return;

    const text = document.getElementById("pvRemarks").value.trim();
    const seat = state.seat.currentSeat;

    // 🔥 get real record first (with timestamp)
    const recRes = await apiGet({
      action: "recordByEmail",
      idToken: state.idToken,
      email: seat.studentEmail
    });

    if (recRes.status !== "success" || !recRes.item) {
      alert("Record not found");
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
      alert("Remarks saved ✔");
    } else {
      alert(res.message || "Save failed");
    }
  };
}

if (btnPvMSave) {
  btnPvMSave.onclick = async () => {
    if (state.me.role === "student") {
      alert("Students cannot edit remarks.");
      return;
    }
    
    if (!state.seat.currentSeat) return;

    const text = document.getElementById("pvMRemarks").value.trim();
    const seat = state.seat.currentSeat;

    const recRes = await apiGet({
      action: "recordByEmail",
      idToken: state.idToken,
      email: seat.studentEmail
    });

    if (recRes.status !== "success" || !recRes.item) {
      alert("Record not found");
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
      alert("Remarks saved ✔");
    } else {
      alert(res.message || "Save failed");
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

    if (!room) {
      toast("Select a room.");
      if (btnAddTable) btnAddTable.classList.add("hidden");
      if (seatRoomLabel) seatRoomLabel.textContent = "Room: -";
      state.seat.room = "";
      return;
    }

    // ✅ IMPORTANT: SET CURRENT ROOM STATE
    state.seat.room = room;

    // Loading room
    showLoading("Loading Room...");

    // ✅ UPDATE ROOM LABEL SA UI
    if (seatRoomLabel) seatRoomLabel.textContent = `Room: ${room}`;

    // show Add Seat button (admin tools)
    if (btnAddTable) btnAddTable.classList.remove("hidden");

    // show loading text while waiting
    if (seatGrid) seatGrid.innerHTML = `<div class="muted">Loading seats...</div>`;

    updateDeleteRoomButtonVisibility();

    // background load master list
    loadSeatMapMaster();

    // load seats (cached first, then online)
    await loadSeatRoom(room);

    // refresh debug info if open
    refreshDebugInfo();

    hideLoading();
  };
}

if (btnSeatBack) {
  btnSeatBack.onclick = () => {
    state.nav.backTo = "menu";
    showScreen(screenMenu);
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
        return;
      }

      // ✅ Reload from sheet so UI is always correct
      await loadSeatRoom(room);

      hideLoading();
      toast(`Seat ${nextSeatNo} added!`);

    } catch (err) {
      hideLoading();
      toast("Add seat error: " + err.toString());
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

    if (addTableWrap) addTableWrap.classList.add("hidden");

    // reset room label until loaded
    if (seatRoomLabel) seatRoomLabel.textContent = "Room: -";

    // clear state
    state.seat.room = "";
    state.seat.seats = [];

    // clear grid
    if (seatGrid) seatGrid.innerHTML = "";
    
    refreshDebugInfo();
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

/*******************************************************
* function name: applyStudentToModal
* parameter: stu (object)
* return: void
* purpose: Applies selected student data into seat edit modal fields with lock protection.
********************************************************/
function applyStudentToModal(stu){

  if (!stu) return;

  seatEditLock = true;

  if (editStudentId) editStudentId.value = stu.studentId || "";
  if (editStudentEmail) editStudentEmail.value = stu.studentEmail || "";
  if (editStudentName) editStudentName.value = stu.studentName || "";

  seatEditLock = false;
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

if (editStudentName) {
  editStudentName.oninput = () => {
    if (seatEditLock) return;
    const stu = findStudentByName(editStudentName.value);
    if (stu) applyStudentToModal(stu);
  };
}

if (fCourseSubject) {
  fCourseSubject.onchange = async () => {
    state.filters.courseSubject = fCourseSubject.value;
    saveSession();
  };
}

if (btnCloseSeatEdit) {
  btnCloseSeatEdit.onclick = () => closeSeatEditModal(true);
}

if (btnSeatEditCancel) {
  btnSeatEditCancel.onclick = () => closeSeatEditModal(true);
}
if (btnDeleteRoom) btnDeleteRoom.onclick = deleteRoom;

if (seatEditModal) {
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
		  throw new Error(res.message || "Save failed");
		}

      toast("Seat updated!");
      closeSeatEditModal();
	  await loadSeatRoom(state.seat.room);    

    } catch (err) {
      toast("Save error: " + err.toString());
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
    } finally {
		setSeatEditLocked(false); // ✅ Always unlock
	}
  };
}

/*******************************************************
* function name: setupAddTableAutofill
* parameter: none
* return: void
* purpose: Enables autofill linking between student ID, name, and email fields in add-seat form.
********************************************************/
function setupAddTableAutofill(){

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
}

if (btnRetryAllPending) {
  btnRetryAllPending.onclick = async () => {
    if (!navigator.onLine) {
      alert("Offline pa. Mag online muna bago mag Retry All.");
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
        idbDeleteEvidenceFile(item.offlineId).catch(() => {});
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

/* GLOBAL LOADING OVERLAY */
/*******************************************************
* function name: showLoading
* parameter: msg (string)
* return: void
* purpose: Displays the global loading overlay with optional message text.
********************************************************/
function showLoading(msg="Loading..."){
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
function hideLoading(){
  const el = document.getElementById("globalLoading");
  if (!el) return;
  el.classList.add("hidden");
}

/* ===========================
   INIT
=========================== */
/*******************************************************
* function name: init
* parameter: none
* return: void
* purpose: Initializes app configuration, restores session, validates token, loads base data, and routes initial screen.
********************************************************/
(function init(){

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
  //if (sess.idToken) state.idToken = sess.idToken;

  if (sess.filters) state.filters = sess.filters;
  if (sess.ui) state.ui = sess.ui;

  if (sess.list?.page) state.list.page = sess.list.page;
  if (sess.list?.pageSize) state.list.pageSize = sess.list.pageSize;

	if (selPageSize) {
	  selPageSize.value = String(state.list.pageSize || 20);
	}

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

        let me = await apiGet({ action:"me", idToken: state.idToken });

        if (me.status === "network_error") {
          console.warn("me() network error — retrying once...");
          await new Promise(r => setTimeout(r, 800));
          me = await apiGet({ action:"me", idToken: state.idToken });
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
        loadRooms();
        loadInitialFilters();
        loadSeatMapMaster();
		    renderPendingUI();

        if (state.idToken){
          console.log("Preloading Seat Master");

          const res = await apiGet({
            action: "seatmapMaster",
            idToken: state.idToken
          });

          if (res?.status === "success"){
            state.seat.masterStudents = res.students || [];
          }
        }

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
        else {
          showScreen(screenList);
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

/* ===========================
   SESSION ACTIVITY REFRESH
   (1-week inactivity timeout support)
=========================== */
/*******************************************************
* function name: refreshActivityStamp
* parameter: none
* return: void
* purpose: Updates last activity timestamp in localStorage to extend session lifetime.
********************************************************/
function refreshActivityStamp(){
  if (state.idToken) {
    localStorage.setItem("sf_login_time", Date.now());
  }
}

document.addEventListener("click", refreshActivityStamp);
document.addEventListener("keydown", refreshActivityStamp);
