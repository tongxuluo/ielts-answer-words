document.addEventListener('DOMContentLoaded', () => {
    // 获取所有需要的DOM元素 (此部分无变化)
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

    // 状态管理变量 (此部分无变化)
    let words = [];
    let currentIndex = 0;
    let isDictating = false;
    let isPaused = false;
    
    // 计时器相关变量 (此部分无变化)
    let wordTimeout;
    let wordStartTime;
    let timeRemainingOnPause;
    const FEEDBACK_DELAY = 1200;

    // --- 解析单词列表 (逻辑更新) ---
    function parseWordList() {
        const text = wordListInput.value; // 直接获取完整文本
        if (!text) return [];
        
        return text.split('\n').map(line => {
            const trimmedLine = line.trim();

            // --- ✨ 新增的智能过滤逻辑 ---
            // 1. 如果行是空的，或不是以英文字母开头，则视为无效行，返回null
            //    这个规则可以过滤掉 '###', '**', '```' 以及中文标题等。
            if (!/^[a-zA-Z]/.test(trimmedLine)) {
                return null;
            }
            // --- 过滤逻辑结束 ---

            // 原有的解析逻辑，只对有效行执行
            const parts = trimmedLine.split(/\s+/);
            const wordParts = [];
            const otherParts = [];
            let foundNonWord = false;
            
            parts.forEach(p => {
                // 判断是否为中文或纯数字
                if (/[\u4e00-\u9fa5]/.test(p) || /^\d+$/.test(p)) {
                    foundNonWord = true;
                }
                if(foundNonWord) {
                    otherParts.push(p);
                } else {
                    wordParts.push(p);
                }
            });
            const word = wordParts.join(' ');
            return {
                word,
                translation: otherParts[0] || '（无翻译）',
                correctCount: parseInt(otherParts[1]) || 0,
                totalCount: parseInt(otherParts[2]) || 0
            };
        }).filter(Boolean); // 最后使用 filter(Boolean) 统一移除所有返回null的无效行
    }

    // --- 核心听写流程控制 (此部分无变化) ---
    function startDictation() {
        words = parseWordList();
        if (words.length === 0) {
            alert('未检测到有效单词！请检查输入格式。');
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
        timeRemainingOnPause = Date.now() - wordStartTime;
        updateUIForPause();
        window.speechSynthesis.cancel();
    }

    function resumeDictation() {
        if (!isDictating || !isPaused) return;
        isPaused = false;
        updateUIForResume();
        const interval = parseInt(intervalSelect.value);
        const remainingTime = interval - timeRemainingOnPause;
        wordTimeout = setTimeout(() => {
            checkAnswer(true);
        }, remainingTime > 0 ? remainingTime : 0);
        wordStartTime = Date.now() - timeRemainingOnPause;
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
            if(currentIndex >= words.length) endDictation();
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
        wordStartTime = Date.now();
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

    // --- 语音播放 (此部分无变化) ---
    function speak(text) {
        window.speechSynthesis.cancel(); 
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = accentSelect.value;
        utterance.rate = parseFloat(speedSelect.value);
        window.speechSynthesis.speak(utterance);
    }
    
    // --- 生成报告 (此部分无变化) ---
    function generateReport() {
        if (words.length === 0) return;
        let totalCorrect = 0, totalOverall = 0;
        let reportText = '| 单词 | 中文 | 正确次数 | 听写次数 |\n| - | - | :-: | :-: |\n';
        words.forEach(word => {
            totalCorrect += word.correctCount;
            totalOverall += word.totalCount;
            reportText += `| ${word.word} | ${word.translation} | ${word.correctCount} | ${word.totalCount} |\n`;
        });
        const accuracy = totalOverall > 0 ? ((totalCorrect / totalOverall) * 100).toFixed(1) : 0;
        summaryText.textContent = `听写完成！总正确率: <span class="math-inline">\{accuracy\}% \(</span>{totalCorrect}/${totalOverall})`;
        resultsOutput.textContent = reportText;
        resultsArea.classList.remove('hidden');
        wordListInput.value = words.map(w => `${w.word} ${w.translation} ${w.correctCount} ${w.totalCount}`).join('\n');
    }

    // --- UI更新函数 (此部分无变化) ---
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
    
    // --- 事件绑定 (此部分无变化) ---
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