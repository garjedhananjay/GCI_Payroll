import { useState, useRef, useCallback } from "react";

const B = {
  primary: "#5B4FC4",
  primaryLight: "#7B71D4",
  accent: "#E8843C",
  text: "#2D3748",
  textLight: "#718096",
  textMuted: "#A0AEC0",
  border: "#E2E8F0",
  borderLight: "#EDF2F7",
  surface: "#FFFFFF",
  bg: "#F7FAFC",
  bgAlt: "#EDF2F7",
  cardBg: "#FAFBFF",
  highlight: "#F0EEFF",
  highlightBorder: "#D6D0F0",
  green: "#48BB78",
  greenBg: "#F0FFF4",
  red: "#E53E3E",
  redBg: "#FFF5F5",
  redLight: "#FED7D7",
  orangeBg: "#FFFAF0",
  orangeLight: "#FEEBC8",
};

const CO = {
  name: "Garje Cloud India Private Limited",
  addr: "1203, G Square Business Park, Sector 30A, Vashi, Navi Mumbai - 400705",
  brand: "Cloudgov.ai",
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
const fmt = (v) => `₹${Math.round(v).toLocaleString("en-IN")}`;
const fmtD = (v) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── MINIMAL ZIP CREATOR ──
function createZip(files) {
  // files: [{ name: string, content: string }]
  const te = new TextEncoder();
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  const crc32 = (buf) => {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  };

  const toU16 = (v) => new Uint8Array([v & 0xFF, (v >> 8) & 0xFF]);
  const toU32 = (v) => new Uint8Array([v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF]);

  for (const file of files) {
    const data = te.encode(file.content);
    const nameBytes = te.encode(file.name);
    const crc = crc32(data);
    const localHeader = new Uint8Array([
      0x50, 0x4B, 0x03, 0x04, // sig
      0x14, 0x00, // version
      0x00, 0x00, // flags
      0x00, 0x00, // compression (store)
      0x00, 0x00, 0x00, 0x00, // mod time/date
      ...toU32(crc),
      ...toU32(data.length), // compressed
      ...toU32(data.length), // uncompressed
      ...toU16(nameBytes.length),
      0x00, 0x00, // extra length
    ]);
    localHeaders.push({ header: localHeader, name: nameBytes, data, offset });

    const centralHeader = new Uint8Array([
      0x50, 0x4B, 0x01, 0x02,
      0x14, 0x00, 0x14, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      ...toU32(crc),
      ...toU32(data.length),
      ...toU32(data.length),
      ...toU16(nameBytes.length),
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      ...toU32(offset),
    ]);
    centralHeaders.push({ header: centralHeader, name: nameBytes });
    offset += localHeader.length + nameBytes.length + data.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const ch of centralHeaders) centralDirSize += ch.header.length + ch.name.length;

  const endRecord = new Uint8Array([
    0x50, 0x4B, 0x05, 0x06,
    0x00, 0x00, 0x00, 0x00,
    ...toU16(files.length),
    ...toU16(files.length),
    ...toU32(centralDirSize),
    ...toU32(centralDirOffset),
    0x00, 0x00,
  ]);

  const totalSize = offset + centralDirSize + endRecord.length;
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const lh of localHeaders) {
    result.set(lh.header, pos); pos += lh.header.length;
    result.set(lh.name, pos); pos += lh.name.length;
    result.set(lh.data, pos); pos += lh.data.length;
  }
  for (const ch of centralHeaders) {
    result.set(ch.header, pos); pos += ch.header.length;
    result.set(ch.name, pos); pos += ch.name.length;
  }
  result.set(endRecord, pos);
  return result;
}
function numberToWords(num) {
  if (num <= 0) return "Zero Rupees Only";
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function tw(n) { if (n < 20) return ones[n]; return tens[Math.floor(n/10)] + (n%10 ? " "+ones[n%10] : ""); }
  let r = "", n = Math.round(num);
  const cr = Math.floor(n/10000000); n %= 10000000;
  const lk = Math.floor(n/100000); n %= 100000;
  const th = Math.floor(n/1000); n %= 1000;
  const hd = Math.floor(n/100); const rm = n%100;
  if (cr) r += tw(cr)+" Crore "; if (lk) r += tw(lk)+" Lakh ";
  if (th) r += tw(th)+" Thousand "; if (hd) r += ones[hd]+" Hundred ";
  if (rm) { if (r) r += "and "; r += tw(rm); }
  return r.trim() + " Rupees Only";
}

