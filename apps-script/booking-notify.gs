/**
 * Perfect Pet House — ระบบแจ้งเตือนการจอง (วางโค้ดนี้ใน Google Apps Script)
 *
 * รับข้อมูลจองจากเว็บ perfectbkk.com (ทั้งหน้าเว็บเต็มและแอปมือถือ) แล้วทำ 3 อย่าง:
 *   1) ส่งอีเมลแจ้งร้านทันที
 *   2) ลงคิวใน Google Calendar อัตโนมัติ
 *   3) บันทึกประวัติจองลง Google Sheet (ถ้าตั้งค่า SHEET_ID)
 *
 * แต่ละส่วนแยกกันทำงาน — ถ้าปฏิทินพัง อีเมลยังส่งได้ปกติ
 */

// ═══════════════ ตั้งค่าตรงนี้ ═══════════════
var CONFIG = {
  NOTIFY_EMAIL: 'perfectpethouse@gmail.com', // อีเมลที่ให้แจ้งเตือนเข้า (คั่นหลายอันด้วย , ได้)
  CALENDAR_ID: 'primary',                    // 'primary' = ปฏิทินหลักของบัญชีที่รันสคริปต์นี้
  SHEET_ID: '17S8GglVHoA3BQfIiVeBD1Oq4uISApOaRHcnDLcr1RgU', // ชีต "PPH ประวัติการจองจากเว็บ" ใน Drive ของร้าน
  GROOM_HOURS: 2,                            // ความยาวคิวอาบน้ำตัดขนในปฏิทิน (ชั่วโมง)
  TZ: 'Asia/Bangkok'
};
// ═════════════════════════════════════════════

// เปิด URL /exec ตรงๆ ในเบราว์เซอร์ = เช็คว่าระบบพร้อมใช้งาน
// เพิ่ม ?busy=YYYY-MM-DD ต่อท้าย = ดูคิวที่มีอยู่แล้วของวันนั้น (หน้าเว็บใช้แสดง "มีคิวแล้ว")
function doGet(e) {
  var q = (e && e.parameter) || {};
  if (q.busy && /^\d{4}-\d{2}-\d{2}$/.test(q.busy)) return jsonOut(getBusySlots(q.busy));
  return jsonOut({ ok: true, service: 'PPH booking notify', time: new Date().toISOString() });
}

function doPost(e) {
  var b = parseBooking(e);
  var result = { ok: false, email: false, calendar: false, sheet: false };

  if (!b.owner && !b.phone) {
    return jsonOut({ ok: false, error: 'no data' });
  }

  try { result.email = sendNotifyEmail(b); } catch (err) { result.emailError = String(err); }
  try { result.calendar = addToCalendar(b); } catch (err) { result.calendarError = String(err); }
  try { result.sheet = logToSheet(b); } catch (err) { result.sheetError = String(err); }
  try { result.customerEmail = sendCustomerEmail(b); } catch (err) { result.customerEmailError = String(err); }

  result.ok = !!(result.email || result.calendar || result.sheet);
  return jsonOut(result);
}

// คิวที่มีเวลาเริ่ม-จบของวันที่ระบุ (ไม่นับอีเวนต์เต็มวัน — ฝากเลี้ยงไม่บล็อกคิวอาบน้ำ)
function getBusySlots(ymd) {
  var cal = getCal();
  if (!cal) return { ok: false, busy: [] };
  var start = parseDate(ymd, '00:00');
  var end = new Date(start.getTime() + 24 * 3600 * 1000);
  var evs = cal.getEvents(start, end);
  var busy = [];
  for (var i = 0; i < evs.length; i++) {
    if (evs[i].isAllDayEvent()) continue;
    busy.push({
      s: Utilities.formatDate(evs[i].getStartTime(), CONFIG.TZ, 'HH:mm'),
      e: Utilities.formatDate(evs[i].getEndTime(), CONFIG.TZ, 'HH:mm')
    });
  }
  return { ok: true, date: ymd, busy: busy };
}

// รองรับทั้ง JSON (แอปมือถือ) และ form-encoded (เว็บเต็ม)
function parseBooking(e) {
  var d = {};
  try {
    if (e && e.postData && e.postData.contents && e.postData.contents.charAt(0) === '{') {
      d = JSON.parse(e.postData.contents);
    }
  } catch (err) {}
  if (!d.owner && e && e.parameter && (e.parameter.owner || e.parameter.phone)) {
    d = e.parameter;
  }
  function s(x) { return (d[x] === undefined || d[x] === null) ? '' : String(d[x]).slice(0, 500); }
  return {
    owner: s('owner'), phone: s('phone'), line: s('line'), email: s('email'),
    pet: s('pet'), petname: s('petname'), breed: s('breed'),
    service: s('service'), room: s('room'),
    checkin: s('checkin'), checkout: s('checkout'), time: s('time'),
    note: s('note'), message: (d.message ? String(d.message).slice(0, 2000) : ''),
    submittedAt: s('submittedAt')
  };
}

