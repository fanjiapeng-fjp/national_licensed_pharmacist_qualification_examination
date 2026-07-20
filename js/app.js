var STORAGE_BASE = "yspx_data_v2";
function getStorageKey() { return STORAGE_BASE + "_" + getUserId(); }
function getUserId() { var u = localStorage.getItem("yspx_current_user"); return u || "anonymous"; }

// Supabase client
var SUPABASE_URL = "https://jbqhvlshxbefsgqjirnz.supabase.co";
var SUPABASE_KEY = "sb_publishable__tl-I22y7045YJr7OJpGVQ_wZr0nbdp";

// Lightweight Supabase REST API wrapper (zero external dependencies)
var supabase = {
  from: function(table) {
    var self = this;
    return {
      select: function(col) {
        return {
          eq: function(k, v) {
            return {
              maybeSingle: async function() {
                try {
                  var url = SUPABASE_URL + "/rest/v1/" + table + "?select=" + col + "&" + k + "=eq." + encodeURIComponent(v) + "&limit=1";
                  var res = await fetch(url, { headers: { "apikey": SUPABASE_KEY } });
                  if (!res.ok) return { data: null, error: { message: "查询失败" } };
                  var data = await res.json();
                  return { data: data && data.length > 0 ? data[0] : null, error: null };
                } catch(e) { return { data: null, error: { message: "网络错误" } }; }
              }
            };
          }
        };
      }
    };
  },
  auth: {
    _getSession: function() {
      try { var s = localStorage.getItem("yspx_supabase_session"); return s ? JSON.parse(s) : null; }
      catch(e) { return null; }
    },
    _setSession: function(data) {
      if (data && data.access_token) {
        localStorage.setItem("yspx_supabase_session", JSON.stringify(data));
      }
    },
    signUp: async function(opts) {
      try {
        var res = await fetch(SUPABASE_URL + "/auth/v1/signup", {
          method: "POST",
          headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ email: opts.email, password: opts.password, data: opts.options ? opts.options.data : {} })
        });
        var data = await res.json();
        if (!res.ok) {
          var msg = data.msg || data.message || "注册失败";
          if (msg.includes("already")) msg = "该邮箱已注册，请直接登录";
          return { data: null, error: { message: msg } };
        }
        supabase.auth._setSession(data);
        return { data: data, error: null };
      } catch(e) { return { data: null, error: { message: "网络错误，请检查网络连接后重试" } }; }
    },
    signInWithPassword: async function(opts) {
      try {
        var res = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
          method: "POST",
          headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ email: opts.email, password: opts.password })
        });
        var data = await res.json();
        if (!res.ok) {
          var msg = data.error_description || data.msg || "登录失败";
          if (/not confirmed/i.test(msg)) msg = "邮箱尚未验证，请先点击验证邮件中的链接";
          if (/invalid/i.test(msg)) msg = "邮箱或密码错误";
          return { data: null, error: { message: msg } };
        }
        supabase.auth._setSession(data);
        return { data: data, error: null };
      } catch(e) { return { data: null, error: { message: "网络错误，请检查网络连接后重试" } }; }
    },
    getSession: async function() {
      var session = supabase.auth._getSession();
      if (!session) return { data: { session: null } };
      if (session.expires_at && session.expires_at * 1000 < Date.now()) {
        return await supabase.auth.refreshSession();
      }
      return { data: { session: session } };
    },
    refreshSession: async function() {
      try {
        var session = supabase.auth._getSession();
        if (!session || !session.refresh_token) {
          localStorage.removeItem("yspx_supabase_session");
          return { data: { session: null } };
        }
        var res = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
          method: "POST",
          headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: session.refresh_token })
        });
        if (!res.ok) { localStorage.removeItem("yspx_supabase_session"); return { data: { session: null } }; }
        var data = await res.json();
        supabase.auth._setSession(data);
        return { data: { session: data } };
      } catch(e) { return { data: { session: null } }; }
    },
    signOut: async function() {
      try {
        var session = supabase.auth._getSession();
        localStorage.removeItem("yspx_supabase_session");
        if (session) {
          await fetch(SUPABASE_URL + "/auth/v1/logout", {
            method: "POST",
            headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + session.access_token }
          });
        }
      } catch(e) {}
    }
  }
};

function loadData() {
  try { return JSON.parse(localStorage.getItem(getStorageKey())) || getDefaultData(); }
  catch(e) { return getDefaultData(); }
}

function getDefaultData() {
  return {
    progress: {},
    wrongBook: {},
    daily: {},
    streak: 0,
    lastStudyDate: "",
    examRecords: [],
    settings: { dailyGoal: 50, fontSize: 22, scene: "normal", phase: "basic" },
    searchHistory: [],
    totalDuration: 0
  };
}

