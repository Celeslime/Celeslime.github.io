// 这个地图参考了 https://github.com/Heriyadi235/17dbsyg2cft，在此致谢

var dom = document.getElementById("main");
var myChart = echarts.init(dom, 'shine');
option = null;

var mainColor = '#f3f8ff';
var textColor = '#9da5b3';
var borderColor = '#029fd4';
var spotColor = '#ff9070';
var tooltipColor = '#c8c841';

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
    title: {
        text: '山东师大附中 2018 级 3 班毕业蹭饭地图（交互版）',
        // subtext: '班主任：',
        left: 'center',
        textStyle: { color: textColor, fontSize: 30 },
        subtextStyle: { color: textColor, fontSize: 15 }
        // padding: 100
    },
    tooltip: {
        trigger: 'item',
        //triggerOn:'mousemove',
        hideDelay: 333,
        confine: true, // 是否约束 content 在 viewRect 中。默认 false 是为了兼容以前版本。
        textStyle: {
            fontWeight: 'regular',
            fontFamily: 'Yahei',
            fontSize: 22,
            backgroundColor: 'rgba(40, 44, 52, 0.5)',
            color: tooltipColor
        },
        formatter: function (params) { return params.name + '（' + params.value[3].split(' ')[1] + '）<br />' + params.value[2]; }
    },
    toolbox: {
        show: true,
        orient: 'vertical',
        itemSize: 32,
        left: 'right',
        top: 'center',
        feature: {
            // saveAsImage: {},
            // 这个自带的存图功能不能保存背景图，太丑，不要他了
            // 但是图标挺好看的，可以直接修改对应的第 79191 行 echarts.js 代码
            myAbout:
            {
                show: true,
                title: '关于',
                    icon: 'path://M25.5,42.7h-4.4c-1.3,0-3.3-0.5-5.3-1.5c-2-1-4.1-2.4-5.7-4.2l-4.4-4.8l-4.4-4.8c-0.4-0.4-0.8-1-0.9-1.7s0.1-1.6, 0.9-2.4c0.9-0.8, 1.8-1.1, 2.6-1.2s1.5, 0.1, 1.8, 0.2l2.9, 2.2l2.9, 2.2L11.7, 15l0.2-11.7c0- 0.4, 0.1-1.2, 0.5-1.8c0.5-0.6, 1.3-1.1, 2.9-1.1s2.5, 0.5, 3, 1.1C18.9, 2.1, 19, 2.8, 19, 3.3v8v8c0 - 1.1, 0.1-2.5, 0.5-3.6c0.4-1.2, 1.3-2, 2.8-2c1.5, 0, 2.5, 0.7, 3.1, 1.5c0.6, 0.8, 0.8, 1.8, 0.8, 2.5c0.1-0.3, 0.4-0.9, 1-1.4c0.6-0.5, 1.5-0.8, 2.7-0.8c1.6, 0, 2.5, 0.6, 3, 1.2c0.5, 0.6, 0.6, 1.4, 0.6, 1.7v0.5v0.5c0.2-0.3, 0.4-0.8, 0.9-1.2s1.3-0.7, 2.7-0.7c1.5, 0, 2.3, 0.4, 2.8, 0.9s0.6, 1.2, 0.6, 1.6v6.2v6.2c0, 1.8-1.1, 4.4-2.9, 6.6S33, 42.7, 30, 42.7l - 3.9 - 0.1',
                onclick: function () {
                    if (option.title.left == 'center') {
                        option.geo.roam = true;
                        option.title.left = 'left';
                        option.title.text = '山东师大附中 2018 级 3 班毕业去向详情';
                        // option.title.subtext = '广东\n    南方科技大学：朱骐、杨晓荣、苏茹涵\n    华南理工大学：任希晗\n上海\n    上海科技大学：刘昱\n    上海对外经贸大学：鹿雨桐\n四川\n    四川大学：高淮峰\n    西南石油大学：张贤明\n    成都理工大学：李庆虎\n    中国民用航空飞行学院：董雨佳佳\n山东\n    山东大学：周涵森、张泽、李逸霏、陈奕昂\n    中国石油大学：张钛然\n    山东师范大学：杨若涵、武原禾、郭君婕、周安木\n    青岛大学：赵汝恒、尤胜寒、翟松亭\n    齐鲁工业大学：马翊轩\n    山东中医药大学：李芃泽\n    济南大学：鲁畅、王宜萱\n    山东财经大学：纪翔\n    山东农业大学：孙竹妍\n    烟台大学：胡琮林\n陕西\n    西安电子科技大学：于洋\n    西安建筑科技大学：胡松昀\n浙江\n    杭州电子科技大学：徐沁发\n    宁波诺丁汉大学：孟晓彤\n江苏\n    南京农业大学：朱茂隆\n    中国矿业大学：李木子\n    西交利物浦大学：赵雨晨\n安徽\n    合肥工业大学：刘明昊、张家才\n    安徽理工大学：赵正睿\n    中国科学技术大学：徐明甲\n福建\n    福州大学：杨云飞\n    集美大学：吴宇龙\n    福建农林大学：支俏\n辽宁 东北大学：仝家驹\n海南 海南大学：徐了然\n湖南 国防科技大学：杨一凡\n天津 天津工业大学：倪想\n澳门 澳门科技大学：臧铭辰\n新疆 新疆医科大学：黄轲欣\n';
                    }
                    else {
                        option.title.left = 'center';
                        option.title.text = '山东师大附中 2018 级 3 班毕业蹭饭地图（交互版）';
                        // option.title.subtext = '班主任：傅平修\n\n任课老师：孙国旺、傅平修、颜廷波、曹立、宋志刚、王凤芝、李伟、王醒、牛丽华、孙晓峰';
                    }
                    myChart.setOption(option, true);
                }
            }
        },
    },
    geo: {
        // zoom: 1.3,
        map: 'china',
        label: {
            show: false
        },
        roam: true,
        // roam: os.isPc, // 如果 roam 开启 true，在手机上缩放会稍微有一点卡顿
        itemStyle: {
            normal: {
                areaColor: mainColor,
                borderColor: borderColor
            },
            emphasis: {
                areaColor: mainColor
            }
        },
        silent: false // 若 silent 设为 true，则鼠标移至相应地区则不会显示省份名，点也不会有反应

    },
    series: [{
        name: '大学',
        type: 'scatter',
        coordinateSystem: 'geo',
        data: convertData(),
        symbol: os.isPc ? 'pin' : 'circle',
        // symbol: 'pin',
        symbolSize: 30,
        label: {
            normal: {
                formatter: '{b}',
                position: 'right',
                show: false
            }
        },
        itemStyle: {
            normal: {
                color: spotColor
            }
        }

    },

    ]
};


