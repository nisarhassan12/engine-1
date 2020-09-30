onmessage = function (e) {

    if (e.data === 'init') {
        postMessage('ready');
    } else {
        var frame = e.data;
        setTimeout(function () {
            // console.log('worker: done frame=' + frame);
            postMessage(frame);
        }, 2);
    }
};