function bookingText(b) {
  if (b.message) return b.message;
  var L = ['🐾 ขอจองบริการ Perfect Pet House', '──────────────',
    '👤 เจ้าของ: ' + b.owner, '📞 เบอร์โทร: ' + b.phone];
  if (b.line) L.push('💬 LINE: ' + b.line);
  if (b.email) L.push('📧 อีเมล: ' + b.email);
  if (b.pet) L.push('🐶 ชนิดสัตว์: ' + b.pet);
  if (b.petname) L.push('🏷️ ชื่อน้อง: ' + b.petname);
  if (b.breed) L.push('📏 สายพันธุ์/ขนาด: ' + b.breed);
  if (b.service) L.push('🛎️ บริการ: ' + b.service);
  if (b.room) L.push('🏠 ห้อง/บริการ: ' + b.room);
  if (b.checkin) L.push('📅 วันรับเข้า: ' + b.checkin);
  if (b.checkout) L.push('📅 วันรับกลับ: ' + b.checkout);
  if (b.time) L.push('🕘 ช่วงเวลา: ' + b.time + ' น.');
  if (b.note) L.push('📝 หมายเหตุ: ' + b.note);
  return L.join('\n');
}

function sendNotifyEmail(b) {
  var who = b.petname ? (b.petname + ' (' + b.owner + ')') : b.owner;
  var subject = '🐾 จองใหม่: ' + (b.service || 'ไม่ระบุบริการ') + ' — ' + who +
    (b.checkin ? ' · ' + b.checkin : '');
  var body = bookingText(b) +
    '\n\n──────────────\nส่งจากระบบจองบนเว็บ perfectbkk.com' +
    (b.submittedAt ? ' · ' + b.submittedAt : '') +
    '\n📞 โทรกลับลูกค้า: ' + b.phone;
  MailApp.sendEmail({ to: CONFIG.NOTIFY_EMAIL, subject: subject, body: body });
  return true;
}

function getCal() {
  return (CONFIG.CALENDAR_ID === 'primary')
    ? CalendarApp.getDefaultCalendar()
    : CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
}