function saveData(data) { localStorage.setItem(getStorageKey(), JSON.stringify(data)); }
var appData = loadData();

function toast(msg) {
  var t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(function(){ t.classList.remove("show"); }, 2000);
}

function getExamDate() { return new Date(2026, 9, 31); }

function updateCountdown() {
  var diff = Math.ceil((getExamDate() - new Date()) / 86400000);
  document.getElementById("countdown").textContent = diff > 0 ? diff + "天" : "考试日！";
}

var pages = ["page-home","page-study","page-wrong","page-exam","page-report","page-search","page-settings","page-profile","page-otp-reset","page-quiz","page-exam-running","page-exam-result"];
var currentTab = 0;
var currentSubject = 1;
var bankMode = 'all';

function switchTab(idx) {
  currentTab = idx;
  pages.forEach(function(p){ document.getElementById(p).classList.remove("active"); });
  document.getElementById(pages[idx]).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(function(n,i){ n.classList.toggle("active", i===idx); });
  if(idx===0) renderHome();
  if(idx===1) renderStudyTabs();
  if(idx===2) renderWrongBook();
  if(idx===3) renderExam();
  if(idx===4) renderReport();
  if(idx===5) renderSearch();
  if(idx===6) renderSettings();
}
// Navigate to any page by ID (for sub-pages not in bottom nav)
function navTo(pageId) {
  pages.forEach(function(p){ document.getElementById(p).classList.remove("active"); });
  document.getElementById(pageId).classList.add("active");
  if(pageId === "page-profile") showProfile();
  if(pageId === "page-otp-reset") showOtpReset();
}


// Navigate to any page by ID (for sub-pages not in bottom nav)// ===== OTP PASSWORD RESET =====
function showOtpReset() {
  document.getElementById("page-auth").style.display = "none";
  navTo("page-otp-reset");
}

async function doResetPassword() {
  var pwd = document.getElementById("otpResetPassword").value;
  var pwd2 = document.getElementById("otpResetPassword2").value;
  var errEl = document.getElementById("otpResetError");
  var sucEl = document.getElementById("otpResetSuccess");
  errEl.textContent = "";
  sucEl.textContent = "";

  if (!pwd || pwd.length < 6) { errEl.textContent = "新密码至少6个字符"; return; }
  if (pwd !== pwd2) { errEl.textContent = "两次密码不一致"; return; }

  try {
    var session = JSON.parse(localStorage.getItem("yspx_supabase_session") || "{}");
    var token = session.access_token;
    if (!token) { errEl.textContent = "会话已过期，请返回重新发送重置邮件"; return; }

    var res = await fetch(SUPABASE_URL + "/auth/v1/user", {
      method: "PUT",
      headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwd })
    });
    if (res.ok) {
      sucEl.textContent = "密码已重置！正在跳转...";
      setTimeout(function() {
        localStorage.clear();
        location.reload();
      }, 1500);
    } else {
      var d = await res.json();
      errEl.textContent = d.msg || "重置失败，请重新发送重置邮件";
    }
  } catch(e) {
    errEl.textContent = "网络错误";
  }
}

