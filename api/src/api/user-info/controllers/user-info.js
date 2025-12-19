'use strict';

/**
 * user-info controller
 */
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const publicKeyPath = path.join(process.cwd(), "src/keys/oauth-public.key");
const publicKey = fs.readFileSync(publicKeyPath, "utf8");
const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::user-info.user-info', ({strapi}) => ({
    async userLogin(ctx) {
        let data = ctx.request.body
        let userDetail = data.profile
        let checkTokenSuite = false;
        try {
            const decoded = jwt.verify(data.token, publicKey, {
            algorithms: ["RS256"],
            clockTolerance: 10,
            });
            checkTokenSuite = true;
        } catch (err) {
            console.log(err);
            checkTokenSuite = false;
        }
        if (checkTokenSuite) {
            try {
                const checkUser = await strapi.entityService.findMany(
                    "api::user-info.user-info",
                    {
                        filters: { email: userDetail.email },
                        populate: "*",
                    }
                );
                if (checkUser.length) {
                    let jwtToken = jwt.sign(
                        { id: checkUser[0].id, email: checkUser[0].email },
                        process.env.AUTH_SECRET_KEY,
                        { expiresIn: "1y" }
                    );
                    await strapi.entityService.update('api::user-info.user-info', checkUser[0].id,
                    {
                        data: {
                            access_token: jwtToken,
                            suite_token: data.token,
                        },
                    }
                    );
                    return ctx.send({
                        userInfo: checkUser[0],
                        token: jwtToken,
                        success: true,
                    });
                } else {
                    // let defaultRole = await strapi.db.query("api::user-role.user-role").findOne({
                    //     where: { value: 3 },
                    // });
                    // let defaultDepartment = await strapi.db.query("api::user-role.user-role").findOne({
                    //     where: { value: 0 },
                    // });
                    const createUser = await strapi.entityService.create('api::user-info.user-info',
                        {
                            data: {
                                name: userDetail.name,
                                email: userDetail.email,
                                // user_role: defaultRole.id,
                                // departments: defaultDepartment.id,
                                suite_token: data.token,
                            },
                            populate: '*',
                        }
                    );
                     let jwtToken = jwt.sign(
                        { id: createUser.id, email: createUser.email },
                        process.env.AUTH_SECRET_KEY,
                        { expiresIn: "1y" }
                    );
                    await strapi.entityService.update('api::user-info.user-info',
                        createUser.id,
                        {
                            data: {
                                access_token: jwtToken,
                            },
                        }
                    );

                    return ctx.send({
                        userDetail: createUser,
                        token: jwtToken,
                        success: true,
                    });
                }
            } catch (error) {
                console.error("Lỗi", error);
                return ctx.send({
                    success: false,
                    message: error,
                });
            }
        } else {
            return {
                success: false,
                message: "Thông tin đăng nhập không chính xác",
            };
        }
    }
}));
