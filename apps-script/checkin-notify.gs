/**
 * Perfect Pet House — ระบบลงทะเบียนเข้าพัก (วางโค้ดนี้ใน Google Apps Script ตัวใหม่)
 *
 * แยกจากระบบจอง (booking-notify.gs) อย่างสมบูรณ์ — คนละสคริปต์ คนละชีต
 * รับข้อมูลลงทะเบียนก่อนเข้าพักจากหน้า perfectbkk.com/checkin.html แล้วทำ 3 อย่าง:
 *   1) บันทึกลง Google Sheet — 1 แถวต่อสัตว์ 1 ตัว (ข้อมูลเจ้าของซ้ำทุกแถว, รหัสลงทะเบียนเดียวกัน)
 *   2) ส่งอีเมลแจ้งร้าน (สรุปทุกตัว — เลขบัตรโชว์แค่ 4 ตัวท้าย)
 *   3) ส่งอีเมลยืนยันถึงลูกค้า (เฉพาะเมื่อกรอกอีเมล)
 *
 * แต่ละส่วนแยกกันทำงาน — ถ้าอีเมลพัง การบันทึกชีตยังทำได้ปกติ
 */

// ═══════════════ ตั้งค่าตรงนี้ ═══════════════
var CONFIG = {
  NOTIFY_EMAIL: 'perfectpethouse@gmail.com', // อีเมลแจ้งเตือนร้าน (คั่นหลายอันด้วย , ได้)
  SHEET_ID: '1j1EvEOgzRv8sFRImplwGwRYqKblHaeNCVz-vPAHxZuo', // ชีต "PPH ทะเบียนเข้าพัก"
  SHEET_TAB: 'ทะเบียนเข้าพัก',                 // ชื่อแท็บที่จะเขียนข้อมูลลง (สร้างให้อัตโนมัติถ้ายังไม่มี)
  TZ: 'Asia/Bangkok'
};
// ═════════════════════════════════════════════

// หัวตาราง — 1 แถว = สัตว์ 1 ตัว (เจ้าของ+วันเข้าพักซ้ำทุกแถวของการลงทะเบียนเดียวกัน)
var HEADERS = [
  'รหัสลงทะเบียน', 'เวลาที่กรอก', 'ตัวที่', 'จำนวนสัตว์รวม',
  // เจ้าของ
  'ชื่อ-นามสกุล', 'ชื่อเล่น', 'เลขบัตร/พาสปอร์ต', 'เบอร์โทร', 'LINE', 'อีเมล',
  'ที่อยู่', 'ผู้ติดต่อฉุกเฉิน', 'เบอร์ฉุกเฉิน',
  // วันเข้าพัก (ร่วมกันทุกตัว)
  'วันเข้าพัก', 'เวลาเข้า', 'วันออก', 'เวลาออก', 'ความต้องการพิเศษ',
  // สัตว์เลี้ยง (รายตัว)
  'ชื่อสัตว์', 'ชนิด', 'สายพันธุ์', 'เพศ', 'อายุ', 'น้ำหนัก(กก.)', 'Microchip', 'ทำหมัน',
  'สุขภาพโดยรวม', 'โรคประจำตัว', 'ยาระหว่างพัก', 'สถานะวัคซีน', 'วันฉีดวัคซีนล่าสุด', 'เห็บหมัด/พยาธิ',
  'นิสัยโดยทั่วไป', 'เข้ากับสัตว์อื่น', 'พฤติกรรมพิเศษ', 'สิ่งกระตุ้นเครียด', 'หมายเหตุพฤติกรรม',
  'มื้อ/วัน', 'เวลาอาหาร', 'ปริมาณ/มื้อ', 'แพ้อาหาร', 'รายการแพ้อาหาร', 'ยา&วิตามิน',
  'ห้องพัก', 'สิ่งของที่นำมา', 'รายละเอียดสิ่งของ',
  // ยินยอม
  'ยินยอมข้อตกลง', 'ชื่อเซ็นรับทราบ'
];

// เปิด URL /exec ตรงๆ ในเบราว์เซอร์ = เช็คว่าระบบพร้อมใช้งาน
function doGet(e) {
  return jsonOut({ ok: true, service: 'PPH check-in registration', time: new Date().toISOString() });
}

