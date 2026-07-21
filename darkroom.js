// ============================================
// Sol² 暗房（Darkroom）— darkroom.js v13
// 照片先壓縮再進門（長邊1200 / 品質0.85），
// 取下走兩段式：倉庫實體檔→登記簿，一起徹底清掉 💚
// v9：門楣右上換成笑臉小相機（跟選單吉祥物同一隻），拖曳完不再彈提示，
// 把手把橫桿移出縫線虛線，首頁相機貼紙搬到拍立得上緣正中間
// v10：顯影等待掛上全屋同款睡醒小紙片（Render 冷啟動不再乾等）
// v11：Developed 牆頭換心聲/推播同款手寫塗鴉③標題（星星＋草寫＋愛心＋波浪線，2026/07/19）
// v12：相機寶寶換老婆選定的 Mini Instax 長方形傳真機體格（髮箍糖果紋＋頭頂天線＋無腳，viewBox 240×210）；
//      戳戳與吐相片全面不再閉眼/瞇眼，表情只剩常駐眨眼（2026/07/19 老婆拍板，扭蛋機除外不動）
// v13：裁切縮放下限鬆綁——能一路縮到整張照片進框（老婆點名「縮的小太少」），放大上限仍錨在填滿框×3
// ============================================
(function () {
  'use strict';

  var DR_API = (typeof API_URL !== 'undefined' && API_URL) ? API_URL : 'https://solstice-backend-kjtu.onrender.com';

  var drPage = null;      // #darkroomPage
  var drPhotos = [];      // 顯示順序，index 0 = 牆上最前
  var drLoaded = false;   // 第一次名單抓完了沒
  var drBusy = false;     // 上傳中鎖
  var sheetId = null;     // 長按動作單目前對準哪張
  var lpTimer = null;     // 長按計時器
  var lpFired = false;    // 這次觸控有沒有觸發長按
  var lpX = 0, lpY = 0;   // 長按起點（移動太多就取消）
  var drag = { on: false, id: null, card: null, ghost: null, x: 0, y: 0, moved: false, changed: false, raf: 0, cd: 0 }; // 拖曳換位狀態
  var objUrl = null;      // 取景中的 objectURL，用完要回收
  var drPickWait = false; // 2026/07/21 按了快門在等相簿交照片（Android 凍結頁面時 change 會弄丟，醒來要自己撿）

  // 取景框狀態
  var crop = { img: null, nw: 0, nh: 0, fw: 0, fh: 0, scale: 1, minScale: 1, coverScale: 1, fitScale: 1, maxScale: 3, tx: 0, ty: 0, rot: 0 };
  var gest = { mode: null, sx: 0, sy: 0, stx: 0, sty: 0, d0: 0, s0: 1 };

  // ---------- 對外的門把 ----------
  window.goDarkroom = function () {
    ensureBuilt();
    syncAvatar();
    // 2026/07/19 開門前先掃寶寶身上殘留的動畫 class——display:none→block 會把元素身上所有動畫整段重播，
    // 戳戳／顯影大秀／快門鍵留下的 poked、snap 就是「每次進房自己彈一下」的真兇（全家統一堵）
    var _cam = document.getElementById('drCam');
    var _box = document.getElementById('drCamBox');
    if (_box) _box.classList.remove('poked');
    if (_cam) _cam.classList.remove('snap', 'out', 'hand', 'reload');
    drSweep(); // 2026/07/21 進房先掃幽靈分身，殘影當場超渡
    drPage.classList.add('open');
    if (!drLoaded) loadWall();
  };

  function drSweep() { // 2026/07/21 幽靈清潔工：iOS 把拖曳中斷（切app／通知／截圖分享）時 touchend 不來，z-index:70 的分身就漏在房裡蓋住整面牆——老婆那張「取不下來、新照片疊它後面」的拍立得就是它
    if (!drPage) return;
    var gs = drPage.querySelectorAll('.dr-ghost,.dr-flyer');
    for (var i = 0; i < gs.length; i++) { if (gs[i].parentNode) gs[i].parentNode.removeChild(gs[i]); }
  }

  function closeRoom() { drPage.classList.remove('open'); }

  // ---------- 頭像跟全家同一張（開機由主程式統一填，這裡借用） ----------
  function syncAvatar() {
    var mine = document.getElementById('drHdAvatar');
    if (!mine) return;
    var donors = ['chAvatar', 'cpHdAvatar', 'schHdAvatar', 'hbHdAvatar', 'ocHdAvatar', 'gcHdAvatar', 'memHdAvatar', 'plHdAvatar'];
    for (var i = 0; i < donors.length; i++) {
      var d = document.getElementById(donors[i]);
      if (d && d.src) { mine.src = d.src; return; }
    }
    if (!mine.src) mine.src = 'apple-touch-icon.png';
  }

  // ---------- 第一次進門才蓋內裝 ----------
  function ensureBuilt() {
    drPage = document.getElementById('darkroomPage');
    if (!drPage || drPage.dataset.built) return;
    drPage.dataset.built = '1';

    drPage.innerHTML = '' +
      '<div class="dr-shell">' +
        '<div class="dr-head">' +
          '<button class="dr-back" id="drBack" aria-label="回家">&#8592;</button>' +
          '<div class="dr-title"><svg class="dr-title-ic" viewBox="0 0 30 23"><path d="M10 5.5 l1.8-3 h6.4 l1.8 3" fill="#FFFDF6" stroke="#8C8C96" stroke-width="2" stroke-linejoin="round"/><rect x="1.5" y="5.5" width="27" height="15.5" rx="3" fill="#FFFDF6" stroke="#8C8C96" stroke-width="2"/><circle cx="15" cy="13.2" r="5" fill="#FBE4EE" stroke="#8C8C96" stroke-width="1.8"/><circle cx="15" cy="13.2" r="2.1" fill="#E98FAE" stroke="#B76E90" stroke-width="1.2"/><circle cx="24.6" cy="9" r="1.3" fill="#E98FAE"/></svg>Darkroom</div>' +
          '<span class="dr-safelight-stk" aria-hidden="true">' + camMascot() + '</span>' +
        '</div>' +
        '<div class="dr-film" aria-hidden="true"></div>' +
        '<div class="dr-scroll" id="drScroll">' +
          '<div class="dr-plaza" id="drPlaza"><div class="dr-cambox" id="drCamBox">' + drBigCam() + '<button class="dr-shutter" id="drShutter" aria-label="拍一張掛上牆"><span class="dr-shutter-ring"></span><span class="dr-shutter-core"></span></button></div></div>' +
          '<div class="dr-wall-head"><span class="doodle-t"><span class="doodle-row"><svg class="doodle-spk" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1 l1.4 4 4 1.4 -4 1.4 -1.4 4 -1.4 -4 -4 -1.4 4 -1.4 z" fill="#F5CE3E" stroke="#B8801F" stroke-width="1.1" stroke-linejoin="round"/></svg><span class="dr-wall-t">Developed</span><svg class="doodle-hrt" viewBox="0 0 14 13" aria-hidden="true"><path d="M7 11.6 C3.4 9 1.4 6.8 1.4 4.7 A3 3 0 0 1 7 3 A3 3 0 0 1 12.6 4.7 C12.6 6.8 10.6 9 7 11.6Z" fill="#E98FAE" stroke="#B76E90" stroke-width="1.1"/></svg></span><svg class="doodle-wave" viewBox="0 0 118 9" aria-hidden="true"><path d="M4 5 q12 -6 24 0 t24 0 t24 0 t24 0" fill="none" stroke-width="2" stroke-linecap="round"/></svg></span></div>' +
          '<div class="dr-status" id="drStatus"></div>' +
          '<div class="dr-wall" id="drWall"></div><div class="dr-ropes" id="drRopes" aria-hidden="true"></div>' +
          '<div class="dr-empty" id="drEmpty" hidden>' + moonSunflower() +
            '<div>牆上還空著<br>等第一張照片在這裡顯影</div>' +
          '</div>' +
        '</div>' +
        '<input type="file" id="drFile" accept="image/*" hidden>' +
        '<div class="dr-modal" id="drCropModal" hidden>' +
          '<div class="dr-crop-card dr-stitch"><span class="dr-tape-ui"></span>' +
            '<div class="dr-frame" id="drFrame"><img id="drCropImg" alt="" draggable="false"></div>' +
            '<div class="dr-crop-tools">' +
              '<button class="dr-rot" id="drRot" aria-label="旋轉90度">&#8635;</button>' +
              '<input type="range" id="drZoom" min="0" max="100" value="0" aria-label="縮放">' +
            '</div>' +
            '<input class="dr-cap" id="drCap" maxlength="40" placeholder="寫一句話掛在照片下">' +
            '<div class="dr-crop-btns">' +
              '<button class="dr-btn dr-btn-ghost" id="drCropCancel">先不要</button>' +
              '<button class="dr-btn dr-btn-main" id="drCropOk">顯影上牆</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="dr-modal" id="drConfirm" hidden>' +
          '<div class="dr-cfm-card dr-stitch"><span class="dr-tape-ui"></span>' +
            '<span class="dr-sheet-doodle" aria-hidden="true">' + flowerSVG() + '</span>' +
            '<div class="dr-cfm-t">Take This Down?</div>' +
            '<div class="dr-cfm-q">確定把這張取下嗎？</div>' +
            '<div class="dr-crop-btns">' +
              '<button class="dr-btn dr-btn-ghost" id="drCfmNo">留著</button>' +
              '<button class="dr-btn dr-btn-danger" id="drCfmYes">取下</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="dr-sheet-mask" id="drSheetMask" hidden>' +
          '<div class="dr-sheet dr-stitch" id="drSheet">' +
            '<span class="dr-sheet-doodle" aria-hidden="true">' + flowerSVG() + '</span>' +
            '<div class="dr-sheet-mascot" aria-hidden="true">' + camMascot() + '</div>' +
            '<div class="dr-sheet-title">This Photo</div>' +
            '<button class="dr-sheet-btn" data-act="rename"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 13.5 L13 4 a1.8 1.8 0 0 1 2.6 0 l0 0 a1.8 1.8 0 0 1 0 2.6 L6 16 l-3.4 .9 z" fill="#FBE4EE" stroke="#E9A0BC" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 5 l3 3" stroke="#E9A0BC" stroke-width="1.3" stroke-linecap="round"/></svg>更改名稱</button>' +
            '<button class="dr-sheet-btn dr-danger" data-act="del">取下這張</button>' +
          '</div>' +
        '</div>' +
        '<div class="dr-modal" id="drRenModal" hidden>' +
          '<div class="dr-ren-card dr-stitch"><span class="dr-tape-ui"></span>' +
            '<span class="dr-sheet-doodle" aria-hidden="true">' + flowerSVG() + '</span>' +
            '<div class="dr-ren-t">Name This Moment</div>' +
            '<input class="dr-cap" id="drRenInput" maxlength="40">' +
            '<div class="dr-crop-btns">' +
              '<button class="dr-btn dr-btn-ghost" id="drRenCancel">先不要</button>' +
              '<button class="dr-btn dr-btn-main" id="drRenOk">掛上去</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="dr-toast" id="drToast"></div>' +
      '</div>';

    wireEvents();
    var drCam0 = document.getElementById('drCam');
    if (drCam0) drCam0.addEventListener('click', drCamPoke); // 2026/07/18 對齊心聲/推播同款用 click：進房滑動牆面時手指擦過寶寶不會誤觸（老婆抓到「進去自己彈」）
  }

  // ---------- 廣場上的拍立得相機寶寶：常駐眨眼＋布丁彈跳＋咔嚓吐相片（2026/07/19 老婆選定 Mini Instax 長方形傳真機體格） ----------
  function drBigCam() {
    return '<svg class="dr-cam" id="drCam" viewBox="0 0 240 210" aria-label="相機寶寶">' +
      '<g stroke-linecap="round"><path d="M24 192 v-8 M20 188 h8" stroke="#E9A0BE" stroke-width="2"/><path d="M216 195 v-7 M212.5 191.5 h7" stroke="#C99AB4" stroke-width="2"/><circle cx="38" cy="201" r="2" fill="rgba(255,240,230,.85)"/><circle cx="204" cy="203" r="2" fill="#F6C9D9"/></g>' + // 2026/07/21 漂浮小裝飾：抄扭蛋房結構、配暗房安全燈粉（老婆點名開枝散葉）
      '<g class="dr-amb dr-amb1"><path d="M13 114 c-2.6 -3.1 -7.6 -1.5 -7.6 2.2 c0 3.4 4.5 6 7.6 8.4 c3.1 -2.4 7.6 -5 7.6 -8.4 c0 -3.7 -5 -5.3 -7.6 -2.2 z" fill="#E98FAE" stroke="#C9617F" stroke-width="1.5" stroke-linejoin="round"/></g>' +
      '<g class="dr-amb dr-amb2"><path d="M222 54 l1.7 4.3 4.3 1.7 -4.3 1.7 -1.7 4.3 -1.7 -4.3 -4.3 -1.7 4.3 -1.7 z" fill="#FFDE8F" stroke="#C89A3F" stroke-width="1.4" stroke-linejoin="round"/></g>' +
      '<g class="dr-amb dr-amb3"><path d="M228 90 c-1.9 -2.3 -5.5 -1.1 -5.5 1.6 c0 2.5 3.3 4.3 5.5 6.1 c2.2 -1.8 5.5 -3.6 5.5 -6.1 c0 -2.7 -3.6 -3.9 -5.5 -1.6 z" fill="#CDE9DA" stroke="#7FAE93" stroke-width="1.3" stroke-linejoin="round"/></g>' +
      '<g class="dr-amb dr-amb4"><path d="M18 82 l1.3 3.2 3.2 1.3 -3.2 1.3 -1.3 3.2 -1.3 -3.2 -3.2 -1.3 3.2 -1.3 z" fill="#E3DCF5" stroke="#9B8CC4" stroke-width="1.3" stroke-linejoin="round"/></g>' +
      '<defs>' +
      '<linearGradient id="drCandyH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E98FAE"/><stop offset=".125" stop-color="#E98FAE"/><stop offset=".125" stop-color="#FFFFFF"/><stop offset=".25" stop-color="#FFFFFF"/><stop offset=".25" stop-color="#F6C9D9"/><stop offset=".375" stop-color="#F6C9D9"/><stop offset=".375" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#E98FAE"/><stop offset=".625" stop-color="#E98FAE"/><stop offset=".625" stop-color="#FFFFFF"/><stop offset=".75" stop-color="#FFFFFF"/><stop offset=".75" stop-color="#F6C9D9"/><stop offset=".875" stop-color="#F6C9D9"/><stop offset=".875" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient>' +
      '<clipPath id="drSlotClip"><rect x="58" y="159" width="124" height="48"/></clipPath>' +
      '</defs>' +
      '<ellipse cx="120" cy="194" rx="84" ry="6" fill="rgba(233,143,174,.13)" pointer-events="none"/>' +
      '<rect x="52" y="26" width="24" height="20" rx="4" fill="#3A333C" stroke="#262028" stroke-width="2.5"/>' + // 觀景窗＝左邊小天線（下半藏進機身）
      '<rect x="57" y="30" width="10" height="6" rx="2" fill="#6E6674"/>' +
      '<g><rect x="156" y="24" width="36" height="22" rx="4" fill="#FFF9EA" stroke="#C9AE72" stroke-width="2.5"/><path d="M165 24 v22 M174 24 v22 M183 24 v22" stroke="rgba(201,174,114,.55)" stroke-width="1.4"/><circle id="drCamGlow" cx="174" cy="35" r="9" fill="#FFF6D8"/></g>' + // 閃光燈＝右邊小天線
      '<path d="M32 58 q0 -16 16 -16 h144 q16 0 16 16 v96 q0 14 -14 14 H46 q-14 0 -14 -14 z" fill="#FBF7F2" stroke="#4A4048" stroke-width="4" stroke-linejoin="round"/>' + // 機身：長方形，跟傳真機同框（176×126）
      '<rect x="40" y="52" width="160" height="13" fill="url(#drCandyH)" stroke="#4A4048" stroke-width="2"/>' + // 糖果條紋改成頭上一圈髮箍
      '<circle cx="120" cy="106" r="27" fill="#4A4048"/>' +
      '<circle cx="120" cy="106" r="20" fill="#2A2530"/>' +
      '<circle cx="120" cy="106" r="23.5" fill="none" stroke="#E98FAE" stroke-width="1.6" stroke-dasharray="3 4" opacity=".9"/>' +
      '<path d="M108 96 a15 15 0 0 1 10 -5" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="128" cy="113" r="2.2" fill="rgba(255,255,255,.45)"/>' +
      '<circle class="dr-eye" cx="92" cy="142" r="3.4" fill="#4A4048"/><circle class="dr-eye" cx="148" cy="142" r="3.4" fill="#4A4048"/>' +
      '<path d="M112 148 q8 5 16 0" fill="none" stroke="#4A4048" stroke-width="2.4" stroke-linecap="round"/>' +
      '<ellipse class="dr-cam-blush" cx="84" cy="148" rx="5" ry="3" fill="rgba(238,164,190,.8)"/><ellipse class="dr-cam-blush" cx="156" cy="148" rx="5" ry="3" fill="rgba(238,164,190,.8)"/>' +
      '<rect x="64" y="155" width="112" height="9" rx="4.5" fill="#3A333C" stroke="#262028" stroke-width="2"/><rect x="74" y="157.4" width="92" height="3.8" rx="1.9" fill="#241F26"/>' +
      '<g clip-path="url(#drSlotClip)"><g id="drCamPhotoIn">' +
      '<rect x="96" y="113" width="48" height="42" rx="2" fill="#FEFEFC" stroke="#CFC7D2" stroke-width="2"/>' +
      '<rect x="100" y="117" width="40" height="26" rx="1" fill="#EADAE2"/>' +
      '<path class="dr-cam-devheart" d="M120 140 c-4,-3 -5.8,-4.9 -5.8,-7.1 a3.2,3.2 0 0 1 5.8,-1.9 a3.2,3.2 0 0 1 5.8,1.9 c0,2.2 -1.8,4.1 -5.8,7.1 z" fill="#E98FAE"/>' +
      '</g></g>' + // 📸 相片畫在出紙桿之後、夾在出紙口裁切窗裡：待機全藏、顯影時往下滑 30 露出愛心（腳腳拆掉——沒有腳就沒有冷氣的嫌疑）
      '<g class="dr-cam-star"><path d="M204 20 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4 z" fill="#F6C9D9"/></g>' +
      '<g class="dr-cam-star s2"><path d="M215 34 l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1 z" fill="#FFFFFF"/></g>' +
      '</svg>';
  }
  var drCamTmr = null, drCamSq = null;
  function drCamPoke(e) {
    // 要戳到寶寶本體才Q彈：點到 SVG 空白畫布（target=根節點）不算數（2026/07/17 老婆規格，跟心聲/推播對齊）
    if (e && e.target && e.target.id === 'drCam') return;
    var cam = document.getElementById('drCam');
    if (!cam) return;
    var box = document.getElementById('drCamBox') || cam;
    // 2026/07/19 全家統一（老婆拍板）：戳＝只有布丁Q彈 0.68s、不再閉眼；彈完把 class 收乾淨。
    // 吐相片只留給真的顯影（上傳後的 drLandFirst 大秀）——戳戳不再拖三秒的收紙尾巴。
    box.classList.remove('poked');
    void box.getBoundingClientRect(); // SVG 沒有 offsetWidth，不重排布丁只彈得了第一次
    box.classList.add('poked');
    clearTimeout(drCamTmr); drCamTmr = setTimeout(function () { box.classList.remove('poked'); }, 700); // 殘留的 poked 會在下次進房 display 切換時整段重播——「改了N次還是自己彈」的真兇
  }

  // ---------- 空牆的月光向日葵 ----------
  function moonSunflower() {
    var petals = '';
    for (var a = 0; a < 360; a += 30) {
      petals += '<ellipse cx="48" cy="22" rx="7.5" ry="13.5" transform="rotate(' + a + ' 48 48)" fill="#d9d9de" stroke="#6f6f76" stroke-width="1.6"/>';
    }
    return '<svg viewBox="0 0 96 96" aria-hidden="true">' + petals +
      '<circle cx="48" cy="48" r="14.5" fill="#3a3a40" stroke="#6f6f76" stroke-width="1.8"/>' +
      '<circle cx="43" cy="45" r="1.5" fill="#8b8b92"/><circle cx="52" cy="44" r="1.5" fill="#8b8b92"/>' +
      '<circle cx="48" cy="52" r="1.5" fill="#8b8b92"/><circle cx="42" cy="51" r="1.1" fill="#6f6f76"/>' +
      '<circle cx="54" cy="50" r="1.1" fill="#6f6f76"/>' +
      '</svg>';
  }

  // ---------- 小花貼紙與有臉的小相機（全家吉祥物語言） ----------
  function flowerSVG() {
    var petals = '';
    for (var a = 0; a < 360; a += 72) {
      petals += '<ellipse cx="12" cy="5.6" rx="3" ry="4.3" transform="rotate(' + a + ' 12 12)"/>';
    }
    return '<svg viewBox="0 0 24 24"><g fill="#F3B7CA" stroke="#C9698F" stroke-width="1.2">' + petals +
      '<circle cx="12" cy="12" r="2.6" fill="#FBE4EE"/></g></svg>';
  }
  function camMascot() {
    return '<svg viewBox="0 0 40 32">' +
      '<path d="M14 8 l2-3.4 h8 l2 3.4" fill="#FBF9F4" stroke="#8C8C96" stroke-width="2" stroke-linejoin="round"/>' +
      '<rect x="2" y="8" width="36" height="21" rx="6" fill="#FBF9F4" stroke="#8C8C96" stroke-width="2"/>' +
      '<circle cx="20" cy="18.5" r="7.6" fill="#FBE4EE" stroke="#8C8C96" stroke-width="1.8"/>' +
      '<circle class="dr-eye" cx="17.4" cy="17.6" r="1.15" fill="#6E5A60"/><circle class="dr-eye" cx="22.6" cy="17.6" r="1.15" fill="#6E5A60"/>' +
      '<path d="M17.8 20.6 q2.2 1.9 4.4 0" fill="none" stroke="#6E5A60" stroke-width="1.2" stroke-linecap="round"/>' +
      '<circle cx="14.6" cy="19.8" r="1.15" fill="#F3B7CA"/><circle cx="25.4" cy="19.8" r="1.15" fill="#F3B7CA"/>' +
      '<circle cx="32.5" cy="12.5" r="1.6" fill="#E98FAE"/>' +
      '</svg>';
  }

  // ---------- 綁事件（只綁一次） ----------
  function wireEvents() {
    var $ = function (id) { return document.getElementById(id); };

    $('drBack').addEventListener('click', closeRoom);
    window.addEventListener('resize', function () { drDrawRopes(); }); // 轉向、視窗改寬 → 繩位重量
    $('drShutter').addEventListener('click', function () { // 📸 快門鍵＝上傳鍵：按下去咔嚓閃一下，再挑照片
      if (drBusy) return;
      var cam = $('drCam');
      if (cam) { cam.classList.remove('snap'); void cam.getBoundingClientRect(); cam.classList.add('snap'); setTimeout(function () { cam.classList.remove('snap'); }, 820); } // 2026/07/19 閃完收乾淨，殘留會在下次進房重播
      drPickWait = true; // 開始等相簿交貨
      $('drFile').click();
    });
    $('drFile').addEventListener('change', onPickFile);
    ['drCap', 'drRenInput'].forEach(function (fid) { // 2026/07/21 鍵盤升起時把輸入框捲到眼前（iPhone 那邊也一起吃到藥）
      $(fid).addEventListener('focus', function () { var el = this; setTimeout(function () { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) { el.scrollIntoView(); } }, 350); });
    });
    $('drRot').addEventListener('click', onRotate);
    $('drZoom').addEventListener('input', onZoomSlide);
    $('drCropCancel').addEventListener('click', closeCrop);
    $('drCropOk').addEventListener('click', onCropOk);
    $('drCfmNo').addEventListener('click', function () { $('drConfirm').hidden = true; });
    $('drCfmYes').addEventListener('click', onDeleteYes);
    $('drRenCancel').addEventListener('click', function () { $('drRenModal').hidden = true; });
    $('drRenOk').addEventListener('click', onRenameOk);
    $('drSheetMask').addEventListener('click', function (e) { if (e.target === this) closeSheet(); });
    document.addEventListener('visibilitychange', function () { // 2026/07/21 切出去（通知/截圖分享/切app）當場把拖曳收乾淨
      if (document.hidden) { if (drag.on) endDrag(true); return; }
      if (drPickWait) { // 2026/07/21 從相簿回來：Android 偶爾把 change 弄丟（老婆的「選了圖卻要按第二次」）——醒來檢查口袋，照片在就自己開取景
        var tryPick = function () { var inp = $('drFile'); if (drPickWait && inp && inp.files && inp.files[0]) onPickFile({ target: inp }); };
        setTimeout(tryPick, 350);
        setTimeout(function () { tryPick(); drPickWait = false; }, 1200);
      }
    });
    $('drSheet').addEventListener('click', onSheetAct);

    var wall = $('drWall');
    wall.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    wall.addEventListener('click', onWallTap);
    wall.addEventListener('touchstart', onWallTouchStart, { passive: true });
    wall.addEventListener('touchmove', onWallTouchMove, { passive: false });
    wall.addEventListener('touchend', onWallTouchEnd, { passive: true });
    wall.addEventListener('touchcancel', onWallTouchCancel, { passive: true });

    var frame = $('drFrame');
    frame.addEventListener('touchstart', onFrameStart, { passive: false });
    frame.addEventListener('touchmove', onFrameMove, { passive: false });
    frame.addEventListener('touchend', onFrameEnd, { passive: false });
    frame.addEventListener('touchcancel', onFrameEnd, { passive: false });
  }

  // ---------- 抓名單、掛牆 ----------
  function loadWall() {
    setStatus('<span class="dr-dot"></span><span>顯影中…</span>');
    fetch(DR_API + '/darkroom/list')
      .then(function (r) { if (!r.ok) throw new Error('list ' + r.status); return r.json(); })
      .then(function (rows) {
        drPhotos = Array.isArray(rows) ? rows : [];
        drLoaded = true;
        setStatus('');
        renderWall();
      })
      .catch(function () {
        setStatus('<span>暗房的紅燈接觸不良…</span><button class="dr-retry" id="drRetry">再顯影一次</button>');
        var rb = document.getElementById('drRetry');
        if (rb) rb.addEventListener('click', loadWall);
      });
  }

  function setStatus(html) {
    var st = document.getElementById('drStatus');
    st.innerHTML = html;
    st.classList.toggle('on', !!html);
  }

  function renderWall() {
    var wall = document.getElementById('drWall');
    var empty = document.getElementById('drEmpty');
    if (!drag.on) drSweep(); // 2026/07/21 每次鋪牆順手掃殘影（拖曳中不掃，別誤殺現役分身）
    if (!drPhotos.length) {
      wall.innerHTML = '';
      var lay0 = document.getElementById('drRopes'); if (lay0) lay0.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    var html = '';
    for (var i = 0; i < drPhotos.length; i++) html += cardHTML(drPhotos[i], i);
    wall.innerHTML = html;
    drDrawRopes();
    setTimeout(drDrawRopes, 650); // 字型/圖片落定、列高定案後再校一次繩位
  }

  // ---------- 🧵 晾繩改畫在牆上（2026/07/18 老婆抓到搬運時線會分開）----------
  // 繩子不再屬於任何一張照片：每一排量好位置後畫「一條」在獨立圖層上。
  // 拖曳搬運時照片是用 transform 滑動、不改排版 → 繩子原地不動，線永遠連在一起；
  // 放手落定（syncOrderFromDOM）、刪除、轉向時再重量一次。也因為是同一條線，永遠沒有接縫。
  // 🧵 繩子幾何 v2（2026/07/18 老婆圈圖抓到）：舊畫法是「平線＋在夾子正下方挖一個小凹」——
  // 繩子最低點剛好從夾嘴底下鑽過去，看起來像夾子懸空、沒夾到繩。
  // 真的曬衣繩是反過來的：夾子抓住的地方最高，兩個夾子「之間」才自然垂下去。
  // 現在改用像素座標直接描：錨點＝每個夾子的正中央（y=5.5 剛好是夾嘴金屬圈的圓心高度），
  // 相鄰錨點之間用三次貝茲垂一段緩弧，繩頭繩尾在牆邊翹一點點、像釘在牆上。
  function drRopePath(xs, w, dy) {
    var yClip = 5.5 + dy, ySag = 11 + dy, yEnd = 3.2 + dy;
    var pts = [{ x: 0, y: yEnd }];
    for (var i = 0; i < xs.length; i++) pts.push({ x: xs[i], y: yClip });
    pts.push({ x: w, y: yEnd });
    var p = 'M0 ' + yEnd.toFixed(1);
    for (var j = 1; j < pts.length; j++) {
      var a = pts[j - 1], b = pts[j], s = b.x - a.x;
      p += ' C' + (a.x + s * .34).toFixed(1) + ' ' + ySag.toFixed(1) + ' ' + (b.x - s * .34).toFixed(1) + ' ' + ySag.toFixed(1) + ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
    }
    return p;
  }
  function drRopeBg(xs, w) {
    return 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 ' + w + ' 13\'%3E%3Cpath d=\'' + drRopePath(xs, w, 0) + '\' fill=\'none\' stroke=\'%236E6E76\' stroke-width=\'2\' stroke-linecap=\'round\'/%3E%3Cpath d=\'' + drRopePath(xs, w, -.8) + '\' fill=\'none\' stroke=\'rgba(255,255,255,.16)\' stroke-width=\'.8\' stroke-linecap=\'round\'/%3E%3C/svg%3E")';
  }
  function drDrawRopes() {
    var wall = document.getElementById('drWall'), lay = document.getElementById('drRopes');
    if (!wall || !lay) return;
    lay.innerHTML = '';
    var cards = wall.children;
    if (!cards.length) return;
    var rows = [], cur = null;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i], t = c.offsetTop;
      if (!cur || Math.abs(t - cur.top) > 6) { cur = { top: t, first: c, last: c, cs: [c] }; rows.push(cur); }
      else { cur.last = c; cur.cs.push(c); }
    }
    for (var r = 0; r < rows.length; r++) {
      var q = rows[r];
      var L = q.first.offsetLeft - 11;
      var R = q.last.offsetLeft + q.last.offsetWidth + 11;
      var d = document.createElement('div');
      d.className = 'dr-rope';
      d.style.left = L + 'px';
      d.style.top = (q.top - 12) + 'px';
      d.style.width = (R - L) + 'px';
      var xs = [];
      for (var ci = 0; ci < q.cs.length; ci++) { var cc = q.cs[ci]; xs.push(cc.offsetLeft + cc.offsetWidth / 2 - L); } // 夾子在照片正中央：錨點＝照片中心
      d.style.backgroundImage = drRopeBg(xs, R - L);
      lay.appendChild(d);
    }
  }

  var TILTS = [-1.2, 1.2, -1.2, 1.2, -1.2, 1.2]; // 2026/07/17 等量交錯：相鄰照片縫隙寬窄一致
  var DR_REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DR_CLIP = '<svg class="dr-clip" viewBox="0 0 15 24" aria-hidden="true">' +
    '<rect x="2.2" y="1.5" width="4" height="21" rx="1.8" fill="#D8B98A" stroke="#8A6B42" stroke-width="1.4"/>' +
    '<rect x="8.8" y="1.5" width="4" height="21" rx="1.8" fill="#CBAA79" stroke="#8A6B42" stroke-width="1.4"/>' +
    '<circle cx="7.5" cy="6.5" r="2.6" fill="none" stroke="#8B8B92" stroke-width="1.5"/></svg>';
  var DR_VEIL_HEART = '<svg viewBox="0 0 24 24"><path d="M12 20 q-8.4 -5.5 -8.4 -12 q4 -5.5 8.4 0 q4.4 -5.5 8.4 0 q0 6.5 -8.4 12z" fill="#E98FAE" opacity=".85"/></svg>';
  function cardHTML(p, i) {
    var d = fmtDate(p.created_at);
    var cap = escHTML(p.caption || '');
    return '<figure class="dr-card" data-id="' + escAttr(String(p.id)) + '" style="--tilt:' + TILTS[i % TILTS.length] + 'deg">' +
      DR_CLIP +
      '<div class="dr-ph-wrap"><img class="dr-ph" src="' + escAttr(p.url || '') + '" alt="" loading="lazy" draggable="false"></div>' +
      '<figcaption class="dr-meta">' +
        (cap ? '<div class="dr-cap-t">' + cap + '</div>' : '') +
        (d ? '<div class="dr-date">' + d + '</div>' : '') +
      '</figcaption>' +
    '</figure>';
  }

  // ---------- 顯影連動：相機吐出→相片飛下牆→木夾夾住→盪兩下→顯影 ----------
  function drLandFirst() {
    var wall = document.getElementById('drWall');
    var first = wall && wall.firstElementChild;
    if (!first) return;
    var cam = document.getElementById('drCam');
    if (DR_REDUCE || !cam) { // 減少動態：走原本的直接顯影
      first.classList.add('dr-develop');
      setTimeout(function () { first.classList.remove('dr-develop'); }, 2100);
      return;
    }
    var box = document.getElementById('drCamBox') || cam;
    clearTimeout(drCamTmr); clearTimeout(drCamSq); // 顯影序列開跑前，把戳戳留下的定時炸彈全拆掉，免得半路亂收紙
    box.classList.remove('poked'); cam.classList.remove('snap', 'out', 'hand', 'reload'); void box.getBoundingClientRect();
    box.classList.add('poked'); cam.classList.add('snap', 'out'); // ① 咔嚓＋吐相片（2026/07/19 老婆拍板：出東西不瞇眼，表情交還常駐眨眼）
    setTimeout(function () { box.classList.remove('poked'); cam.classList.remove('snap'); }, 820); // 2026/07/19 布丁跟星星閃完就收 class，下次進房不重播
    first.style.visibility = 'hidden';
    setTimeout(function () { // ② 量好出口與落點，生出飛行相片
      var wrap = first.querySelector('.dr-ph-wrap');
      var tr = (wrap || first).getBoundingClientRect();
      var cr = cam.getBoundingClientRect();
      var fly = document.createElement('div');
      fly.className = 'dr-flyer';
      fly.style.width = tr.width + 'px';
      fly.style.height = (tr.width * 4 / 3 + tr.width * .23) + 'px';
      fly.innerHTML = '<div class="dr-fly-body"><div class="dr-fly-img">' + DR_VEIL_HEART + '</div></div>';
      fly.style.transform = 'translate(' + (cr.left + cr.width * .5 - tr.width * .5) + 'px,' + (cr.top + cr.height * .8) + 'px) rotate(-4deg) scale(.5)';
      drPage.appendChild(fly); // 跟拖曳分身同理由：掛房間裡才不會被 z-index 蓋掉
      cam.classList.add('hand'); // 相機口那張交棒隱形
      void fly.getBoundingClientRect();
      var tilt = first.style.getPropertyValue('--tilt') || '0deg';
      fly.style.transition = 'transform .8s cubic-bezier(.45,.02,.35,1.02)';
      fly.style.transform = 'translate(' + (tr.left - tr.width * .07) + 'px,' + (tr.top - tr.width * .07) + 'px) rotate(' + tilt + ') scale(1)';
      setTimeout(function () { // ③ 落地：夾住、盪兩下、開始顯影
        fly.remove();
        first.style.visibility = '';
        first.classList.add('dr-attach', 'dr-develop');
        var veil = document.createElement('div');
        veil.className = 'dr-veil';
        veil.innerHTML = DR_VEIL_HEART;
        if (wrap) wrap.appendChild(veil);
        requestAnimationFrame(function () { requestAnimationFrame(function () { veil.classList.add('gone'); }); });
        cam.classList.remove('out'); // ④ 相機收回吐紙、重新裝填一張空白相紙
        setTimeout(function () {
          cam.classList.remove('hand');
          cam.classList.add('reload'); void cam.getBoundingClientRect();
          cam.classList.remove('reload');
        }, 420);
        setTimeout(function () {
          first.classList.remove('dr-attach', 'dr-develop');
          if (veil.parentNode) veil.remove();
        }, 2400);
      }, 830);
    }, 570); // 等紙完全吐出來（.55s 彈簧跑完）才交棒飛行相片，不再半路搶戲
  }

  // ---------- 牆上的手勢：點一下開燈箱，長按把照片拿起來 ----------
  // 拿起來之後：直接拖 = 換位置；原地放開 = 開動作單（更改名稱／取下）
  function onWallTouchStart(e) {
    if (e.touches.length !== 1) { clearLP(); return; }
    if (drag.on) { endDrag(true); return; } // 2026/07/21 上一輪拖曳沒收乾淨：先安靜收掉，這一下不當長按
    var card = e.target.closest ? e.target.closest('.dr-card') : null;
    if (!card) return;
    lpFired = false;
    lpX = e.touches[0].clientX; lpY = e.touches[0].clientY;
    var id = card.getAttribute('data-id');
    lpTimer = setTimeout(function () { lpFired = true; liftCard(card, id); }, 500);
  }
  function onWallTouchMove(e) {
    if (drag.on) {
      e.preventDefault();
      if (!e.touches.length) return;
      drag.x = e.touches[0].clientX; drag.y = e.touches[0].clientY;
      var mx = drag.x - lpX, my = drag.y - lpY;
      if (mx * mx + my * my > 64) drag.moved = true;
      if (drag.ghost) drag.ghost.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0) rotate(var(--tilt,0deg)) scale(1.06)';
      return;
    }
    if (!lpTimer || !e.touches.length) return;
    var dx = e.touches[0].clientX - lpX, dy = e.touches[0].clientY - lpY;
    if (dx * dx + dy * dy > 100) clearLP();
  }
  function onWallTouchEnd() {
    clearLP();
    if (drag.on) endDrag(false);
  }
  function onWallTouchCancel() {
    clearLP();
    if (drag.on) endDrag(true);
  }
  function clearLP() { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } }

  // ---------- 拖曳換位：分身跟著手指走，原卡當占位符 ----------
  function liftCard(card, id) {
    if (drag.on) endDrag(true); // 2026/07/21 防重入：分身永遠只有一隻，舊的先收再生新的（漏掉=幽靈）
    // 量「未旋轉」的外框：拿旋轉後的框去擺分身會偏幾px，出現瞬間就跳一下（2026/07/17 老婆抓到的閃）
    var prevT = card.style.transform;
    card.style.transform = 'none';
    var r = card.getBoundingClientRect();
    card.style.transform = prevT;
    drag.on = true; drag.id = id; drag.card = card;
    drag.moved = false; drag.changed = false;
    drag.x = lpX; drag.y = lpY;
    drag.cd = Date.now();
    var g = card.cloneNode(true);
    g.classList.add('dr-ghost');
    g.style.width = r.width + 'px';
    g.style.left = r.left + 'px';
    g.style.top = r.top + 'px';
    g.style.transform = 'translate3d(0,0,0) rotate(var(--tilt,0deg)) scale(1.06)';
    drPage.appendChild(g); // 一定要掛在房間裡面，掛 body 會被 z-index:800 的房間蓋住
    drag.ghost = g;
    card.classList.add('dr-drag-src');
    if (navigator.vibrate) { try { navigator.vibrate(10); } catch (_) {} }
    drag.raf = requestAnimationFrame(dragTick);
  }

  function hoverReorder() {
    var el = document.elementFromPoint(drag.x, drag.y);
    var over = (el && el.closest) ? el.closest('.dr-card') : null;
    if (!over || over === drag.card || over.classList.contains('dr-ghost')) return false;
    var wall = document.getElementById('drWall');
    if (over.parentNode !== wall) return false;
    var kids = Array.prototype.slice.call(wall.children);
    var si = kids.indexOf(drag.card), oi = kids.indexOf(over);
    if (si < 0 || oi < 0 || si === oi) return false;
    var prev = [];
    for (var i = 0; i < kids.length; i++) prev.push(kids[i].getBoundingClientRect());
    if (si < oi) wall.insertBefore(drag.card, over.nextSibling);
    else wall.insertBefore(drag.card, over);
    drag.changed = true;
    for (var j = 0; j < kids.length; j++) {
      var k = kids[j];
      if (k === drag.card) continue;
      var now = k.getBoundingClientRect();
      var fx = prev[j].left - now.left, fy = prev[j].top - now.top;
      if (!fx && !fy) continue;
      k.style.transition = 'none';
      k.style.transform = 'translate(' + fx + 'px,' + fy + 'px) rotate(var(--tilt,0deg))';
      void k.offsetWidth;
      k.style.transition = 'transform .3s cubic-bezier(.22,.61,.36,1)';
      k.style.transform = 'rotate(var(--tilt,0deg))';
    }
    return true;
  }

  // 拖到靠近上下緣時，牆自己慢慢捲動
  function dragTick() {
    if (!drag.on) return;
    var sc = document.getElementById('drScroll');
    var r = sc.getBoundingClientRect();
    var zone = 80, v = 0;
    if (drag.y < r.top + zone) v = -Math.ceil((r.top + zone - drag.y) / 9);
    else if (drag.y > r.bottom - zone) v = Math.ceil((drag.y - (r.bottom - zone)) / 9);
    if (v) sc.scrollTop += v;
    if (drag.moved && Date.now() - drag.cd > 150) {
      if (hoverReorder()) drag.cd = Date.now();
    }
    drag.raf = requestAnimationFrame(dragTick);
  }

  function endDrag(silent) {
    cancelAnimationFrame(drag.raf);
    var card = drag.card, moved = drag.moved, changed = drag.changed, id = drag.id;
    if (drag.ghost && drag.ghost.parentNode) drag.ghost.parentNode.removeChild(drag.ghost);
    if (card) card.classList.remove('dr-drag-src');
    drag.on = false; drag.ghost = null; drag.card = null; drag.id = null;
    if (changed) {
      syncOrderFromDOM();
      persistOrder();
    } else if (!moved && !silent) {
      openSheet(id);
    }
  }

  function syncOrderFromDOM() {
    var wall = document.getElementById('drWall');
    var kids = wall.children, next = [];
    for (var i = 0; i < kids.length; i++) {
      var p = findPhoto(kids[i].getAttribute('data-id'));
      if (p) next.push(p);
      kids[i].style.setProperty('--tilt', TILTS[i % TILTS.length] + 'deg');
      kids[i].style.transition = '';
      kids[i].style.transform = '';
    }
    drPhotos = next;
    drDrawRopes(); // 放手落定、傾斜重排完成 → 繩位跟著新排面重量一次
  }

  function onWallTap(e) {
    if (lpFired) { lpFired = false; return; }
    var card = e.target.closest ? e.target.closest('.dr-card') : null;
    if (!card) return;
    var p = findPhoto(card.getAttribute('data-id'));
    if (p && p.url) openLightbox(p.url);
  }

  function openLightbox(url) {
    var lb = document.getElementById('imgLightbox');
    var im = document.getElementById('lightboxImg');
    if (lb && im) { im.src = url; lb.classList.add('open'); }
  }

  function findPhoto(id) {
    for (var i = 0; i < drPhotos.length; i++) if (String(drPhotos[i].id) === String(id)) return drPhotos[i];
    return null;
  }
  function findIndex(id) {
    for (var i = 0; i < drPhotos.length; i++) if (String(drPhotos[i].id) === String(id)) return i;
    return -1;
  }

  // ---------- 長按動作單 ----------
  function openSheet(id) {
    sheetId = id;
    document.getElementById('drSheetMask').hidden = false;
  }
  function closeSheet() { document.getElementById('drSheetMask').hidden = true; }

  function onSheetAct(e) {
    var btn = e.target.closest ? e.target.closest('.dr-sheet-btn') : null;
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    if (act === 'del') { closeSheet(); document.getElementById('drConfirm').hidden = false; return; }
    if (act === 'rename') { closeSheet(); openRename(); return; }
  }

  // ---------- 更改名稱：把照片下面那句話換掉 ----------
  function openRename() {
    var p = findPhoto(sheetId);
    if (!p) return;
    document.getElementById('drRenInput').value = p.caption || '';
    document.getElementById('drRenModal').hidden = false;
  }

  function onRenameOk() {
    var p = findPhoto(sheetId);
    if (!p) { document.getElementById('drRenModal').hidden = true; return; }
    var cap = document.getElementById('drRenInput').value.trim().slice(0, 40);
    var btn = document.getElementById('drRenOk');
    btn.disabled = true;
    btn.textContent = '掛上去…';
    fetch(DR_API + '/darkroom/caption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, caption: cap })
    }).then(function (r) { if (!r.ok) throw new Error('caption ' + r.status); return r.json(); })
      .then(function (row) {
        p.caption = (row && typeof row.caption === 'string') ? row.caption : cap;
        document.getElementById('drRenModal').hidden = true;
        var cardEl = document.querySelector('.dr-card[data-id="' + cssEsc(String(p.id)) + '"]'); // 2026/07/21 換字改原地換：不再整面牆重建
        if (cardEl) {
          var meta = cardEl.querySelector('.dr-meta');
          var capEl = cardEl.querySelector('.dr-cap-t');
          if (p.caption) {
            if (!capEl) { capEl = document.createElement('div'); capEl.className = 'dr-cap-t'; meta.insertBefore(capEl, meta.firstChild); }
            capEl.textContent = p.caption;
          } else if (capEl && capEl.parentNode) { capEl.parentNode.removeChild(capEl); }
          drDrawRopes(); // 字換了卡片高度可能變，繩位跟著校一次
        } else { renderWall(); }
      })
      .catch(function () { toast('沒改到，等等再試一次'); })
      .then(function () { btn.disabled = false; btn.textContent = '掛上去'; });
  }

  function persistOrder() {
    var orders = [];
    for (var i = 0; i < drPhotos.length; i++) {
      var so = drPhotos.length - i;
      drPhotos[i].sort_order = so;
      orders.push({ id: drPhotos[i].id, sort_order: so });
    }
    fetch(DR_API + '/darkroom/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders: orders })
    }).then(function (r) { if (!r.ok) throw new Error('reorder ' + r.status); })
      .catch(function () { toast('排序沒存到，我再對一次牆'); loadWall(); });
  }

  // ---------- 取下（兩段式徹底刪除，動手前先問過妳） ----------
  function onDeleteYes() {
    document.getElementById('drConfirm').hidden = true;
    var id = sheetId;
    var i = findIndex(id);
    if (i < 0) return;
    fetch(DR_API + '/darkroom/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: drPhotos[i].id })
    }).then(function (r) { if (!r.ok) throw new Error('delete ' + r.status); return r.json(); })
      .then(function () {
        var el = document.querySelector('.dr-card[data-id="' + cssEsc(String(id)) + '"]');
        var done = function () { // 2026/07/21 取下改外科手術式：只拔這一張，其他照片原地不動（「取下時別張閃一下」＝整面牆重建的殘影）
          var j = findIndex(id);
          if (j > -1) drPhotos.splice(j, 1);
          if (el && el.parentNode) el.parentNode.removeChild(el);
          if (!drPhotos.length) { renderWall(); return; } // 最後一張收走：亮空牆、清繩子
          syncOrderFromDOM(); // 傾斜與繩位跟著新排面重量，不重建舊卡
        };
        if (el) { el.classList.add('dr-fadeout'); setTimeout(done, 340); } else { done(); } // 淡出動畫本身就是回饋，不再彈小提醒
      })
      .catch(function () { toast('取不下來，等等再試一次'); });
  }

  // ---------- 選照片 → 取景 ----------
  function onPickFile(e) {
    drPickWait = false; // 貨到，收旗
    var f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.type && f.type.indexOf('image') !== 0) { toast('這個不是照片喔'); return; }
    if (objUrl) { URL.revokeObjectURL(objUrl); objUrl = null; }
    objUrl = URL.createObjectURL(f);
    var img = document.getElementById('drCropImg');
    img.onload = function () {
      crop.img = img;
      crop.nw = img.naturalWidth || img.width;
      crop.nh = img.naturalHeight || img.height;
      if (!crop.nw || !crop.nh) { toast('這張照片讀不出來'); closeCrop(); return; }
      crop.rot = 0;
      document.getElementById('drCap').value = '';
      document.getElementById('drCropModal').hidden = false;
      requestAnimationFrame(function () {
        var frame = document.getElementById('drFrame');
        crop.fw = frame.clientWidth;
        crop.fh = frame.clientHeight;
        img.style.width = crop.nw + 'px';
        img.style.height = crop.nh + 'px';
        resetFit();
      });
    };
    img.onerror = function () { toast('這張照片打不開'); closeCrop(); };
    img.src = objUrl;
  }

  function rotDims() {
    var flip = (crop.rot % 180) !== 0;
    return { w: flip ? crop.nh : crop.nw, h: flip ? crop.nw : crop.nh };
  }

  function sliderFromScale(s) {
    var lo = crop.minScale, hi = crop.maxScale;
    if (hi <= lo) return 0;
    return Math.max(0, Math.min(100, Math.round((s - lo) / (hi - lo) * 100)));
  }

  function resetFit() {
    var rd = rotDims();
    crop.coverScale = Math.max(crop.fw / rd.w, crop.fh / rd.h); // 填滿框
    crop.fitScale = Math.min(crop.fw / rd.w, crop.fh / rd.h);   // 整張進框
    crop.minScale = Math.min(crop.fitScale, crop.coverScale);   // 2026/07/20 下限鬆綁：能縮到整張照片都看得見（留白匯出時是暗色底，跟牆上相紙同語言）
    crop.maxScale = crop.coverScale * 3;                         // 放大上限錨在填滿框×3，不跟著下限縮水
    crop.scale = crop.coverScale;                                // 開場仍以填滿框起手
    crop.tx = 0; crop.ty = 0;
    document.getElementById('drZoom').value = sliderFromScale(crop.scale);
    applyCrop();
  }

  function clampPan() {
    var rd = rotDims();
    var maxX = Math.max(0, (rd.w * crop.scale - crop.fw) / 2);
    var maxY = Math.max(0, (rd.h * crop.scale - crop.fh) / 2);
    if (crop.tx > maxX) crop.tx = maxX;
    if (crop.tx < -maxX) crop.tx = -maxX;
    if (crop.ty > maxY) crop.ty = maxY;
    if (crop.ty < -maxY) crop.ty = -maxY;
  }

  function applyCrop() {
    clampPan();
    crop.img.style.transform = 'translate(-50%,-50%) translate(' + crop.tx + 'px,' + crop.ty + 'px) rotate(' + crop.rot + 'deg) scale(' + crop.scale + ')';
  }

  function setScale(s) {
    if (s < crop.minScale) s = crop.minScale;
    if (s > crop.maxScale) s = crop.maxScale;
    crop.scale = s;
    document.getElementById('drZoom').value = sliderFromScale(s);
    applyCrop();
  }

  function onZoomSlide(e) {
    var v = Number(e.target.value) || 0;
    crop.scale = crop.minScale + (crop.maxScale - crop.minScale) * v / 100;
    applyCrop();
  }

  function onRotate() {
    crop.rot = (crop.rot + 90) % 360;
    resetFit();
  }

  // ---------- 取景框手勢：單指拖曳、雙指縮放 ----------
  function tDist(e) {
    var a = e.touches[0], b = e.touches[1];
    var dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy) || 1;
  }
  function onFrameStart(e) {
    e.preventDefault();
    if (e.touches.length >= 2) {
      gest.mode = 'pinch'; gest.d0 = tDist(e); gest.s0 = crop.scale;
    } else if (e.touches.length === 1) {
      gest.mode = 'pan';
      gest.sx = e.touches[0].clientX; gest.sy = e.touches[0].clientY;
      gest.stx = crop.tx; gest.sty = crop.ty;
    }
  }
  function onFrameMove(e) {
    e.preventDefault();
    if (gest.mode === 'pinch' && e.touches.length >= 2) {
      setScale(gest.s0 * tDist(e) / gest.d0);
    } else if (gest.mode === 'pan' && e.touches.length === 1) {
      crop.tx = gest.stx + (e.touches[0].clientX - gest.sx);
      crop.ty = gest.sty + (e.touches[0].clientY - gest.sy);
      applyCrop();
    }
  }
  function onFrameEnd(e) {
    if (e.touches.length === 1) {
      gest.mode = 'pan';
      gest.sx = e.touches[0].clientX; gest.sy = e.touches[0].clientY;
      gest.stx = crop.tx; gest.sty = crop.ty;
    } else if (e.touches.length === 0) {
      gest.mode = null;
    }
  }

  function closeCrop() {
    document.getElementById('drCropModal').hidden = true;
    if (objUrl) { URL.revokeObjectURL(objUrl); objUrl = null; }
    var img = document.getElementById('drCropImg');
    img.removeAttribute('src');
  }

  // ---------- 顯影上牆：canvas 壓縮 → 上傳 → 顯影動畫 ----------
  function onCropOk() {
    if (drBusy || !crop.img || !crop.fw) return;
    var outW = 900, outH = 1200; // 3:4，長邊 1200
    var k = outW / crop.fw;
    var c = document.createElement('canvas');
    c.width = outW; c.height = outH;
    var ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#0d0d0f';
    ctx.fillRect(0, 0, outW, outH);
    ctx.translate(outW / 2 + crop.tx * k, outH / 2 + crop.ty * k);
    ctx.rotate(crop.rot * Math.PI / 180);
    var s = crop.scale * k;
    ctx.scale(s, s);
    ctx.drawImage(crop.img, -crop.nw / 2, -crop.nh / 2, crop.nw, crop.nh);

    var dataUrl;
    try { dataUrl = c.toDataURL('image/jpeg', 0.85); }
    catch (err) { toast('這張壓不動，換一張試試'); return; }

    var cap = document.getElementById('drCap').value.trim().slice(0, 40);
    var okBtn = document.getElementById('drCropOk');
    drBusy = true;
    okBtn.disabled = true;
    okBtn.textContent = '顯影中…';
    // Render 免費層冷啟動可達 30~60 秒：超過 8 秒掛一張全屋同款睡醒小紙片
    var drCold = setTimeout(function () {
      var st = document.getElementById('drStatus');
      if (st && !st.querySelector('.sol-sleepnote') && typeof solSleepNote === 'function') {
        st.innerHTML = '';
        st.appendChild(solSleepNote('我剛睡醒，這張會顯影得慢一點…', 'dr-coldnote'));
        st.classList.add('on');
      }
    }, 8000);

    fetch(DR_API + '/darkroom/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl, caption: cap })
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error((j && j.error) || ('upload ' + r.status));
        return j;
      });
    }).then(function (row) {
      drPhotos.unshift(row);
      closeCrop();
      var wall = document.getElementById('drWall');
      if (!wall.children.length) { renderWall(); } // 空牆第一張：走完整鋪牆（藏空狀態、畫繩）
      else { // 2026/07/21 新照片改外科手術式插入：舊卡原地不動，不再全牆閃一下
        var tmp = document.createElement('div');
        tmp.innerHTML = cardHTML(row, 0);
        wall.insertBefore(tmp.firstChild, wall.firstChild);
        syncOrderFromDOM();
      }
      var scroll = document.getElementById('drScroll');
      scroll.scrollTop = 0;
      drLandFirst(); // 📸 相機吐出→飛下牆→木夾夾住→盪兩下→顯影
    }).catch(function () {
      toast('顯影失敗了，等等再來一次');
    }).then(function () {
      clearTimeout(drCold);
      setStatus('');
      drBusy = false;
      okBtn.disabled = false;
      okBtn.textContent = '顯影上牆';
    });
  }

  // ---------- 小工具 ----------
  function toast(msg) {
    var t = document.getElementById('drToast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  function fmtDate(s) {
    if (!s) return '';
    var d = new Date(s);
    if (isNaN(d.getTime())) return '';
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate());
  }

  function escHTML(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escAttr(s) { return escHTML(s); }
  function cssEsc(s) { return s.replace(/["\\]/g, '\\$&'); }

})();
