import { EventHandler } from "../core/event-handler";

function WorkerWrap() {

    function sortParticles(order, distance) {
        var i;

        for (i = 0; i < order.length; ++i) {
            order[i] = i;
        }

        order.sort(function (a, b) {
            var av = distance[a];
            var bv = distance[b];
            return (av < bv) ? -1 : (bv < av ? 1 : 0);
        });
    }

    onmessage = function (e) {
        var data = e.data;
        switch (data.type) {
            case 'init':
                postMessage({ type: 'initDone', worker: data.worker });
                break;
            case 'job':
                var order = new Float32Array(data.payload.order);
                var distance = new Float32Array(data.payload.distance);
                sortParticles(order, distance);
                postMessage({
                    type: 'jobDone',
                    id: data.id,
                    payload: { order: order.buffer, distance: distance.buffer }
                }, [order.buffer, distance.buffer]);
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

            // if we've completed our last job and there is an asyncContinuation (meaning
            // that main thread is waiting for results) then invoke the continuation
            if (asyncContinuation && Object.keys(activeJobs).length === 0) {
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

    // this handler is called by the main thread after update has finished running
    // and before main thread render starts. the continuation is the function which
    // will continue the frame - i.e. rendering the scene
    app.on('async', function (continuation) {
        if (Object.keys(activeJobs).length === 0) {
            // either no jobs were requested this frame, or the jobs have already run
            // to completion, either way we can invoke the continuation immediately
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

function startJob(payload, transferList, callback) {
    // store callback
    var id = jobId++;
    activeJobs[id] = callback;
    allocateWorker().postMessage({ type: 'job', id: id, payload: payload }, transferList);
}

function addJob(payload, transferList, callback) {
    if (workers.length > 0) {
        startJob(payload, transferList, callback);
    }
}

function sortParticles(order, distance) {
    var i;

    for (i = 0; i < order.length; ++i) {
        order[i] = i;
    }

    order.sort(function (a, b) {
        var av = distance[a];
        var bv = distance[b];
        return (av < bv) ? -1 : (bv < av ? 1 : 0);
    });
}

export {
    InitializeWorkers,
    addJob,
    workerEvents,
    sortParticles
};