// ── PRE-LOADED EMPLOYEE DATABASE (sorted by DOJ, sequential IDs) ──
const INITIAL_DB = [
  // Sorted strictly by Date of Joining, sequential IDs regardless of status
  { id: 1, sno: "GC001", name: "Dhananjay Garje", designation: "Director, COO", location: "Navi Mumbai", doj: "01/06/2023", pan: "", bank: "", accNo: "", ifsc: "", basic: 120000, hra: 60000, conveyance: 1600, special: 58400, epfPct: 12, ptMonth: 200, status: "active" },
  { id: 2, sno: "GC002", name: "Meher Sowjanya", designation: "Talent Acquisition Manager", location: "Remote", doj: "01/06/2023", pan: "", bank: "", accNo: "", ifsc: "", basic: 57433.50, hra: 28716.75, conveyance: 1600, special: 27116.75, epfPct: 12, ptMonth: 200, status: "inactive" },
  { id: 3, sno: "GC003", name: "Pratik Valvi", designation: "Fullstack Developer", location: "Navi Mumbai", doj: "05/06/2023", pan: "", bank: "", accNo: "", ifsc: "", basic: 44933.50, hra: 22466.75, conveyance: 1600, special: 20866.75, epfPct: 12, ptMonth: 200, status: "inactive" },
  { id: 4, sno: "GC004", name: "Alakdeep Singh", designation: "Fullstack Developer", location: "Navi Mumbai", doj: "19/06/2023", pan: "", bank: "", accNo: "", ifsc: "", basic: 26183.50, hra: 13091.75, conveyance: 1600, special: 11491.75, epfPct: 12, ptMonth: 200, status: "inactive" },
  { id: 5, sno: "GC005", name: "Ankit Patil", designation: "Fullstack Developer", location: "Navi Mumbai", doj: "03/07/2023", pan: "", bank: "", accNo: "", ifsc: "", basic: 50000, hra: 25000, conveyance: 1600, special: 23400, epfPct: 12, ptMonth: 200, status: "active" },
  { id: 6, sno: "GC006", name: "Prathmesh Godse", designation: "Fullstack Developer", location: "Navi Mumbai", doj: "03/07/2023", pan: "", bank: "", accNo: "", ifsc: "", basic: 50000, hra: 25000, conveyance: 1600, special: 23400, epfPct: 12, ptMonth: 200, status: "inactive" },
  { id: 7, sno: "GC007", name: "Mansi Devrukhkar", designation: "Fullstack Developer", location: "Navi Mumbai", doj: "03/07/2023", pan: "", bank: "", accNo: "", ifsc: "", basic: 54166.67, hra: 27083.33, conveyance: 1600, special: 25483.33, epfPct: 12, ptMonth: 200, status: "inactive" },
  { id: 8, sno: "GC008", name: "Vishal Chaudhari", designation: "Fullstack Developer", location: "Navi Mumbai", doj: "04/08/2023", pan: "", bank: "", accNo: "", ifsc: "", basic: 50000, hra: 25000, conveyance: 1600, special: 23400, epfPct: 12, ptMonth: 200, status: "active" },
  { id: 9, sno: "GC009", name: "Arya Patole", designation: "Fullstack Intern", location: "Navi Mumbai", doj: "04/08/2023", pan: "", bank: "", accNo: "", ifsc: "", basic: 2500, hra: 1250, conveyance: 1600, special: -350, epfPct: 12, ptMonth: 200, status: "inactive" },
  { id: 10, sno: "GC010", name: "Saurabh Surve", designation: "Fullstack Developer", location: "Navi Mumbai", doj: "04/08/2023", pan: "", bank: "", accNo: "", ifsc: "", basic: 16666.50, hra: 8333.25, conveyance: 1600, special: 6733.25, epfPct: 12, ptMonth: 200, status: "inactive" },
  { id: 11, sno: "GC011", name: "Riddhish Khot", designation: "Fullstack Developer", location: "Navi Mumbai", doj: "04/08/2023", pan: "", bank: "", accNo: "", ifsc: "", basic: 16666.67, hra: 8333.33, conveyance: 1600, special: 6733.33, epfPct: 12, ptMonth: 200, status: "inactive" },
  { id: 12, sno: "GC012", name: "Kshitij Dumbre", designation: "Fullstack Intern", location: "Navi Mumbai", doj: "04/08/2023", pan: "", bank: "", accNo: "", ifsc: "", basic: 29166.67, hra: 14583.33, conveyance: 1600, special: 12983.33, epfPct: 12, ptMonth: 200, status: "inactive" },
  { id: 13, sno: "GC013", name: "Rohan Patel", designation: "Fullstack Developer", location: "Navi Mumbai", doj: "23/10/2023", pan: "", bank: "", accNo: "", ifsc: "", basic: 56250, hra: 28125, conveyance: 1600, special: 26525, epfPct: 12, ptMonth: 200, status: "active" },
  { id: 14, sno: "GC014", name: "Vaishnavi Manjarekar", designation: "Marketing Analyst", location: "Navi Mumbai", doj: "26/02/2024", pan: "", bank: "", accNo: "", ifsc: "", basic: 17500, hra: 8750, conveyance: 1600, special: 7150, epfPct: 12, ptMonth: 200, status: "inactive" },
  { id: 15, sno: "GC015", name: "Neil Ahlawat", designation: "Jr. Account Executive", location: "Navi Mumbai", doj: "17/04/2024", pan: "", bank: "", accNo: "", ifsc: "", basic: 14583.50, hra: 7291.75, conveyance: 1600, special: 5691.75, epfPct: 12, ptMonth: 200, status: "inactive" },
  { id: 16, sno: "GC016", name: "Vishal Rane", designation: "Enterprise Account Executive", location: "Navi Mumbai", doj: "03/02/2025", pan: "", bank: "", accNo: "", ifsc: "", basic: 85000, hra: 42500, conveyance: 1600, special: 40900, epfPct: 12, ptMonth: 200, status: "inactive" },
  { id: 17, sno: "GC017", name: "Manish Bodani", designation: "Enterprise Account Executive", location: "Delhi NCR", doj: "24/02/2025", pan: "", bank: "", accNo: "", ifsc: "", basic: 200000, hra: 100000, conveyance: 1600, special: 98400, epfPct: 12, ptMonth: 200, status: "inactive" },
  { id: 18, sno: "GC018", name: "Jeevan Chaudhary", designation: "Fullstack Developer", location: "Navi Mumbai", doj: "03/06/2025", pan: "", bank: "", accNo: "", ifsc: "", basic: 18750, hra: 9375, conveyance: 1600, special: 7775, epfPct: 12, ptMonth: 200, status: "active" },
  { id: 19, sno: "GC019", name: "Sudhanva Mangalvedhe", designation: "Fullstack Developer", location: "Navi Mumbai", doj: "01/08/2025", pan: "", bank: "", accNo: "", ifsc: "", basic: 18750, hra: 9375, conveyance: 1600, special: 7775, epfPct: 12, ptMonth: 200, status: "active" },
  { id: 20, sno: "GC020", name: "Amay Korade", designation: "Fullstack Developer", location: "Navi Mumbai", doj: "01/08/2025", pan: "", bank: "", accNo: "", ifsc: "", basic: 18750, hra: 9375, conveyance: 1600, special: 7775, epfPct: 12, ptMonth: 200, status: "active" },
  { id: 21, sno: "GC021", name: "Shivaji Ware", designation: "Fullstack Developer", location: "Navi Mumbai", doj: "01/08/2025", pan: "", bank: "", accNo: "", ifsc: "", basic: 18750, hra: 9375, conveyance: 1600, special: 7775, epfPct: 12, ptMonth: 200, status: "active" },
  { id: 22, sno: "GC022", name: "Rohit Mahajan", designation: "Fullstack Developer Intern", location: "Navi Mumbai", doj: "15/12/2025", pan: "", bank: "", accNo: "", ifsc: "", basic: 5000, hra: 2500, conveyance: 1600, special: 900, epfPct: 12, ptMonth: 200, status: "active" },
  { id: 23, sno: "GC023", name: "Omkar Lande", designation: "Fullstack Developer Intern", location: "Navi Mumbai", doj: "18/12/2025", pan: "", bank: "", accNo: "", ifsc: "", basic: 5000, hra: 2500, conveyance: 1600, special: 900, epfPct: 12, ptMonth: 200, status: "inactive" },
  { id: 24, sno: "GC024", name: "Yogita Mulye", designation: "BDR", location: "Navi Mumbai", doj: "22/12/2025", pan: "", bank: "", accNo: "", ifsc: "", basic: 23333.33, hra: 11666.67, conveyance: 1600, special: 10066.67, epfPct: 12, ptMonth: 200, status: "inactive" },
  { id: 25, sno: "GC025", name: "Mir Irtiza", designation: "SDR", location: "Navi Mumbai", doj: "22/12/2025", pan: "", bank: "", accNo: "", ifsc: "", basic: 12500, hra: 6250, conveyance: 1600, special: 4650, epfPct: 12, ptMonth: 200, status: "active" },
  { id: 26, sno: "GC026", name: "Yash Dhasade", designation: "Fullstack Developer Intern", location: "Navi Mumbai", doj: "29/12/2025", pan: "", bank: "", accNo: "", ifsc: "", basic: 5000, hra: 2500, conveyance: 1600, special: 900, epfPct: 12, ptMonth: 200, status: "active" },
  { id: 27, sno: "GC027", name: "Bal Aditya", designation: "SDR", location: "Remote", doj: "01/01/2026", pan: "", bank: "", accNo: "", ifsc: "", basic: 56250, hra: 28125, conveyance: 1600, special: 26525, epfPct: 12, ptMonth: 200, status: "active" },
  { id: 28, sno: "GC028", name: "Prasoon Mishra", designation: "SDR", location: "Remote", doj: "22/01/2026", pan: "", bank: "", accNo: "", ifsc: "", basic: 33333.50, hra: 16666.75, conveyance: 1600, special: 15066.75, epfPct: 12, ptMonth: 200, status: "active" },
];

// CSV Parser
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const rawHeaders = lines[0].split(/[,\t]/).map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
  const headerMap = {};
  const mappings = {
    sno: ["sno", "slno", "serialno", "empid", "employeeid", "id", "serial", "no"],
    name: ["employeename", "name", "fullname", "empname", "employee", "accountname"],
    designation: ["designation", "role", "position", "title", "jobtitle"],
    location: ["location", "city", "office", "branch", "place"],
    doj: ["doj", "dateofjoining", "joiningdate", "joindate", "startdate"],
    pan: ["pan", "pandetails", "pannumber", "panno", "pancard"],
    bank: ["bankname", "bank", "bankingpartner"],
    accNo: ["accountnumber", "accno", "accountno", "account", "bankaccount", "acno"],
    ifsc: ["ifscode", "ifsc", "bankifsc", "ifsccode"],
    basic: ["basic", "basicsalary", "basicpay"],
    hra: ["hra", "houserentallowance"],
    conveyance: ["conveyanceallowance", "conveyance", "transport", "transportallowance", "travelallowance"],
    special: ["specialallowance", "special", "otherpay", "otherallowance"],
    epfPct: ["epf", "epfpct", "epfpercent", "pf", "pfpercent"],
    ptMonth: ["pt", "professionaltax", "ptax", "ptmonth"],
  };
  rawHeaders.forEach((h, i) => { for (const [field, aliases] of Object.entries(mappings)) { if (aliases.includes(h)) { headerMap[field] = i; break; } } });
  const employees = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = [];
    let current = "", inQuotes = false;
    const delim = lines[0].includes("\t") ? "\t" : ",";
    for (const ch of lines[i]) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === delim && !inQuotes) { vals.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    vals.push(current.trim());
    const get = (field) => headerMap[field] !== undefined ? (vals[headerMap[field]] || "") : "";
    const getNum = (field, def = 0) => { const raw = get(field).replace(/[₹,\s]/g, ""); const v = parseFloat(raw); return isNaN(v) ? def : v; };
    const name = get("name");
    if (!name) continue;
    employees.push({ id: Date.now() + i, sno: get("sno") || String(i).padStart(3, "0"), name, designation: get("designation") || "—", location: get("location") || "Navi Mumbai", doj: get("doj"), pan: get("pan"), bank: get("bank"), accNo: get("accNo"), ifsc: get("ifsc"), basic: getNum("basic"), hra: getNum("hra"), conveyance: getNum("conveyance"), special: getNum("special"), epfPct: getNum("epfPct", 12), ptMonth: getNum("ptMonth", 200), status: "active" });
  }
  return employees;
}

// ── REUSABLE COMPONENTS ──
const Icon = ({ d, size = 16, color = B.text }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
);
const ICONS = {
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  calendar: "M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2M16 2v4M8 2v4M3 10h18",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
  plus: "M12 5v14M5 12h14",
  edit: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  trash: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  check: "M20 6L9 17l-5-5",
  x: "M18 6L6 18M6 6l12 12",
  back: "M19 12H5M12 19l-7-7 7-7",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  db: "M12 2C6.48 2 2 4.02 2 6.5V17.5C2 19.98 6.48 22 12 22C17.52 22 22 19.98 22 17.5V6.5C22 4.02 17.52 2 12 2M22 12C22 14.48 17.52 16.5 12 16.5C6.48 16.5 2 14.48 2 12",
  search: "M11 17.25a6.25 6.25 0 1 1 0-12.5 6.25 6.25 0 0 1 0 12.5zM16 16l4.5 4.5",
};

