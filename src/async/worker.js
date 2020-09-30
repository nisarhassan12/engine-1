import { EventHandler } from "../core/event-handler";

function WorkerWrap() {

    function updateParticles(payload) {

    }

    onmessage = function (e) {
        var data = e.data;
        switch (data.type) {
            case 'init':
                postMessage({ type: 'initDone', worker: data.worker });
                break;
            case 'job':
                var result = updateParticles(data.payload);
                postMessage({ type: 'jobDone', id: data.id, payload: result[0] }, result[1]);
                break;
        }
    };
}

var awaitingInit = 0;
var workers = [];
var workerEvents = new EventHandler();
var activeJobs = {};
var nextWorker = 0;
var jobId = 0;
var asyncContinuation = null;

function handleWorkerResponse(e) {
    var data = e.data;
    switch (data.type) {
        case 'initDone':
            if (--awaitingInit === 0) {
                workerEvents.fire('initComplete');
            }
            break;
        case 'jobDone':
            // invoke job callback
            var callback = activeJobs[data.id];
            if (callback) {
                callback(data.payload);
            }
            delete activeJobs[data.id];

            // handle jobs completing
            if (Object.keys(activeJobs).length === 0 && asyncContinuation) {
                asyncContinuation();
                asyncContinuation = null;
            }
            break;
    }
}

function InitializeWorkers(app, numWorkers) {

    // construct a code blob for worker source
    var blob = new Blob(['(' + WorkerWrap.toString() + ')()\n\n'], { type: 'application/javascript' });
    var url = URL.createObjectURL(blob);

    // construct worker instances and initialize them
    for (var i = 0; i < (numWorkers || 1); ++i) {
        var worker = new Worker(url);
        worker.onmessage = handleWorkerResponse;
        worker.postMessage({ type: 'init', worker: i });
        workers.push(worker);
        awaitingInit++;
    }

    app.on('async', function (continuation) {
        if (Object.keys(activeJobs).length === 0) {
            // no jobs were requested this frame, invoke the continuation immediately
            continuation();
        } else {
            asyncContinuation = continuation;
        }
        jobId = 0;
    });
}

function allocateWorker() {
    var worker = nextWorker++;
    if (nextWorker >= workers.length) {
        nextWorker = 0;
    }
    return workers[worker];
}

function startJob(callback, payload, transferList) {
    // store callback
    var id = jobId++;
    activeJobs[id] = callback;
    allocateWorker().postMessage({ type: 'job', id: id, payload: payload }, transferList);
}

function addJob(callback, payload, transferList) {
    if (workers.length > 0) {
        startJob(callback, payload, transferList);
    }
}

export {
    InitializeWorkers,
    addJob,
    workerEvents
};