// ===== HOME =====
function renderHome() {
  updateCountdown();
  var today = new Date().toISOString().split("T")[0];
  var goal = appData.settings.dailyGoal || 50;
  var todayCount = appData.daily[today] || 0;
  document.getElementById("todayCount").textContent = todayCount + "/" + goal;

  var totalQ = 0, totalC = 0;
  for(var qid in appData.progress) {
    var p = appData.progress[qid];
    totalQ += (p.correct||0) + (p.wrong||0);
    totalC += (p.correct||0);
  }
  document.getElementById("totalCount").textContent = totalQ;
  document.getElementById("totalRate").textContent = totalQ>0 ? Math.round(totalC/totalQ*100)+"%" : "0%";
  document.getElementById("streak").textContent = appData.streak;

  var overviewHTML = "";
  SUBJECTS.forEach(function(s){
    var sq=0, sc=0;
    QUESTIONS.forEach(function(q){
      if(q.subject===s.id) {
        var p = appData.progress[q.id] || {correct:0,wrong:0};
        sq += (p.correct||0)+(p.wrong||0);
        sc += (p.correct||0);
      }
    });
    var rate = sq>0 ? Math.round(sc/sq*100) : 0;
    var color = rate<60 ? "red" : rate<80 ? "yellow" : "green";
    overviewHTML += '<div class="chapter-row"><span style="font-size:24px">'+s.icon+'</span><div class="chapter-info"><div class="chapter-name">'+s.name+' - '+s.full+'</div><div class="chapter-meta">'+sq+'题 · 正确率'+rate+'%</div></div><div class="progress-bar" style="width:80px"><div class="progress-fill" style="width:'+rate+'%;background:var(--'+color+')"></div></div></div>';
  });
  document.getElementById("subjectOverview").innerHTML = overviewHTML;

  var weakList = [];
  for(var sid in CHAPTERS) {
    CHAPTERS[sid].forEach(function(ch){
      var cq=0, cc=0;
      QUESTIONS.forEach(function(q){
        if(q.subject==sid && q.chapter===ch) {
          var p = appData.progress[q.id] || {correct:0,wrong:0};
          cq += (p.correct||0)+(p.wrong||0);
          cc += (p.correct||0);
        }
      });
      if(cq>=3) weakList.push({sid:parseInt(sid), ch:ch, rate:Math.round(cc/cq*100), count:cq});
    });
  }
  weakList.sort(function(a,b){ return a.rate-b.rate; });
  if(weakList.length>0) {
    var wHTML = "";
    weakList.slice(0,3).forEach(function(w){
      var sub = SUBJECTS.find(function(s){ return s.id===w.sid; });
      var chName = w.ch.split(" ")[1] || w.ch;
      var color = w.rate<60 ? "red" : w.rate<80 ? "yellow" : "green";
      wHTML += '<div class="flex justify-between items-center" style="padding:6px 0"><span>'+sub.icon+' '+sub.name+' · '+chName+'</span><span class="tag tag-'+color+'">'+w.rate+'%</span></div>';
    });
    document.getElementById("weakList").innerHTML = wHTML;
  }

  var seed = new Date().getDate();
  var dq = QUESTIONS[seed % QUESTIONS.length];
  var typeName = ["A型题","B型题","C型题","X型题"]["ABCX".indexOf(dq.type)] || "";
  var sub = SUBJECTS.find(function(s){ return s.id===dq.subject; });
  document.getElementById("dailyQuestion").innerHTML = '<div class="fs-lg bold mb-4">'+dq.question+'</div><div class="mb-8" style="color:#888">['+typeName+'] · '+sub.name+'</div><button class="btn btn-outline btn-sm" onclick="switchTab(1);startQuiz('+dq.subject+',\''+dq.chapter+'\')">去做题 →</button>';

  if(appData._lastQuiz) document.getElementById("continueLearning").style.display = "block";
}

function continueLearning() {
  var lq = appData._lastQuiz;
  if(lq) { startQuiz(lq.subject, lq.chapter); return; }
  switchTab(1);
}

// ===== WRONG BOOK =====
var wrongFilter = "all";

function renderWrongBook() {
  var h = "";
  SUBJECTS.forEach(function(s){
    var cnt = 0;
    for(var qid in appData.wrongBook) {
      if(!appData.wrongBook[qid].mastered) {
        var q = QUESTIONS.find(function(x){ return x.id===parseInt(qid); });
        if(q && q.subject===s.id) cnt++;
      }
    }
    h += '<button class="tab'+(currentSubject===s.id?" active":"")+'" onclick="setStudySubject('+s.id+');renderWrongBook()">'+s.icon+' '+s.name+'('+cnt+')</button>';
  });
  document.getElementById("wrongSubjects").innerHTML = h;

  var wrongQs = [];
  for(var qid in appData.wrongBook) {
    var wb = appData.wrongBook[qid];
    var q = QUESTIONS.find(function(x){ return x.id===parseInt(qid); });
    if(!q) continue;
    if(wrongFilter==="pending" && wb.mastered) continue;
    if(wrongFilter==="mastered" && !wb.mastered) continue;
    if(currentSubject && q.subject !== currentSubject) continue;
    wrongQs.push({q:q, wb:wb});
  }

  if(wrongQs.length===0) {
    document.getElementById("wrongList").innerHTML = '<div class="empty-state"><span class="empty-icon">🎉</span>'+(wrongFilter==="pending"?"所有错题已消灭！":"还没有错题，继续保持！")+'</div>';
    return;
  }
  var wh = "";
  wrongQs.forEach(function(item){
    var sub = SUBJECTS.find(function(s){ return s.id===item.q.subject; });
    wh += '<div class="chapter-row" onclick="retryWrongQ('+item.q.id+')"><span class="tag'+(item.wb.mastered?" tag-green":" tag-red")+'">'+(item.wb.mastered?"已掌握":"待消灭")+'</span><div class="chapter-info"><div class="chapter-name">'+sub.icon+' '+sub.name+' · '+item.q.type+'型</div><div class="chapter-meta">'+item.q.question.substring(0,30)+'...</div></div><span style="font-size:11px;color:#999">'+item.wb.source+'</span></div>';
  });
  document.getElementById("wrongList").innerHTML = wh;
}

