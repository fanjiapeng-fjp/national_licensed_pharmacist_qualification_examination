// ===== CHAPTER STUDY =====
function renderStudyTabs() {
  var h = "";
  SUBJECTS.forEach(function(s){
    h += '<button class="tab'+(currentSubject===s.id?" active":"")+'" onclick="setStudySubject('+s.id+')">'+s.icon+' '+s.name+'</button>';
  });
  document.getElementById("studySubjects").innerHTML = h;
  renderChapters();
}

function setStudySubject(sid) { currentSubject = sid; renderStudyTabs(); }
function setBankMode(mode) {
  bankMode = mode;
  document.getElementById('bankAllBtn').style.background = mode === 'all' ? 'var(--accent)' : '';
  document.getElementById('bankAllBtn').style.color = mode === 'all' ? '#fff' : '';
  document.getElementById('bankCoreBtn').style.background = mode === 'core' ? 'var(--accent)' : '';
  document.getElementById('bankCoreBtn').style.color = mode === 'core' ? '#fff' : '';
  renderChapters();
}

function renderChapters(filter) {
  filter = filter || "";
  var chs = CHAPTERS[currentSubject] || [];
  var html = "";
  chs.forEach(function(ch){
    var chapterQs = QUESTIONS.filter(function(q){ return q.subject===currentSubject && q.chapter===ch; });
    if(bankMode === 'core') chapterQs = chapterQs.filter(function(q){ return q.core === true; });
    var qCount = chapterQs.length;
    if(qCount === 0) return;
    var cq=0, cc=0;
    chapterQs.forEach(function(q){
      var p = appData.progress[q.id] || {correct:0,wrong:0};
      cq += (p.correct||0)+(p.wrong||0);
      cc += (p.correct||0);
    });
    var rate = cq>0 ? Math.round(cc/cq*100) : 0;
    var color = cq===0 ? "" : rate<60 ? "red" : rate<80 ? "yellow" : "green";
    if(filter && ch.indexOf(filter)<0) return;
    html += '<div class="chapter-row" onclick="startQuiz('+currentSubject+',\''+ch+'\')"><span class="tag'+(color?" tag-"+color:"")+'">'+(color?rate+"%":"NEW")+'</span><div class="chapter-info"><div class="chapter-name">'+ch+'</div><div class="chapter-meta">'+cq+'/'+qCount+'题</div></div><div class="progress-bar" style="width:60px"><div class="progress-fill" style="width:'+rate+'%;background:'+(color?'var(--'+color+')':'#CCC')+'"></div></div></div>';
  });
  document.getElementById("chapterList").innerHTML = html || '<div class="empty-state"><span class="empty-icon">📖</span>暂无匹配章节</div>';
}

function filterChapters() { renderChapters(document.getElementById("studySearch").value); }

// ===== QUIZ =====
var quizState = null;

function startQuiz(sid, chapter) {
  var chQs = QUESTIONS.filter(function(q){ return q.subject===sid && q.chapter===chapter; });
  if(bankMode === 'core') chQs = chQs.filter(function(q){ return q.core === true; });
  if(chQs.length===0) { toast("该章节暂无题目"); return; }
  quizState = { subject: sid, chapter: chapter, questions: chQs, currentIdx: 0, answered: false };
  appData._lastQuiz = {subject:sid, chapter:chapter};
  saveData(appData);
  pages.forEach(function(p){ document.getElementById(p).classList.remove("active"); });
  document.getElementById("page-quiz").classList.add("active");
  renderQuizQuestion();
}

function closeQuiz() {
  pages.forEach(function(p){ document.getElementById(p).classList.remove("active"); });
  document.getElementById(pages[currentTab]).classList.add("active");
  if(currentTab===0) renderHome();
  if(currentTab===1) renderChapters();
}

function renderQuizQuestion() {
  var q = quizState.questions[quizState.currentIdx];
  quizState.answered = false;
  document.getElementById("quizProgress").textContent = (quizState.currentIdx+1)+"/"+quizState.questions.length;
  document.getElementById("quizChapter").textContent = q.chapter;
  document.getElementById("quizTypeTag").textContent = "ABCD"["ABCX".indexOf(q.type)] + "型题";
  document.getElementById("quizQuestion").textContent = q.question;
  var optHTML = "";
  q.options.forEach(function(opt, i){
    optHTML += '<button class="option-item" onclick="answerQuiz('+i+')" data-idx="'+i+'">'+String.fromCharCode(65+i)+'. '+opt+'</button>';
  });
  document.getElementById("quizOptions").innerHTML = optHTML;
  var tips = q.tips || "";
  if (!tips) {
    document.getElementById("quizTipBtn").disabled = true;
    document.getElementById("quizTipBtn").textContent = "💡 暂无提示";
  } else {
    document.getElementById("quizTipBtn").disabled = false;
    document.getElementById("quizTipBtn").textContent = "💡 查看提示";
  }
  document.getElementById("quizTipContent").textContent = tips || "暂无提示";
  document.getElementById("quizTipContent").style.display = "none";
  document.getElementById("quizAnalysis").style.display = "none";
  document.getElementById("quizNextBtn").style.display = "none";
}

