// MAPS = [
// 	'china', '山东', '济南市', '长清区', '历下区', '市中区', '历城区', '福州市', '青岛市', '合肥市', '西安市', '成都市', '沈阳市',
// 	'乌鲁木齐市', '德阳市', '长沙市', '海口市', '广州市', '深圳市', '厦门市', '宁波市', '杭州市', '苏州市', '南京市', '徐州市', 
// 	'淮南市', '泰安市', '威海市', '烟台市',  '安徽', '福建', '广东', '海南', '湖南', '江苏', '辽宁', '陕西', '四川', '新疆', 
// 	'浙江', '天津', '上海', '澳门', ]
MAPS = [ 'world', 'china',
	'北京', '天津', '上海', '重庆', '河北', '山西', '辽宁', '吉林', '黑龙江', '江苏',
    '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '海南',
    '四川', '贵州', '云南', '陕西', '甘肃', '青海', '台湾', '内蒙古', '广西', '西藏',
    '宁夏', '新疆', '香港', '澳门'
]

DATA = [
  { name: '山东大学', value: '刘怡诺', loc: [117.028462,36.649481], city: '山东 济南市' },
  { name: '哈尔滨工业大学', value: '史天鸿', loc: [122.089909,37.540047], city: '山东 威海市' },
  { name: '中国海洋大学', value: '袁宇博', loc: [120.505352,36.167816], city: '山东 青岛市' },
  { name: '江南大学', value: '孙田雷', loc: [120.285164,31.489853], city: '苏州 无锡市' },
  { name: '扬州大学', value: '朱延捷', loc: [119.429593,32.385202], city: '苏州 扬州市' },
  { name: '青岛大学', value: '翟松亭', loc: [120.423586,36.076821], city: '山东 青岛市' },
  { name: '山东师范大学', value: '刘云翼', loc: [116.842792,36.557195], city: '山东 济南市' },
  { name: '山东财经大学', value: '李晋洋', loc: [117.378888,36.681088], city: '山东 济南市' },
  { name: '济南大学', value: '李京坤', loc: [116.974575,36.620238], city: '山东 济南市' },
  { name: '浙江传媒学院', value: '吴潇迪', loc: [120.350072,30.326961], city: '浙江 杭州市' },
  { name: '山东第一医科大学', value: '宋国欣', loc: [116.874763,36.682832], city: '山东 济南市' },
  { name: '山东第二医科大学', value: '张沛然 田子萱 张策', loc: [119.040166,36.672282], city: '山东 潍坊市' },
  { name: '湖南中医药大学', value: '聂瑞奇 ', loc: [112.900747,28.135339], city: '湖南 长沙市' },
  { name: '齐鲁师范学院', value: '赵芮彤 ', loc: [117.057875,36.68372], city: '山东 济南市' },
  { name: '齐鲁工业大学', value: '杜悦歌 ', loc: [116.810166,36.563827], city: '山东 济南市' },
  { name: '山东建筑大学', value: '刘子楚 李鑫雨 李思缘 王逸飞', loc: [117.192366,36.686465], city: '山东 济南市' },
  { name: '山东农业大学', value: '孔祥雨 马钰朝 ', loc: [117.12296,36.200713], city: '山东 济南市' },
  { name: '曲阜师范大学', value: '韩文欢 ', loc: [116.975091,35.596899], city: '山东 济宁市' },
  { name: '青岛农业大学', value: '贾昊琛 郑宇杨', loc: [120.404108,36.327029], city: '山东 青岛市' },
  { name: '临沂大学', value: '华志业 ', loc: [118.298597,35.123361], city: '山东 临沂市' },
  { name: '长江大学', value: '刘佳怡 ', loc: [112.216311,30.340899], city: '湖北 荆州市' },
  { name: '沈阳理工大学', value: '高彩荀 ', loc: [123.500795,41.733289], city: '辽宁 沈阳市' },
  { name: '山东石油化工学院', value: '何正彦', loc: [118.548233,37.477501], city: '山东 东营市' },
  { name: '山东理工大学', value: '边培硕 ', loc: [118.008295,36.815484], city: '山东 淄博市' },
  { name: '德州学院', value: '车昱颖', loc: [116.339471,37.476906], city: '山东 德州市' },
  { name: '烟台大学', value: '蔡上朝', loc: [121.464862,37.481883], city: '山东 烟台市' },
  { name: '湖南大学', value: '姚远', loc: [112.950693,28.186051 ], city: '湖南 长沙市' },
  { name: '陕西服装工程学院', value: '赵雅欣', loc: [108.72519,34.309446], city: '陕西 咸阳市' }
  // { name: '', value: '', loc: [], city: '山东' },
  // { name: '', value: '', loc: [], city: '山东' },
  // { name: '', value: '', loc: [], city: '山东' },
  // { name: '', value: '', loc: [], city: '山东' }
];

var convertData = function () {
  var res = [];
  for (var i = 0; i < DATA.length; i++) {
    var geoCoord = DATA[i]['loc'];
    if (geoCoord) {
      res.push({
        name: DATA[i].name,
        value: geoCoord.concat(DATA[i].value).concat(DATA[i].city)
      });
    }
  }
  return res;
};