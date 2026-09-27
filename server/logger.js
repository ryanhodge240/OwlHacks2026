function logEvent(event, fields = {}) {
    console.log(
        JSON.stringify({
            timestamp: new Date().toISOString(),
            event,
            ...fields,
        }),
    );
}

module.exports = { logEvent };