function doPost(e) {
  var data = parsePayload(e);
  var result = { ok: false, sheet: false, email: false, customerEmail: false };

  // ต้องมีชื่อเจ้าของ + สัตว์อย่างน้อย 1 ตัว
  if (!data.owner.fullname && !data.owner.phone) return jsonOut({ ok: false, error: 'no owner data' });
  if (!data.pets.length) return jsonOut({ ok: false, error: 'no pets' });

  data.regId = 'REG-' + Utilities.formatDate(new Date(), CONFIG.TZ, 'yyMMdd-HHmmss');
  data.submittedAt = data.submittedAt || Utilities.formatDate(new Date(), CONFIG.TZ, 'dd/MM/yyyy HH:mm');

  try { result.sheet = logToSheet(data); } catch (err) { result.sheetError = String(err); }
  try { result.email = sendShopEmail(data); } catch (err) { result.emailError = String(err); }
  try { result.customerEmail = sendCustomerEmail(data); } catch (err) { result.customerEmailError = String(err); }

  result.ok = !!(result.sheet || result.email);
  result.regId = data.regId;
  return jsonOut(result);
}

// รับ JSON จากหน้าเว็บ (ส่งมาแบบ text/plain) และจัดรูปให้ปลอดภัย
function parsePayload(e) {
  var d = {};
  try {
    if (e && e.postData && e.postData.contents && e.postData.contents.charAt(0) === '{') {
      d = JSON.parse(e.postData.contents);
    }
  } catch (err) {}
  var o = d.owner || {};
  var st = d.stay || {};
  var cs = d.consent || {};
  function s(x, n) { return (x === undefined || x === null) ? '' : String(x).slice(0, n || 500); }

  var pets = [];
  if (d.pets && d.pets.length) {
    for (var i = 0; i < d.pets.length; i++) {
      var p = d.pets[i] || {};
      pets.push({
        name: s(p.name), species: s(p.species), breed: s(p.breed), gender: s(p.gender),
        age: s(p.age), weight: s(p.weight), microchip: s(p.microchip), neutered: s(p.neutered),
        health: s(p.health), disease: s(p.disease, 1000), medication: s(p.medication, 1000),
        vaccine: s(p.vaccine), vaccineDate: s(p.vaccineDate), flea: s(p.flea),
        temperament: joinArr(p.temperament), socialize: s(p.socialize),
        behaviors: joinArr(p.behaviors), stressTriggers: s(p.stressTriggers, 1000), behaviorNote: s(p.behaviorNote, 1000),
        meals: s(p.meals), feedTime: s(p.feedTime), amount: s(p.amount),
        allergyFlag: s(p.allergyFlag), allergyList: s(p.allergyList, 1000), supplements: s(p.supplements, 1000),
        room: s(p.room), items: joinArr(p.items), itemsDetail: s(p.itemsDetail, 1000)
      });
    }
  }

  return {
    submittedAt: s(d.submittedAt),
    owner: {
      fullname: s(o.fullname), nickname: s(o.nickname), idcard: s(o.idcard, 50),
      phone: s(o.phone), line: s(o.line), email: s(o.email),
      address: s(o.address, 1000), emgName: s(o.emgName), emgPhone: s(o.emgPhone)
    },
    stay: {
      checkin: s(st.checkin), checkinTime: s(st.checkinTime),
      checkout: s(st.checkout), checkoutTime: s(st.checkoutTime),
      specialRequest: s(st.specialRequest, 1000)
    },
    consent: { agreed: !!cs.agreed, signName: s(cs.signName) },
    pets: pets
  };
}

function joinArr(a) {
  if (!a) return '';
  if (Object.prototype.toString.call(a) === '[object Array]') return a.join(', ').slice(0, 1000);
  return String(a).slice(0, 1000);
}

// เลขบัตรโชว์แค่ 4 ตัวท้าย (ใช้ในอีเมลเท่านั้น — ในชีตเก็บเต็ม)
function maskId(id) {
  id = String(id || '');
  if (id.length <= 4) return id;
  return id.slice(0, -4).replace(/[0-9A-Za-z]/g, 'x') + id.slice(-4);
}

