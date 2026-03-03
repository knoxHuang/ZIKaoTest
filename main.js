let allQuestions = [];
let filteredQuestions = [];
let categories = [];
let currentCategory = '全部';
let currentView = 'browse';

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
    searchToggle: document.getElementById('searchToggle'),
    searchBar: document.getElementById('searchBar'),
    searchInput: document.getElementById('全局搜索'),
    questionList: document.getElementById('questionList'),
    categoryGrid: document.getElementById('categoryGrid'),
    activeCategoryName: document.getElementById('activeCategoryName'),
    navItems: document.querySelectorAll('.nav-item'),
    views: {
        browse: document.getElementById('viewBrowse'),
        categories: document.getElementById('viewCategories'),
        quiz: document.getElementById('viewQuiz')
    },
    quizWelcome: document.querySelector('.quiz-welcome'),
    quizContainer: document.getElementById('quizContainer'),
    startQuiz: document.getElementById('startQuiz'),
    quizQuestion: document.getElementById('quizQuestion'),
    quizProgress: document.getElementById('quizProgress'),
    quizTimer: document.getElementById('quizTimer'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    submitQuiz: document.getElementById('submitQuiz')
};

async function init() {
    try {
        // 使用相对当前路径的相对地址，确保在 GitHub Pages 二级目录下也能运行
        const res = await fetch('data.json');
        if (!res.ok) throw new Error('Data load failed');
        allQuestions = await res.json();

        categories = [...new Set(allQuestions.map(q => q.category))].sort((a, b) => {
            const numA = parseInt(a.match(/^(\d+)/)?.[1] || 0);
            const numB = parseInt(b.match(/^(\d+)/)?.[1] || 0);
            return numA - numB;
        });

        renderCategoryGrid();
        applyFilters();
        bindEvents();
    } catch (err) {
        console.error('Failed to load data:', err);
        alert('题库数据加载失败，请检查网络或文件路径。');
    }
}
function bindEvents() {
    // Navigation
    dom.navItems.forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view));
    });

    // Search
    dom.searchToggle.addEventListener('click', () => {
        dom.searchBar.classList.toggle('hidden');
        if (!dom.searchBar.classList.contains('hidden')) dom.searchInput.focus();
    });
    dom.searchInput.addEventListener('input', () => {
        if (currentView !== 'browse') switchView('browse');
        applyFilters();
    });

    // Quiz
    dom.startQuiz.addEventListener('click', startQuiz);
    dom.prevBtn.addEventListener('click', () => navigateQuiz(-1));
    dom.nextBtn.addEventListener('click', () => navigateQuiz(1));
    dom.submitQuiz.addEventListener('click', finishQuiz);
}

function switchView(viewId) {
    currentView = viewId;

    // UI Updates
    dom.navItems.forEach(item => item.classList.toggle('active', item.dataset.view === viewId));
    Object.keys(dom.views).forEach(k => dom.views[k].classList.toggle('hidden', k !== viewId));

    const titles = { browse: '题库浏览', categories: '科目分类', quiz: '模拟真考' };
    dom.pageTitle.textContent = titles[viewId];

    if (viewId === 'browse' && quizState.active) {
        // If coming back to browse while quiz is on, maybe warn? 
        // For now just keep it simple.
    }
}

