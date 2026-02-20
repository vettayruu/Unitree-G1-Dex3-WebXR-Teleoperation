"use client";

function generateUUID() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

function getOrSetUUID() {
    const cookieName = "sip3m_uuid";
    
    // Cookie Get
    function getCookie(name) {
        const cookies = document.cookie.split("; ");
        for (let cookie of cookies) {
            let [key, value] = cookie.split("=");
            if (key === name) {
                return value;
            }
        }
        return null;
    }

    // Cookie Save
    function setCookie(name, value, days) {
        let expires = "";
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + value + "; path=/" + expires;
    }

    if (!window.name){
        window.name = Math.random().toString(36).slice(2,9);
    }

    // Get new UUID
    let uuid = getCookie(cookieName);
    if (!uuid) {
        uuid = generateUUID(); // crypto.randomUUID();
        setCookie(cookieName, uuid, 365); 
    }
    let name = window.name;
    if(window.location.pathname.endsWith("/viewer/")) {
        name = name+ "-viewer";
    }
    if(window.location.pathname.endsWith("/monitor/")) {
        name = name+ "-monitor";
    }
    // return uuid + "-" + name; 
    return uuid + "-local";
}

export const userUUID = getOrSetUUID(); 
console.log("User UUID:", userUUID);