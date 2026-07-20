// ===== DATA LOADER =====
var QUESTIONS = [];
var CHAPTERS = {};
var SUBJECTS = [];

async function loadData() {
    try {
        var [questions, chapters, subjects] = await Promise.all([
            fetch('data/questions.json?v=2').then(function(r){ return r.json(); }),
            fetch('data/chapters.json?v=2').then(function(r){ return r.json(); }),
            fetch('data/subjects.json?v=2').then(function(r){ return r.json(); })
        ]);
        QUESTIONS = questions;
        CHAPTERS = chapters;
        SUBJECTS = subjects;
        console.log('Data loaded: ' + QUESTIONS.length + ' questions, ' + 
            Object.values(CHAPTERS).reduce(function(a,b){return a+b.length;},0) + ' chapters');
        startApp();
    } catch(e) {
        console.error('Failed to load data:', e);
        document.getElementById('app').innerHTML = '<div style="text-align:center;padding:60px 20px"><h2>数据加载失败</h2><p>请检查网络连接后刷新页面</p><button onclick="location.reload()" class="btn btn-primary mt-16">重新加载</button></div>';
    }
}
