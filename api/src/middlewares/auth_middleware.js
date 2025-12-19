const jwt = require('jsonwebtoken');
const { ApplicationError, UnauthorizedError } = require('@strapi/utils').errors;
const SECRET_KEY = process.env.AUTH_SECRET_KEY;
module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    console.log('có vào đây')
    const authHeader = ctx.request.headers['x-authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.send(
        {
          success: false,
          message: 'Bạn không có quyền lấy thông tin'
        }
      );
    }

    const token = authHeader.split(' ')[1];
    let bearTokenDecoded
    try {
      bearTokenDecoded = jwt.verify(token, SECRET_KEY);
      console.log('bearTokenDecoded',bearTokenDecoded)
    }
    catch (e) {
      console.log('có lỗi xảy ra',e)
      return ctx.send(
        {
          success: false,
          message: 'Token đã quá hạng sử dụng'
        }
      );
    }

    console.log(bearTokenDecoded)
    if (!bearTokenDecoded) {
      return ctx.send(
        {
          success: false,
          message: 'Lỗi token'
        }  
      );
    }
    
    let ckeckUser = await strapi.entityService.findOne('api::authuserslog.authuserslog',bearTokenDecoded.id, { populate: '*' })

    if (!ckeckUser) {
      return ctx.send(
        {
          success: false,
          message: 'Thông tin không chính xác'
        }
      );
    } else {
      if (ckeckUser.access_token !== token) {
        throw new UnauthorizedError('Token không hợp lệ');
      }
    }
    ctx.state.userDetail = ckeckUser;
    await next();
  };
};