﻿var chartDom = document.getElementById("main");
var myChart = echarts.init(chartDom, null, 
    // 通过svg渲染，可以一试，反正兼容不了一点
    // {renderer: 'svg'}
);
var rootStyles = getComputedStyle(document.documentElement);
option = null;

var mainColor = '#f3f8ff';
var textColor = '#9da5b3';
var borderColor = '#029fd4';
var spotColor = '#ff9070';
var tooltipColor = '#c8c841';

// 把css变量抓过来，方便修改
mainColor = rootStyles.getPropertyValue('--mainColor');
textColor = rootStyles.getPropertyValue('--textColor');
borderColor = rootStyles.getPropertyValue('--borderColor');
spotColor = rootStyles.getPropertyValue('--spotColor');
tooltipColor = rootStyles.getPropertyValue('--tooltipColor');

// 获取位置
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(successCallback, errorCallback);
}
function successCallback(position) {
    // console.log('纬度：', position.coords.latitude);
    // console.log('经度：', position.coords.longitude);
    // console.log('精度：', position.coords.accuracy);
    option.series[0].data.push({name: '我的位置', value: [position.coords.longitude, position.coords.latitude, '', '某某省 您的定位所在位置']});
    myChart.setOption(option);
}
function errorCallback(error) {
    console.log('获取地理位置信息失败：', error.message);
}

// 判断当前操作系统是否为移动设备
var os = function () {
    var ua = navigator.userAgent,
        isWindowsPhone = /(?:Windows Phone)/.test(ua),
        isSymbian = /(?:SymbianOS)/.test(ua) || isWindowsPhone,
        isAndroid = /(?:Android)/.test(ua),
        isFireFox = /(?:Firefox)/.test(ua),
        isChrome = /(?:Chrome|CriOS)/.test(ua),
        isTablet = /(?:iPad|PlayBook)/.test(ua) || (isAndroid && !/(?:Mobile)/.test(ua)) || (isFireFox && /(?:Tablet)/.test(ua)),
        isPhone = /(?:iPhone)/.test(ua) && !isTablet,
        isPc = !isPhone && !isAndroid && !isSymbian;
    return {
        isTablet: isTablet,
        isPhone: isPhone,
        isAndroid: isAndroid,
        isPc: isPc
    };
}();

option = {
    graphic: [{
        type: 'text', // 图形类型为文本
        left: 'center', // 文本水平居中
        top: 15, // 文本距离顶部的距离
        style: { // 文本样式设置
            text: '{a|毕业蹭饭地图}\n\n{b|山东师大附中 2018 级 3 班}',
            rich: {
                a: {
                    fontSize: '25px',
                    fill: textColor, // 字体颜色
                    stroke: borderColor, // 描边颜色
                    lineWidth: 2, // 描边宽度
					textAlign: 'center',
                },
                b: {
                    fontSize: '15px',
                    fill: textColor, // 字体颜色
                    stroke: borderColor, // 描边颜色
                    lineWidth: 2, // 描边宽度
                },
            },
        },
        z:99,
      }],
    tooltip: {
        trigger: 'item',
        // triggerOn:'mousemove',
        hideDelay: 300,
        confine: true, // 是否约束 content 在 viewRect 中。默认 false 是为了兼容以前版本。
        borderColor : '#fff',
        textStyle: {
            fontWeight: 'regular',
            fontFamily: 'Yahei',
            fontSize: 22,
            // backgroundColor: 'rgba(40, 44, 52, 0.5)',
            // color: tooltipColor
        },
        formatter: function (params) { 
            return params.name 
                + '（' + params.value[3].split(' ')[1] + '）<br/>' 
                + params.value[2]; 
        }
    },
    toolbox: {
        show: false,
        orient: 'vertical',
        itemSize: 28,
        top: 15,
        left: 15,
        feature: {
            // saveAsImage: {},
            // 这个自带的存图功能不能保存背景图
            myAbout:{
                // title: '返回',
                // icon是gpt生成的
                icon: 'M20,11H7.4l4.3-4.3c0.4-0.4,0.4-1,0-1.4s-1-0.4-1.4,0L3.6,11.6c-0.4,0.4-0.4,1,0,1.4l6.7,6.7c0.4,0.4,1,0.4,1.4,0s0.4-1,0-1.4L7.4,13H20c0.6,0,1-0.4,1-1S20.6,11,20,11z',
                onclick: function () {
                    option.geo.roam = true;
                    if(parentMaps.length > 0){
                        changeMap(parentMaps[parentMaps.length - 1]);
                        var popPlace=parentMaps.pop();
						option.graphic[0].style.text = 
							'{a|毕业蹭饭地图}\n\n{b|山东师大附中 2018 级 3 班'+(popPlace=='china'?'':' - '+popPlace)+'}';
                    }
                    myChart.setOption(option);
                }
            }
        },
        iconStyle: {
            normal: {
                borderColor: borderColor,
                color: '#fff'
            }
        },
    },
    geo: {
        // zoom: 1.2,
        zoom: 2.5,
        left: -100,
        map: 'china',
        label: {
            normal: {
                show: false
            },
            emphasis:{
                show: false
            }
        },
        //缩放
        roam: true,
        scaleLimit: {
            min: 1,
            max: 10,
        },
        itemStyle: {
            normal: {
                areaColor: mainColor,
                borderColor: borderColor
            },
            emphasis: {
                areaColor: '#fff',
            }
        },
        // silent: true // 静默设为 true，则鼠标移至相应地区则不会显示省份名，点也不会有反应
    },
    series: [{
        name: '大学',
        type: 'scatter',
        coordinateSystem: 'geo',
        data: convertData(),
        symbol: 'pin',
        symbolSize: 30,
        label: {
            normal: {
                formatter: '{b}',
                // position: 'right',
                show: true
            }
        },
        itemStyle: {
            normal: {color: spotColor}
        }
    },],
};


