module.exports = {
    routes: [
         {
            method: "POST",
            path: "/user-info/login",
            handler: "user-info.userLogin",
            config: {
                auth: false,
            },
        },
        {
            method: "GET",
            path: "/user-info/me",
            handler: "user-info.me",
            config: {
                auth: false,
                policies: ["global::app-auth"],
            },
        },
        {
            method: "POST",
            path: "/user-info/refresh",
            handler: "user-info.refresh",
            config: {
                auth: false,
            },
        },
        {
            method: "POST",
            path: "/user-info/logout",
            handler: "user-info.logout",
            config: {
                auth: false,
                policies: ["global::app-auth"],
            },
        },
    ]
}
