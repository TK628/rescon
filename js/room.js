function switchView(targetId) {

    const views = [
        'auth-overlay',
        'game-content',
        'master-maintenance-overlay'
    ];

    views.forEach(id => {
        const el = document.getElementById(id);

        if (el) {
            el.style.display = 'none';
        }
    });

    const target = document.getElementById(targetId);

    if (target) {
        target.style.display =
            targetId === 'game-content'
                ? 'block'
                : 'flex';
    }
}

function getRoomId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('room') || 'default';
}

function isRoomAuthorized(roomId) {
    return sessionStorage.getItem('isAuthorized') === roomId;
}

function validatePasscode(input, configPass) {
    return input === configPass;
}

function authorizeRoom(roomId) {
    sessionStorage.setItem('isAuthorized', roomId);
}

function getInputPasscode() {
    let input = document.getElementById('input-pass').value;

    if (input.length > 4) {
        input = input.slice(0, 4);
    }

    return input;
}

function getSetupPasscode() {
    let pass = document.getElementById('set-pass').value;

    if (pass.length > 4) {
        pass = pass.slice(0, 4);
    }

    return pass;
}

function getSetupCapacity() {
    return parseInt(document.getElementById('set-capacity').value) || 99;
}

function getMyRefereeId() {
    let myId = sessionStorage.getItem('myRefereeId');

    if (!myId) {
        myId = Math.random().toString(36).substring(2, 10);
        sessionStorage.setItem('myRefereeId', myId);
    }

    return myId;
}

function exitRoom() {
    sessionStorage.removeItem('isAuthorized');
    location.href = 'index.html';
}

export {
    switchView,
    getRoomId,
    isRoomAuthorized,
    validatePasscode,
    authorizeRoom,
    getInputPasscode,
    getSetupPasscode,
    getSetupCapacity,
    getMyRefereeId,
    exitRoom
};