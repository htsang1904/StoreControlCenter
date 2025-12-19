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
    ]
}