import { devices } from "../loadEnv.js";
import { Router } from "express";
//import { IncomingForm } from "formidable";
import { getUser, processUser } from "../faceid/faceIDController.js";
import { downloadImage } from "../utils/utils.js";
import fs from "fs";
import multer  from "multer";

const multiform = multer({ dest: 'uploads/' })

const router = new Router();

const routes = (io) => {
  //THIS IS JUST A SAMPLE ENDPOINT TO AVOID USING POSTMAN
  router.get("/event", async (req, res) => {
    //await db.push("/test1", Math.random());
    await db.push("/test2/my/test", 5);

    io.sockets.emit("test", { test: true });
    res.json({
      test: true,
    });
  });

  router.get("/events", async (req, res) => {
    //TODO: SIMPLESOLUTIONS SERVER IS GONNA CALL IT AND SYNC WITH MYSQL DATABASE
    //DELETE LOGS
  });

  //THIS IS CALLED FROM SIMPLESOLUTIONS SERVER
  //POST http://198.121.123.113:3333/auth
  //API-KEY
  router.post("/auth", async (req, res) => {
    if (req.method === "POST") {
      // Handle post info...
      const fields = req.body;

      const userInfo = {
        document: fields.document.toString(),
        fullname: fields.name + " " + fields.lastname,
        beginTime: fields.date_from + "T" + fields.hour_from,
        endTime: fields.date_to + "T" + fields.hour_to,
        uf: fields.uf.toString(),
        lote: fields.lote.toString(),
        eventType: fields.event_type.toString(),
        image_url: fields.image_url.toString(),
      };

      downloadImage(userInfo.image_url, `./images/${userInfo.document}.jpg`);

      const response = await processUser(userInfo);

      if (response) {
        
        res.statusCode = 200;
        res.json({
          status: true,
        });

      } else {

        res.statusCode = 400;
        res.json({
          status: false,
        });

      }
    }
  });

  //THIS IS CALLED FROM THE FACE ID
  //POST http://198.xxx.xxx.xxx:3888/event

router.post("/event", multiform.single('Picture'), async (req, res) => {
  const obj = JSON.parse(req.body.event_log);
  const subEventType = obj.AccessControllerEvent.subEventType;

  // Manejar múltiples tipos de eventos
  if (subEventType == 75 || subEventType == 6 || subEventType == 21 || subEventType == 22) {
    // subEventType == 6  --> Sin permiso
    // subEventType == 75 --> Autenticación facial completada
    // subEventType == 21 --> Puerta desbloqueada
    // subEventType == 22 --> Puerta bloqueada
    
    deviceName = obj.AccessControllerEvent.deviceName;
    eventType = devices[deviceName].type;
    dni = obj.AccessControllerEvent.employeeNoString;

    await getUser(dni, deviceName, eventType, io);
  }

  // Siempre responder "ok" aunque el evento no se haya procesado
  res.end("ok");
});
  

  router.post("/test", async (req, res) => {
    const result = await getUser(req.body.dni, "ENTRY", io);

    res.send(result);
  });

  return router;
};

//WE DON'T NEED TO USE THIS RIGHT NOW, JUST AN EXAMPLE
const socketEvent = (io, socket) => {
  socket.on("test", () => {
    console.log("someone sends a test to the server");
  });
};

export { routes, socketEvent};
