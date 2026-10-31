/* =====================================================================
   Room Showcase — ห้องพัก 6 แบบ สไตล์ fastwork profile showcase
   ใช้: <section data-room-showcase data-img-base="images/"></section> + showcase.css
   - คอม: เลื่อนหน้า = เปลี่ยนการ์ด (sticky) · มือถือ/จอสัมผัส: แคปซูล + ปัดการ์ด
   - ปุ่ม "จองห้องนี้" ไปหน้าจองเดิม /booking.html?pet=..&room=.. (ไม่สร้างฟอร์มใหม่)
   - ไม่แตะ location.hash เลย: app.html เปิดหน้าจองอัตโนมัติถ้า hash ขึ้นต้นด้วย #book
   ข้อมูลห้อง/ราคา ตรงกับ index.html section #rooms — แก้ราคาที่นี่ที่เดียว
   ===================================================================== */
(function(){
  // รูปหลัก + แกลเลอรีรายห้อง: รูปจริงจากโฟลเดอร์ "รูปร้านปัจจุบัน" (กายส่งให้ 29 ต.ค. 2569)
  var DOG_ZONE=[['pph/corridor-dog.jpg','ทางเดินโซนห้องพัก'],['pph/hall-1.jpg','โถงหน้าห้องพัก']];
  var CAT_ZONE=[['pph/corridor-cat.jpg','โซนห้องพักแมว'],['pph/cat-playroom.jpg','ห้องเล่นแมว']];
  var ROOMS=[
    {pet:'dog',petTh:'สุนัข',emoji:'🐶',room:'cozy',  name:'Cozy Room',     size:'1×1.5 ม.',price:790, img:'pph/dog-cozy-main.jpg',
      gallery:[['pph/dog-cozy-1.jpg','Cozy Room'],['pph/dog-cozy-3.jpg','Cozy Room'],['pph/dog-cozy-2.jpg','Cozy Room']].concat(DOG_ZONE)},
    {pet:'dog',petTh:'สุนัข',emoji:'🐶',room:'deluxe',name:'Deluxe Room',   size:'1×2 ม.',  price:990, img:'pph/dog-deluxe-main.jpg',
      gallery:[['pph/dog-deluxe-1.jpg','Deluxe Room'],['pph/dog-deluxe-4.jpg','Deluxe Room'],['pph/dog-deluxe-2.jpg','Deluxe Room'],['pph/dog-deluxe-5.jpg','Deluxe Room']].concat(DOG_ZONE.slice(0,1))},
    {pet:'dog',petTh:'สุนัข',emoji:'🐶',room:'vip',   name:'VIP Villa Room',size:'1.5×2.5 ม.',price:1890,img:'pph/dog-vip-main.jpg',feat:true,
      gallery:[['pph/dog-vip-1.jpg','VIP Villa Room'],['pph/dog-vip-2.jpg','VIP Villa Room']].concat(DOG_ZONE)},
    {pet:'cat',petTh:'แมว', emoji:'🐱',room:'cozy',  name:'Cozy Room',     size:'1×1 ม.',  price:690, img:'pph/cat-cozy-main.jpg',
      gallery:[['pph/cat-cozy-main.jpg','Cozy Room']].concat(CAT_ZONE)},
    {pet:'cat',petTh:'แมว', emoji:'🐱',room:'deluxe',name:'Deluxe Room',   size:'1×1×2.5 ม.',sizeNote:'แนวตั้ง',price:990,img:'pph/cat-deluxe-main.jpg',
      gallery:[['pph/cat-deluxe-main.jpg','Deluxe Room']].concat(CAT_ZONE)},
    {pet:'cat',petTh:'แมว', emoji:'🐱',room:'vip',   name:'VIP Villa Room',size:'1.5×2.5 ม.',price:1890,img:'pph/cat-vip-main.jpg',feat:true,
      gallery:[['pph/cat-vip-main.jpg','VIP Villa Room']].concat(CAT_ZONE)}
  ];
  var ICON={
    cam:'<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
    snow:'<path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1L19.1 4.9"/>',
    photo:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
    bed:'<path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/>',
    pin:'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    x:'<path d="M18 6 6 18M6 6l12 12"/>',
    prev:'<path d="m15 18-6-6 6-6"/>',
    next:'<path d="m9 18 6-6-6-6"/>'
  };
  var AMENITIES=[['cam','CCTV 24 ชม.'],['snow','แอร์เย็น 24 ชม.'],['photo','อัปเดตรูปทุกวัน'],['bed','เตียงนุ่มสะอาด']];
  var POLICY=[
    'เช็คอิน 9:00–18:00 น. · เช็คเอาท์ภายใน 14:00 น.',
    'เช็คเอาท์ 14:00–20:00 น. คิดเป็นค่า Day Care · 20:00–21:00 น. เพิ่มชั่วโมงละ 100 บาท/ตัว',
    'มัดจำ 50% เพื่อยืนยันการจอง · ส่วนที่เหลือชำระวันเข้าพัก',
    'ไม่รับน้องที่ยังไม่ได้ฉีดวัคซีน ป่วย หรือมีโรคติดต่อ'
  ];
  function packList(r){
    var items=['สมุดวัคซีน','อาหาร + ขนมที่น้องกินประจำ','ของเล่น / ผ้าห่มที่น้องคุ้นเคย','ทิชชู่เปียก · แพมเพิส / แผ่นรองฉี่'];
    if(r.pet==='cat') items.splice(3,0,'ทรายแมว (ถ้าไม่ได้นำมา ใช้ของร้าน 100 บาท/วัน)');
    return items;
  }

  function svg(name){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICON[name]+'</svg>';}
  function baht(n){return '฿'+n.toLocaleString('en-US');}
  function bookUrl(r){return '/booking.html?pet='+r.pet+'&room='+r.room;}
  function li(t){return '<li>'+t+'</li>';}

  function cardHTML(r,i,uid,imgBase){
    var id=uid+'-'+i;
    return ''+
    '<article class="rs-card" id="'+id+'" role="tabpanel" aria-labelledby="'+id+'-tab" data-i="'+i+'">'+
      '<div class="rs-cover" role="button" tabindex="0" aria-label="ดูรูปเต็ม: '+r.name+'"><img src="'+imgBase+r.img+'" alt="'+r.name+' สำหรับ'+r.petTh+'" loading="lazy" decoding="async">'+
        '<div class="rs-badges"><span class="rs-badge">'+r.emoji+' ห้องพัก'+r.petTh+'</span>'+(r.feat?'<span class="rs-badge is-feat">⭐ แนะนำ</span>':'')+'</div>'+
      '</div>'+
      '<div class="rs-body">'+
        '<div class="rs-id"><div class="rs-avatar"><img src="'+imgBase+'logo-mark.png" alt=""></div>'+
          '<div><h3 class="rs-name">'+r.name+'</h3>'+
          '<p class="rs-handle"><span>@perfectbkk</span><span class="rs-hours"><span class="rs-open" aria-hidden="true"></span>เปิดทุกวัน 9:00–20:00</span></p></div></div>'+
        '<p class="rs-bio">ห้องพัก'+r.petTh+' ขนาด '+r.size+(r.sizeNote?' ('+r.sizeNote+')':'')+' · ทุกห้องสะอาด ปลอดภัย พร้อม CCTV และแอร์เย็นตลอด 24 ชม.</p>'+
        '<p class="rs-loc">'+svg('pin')+'วัชรพล–รามอินทรา, กรุงเทพฯ</p>'+
        '<div class="rs-stats">'+
          '<div class="is-price"><strong>'+baht(r.price)+'</strong><span>ต่อคืน</span></div>'+
          '<div><strong>'+r.size+'</strong><span>ขนาดห้อง</span></div>'+
          '<div><strong>24 ชม.</strong><span>CCTV + แอร์</span></div>'+
          '<div><strong>50%</strong><span>มัดจำ</span></div>'+
        '</div>'+
        '<div class="rs-subs" role="group" aria-label="รายละเอียดห้อง">'+
          '<button class="rs-sub is-on" data-pane="gal" aria-pressed="true">รูปห้อง</button>'+
          '<button class="rs-sub" data-pane="amen" aria-pressed="false">สิ่งที่ได้</button>'+
          '<button class="rs-sub" data-pane="policy" aria-pressed="false">เช็คอิน-เอาท์</button>'+
          '<button class="rs-sub" data-pane="pack" aria-pressed="false">เตรียมของ</button>'+
        '</div>'+
        '<div class="rs-panes">'+
          '<div class="rs-pane is-on" data-pane="gal"><div class="rs-gal">'+
            (r.gallery||[]).map(function(g){return '<figure role="button" tabindex="0" aria-label="ดูรูปเต็ม: '+g[1]+'"><img src="'+imgBase+g[0]+'" alt="'+g[1]+'" loading="lazy" decoding="async"><figcaption>'+g[1]+'</figcaption></figure>';}).join('')+'</div></div>'+
          '<div class="rs-pane" data-pane="amen"><div class="rs-amen">'+
            AMENITIES.map(function(a){return '<div>'+svg(a[0])+a[1]+'</div>';}).join('')+'</div></div>'+
          '<div class="rs-pane" data-pane="policy"><ul class="rs-list">'+POLICY.map(li).join('')+'</ul></div>'+
          '<div class="rs-pane" data-pane="pack"><ul class="rs-list">'+packList(r).map(li).join('')+'</ul></div>'+
        '</div>'+
        '<div class="rs-cta">'+
          '<div class="rs-cta-price"><b>'+baht(r.price)+'</b>ต่อคืน</div>'+
          '<a class="rs-line" href="https://line.me/R/ti/p/@perfectbkk" target="_blank" rel="noopener">ทัก LINE</a>'+
          '<a class="rs-book" href="'+bookUrl(r)+'" data-book>'+svg('cal')+'จองห้องนี้</a>'+
        '</div>'+
      '</div>'+
    '</article>';
  }

  function railHTML(uid){
    var html='',lastPet='';
    ROOMS.forEach(function(r,i){
      if(r.pet!==lastPet){html+='<div class="rs-group" role="presentation">'+r.emoji+' ห้องพัก'+r.petTh+'</div>';lastPet=r.pet;}
      html+='<button class="rs-tab" id="'+uid+'-'+i+'-tab" role="tab" aria-selected="false" aria-controls="'+uid+'-'+i+'" tabindex="-1" data-i="'+i+'" style="--tab-i:'+i+'">'+
        '<span class="rs-tab-emoji" aria-hidden="true">'+r.emoji+'</span><span>'+r.name+'</span></button>';
    });
    return '<div class="rs-rail"><div class="rs-tabs" role="tablist" aria-label="เลือกห้องพัก" aria-orientation="vertical">'+html+'</div>'+
      '<div class="rs-count" aria-hidden="true"><b>01</b> / '+String(ROOMS.length).padStart(2,'0')+'</div></div>';
  }

  /* ---------- ดูรูปเต็ม: กดรูปในการ์ด → เด้งเต็มจอ · กดพื้นที่ซ้าย/ขวาเลื่อนรูป · X หรือ Esc ปิด ---------- */
  var lb=null,lbList=[],lbI=0;
  function lbShow(i){
    lbI=(i+lbList.length)%lbList.length;
    var im=lbList[lbI],big=lb.querySelector('.rs-lb-img');
    big.src=im.getAttribute('src'); big.alt=im.alt;
    lb.querySelector('.rs-lb-cap').textContent=im.alt+' · '+(lbI+1)+'/'+lbList.length;
  }
  function openViewer(shot){
    if(!lb){
      lb=document.createElement('dialog');
      lb.className='rs-lb';
      lb.setAttribute('aria-label','ดูรูปห้อง');
      lb.innerHTML='<button class="rs-lb-x" aria-label="ปิด">'+svg('x')+'</button>'+
        '<img class="rs-lb-img" alt=""><p class="rs-lb-cap"></p>'+
        '<button class="rs-lb-nav is-prev" aria-label="รูปก่อนหน้า"><span>'+svg('prev')+'</span></button>'+
        '<button class="rs-lb-nav is-next" aria-label="รูปถัดไป"><span>'+svg('next')+'</span></button>';
      document.body.appendChild(lb);
      lb.addEventListener('click',function(e){
        var b=e.target.closest('button'); if(!b) return;
        if(b.classList.contains('rs-lb-x')) lb.close(); else lbShow(lbI+(b.classList.contains('is-prev')?-1:1));
      });
      lb.addEventListener('keydown',function(e){
        var d={ArrowLeft:-1,ArrowRight:1}[e.key]; if(d) lbShow(lbI+d);
      });
      // กันหน้าเว็บด้านหลังเลื่อนตอนเปิดดูรูป (การ์ด sticky จะเปลี่ยนใบ)
      ['wheel','touchmove'].forEach(function(t){lb.addEventListener(t,function(e){e.preventDefault();},{passive:false});});
    }
    var seen={},src=shot.querySelector('img').getAttribute('src');
    lbList=[].filter.call(shot.closest('.rs-card').querySelectorAll('.rs-cover img,.rs-gal img'),function(im){
      var s=im.getAttribute('src'); return !seen[s]&&(seen[s]=1);
    });
    lbShow(lbList.findIndex(function(im){return im.getAttribute('src')===src;}));
    lb.showModal();
  }

  var uidSeq=0;
  function mount(root){
    var uid='rs'+(++uidSeq);
    var imgBase=root.getAttribute('data-img-base')||'images/';
    var N=ROOMS.length;
    root.classList.add('rs');
    root.innerHTML='<div class="rs-sticky"><div class="rs-chrome">'+railHTML(uid)+
      '<div class="rs-deck">'+ROOMS.map(function(r,i){return cardHTML(r,i,uid,imgBase);}).join('')+'</div></div></div>';

    var chrome=root.querySelector('.rs-chrome'),sticky=root.querySelector('.rs-sticky');
    var tabsEl=root.querySelector('.rs-tabs'),deck=root.querySelector('.rs-deck');
    var tabs=[].slice.call(root.querySelectorAll('.rs-tab')),cards=[].slice.call(root.querySelectorAll('.rs-card'));
    var countEl=root.querySelector('.rs-count b');
    var coarse=matchMedia('(hover: none) and (pointer: coarse)'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
    var desktop=false,active=-1,introPx=0,stepPx=0,lastW=0;

    // จอสัมผัส/จอแคบ = โหมดมือถือ (ดูจากความกว้างกล่อง ไม่ใช่จอ — ใส่ในกรอบแอป 430px ก็ได้โหมดมือถือ)
    function wantDesktop(){return root.getAttribute('data-mode')!=='mobile'&&root.clientWidth>=820&&!coarse.matches;}
    function topPx(){return parseFloat(getComputedStyle(root).getPropertyValue('--rs-top'))||0;}
    // data-offset-el="header" → การ์ด sticky ต่อใต้หัวเว็บพอดี (หัวเว็บสูงไม่คงที่ เช่นปิดแถบโปรแล้วเตี้ยลง)
    var offSel=root.getAttribute('data-offset-el'),offsetEl=offSel&&document.querySelector(offSel);
    function syncTop(){if(offsetEl) root.style.setProperty('--rs-top',Math.round(offsetEl.getBoundingClientRect().bottom+16)+'px');}

    function setActive(i,syncChip){
      if(i===active) return;
      active=i;
      tabs.forEach(function(t,k){var on=k===i;t.classList.toggle('is-active',on);t.setAttribute('aria-selected',on);t.tabIndex=on?0:-1;});
      cards.forEach(function(c,k){c.classList.toggle('is-active',k===i);c.setAttribute('aria-hidden',desktop&&k!==i);});
      countEl.textContent=String(i+1).padStart(2,'0');
      if(!desktop&&syncChip){
        var t=tabs[i];
        tabsEl.scrollTo({left:t.offsetLeft-(tabsEl.clientWidth-t.offsetWidth)/2,behavior:reduce.matches?'auto':'smooth'});
      }
    }

    // ---------- คอม: ตำแหน่งเลื่อน → การ์ดที่แสดง ----------
    function onScrollDesktop(){
      var scrolled=topPx()-root.getBoundingClientRect().top;
      var intro=Math.min(Math.max(scrolled/introPx,0),1);
      root.style.setProperty('--rs-scale',reduce.matches?1:(1.06-0.06*intro).toFixed(4));
      chrome.classList.toggle('is-rail-in',intro>=0.5);
      var i=Math.round((scrolled-introPx)/stepPx);
      setActive(Math.min(Math.max(i,0),N-1),false);
    }
    // ---------- มือถือ: ตำแหน่งปัด → การ์ดที่แสดง ----------
    function onScrollMobile(){
      var step=cards[1].offsetLeft-cards[0].offsetLeft;
      setActive(Math.min(Math.max(Math.round(deck.scrollLeft/step),0),N-1),true);
    }

    function layout(){
      syncTop();
      desktop=wantDesktop();
      root.classList.toggle('rs--desktop',desktop);
      root.classList.toggle('rs--mobile',!desktop);
      tabsEl.setAttribute('aria-orientation',desktop?'vertical':'horizontal');
      if(desktop){
        var vh=innerHeight;
        introPx=vh*0.35; stepPx=vh*0.7;       // ~70vh ต่อการ์ด (fastwork ใช้ ~100vh) → หน้าไม่ยาวเกินไป
        root.style.height=(sticky.offsetHeight+introPx+stepPx*(N-1)+vh*0.25)+'px';
      }else{
        root.style.height='';
        chrome.classList.remove('is-rail-in');
        root.style.removeProperty('--rs-scale');
      }
      cards.forEach(function(c){c.removeAttribute('aria-hidden');});
      var keep=active<0?0:active; active=-1;
      if(desktop) onScrollDesktop(); else {setActive(keep,true);goTo(keep,true);}
    }

    function goTo(i,instant){
      var behavior=(instant||reduce.matches)?'auto':'smooth';
      if(desktop){
        var start=scrollY+root.getBoundingClientRect().top-topPx();
        scrollTo({top:start+introPx+i*stepPx+1,behavior:behavior});
      }else{
        deck.scrollTo({left:cards[i].offsetLeft-cards[0].offsetLeft,behavior:behavior});
      }
    }

    tabs.forEach(function(t,i){
      t.addEventListener('click',function(){if(!desktop) setActive(i,true);goTo(i);});
      t.addEventListener('keydown',function(e){
        var d={ArrowDown:1,ArrowRight:1,ArrowUp:-1,ArrowLeft:-1}[e.key];
        if(!d) return;
        e.preventDefault();
        var n=(i+d+N)%N; tabs[n].focus(); if(!desktop) setActive(n,true); goTo(n);
      });
    });
    // แท็บย่อยในการ์ด (สิ่งที่ได้ / เช็คอิน-เอาท์ / เตรียมของ)
    deck.addEventListener('keydown',function(e){
      if((e.key==='Enter'||e.key===' ')&&e.target.matches('.rs-cover,.rs-gal figure')){e.preventDefault();openViewer(e.target);}
    });
    deck.addEventListener('click',function(e){
      var shot=e.target.closest('.rs-cover,.rs-gal figure');
      if(shot){openViewer(shot);return;}
      var b=e.target.closest('.rs-sub'); if(!b) return;
      var card=b.closest('.rs-card');
      card.querySelectorAll('.rs-sub').forEach(function(x){var on=x===b;x.classList.toggle('is-on',on);x.setAttribute('aria-pressed',on);});
      card.querySelectorAll('.rs-pane').forEach(function(p){p.classList.toggle('is-on',p.getAttribute('data-pane')===b.getAttribute('data-pane'));});
    });

    // เบราว์เซอร์ยิง scroll event ไม่เกินเฟรมละครั้งอยู่แล้ว → ไม่ต้องหน่วงด้วย requestAnimationFrame
    addEventListener('scroll',function(){if(desktop) onScrollDesktop();},{passive:true});
    deck.addEventListener('scroll',function(){if(!desktop) onScrollMobile();},{passive:true});
    lastW=root.clientWidth; layout();
    // คำนวณใหม่เมื่อความกว้างเปลี่ยนเท่านั้น (ความสูงเราตั้งเอง ไม่งั้นจะวนลูป)
    new ResizeObserver(function(){var w=root.clientWidth;if(w!==lastW){lastW=w;layout();}}).observe(root);
    addEventListener('resize',function(){if(desktop) layout();});
    if(offsetEl) new ResizeObserver(function(){if(desktop) layout();}).observe(offsetEl);
    coarse.addEventListener('change',layout);
  }

  function init(){document.querySelectorAll('[data-room-showcase]').forEach(mount);}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