function Btn({ children, onClick, variant = "primary", size = "md", icon, disabled = false, style: sx = {} }) {
  const base = { display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, borderRadius: 8, cursor: disabled ? "default" : "pointer", border: "none", transition: "all 0.15s", opacity: disabled ? 0.5 : 1, fontFamily: "Arial, sans-serif" };
  const sizes = { sm: { padding: "6px 12px", fontSize: 11 }, md: { padding: "9px 18px", fontSize: 13 }, lg: { padding: "12px 28px", fontSize: 14 } };
  const variants = {
    primary: { backgroundColor: B.primary, color: B.surface },
    secondary: { backgroundColor: B.surface, color: B.primary, border: `1.5px solid ${B.primary}` },
    ghost: { backgroundColor: "transparent", color: B.text, border: `1px solid ${B.border}` },
    danger: { backgroundColor: B.redBg, color: B.red, border: `1px solid ${B.redLight}` },
    success: { backgroundColor: B.green, color: B.surface },
    accent: { backgroundColor: B.accent, color: B.surface },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...sizes[size], ...variants[variant], ...sx }}>{icon}{children}</button>;
}

function Input({ label, value, onChange, type = "text", placeholder = "", readOnly = false, width, suffix, style: sx = {} }) {
  return (
    <div style={{ width: width || "100%", ...sx }}>
      {label && <label style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: B.textLight, marginBottom: 3, letterSpacing: 0.3 }}>{label}</label>}
      <div style={{ position: "relative" }}>
        <input type={type} value={value} onChange={onChange} placeholder={placeholder} readOnly={readOnly}
          style={{ width: "100%", padding: "8px 10px", paddingRight: suffix ? 36 : 10, border: `1px solid ${readOnly ? B.borderLight : B.border}`, borderRadius: 6, fontSize: 13, color: B.text, backgroundColor: readOnly ? B.bgAlt : B.surface, fontWeight: readOnly ? 600 : 400, outline: "none", boxSizing: "border-box", fontFamily: "Arial, sans-serif" }}
          onFocus={(e) => { if (!readOnly) e.target.style.borderColor = B.primary; }}
          onBlur={(e) => { e.target.style.borderColor = B.border; }}
        />
        {suffix && <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: B.textMuted, fontWeight: 500 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options, width }) {
  return (
    <div style={{ width: width || "100%" }}>
      {label && <label style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: B.textLight, marginBottom: 3, letterSpacing: 0.3 }}>{label}</label>}
      <select value={value} onChange={onChange} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${B.border}`, borderRadius: 6, fontSize: 13, color: B.text, backgroundColor: B.surface, fontFamily: "Arial, sans-serif" }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Badge({ children, color = B.primary }) {
  const bgMap = { [B.green]: B.greenBg, [B.red]: B.redBg, [B.primary]: B.highlight };
  return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 12, fontSize: 10, fontWeight: 600, backgroundColor: bgMap[color] || B.highlight, color, letterSpacing: 0.3 }}>{children}</span>;
}

function Card({ children, style: sx = {} }) {
  return <div style={{ backgroundColor: B.surface, borderRadius: 10, border: `1px solid ${B.border}`, ...sx }}>{children}</div>;
}

function Section({ title, color = B.primary, children, action }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 3, height: 16, backgroundColor: color, borderRadius: 2 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: B.text, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</span>
        <div style={{ flex: 1, height: 1, backgroundColor: B.border }} />
        {action}
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value, color = B.text }) {
  return (
    <div style={{ flex: 1, textAlign: "center", padding: "14px 8px" }}>
      <div style={{ fontSize: 9, color: B.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}

// ── CSV IMPORT MODAL ──
function CSVImportModal({ onImport, onClose }) {
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState("replace");
  const fileRef = useRef(null);
  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { const text = ev.target.result; setCsvText(text); setPreview(parseCSV(text)); };
    reader.readAsText(file);
  };
  const handleTextParse = () => { if (csvText.trim()) setPreview(parseCSV(csvText)); };
  const handleImport = () => { if (preview?.length) onImport(preview, mode); };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <Card style={{ maxWidth: 750, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: B.text, margin: 0 }}>Import Employees from CSV</h2>
          <Btn variant="ghost" size="sm" onClick={onClose}>Close</Btn>
        </div>
        <div style={{ padding: 24 }}>
          <Section title="Upload CSV File" color={B.primary}>
            <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" onChange={handleFile}
              style={{ width: "100%", padding: "8px 10px", border: `1px dashed ${B.border}`, borderRadius: 6, fontSize: 13, color: B.text, backgroundColor: B.bg, fontFamily: "Arial, sans-serif" }} />
          </Section>
          <Section title="Or Paste CSV / Tab-Separated Data" color={B.accent}>
            <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)}
              placeholder={"S.No.\tEmployee Name\tDesignation\tLocation\tDOJ\tBasic\tHRA\tConveyance\tSpecial Allowance\n001\tRahul Sharma\tSDR\tNavi Mumbai\t15/02/2025\t12500\t5000\t1600\t1733"}
              style={{ width: "100%", height: 120, padding: 12, border: `1px solid ${B.border}`, borderRadius: 8, fontSize: 12, fontFamily: "monospace", color: B.text, backgroundColor: B.bg, resize: "vertical", outline: "none", boxSizing: "border-box" }}
              onFocus={(e) => e.target.style.borderColor = B.primary}
              onBlur={(e) => e.target.style.borderColor = B.border} />
            <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
              <Btn variant="secondary" size="sm" onClick={handleTextParse}>Parse Data</Btn>
              <Select value={mode} onChange={(e) => setMode(e.target.value)} width="200px"
                options={[{ value: "replace", label: "Replace all employees" }, { value: "append", label: "Add to existing" }]} />
            </div>
          </Section>
          <div style={{ marginTop: 8, padding: 14, backgroundColor: B.bg, borderRadius: 8, border: `1px solid ${B.border}` }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: B.text, marginBottom: 6 }}>Expected Columns (flexible naming, comma or tab separated):</p>
            <p style={{ fontSize: 10, color: B.textLight, lineHeight: 1.6, margin: 0 }}>
              S.No, Employee Name, Designation, Location, DOJ, Basic, HRA, Conveyance Allowance, Special Allowance, PAN Details, Bank Name, Account Number, IFSCode, EPF (%), PT
            </p>
          </div>
          {preview && (
            <Section title={`Preview: ${preview.length} employee(s) found`} color={B.green}>
              <div style={{ maxHeight: 250, overflow: "auto", border: `1px solid ${B.border}`, borderRadius: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ backgroundColor: B.bgAlt, position: "sticky", top: 0 }}>
                      {["S.No","Name","Designation","Location","DOJ","Basic","HRA","Conv.","Special"].map(h => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: B.text, borderBottom: `1px solid ${B.border}`, fontSize: 10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((emp, i) => (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? B.surface : B.bg }}>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${B.borderLight}` }}>{emp.sno}</td>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${B.borderLight}`, fontWeight: 600 }}>{emp.name}</td>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${B.borderLight}` }}>{emp.designation}</td>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${B.borderLight}` }}>{emp.location}</td>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${B.borderLight}` }}>{emp.doj}</td>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${B.borderLight}` }}>{fmt(emp.basic)}</td>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${B.borderLight}` }}>{fmt(emp.hra)}</td>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${B.borderLight}` }}>{fmt(emp.conveyance)}</td>
                        <td style={{ padding: "6px 10px", borderBottom: `1px solid ${B.borderLight}` }}>{fmt(emp.special)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <Btn variant="ghost" onClick={() => setPreview(null)}>Cancel</Btn>
                <Btn variant="primary" onClick={handleImport} icon={<Icon d={ICONS.check} size={14} color={B.surface} />}>
                  Import {preview.length} Employee{preview.length > 1 ? "s" : ""}
                </Btn>
              </div>
            </Section>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── SALARY CALCULATION HELPER ──
function calcSlip(emp, totalDays, absent) {
  const present = totalDays - absent;
  const totalGross = emp.basic + emp.hra + emp.conveyance + emp.special;
  const perDay = totalDays > 0 ? totalGross / totalDays : 0;
  const earnedGross = Math.round(perDay * present);
  // Individual earned proportional to their share
  const earnedBasic = totalDays > 0 ? Math.round((emp.basic / totalDays) * present) : 0;
  const earnedHRA = totalDays > 0 ? Math.round((emp.hra / totalDays) * present) : 0;
  const earnedConv = totalDays > 0 ? Math.round((emp.conveyance / totalDays) * present) : 0;
  const earnedSpecial = earnedGross - earnedBasic - earnedHRA - earnedConv; // remainder to avoid rounding mismatch
  const epf = Math.round(earnedBasic * (emp.epfPct / 100));
  return { present, totalGross, perDay, earnedGross, earnedBasic, earnedHRA, earnedConv, earnedSpecial, epf };
}

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap');`;
const FONT_FAMILY = `'Wanted Sans', 'Segoe UI', Arial, sans-serif`;
const SIG_FONT = `'Dancing Script', cursive`;

