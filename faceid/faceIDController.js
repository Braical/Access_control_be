import { devices } from "../loadEnv.js";
import AccessControlEvent from "../events/accessControlEvent.js";
import { saveEntryLog, saveExitLog, sendAck } from "../sync/sync.js";
import requestDigest from "request-digest";
import fs from "fs";

//import { JsonDB, Config } from "node-json-db";
//const db = new JsonDB(new Config("./database/database.json", true, false, "/"));

/**
 * Gets the person's data stored in the faceid
 * employeeNo: The id of the person in the face id, in this case the dni is used.
 */

function readImageAsBase64(imagePath) {
  try {

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");
    return base64Image;
  
  } catch (error) {
    console.error("Error reading image: ", error);
    return null;
  }
}

const getUser = async (employeeNo, deviceName, eventType, io) => {
  let username,
    password,
    faceIdIp = "";

    username = devices[deviceName].username;
    password = devices[deviceName].password;
    faceIdIp = devices[deviceName].ip;

  const digestRequest = requestDigest(username, password);
  const host = "http://" + faceIdIp;
  const digestOptions = {
    host,
    path: "/ISAPI/AccessControl/UserInfo/Search?format=json",
    port: 80,
    method: "POST",
    json: true,
    body: {
      UserInfoSearchCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 30,
        EmployeeNoList: [
          {
            employeeNo: employeeNo,
          },
        ],
      },
    },
    headers: {
      "Content-Type": "application/json",
    },
  };

  try {
    const response = await digestRequest.requestAsync(digestOptions);
    const objUser = JSON.parse(JSON.stringify(response.body));

    const dni = objUser.UserInfoSearch.UserInfo[0].employeeNo;
    const usr_name = objUser.UserInfoSearch.UserInfo[0].name;

    const personInfoExtends =
      objUser.UserInfoSearch.UserInfo[0].PersonInfoExtends; //ex. PersonInfoExtends":[{"value":"{"uf":"108", "lote":"105", "category_id":"PROPIETARIO"}]

    const objPersonInfoExtends = JSON.parse(personInfoExtends[0].value);

    const lote = objPersonInfoExtends.lote.toString();
    const UF = objPersonInfoExtends.uf.toString();
    const category_id = objPersonInfoExtends.category_id.toString();
     
    const objAccessControlEvent = new AccessControlEvent(
      dni,
      usr_name,
      lote,
      UF,
      eventType,
      category_id
    );

    //return getPicture(dni, objAccessControlEvent, io);
    //return getPictureFromFaceID(digestRequest, objAccessControlEvent, faceIdIp, io) 
    return getPictureFromLocal(dni, objAccessControlEvent, io)  

  } catch (error) {
    console.log("getUser", error);
  }
};

/**
 * Gets the image of the person stored in the faceid
 * objAccessControlEvent: It is an object of the AccessControlEvent class to complete the value of the image.
 */

const getPicture = async (dni, objAccessControlEvent, io) => {
  try {
    const localImage = readImageAsBase64(`./images/${dni}.jpg`);

    // console.log(localImage);

    objAccessControlEvent.setPicture(localImage);

    // Emits the event so that the front end is notified of the event and displays it.
    io.sockets.emit(
      "accessControlEvent",
      JSON.stringify(objAccessControlEvent)
    );

    return objAccessControlEvent;
  } catch (error) {
    console.log("getPicture", error);
  }
};

/** 
 * Gets the image of the person stored in the faceid
 * objAccessControlEvent: It is an object of the AccessControlEvent class to complete the value of the image.
*/

