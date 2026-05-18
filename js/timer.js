function calculateRemainingSeconds(targetTimestamp) {
    const now = Date.now();
    return Math.max(0, Math.floor((targetTimestamp - now) / 1000));
}

function formatTime(seconds) {

    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;

    return `${min}:${sec.toString().padStart(2, '0')}`;
}

export {
    calculateRemainingSeconds,
    formatTime
};