// ── GENERATE SLIP HTML STRING (for ZIP downloads) ──
function generateSlipHTML(emp, month, year, attendance) {
  const totalDays = getDaysInMonth(month, year);
  const absent = attendance?.absent || 0;
  const s = calcSlip(emp, totalDays, absent);
  const pt = emp.ptMonth || 0;
  const tds = attendance?.tds || 0;
  const otherDed = attendance?.otherDed || 0;
  const totalDed = tds + s.epf + pt + otherDed;
  const netPay = s.earnedGross - totalDed;

  const infoRow = (l, v) => `<div style="display:flex;padding:7px 14px;background:#fff"><span style="font-size:10px;color:#A0AEC0;font-weight:500;min-width:110px">${l}</span><span style="font-size:11px;color:#2D3748;font-weight:600">${v || "\u2014"}</span></div>`;
  const earningRow = (label, monthly, earned, bg) => `<tr style="background:${bg}"><td style="padding:7px 12px;font-size:11px;color:#718096;font-weight:500">${label}</td><td style="padding:7px 12px;font-size:11px;color:#718096;text-align:right">${fmtD(monthly)}</td><td style="padding:7px 12px;font-size:11px;color:#2D3748;font-weight:600;text-align:right">${fmtD(earned)}</td></tr>`;
  const dedRow = (label, val, bg) => `<tr style="background:${bg}"><td style="padding:7px 12px;font-size:11px;color:#718096;font-weight:500">${label}</td><td style="padding:7px 12px;font-size:11px;color:#E53E3E;font-weight:600;text-align:right">${fmtD(val)}</td></tr>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Salary Slip - ${emp.name} - ${MONTHS[month]} ${year}</title>
<style>${FONT_IMPORT}@import url('https://cdn.jsdelivr.net/gh/AkariRin/wanted-sans-web@latest/WantedSans.min.css');*{margin:0;padding:0;box-sizing:border-box}body{font-family:${FONT_FAMILY};padding:20px;color:#2D3748}@media print{body{padding:10px}@page{margin:10mm;size:A4}}</style></head><body>
<div style="background:#fff;border-radius:10px;overflow:hidden;border:1px solid #E2E8F0;max-width:800px;margin:0 auto">
  <div style="background:#5B4FC4;padding:24px 30px;text-align:center;position:relative">
    <div style="position:absolute;top:0;left:0;right:0;height:3px;background:#E8843C"></div>
    <h1 style="color:#fff;font-size:18px;font-weight:700;letter-spacing:1px">${CO.name}</h1>
    <p style="color:rgba(255,255,255,0.7);font-size:10px;margin-top:6px">${CO.addr}</p>
    <div style="margin-top:14px;display:inline-block;padding:5px 24px;background:rgba(255,255,255,0.15);border-radius:20px;border:1px solid rgba(255,255,255,0.2)">
      <span style="color:#fff;font-size:12px;font-weight:600;letter-spacing:1px">SALARY SLIP \u2014 ${MONTHS[month].toUpperCase()} ${year}</span>
    </div>
  </div>
  <div style="padding:20px 28px 10px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#E2E8F0;border-radius:8px;overflow:hidden;border:1px solid #E2E8F0">
      ${infoRow("Employee Name", emp.name)}${infoRow("Designation", emp.designation)}
      ${infoRow("Employee ID", emp.sno)}${infoRow("Location", emp.location)}
      ${infoRow("Date of Joining", emp.doj)}${infoRow("PAN", emp.pan)}
      ${infoRow("Bank Name", emp.bank)}${infoRow("Account No.", emp.accNo)}
      ${infoRow("IFSC Code", emp.ifsc)}${infoRow("Pay Period", MONTHS[month] + " " + year)}
    </div>
  </div>
  <div style="padding:6px 28px">
    <div style="padding:6px 14px;background:#F7FAFC;border-radius:6px;border:1px solid #E2E8F0;font-size:10px;color:#718096">
      <span style="font-weight:600;color:#2D3748">Calculation:</span> Total Gross (${fmtD(s.totalGross)}) / ${totalDays} days = <span style="font-weight:600;color:#5B4FC4">${fmtD(s.perDay)}/day</span> x ${s.present} present days = <span style="font-weight:700;color:#2D3748">${fmtD(s.earnedGross)}</span>
    </div>
  </div>
  <div style="padding:10px 28px">
    <div style="display:flex;border-radius:8px;overflow:hidden;border:1px solid #E2E8F0">
      ${[["Total Days", totalDays, "#fff"], ["Present Days", s.present, "#F0EEFF"], ["Absent Days", absent, "#fff"]].map(([l,v,bg], i) =>
        `<div style="flex:1;text-align:center;padding:10px;background:${bg};${i<2?"border-right:1px solid #E2E8F0":""}"><div style="font-size:9px;color:#A0AEC0;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">${l}</div><div style="font-size:18px;font-weight:700;color:#2D3748;margin-top:2px">${v}</div></div>`
      ).join("")}
    </div>
  </div>
  <div style="padding:10px 28px;display:flex;gap:14px">
    <div style="flex:1">
      <table style="width:100%;border-collapse:collapse">
        <tr style="background:#5B4FC4"><th style="padding:8px 12px;font-size:9.5px;font-weight:700;color:rgba(255,255,255,0.9);text-align:left;text-transform:uppercase;letter-spacing:0.5px">Earnings</th><th style="padding:8px 12px;font-size:9.5px;font-weight:700;color:rgba(255,255,255,0.9);text-align:right;text-transform:uppercase">Monthly</th><th style="padding:8px 12px;font-size:9.5px;font-weight:700;color:rgba(255,255,255,0.9);text-align:right;text-transform:uppercase">Earned</th></tr>
        ${earningRow("Basic", emp.basic, s.earnedBasic, "#fff")}
        ${earningRow("HRA", emp.hra, s.earnedHRA, "#F7FAFC")}
        ${earningRow("Conveyance", emp.conveyance, s.earnedConv, "#fff")}
        ${earningRow("Special Allowance", emp.special, s.earnedSpecial, "#F7FAFC")}
        <tr style="background:#F0EEFF;border-top:2px solid #5B4FC4"><td style="padding:8px 12px;font-size:11px;color:#2D3748;font-weight:700">Total Gross</td><td style="padding:8px 12px;font-size:11px;color:#2D3748;font-weight:700;text-align:right">${fmtD(s.totalGross)}</td><td style="padding:8px 12px;font-size:11px;color:#2D3748;font-weight:700;text-align:right">${fmtD(s.earnedGross)}</td></tr>
      </table>
    </div>
    <div style="flex:1">
      <table style="width:100%;border-collapse:collapse">
        <tr style="background:#5B4FC4"><th style="padding:8px 12px;font-size:9.5px;font-weight:700;color:rgba(255,255,255,0.9);text-align:left;text-transform:uppercase;letter-spacing:0.5px">Deductions</th><th style="padding:8px 12px;font-size:9.5px;font-weight:700;color:rgba(255,255,255,0.9);text-align:right;text-transform:uppercase">Amount</th></tr>
        ${dedRow("TDS", tds, "#fff")}
        ${dedRow("EPF (" + emp.epfPct + "%)", s.epf, "#F7FAFC")}
        ${dedRow("Professional Tax", pt, "#fff")}
        ${dedRow("Other (WFH/Loan)", otherDed, "#F7FAFC")}
        <tr style="background:#FFF5F5;border-top:2px solid #E53E3E"><td style="padding:8px 12px;font-size:11px;color:#E53E3E;font-weight:700">Total Deductions</td><td style="padding:8px 12px;font-size:11px;color:#E53E3E;font-weight:700;text-align:right">${fmtD(totalDed)}</td></tr>
      </table>
    </div>
  </div>
  <div style="padding:10px 28px">
    <div style="background:linear-gradient(135deg,#5B4FC4 0%,#7B71D4 100%);border-radius:10px;padding:16px 24px;display:flex;justify-content:space-between;align-items:center">
      <div><div style="color:rgba(255,255,255,0.8);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px">Net Pay</div><div style="color:#fff;font-size:28px;font-weight:700;margin-top:2px">${fmtD(netPay)}</div></div>
      <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:8px 16px;max-width:350px"><div style="color:rgba(255,255,255,0.7);font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">In Words</div><div style="color:#fff;font-size:11px;font-weight:500;margin-top:2px">${numberToWords(Math.max(0, Math.round(netPay)))}</div></div>
    </div>
  </div>
  <div style="padding:16px 28px 20px;display:flex;justify-content:space-between;align-items:flex-end">
    <p style="font-size:9px;color:#A0AEC0;font-style:italic">This is a computer-generated document and does not require a signature.</p>
    <div style="text-align:right">
      <div style="font-size:10px;color:#2D3748;font-weight:600">For ${CO.name}</div>
      <div style="margin-top:12px;font-family:${SIG_FONT};font-size:24px;color:#2D3748;letter-spacing:1px">Dhananjay Garje</div>
      <div style="margin-top:4px;border-top:1px solid #E2E8F0;padding-top:4px"><span style="font-size:9px;color:#A0AEC0">Director, COO</span></div>
    </div>
  </div>
  <div style="height:3px;background:linear-gradient(90deg,#E8843C 0%,#5B4FC4 100%)"></div>