function answerQuiz(choiceIdx) {
  if(quizState.answered) return;
  quizState.answered = true;
  var q = quizState.questions[quizState.currentIdx];
  var correctIdx = q.answer.charCodeAt(0) - 65;
  var isCorrect = choiceIdx === correctIdx;

  if(!appData.progress[q.id]) appData.progress[q.id] = {correct:0,wrong:0,lastTime:0};
  appData.progress[q.id][isCorrect?"correct":"wrong"]++;
  appData.progress[q.id].lastTime = Date.now();

  if(!isCorrect) {
    if(!appData.wrongBook[q.id]) appData.wrongBook[q.id] = {consecutive:0,mastered:false,source:"study"};
    appData.wrongBook[q.id].consecutive = 0;
    appData.wrongBook[q.id].mastered = false;
  } else {
    if(appData.wrongBook[q.id]) {
      appData.wrongBook[q.id].consecutive++;
      if(appData.wrongBook[q.id].consecutive >= 3) appData.wrongBook[q.id].mastered = true;
    }
  }

  var today = new Date().toISOString().split("T")[0];
  appData.daily[today] = (appData.daily[today]||0) + 1;
  if(appData.lastStudyDate !== today) {
    var yesterday = new Date(Date.now()-86400000).toISOString().split("T")[0];
    appData.streak = (appData.lastStudyDate===yesterday) ? appData.streak+1 : 1;
    appData.lastStudyDate = today;
  }
  saveData(appData);

  var opts = document.querySelectorAll("#quizOptions .option-item");
  opts.forEach(function(btn,i){
    btn.disabled = true;
    if(i===correctIdx) btn.classList.add("correct");
    if(i===choiceIdx && !isCorrect) btn.classList.add("wrong");
  });

  document.getElementById("quizAnswer").textContent = q.answer + ". " + q.options[correctIdx];
  document.getElementById("quizAnalysisText").textContent = q.analysis;
  document.getElementById("quizTips").textContent = q.tips;
  document.getElementById("quizMemory").textContent = q.memory;
  document.getElementById("quizAnalysis").style.display = "block";
  var nb = document.getElementById("quizNextBtn");
  nb.style.display = "block";
  nb.textContent = quizState.currentIdx < quizState.questions.length-1 ? "下一题 →" : "完成 ✅";
}


function toggleQuizTip() {
  var content = document.getElementById("quizTipContent");
  var btn = document.getElementById("quizTipBtn");
  if (content.style.display === "none") {
    content.style.display = "block";
    btn.textContent = "💡 隐藏提示";
  } else {
    content.style.display = "none";
    btn.textContent = "💡 查看提示";
  }
}

function toggleExamTip() {
  var content = document.getElementById("examTipContent");
  var btn = document.getElementById("examTipBtn");
  if (content.style.display === "none") {
    content.style.display = "block";
    btn.textContent = "💡 隐藏提示";
  } else {
    content.style.display = "none";
    btn.textContent = "💡 查看提示";
  }
}

function nextQuestion() {
  if(quizState.currentIdx < quizState.questions.length-1) {
    quizState.currentIdx++;
    renderQuizQuestion();
    document.getElementById("page-quiz").scrollTo(0,0);
  } else {
    toast("本章节已完成！");
    closeQuiz();
    renderChapters();
  }
}

// ===== EXAM =====
var examState = null;

function renderExam() {
  var records = appData.examRecords || [];
  if(records.length===0) {
    document.getElementById("examRecords").innerHTML = '<div class="empty-state"><span class="empty-icon">📊</span>暂无记录</div>';
  } else {
    var h = "";
    records.slice(-5).reverse().forEach(function(r,i){
      var label = r.label || ("模拟考试 #"+(records.length-i));
      var scoreText = r.totalQ ? (r.score+"/"+r.totalQ) : (r.score+"分");
      h += '<div class="chapter-row"><span class="tag'+(r.rate>=60?" tag-green":" tag-red")+'">'+r.rate+'%</span><div class="chapter-info"><div class="chapter-name">'+label+'</div><div class="chapter-meta">'+r.date+' · '+scoreText+'</div></div></div>';
    });
    document.getElementById("examRecords").innerHTML = h;
  }
}

