let allQuestions = [];
let filteredQuestions = [];
let categories = [];
let currentCategory = '全部';
let currentView = 'browse';
let wrongQuestions = JSON.parse(localStorage.getItem('wrongQuestions') || '[]');

let quizState = {
    active: false,
    questions: [],
    index: 0,
    answers: {},
    timer: null,
    timeLeft: 0
};

const dom = {
    pageTitle: document.getElementById('pageTitle'),
    questionList: document.getElementById('questionList'),
    categoryGrid: document.getElementById('categoryGrid'),
    activeCategoryName: document.getElementById('activeCategoryName'),
    navItems: document.querySelectorAll('.nav-item'),
    views: {
        browse: document.getElementById('viewBrowse'),
        categories: document.getElementById('viewCategories'),
        wrong: document.getElementById('viewWrong'),
        quiz: document.getElementById('viewQuiz')
    },
    wrongList: document.getElementById('wrongList'),
    wrongEmpty: document.getElementById('wrongEmpty'),
    quizWelcome: document.getElementById('quizWelcomePanel'),
    quizContainer: document.getElementById('quizContainer'),
    quizReport: document.getElementById('quizReport'),
    reportSummary: document.getElementById('reportSummary'),
    reportList: document.getElementById('reportList'),
    quizActions: document.getElementById('quizActions'),
    startQuiz: document.getElementById('startQuiz'),
    quizQuestion: document.getElementById('quizQuestion'),
    quizProgress: document.getElementById('quizProgress'),
    quizTimer: document.getElementById('quizTimer'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    submitQuiz: document.getElementById('submitQuiz'),
    backFromReport: document.getElementById('backFromReport')
};

async function init() {
    try {
        const res = await fetch('data.json');
        if (!res.ok) throw new Error('Data load failed');
        allQuestions = await res.json();

        categories = [...new Set(allQuestions.map(q => q.category))].sort((a, b) => {
            const numA = parseInt(a.match(/^(\d+)/)?.[1] || 0);
            const numB = parseInt(b.match(/^(\d+)/)?.[1] || 0);
            return numA - numB;
        });

        renderCategoryGrid();
        renderWrongList();
        applyFilters();
        bindEvents();
    } catch (err) {
        console.error(err);
    }
}

function bindEvents() {
    dom.navItems.forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view));
    });

    dom.startQuiz.addEventListener('click', startQuiz);
    dom.prevBtn.addEventListener('click', () => navigateQuiz(-1));
    dom.nextBtn.addEventListener('click', () => navigateQuiz(1));
    dom.submitQuiz.addEventListener('click', finishQuiz);
    dom.backFromReport.addEventListener('click', () => {
        dom.quizReport.classList.add('hidden');
        document.getElementById('quizWelcomePanel').classList.remove('hidden');
    });
}

function switchView(viewId) {
    currentView = viewId;
    dom.navItems.forEach(item => item.classList.toggle('active', item.dataset.view === viewId));
    Object.keys(dom.views).forEach(k => dom.views[k].classList.toggle('hidden', k !== viewId));

    // Hide fixed actions unless in active quiz mode
    dom.quizActions.classList.add('hidden');
    if (viewId === 'quiz' && quizState.active) dom.quizActions.classList.remove('hidden');

    const titles = { browse: '题库浏览', categories: '科目分类', quiz: '模拟真考', wrong: '错题集合库' };
    dom.pageTitle.textContent = titles[viewId];

    if (viewId === 'wrong') renderWrongList();
}

function renderCategoryGrid() {
    dom.categoryGrid.innerHTML = `<div class="cat-item" data-cat="全部"><span>全部题目</span><span class="count">${allQuestions.length}</span></div>`;
    categories.forEach(cat => {
        const count = allQuestions.filter(q => q.category === cat).length;
        dom.categoryGrid.innerHTML += `<div class="cat-item" data-cat="${cat}"><span class="name">${cat}</span><span class="count">${count}</span></div>`;
    });
    dom.categoryGrid.querySelectorAll('.cat-item').forEach(item => {
        item.addEventListener('click', () => {
            currentCategory = item.dataset.cat;
            dom.activeCategoryName.textContent = currentCategory;
            switchView('browse');
            applyFilters();
            window.scrollTo(0, 0);
        });
    });
}

