var http = require("http");
var express = require("express");
var app = express();

app.set("port", process.env.PORT || 3001);
app.use(express.static('public'));

// ---------- Globals ----------
g_verbose = false;

g_notificationServer = "localhost";
g_notificationServerPort = 3000;

g_getClientInfo = function(clientSocket) {
    return clientSocket.localAddress.toString() + ":" + clientSocket.localPort.toString();
}

g_server = app.listen(app.get("port"), function() {
    console.log("Server listening on port " + g_server.address().port);
    g_server.setTimeout(1200000, function(socket) {
        console.log("Connection " + g_getClientInfo(socket) + " still alive.");
    });
});

// These are for statistics
var m_peekNumPrinters = 0;
var m_allPrintersRemovedTimestampMS = 0;
var m_notifyTimestampMS = 0;

// List of printer connections to the notification server
var m_printers = [];

g_reset = function() {
    m_peekNumPrinters = 0;
    m_allPrintersRemovedTimestampMS = 0;
    m_notifyTimestampMS = 0;
    // Use the local list to invoke the cleanup callbacks
    var printers = m_printers;
    m_printers = [];
    // Call the protocol-specific cleanup function
    for (var i = 0; i < printers.length; ++i) {
        printers[i].Close(printers[i]);
    }
}

g_findPrinter = function(key, remove) {
    var result = null;
    var printers = [];
    for (var i = 0; i < m_printers.length; ++i) {
        if (key == m_printers[i].Key) {
            result = m_printers[i];
            if (!remove) {
                break;
            }
        } else {
            printers.push(m_printers[i]);
        }
    }
    if (remove) {
        if (printers.length == 0) {
            m_allPrintersRemovedTimestampMS = Date.now();
        }
        m_printers = printers;
    }
    return result;
};

g_addPrinter = function(printer) {
    var oldPrinter = g_findPrinter(printer.Key, true);
    if (oldPrinter != null) {
        console.log("[test.js] WARNING: duplicate printer added, the previous entry has been removed.")
    }
    m_printers.push(printer);

    if (m_printers.length > m_peekNumPrinters) {
        m_peekNumPrinters = m_printers.length;
    }
};

g_getPrinterCount = function() {
    return m_printers.length;
};

var test_httpget = require("./test_httpget.js");
app.use("/httpget", test_httpget);

var test_ws = require("./test_ws.js");
app.use("/ws", test_ws);

// ---------- Help page: show usage ----------
app.get("/help", function(req, res) {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "no-cache");
    var body = "<html><b>Stress testing MCP notification service...</b>"
    body += "<br>Step 1: Printers wait for notification:";
    body += "<br>&nbsp;&nbsp;<a href='httpget/wait/1'>1 HTTP request</a>";
    body += "<br>&nbsp;&nbsp;<a href='httpget/wait/2'>2 HTTP requests</a>";
    body += "<br>&nbsp;&nbsp;<a href='httpget/wait/20'>20 HTTP requests</a>";
    body += "<br>&nbsp;&nbsp;<a href='httpget/wait/100'>100 HTTP requests</a>";
    body += "<br>&nbsp;&nbsp;<a href='httpget/wait/1000'>1000 HTTP requests</a>";
    body += "<br>&nbsp;&nbsp;<a href='httpget/wait/10000'>10000 HTTP requests</a>";
    body += "<br>";
    body += "<br>&nbsp;&nbsp;<a href='ws/wait/1'>1 Websocket</a>";
    body += "<br>&nbsp;&nbsp;<a href='ws/wait/2'>2 Websockets</a>";
    body += "<br>&nbsp;&nbsp;<a href='ws/wait/20'>20 Websockets</a>";
    body += "<br>&nbsp;&nbsp;<a href='ws/wait/100'>100 Websockets</a>";
    body += "<br>&nbsp;&nbsp;<a href='ws/wait/1000'>1000 Websockets</a>";
    body += "<br>&nbsp;&nbsp;<a href='ws/wait/10000'>10000 Websockets</a>";
    body += "<br>";
    body += "<br>Step 2: Send the print job notification";
    body += "<br>&nbsp;&nbsp;<a href='/notify'>send notification</a>";
    body += "<br>";
    body += "<br>Step 3: Look at the statistics:";
    body += "<br>&nbsp;&nbsp;<a href='/stats'>stats</a>";
    body += "<br>&nbsp;&nbsp;<a href='/resetstats'>reset stats</a>";
    body += "</html>";
    res.end(body);
});

// ---------- Send notification to the service ----------
app.get("/notify", function(req, res) {
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.setHeader("cache-control", "no-cache");
    http.request({
            host: g_notificationServer,
            port: g_notificationServerPort,
            path: "/notify",
        }, function(newRes) {
            newRes.setEncoding("utf8");
            newRes.on("data", function(message) {
                var body = "Contacting notification server [" + g_notificationServer + ":" + g_notificationServerPort + "] to send the notifications..." +
                           "  \n-> Got back: " + message;
                res.end(body);
            });
        }).end();
    m_notifyTimestampMS = Date.now();
});

// ---------- Statistics ----------
app.get("/stats", function(req, res) {
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.setHeader("cache-control", "no-cache");
    http.request({
            host: g_notificationServer,
            port: g_notificationServerPort,
            path: "/count",
        }, function(newRes) {
            newRes.setEncoding("utf8");
            newRes.on("data", function(message) {
                var body = "Result: ";
                if (m_peekNumPrinters > 0 && m_notifyTimestampMS && m_allPrintersRemovedTimestampMS) {
                    body += "It took " + (m_allPrintersRemovedTimestampMS - m_notifyTimestampMS) + " msec to complete " + m_peekNumPrinters + " notifications.";
                } else {
                    body += "  \nN/A - you must first use test service (this website) to simulate printer wait then send a job notification.";
                }
                res.end(body);
            });
        }).end();
});

app.get("/setserver/:server/:port", function(req, res) {
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.setHeader("cache-control", "no-cache");
    if (req.params.server != "" && req.params.port != "") {
        g_notificationServer = req.params.server;
        g_notificationServerPort = Number(req.params.port);
    }
    var body = "[" + g_notificationServer + ":" + g_notificationServerPort + "]";
    res.end(body);
});


module.exports = app;