function filterWrong(f) { wrongFilter = f; renderWrongBook(); }

function retryWrongQ(qid) {
  switchTab(1);
  var q = QUESTIONS.find(function(x){ return x.id===qid; });
  if(q) startQuiz(q.subject, q.chapter);
}

// ===== REPORT =====
function renderReport() { drawRadar(); renderChapterRank(); renderSmartAdvice(); }

function drawRadar() {
  var canvas = document.getElementById("radarChart");
  var ctx = canvas.getContext("2d");
  var w=300,h=300,cx=150,cy=150,r=100;
  ctx.clearRect(0,0,w,h);

  var data = SUBJECTS.map(function(s){
    var t=0, c=0;
    QUESTIONS.forEach(function(q){
      if(q.subject===s.id) {
        var p = appData.progress[q.id] || {correct:0,wrong:0};
        t += (p.correct||0)+(p.wrong||0); c += (p.correct||0);
      }
    });
    return {name:s.name, icon:s.icon, rate:t>0?c/t:0};
  });

  var n = data.length;
  if(Math.max.apply(null, data.map(function(d){ return d.rate; }))===0) {
    ctx.fillStyle="#999"; ctx.font="16px sans-serif"; ctx.textAlign="center";
    ctx.fillText("需要更多数据",cx,cy); return;
  }

  for(var lvl=1;lvl<=4;lvl++) {
    ctx.beginPath();
    for(var i=0;i<n;i++) {
      var ang = -Math.PI/2 + i*2*Math.PI/n;
      var x = cx + r*lvl/4 * Math.cos(ang), y = cy + r*lvl/4 * Math.sin(ang);
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }
    ctx.closePath(); ctx.strokeStyle="#DDD"; ctx.stroke();
  }

  for(var i=0;i<n;i++) {
    var ang = -Math.PI/2 + i*2*Math.PI/n;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+r*Math.cos(ang),cy+r*Math.sin(ang));
    ctx.strokeStyle="#DDD"; ctx.stroke();
    ctx.fillStyle="#333"; ctx.font="14px sans-serif"; ctx.textAlign="center";
    ctx.fillText(data[i].icon+" "+data[i].name, cx+(r+30)*Math.cos(ang), cy+(r+30)*Math.sin(ang)+5);
  }

  ctx.beginPath();
  for(var i=0;i<n;i++) {
    var ang = -Math.PI/2 + i*2*Math.PI/n;
    var x = cx + r*data[i].rate * Math.cos(ang), y = cy + r*data[i].rate * Math.sin(ang);
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  }
  ctx.closePath(); ctx.fillStyle="rgba(139,69,19,0.25)"; ctx.fill();
  ctx.strokeStyle="#8B4513"; ctx.lineWidth=2; ctx.stroke();

  for(var i=0;i<n;i++) {
    var ang = -Math.PI/2 + i*2*Math.PI/n;
    var x = cx + r*data[i].rate * Math.cos(ang), y = cy + r*data[i].rate * Math.sin(ang);
    ctx.beginPath(); ctx.arc(x,y,5,0,2*Math.PI); ctx.fillStyle="#8B4513"; ctx.fill();
  }

  var lh = "";
  data.forEach(function(d){ lh += '<div class="flex items-center gap-8"><span>'+d.icon+'</span><span class="fs-sm">'+d.name+': '+Math.round(d.rate*100)+'%</span></div>'; });
  document.getElementById("radarLegend").innerHTML = lh;
}

function renderChapterRank() {
  var chs = [];
  for(var sid in CHAPTERS) {
    CHAPTERS[sid].forEach(function(ch){
      var t=0, c=0;
      QUESTIONS.forEach(function(q){
        if(q.subject==sid && q.chapter===ch) {
          var p = appData.progress[q.id] || {correct:0,wrong:0};
          t += (p.correct||0)+(p.wrong||0); c += (p.correct||0);
        }
      });
      if(t>0) chs.push({sid:parseInt(sid), ch:ch, rate:Math.round(c/t*100), count:t});
    });
  }
  chs.sort(function(a,b){ return a.rate-b.rate; });
  var h = "";
  chs.forEach(function(c){
    var sub = SUBJECTS.find(function(s){ return s.id===c.sid; });
    var chName = c.ch.split(" ")[1] || c.ch;
    var color = c.rate<60?"red":c.rate<80?"yellow":"green";
    h += '<div class="flex justify-between items-center" style="padding:4px 0"><span>'+sub.icon+' '+sub.name+'·'+chName+'</span><span class="tag tag-'+color+'">'+c.rate+'%</span></div>';
  });
  document.getElementById("chapterRank").innerHTML = h || '<div class="empty-state"><span class="empty-icon">📊</span>暂无数据</div>';
}

