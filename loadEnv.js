import dotenv from 'dotenv';
dotenv.config();

const devices_connected = parseInt(process.env.DEVICES_CONNECTED, 10);

var devices = [];
var gates = [];

for(let i = 1; i <= devices_connected; i++) {
    
    const devicename_key = "FACEID_" + i +"_DEVICENAME";
    const devicename = process.env[devicename_key];
    
    gates.push(devicename);

    devices[devicename] = {
        "type": process.env["FACEID_" + i + "_TYPE"],
        "name": process.env["FACEID_" + i + "_DEVICENAME"],
        "username": process.env["FACEID_" + i + "_USER"],
        "password": process.env["FACEID_" + i + "_PASS"],
        "ip": process.env["FACEID_" + i + "_IP"]
    }

}

export {devices, gates};