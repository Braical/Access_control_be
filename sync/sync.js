import { gates } from "../loadEnv.js";
import {processUser } from "../faceid/faceIDController.js";
import { downloadImage } from "../utils/utils.js";
import fetch from 'node-fetch';
import moment from "moment";


const getToken = async () => {
  
  const url_api = process.env.URL_API;
  const username = process.env.API_USERNAME;
  const password = process.env.API_PASSWORD;
  const id_barrio = process.env.ID_BARRIO;

  const url = url_api + "/getToken";

  var options = {
    method: 'get',
    headers: {
      'idBarrio': id_barrio
      ,'Authorization': `Basic ${btoa(`${username}:${password}`)}`
    },
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (data.code == 200) {
    return data.data.token;
  } else {
    console.error("Error getting token: ", data.message);
  }

}

const getAuthorizations = async () => {

  try {
    const url_api = process.env.URL_API;
    const id_barrio = process.env.ID_BARRIO;
    const guard_post = process.env.GUARD_POST_NAME;

    const token = await getToken();
    
    if (token) {
      var paramgates = gates.join(",");

      const params = "?types=resident-ALL,permanent-SOCIO&with_picture=1&gates=" + paramgates + "&guard_post=" + guard_post;
      const url = url_api + "/accesscontrol/authorization/sync/all" + params;

      var options = {
        'method': 'GET',
        'headers': {
          'idBarrio': id_barrio,
          'Authorization': `Bearer ${token}`
        }
      };
    
      try {
      
        const response = await fetch(url, options);
        const data = await response.json();

        console.log(data.data.NEW.length + " records recived to add");

        if(data.data.NEW.length > 0){
            precessNews(data.data.NEW);
        }

        console.log(data.data.DELETE.length + " records recived to delete");

        if(data.data.DELETE.length > 0){
            precessNews(data.data.DELETE, true);
        }

      } catch (error) {
        console.error("Error getting auths: ", error);
        return false;
      }
    
    }

  } catch (error) {
    if (error.code == "ENOTFOUND") {
      console.error("Error getting auths: OFFLINE (without internet connection)");
    } else {  
      console.error("Error getting auths: ", error.code);
    }
    return false;
  }
}

const precessNews = async (auths, onlyDelete=false) => {

  var date_from, hour_from, date_to, hour_to;
  
  try {

    for (const auth of auths) {
    
      var today = new Date();
      
      date_from = today.getFullYear() + "-" +  (today.getMonth() + 1).toString().padStart(2, "0") + "-01" ;
      hour_from = "00:00:00";  

      if (!auth.dates){
        // continue;
        date_to = "2037-12-31"; // Maximun date allowed by Face id
        hour_to = "23:59:59";
      } else {
                    
        // Set begin date to one day before due face id issue
        // var beginDate = new Date(auth.dates.auth_date_from);
        // beginDate.setDate(beginDate.getDate() - 1);

        // const begin_date = beginDate.getFullYear() + "-" 
        //                   + (beginDate.getMonth() + 1).toString().padStart(2, "0") + "-" 
        //                   +  beginDate.getDate().toString().padStart(2, "0")
        //                   + "T00:00:00"
            
        if (auth.dates.auth_date_to !== null && auth.dates.auth_date_to != "0000-00-00") {
          date_to = auth.dates.auth_date_to;
          hour_to = auth.dates.auth_hour_to;
        } else {
          date_to = "2037-12-31"; // Maximun date allowed by Face id
          hour_to = "23:59:59";
        }
      }
      
      const id_auth = auth.id;

      const userInfo = {
                      document: auth.individual.document.toString(),
                      fullname: auth.individual.name + " " + auth.individual.lastname,
                      beginTime: date_from + "T" + hour_from,
                      endTime: date_to + "T" + hour_to,
                      uf: auth.uf.toString(),
                      lote: auth.uf.toString(),
                      eventType: "NEW_INDIVIDUAL",
                      image_url: auth.individual.images[0].full_picture_url,
                      category_id: auth.category,
                      id_auth: id_auth,
                    };

      downloadImage(auth.individual.images[0].full_picture_url, `./images/${auth.individual.document}.jpg`);

      const response = await processUser(userInfo, onlyDelete);

      // if (response) {
        
      //   sendAck(id_auth);

      // } 

    }

  } catch (error) {
    console.error("Error processing news: ", error);
    return false;
  }
}

const sendAck = async (id_auth, gate) => {
    
  try {

    const processed_at = moment().format('YYYY-MM-DD HH:mm:ss');
    const url_api = process.env.URL_API;
    const id_barrio  = process.env.ID_BARRIO; 
    
    const token = await getToken();

    if (token) {

      const url = url_api + "/accesscontrol/authorization/sync/ackProcessed";

      const body = {
                    "auths": [
                              {
                                "status": true,
                                "id_auth": id_auth,
                                "gate": gate,
                                "details": "The autorization was processed successful",
                                "date": processed_at
                              }
                            ]
                          };

      var options = {
        'method': 'PUT',
        'headers': {
          'idBarrio': id_barrio,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      };

      console.log("Sending ACK auth " + id_auth);

      const response = await fetch(url, options);
      const data = await response.json();  
      if (data.code == 200) {
        console.log("ACK auth " + id_auth + " for Gate " + gate + " sended OK");
        return true;
      } else {
        console.log("ACK auth " + id_auth + " for Gate " + gate + " sended with error: " + data.message);
        return false;
      }

    }

  } catch (error) {
    console.error("Error sending ack: ", error);
    return false;
  }
  
}

const saveEntryLog = async (document, uf) => {
  
  try {

    console.log("Sending log Entry...");

    const url_api = process.env.URL_API;
    const id_barrio  = process.env.ID_BARRIO; 
    
    const token = await getToken();

    if (token) {

      const url = url_api + "/accesscontrol/individual/" + document + "/entry";

      const body = {
                      "individual": {
                                    "car": {}
                                    },
                      "uf": [uf],
                      "notify": false
                    };

      var options = {
        'method': 'POST',
        'headers': {
          'idBarrio': id_barrio,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      };

      const response = await fetch(url, options);
      return true;
    }

  } catch (error) {
    console.error("Error saving log entry: ", error);
    return false;
  }
}

const saveExitLog = async (document) => {
    
  try {

    console.log("Sending log Exit...");

    const url_api = process.env.URL_API;
    const id_barrio  = process.env.ID_BARRIO; 
    
    const token = await getToken();

    if (token) {

      const url = url_api + "/accesscontrol/individual/" + document + "/exit";

      const body = {
                      "notify": false
                    };

      var options = {
        'method': 'POST',
        'headers': {
          'idBarrio': id_barrio,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      };

      const response = await fetch(url, options);
      return true;
    }
  
  } catch (error) {
    console.error("Error saving log exit: ", error);
    return false;
  }

}

export {getAuthorizations, saveEntryLog, saveExitLog, sendAck};