var parentMaps = new Array(); // 维护一个 array，用于记录地图路径
//e.g. http://127.0.0.1/class-tri#威海
function checkUrl() {
    var url = window.location.href;
    if (url.indexOf('#') == -1) return 'china';
    place = url.substring(url.indexOf('#') + 1);
    place = decodeURI(place);
    console.log(place);
    if (MAPS.indexOf(place) != -1) {
        parentMaps.push('china');
        // option.geo.label.show = true;
        return place;
    }
    else return 'china';
};
option.geo.map = checkUrl();

if (option && typeof option === "object") {
    myChart.setOption(option);
    myChart.resize();
    // setTimeout(function () {
    //     alert("使用说明：\n1) 点一下大学对应的橙色标记，会显示出在这个大学的同学名单\n2) 点一下每个省份的地图，将会进入到各个省份的高清大图模式\n3) 对于人数较多的区，也提供高清大图，可以点\n4) 点两下背景图片将返回到上一级地图\n5) 如果使用电脑查看此蹭饭图，还可以直接用鼠标滚轮进行缩放\n6) 地图右侧小手按钮重置地图\n7) 网页改编自 https://ssfz.top 山东师大附中 2018 级 10 班毕业蹭饭地图") 
    // },500);
}

// 改变地图，传入新的地点
function changeMap(newPlace) {
    if(newPlace != 'china'){
        option.graphic[0].style.text =
			'{a|毕业蹭饭地图}\n\n{b|山东师大附中 2018 级 3 班 - '+newPlace+'}';
        option.geo.zoom = 1;
        option.geo.left = 'center';
        option.toolbox.show = true;
    }
    else{
        option.graphic[0].style.text =
			'{a|毕业蹭饭地图}\n\n{b|山东师大附中 2018 级 3 班}';
        option.geo.zoom = 2.5;
        option.geo.left = -100;
        option.toolbox.show = false;
    }
    option.geo.map = newPlace;
    //去除了缩放动画
    myChart.setOption(option, true);
}
myChart.on('click', function (params) {
    if (params.name == '南海诸岛') {
        params.name = '海南';
    }
    if (MAPS.indexOf(params.name) != -1) {
        parentMaps.push(option.geo.map);
        changeMap(params.name);
    }
});

// 由于拖拽地图也会触发 click 事件，所以这里判断一下鼠标按下和抬起的位置坐标变化
// var downX, downY;
// $('#main').mousedown(function (e) {
//     downX = e.pageX;
//     downY = e.pageY;
// });
// $('#main').mouseup(function (e) {
//     var upX = e.pageX;
//     var upY = e.pageY;
//     var dltX = Math.abs(upX - downX);
//     var dltY = Math.abs(upY - downY);
//     if (dltX <= 5 && dltY <= 5 && parentMaps.length > 0) {
//         changeMap(parentMaps[parentMaps.length - 1]);
//         parentMaps.pop();
//     }
// });
// 

// 监听zoom，近用于辅助设置scaleLimit，不要忘记注释掉
// var zoomK=3;
// myChart.on('georoam',function(params){
//     var option = myChart.getOption();//获得option对象
// 	if(params.zoom!=null&&params.zoom!=undefined){ //捕捉到缩放时
//         console.log(option.geo[0].zoom);
//         // option.geo[0].zoom*=params.zoom;
//         myChart.setOption(option);//设置option
// 	}
// });