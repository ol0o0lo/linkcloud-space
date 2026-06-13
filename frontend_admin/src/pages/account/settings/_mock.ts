import type { Request, Response } from 'express';
const city = require('./geographic/city.json');
const province = require('./geographic/province.json');

function getProvince(_: Request, res: Response) {
  return res.json({
    data: province,
  });
}

function getCity(req: Request, res: Response) {
  const provinceKey = req.params.province;
  return res.json({
    data: city[provinceKey as keyof typeof city],
  });
}

export default {
  'GET  /api/mock/geographic/province': getProvince,
  'GET  /api/mock/geographic/city/:province': getCity,
};
