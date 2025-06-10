document.addEventListener('DOMContentLoaded', () => {
    // 获取所有需要的DOM元素
    const controlBtn = document.getElementById('control-btn');
    const endBtn = document.getElementById('end-btn');
    const intervalSelect = document.getElementById('interval-select');
    const speedSelect = document.getElementById('speed-select');
    const accentSelect = document.getElementById('accent-select');
    const wordListInput = document.getElementById('word-list-input');
    const activeDictationArea = document.getElementById('active-dictation-area');
    const progressText = document.getElementById('progress-text');
    const translationDisplay = document.getElementById('translation-display');
    const userInput = document.getElementById('user-input');
    const feedbackText = document.getElementById('feedback-text');
    const resultsArea = document.getElementById('results-area');
    const summaryText = document.getElementById('summary-text');
    const resultsOutput = document.getElementById('results-output');
    const sidebar = document.getElementById('sidebar');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');

    // 状态管理变量
    let words = [];
    let currentIndex = 0;
    let isDictating = false;
    let isPaused = false;
    
    // 计时器相关变量
    let wordTimeout;
    let wordStartTime;
    let timeRemainingOnPause;
    const FEEDBACK_DELAY = 1200;

    // --- 解析单词列表 (无变化) ---
    function parseWordList() {
        const text = wordListInput.value.trim();
        if (!text) return [];
        return text.split('\n').map(line => {
            const parts = line.trim().split(/\s+/);
            if (!parts[0]) return null;
            const wordParts = [];
            const otherParts = [];
            let foundNonWord = false;
            parts.forEach(p => {
                if (/[\u4e00-\u9fa5]/.test(p) || !isNaN(p)) foundNonWord = true;
                if(foundNonWord) otherParts.push(p); else wordParts.push(p);
            });
            const word = wordParts.join(' ');
            return {
                word,
                translation: otherParts[0] || '（无翻译）',
                correctCount: parseInt(otherParts[1]) || 0,
                totalCount: parseInt(otherParts[2]) || 0
            };
        }).filter(Boolean);
    }

    // --- 核心听写流程控制 ---
    function startDictation() {
        words = parseWordList();
        if (words.length === 0) {
            alert('请在右侧输入单词列表！');
            return;
        }
        isDictating = true;
        isPaused = false;
        currentIndex = 0;
        updateUIForDictationStart();
        nextWord();
    }

    function pauseDictation() {
        if (!isDictating || isPaused) return;
        isPaused = true;
        clearTimeout(wordTimeout);
        // 计算暂停时，当前单词已经过去了多少时间
        timeRemainingOnPause = Date.now() - wordStartTime;
        updateUIForPause();
        window.speechSynthesis.cancel(); // 暂停时停止朗读
    }

    function resumeDictation() {
        if (!isDictating || !isPaused) return;
        isPaused = false;
        updateUIForResume();
        
        // 计算剩余时间
        const interval = parseInt(intervalSelect.value);
        const remainingTime = interval - timeRemainingOnPause;
        
        // 用剩余时间继续倒计时
        wordTimeout = setTimeout(() => {
            checkAnswer(true);
        }, remainingTime > 0 ? remainingTime : 0); // 避免负数
        wordStartTime = Date.now() - timeRemainingOnPause; // 修正开始时间，以便下次暂停计算正确
    }

    function endDictation() {
        isDictating = false;
        isPaused = false;
        clearTimeout(wordTimeout);
        window.speechSynthesis.cancel();
        updateUIForEnd();
        if (currentIndex > 0) generateReport();
    }
    
    function nextWord() {
        if (!isDictating || isPaused || currentIndex >= words.length) {
            if(currentIndex >= words.length) endDictation(); // 所有单词听写完毕
            return;
        }

        const currentWord = words[currentIndex];
        progressText.textContent = `进度: ${currentIndex + 1} / ${words.length}`;
        translationDisplay.textContent = currentWord.translation;
        userInput.value = '';
        userInput.focus();
        feedbackText.textContent = '';
        
        speak(currentWord.word);
        
        const interval = parseInt(intervalSelect.value);
        wordStartTime = Date.now(); // 记录当前单词开始的时间点
        wordTimeout = setTimeout(() => checkAnswer(true), interval);
    }

    function checkAnswer(isTimeUp = false) {
        if (!isDictating || isPaused) return;
        clearTimeout(wordTimeout);

        const userAnswer = userInput.value.trim();
        const correctAnswer = words[currentIndex].word;
        
        words[currentIndex].totalCount++;
        if (userAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
            feedbackText.textContent = `✅ 正确!`;
            feedbackText.className = 'correct';
            words[currentIndex].correctCount++;
        } else {
            feedbackText.textContent = `❌ 错误! 正确答案: ${correctAnswer}`;
            feedbackText.className = 'incorrect';
        }
        
        currentIndex++;
        setTimeout(nextWord, FEEDBACK_DELAY);
    }

    // --- 语音播放 (无变化) ---
    function speak(text) {
        window.speechSynthesis.cancel(); 
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = accentSelect.value;
        utterance.rate = parseFloat(speedSelect.value);
        window.speechSynthesis.speak(utterance);
    }
    
    // --- 生成报告 (无变化) ---
    function generateReport() { /* ... (此函数代码无任何变化) ... */
        if (words.length === 0) return;
        let totalCorrect = 0, totalOverall = 0;
        let reportText = '| 单词 | 中文 | 正确次数 | 听写次数 |\n| - | - | :-: | :-: |\n';
        words.forEach(word => {
            totalCorrect += word.correctCount;
            totalOverall += word.totalCount;
            reportText += `| ${word.word} | ${word.translation} | ${word.correctCount} | ${word.totalCount} |\n`;
        });
        const accuracy = totalOverall > 0 ? ((totalCorrect / totalOverall) * 100).toFixed(1) : 0;
        summaryText.textContent = `听写完成！总正确率: ${accuracy}% (${totalCorrect}/${totalOverall})`;
        resultsOutput.textContent = reportText;
        resultsArea.classList.remove('hidden');
        wordListInput.value = words.map(w => `${w.word} ${w.translation} ${w.correctCount} ${w.totalCount}`).join('\n');
    }

    // --- UI更新函数 ---
    function updateUIForDictationStart() {
        controlBtn.textContent = '暂停';
        controlBtn.className = 'btn btn-pause';
        endBtn.classList.remove('hidden');
        wordListInput.disabled = true;
        activeDictationArea.classList.remove('hidden');
        resultsArea.classList.add('hidden');
    }
    function updateUIForPause() {
        controlBtn.textContent = '继续听写';
        controlBtn.className = 'btn btn-resume';
        userInput.disabled = true;
    }
    function updateUIForResume() {
        controlBtn.textContent = '暂停';
        controlBtn.className = 'btn btn-pause';
        userInput.disabled = false;
        userInput.focus();
    }
    function updateUIForEnd() {
        controlBtn.textContent = '开始听写';
        controlBtn.className = 'btn btn-start';
        endBtn.classList.add('hidden');
        wordListInput.disabled = false;
        userInput.disabled = false;
        activeDictationArea.classList.add('hidden');
    }
    
    // --- 事件绑定 ---
    controlBtn.addEventListener('click', () => {
        if (!isDictating) {
            startDictation();
        } else if (isPaused) {
            resumeDictation();
        } else {
            pauseDictation();
        }
    });

    endBtn.addEventListener('click', endDictation);

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && isDictating && !isPaused) {
            e.preventDefault();
            checkAnswer(false);
        }
    });

    toggleSidebarBtn.addEventListener('click', () => {
        sidebar.classList.toggle('hidden');
    });
});