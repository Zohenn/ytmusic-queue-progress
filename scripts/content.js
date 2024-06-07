/**
 * @returns {HTMLVideoElement | null}
 */
function getVideoElement() {
    return document.querySelector('video.html5-main-video');
}

/**
 * @returns {HTMLElement | null}
 */
function getQueueElement() {
    return document.querySelector('#queue #contents');
}


/**
 * @param {string} duration 
 * @returns {number[]}
 */
function parseDuration(duration) {
    return duration.split(':').map(Number);
}

/**
 * @param {HTMLElement} queueElement 
 * @returns {{duration: number, current: boolean}[]}
 */
function parseQueue(queueElement) {
    const queueElements = queueElement.querySelectorAll('.ytmusic-player-queue');

    const parsedSongs = [];

    for (let queueElement of queueElements) {
        if (queueElement.tagName !== 'YTMUSIC-PLAYER-QUEUE-ITEM') {
            queueElement = queueElement.querySelector('#primary-renderer ytmusic-player-queue-item')
        }

        const rawDuration = queueElement.getElementsByClassName('duration')[0].textContent;

        const [minutes, seconds] = parseDuration(rawDuration);

        parsedSongs.push({
            duration: minutes * 60 + seconds,
            current: !!queueElement.attributes.selected,
        });
    }

    return parsedSongs;
}

/**
 * @param {number} currentTime 
 * @returns {{songs: {duration: number, current: boolean}[], elapsedTime: number, totalTime: number}}
 */
function getQueueProgress(currentTime) {
    const queueElement = getQueueElement();

    if (!queueElement) {
        return { songs: [], elapsedTime: 0, totalTime: 0 };
    }

    const songs = parseQueue(queueElement);

    let elapsedTime = currentTime;
    let totalTime = 0;
    let selectedFound = false;

    for (const song of songs) {
        if (song.current) {
            selectedFound = true;
        }

        if (!selectedFound) {
            elapsedTime += song.duration;
        }

        totalTime += song.duration;
    }

    return {
        songs,
        elapsedTime,
        totalTime,
    };
}

/**
 * @returns {number}
 */
function getCurrentTime() {
    const timeInfo = document.querySelector('#left-controls .time-info');

    if (!timeInfo) {
        return 0;
    }

    const [rawCurrentTime] = timeInfo.textContent.split('/');

    const [minutes, seconds] = parseDuration(rawCurrentTime.trim());

    return minutes * 60 + seconds;
}

/**
 * @param {number} seconds 
 * @returns {string}
 */
function secondsToString(seconds) {
    const fullMinutes = Math.floor(seconds / 60);
    const secondsLeft = seconds - fullMinutes * 60;

    return `${fullMinutes}:${secondsLeft.toLocaleString(undefined, { minimumIntegerDigits: 2 })}`;
}

/**
 * @param {HTMLElement} queueElement 
 * @returns {HTMLElement}
 */
function prepareProgressElement(queueElement) {
    const progressElement = queueElement.querySelector('.ytmusic-queue-progress');

    if (progressElement) {
        return progressElement;
    }

    const newProgressElement = document.createElement('div');
    newProgressElement.classList.add('ytmusic-queue-progress');
    newProgressElement.style.width = '100%';
    newProgressElement.style.textAlign = 'right';
    newProgressElement.style.fontFamily = 'Roboto, Noto Naskh Arabic UI, Arial, sans-serif';
    newProgressElement.style.fontSize = 'var(--ytmusic-responsive-font-size)';
    newProgressElement.style.fontWeight = '400';
    newProgressElement.style.color = '#aaa';
    newProgressElement.style.paddingBlock = '12px';
    newProgressElement.style.paddingInline = '8px';
    newProgressElement.style.boxSizing = 'border-box';

    queueElement.insertAdjacentElement('beforeend', newProgressElement);

    return newProgressElement;
}

/**
 * @param {{elapsedTime: number, totalTime: number}} progress 
 */
function showQueueProgress(progress) {
    const queueElement = getQueueElement();

    const progressElement = prepareProgressElement(queueElement);

    progressElement.textContent = `${secondsToString(progress.elapsedTime)} / ${secondsToString(progress.totalTime)}`;
}

/**
 * @returns {() => void}
 */
function hookIntoPlayer() {
    let videoElement = getVideoElement();
    let previousTime = 0;
    let previousQueueProgress = {
        songs: [],
        elapsedTime: 0,
        totalTime: 0,
    };

    const updateProgress = function() {
        const currentTime = getCurrentTime();

        if (this instanceof HTMLElement && currentTime === previousTime) {
            return;
        }

        const queueProgress = getQueueProgress(currentTime);

        if (this instanceof MutationObserver && previousQueueProgress.songs.length === queueProgress.songs.length) {
            showQueueProgress(previousQueueProgress);
            return;
        }

        showQueueProgress(queueProgress);

        previousTime = currentTime;
        previousQueueProgress = queueProgress;
    };

    videoElement?.addEventListener('timeupdate', updateProgress);

    const mutationObserver = new MutationObserver(updateProgress);
    mutationObserver.observe(getQueueElement(), { subtree: true, childList: true, attributes: true });

    return () => {
        videoElement.removeEventListener('timeupdate', updateProgress);
        mutationObserver.disconnect();
    };
}

const mutationObserver = new MutationObserver((_, observer) => {
    if (getQueueProgress(0).totalTime) {
        hookIntoPlayer();
        observer.disconnect();
    }
});

mutationObserver.observe(document.body, { subtree: true, childList: true });