function renderWrongList() {
    dom.wrongList.innerHTML = '';
    dom.wrongEmpty.classList.toggle('hidden', wrongQuestions.length > 0);

    wrongQuestions.forEach((q, idx) => {
        const div = document.createElement('div');
        div.className = 'question-card';
        div.innerHTML = `
            <div class="q-meta">
                <span class="q-type">${q.type}</span>
                <button class="remove-btn" data-idx="${idx}">移除</button>
            </div>
            <div class="q-text">${q.question}</div>
            <div class="options-list">
                ${q.options.map(o => `<div class="option"><strong>${o.key}.</strong> ${o.text}</div>`).join('')}
            </div>
            <div class="answer-panel">正确答案：${q.answer}</div>
        `;
        div.querySelector('.remove-btn').addEventListener('click', () => {
            wrongQuestions.splice(idx, 1);
            saveWrongs();
            renderWrongList();
        });
        dom.wrongList.appendChild(div);
    });
}

function saveWrongs() {
    localStorage.setItem('wrongQuestions', JSON.stringify(wrongQuestions));
}

let displayLimit = 50;
function renderQuestionList(append = false) {
    if (!append) { dom.questionList.innerHTML = ''; displayLimit = 50; }
    const slice = filteredQuestions.slice(displayLimit - 50, displayLimit);
    slice.forEach((q, index) => {
        const realIndex = (displayLimit - 50) + index + 1;
        const div = document.createElement('div');
        div.className = 'question-card';
        div.innerHTML = `<div class="q-meta"><span class="q-index">#${realIndex}</span><span class="q-type">${q.type}</span></div>
            <div class="q-text">${q.question}</div>
            <div class="options-list">${q.options.map(opt => `<div class="option" data-key="${opt.key}"><strong>${opt.key}.</strong> ${opt.text}</div>`).join('')}</div>
            <button class="q-reveal-btn">显示答案</button><div class="answer-panel hidden">正确答案：${q.answer}</div>`;
        div.querySelector('.q-reveal-btn').addEventListener('click', (e) => {
            const panel = div.querySelector('.answer-panel');
            const isHidden = panel.classList.toggle('hidden');
            e.target.textContent = isHidden ? '显示答案' : '隐藏答案';
        });
        dom.questionList.appendChild(div);
    });
    const oldLoader = document.getElementById('loadMoreBtn');
    if (oldLoader) oldLoader.remove();
    if (filteredQuestions.length > displayLimit) {
        const btn = document.createElement('button');
        btn.id = 'loadMoreBtn'; btn.className = 'btn-text'; btn.style.width = '100%'; btn.style.padding = '2rem';
        btn.textContent = `点击加载更多 (剩余 ${filteredQuestions.length - displayLimit} 题)...`;
        btn.addEventListener('click', () => { displayLimit += 50; renderQuestionList(true); });
        dom.questionList.appendChild(btn);
    }
}

function applyFilters() {
    filteredQuestions = allQuestions.filter(q => {
        return currentCategory === '全部' || q.category === currentCategory;
    });
    renderQuestionList();
}

function startQuiz() {
    quizState.active = true;

    // 按比例抽题
    const single = allQuestions.filter(q => q.type === '单选题').sort(() => Math.random() - 0.5).slice(0, 40);
    const judge = allQuestions.filter(q => q.type === '判断题').sort(() => Math.random() - 0.5).slice(0, 20);
    const multi = allQuestions.filter(q => q.type === '多选题').sort(() => Math.random() - 0.5).slice(0, 20);

    // 按顺序合并：单选 -> 判断 -> 多选 (不再全量乱序)
    quizState.questions = [...single, ...judge, ...multi];
    quizState.index = 0;
    quizState.answers = {};
    quizState.timeLeft = 45 * 60;

    // 确保隐藏欢迎界面，显示题目区
    const welcome = document.getElementById('quizWelcomePanel');
    if (welcome) welcome.classList.add('hidden');
    dom.quizContainer.classList.remove('hidden');
    dom.quizActions.classList.remove('hidden');
    dom.quizReport.classList.add('hidden');

    if (quizState.timer) clearInterval(quizState.timer);
    quizState.timer = setInterval(() => {
        quizState.timeLeft--;
        const m = Math.floor(quizState.timeLeft / 60);
        const s = quizState.timeLeft % 60;
        dom.quizTimer.textContent = `${m}:${s.toString().padStart(2, '0')}`;
        if (quizState.timeLeft <= 0) finishQuiz();
    }, 1000);

    renderQuizQuestion();
}

