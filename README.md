# 🎓 Student Form Viewer & Record Management System (v5)

A web-based Student Classroom Management System designed for instructors and administrators to manage student records, seat maps, grades, learner development metrics, remarks, and supporting evidence — with Google Login authentication and offline sync support.
A secure, role-based Student Record Viewer and Evaluation System built using:

- Google Apps Script (Backend API)
- Google Sheets (Database)
- Vanilla JavaScript (Frontend)
- HTML + CSS (Responsive UI)
- Google Drive (Photo & Evidence Storage)

Designed for schools to manage student submissions, verification, grading, learner development scoring, and classroom seat mapping — with **Admin, Reviewer, and Student** access modes.

---

# ✅ Core Features

## 🔐 Authentication & Security
- Google OAuth ID Token verification
- Allowed users list (Users sheet)
- Role-based access control:
  - **admin**
  - **reviewer**
  - **student**
- Reviewer assignment enforcement
- Student self-view only access

---

## 📋 Student Records Viewer

- Load records from Google Sheet (AppDB)
- Server-side filtering and pagination
- Search by:
  - Name
  - Email
  - Student ID
- Filters:
  - School Year
  - Term
  - Course Subject
  - Program
- Record detail viewer
- Evidence links support
- Remarks + Done status
- History log tracking

---

## 🧑‍🎓 Student Mode (Dedicated View)

Student has a separate clean screen:

Shows only:
- Basic Information
- Other Information
- Remarks (read-only)
- Evidence upload
- Grades
- Learner Development Radar Chart

Hidden from students:
- Record list
- Reviewer tools
- Admin tools
- Seat map editor
- Assignment controls
- Mark-as-done control

---

## 📝 Remarks & Audit History

Every update is logged to **RemarksLog** sheet:

Tracks:
- Timestamp
- Record key
- Updated by
- Action type
- Remarks
- Done status

Actions logged:
- UPDATE
- ASSIGN
- UPLOAD_EVIDENCE

---

## 📎 Evidence Upload System

Supports:
- Image uploads
- PDF uploads
- Large file uploads (chunked)

Features:
- Auto-save to Drive folder
- Public view link generation
- File type detection
- Upload history tracking
- Multiple evidence per record

---

## 🖼 Student Photo Handling

- Drive photo links supported
- Direct preview links generated
- Base64 photo endpoint for restricted files
- Thumbnail preview in:
  - Record list
  - Seat map
  - Detail view

---

## 🪑 Classroom Seat Map System

Admin-only module.

Features:
- Room management
- Auto-generate seat ranges (ex: 1001–1050)
- Assign student to seat
- Remove student from seat
- Delete empty seats
- Room delete with safety checks
- Seat preview popup:
  - Student photo
  - Name
  - ID
  - Email
  - Phone
  - Quick actions

Responsive layout:
- Desktop classroom grid with aisle
- Mobile stacked seat rows

---

## 📊 Grades Module

Per-student grading system.

Supports:
- Quiz / Assignment / Exam items
- Custom grade items
- Max score
- Weight %
- Score input
- Auto computed percent
- Final weighted grade
- Pass/Fail badge
- Stored in **GRADES** sheet

Role behavior:
- Admin/Reviewer → edit
- Student → read-only

---

## 📈 Learner Development Module

Radar chart scoring system.

Features:
- Category scoring (ex: Physical, Social, Emotional, Academic)
- Admin input scores
- Stored in **LearnerDev** sheet
- Student sees radar chart
- Auto reload per student

---

## 📶 Offline Support

Frontend includes:
- Offline detection
- Network status badge
- Pending upload queue
- Retry upload system
- Sync badge indicator

---

# 🗂 Google Sheets Structure

## AppDB (Main Records)
Required columns include:

- Timestamp
- Email Address
- Last Name, First Name M.I.
- Student ID Number
- School Year
- Term
- COURSE (Subject)
- Program
- Year Level
- 2X2 Picture
- Upload Proof of Enrollment
- Remarks
- Done
- Assigned To
- Last Updated
- Last Updated By
- Evidence Links

---

## Users Sheet

```
email | role | name
```

Roles:
- admin
- reviewer
- student

---

## RemarksLog Sheet

Auto-created if missing.

Tracks all record changes.

---

## SeatMap Sheet

```
room | seatNo | studentEmail | studentId | studentName | updatedAt | updatedBy
```

---

## GRADES Sheet

```
studentId | itemCode | itemName | max | weight | score | updatedAt | updatedBy
```

---

## LearnerDev Sheet

```
studentId | category | score | updatedAt | updatedBy
```

---

# ⚙️ Backend (Google Apps Script)

Main file: `code.gs`

Provides API endpoints via:

## doGet actions

- me
- list
- filters
- cascade
- recordByEmail
- history
- gradesLoad
- learnerDevLoad
- seatmap
- rooms
- photo
- evidence

## doPost actions

- update
- assign
- uploadEvidence
- uploadEvidenceChunk
- uploadEvidenceFinalize
- gradesSave
- learnerDevSave
- seatmapSave
- seatmapRoomAdd
- seatmapRoomDelete
- seatmapSeatDelete

---

# 💻 Frontend

Files:

```
index.html
style.css
app.js
```

Frontend handles:

- OAuth login
- Role routing
- Screen routing
- Record list UI
- Detail UI
- Student profile UI
- Grades UI
- Learner Dev chart
- Seat map UI
- Evidence upload
- Offline queue

---

# 👥 Roles

## Admin
- Full access
- Assign reviewers
- Edit records
- Seat map edit
- Grades edit
- Learner dev edit
- Room management

## Reviewer
- Assigned records only
- Can update remarks
- Upload evidence
- Grade students

## Student
- Self record only
- Read-only info
- Upload evidence
- View grades
- View learner development

---

# 🚀 Deployment

## Backend
1. Open Google Apps Script
2. Paste `code.gs`
3. Set Spreadsheet ID
4. Set Evidence Folder ID
5. Deploy as Web App
6. Allow access to Anyone with link

## Frontend
Deploy via:
- GitHub Pages
- Netlify
- Local server
- Any static host

---

# 📱 Responsive UI

Optimized for:
- Desktop
- Tablet
- Mobile phones

Includes:
- Mobile seat map layout
- Mobile button grids
- Mobile preview sheets
- Modal image viewer
- Pinch zoom support

---

# 🧪 Version

**Version:** v6  
Includes:
- Grades
- Learner Development
- Seat Map Enhancements
- Evidence Enhancements
- Student Mode Screen
- Mobile UI Fixes

---

# 👨‍💻 Author

Programmed by: **GIL**  
System Architecture + UI + Backend Integration

---

# 📌 Notes

- Requires Google account login
- Sheets act as database
- Drive stores files
- Apps Script is backend API
- No external frameworks used
- Fully vanilla JS stack

---

# 📄 License

Internal / Educational Use  
Customize as needed for your institution.