function renderCategoryGrid() {
    dom.categoryGrid.innerHTML = `
        <div class="cat-item" data-cat="全部">
            <span>全部题目</span>
            <span class="count">${allQuestions.length}</span>
        </div>
    `;
    categories.forEach(cat => {
        const count = allQuestions.filter(q => q.category === cat).length;
        dom.categoryGrid.innerHTML += `
            <div class="cat-item" data-cat="${cat}">
                <span class="name">${cat}</span>
                <span class="count">${count}</span>
            </div>
        `;
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

function applyFilters() {
    const term = dom.searchInput.value.toLowerCase();
    filteredQuestions = allQuestions.filter(q => {
        const matchCat = currentCategory === '全部' || q.category === currentCategory;
        const matchSearch = q.question.toLowerCase().includes(term);
        return matchCat && matchSearch;
    });
    renderQuestionList();
}

let displayLimit = 50;

function renderQuestionList(append = false) {
    if (!append) {
        dom.questionList.innerHTML = '';
        displayLimit = 50;
    }

    const slice = filteredQuestions.slice(displayLimit - 50, displayLimit);

    slice.forEach((q, index) => {
        const realIndex = (displayLimit - 50) + index + 1;
        const div = document.createElement('div');
        div.className = 'question-card';
        div.innerHTML = `
            <div class="q-meta">
                <span class="q-index">#${realIndex}</span>
                <span class="q-type">${q.type}</span>
            </div>
            <div class="q-text">${q.question}</div>
            <div class="options-list">
                ${q.options.map(opt => `
                    <div class="option" data-key="${opt.key}">
                        <strong>${opt.key}.</strong> ${opt.text}
                    </div>
                `).join('')}
            </div>
            <button class="q-reveal-btn">显示答案</button>
            <div class="answer-panel hidden">正确答案：${q.answer}</div>
        `;

        div.querySelector('.q-reveal-btn').addEventListener('click', (e) => {
            const panel = div.querySelector('.answer-panel');
            const isHidden = panel.classList.toggle('hidden');
            e.target.textContent = isHidden ? '显示答案' : '隐藏答案';
        });

        dom.questionList.appendChild(div);
    });

    // Remove old loader if exists
    const oldLoader = document.getElementById('loadMoreBtn');
    if (oldLoader) oldLoader.remove();

    if (filteredQuestions.length > displayLimit) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.id = 'loadMoreBtn';
        loadMoreBtn.className = 'btn-text';
        loadMoreBtn.style.width = '100%';
        loadMoreBtn.style.padding = '2rem';
        loadMoreBtn.textContent = `加载更多 (剩余 ${filteredQuestions.length - displayLimit} 题)...`;
        loadMoreBtn.addEventListener('click', () => {
            displayLimit += 50;
            renderQuestionList(true);
        });
        dom.questionList.appendChild(loadMoreBtn);
    }

    if (filteredQuestions.length === 0) {
        dom.questionList.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-dim);">未找到相关题目</div>';
    }
}

// Quiz Engine
function startQuiz() {
    quizState.active = true;
    quizState.questions = [...allQuestions].sort(() => Math.random() - 0.5).slice(0, 50);
    quizState.index = 0;
    quizState.answers = {};
    quizState.timeLeft = 45 * 60;

    dom.quizWelcome.classList.add('hidden');
    dom.quizContainer.classList.remove('hidden');

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
    dom.quizProgress.textContent = `${quizState.index + 1} / ${quizState.questions.length}`;

    dom.quizQuestion.innerHTML = `
        <div class="question-card" style="margin-bottom:0">
            <span class="q-type">${q.type}</span>
            <div class="q-text">${q.question}</div>
            <div class="options-list">
                ${q.options.map(opt => {
        const sel = (quizState.answers[quizState.index] || '').includes(opt.key);
        return `<div class="option ${sel ? 'selected' : ''}" data-key="${opt.key}">
                        <strong>${opt.key}.</strong> ${opt.text}
                    </div>`;
    }).join('')}
            </div>
        </div>
    `;

    dom.quizQuestion.querySelectorAll('.option').forEach(el => {
        el.addEventListener('click', () => {
            const key = el.dataset.key;
            if (q.type === '多选题') {
                let current = quizState.answers[quizState.index] || '';
                if (current.includes(key)) current = current.replace(key, '');
                else current = (current + key).split('').sort().join('');
                quizState.answers[quizState.index] = current;
            } else {
                quizState.answers[quizState.index] = key;
            }
            renderQuizQuestion();
        });
    });

    dom.prevBtn.disabled = quizState.index === 0;
    dom.nextBtn.classList.toggle('hidden', quizState.index === quizState.questions.length - 1);
    dom.submitQuiz.classList.toggle('hidden', quizState.index !== quizState.questions.length - 1);
}

function navigateQuiz(dir) {
    quizState.index += dir;
    renderQuizQuestion();
}

function finishQuiz() {
    clearInterval(quizState.timer);
    let correct = 0;
    quizState.questions.forEach((q, i) => {
        if (quizState.answers[i] === q.answer) correct++;
    });

    const score = Math.round((correct / 50) * 100);
    dom.quizContainer.innerHTML = `
        <div class="quiz-results" style="text-align:center; padding: 2rem;">
            <div style="font-size: 4rem; font-weight: 700; color: var(--accent);">${score}分</div>
            <p style="margin: 1rem 0; color: var(--text-dim);">答对 ${correct} / 50 题</p>
            <button onclick="location.reload()" class="btn-primary">回首页</button>
        </div>
    `;
}

init();
