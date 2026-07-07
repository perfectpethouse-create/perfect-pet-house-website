const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static assets from /public (แต่ไม่ให้เสิร์ฟ index.html อัตโนมัติ เพื่อคุมเส้นทาง "/" เอง)
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ตรวจว่าเป็นมือถือจริง (ไม่รวมแท็บเล็ต — แท็บเล็ตใช้เว็บเต็มสวยกว่า)
function isMobile(ua) {
  return /Mobi|Android|iPhone|iPod|Windows Phone|BlackBerry|Opera Mini|IEMobile/i.test(ua) &&
    !/iPad|Tablet/i.test(ua);
}

// บอต/เครื่องเก็บข้อมูล SEO และตัวดึงพรีวิวลิงก์ → ให้เว็บเต็มเสมอ (เนื้อหาครบ ดีต่อ SEO)
function isCrawler(ua) {
  return /googlebot|bingbot|duckduckbot|yandex|baiduspider|slurp|facebookexternalhit|twitterbot|linebot|line-poker|whatsapp|telegrambot|discordbot|applebot|petalbot|ahrefsbot|semrushbot|crawler|spider/i.test(ua);
}

// หน้าแรก + SPA fallback: เลือกไฟล์ตามอุปกรณ์
app.get('*', (req, res) => {
  const ua = req.headers['user-agent'] || '';

  // ทางออกแบบบังคับด้วย query (?desktop=1 = เว็บเต็ม, ?app=1 = แอปมือถือ)
  if (req.query.desktop === '1') return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  if (req.query.app === '1') return res.sendFile(path.join(__dirname, 'public', 'app.html'));

  const useApp = isMobile(ua) && !isCrawler(ua);
  res.sendFile(path.join(__dirname, 'public', useApp ? 'app.html' : 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Perfect Pet House website running on port ${PORT}`);
});