const getPictureFromFaceID = async (digestRequest, objAccessControlEvent, faceIdIp, io) => {

  const host = "http://" + faceIdIp;
  //const dni = objAccessControlEvent.id;

  const digestOptions = {
    host,
    path: "/ISAPI/Intelligent/FDLib/FDSearch?format=json",
    port: 80,
    method: "POST",
    json: true,
    body: {
          "searchResultPosition": 0,
				  "maxResults": 30,
				  "faceLibType": "blackFD",
				  "FDID": "1",
				  "FPID": dni // Id de persona
        },
    headers: {
      "Content-Type": "application/json",
    },
  };

  try {
    const response = await digestRequest.requestAsync(digestOptions);
  
		const obj = JSON.parse(JSON.stringify(response.body));
				
		var status = obj.responseStatusStrg; // OK or  NO MATCH
		
		if (status == "OK"){

			// The url of the image stored in the Face Id is obtained from the answer.

			const faceURL = obj.MatchList[0].faceURL; // format http://192.168.0.104/LOCALS/pic/enrlFace/0/0000000001.jpg@WEB000000000029
			const urlParts = faceURL.split("/");
			const path = urlParts.slice(3).join("/"); // LOCALS/pic/....
		
			// With this url that returns the Face Id we make the call again with the authentication to obtain the image.

      const digestOptionsPic = {
        host,
        path: '/' + path,
        port: 80,
        method: "GET",
        encoding: null 
      };

      try {
			  const responsePic = await digestRequest.requestAsync(digestOptionsPic)

        fs.writeFileSync(`./images/${dni}.jpg`, Buffer.from(responsePic.body, "utf-8"), "binary");
		
        const localImage = readImageAsBase64(`./images/${dni}.jpg`);

        //console.log(localImage);

        objAccessControlEvent.setPicture(localImage);

        // console.log(objAccessControlEvent);

        // Emits the event so that the front end is notified of the event and displays it.
        io.sockets.emit(
          "accessControlEvent",
          JSON.stringify(objAccessControlEvent)
        );
        
        // Send event to AC Central
        
        if (objAccessControlEvent.event_type == "ENTRY") {
          saveEntryLog(objAccessControlEvent.id, objAccessControlEvent.UF);
        } else {
          saveExitLog(objAccessControlEvent.id);
        }

				// Saves the event in the database
				//db.push("/event[]/entry", objAccessControlEvent);

        return objAccessControlEvent;

			} catch (error) {
        console.log("getPicture error ", error);
      }
			
		}

  } catch (error) {
    console.log("getPicture error ", error);
  }

}

/** 
 * Gets the image of the person stored in the disk
 * objAccessControlEvent: It is an object of the AccessControlEvent class to complete the value of the image.
*/

const getPictureFromLocal = async (dni, objAccessControlEvent, io) => {

  const localImage = readImageAsBase64(`./images/${dni}.jpg`);
  
  console.log("Getting image from local...");

  //console.log(localImage);

  objAccessControlEvent.setPicture(localImage);

  // console.log(objAccessControlEvent);

  // Emits the event so that the front end is notified of the event and displays it.
  io.sockets.emit(
    "accessControlEvent",
    JSON.stringify(objAccessControlEvent)
  );
  
  // Send event to AC Central
  
  if (objAccessControlEvent.event_type == "ENTRY") {
    saveEntryLog(objAccessControlEvent.id, objAccessControlEvent.UF);
  } else {
    saveExitLog(objAccessControlEvent.id);
  }

    // Saves the event in the database
    //db.push("/event[]/entry", objAccessControlEvent);

    return objAccessControlEvent;

}

const callDigest = async (device, userInfo, onlyDelete=false) => {
  try {
    const digestRequest = requestDigest(device.username, device.password);

    const document = userInfo.document;

    const result1 = await deletePicture(digestRequest, device, document);

    if (result1 === undefined ) { // Timeout, device is not on-line
      throw new Error(`Device ${device.name} is off-line`);
    }

    const result2 = await deleteUser(digestRequest,device,document);

    if (!onlyDelete) {
      const result3 = await addNewUser(digestRequest, device, userInfo);

      const result4 = await addNewPicture(digestRequest, device, document, userInfo.image_url);
    }

    //console.log("result callDigest",result.body);

    return true;

  } catch (error) {
    
    console.log("error callDigest", error);
	return false;
  }
};

/**
 * User info.
 * @typedef {Object} UserInfo
 * @property {string} document - individual document number.
 * @property {string} name - Indvidual name and lastname.
 * @property {string} beginTime - Data and time form individual is enabled. Format YYYY-MM-DDTHH:MM_SS.
 * @property {string} endTime - Data and time to individual is enabled. Format YYYY-MM-DDTHH:MM_SS.
 * @property {string} uf - Indvidual uf.
 * @property {string} lote - Indiviual lote.
 * @property {string} picture_url - Individual Pucture url.
 */