function renderQuizQuestion() {
    const q = quizState.questions[quizState.index];
    const total = quizState.questions.length;
    dom.quizProgress.textContent = `${quizState.index + 1} / ${total}`;

    dom.quizQuestion.innerHTML = `<div class="question-card" style="margin-bottom:0"><span class="q-type">${q.type}</span><div class="q-text">${q.question}</div>
        <div class="options-list">${q.options.map(opt => {
        const sel = (quizState.answers[quizState.index] || '').includes(opt.key);
        return `<div class="option ${sel ? 'selected' : ''}" data-key="${opt.key}"><strong>${opt.key}.</strong> ${opt.text}</div>`;
    }).join('')}</div></div>`;

    dom.quizQuestion.querySelectorAll('.option').forEach(el => {
        el.addEventListener('click', () => {
            const key = el.dataset.key;
            if (q.type === '多选题') {
                let cur = quizState.answers[quizState.index] || '';
                cur = cur.includes(key) ? cur.replace(key, '') : (cur + key).split('').sort().join('');
                quizState.answers[quizState.index] = cur;
            } else { quizState.answers[quizState.index] = key; }
            renderQuizQuestion();
        });
    });

    dom.prevBtn.classList.toggle('hidden', quizState.index === 0);
    dom.nextBtn.classList.toggle('hidden', quizState.index === total - 1);
    dom.submitQuiz.classList.toggle('hidden', quizState.index !== total - 1);
}

function navigateQuiz(dir) { quizState.index += dir; renderQuizQuestion(); }

function finishQuiz() {
    quizState.active = false;
    clearInterval(quizState.timer);
    dom.quizContainer.classList.add('hidden');
    dom.quizActions.classList.add('hidden');
    dom.quizReport.classList.remove('hidden');

    let correctCount = 0;
    const total = quizState.questions.length;
    dom.reportList.innerHTML = '';

    quizState.questions.forEach((q, i) => {
        const uAns = quizState.answers[i] || '未作答';
        const isCorrect = uAns === q.answer;
        if (isCorrect) correctCount++;
        else {
            // Add to persistent wrong bank if not exists
            if (!wrongQuestions.some(wq => wq.question === q.question)) {
                wrongQuestions.push(q);
                saveWrongs();
            }
        }

        const div = document.createElement('div');
        div.className = 'question-card px-0';
        div.innerHTML = `
            <div class="q-meta">
                <span class="res-tag ${isCorrect ? 'correct' : 'wrong'}">${isCorrect ? '正确' : '错误'}</span>
                <span class="q-type">${q.type}</span>
            </div>
            <div class="q-text">${q.question}</div>
            <div style="font-size: 0.9rem; margin-top: 1rem;">
                <p style="color: ${isCorrect ? '#22c55e' : '#ef4444'}">你的答案：${uAns}</p>
                <p style="color: #22c55e">正确答案：${q.answer}</p>
            </div>
        `;
        dom.reportList.appendChild(div);
    });

    const score = Math.round((correctCount / total) * 100);
    dom.reportSummary.innerHTML = `
        <div style="text-align:center; padding: 2rem;">
            <div style="font-size: 4rem; font-weight: 700; color: var(--accent);">${score}分</div>
            <p style="color: var(--text-dim);">答对 ${correctCount} / ${total} 题</p>
        </div>
    `;
}

init();
