function isRefereePage() {
    return window.location.pathname.includes('referee.html');
}

function isPlayerPage() {
    return window.location.pathname.includes('player.html');
}

function isSpectatorPage() {
    return window.location.pathname.includes('spectator.html');
}

function canOperateReferee(isReferee) {
    return isReferee;
}

export {
    isRefereePage,
    isPlayerPage,
    isSpectatorPage,
    canOperateReferee
};