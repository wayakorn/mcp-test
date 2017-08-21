var express = require("express");
var router = express.Router();
var http = require("http");

function m_close(printer) {
    if (g_verbose) {
        console.log("[test_httpget.js] printer {" + printer.Key + "} closing the underlying connection");
    }
    printer.Socket.destroy();
}

router.get("/wait/:numRequests", function(req, res) {
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.setHeader("cache-control", "no-cache");
    g_reset();
    if (req.params.numRequests && req.params.numRequests != "") {
        var numConnected = 0;
        var numRequests = Number(req.params.numRequests);
        for (var i = 0; i < numRequests; ++i) {
            var newReq = http.request({
                    host: g_notificationServer,
                    port: g_notificationServerPort,
                    path: "/httpget/wait",
                }, function(newRes) {
                    var key = g_getClientInfo(newRes.connection);
                    newRes.setEncoding("utf8");
                    newRes.on("data", function(message) {
                        if (g_verbose) {
                            console.log("[test_httpget.js] printer {" + key + "} received: \"" + message);
                        }
                    });
                });
            newReq.on("socket", function(newSocket){
                newSocket.on("connect", function(){
                    this.key = g_getClientInfo(newSocket);
                    var printer = {Key: this.key, Close: m_close, Socket: newSocket};
                    g_addPrinter(printer);
                    if (g_verbose) {
                        console.log("[test_httpget.js] printer {" + printer.Key + "} added" + ", numPrinters=" + g_getPrinterCount());
                    }
                    ++numConnected;
                    if (numRequests == numConnected) {
                        res.end(numRequests + " printers are now waiting for HTTP replies.");    
                    }
                }).on("close", function(hasError) {
                    var printer = g_findOrDeletePrinter(this.key, true);
                    if (g_verbose && printer) {
                        console.log("[test_httpget.js] printer {" + printer.Key + "} closed (socket closed), HasError=" + hasError + ", numPrinters=" + g_getPrinterCount());
                    }
                });
            });
            newReq.on("error", function(){}); // This is needed to avoid an http event emission error
            newReq.end();
        }
    }
});


module.exports = router;