function renderSmartAdvice() {
  var weak = [];
  for(var sid in CHAPTERS) {
    CHAPTERS[sid].forEach(function(ch){
      var t=0, c=0;
      QUESTIONS.forEach(function(q){
        if(q.subject==sid && q.chapter===ch) {
          var p = appData.progress[q.id] || {correct:0,wrong:0};
          t += (p.correct||0)+(p.wrong||0); c += (p.correct||0);
        }
      });
      if(t>=3) weak.push({sid:parseInt(sid), ch:ch, rate:c/t, count:t});
    });
  }
  weak.sort(function(a,b){ return a.rate-b.rate; });
  if(weak.length===0) return;
  var top2 = weak.slice(0,2);
  var sub1 = SUBJECTS.find(function(s){ return s.id===top2[0].sid; });
  var ch1 = top2[0].ch.split(" ")[1] || top2[0].ch;
  var txt = "💡 <span>明天优先复习 <b>"+sub1.name+" · "+ch1+"</b>";
  if(top2[1]) {
    var sub2 = SUBJECTS.find(function(s){ return s.id===top2[1].sid; });
    txt += " 和 <b>"+sub2.name+" · "+(top2[1].ch.split(" ")[1]||top2[1].ch)+"</b>";
  }
  txt += "，目前正确率最低，投入时间性价比最高。</span>";
  document.getElementById("smartAdvice").innerHTML = '<div class="speed-card">'+txt+'</div>';
}

// ===== SEARCH =====
function renderSearch() {
  var h = "";
  SUBJECTS.forEach(function(s){ h += '<button class="tab" onclick="filterSearchResults('+s.id+')">'+s.icon+' '+s.name+'</button>'; });
  document.getElementById("searchSubjects").innerHTML = h;
}

function globalSearch() {
  var kw = document.getElementById("globalSearch").value.trim().toLowerCase();
  if(!kw) { document.getElementById("searchResults").innerHTML = '<div class="empty-state"><span class="empty-icon">🔎</span>输入关键词开始搜索</div>'; return; }

  var results = QUESTIONS.filter(function(q){
    return q.question.indexOf(kw)>=0 || q.keywords.indexOf(kw)>=0 || (q.options||[]).some(function(o){ return o.indexOf(kw)>=0; }) || q.analysis.indexOf(kw)>=0;
  });

  if(results.length===0) {
    document.getElementById("searchResults").innerHTML = '<div class="empty-state"><span class="empty-icon">🔍</span>没有找到相关内容</div>';
    return;
  }

  if(appData.searchHistory.indexOf(kw)<0) {
    appData.searchHistory.unshift(kw);
    if(appData.searchHistory.length>10) appData.searchHistory.pop();
    saveData(appData);
  }

  var html = "";
  SUBJECTS.forEach(function(s){
    var r = results.filter(function(q){ return q.subject===s.id; });
    if(r.length===0) return;
    html += '<div class="bold mt-12 mb-8">'+s.icon+' '+s.name+'（'+r.length+'条）</div>';
    r.forEach(function(q){
      html += '<div class="card" style="margin:8px 0;cursor:pointer" onclick="switchTab(1);startQuiz('+q.subject+',\''+q.chapter+'\')"><div class="flex gap-8 mb-4"><span class="tag tag-blue">'+q.type+'型</span><span class="tag tag-new">'+(q.is2026New?"2026新增":(q.chapter.split(" ")[1]||q.chapter))+'</span></div><div class="fs-md bold">'+q.question+'</div><div class="mt-4" style="color:var(--accent)">答案：'+q.answer+'</div></div>';
    });
  });
  document.getElementById("searchResults").innerHTML = html;
}

function filterSearchResults(sid) {}

// ===== SETTINGS =====
function renderSettings() {
  var t=0, c=0;
  for(var qid in appData.progress) {
    var p = appData.progress[qid];
    t += (p.correct||0)+(p.wrong||0); c += (p.correct||0);
  }
  document.getElementById("sTotal").textContent = t;
  document.getElementById("sRate").textContent = t>0?Math.round(c/t*100)+"%":"0%";
  document.getElementById("sStreak").textContent = appData.streak;
  document.getElementById("sDuration").textContent = Math.round((appData.totalDuration||0)/60)+"h";
  document.getElementById("dailyGoal").value = appData.settings.dailyGoal||50;
  document.getElementById("studyPhase").value = appData.settings.phase||"basic";
  document.getElementById("sceneMode").value = appData.settings.scene||"normal";
  document.getElementById("fontSize").value = appData.settings.fontSize||22;
  var size = new Blob([localStorage.getItem(getStorageKey())||""]).size;
  document.getElementById("cacheSize").textContent = "当前占用："+(size/1024).toFixed(1)+"KB";
}

