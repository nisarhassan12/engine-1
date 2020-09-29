onmessage = function (e) {

    if (e.data === 'init') {
        postMessage('ready');
    } else {
        var frame = e.data;
        console.log('worker: working frame=' + frame);
        setTimeout(function () {
            console.log('worker: working frame=' + frame);
            setTimeout(function () {
                console.log('worker: working frame=' + frame);
                setTimeout(function () {
                    console.log('worker: done frame=' + frame);
                    postMessage(frame);
                });
            }, 200);
        }, 200);
    }
};