var dontBack = false; // 用于实现双击返回上一级地图
var parentMaps = new Array(); // 维护一个 array，用于记录地图路径

function checkUrl() {
    var url = window.location.href;
    if (url.indexOf('#') == -1) return 'china';
    place = url.substr(url.indexOf('#') + 1);
    place = decodeURI(place);
    if (MAPS.indexOf(place) != -1) {
        // dontBack = true;
        parentMaps.push('china');
        option.geo.label.show = true;
        return place;
    }
    else return 'china';
};

option.geo.map = checkUrl();


if (option && typeof option === "object") {
    myChart.setOption(option, true);
    myChart.resize();
    setTimeout(function () { alert("使用说明：\n1) 点一下大学对应的橙色标记，会显示出在这个大学的同学名单\n2) 点一下每个省份的地图，将会进入到各个省份的高清大图模式\n3) 对于人数较多的区，也提供高清大图，可以点\n4) 点两下背景图片将返回到上一级地图\n5) 如果使用电脑查看此蹭饭图，还可以直接用鼠标滚轮进行缩放\n6) 地图右侧小手按钮重置地图\n7) 网页改编自 https://ssfz.top 山东师大附中 2018 级 10 班毕业蹭饭地图") }, 500);
}

// 改变地图，传入新的地点
function changeMap(newPlace) {
    function changeSubtitle() {
        var stuList = new Array();
        for (var i = 0; i < DATA.length; ++i) {
            if (DATA[i].city.indexOf(newPlace) != -1) {
                var tmp = DATA[i].value.split(' ');
                for (var j = 0; j < tmp.length; ++j) stuList.push(tmp[j]);
            }
        }
        var str = '';
        for (var i = 0; i < stuList.length; ++i) {
            str += i == stuList.length - 1 ? stuList[i] : stuList[i] + ' ';
            if ((i + 1) % 5 == 0) str += '\n\n';
        }
        // option.title.subtext = str;
    }

    option.title.left = 'center';
    option.geo.label.show = (newPlace != 'china');
    if (newPlace != 'china') {
        option.title.text = '山东师大附中 2018 级 3 班毕业蹭饭地图 - ' + newPlace;
        changeSubtitle(newPlace);
    } else {
        option.title.text = '山东师大附中 2018 级 3 班毕业蹭饭地图（交互版）';
        // option.title.subtext = '班主任：傅平修\n\n任课老师：孙国旺、傅平修、颜廷波、曹立、宋志刚、王凤芝、李伟、王醒、牛丽华、孙晓峰';
    }
    option.geo.map = newPlace;
    myChart.setOption(option, true);
}

myChart.on('click', function (params) {
    if (params.name == '南海诸岛') {
    }
    // dontBack = true;
    // 显示对应省份的大图，并忽视对于校名大头钉的 click 事件
    // 进入各省地图之后，可以显示城市的名字。
    // 出来之后再关掉。
    if (MAPS.indexOf(params.name) != -1) {
        parentMaps.push(option.geo.map);
        changeMap(params.name);
    }
});

// 由于拖拽地图也会触发 click 事件，所以这里判断一下鼠标按下和抬起的位置坐标变化
var downX, downY;
$('#main').mousedown(function (e) {
    downX = e.pageX;
    downY = e.pageY;
});

$('#main').mouseup(function (e) {
    var upX = e.pageX;
    var upY = e.pageY;
    var dltX = Math.abs(upX - downX);
    var dltY = Math.abs(upY - downY);
    // console.log(dltX, dltY);
    if (dltX <= 5 && dltY <= 5 && parentMaps.length > 0) {
        if (!dontBack) {
            changeMap(parentMaps[parentMaps.length - 1]);
            parentMaps.pop();
            // dontBack = true; // 保证双击返回上一层地图的重要操作
        } else {
            // dontBack = false;
        }
    }
});