function updatePhase() {
  appData.settings.phase = document.getElementById("studyPhase").value;
  saveData(appData); toast("备考阶段已切换");
}

function updateScene() {
  var scene = document.getElementById("sceneMode").value;
  appData.settings.scene = scene; saveData(appData);
  var root = document.documentElement.style;
  if(scene==="night") { root.setProperty("--bg","#1a1a2e"); root.setProperty("--card","#16213e"); root.setProperty("--text","#eee"); }
  else if(scene==="elder") { root.setProperty("--font-xl","36px"); root.setProperty("--font-lg","28px"); root.setProperty("--font-md","22px"); }
  else { root.setProperty("--bg","#F5F0E8"); root.setProperty("--card","#FFF8F0"); root.setProperty("--text","#3E2723"); root.setProperty("--font-xl","28px"); root.setProperty("--font-lg","22px"); root.setProperty("--font-md","18px"); }
  toast("场景模式已切换");
}

function updateFontSize() {
  var fs = parseInt(document.getElementById("fontSize").value);
  appData.settings.fontSize = fs; saveData(appData);
  document.documentElement.style.setProperty("--font-md",fs+"px");
  document.documentElement.style.setProperty("--font-lg",(fs+4)+"px");
  document.documentElement.style.setProperty("--font-xl",(fs+10)+"px");
  toast("字体大小已调整");
}

function clearCache() {
  if(confirm("确定要清理缓存吗？学习进度会保留。")) { appData._lastQuiz=null; saveData(appData); toast("缓存已清理"); }
}

function exportData() {
  var blob = new Blob([JSON.stringify(appData,null,2)], {type:"application/json"});
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a"); a.href=url; a.download="执业药师_学习数据.json"; a.click();
  URL.revokeObjectURL(url); toast("数据已导出");
}

// ===== AUTH SYSTEM (Supabase) =====
var authMode = "login"; // "login" or "register"
var otpStep = "send"; // "send" or "verify"

function getAuthMode() { return authMode; }

function toggleAuthMode() {
  authMode = authMode === "login" ? "register" : "login";
  var isReg = authMode === "register";
  document.getElementById("authTitle").textContent = isReg ? "注册" : "登录";
  document.getElementById("authSubtitle").textContent = isReg ? "邮箱注册，验证后设置密码" : "使用邮箱登录，数据云端同步";
  document.getElementById("authPassword2").style.display = isReg ? "block" : "none";
  document.getElementById("authUsername").style.display = isReg ? "block" : "none";
  document.getElementById("authCheckboxRow").style.display = isReg ? "none" : "flex";
  document.getElementById("authBtn").textContent = isReg ? "注 册" : "登 录";
  document.getElementById("authToggleText").innerHTML = isReg ? '已有账号？<span onclick="toggleAuthMode()">立即登录</span>' : '没有账号？<span onclick="toggleAuthMode()">立即注册</span>';
  document.getElementById("authMoreLogin").style.display = isReg ? "none" : "block";
  document.getElementById("authError").textContent = "";
  document.getElementById("authSuccess").textContent = "";
  document.getElementById("authEmail").value = "";
  document.getElementById("authPassword").value = "";
  document.getElementById("authPassword2").value = "";
  document.getElementById("authUsername").value = "";
  document.getElementById("authEmailHint").textContent = "";
  document.getElementById("authEmailHint").className = "auth-hint";
}

// Real-time email check on input in register mode
var emailCheckTimer = null;
function checkEmailExists() {
  if (authMode !== "register") return;
  var email = document.getElementById("authEmail").value.trim();
  var hint = document.getElementById("authEmailHint");
  
  if (!email) {
    hint.textContent = "";
    hint.className = "auth-hint";
    return;
  }
  
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    hint.textContent = "邮箱错误";
    hint.className = "auth-hint auth-hint-red";
    return;
  }

  hint.textContent = "检查中...";
  hint.className = "auth-hint";
  
  clearTimeout(emailCheckTimer);
  emailCheckTimer = setTimeout(async function() {
    try {
      var res = await fetch(SUPABASE_URL + "/rest/v1/rpc/check_email_exists", {
        method: "POST",
        headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email_param: email })
      });
      if (res.ok) {
        var exists = await res.json();
        if (exists === true) {
          hint.textContent = "该邮箱已被注册";
          hint.className = "auth-hint auth-hint-red";
        } else {
          hint.textContent = "该邮箱允许注册";
          hint.className = "auth-hint auth-hint-green";
        }
      } else {
        hint.textContent = "";
        hint.className = "auth-hint";
      }
    } catch(e) {
      hint.textContent = "";
      hint.className = "auth-hint";
    }
  }, 400);
}

