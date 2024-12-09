import axios from 'axios';

let token: string | null = null;

const apiClientHelper = axios.create({
  baseURL: 'https://2uylc3v1a8.execute-api.us-east-2.amazonaws.com/Prod/',
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function authenticate() {
    const response = await apiClientHelper.put("/authenticate", {
      User: {
        name: "ece30861defaultadminuser",
        isAdmin: true,
      },
      Secret: {
        password: "correcthorsebatterystaple123(!__+@**(A'\\\"`;DROP TABLE packages;",
      },
    });
  
    token = response.data;
    console.log("Authenticated with token", token);
}

export async function get(url: string, noheader: boolean = false) {
    let headers;
    if (!noheader) {
        headers = token ? { "X-Authorization": token } : {};
    }
    else { 
        headers = {};
    }
    return apiClientHelper.get(url, { headers });
}
  
export async function post(url: string, data: object, noheader: boolean = false) {
    let headers;
    if (!noheader) {
        headers = token ? { "X-Authorization": token } : {};
    }
    else { 
        headers = {};
    }
    return apiClientHelper.post(url, data, { headers });
}

export async function del(url: string, noheader: boolean = false) {
    let headers;
    if (!noheader) {
        headers = token ? { "X-Authorization": token } : {};
    }
    else { 
        headers = {};
    }
    return apiClientHelper.delete(url, { headers });
}
  
export default { authenticate, get, post, del };