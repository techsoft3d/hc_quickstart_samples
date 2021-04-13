function createViewer(viewerMode, modelName, containerId) {
    return new Promise(function (resolve, reject) {
        if (viewerMode == "SCS") {
            var scsFileName = "/converted_models/standard/scs_models/" + modelName + ".scs"
            createScsViewer(scsFileName, containerId).then(function (viewer) {
                resolve(viewer);
            })
        } else {    
            if (viewerMode == "SSR") {
                rendererType = Communicator.RendererType.Server;
            } else {
                rendererType = Communicator.RendererType.Client;
            }
            
            requestEndpoint(rendererType).then(function (endpoint) {
                var viewer = new Communicator.WebViewer({
                    containerId: containerId,
                    endpointUri: endpoint,
                    model: modelName,
                    rendererType: rendererType
                });
                resolve(viewer);
            });
        }
    });
}

function createScsViewer(scsFileName, containerId) {
    return new Promise(function (resolve, reject) {
        var viewer = new Communicator.WebViewer({
            containerId: containerId,
            endpointUri: scsFileName
        });
        resolve(viewer);
    });
};

function requestEndpoint(rendererType) {
    var request = new XMLHttpRequest();
    var promise = new Promise(function (resolve, reject) {
        request.onreadystatechange = function () {
            if (request.readyState == 4) {
                if (request.status == 200) {
                    var response = request.responseText;
                    var obj = JSON.parse(response);
                    resolve(obj.endpoints.ws);
                } else {
                    reject("ws://localhost:55555");
                }
            }
        };
        var serviceBrokerURL = window.location.protocol + "//" + window.location.hostname + ":11182";
        request.open("POST", serviceBrokerURL + "/api/spawn", true);
        request.setRequestHeader("Access-Control-Allow-Origin","*");
        request.setRequestHeader("Access-Control-Allow-Methods","POST");
        request.setRequestHeader("Access-Control-Allow-Headers","Content-Type, Access-Control-Allow-Origin, Access-Control-Allow-Methods, Access-Control-Allow-Headers");
        request.overrideMimeType("application/json");
        request.setRequestHeader("Content-Type","application/json");
        
        var data;
        if (rendererType == Communicator.RendererType.Server) {
            data = '{"class": "ssr_session"}';
        } else {
            data = '{"class": "csr_session"}';
        }
        request.send(data);
    });
    return promise;
}

function getURLArgument(name) {
    if (1 < document.location.search.length) {
        var query = document.location.search.substring(1);
        var parameters = query.split('&');
        var result = new Object();
        for (var i = 0; i < parameters.length; i++) {
            var element = parameters[i].split('=');
            var paramName = decodeURIComponent(element[0]);
            var paramValue = decodeURIComponent(element[1]);
            result[paramName] = decodeURIComponent(paramValue);
        }
        return result[name];
    }
}