function logToSheet(data) {
  if (!CONFIG.SHEET_ID) throw new Error('ยังไม่ได้ตั้งค่า SHEET_ID');
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEET_TAB);
  if (!sh) sh = ss.insertSheet(CONFIG.SHEET_TAB);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#FCEADB');
  }
  var o = data.owner, st = data.stay, cs = data.consent;
  var total = data.pets.length;
  var rows = [];
  for (var i = 0; i < total; i++) {
    var p = data.pets[i];
    rows.push([
      data.regId, data.submittedAt, (i + 1) + '/' + total, total,
      o.fullname, o.nickname, "'" + o.idcard, "'" + o.phone, o.line, o.email,
      o.address, o.emgName, "'" + o.emgPhone,
      st.checkin, st.checkinTime, st.checkout, st.checkoutTime, st.specialRequest,
      p.name, p.species, p.breed, p.gender, p.age, p.weight, p.microchip, p.neutered,
      p.health, p.disease, p.medication, p.vaccine, p.vaccineDate, p.flea,
      p.temperament, p.socialize, p.behaviors, p.stressTriggers, p.behaviorNote,
      p.meals, p.feedTime, p.amount, p.allergyFlag, p.allergyList, p.supplements,
      p.room, p.items, p.itemsDetail,
      cs.agreed ? 'ยินยอม ✓' : '-', cs.signName
    ]);
  }
  // เขียนทีเดียวทั้งก้อน (เร็ว + ทุกตัวของการลงทะเบียนเดียวกันอยู่ติดกัน)
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
  return true;
}

// ── ข้อความสรุป (ใช้ทั้งอีเมลร้านและอีเมลลูกค้า) ──
function summaryText(data, maskIdCard) {
  var o = data.owner, st = data.stay;
  var L = [];
  L.push('🏨 ลงทะเบียนเข้าพัก — Perfect Pet House');
  L.push('รหัส: ' + data.regId + ' · ' + data.submittedAt);
  L.push('──────────────');
  L.push('👤 เจ้าของ: ' + o.fullname + (o.nickname ? ' (' + o.nickname + ')' : ''));
  L.push('🪪 บัตร/พาสปอร์ต: ' + (maskIdCard ? maskId(o.idcard) : o.idcard));
  L.push('📞 โทร: ' + o.phone + (o.line ? ' · LINE: ' + o.line : ''));
  if (o.email) L.push('📧 อีเมล: ' + o.email);
  if (o.address) L.push('🏠 ที่อยู่: ' + o.address);
  L.push('🚨 ผู้ติดต่อฉุกเฉิน: ' + o.emgName + ' · ' + o.emgPhone);
  L.push('──────────────');
  L.push('📅 เข้าพัก: ' + st.checkin + (st.checkinTime ? ' ' + st.checkinTime : '') +
    '  →  ออก: ' + st.checkout + (st.checkoutTime ? ' ' + st.checkoutTime : ''));
  if (st.specialRequest) L.push('✨ ความต้องการพิเศษ: ' + st.specialRequest);
  L.push('──────────────');
  L.push('🐾 สัตว์เลี้ยง ' + data.pets.length + ' ตัว:');
  for (var i = 0; i < data.pets.length; i++) {
    var p = data.pets[i];
    L.push('');
    L.push('  [' + (i + 1) + '] ' + p.name + ' · ' + p.species + ' · ' + p.breed +
      (p.gender ? ' · ' + p.gender : '') + (p.age ? ' · ' + p.age : '') + (p.weight ? ' · ' + p.weight + 'กก.' : ''));
    if (p.room) L.push('      🏠 ห้อง: ' + p.room);
    L.push('      💉 วัคซีน: ' + (p.vaccine || '-') + (p.vaccineDate ? ' (' + p.vaccineDate + ')' : '') +
      ' · เห็บหมัด: ' + (p.flea || '-') + ' · ทำหมัน: ' + (p.neutered || '-'));
    L.push('      ❤️ สุขภาพ: ' + (p.health || '-') + (p.disease ? ' · โรค: ' + p.disease : ''));
    if (p.medication) L.push('      💊 ยาระหว่างพัก: ' + p.medication);
    L.push('      🍽️ อาหาร: ' + (p.meals || '-') + (p.feedTime ? ' · ' + p.feedTime : '') + (p.amount ? ' · ' + p.amount : ''));
    if (p.allergyFlag) L.push('      ⚠️ แพ้อาหาร: ' + p.allergyFlag + (p.allergyList ? ' — ' + p.allergyList : ''));
    if (p.temperament) L.push('      🐶 นิสัย: ' + p.temperament + (p.socialize ? ' · เข้าสังคม: ' + p.socialize : ''));
    if (p.behaviors) L.push('      🔎 พฤติกรรมพิเศษ: ' + p.behaviors);
    if (p.stressTriggers) L.push('      😰 สิ่งกระตุ้นเครียด: ' + p.stressTriggers);
    if (p.behaviorNote) L.push('      📝 หมายเหตุ: ' + p.behaviorNote);
    if (p.items) L.push('      🎒 สิ่งของ: ' + p.items + (p.itemsDetail ? ' — ' + p.itemsDetail : ''));
  }
  return L.join('\n');
}