function startExam(subjectId) {
  // subjectId: 0/null = all subjects, 1=药一, 2=药二, 3=药综, 4=法规
  var pool;
  var totalQ, duration, examLabel;
  if (!subjectId || subjectId === 0) {
    pool = QUESTIONS.slice();
    totalQ = 120;
    duration = 150 * 60;
    examLabel = "全科综合模拟";
  } else {
    pool = QUESTIONS.filter(function(q){ return q.subject === subjectId; });
    totalQ = Math.min(pool.length, 40);
    duration = 60 * 60;
    var subNames = {1:"药一 专项模拟", 2:"药二 专项模拟", 3:"药综 专项模拟", 4:"法规 专项模拟"};
    examLabel = subNames[subjectId] || "单科模拟";
  }
  if (pool.length < totalQ) totalQ = pool.length;
  if (totalQ === 0) { toast("该科目暂无题目"); return; }
  var shuffled = pool.slice().sort(function(){ return Math.random()-0.5; }).slice(0, totalQ);
  examState = { questions: shuffled, currentIdx: 0, answers: new Array(totalQ).fill(null), startTime: Date.now(), duration: duration, timer: null, subjectId: subjectId, examLabel: examLabel, totalQ: totalQ };
  pages.forEach(function(p){ document.getElementById(p).classList.remove("active"); });
  document.getElementById("page-exam-running").classList.add("active");
  examState.timer = setInterval(updateExamTimer, 1000);
  renderExamQuestion();
}

function updateExamTimer() {
  var elapsed = Math.floor((Date.now() - examState.startTime)/1000);
  var remaining = Math.max(0, examState.duration - elapsed);
  var mins = Math.floor(remaining/60), secs = remaining%60;
  document.getElementById("examTimer").textContent = String(mins).padStart(2,"0")+":"+String(secs).padStart(2,"0");
  if(remaining<=0) submitExam();
}

function renderExamQuestion() {
  var q = examState.questions[examState.currentIdx];
  document.getElementById("examQType").textContent = "ABCD"["ABCX".indexOf(q.type)] + "型题";
  document.getElementById("examQuestion").textContent = q.question;
  document.getElementById("examProgress").textContent = (examState.currentIdx+1)+"/"+examState.totalQ;
  var h = "";
  q.options.forEach(function(opt,i){
    h += '<button class="option-item'+(examState.answers[examState.currentIdx]===i?" correct":"")+'" onclick="examAnswer('+i+')">'+String.fromCharCode(65+i)+'. '+opt+'</button>';
  });
  document.getElementById("examOptions").innerHTML = h;
  var etips = q.tips || "";
  if (!etips) {
    document.getElementById("examTipBtn").disabled = true;
    document.getElementById("examTipBtn").textContent = "💡 暂无提示";
  } else {
    document.getElementById("examTipBtn").disabled = false;
    document.getElementById("examTipBtn").textContent = "💡 查看提示";
  }
  document.getElementById("examTipContent").textContent = etips || "暂无提示";
  document.getElementById("examTipContent").style.display = "none";
}

function examAnswer(i) { examState.answers[examState.currentIdx] = i; renderExamQuestion(); setTimeout(function(){ examNextQ(); }, 300); }
function examNextQ() { if(examState.currentIdx<examState.totalQ-1) { examState.currentIdx++; renderExamQuestion(); } }
function examPrev() { if(examState.currentIdx>0) { examState.currentIdx--; renderExamQuestion(); } }

function submitExam() {
  if(!confirm("确定要交卷吗？交卷后无法修改。")) return;
  clearInterval(examState.timer);
  var score=0, correct=0;
  var subScores = {1:{c:0,t:0},2:{c:0,t:0},3:{c:0,t:0},4:{c:0,t:0}};
  examState.questions.forEach(function(q,i){
    var ca = q.answer.charCodeAt(0)-65;
    subScores[q.subject].t++;
    if(examState.answers[i]===ca) {
      score++; correct++;
      subScores[q.subject].c++;
      if(appData.wrongBook[q.id]) {
        appData.wrongBook[q.id].consecutive++;
        if(appData.wrongBook[q.id].consecutive>=3) appData.wrongBook[q.id].mastered = true;
      }
    } else {
      if(!appData.wrongBook[q.id]) appData.wrongBook[q.id] = {consecutive:0,mastered:false,source:"exam"};
      else if(appData.wrongBook[q.id].mastered) { appData.wrongBook[q.id].consecutive=0; appData.wrongBook[q.id].mastered=false; }
    }
  });
  var rate = Math.round(correct/100*100);
  var record = { date: new Date().toISOString().split("T")[0], score:score, rate:rate };
  appData.examRecords.push(record);
  appData.totalDuration = (appData.totalDuration||0) + Math.floor((Date.now()-examState.startTime)/60000);
  saveData(appData);

  pages.forEach(function(p){ document.getElementById(p).classList.remove("active"); });
  document.getElementById("page-exam-result").classList.add("active");
  document.getElementById("examScore").textContent = score;
  document.getElementById("examRate").textContent = rate+"%";
  var sh = "";
  SUBJECTS.forEach(function(s){
    var ss = subScores[s.id];
    sh += '<div class="chapter-row"><span>'+s.icon+'</span><div class="chapter-info">'+s.name+'</div><span class="bold">'+ss.c+'/'+ss.t+'</span></div>';
  });
  document.getElementById("examSubjectScores").innerHTML = sh;
  examState = null;
  setTimeout(function(){ toast("错题已自动归入错题合集"); }, 500);
}