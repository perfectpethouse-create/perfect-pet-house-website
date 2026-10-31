/* =====================================================================
   fw.js — การเคลื่อนไหวของดีไซน์สไตล์ fastwork (ใช้คู่กับ fw.css)
   ทุกส่วนทำงานเฉพาะเมื่อมี element นั้นในหน้า → ใช้ไฟล์เดียวได้ทั้ง index.html และ app.html
   - ไม่แตะ location.hash · ไม่ส่งข้อมูลออก (มีแค่ GET อ่านยอดสมาชิกจาก publicAvailability/stats)
   - ฟัง scroll ตรงๆ (เบราว์เซอร์ยิงไม่เกินเฟรมละครั้งอยู่แล้ว; rAF หยุดตอนแท็บถูกซ่อน)
   ===================================================================== */
(function(){
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $=function(s,r){return (r||document).querySelector(s);};
  var $$=function(s,r){return [].slice.call((r||document).querySelectorAll(s));};
  var clamp=function(v,a,b){return Math.min(Math.max(v,a),b);};
  // ความคืบหน้าการเลื่อนผ่าน element ที่มี sticky ข้างใน: 0 = ขอบบนแตะจอ · 1 = เลื่อนจนสุด
  function progress(el){
    var r=el.getBoundingClientRect(),run=el.offsetHeight-innerHeight;
    return run>0?clamp(-r.top/run,0,1):0;
  }
  var onScroll=[];

  /* ---------- ยอดสมาชิก (อ่านจากระบบจองอัตโนมัติ) ---------- */
  // แอป pph-booking เขียน publicAvailability/stats { memberCount } ทันทีที่ยอดเปลี่ยน — อ่านได้สาธารณะ ไม่มีชื่อ/เบอร์ลูกค้า
  var STATS_DOC='https://firestore.googleapis.com/v1/projects/pph-booking/databases/(default)/documents/',STATS_KEY='/stats?key=AIzaSyCi7sSXV0Sz85XqWI0hVTGw-BbNd8Cxox0';
  function readCount(){
    return fetch(STATS_DOC+'publicAvailability'+STATS_KEY).then(function(r){return r.ok?r.json():null;}).then(function(j){
        var f=j&&j.fields&&j.fields.memberCount; return f?Math.round(Number(f.integerValue||f.doubleValue))||0:0;
      });
  }
  function fmt(n){return n.toLocaleString('en-US');}
  function renderOdo(el,n){
    var boxes=$('.fw-odo-boxes',el),digits=fmt(n).split(''),real=digits.filter(function(c){return c!==',';}),cols=$$('.fw-odo-col',boxes);
    // จำนวนหลักเท่าเดิม (ยอดเปลี่ยนตอนเปิดหน้าค้าง) → หมุนวงล้อเดิมไปตัวเลขใหม่ ไม่สร้างใหม่
    if(cols.length!==real.length){
    boxes.innerHTML=digits.map(function(ch){
      if(ch===',') return '<div class="fw-odo-box is-sep">,</div>';
      return '<div class="fw-odo-box"><div class="fw-odo-reel" aria-hidden="true"><div class="fw-odo-col">'+
        '0123456789'.split('').map(function(d){return '<span>'+d+'</span>';}).join('')+'</div></div></div>';
    }).join('');
    // ให้วงล้อเริ่มที่ 0 แล้วหมุนไปตัวเลขจริง (ไล่จังหวะทีละหลักเหมือนมิเตอร์)
    cols=$$('.fw-odo-col',boxes);
    boxes.offsetWidth; // บังคับให้เบราว์เซอร์วาดตำแหน่ง 0 ก่อน แล้วค่อยเลื่อนไปตัวเลขจริง (ไม่พึ่ง rAF ที่หยุดตอนแท็บซ่อน)
    }
    cols.forEach(function(c,i){c.style.transitionDelay=(i*120)+'ms';c.style.setProperty('--d',real[i]);});
    boxes.setAttribute('role','img'); boxes.setAttribute('aria-label',fmt(n)+' สมาชิก');
    el.classList.remove('is-pending');
    $$('[data-members-wrap]').forEach(function(w){w.hidden=false;});
    $$('[data-members]').forEach(function(s){s.textContent=fmt(n);});
  }
  function pendingOdo(el){
    el.classList.add('is-pending');
    // ยังไม่มีตัวเลขจริง: ตัวอย่างโชว์ช่องว่าง · เว็บจริงซ่อนกล่องไปเลย (ห้ามโชว์ตัวเลขสมมติ)
    if(!window.PPH_PREVIEW){el.hidden=true;$$('[data-members-wrap]').forEach(function(w){w.hidden=true;});}
  }
  var odos=$$('.fw-odo');
  if(odos.length){
    readCount().then(function(n){
      odos.forEach(function(el){n>0?renderOdo(el,n):pendingOdo(el);});
    }).catch(function(){odos.forEach(pendingOdo);});
    // อ่านซ้ำทุก 60 วิ: ยอดเปลี่ยนในระบบ → หน้าที่เปิดค้างเปลี่ยนตาม · พลาดรอบไหนก็รอรอบถัดไป ไม่ซ่อนกล่อง
    setInterval(function(){
      if(document.hidden) return;
      readCount().then(function(n){if(n>0) odos.forEach(function(el){renderOdo(el,n);});}).catch(function(){});
    },60000);
  }

  /* ---------- คำหมุนในหัวข้อ (น้องหมา → น้องแมว → ลูกรัก) ---------- */
  $$('.fw-rot').forEach(function(rot){
    var words=(rot.getAttribute('data-words')||'').split('|').filter(Boolean);
    if(words.length<2) return;
    var i=0,cur=rot.querySelector('span');
    function measure(t){var s=document.createElement('span');s.textContent=t;s.style.cssText='position:absolute;visibility:hidden;white-space:nowrap';rot.appendChild(s);var w=s.offsetWidth;s.remove();return w;}
    var fit=function(){rot.style.width=(measure(cur.textContent)+2)+'px';};
    fit();
    // วัดใหม่เมื่อฟอนต์ลายมือ (Mali) โหลดเสร็จ ไม่งั้นคำจะถูกตัดเพราะวัดจากฟอนต์สำรอง
    if(document.fonts&&document.fonts.ready) document.fonts.ready.then(fit);
    addEventListener('resize',fit);
    if(reduce) return;
    setInterval(function(){
      if(document.hidden) return;
      i=(i+1)%words.length;
      var nx=document.createElement('span');nx.textContent=words[i];nx.className='is-in';
      nx.style.position='absolute';nx.style.left='.08em';nx.style.top='0';
      rot.appendChild(nx);
      rot.style.width=(measure(words[i])+2)+'px';
      cur.classList.add('is-out');
      nx.offsetWidth; nx.classList.remove('is-in');
      var old=cur;cur=nx;
      setTimeout(function(){old.remove();nx.style.position='';nx.style.left='';nx.style.top='';},600);
    },2400);
  });

  /* ---------- HERO: ข้อความเบลอ + การ์ดลอยออกตามการเลื่อน ---------- */
  var hero=$('.fw-hero');
  if(hero&&!reduce) onScroll.push(function(){
    var q=progress(hero);
    hero.style.setProperty('--p',q.toFixed(3));
    // ปุ่มจองลอยซ่อนตอนอยู่ใน hero (เฉพาะแบบ sticky) ไม่ให้ทับการ์ดมุมขวาล่าง
    document.body.classList.toggle('fw-in-hero',q<0.7&&hero.offsetHeight>innerHeight);
  });

  /* ---------- STAGE ขาวหดมุมมนก่อนเข้าส่วนเข้ม ---------- */
  var stage=$('.fw-stage');
  if(stage&&!reduce) onScroll.push(function(){
    var b=stage.getBoundingClientRect().bottom;
    stage.style.setProperty('--shrink',clamp((innerHeight-b)/(innerHeight*0.5),0,1).toFixed(3));
  });

  /* ---------- PAIN: โน้ตหล่นทีละแผ่น → พลิกเป็นคำตอบ ---------- */
  var pain=$('.fw-pain'),notes=$$('.fw-note');
  notes.forEach(function(n){n.addEventListener('click',function(){n.classList.toggle('is-flip');n._manual=true;});});
  if(pain&&notes.length){
    var sticky=function(){return getComputedStyle($('.fw-pain-stage',pain)).position==='sticky';};
    if(reduce||!sticky()) notes.forEach(function(n){n.classList.add('is-in');});
    onScroll.push(function(){
      if(reduce||!sticky()) return;
      var q=progress(pain),N=notes.length;
      notes.forEach(function(n,i){
        n.classList.toggle('is-in',q>0.04+i*(0.5/N));        // ช่วงแรก: หล่นลงมาทีละแผ่น
        if(!n._manual) n.classList.toggle('is-flip',q>0.62+i*(0.3/N)); // ช่วงหลัง: พลิกเป็นคำตอบ
      });
    });
  }

  /* ---------- Nav เปลี่ยนเป็นธีมเข้มเมื่ออยู่บนส่วนพื้นเข้ม ---------- */
  var header=$('header'),darks=$$('[data-nav="dark"]');
  if(header&&darks.length) onScroll.push(function(){
    // data-nav-overlap = ส่วนขาวถัดไปทับขอบล่างกี่ px (margin-top ติดลบ) → ไม่นับส่วนที่ถูกทับ
    var y=40,on=darks.some(function(d){var r=d.getBoundingClientRect();return r.top<=y&&r.bottom-(+d.getAttribute('data-nav-overlap')||0)>=y;});
    header.classList.toggle('is-dark',on);
  });

  /* ---------- แถบรูปเลื่อนเอง (marquee): ก๊อปรูปชุดเดิมต่อท้าย ให้วนได้ไม่สะดุด ---------- */
  $$('.fw-mq-track').forEach(function(t){
    if(reduce) return;
    [].slice.call(t.children).forEach(function(c){var d=c.cloneNode(true);d.setAttribute('aria-hidden','true');d.alt='';t.appendChild(d);});
  });

  /* ---------- ปรากฏตัวตอนเลื่อนถึง + คลิปเล่นเฉพาะตอนอยู่บนจอ ---------- */
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('is-shown');io.unobserve(e.target);}});},{threshold:0.18});
    $$('.fw-rv').forEach(function(el){io.observe(el);});
    var vio=new IntersectionObserver(function(es){es.forEach(function(e){
      var v=e.target; if(e.isIntersecting&&!reduce){var p=v.play();p&&p.catch(function(){});} else v.pause();
    });},{threshold:0.1});
    $$('video[data-fw]').forEach(function(v){v.muted=true;v.playsInline=true;vio.observe(v);});
  }else{
    $$('.fw-rv').forEach(function(el){el.classList.add('is-shown');});
  }

  function run(){onScroll.forEach(function(f){f();});}
  addEventListener('scroll',run,{passive:true});
  addEventListener('resize',run);
  run();
})();