/**
 * Procecess a User (Delete if existe, add user, delete picture if exist and add picture).
 * @param  {UserInfo} userInfo - {@link UserInfo} object
 * @return {void}
 */

const processUser = async (userInfo, onlyDelete) => {

  for (let key in devices) {

    const device = devices[key];

    const result = await callDigest(device, userInfo, onlyDelete);

    if (result) {
  
      const gate = devices[key].name
      sendAck(userInfo.id_auth, gate);
 
    } else {
      return false;
    }

  }

  return true;
};

const deleteUser = async (digestRequest, device, document) => {
    try {
        const path = "/ISAPI/AccessControl/UserInfo/Delete?format=json";
  
        const body = {
          UserInfoDelCond: {
            EmployeeNoList: [{ employeeNo: document }],
          },
        };
  
        const options = {
            host: "http://" + device.ip,
            path: path,
            port: 80,
            method: "PUT",
            json: false,
            body: JSON.stringify(body),
            headers: {
            	"Content-Type": "application/json",
            },
        };
      
        const result = await digestRequest.requestAsync(options);

        //console.log("result image deleteUSer", result);
        console.log(`User ${document} deleted successfully.`);

		return result.body;

    } catch (error) {
        console.log("error deleteUser", error);
    }
};

const addNewUser = async (digestRequest, device, userInfo) => {
    try {
        const path = "/ISAPI/AccessControl/UserInfo/Record?format=json";

        const propertyValue = `{"uf":"${userInfo.uf}", "lote":"${userInfo.lote}", "category_id":"${userInfo.category_id}"}`;

        const body = {
          UserInfo: {
            "employeeNo":userInfo.document,
            "deleteUser":null,
            "name":userInfo.fullname,
            "userType":"normal",
            "closeDelayEnabled":false,
            "Valid":{
              "enable":true,
              "beginTime":userInfo.beginTime,
              "endTime":userInfo.endTime,
              "timeType": "local",
            },
            "gender": "male",
            "localUIRight":false,
            "maxOpenDoorTime":0,
            "doorRight":"1",
            "RightPlan":[{"doorNo":1,"planTemplateNo":"1"}],
            "userVerifyMode":"",
            "PersonInfoExtends": [
              {
                "name": "properties",
                "value": propertyValue,
              },
            ],
          },
        };

        const options = {
            host: "http://" + device.ip,
            path: path,
            port: 80,
            method: "POST",
            json: false,
            body: JSON.stringify(body),
            headers: {
            "Content-Type": "application/json",
            },
        };

        const result = await digestRequest.requestAsync(options);

        //console.log("result image addNewUser", result);
        console.log(`User ${userInfo.document}: added successfully.`);

		return result.body;

    } catch (error) {
        console.log("error addNewUser", error);
    }
};

const deletePicture = async (digestRequest, device, document) => {
    try {
        const path = "/ISAPI/Intelligent/FDLib/FDSearch/Delete?format=json&FDID=1&faceLibType=blackFD";
  
        const body = {
                        "FPID":[
                            {"value": document}
                        ]
                    };
        var b = JSON.stringify(body);            

        const options = {
            host: "http://" + device.ip,
            path: path,
            port: 80,
            method: "PUT",
            json: false,
            body: b,
            headers: {
            "Content-Type": "application/json",
            },
        };
      
        const result = await digestRequest.requestAsync(options);

        //console.log("result image deletePicture", result);
        console.log(`User ${document}: image deleted successfully.`);

		return result.body;

    } catch (error) {
        console.log("error deletePicture", error);
    }
};

const addNewPicture = async (digestRequest, device, document, url_file) => {
    try {
        const path = "/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json";

        const body = {
            faceLibType: "blackFD",
            FDID: "1",
            FPID: document,
            faceURL: url_file,
        };
        
        const json_body = JSON.stringify(body);

        const options = {
            host: "http://" + device.ip,
            path: path,
            port: 80,
            method: "POST",
            json: false,
            body: json_body,
            headers: {
            "Content-Type": "application/json",
            },
        };

        const result = await digestRequest.requestAsync(options);

        //console.log("result image addNewPicture", result);
        console.log(`User ${document}: image added successfully.`);

		return result.body;

    } catch (error) {
        console.log("error addNewPicture", error.body);
    }
};

export { getUser, getPicture, processUser };
