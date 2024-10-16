import "./loadEnv.js"; // Import enviroments variables
import express from "express";
import { Server } from "socket.io";
import { routes, socketEvent} from "./events/events.js";
import { getAuthorizations } from "./sync/sync.js";
import fs from "fs";
import moment from "moment";

let listenPort = process.env.PORT;
const tymeSync = process.env.TIME_SYNC;

// App setup
const app = express();
const server = app.listen(listenPort, function () {
  console.log("listening for requests on port " + listenPort + "...");
});

// Socket setup & pass server
const io = new Server(server);

app.use(express.json());
app.use(routes(io));

const onConnection = (socket) => {
  console.info(`Client connected [id=${socket.id}]`);
  initInterval(io, socket);
  socketEvent(io, socket);
  
};

io.on("connection", onConnection);

//getAuthorizations();
initSync();

function initInterval(io, socket) {
  if (process.env.TEST_MODE == 1) {
    var test_event = "entry";

    setInterval(() => {
      if (test_event == "entry") {
        fs.readFile("./event_test_entry.json", "utf8", function (err, data) {
          if (err) throw err;
          // obj = JSON.parse(data);
          console.log("Send ENTRY event");
          socket.emit("accessControlEvent", data);
          test_event = "exit";
        });
      } else {
        fs.readFile("./event_test_exit.json", "utf8", function (err, data) {
          if (err) throw err;
          // obj = JSON.parse(data);
          console.log("Send EXIT event");
          socket.emit("accessControlEvent", data);
          test_event = "entry";
        });
      }
    }, 10000);
  }
}

function initSync() {
 
  if (tymeSync > 0) {

    console.log("Synchronization enabled.");
    
    setInterval(() => {
      console.log("Getting auths..." + moment().format('YYYY-MM-DD HH:mm:ss'));  
      getAuthorizations();

    }, tymeSync);

  } else {
    console.log("Synchronization disabled.");
  }
}