function sendShopEmail(data) {
  var subject = '🏨 ลงทะเบียนเข้าพักใหม่: ' + data.owner.fullname + ' — ' +
    data.pets.length + ' ตัว' + (data.stay.checkin ? ' · ' + data.stay.checkin : '');
  var body = summaryText(data, true) +
    '\n\n──────────────\n✅ ' + (data.consent.agreed ? 'ยินยอมข้อตกลงแล้ว' : 'ยังไม่ยินยอม') +
    (data.consent.signName ? ' (เซ็น: ' + data.consent.signName + ')' : '') +
    '\n📞 โทรกลับลูกค้า: ' + data.owner.phone +
    '\n\n(เลขบัตรฉบับเต็มดูได้ในชีต "PPH ทะเบียนเข้าพัก")';
  MailApp.sendEmail({ to: CONFIG.NOTIFY_EMAIL, subject: subject, body: body });
  return true;
}

function sendCustomerEmail(data) {
  var email = data.owner.email;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  var subject = '🐾 Perfect Pet House รับข้อมูลลงทะเบียนเข้าพักของคุณแล้ว' +
    (data.stay.checkin ? ' · ' + data.stay.checkin : '');
  var body = 'สวัสดีค่ะ คุณ' + (data.owner.nickname || data.owner.fullname) + '\n\n' +
    'Perfect Pet House ได้รับข้อมูลลงทะเบียนเข้าพักของน้อง ' + data.pets.length + ' ตัว เรียบร้อยแล้วค่ะ\n' +
    'ทีมงานจะเตรียมการดูแลตามข้อมูลที่คุณให้มา และติดต่อกลับหากมีข้อสงสัยเพิ่มเติม\n\n' +
    summaryText(data, true) +
    '\n\n──────────────\n' +
    'หากข้อมูลข้างต้นไม่ถูกต้อง กรุณาแจ้งทีมงานทาง LINE @perfectbkk ได้เลยค่ะ\n\n' +
    'Perfect Pet House · วัชรพล–รามอินทรา\n' +
    'โทร 082-320-2807 · LINE @perfectbkk · เปิดทุกวัน 9:00–20:00 น.';
  MailApp.sendEmail({ to: email, subject: subject, body: body, name: 'Perfect Pet House' });
  return true;
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ▶ กดรันฟังก์ชันนี้ 1 ครั้งใน editor เพื่อ "อนุญาตสิทธิ์" (สำคัญมาก! ต้องทำก่อนใช้งานจริง)
//   จะมีแถวทดสอบเด้งในชีต + อีเมลทดสอบส่งเข้าร้าน = ใช้งานได้แล้ว (ลบแถวทดสอบทิ้งได้)
function testAuthorize() {
  var today = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd');
  var fake = {
    submittedAt: '',
    owner: { fullname: 'ทดสอบระบบ', nickname: 'เทส', idcard: '1234567890123', phone: '0812345678',
      line: '@test', email: '', address: 'กรุงเทพฯ', emgName: 'ผู้ติดต่อทดสอบ', emgPhone: '0899999999' },
    stay: { checkin: today, checkinTime: '10:00', checkout: today, checkoutTime: '17:00', specialRequest: 'แถวทดสอบ ลบทิ้งได้เลย' },
    consent: { agreed: true, signName: 'ทดสอบ' },
    pets: [
      { name: 'น้องทดสอบ', species: 'สุนัข / Dog', breed: 'ชิสุ', gender: 'ชาย / Male', age: '2 ปี', weight: '5',
        microchip: '', neutered: 'ทำแล้ว / Yes', health: 'ปกติสุขภาพดี / Healthy', disease: '', medication: '',
        vaccine: 'ทันสมัยครบถ้วน / Up-to-date', vaccineDate: '', flea: 'ทำแล้ว / Done',
        temperament: ['เชื่องและเป็นมิตร / Friendly & Docile'], socialize: 'เข้ากันได้ดี / Gets Along Well',
        behaviors: [], stressTriggers: '', behaviorNote: '', meals: '2 มื้อ / 2 Meals', feedTime: '09:00, 18:00',
        amount: '1 ถ้วย', allergyFlag: 'ไม่มี / None', allergyList: '', supplements: '', room: 'ห้อง Cozy',
        items: ['อาหาร / Pet Food'], itemsDetail: 'อาหารเม็ด 1 ถุง' }
    ]
  };
  var e = { postData: { contents: JSON.stringify(fake) } };
  var out = doPost(e);
  Logger.log('✅ ทดสอบสำเร็จ — ' + out.getContent());
}
