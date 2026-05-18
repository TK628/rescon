function calculateCurrentLife(
    lifeAtSync,
    baseDropPerSec,
    elapsedSecondsSinceSync
) {
    return lifeAtSync - (baseDropPerSec * elapsedSecondsSinceSync);
}

function applyDamageToLife(currentLife, damage) {
    const nextLife = currentLife - damage;

    if (nextLife < 0) {
        return 0;
    }

    return nextLife;
}

function createDefaultState() {
    return {
        isRunning: false,
        activeCount: 3,
        selectedDuration: 10,
        targetTimestamp: 0,
        pausedLeftSeconds: 600,
        baseDropPerSec: 0.1666,

        dummies: {
            d1: {
                name: "Dummy 1",
                lifeAtSync: 100
            },

            d2: {
                name: "Dummy 2",
                lifeAtSync: 100
            },

            d3: {
                name: "Dummy 3",
                lifeAtSync: 100
            }
        }
    };
}

export {
    calculateCurrentLife,
    applyDamageToLife,
    createDefaultState
};