// อีเมลสำเนายืนยันถึงลูกค้า (เฉพาะเมื่อลูกค้ากรอกอีเมลมา)
function sendCustomerEmail(b) {
  if (!b.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return false;
  var subject = '🐾 Perfect Pet House ได้รับคำขอจองของคุณแล้ว' + (b.checkin ? ' · ' + b.checkin : '');
  var body = 'สวัสดีค่ะ คุณ' + b.owner + '\n\n' +
    'Perfect Pet House ได้รับคำขอจองของคุณเรียบร้อยแล้ว\n' +
    'ทีมงานจะติดต่อกลับทางโทรศัพท์หรือ LINE เพื่อยืนยันคิวโดยเร็วที่สุดค่ะ\n\n' +
    '── สรุปคำขอจอง ──\n' + bookingText(b) + '\n\n' +
    'หมายเหตุ: อีเมลนี้ยืนยันว่า "ได้รับคำขอ" แล้ว คิวจะสมบูรณ์เมื่อทีมงานติดต่อยืนยันอีกครั้งค่ะ\n\n' +
    'Perfect Pet House · วัชรพล–รามอินทรา\n' +
    'โทร 082-320-2807 · LINE @perfectbkk · เปิดทุกวัน 9:00–20:00 น.';
  MailApp.sendEmail({ to: b.email, subject: subject, body: body, name: 'Perfect Pet House' });
  return true;
}

function addToCalendar(b) {
  if (!b.checkin || !/^\d{4}-\d{2}-\d{2}$/.test(b.checkin)) return false; // ไม่ระบุวัน = ไม่ลงปฏิทิน
  var cal = getCal();
  if (!cal) return false;

  var who = b.petname ? (b.petname + ' · ' + b.owner) : b.owner;
  var title = '🐾 ' + (b.service || 'จอง') + ' — ' + who;
  var desc = bookingText(b) + '\n\n(สร้างอัตโนมัติจากระบบจองบนเว็บ — รอยืนยันกับลูกค้า)';
  var opt = { description: desc };

  var isStay = b.checkout && /^\d{4}-\d{2}-\d{2}$/.test(b.checkout) && b.checkout > b.checkin;
  if (isStay) {
    // ฝากเลี้ยงค้างคืน: อีเวนต์เต็มวัน ตั้งแต่วันรับเข้าถึงวันรับกลับ (+1 เพราะวันสิ้นสุดไม่ถูกนับรวม)
    var start = parseDate(b.checkin);
    var endEx = parseDate(b.checkout); endEx.setDate(endEx.getDate() + 1);
    cal.createAllDayEvent(title, start, endEx, opt);
  } else if (b.time && /^\d{2}:\d{2}$/.test(b.time)) {
    // อาบน้ำตัดขน / Day Care ที่ระบุเวลา: อีเวนต์แบบมีเวลาเริ่ม-จบ
    var st = parseDate(b.checkin, b.time);
    var en = new Date(st.getTime() + CONFIG.GROOM_HOURS * 3600 * 1000);
    cal.createEvent(title, st, en, opt);
  } else {
    cal.createAllDayEvent(title, parseDate(b.checkin), opt);
  }
  return true;
}

// สร้าง Date ตามเขตเวลาไทย (กันวันเพี้ยนเวลาเซิร์ฟเวอร์ Google อยู่คนละโซน)
function parseDate(ymd, hm) {
  var p = ymd.split('-');
  var t = hm ? hm.split(':') : ['12', '00'];
  var iso = p[0] + '-' + p[1] + '-' + p[2] + 'T' +
    ('0' + t[0]).slice(-2) + ':' + ('0' + t[1]).slice(-2) + ':00+07:00';
  return new Date(iso);
}

function logToSheet(b) {
  if (!CONFIG.SHEET_ID) return false;
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sh = ss.getSheetByName('การจอง') || ss.getSheets()[0]; // ใช้แท็บแรก (มีหัวตารางอยู่แล้ว)
  if (sh.getLastRow() === 0) {
    sh.appendRow(['เวลาที่จอง', 'เจ้าของ', 'เบอร์โทร', 'LINE', 'ชนิดสัตว์', 'ชื่อน้อง',
      'สายพันธุ์/ขนาด', 'บริการ', 'ห้อง', 'วันรับเข้า', 'วันรับกลับ', 'เวลา', 'หมายเหตุ']);
  }
  if (sh.getRange(1, 14).getValue() === '') sh.getRange(1, 14).setValue('อีเมล');
  sh.appendRow([
    b.submittedAt || Utilities.formatDate(new Date(), CONFIG.TZ, 'dd/MM/yyyy HH:mm'),
    b.owner, "'" + b.phone, b.line, b.pet, b.petname, b.breed,
    b.service, b.room, b.checkin, b.checkout, b.time, b.note, b.email
  ]);
  return true;
}

// ▶ สรุปคิววันนี้ส่งเข้าเมลร้าน — ตั้งทริกเกอร์รายวัน 8:00 น. (เมนูนาฬิกา ⏰ ซ้ายมือ)
function dailySummary() {
  var cal = getCal();
  var today = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd');
  var thDate = Utilities.formatDate(new Date(), CONFIG.TZ, 'dd/MM/yyyy');
  var start = parseDate(today, '00:00');
  var evs = cal.getEvents(start, new Date(start.getTime() + 24 * 3600 * 1000));
  var L = [];
  for (var i = 0; i < evs.length; i++) {
    var t = evs[i].isAllDayEvent() ? '🏠 ทั้งวัน' : ('🕘 ' + Utilities.formatDate(evs[i].getStartTime(), CONFIG.TZ, 'HH:mm') + ' น.');
    L.push('• ' + t + ' — ' + evs[i].getTitle());
  }
  var body = (L.length
    ? 'วันนี้มีคิวทั้งหมด ' + L.length + ' รายการ\n\n' + L.join('\n')
    : 'วันนี้ยังไม่มีคิวในปฏิทิน 🎉') +
    '\n\n──────────────\nสรุปอัตโนมัติจากปฏิทินร้าน ทุกเช้า 8:00 น.';
  MailApp.sendEmail({ to: CONFIG.NOTIFY_EMAIL, subject: '📋 สรุปคิววันนี้ ' + thDate + ' (' + L.length + ' รายการ)', body: body });
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ▶ กดรันฟังก์ชันนี้ 1 ครั้งใน editor เพื่อ "อนุญาตสิทธิ์" (สำคัญมาก!)
//   จะมีเมลทดสอบ + อีเวนต์ทดสอบในปฏิทินเด้งขึ้น = ใช้งานได้แล้ว
function testAuthorize() {
  var fake = {
    owner: 'ทดสอบระบบ', phone: '0812345678', pet: 'น้องหมา', petname: 'น้องทดสอบ',
    service: 'อาบน้ำตัดขน', checkin: Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd'),
    time: '10:00', note: 'อีเวนต์ทดสอบ ลบทิ้งได้เลย', message: '', line: '', breed: '',
    room: '', checkout: '', submittedAt: ''
  };
  sendNotifyEmail(fake);
  addToCalendar(fake);
  Logger.log('✅ ส่งเมลทดสอบ + ลงปฏิทินทดสอบสำเร็จ — ระบบพร้อมใช้งาน');
}