function showForgotPassword() {
  document.getElementById("authNormal").style.display = "none";
  document.getElementById("authOtp").style.display = "none";
  document.getElementById("authForgot").style.display = "block";
  document.getElementById("authForgotEmail").value = document.getElementById("authEmail").value;
  document.getElementById("authForgotError").textContent = "";
  document.getElementById("authForgotSuccess").textContent = "";
  document.getElementById("authForgotNewPwd").style.display = "none";
  document.getElementById("authForgotBtn").textContent = "发送重置邮件";
}

function showOtpLogin() {
  document.getElementById("authNormal").style.display = "none";
  document.getElementById("authOtp").style.display = "block";
  document.getElementById("authForgot").style.display = "none";
  document.getElementById("authOtpEmail").value = document.getElementById("authEmail").value;
  document.getElementById("authOtpError").textContent = "";
  document.getElementById("authOtpSuccess").textContent = "";
  document.getElementById("authOtpCodeRow").style.display = "none";
  document.getElementById("authOtpBtn").textContent = "发送验证码";
  otpStep = "send";
}

function backToNormalAuth() {
  document.getElementById("authNormal").style.display = "block";
  document.getElementById("authOtp").style.display = "none";
  document.getElementById("authForgot").style.display = "none";
  document.getElementById("authError").textContent = "";
  document.getElementById("authSuccess").textContent = "";
  document.getElementById("authMoreLoginList").style.display = "none";
}

function toggleMoreLogin() {
  var list = document.getElementById("authMoreLoginList");
  list.style.display = list.style.display === "none" ? "block" : "none";
}

function setLoading(loading) {
  var btn = document.getElementById("authBtn");
  if (loading) {
    btn.disabled = true;
    btn.innerHTML = '<span class="auth-loading"></span>处理中...';
  } else {
    btn.disabled = false;
    btn.textContent = authMode === "register" ? "注 册" : "登 录";
  }
}

async function doAuth() {
  var email = document.getElementById("authEmail").value.trim();
  var password = document.getElementById("authPassword").value;
  var errEl = document.getElementById("authError");
  var sucEl = document.getElementById("authSuccess");
  errEl.textContent = "";
  sucEl.textContent = "";

  if (!email || !password) { errEl.textContent = "请填写邮箱和密码"; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = "请输入有效的邮箱地址"; return; }
  if (password.length < 6) { errEl.textContent = "密码至少6个字符"; return; }

  setLoading(true);

  try {
    if (authMode === "register") {
      var password2 = document.getElementById("authPassword2").value;
      if (password !== password2) { errEl.textContent = "两次密码不一致"; setLoading(false); return; }
      var username = document.getElementById("authUsername").value.trim();
      if (!username) { errEl.textContent = "请设置用户名"; setLoading(false); return; }
      if (username.length < 2 || username.length > 20) { errEl.textContent = "用户名需2-20个字符"; setLoading(false); return; }

      var { data: existing } = await supabase.from("profiles").select("username").eq("username", username).maybeSingle();
      if (existing) { errEl.textContent = "该用户名已被占用"; setLoading(false); return; }

      // Pre-check: email already registered?
      var resCheck = await fetch(SUPABASE_URL + "/rest/v1/rpc/check_email_exists", {
        method: "POST",
        headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email_param: email })
      });
      if (resCheck.ok) {
        var emailExists = await resCheck.json();
        if (emailExists === true) {
          errEl.textContent = "该邮箱已被注册，请直接登录或使用其他邮箱";
          setLoading(false);
          return;
        }
      }

      var { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: { data: { username: username } }
      });

      if (error) {
        errEl.textContent = error.message;
        setLoading(false);
        return;
      }

      sucEl.textContent = "注册成功！请查看邮箱 " + email + " 中的验证邮件，点击链接激活账号后即可登录。";
      document.getElementById("authPassword2").value = "";
      document.getElementById("authUsername").value = "";
      document.getElementById("authPassword").value = "";

    } else {
      var remember = document.getElementById("authRemember").checked;
      var autoLogin = document.getElementById("authAutoLogin").checked;

      if (remember) {
        localStorage.setItem("yspx_remembered_email", email);
      } else {
        localStorage.removeItem("yspx_remembered_email");
      }

      var { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        errEl.textContent = error.message;
        setLoading(false);
        return;
      }

      if (data.user) {
        localStorage.setItem("yspx_current_user", data.user.id);
        if (autoLogin) {
          localStorage.setItem("yspx_auto_login", "1");
        } else {
          localStorage.removeItem("yspx_auto_login");
        }
        showApp();
        return;
      }
    }
  } catch(e) {
    errEl.textContent = "网络错误，请检查网络连接后重试";
    console.error(e);
  }
  setLoading(false);
}

