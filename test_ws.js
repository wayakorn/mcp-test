var express = require("express");
var app = express();
var router = express.Router();

var Websocket = require("ws");

function m_close(printer) {
    if (g_verbose) {
        console.log("[test_ws.js] printer {" + printer.Key + "} closing the underlying connection");
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
            var ws = new Websocket("ws://" + g_notificationServer + ":" + g_notificationServerPort + "/ws/wait");
            ws.on("open", function() {
                var key = g_getClientInfo(this._socket);
                this._socket.on("close", function (hadError) {
                    var printer = g_findOrDeletePrinter(key, true);
                    if (g_verbose && printer != null) {
                        console.log("[test_ws.js] printer {" + printer.Key  + "} removed (socket closed), numPrinters=" + g_getPrinterCount());
                    }
                });
                var printer = {Key:key, Close: m_close, Socket:this._socket};
                g_addPrinter(printer);
                if (g_verbose) {
                    console.log("[test_ws.js] printer {" + printer.Key  + "} added, numPrinters=" + g_getPrinterCount());
                }
                ++numConnected;
                if (numRequests == numConnected) {
                    res.end(numRequests + " printers are waiting for Websocket replies.");
                }
                this.key = key;
            }).on("message", function(message) {
                var printer = g_findOrDeletePrinter(this.key, false);
                if (printer != null) {
                    if (g_verbose) {
                        console.log("[test_ws.js] printer {" + printer.Key  + "} received \"" + message + "\"");
                    }
                    this.close();
                }
            }).on("error", function(socketError) {
                console.log("[test_ws.js] error: " + socketError.toString());
            });
        }
    }
});


module.exports = router;
