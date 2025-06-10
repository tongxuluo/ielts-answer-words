document.addEventListener('DOMContentLoaded', () => {
    // 获取所有需要的DOM元素
    const controlBtn = document.getElementById('control-btn');
    const endBtn = document.getElementById('end-btn');
    const wordListInput = document.getElementById('word-list-input');
    const activeDictationArea = document.getElementById('active-dictation-area');
    const progressText = document.getElementById('progress-text');
    const translationDisplay = document.getElementById('translation-display');
    const userInput = document.getElementById('user-input');
    const feedbackText = document.getElementById('feedback-text');
    // 报告区DOM元素
    const resultsArea = document.getElementById('results-area');
    const summaryText = document.getElementById('summary-text');
    const resultsTableContainer = document.getElementById('results-table-container'); // 更新
    const incorrectWordsArea = document.getElementById('incorrect-words-area'); // 新增
    const incorrectWordsOutput = document.getElementById('incorrect-words-output'); // 新增
    // 其他
    const intervalSelect = document.getElementById('interval-select');
    const speedSelect = document.getElementById('speed-select');
    const accentSelect = document.getElementById('accent-select');
    const sidebar = document.getElementById('sidebar');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');

    // 状态管理变量
    let words = [];
    let currentIndex = 0;
    let isDictating = false;
    let isPaused = false;
    let sessionIncorrectWords; // 新增：用于记录本轮错词

    // 计时器相关变量
    let wordTimeout, wordStartTime, timeRemainingOnPause;
    const FEEDBACK_DELAY = 1200;

    // --- 解析单词列表 (无变化) ---
    function parseWordList() { 
        const text = wordListInput.value; if (!text) return [];
        return text.split('\n').map(line => {
            const trimmedLine = line.trim();
            if (!/^[a-zA-Z]/.test(trimmedLine)) return null;
            const parts = trimmedLine.split(/\s+/); const wordParts = []; const otherParts = []; let foundNonWord = false;
            parts.forEach(p => { if (/[\u4e00-\u9fa5]/.test(p) || /^\d+$/.test(p)) foundNonWord = true; if(foundNonWord) otherParts.push(p); else wordParts.push(p); });
            const word = wordParts.join(' ');
            return { word, translation: otherParts[0] || '（无翻译）', correctCount: parseInt(otherParts[1]) || 0, totalCount: parseInt(otherParts[2]) || 0 };
        }).filter(Boolean);
    }

    // --- 核心听写流程控制 ---
    function startDictation() {
        words = parseWordList();
        if (words.length === 0) { alert('未检测到有效单词！请检查输入格式。'); return; }
        
        isDictating = true;
        isPaused = false;
        currentIndex = 0;
        sessionIncorrectWords = new Set();
        
        updateUIForDictationStart();
        nextWord();
    }

    function checkAnswer(isTimeUp = false) {
        if (!isDictating || isPaused) return;
        clearTimeout(wordTimeout);
        const userAnswer = userInput.value.trim();
        const currentWord = words[currentIndex];
        const correctAnswer = currentWord.word;

        if(currentIndex < words.length) {
            currentWord.totalCount++;
            if (userAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
                feedbackText.textContent = `✅ 正确!`;
                feedbackText.className = 'correct';
                currentWord.correctCount++;
            } else {
                feedbackText.textContent = `❌ 错误! 正确答案: ${correctAnswer}`;
                feedbackText.className = 'incorrect';
                sessionIncorrectWords.add(currentWord);
            }
        }
        currentIndex++;
        setTimeout(nextWord, FEEDBACK_DELAY);
    }

    // --- 生成报告 (✨ 函数重写) ---
    function generateReport() {
        if (words.length === 0) return;

        // 1. 计算总结
        let totalCorrect = 0, totalAttempts = 0;
        words.forEach(word => {
            totalCorrect += word.correctCount;
            totalAttempts += word.totalCount;
        });
        const accuracy = totalAttempts > 0 ? ((totalCorrect / totalAttempts) * 100).toFixed(1) : 0;
        summaryText.textContent = `听写完成！总正确率: ${accuracy}% (${totalCorrect}/${totalAttempts})`;

        // 2. 动态生成HTML表格
        resultsTableContainer.innerHTML = ''; 
        const table = document.createElement('table');
        table.className = 'results-table';
        const thead = table.createTHead();
        const headerRow = thead.insertRow();
        const headers = ['单词', '中文', '正确次数', '听写次数'];
        headers.forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            headerRow.appendChild(th);
        });
        const tbody = table.createTBody();
        words.forEach(word => {
            const row = tbody.insertRow();
            row.insertCell().textContent = word.word;
            row.insertCell().textContent = word.translation;
            row.insertCell().textContent = word.correctCount;
            row.insertCell().textContent = word.totalCount;
        });
        resultsTableContainer.appendChild(table);

        // 3. 处理本轮错词
        if (sessionIncorrectWords.size > 0) {
            const incorrectList = Array.from(sessionIncorrectWords)
                .map(word => `${word.word} ${word.translation}`)
                .join('\n');
            incorrectWordsOutput.value = incorrectList;
            incorrectWordsArea.classList.remove('hidden');
        } else {
            incorrectWordsArea.classList.add('hidden');
        }

        // 4. 更新UI
        resultsArea.classList.remove('hidden');
        wordListInput.value = words.map(w => `${w.word} ${w.translation} ${w.correctCount} ${w.totalCount}`).join('\n');
    }
    
    function updateUIForDictationStart() {
        controlBtn.textContent = '暂停';
        controlBtn.className = 'btn btn-pause';
        endBtn.classList.remove('hidden');
        wordListInput.disabled = true;
        activeDictationArea.classList.remove('hidden');
        resultsArea.classList.add('hidden'); 
        incorrectWordsArea.classList.add('hidden');
    }

    function pauseDictation() { if (!isDictating || isPaused) return; isPaused = true; clearTimeout(wordTimeout); timeRemainingOnPause = Date.now() - wordStartTime; updateUIForPause(); window.speechSynthesis.cancel(); }
    function resumeDictation() { if (!isDictating || !isPaused) return; isPaused = false; updateUIForResume(); const interval = parseInt(intervalSelect.value); const remainingTime = interval - timeRemainingOnPause; wordTimeout = setTimeout(() => { checkAnswer(true); }, remainingTime > 0 ? remainingTime : 0); wordStartTime = Date.now() - timeRemainingOnPause; }
    function endDictation() { isDictating = false; isPaused = false; clearTimeout(wordTimeout); window.speechSynthesis.cancel(); updateUIForEnd(); if (words.length > 0) generateReport(); }
    function nextWord() { if (!isDictating || isPaused || currentIndex >= words.length) { if (currentIndex >= words.length) endDictation(); return; } const currentWord = words[currentIndex]; progressText.textContent = `进度: ${currentIndex + 1} / ${words.length}`; translationDisplay.textContent = currentWord.translation; userInput.value = ''; userInput.focus(); feedbackText.textContent = ''; speak(currentWord.word); const interval = parseInt(intervalSelect.value); wordStartTime = Date.now(); wordTimeout = setTimeout(() => checkAnswer(true), interval); }
    function speak(text) { window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = accentSelect.value; utterance.rate = parseFloat(speedSelect.value); window.speechSynthesis.speak(utterance); }
    function updateUIForPause() { controlBtn.textContent = '继续听写'; controlBtn.className = 'btn btn-resume'; userInput.disabled = true; }
    function updateUIForResume() { controlBtn.textContent = '暂停'; controlBtn.className = 'btn btn-pause'; userInput.disabled = false; userInput.focus(); }
    function updateUIForEnd() { controlBtn.textContent = '开始听写'; controlBtn.className = 'btn btn-start'; endBtn.classList.add('hidden'); wordListInput.disabled = false; userInput.disabled = false; activeDictationArea.classList.add('hidden'); }
    controlBtn.addEventListener('click', () => { if (!isDictating) startDictation(); else if (isPaused) resumeDictation(); else pauseDictation(); });
    endBtn.addEventListener('click', endDictation);
    userInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && isDictating && !isPaused) { e.preventDefault(); checkAnswer(false); } });
    toggleSidebarBtn.addEventListener('click', () => { sidebar.classList.toggle('hidden'); });
});