</div></body></html>`;
}

// ── SALARY SLIP PDF ──
function SalarySlip({ emp, month, year, attendance, onClose }) {
  const slipRef = useRef(null);
  const totalDays = getDaysInMonth(month, year);
  const absent = attendance?.absent || 0;
  const s = calcSlip(emp, totalDays, absent);
  const pt = emp.ptMonth || 0;
  const tds = attendance?.tds || 0;
  const otherDed = attendance?.otherDed || 0;
  const totalDed = tds + s.epf + pt + otherDed;
  const netPay = s.earnedGross - totalDed;

  const handlePrint = () => {
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>Salary Slip - ${emp.name} - ${MONTHS[month]} ${year}</title><style>${FONT_IMPORT}@import url('https://cdn.jsdelivr.net/gh/AkariRin/wanted-sans-web@latest/WantedSans.min.css');*{margin:0;padding:0;box-sizing:border-box}body{font-family:${FONT_FAMILY};padding:20px;color:#2D3748}@media print{body{padding:10px}@page{margin:10mm;size:A4}}</style></head><body>${slipRef.current.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const ERow = ({ cells, isHead = false, isTotal = false }) => (
    <div style={{ display: "flex", backgroundColor: isHead ? B.primary : isTotal ? B.highlight : "transparent", borderBottom: isHead ? "none" : `1px solid ${B.borderLight}` }}>
      {cells.map((c, i) => (
        <div key={i} style={{ flex: c.flex || 1, padding: "7px 12px", fontSize: isHead ? 9.5 : 11, fontWeight: isHead || isTotal ? 700 : 500, color: isHead ? B.surface : isTotal ? B.text : B.textLight, textAlign: c.align || "left", textTransform: isHead ? "uppercase" : "none", letterSpacing: isHead ? 0.5 : 0 }}>{c.v}</div>
      ))}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflow: "auto" }}>
      <div style={{ maxWidth: 820, width: "100%", maxHeight: "95vh", overflow: "auto", borderRadius: 12, backgroundColor: B.bg }}>
        <div style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", justifyContent: "space-between", padding: "12px 20px", backgroundColor: B.surface, borderBottom: `1px solid ${B.border}`, borderRadius: "12px 12px 0 0" }}>
          <Btn variant="ghost" size="sm" onClick={onClose} icon={<Icon d={ICONS.back} size={14} />}>Close</Btn>
          <Btn variant="primary" size="sm" onClick={handlePrint} icon={<Icon d={ICONS.download} size={14} color={B.surface} />}>Download PDF</Btn>
        </div>
        <div style={{ padding: 20 }}>
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap" />
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/AkariRin/wanted-sans-web@latest/WantedSans.min.css" />
          <div ref={slipRef} style={{ backgroundColor: B.surface, borderRadius: 10, overflow: "hidden", border: `1px solid ${B.border}`, fontFamily: FONT_FAMILY }}>
            <div style={{ backgroundColor: B.primary, padding: "24px 30px", textAlign: "center", position: "relative" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: B.accent }} />
              <h1 style={{ color: B.surface, fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>{CO.name}</h1>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, marginTop: 6 }}>{CO.addr}</p>
              <div style={{ marginTop: 14, display: "inline-block", padding: "5px 24px", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.2)" }}>
                <span style={{ color: B.surface, fontSize: 12, fontWeight: 600, letterSpacing: 1 }}>SALARY SLIP — {MONTHS[month].toUpperCase()} {year}</span>
              </div>
            </div>
            <div style={{ padding: "20px 28px 10px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, backgroundColor: B.border, borderRadius: 8, overflow: "hidden", border: `1px solid ${B.border}` }}>
                {[["Employee Name", emp.name], ["Designation", emp.designation], ["Employee ID", emp.sno], ["Location", emp.location], ["Date of Joining", emp.doj], ["PAN", emp.pan || "—"], ["Bank Name", emp.bank || "—"], ["Account No.", emp.accNo || "—"], ["IFSC Code", emp.ifsc || "—"], ["Pay Period", `${MONTHS[month]} ${year}`]]
                  .map(([l, v], i) => (
                    <div key={i} style={{ display: "flex", padding: "7px 14px", backgroundColor: B.surface }}>
                      <span style={{ fontSize: 10, color: B.textMuted, fontWeight: 500, minWidth: 110 }}>{l}</span>
                      <span style={{ fontSize: 11, color: B.text, fontWeight: 600 }}>{v || "—"}</span>
                    </div>
                  ))}
              </div>
            </div>
            {/* Calculation breakdown */}
            <div style={{ padding: "6px 28px" }}>
              <div style={{ padding: "6px 14px", backgroundColor: B.bg, borderRadius: 6, border: `1px solid ${B.border}`, fontSize: 10, color: B.textLight }}>
                <span style={{ fontWeight: 600, color: B.text }}>Calculation:</span> Total Gross ({fmtD(s.totalGross)}) / {totalDays} days = <span style={{ fontWeight: 600, color: B.primary }}>{fmtD(s.perDay)}/day</span> x {s.present} present days = <span style={{ fontWeight: 700, color: B.text }}>{fmtD(s.earnedGross)}</span>
              </div>
            </div>
            <div style={{ padding: "10px 28px" }}>
              <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${B.border}` }}>
                {[["Total Days", totalDays], ["Present Days", s.present], ["Absent Days", absent]].map(([l, v], i) => (
                  <div key={i} style={{ flex: 1, textAlign: "center", padding: 10, backgroundColor: i === 1 ? B.highlight : B.surface, borderRight: i < 2 ? `1px solid ${B.border}` : "none" }}>
                    <div style={{ fontSize: 9, color: B.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{l}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: B.text, marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: "10px 28px", display: "flex", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <ERow isHead cells={[{ v: "Earnings", flex: 2 }, { v: "Monthly", align: "right" }, { v: "Earned", align: "right" }]} />
                {[["Basic", emp.basic, s.earnedBasic], ["HRA", emp.hra, s.earnedHRA], ["Conveyance", emp.conveyance, s.earnedConv], ["Special Allowance", emp.special, s.earnedSpecial]]
                  .map(([l, m, e], i) => <ERow key={i} cells={[{ v: l, flex: 2 }, { v: fmtD(m), align: "right" }, { v: fmtD(e), align: "right" }]} />)}
                <ERow isTotal cells={[{ v: "Total Gross", flex: 2 }, { v: fmtD(s.totalGross), align: "right" }, { v: fmtD(s.earnedGross), align: "right" }]} />
              </div>
              <div style={{ flex: 1 }}>
                <ERow isHead cells={[{ v: "Deductions", flex: 2 }, { v: "Amount", align: "right" }]} />
                {[["TDS", tds], [`EPF (${emp.epfPct}%)`, s.epf], ["Professional Tax", pt], ["Other (WFH/Loan)", otherDed]]
                  .map(([l, v], i) => (
                    <div key={i} style={{ display: "flex", borderBottom: `1px solid ${B.borderLight}` }}>
                      <div style={{ flex: 2, padding: "7px 12px", fontSize: 11, color: B.textLight, fontWeight: 500 }}>{l}</div>
                      <div style={{ flex: 1, padding: "7px 12px", fontSize: 11, color: B.red, fontWeight: 600, textAlign: "right" }}>{fmtD(v)}</div>
                    </div>
                  ))}
                <div style={{ display: "flex", backgroundColor: B.redBg, borderTop: `2px solid ${B.red}` }}>
                  <div style={{ flex: 2, padding: "8px 12px", fontSize: 11, color: B.red, fontWeight: 700 }}>Total Deductions</div>
                  <div style={{ flex: 1, padding: "8px 12px", fontSize: 11, color: B.red, fontWeight: 700, textAlign: "right" }}>{fmtD(totalDed)}</div>
                </div>
              </div>
            </div>
            <div style={{ padding: "10px 28px" }}>
              <div style={{ background: `linear-gradient(135deg, ${B.primary} 0%, ${B.primaryLight} 100%)`, borderRadius: 10, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Net Pay</div>
                  <div style={{ color: B.surface, fontSize: 28, fontWeight: 700, marginTop: 2 }}>{fmtD(netPay)}</div>
                </div>
                <div style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 16px", maxWidth: 350 }}>
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>In Words</div>
                  <div style={{ color: B.surface, fontSize: 11, fontWeight: 500, marginTop: 2 }}>{numberToWords(Math.max(0, Math.round(netPay)))}</div>
                </div>
              </div>
            </div>
            <div style={{ padding: "16px 28px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <p style={{ fontSize: 9, color: B.textMuted, fontStyle: "italic" }}>This is a computer-generated document and does not require a signature.</p>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: B.text, fontWeight: 600 }}>For {CO.name}</div>
                <div style={{ marginTop: 12, fontFamily: "'Dancing Script', cursive", fontSize: 24, color: B.text, letterSpacing: 1 }}>Dhananjay Garje</div>
                <div style={{ marginTop: 4, borderTop: `1px solid ${B.border}`, paddingTop: 4 }}><span style={{ fontSize: 9, color: B.textMuted }}>Director, COO</span></div>
              </div>
            </div>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${B.accent} 0%, ${B.primary} 100%)` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── EMPLOYEE FORM MODAL ──
function EmployeeForm({ emp, onSave, onClose }) {
  const [f, setF] = useState(emp || {
    sno: "", name: "", designation: "", location: "Navi Mumbai", doj: "",
    pan: "", bank: "", accNo: "", ifsc: "",
    basic: "", hra: "", conveyance: "", special: "",
    epfPct: "12", ptMonth: "200", status: "active"
  });
  const u = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const n = (v) => parseFloat(v) || 0;
  const gross = n(f.basic) + n(f.hra) + n(f.conveyance) + n(f.special);
  const handleSave = () => {
    if (!f.name || !f.designation) { alert("Name and Designation are required"); return; }
    onSave({ ...f, id: f.id || Date.now(), basic: n(f.basic), hra: n(f.hra), conveyance: n(f.conveyance), special: n(f.special), epfPct: n(f.epfPct), ptMonth: n(f.ptMonth) });
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <Card style={{ maxWidth: 680, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: B.text, margin: 0 }}>{emp ? "Edit Employee" : "Add Employee"}</h2>
          <Btn variant="ghost" size="sm" onClick={onClose}>Close</Btn>
        </div>
        <div style={{ padding: 24 }}>
          <Section title="Personal Details">
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Input label="Employee ID" value={f.sno} onChange={u("sno")} width="30%" placeholder="GC001" />
              <Input label="Full Name" value={f.name} onChange={u("name")} width="35%" placeholder="Employee Name" />
              <Input label="Designation" value={f.designation} onChange={u("designation")} width="30%" placeholder="SDR" />
              <Input label="Location" value={f.location} onChange={u("location")} width="35%" placeholder="Navi Mumbai" />
              <Input label="Date of Joining" value={f.doj} onChange={u("doj")} width="30%" placeholder="DD/MM/YYYY" />
              <Select label="Status" value={f.status} onChange={u("status")} width="30%" options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
            </div>
          </Section>
          <Section title="Bank and PAN Details" color={B.accent}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Input label="PAN Number" value={f.pan} onChange={u("pan")} width="30%" placeholder="ABCDE1234F" />
              <Input label="Bank Name" value={f.bank} onChange={u("bank")} width="35%" placeholder="HDFC Bank" />
              <Input label="Account Number" value={f.accNo} onChange={u("accNo")} width="30%" placeholder="50100012345678" />
              <Input label="IFSC Code" value={f.ifsc} onChange={u("ifsc")} width="30%" placeholder="HDFC0001234" />
            </div>
          </Section>
          <Section title="Salary Structure (Monthly)" color={B.primary}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Input label="Basic" value={f.basic} onChange={u("basic")} type="number" width="23%" />
              <Input label="HRA" value={f.hra} onChange={u("hra")} type="number" width="23%" />
              <Input label="Conveyance" value={f.conveyance} onChange={u("conveyance")} type="number" width="23%" />
              <Input label="Special Allowance" value={f.special} onChange={u("special")} type="number" width="23%" />
              <Input label="EPF %" value={f.epfPct} onChange={u("epfPct")} type="number" width="23%" suffix="%" />
              <Input label="Prof. Tax / Month" value={f.ptMonth} onChange={u("ptMonth")} type="number" width="23%" />
              <Input label="Monthly Gross" value={fmt(gross)} readOnly width="23%" />
              <Input label="Annual CTC" value={fmt(gross * 12)} readOnly width="23%" />
            </div>
          </Section>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", paddingTop: 8 }}>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" onClick={handleSave} icon={<Icon d={ICONS.check} size={14} color={B.surface} />}>Save Employee</Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── BULK MONTH DOWNLOAD MODAL (for individual employee) ──
function BulkMonthModal({ emp, attendance, onClose }) {
  const curYear = new Date().getFullYear();
  const [selYear, setSelYear] = useState(curYear);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [generating, setGenerating] = useState(false);

  const toggleMonth = (m) => {
    setSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m].sort((a, b) => a - b));
  };
  const selectAll = () => setSelectedMonths([0,1,2,3,4,5,6,7,8,9,10,11]);
  const clearAll = () => setSelectedMonths([]);

  const getAtt = (empId, m, y) => attendance[`${empId}-${m}-${y}`] || { absent: 0, tds: 0, otherDed: 0 };

  const handleDownload = () => {
    if (selectedMonths.length === 0) return;
    setGenerating(true);
    setTimeout(() => {
      const files = selectedMonths.map(m => {
        const att = getAtt(emp.id, m, selYear);
        const html = generateSlipHTML(emp, m, selYear, att);
        const safeName = emp.name.replace(/[^a-zA-Z0-9]/g, "_");
        return { name: `${safeName}_${MONTHS[m]}_${selYear}.html`, content: html };
      });
      const zipData = createZip(files);
      const blob = new Blob([zipData], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeName = emp.name.replace(/[^a-zA-Z0-9]/g, "_");
      a.href = url;
      a.download = `Salary_Slips_${safeName}_${selYear}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setGenerating(false);
    }, 100);
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <Card style={{ maxWidth: 500, width: "100%" }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${B.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: B.text, margin: 0 }}>Bulk Download Salary Slips</h2>
            <p style={{ fontSize: 12, color: B.textMuted, marginTop: 2 }}>{emp.name} ({emp.sno})</p>
          </div>
          <Btn variant="ghost" size="sm" onClick={onClose}>Close</Btn>
        </div>
        <div style={{ padding: 24 }}>
          {/* Year Selector */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
            <Select label="Year" value={selYear} onChange={(e) => { setSelYear(parseInt(e.target.value)); setSelectedMonths([]); }} width="120px"
              options={[curYear - 2, curYear - 1, curYear, curYear + 1].map(y => ({ value: y, label: String(y) }))} />
            <div style={{ marginTop: 18, display: "flex", gap: 6 }}>
              <Btn variant="ghost" size="sm" onClick={selectAll}>Select All</Btn>
              <Btn variant="ghost" size="sm" onClick={clearAll}>Clear</Btn>
            </div>
          </div>

          {/* Month Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 }}>
            {MONTHS.map((m, i) => {
              const selected = selectedMonths.includes(i);
              return (
                <button key={i} onClick={() => toggleMonth(i)}
                  style={{
                    padding: "10px 8px", borderRadius: 8, cursor: "pointer", textAlign: "center",
                    border: selected ? `2px solid ${B.primary}` : `1px solid ${B.border}`,
                    backgroundColor: selected ? B.highlight : B.surface,
                    color: selected ? B.primary : B.textLight,
                    fontWeight: selected ? 700 : 500, fontSize: 12,
                    fontFamily: "Arial, sans-serif", transition: "all 0.15s",
                  }}>
                  {m.substring(0, 3)}
                </button>
              );
            })}
          </div>

          {/* Summary */}
          {selectedMonths.length > 0 && (
            <div style={{ padding: 12, backgroundColor: B.highlight, borderRadius: 8, marginBottom: 16, fontSize: 12, color: B.text }}>
              <span style={{ fontWeight: 600 }}>{selectedMonths.length} month{selectedMonths.length > 1 ? "s" : ""} selected:</span>{" "}
              {selectedMonths.map(m => MONTHS[m].substring(0, 3)).join(", ")} {selYear}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" onClick={handleDownload} disabled={selectedMonths.length === 0 || generating}
              icon={<Icon d={ICONS.download} size={14} color={B.surface} />}>
              {generating ? "Generating..." : `Download ${selectedMonths.length} Slip${selectedMonths.length !== 1 ? "s" : ""} as ZIP`}
            </Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── MAIN APP ──
export default function PayrollApp() {
  const [page, setPage] = useState("database");
  const [employees, setEmployees] = useState(INITIAL_DB);
  const [showForm, setShowForm] = useState(null);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [attendance, setAttendance] = useState({});
  const [viewSlip, setViewSlip] = useState(null);
  const [search, setSearch] = useState("");
  const [showBulkMonth, setShowBulkMonth] = useState(null); // employee for multi-month download
  const [generatingAll, setGeneratingAll] = useState(false);

  const totalDays = getDaysInMonth(month, year);
  const activeEmps = employees.filter(e => e.status === "active");
  const filteredEmps = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.designation.toLowerCase().includes(search.toLowerCase()) ||
    e.sno.toLowerCase().includes(search.toLowerCase())
  );

  const getAttendance = (empId) => attendance[`${empId}-${month}-${year}`] || { absent: 0, tds: 0, otherDed: 0 };
  const setAtt = (empId, field, value) => {
    const key = `${empId}-${month}-${year}`;
    setAttendance(prev => ({ ...prev, [key]: { ...getAttendance(empId), [field]: parseFloat(value) || 0 } }));
  };

  const calcPayroll = (emp) => {
    const att = getAttendance(emp.id);
    const s = calcSlip(emp, totalDays, att.absent);
    const totalDed = att.tds + s.epf + emp.ptMonth + att.otherDed;
    return { present: s.present, earnedGross: s.earnedGross, epf: s.epf, totalDed, netPay: s.earnedGross - totalDed, ...att };
  };

  const handleSaveEmployee = (emp) => {
    setEmployees(prev => { const idx = prev.findIndex(e => e.id === emp.id); if (idx >= 0) { const n = [...prev]; n[idx] = emp; return n; } return [...prev, emp]; });
    setShowForm(null);
  };
  const handleDelete = (id) => { if (confirm("Remove this employee from the database?")) setEmployees(prev => prev.filter(e => e.id !== id)); };
  const handleCSVImport = (imported, mode) => {
    if (mode === "replace") setEmployees(imported);
    else setEmployees(prev => [...prev, ...imported]);
    setShowCSVImport(false);
  };

  const handleDownloadAllSlips = () => {
    if (activeEmps.length === 0) return;
    setGeneratingAll(true);
    setTimeout(() => {
      const files = activeEmps.map(emp => {
        const att = getAttendance(emp.id);
        const html = generateSlipHTML(emp, month, year, att);
        const safeName = emp.name.replace(/[^a-zA-Z0-9]/g, "_");
        return { name: `${safeName}_${MONTHS[month]}_${year}.html`, content: html };
      });
      const zipData = createZip(files);
      const blob = new Blob([zipData], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `All_Salary_Slips_${MONTHS[month]}_${year}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setGeneratingAll(false);
    }, 100);
  };

  const totalPayroll = activeEmps.reduce((s, e) => s + calcPayroll(e).netPay, 0);
  const totalGrossPayroll = activeEmps.reduce((s, e) => s + calcPayroll(e).earnedGross, 0);
  const totalDeductions = activeEmps.reduce((s, e) => s + calcPayroll(e).totalDed, 0);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: B.bg, fontFamily: "Arial, sans-serif" }}>
      {/* Nav */}
      <div style={{ backgroundColor: B.surface, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, position: "sticky", top: 0, zIndex: 100, borderBottom: `1px solid ${B.border}` }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: B.text, letterSpacing: 0.3 }}>
          Cloudgov.ai <span style={{ color: B.textMuted, fontWeight: 400 }}>| Payroll Manager</span>
        </span>
        <div style={{ display: "flex", gap: 2 }}>
          {[{ id: "database", label: "Employee Database", icon: ICONS.db }, { id: "payroll", label: "Monthly Payroll", icon: ICONS.calendar }].map(tab => (
            <button key={tab.id} onClick={() => setPage(tab.id)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "Arial, sans-serif",
                backgroundColor: page === tab.id ? B.highlight : "transparent", color: page === tab.id ? B.primary : B.textLight, transition: "all 0.15s" }}>
              <Icon d={tab.icon} size={14} color={page === tab.id ? B.primary : B.textMuted} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        {/* DATABASE */}
        {page === "database" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: B.text, margin: 0 }}>Employee Database</h1>
                <p style={{ fontSize: 12, color: B.textMuted, marginTop: 4 }}>{activeEmps.length} active employees, {employees.length} total</p>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <Btn variant="secondary" size="md" onClick={() => setShowCSVImport(true)} icon={<Icon d={ICONS.upload} size={14} color={B.primary} />}>Import CSV</Btn>
                <Btn onClick={() => setShowForm("new")} icon={<Icon d={ICONS.plus} size={14} color={B.surface} />}>Add Employee</Btn>
              </div>
            </div>
            <div style={{ marginBottom: 16, maxWidth: 400 }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, designation, or ID..."
                style={{ width: "100%", padding: "10px 14px", border: `1px solid ${B.border}`, borderRadius: 8, fontSize: 13, color: B.text, outline: "none", backgroundColor: B.surface, fontFamily: "Arial, sans-serif" }}
                onFocus={(e) => e.target.style.borderColor = B.primary} onBlur={(e) => e.target.style.borderColor = B.border} />
            </div>

            {/* Employee Table View */}
            <Card style={{ overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ backgroundColor: B.bgAlt }}>
                      {["ID", "Employee Name", "Designation", "Location", "DOJ", "Basic", "HRA", "Conv.", "Special", "Gross/Mo", "Status", ""].map(h => (
                        <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: B.text, borderBottom: `2px solid ${B.border}`, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmps.map((emp, idx) => {
                      const gross = emp.basic + emp.hra + emp.conveyance + emp.special;
                      return (
                        <tr key={emp.id} style={{ backgroundColor: idx % 2 === 0 ? B.surface : B.bg, transition: "background-color 0.1s" }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = B.highlight}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? B.surface : B.bg}>
                          <td style={{ padding: "9px 12px", borderBottom: `1px solid ${B.borderLight}`, fontWeight: 600, color: B.primary, fontSize: 11 }}>{emp.sno}</td>
                          <td style={{ padding: "9px 12px", borderBottom: `1px solid ${B.borderLight}`, fontWeight: 600, color: B.text, whiteSpace: "nowrap" }}>{emp.name}</td>
                          <td style={{ padding: "9px 12px", borderBottom: `1px solid ${B.borderLight}`, color: B.textLight }}>{emp.designation}</td>
                          <td style={{ padding: "9px 12px", borderBottom: `1px solid ${B.borderLight}`, color: B.textLight }}>{emp.location}</td>
                          <td style={{ padding: "9px 12px", borderBottom: `1px solid ${B.borderLight}`, color: B.textLight, whiteSpace: "nowrap" }}>{emp.doj}</td>
                          <td style={{ padding: "9px 12px", borderBottom: `1px solid ${B.borderLight}`, color: B.text, textAlign: "right" }}>{fmt(emp.basic)}</td>
                          <td style={{ padding: "9px 12px", borderBottom: `1px solid ${B.borderLight}`, color: B.text, textAlign: "right" }}>{fmt(emp.hra)}</td>
                          <td style={{ padding: "9px 12px", borderBottom: `1px solid ${B.borderLight}`, color: B.text, textAlign: "right" }}>{fmt(emp.conveyance)}</td>
                          <td style={{ padding: "9px 12px", borderBottom: `1px solid ${B.borderLight}`, color: B.text, textAlign: "right" }}>{fmt(emp.special)}</td>
                          <td style={{ padding: "9px 12px", borderBottom: `1px solid ${B.borderLight}`, fontWeight: 700, color: B.primary, textAlign: "right" }}>{fmt(gross)}</td>
                          <td style={{ padding: "9px 12px", borderBottom: `1px solid ${B.borderLight}` }}>
                            <Badge color={emp.status === "active" ? B.green : B.textMuted}>{emp.status}</Badge>
                          </td>
                          <td style={{ padding: "9px 12px", borderBottom: `1px solid ${B.borderLight}`, whiteSpace: "nowrap" }}>
                            <button onClick={() => setShowForm(emp)} style={{ padding: 4, border: "none", borderRadius: 4, backgroundColor: "transparent", cursor: "pointer", marginRight: 4 }}><Icon d={ICONS.edit} size={14} color={B.primary} /></button>
                            <button onClick={() => handleDelete(emp.id)} style={{ padding: 4, border: "none", borderRadius: 4, backgroundColor: "transparent", cursor: "pointer" }}><Icon d={ICONS.trash} size={14} color={B.red} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: B.highlight, borderTop: `2px solid ${B.primary}` }}>
                      <td colSpan={5} style={{ padding: "10px 12px", fontWeight: 700, fontSize: 11, color: B.text }}>TOTAL ({filteredEmps.length} employees)</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, fontSize: 11, color: B.text, textAlign: "right" }}>{fmt(filteredEmps.reduce((s, e) => s + e.basic, 0))}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, fontSize: 11, color: B.text, textAlign: "right" }}>{fmt(filteredEmps.reduce((s, e) => s + e.hra, 0))}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, fontSize: 11, color: B.text, textAlign: "right" }}>{fmt(filteredEmps.reduce((s, e) => s + e.conveyance, 0))}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, fontSize: 11, color: B.text, textAlign: "right" }}>{fmt(filteredEmps.reduce((s, e) => s + e.special, 0))}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, fontSize: 12, color: B.primary, textAlign: "right" }}>{fmt(filteredEmps.reduce((s, e) => s + e.basic + e.hra + e.conveyance + e.special, 0))}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>

            {filteredEmps.length === 0 && (
              <div style={{ textAlign: "center", padding: 60, color: B.textMuted }}>
                <p style={{ fontSize: 14, marginBottom: 12 }}>No employees found. Import a CSV or add employees manually.</p>
                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                  <Btn variant="secondary" size="sm" onClick={() => setShowCSVImport(true)}>Import CSV</Btn>
                  <Btn variant="primary" size="sm" onClick={() => setShowForm("new")}>Add Manually</Btn>
                </div>
              </div>
            )}
          </>
        )}

        {/* PAYROLL */}
        {page === "payroll" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: B.text, margin: 0 }}>Monthly Payroll</h1>
                <p style={{ fontSize: 12, color: B.textMuted, marginTop: 4 }}>Update absent days and variable deductions. All calculations are automatic.</p>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <Select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} width="140px"
                  options={MONTHS.map((m, i) => ({ value: i, label: m }))} />
                <Input value={year} onChange={(e) => setYear(parseInt(e.target.value) || 2025)} type="number" width="90px" />
                <Btn variant="primary" size="md" onClick={handleDownloadAllSlips} disabled={generatingAll || activeEmps.length === 0}
                  icon={<Icon d={ICONS.download} size={14} color={B.surface} />}
                  style={{ marginBottom: 0, whiteSpace: "nowrap" }}>
                  {generatingAll ? "Generating..." : "Download All Slips"}
                </Btn>
              </div>
            </div>

            <Card style={{ marginBottom: 20, overflow: "hidden" }}>
              <div style={{ padding: "10px 20px", backgroundColor: B.highlight, borderBottom: `1px solid ${B.highlightBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: B.primary, letterSpacing: 0.5, textTransform: "uppercase" }}>
                  {MONTHS[month]} {year} Summary — {totalDays} days in month
                </span>
              </div>
              <div style={{ display: "flex" }}>
                <StatCard label="Active Employees" value={activeEmps.length} />
                <div style={{ width: 1, backgroundColor: B.borderLight }} />
                <StatCard label="Total Gross" value={fmt(totalGrossPayroll)} />
                <div style={{ width: 1, backgroundColor: B.borderLight }} />
                <StatCard label="Total Deductions" value={fmt(totalDeductions)} color={B.red} />
                <div style={{ width: 1, backgroundColor: B.borderLight }} />
                <StatCard label="Net Payroll" value={fmt(totalPayroll)} color={B.primary} />
              </div>
            </Card>

            <Card style={{ overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ backgroundColor: B.primary }}>
                      {["Employee", "Gross/Mo", "Absent", "Present", "Earned", "TDS", "Other Ded.", "Total Ded.", "Net Pay", "Actions"].map((h, i) => (
                        <th key={h} style={{ padding: "10px 12px", textAlign: i === 0 ? "left" : i === 9 ? "center" : "right", fontWeight: 700, color: "rgba(255,255,255,0.9)", fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeEmps.map((emp, idx) => {
                      const att = getAttendance(emp.id);
                      const pay = calcPayroll(emp);
                      const gross = emp.basic + emp.hra + emp.conveyance + emp.special;
                      const bg = idx % 2 === 0 ? B.surface : B.bg;
                      return (
                        <tr key={emp.id} style={{ backgroundColor: bg, transition: "background-color 0.1s" }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = B.highlight}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = bg}>
                          <td style={{ padding: "8px 12px", borderBottom: `1px solid ${B.borderLight}` }}>
                            <div style={{ fontWeight: 600, color: B.text }}>{emp.name}</div>
                            <div style={{ fontSize: 10, color: B.textMuted }}>{emp.sno} | {emp.designation}</div>
                          </td>
                          <td style={{ padding: "8px 12px", borderBottom: `1px solid ${B.borderLight}`, textAlign: "right", fontWeight: 600, color: B.text }}>{fmt(gross)}</td>
                          <td style={{ padding: "8px 6px", borderBottom: `1px solid ${B.borderLight}`, textAlign: "right" }}>
                            <input type="number" min="0" max={totalDays} value={att.absent || ""} placeholder="0"
                              onChange={(e) => setAtt(emp.id, "absent", e.target.value)}
                              style={{ width: 56, padding: "5px 6px", border: `1.5px solid ${B.orangeLight}`, borderRadius: 5, fontSize: 12, fontWeight: 600, textAlign: "center", color: B.accent, backgroundColor: B.orangeBg, outline: "none", fontFamily: "Arial, sans-serif" }}
                              onFocus={(e) => e.target.style.borderColor = B.accent}
                              onBlur={(e) => e.target.style.borderColor = B.orangeLight} />
                          </td>
                          <td style={{ padding: "8px 12px", borderBottom: `1px solid ${B.borderLight}`, textAlign: "right", fontWeight: 600, color: B.green }}>{pay.present}</td>
                          <td style={{ padding: "8px 12px", borderBottom: `1px solid ${B.borderLight}`, textAlign: "right", fontWeight: 600, color: B.text }}>{fmt(pay.earnedGross)}</td>
                          <td style={{ padding: "8px 6px", borderBottom: `1px solid ${B.borderLight}`, textAlign: "right" }}>
                            <input type="number" min="0" value={att.tds || ""} placeholder="0"
                              onChange={(e) => setAtt(emp.id, "tds", e.target.value)}
                              style={{ width: 64, padding: "5px 6px", border: `1.5px solid ${B.border}`, borderRadius: 5, fontSize: 12, textAlign: "center", color: B.text, backgroundColor: B.surface, outline: "none", fontFamily: "Arial, sans-serif" }} />
                          </td>
                          <td style={{ padding: "8px 6px", borderBottom: `1px solid ${B.borderLight}`, textAlign: "right" }}>
                            <input type="number" min="0" value={att.otherDed || ""} placeholder="0"
                              onChange={(e) => setAtt(emp.id, "otherDed", e.target.value)}
                              style={{ width: 64, padding: "5px 6px", border: `1.5px solid ${B.border}`, borderRadius: 5, fontSize: 12, textAlign: "center", color: B.text, backgroundColor: B.surface, outline: "none", fontFamily: "Arial, sans-serif" }} />
                          </td>
                          <td style={{ padding: "8px 12px", borderBottom: `1px solid ${B.borderLight}`, textAlign: "right", fontWeight: 600, color: B.red }}>{fmt(pay.totalDed)}</td>
                          <td style={{ padding: "8px 12px", borderBottom: `1px solid ${B.borderLight}`, textAlign: "right", fontWeight: 700, color: B.primary, fontSize: 13 }}>{fmt(pay.netPay)}</td>
                          <td style={{ padding: "8px 8px", borderBottom: `1px solid ${B.borderLight}`, textAlign: "center", whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                              <button onClick={() => setViewSlip(emp)} title="View salary slip for this month"
                                style={{ padding: "5px 7px", border: `1px solid ${B.highlightBorder}`, borderRadius: 5, backgroundColor: B.highlight, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 2 }}>
                                <Icon d={ICONS.file} size={11} color={B.primary} />
                                <span style={{ fontSize: 8.5, fontWeight: 600, color: B.primary }}>PDF</span>
                              </button>
                              <button onClick={() => setShowBulkMonth(emp)} title="Download slips for multiple months"
                                style={{ padding: "5px 7px", border: `1px solid ${B.highlightBorder}`, borderRadius: 5, backgroundColor: B.orangeBg, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 2 }}>
                                <Icon d={ICONS.download} size={11} color={B.accent} />
                                <span style={{ fontSize: 8.5, fontWeight: 600, color: B.accent }}>Bulk</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: B.highlight, borderTop: `2px solid ${B.primary}` }}>
                      <td style={{ padding: "12px 12px", fontWeight: 700, color: B.text, fontSize: 11 }}>TOTALS ({activeEmps.length} employees)</td>
                      <td style={{ padding: "12px 12px", textAlign: "right", fontWeight: 700, color: B.text }}>{fmt(activeEmps.reduce((s, e) => s + e.basic + e.hra + e.conveyance + e.special, 0))}</td>
                      <td></td><td></td>
                      <td style={{ padding: "12px 12px", textAlign: "right", fontWeight: 700, color: B.text }}>{fmt(totalGrossPayroll)}</td>
                      <td></td><td></td>
                      <td style={{ padding: "12px 12px", textAlign: "right", fontWeight: 700, color: B.red }}>{fmt(totalDeductions)}</td>
                      <td style={{ padding: "12px 12px", textAlign: "right", fontWeight: 700, color: B.primary, fontSize: 14 }}>{fmt(totalPayroll)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>

            <div style={{ marginTop: 12, display: "flex", gap: 20, fontSize: 10, color: B.textMuted }}>
              <span>Orange fields are editable inputs</span>
              <span>EPF is auto-calculated from Basic x EPF%</span>
              <span>PT is applied from employee database</span>
              <span>Salary is pro-rated based on present days</span>
            </div>
          </>
        )}
      </div>

      {showForm && <EmployeeForm emp={showForm === "new" ? null : showForm} onSave={handleSaveEmployee} onClose={() => setShowForm(null)} />}
      {showCSVImport && <CSVImportModal onImport={handleCSVImport} onClose={() => setShowCSVImport(false)} />}
      {viewSlip && <SalarySlip emp={viewSlip} month={month} year={year} attendance={getAttendance(viewSlip.id)} onClose={() => setViewSlip(null)} />}
      {showBulkMonth && <BulkMonthModal emp={showBulkMonth} attendance={attendance} onClose={() => setShowBulkMonth(null)} />}
    </div>
  );
}