// ===== Profile =====asyncasyncasync// ===== Handle Supabase auth callback (email verification, password reset etc) =====
async function handleAuthCallback() {
  var hash = location.hash;
  if (!hash || !hash.includes("access_token=")) return false;
  try {
    var params = new URLSearchParams(hash.substring(1));
    var access_token = params.get("access_token");
    var refresh_token = params.get("refresh_token");
    var expires_in = parseInt(params.get("expires_in")) || 3600;
    if (!access_token) return false;

    // Fetch user info from Supabase
    var userRes = await fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + access_token }
    });
    if (!userRes.ok) return false;
    var user = await userRes.json();
    if (!user.id) return false;

    // Save session
    localStorage.setItem("yspx_supabase_session", JSON.stringify({
      access_token: access_token,
      refresh_token: refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + expires_in,
      user: user
    }));
    localStorage.setItem("yspx_current_user", user.id);

    // Clean URL
    history.replaceState(null, "", location.pathname);
    
    // If this was a password recovery callback, show new password form
    var type = params.get("type");
    if (type === "recovery") {
      document.getElementById("page-auth").style.display = "flex";
      document.querySelectorAll(".page:not(#page-auth)").forEach(function(p){ p.style.display = "none"; });
      document.getElementById("authNormal").style.display = "none";
      document.getElementById("authOtp").style.display = "none";
      document.getElementById("authForgot").style.display = "block";
      document.getElementById("authForgotNewPwd").style.display = "block";
      document.getElementById("authForgotBtn").textContent = "设置新密码";
      document.getElementById("authForgotEmail").value = user.email || "";
      document.getElementById("authForgotEmail").disabled = true;
      document.getElementById("authForgotError").textContent = "";
      document.getElementById("authForgotSuccess").textContent = "请设置您的新密码";
    }
    
      // Redirect to password reset page for recovery flow
      var _params = new URLSearchParams(location.hash.substring(1));
      var _type = _params.get("type");
      if (_type === "recovery") {
        setTimeout(function() { navTo("page-otp-reset"); }, 100);
        return true;
      }
return true;
  } catch (e) {
    console.error("Auth callback error:", e);
    return false;
  }
}

async function checkAuth() {
  // Check for auto-login session
  var { data } = await supabase.auth.getSession();
  if (data.session) {
    localStorage.setItem("yspx_current_user", data.session.user.id);
    showApp();
    return;
  }

  // Check if auto-login was previously enabled
  var autoLogin = localStorage.getItem("yspx_auto_login");
  if (autoLogin === "1") {
    // Try to refresh session
    var { data: refreshData } = await supabase.auth.refreshSession();
    if (refreshData.session) {
      localStorage.setItem("yspx_current_user", refreshData.session.user.id);
      showApp();
      return;
    }
  }

  // Show auth page
  document.getElementById("page-auth").style.display = "flex";
  document.querySelectorAll(".page:not(#page-auth)").forEach(function(p){ p.style.display = "none"; });

  // Restore remembered email
  var rememberedEmail = localStorage.getItem("yspx_remembered_email");
  if (rememberedEmail) {
    document.getElementById("authEmail").value = rememberedEmail;
  }
}

// ===== INIT =====
async function startApp() {
  var handled = await handleAuthCallback();
  if (!handled) checkAuth();
}

function initApp() {
  updateCountdown();
  setInterval(updateCountdown, 60000);
  renderHome();

  var fs = appData.settings.fontSize||22;
  document.documentElement.style.setProperty("--font-md",fs+"px");
  document.documentElement.style.setProperty("--font-lg",(fs+4)+"px");
  document.documentElement.style.setProperty("--font-xl",(fs+10)+"px");
}

if("serviceWorker" in navigator) {
  navigator.serviceWorker.register("data:application/javascript," + encodeURIComponent("var C='yspx-v2';self.addEventListener('install',function(e){e.waitUntil(caches.open(C).then(function(c){return c.addAll(['.'])}));self.skipWaiting()});self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(x){return x!==C}).map(function(x){return caches.delete(x)}))}));self.clients.claim()});self.addEventListener('fetch',function(e){e.respondWith(caches.match(e.request).then(function(r){return r||fetch(e.request).then(function(resp){var cl=resp.clone();caches.open(C).then(function(c){return c.put(e.request,cl)});return resp})}))});"));
}