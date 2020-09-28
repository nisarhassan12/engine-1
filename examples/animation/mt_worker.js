onmessage = function (e) {
    console.log('worker: frame=' + e.data);
    postMessage(e.data);
};
