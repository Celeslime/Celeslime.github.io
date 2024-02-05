
var timer, dt=1;	//时钟，单位：ms
var planets=[], n=0;//星球数组
// 从css获取--planet_size
var planet_size=getComputedStyle(document.documentElement).getPropertyValue('--planet_size');
planet_size=Number(planet_size.substring(0,planet_size.length-2));
for(var i = 0; i < 5; i++){
	addPlanet();
}
timer=setInterval(frame, dt);

function Vector(x, y){ //向量类，写法有点奇怪
	this.x = x;
	this.y = y;
	this.r2=function(v=new Vector(0,0)){//模长的平方
		return Math.pow(this.x-v.x,2)+Math.pow(this.y-v.y,2)
	};
	this.arg=function(v=new Vector(0,0)){//矢量辐角
		if((this.x-v.x)>=0)return Math.atan((this.y-v.y)/(this.x-v.x));
		else return Math.PI+Math.atan((this.y-v.y)/(this.x-v.x));
	};
	this.sum=function(v){//矢量相加
		this.x+=v.x;
		this.y+=v.y; 
		return;
	};
	this.scale=function(s){//矢量缩放
		return new Vector(this.x*s,this.y*s);
	};
	this.mult=function(v=new Vector(0,0)){//复数相乘运算
		var tx=this.x*v.x-this.y*v.y;
		var ty=this.y*v.x+this.x*v.y;
		this.x=tx;
		this.y=ty;
		return;
	}
	this.valueOf=function(){
		return Math.sqrt(this.r2());
	}
}
function Planet(id,x=new Vector(0,0),v=new Vector(0,0)){//星球类
	this.id = id;
	this.x = x;
	this.v = v;
}
function reflash(planet){//重画：我的画手
	document.getElementById(planet.id).style = 
		"margin:" + (planet.x.x-planet_size/2) + "px " + (planet.x.y-planet_size/2) + "px;";
	return;
}
function addPlanet(x=new Vector(),v=new Vector()){
	// 70-140
	var r = 100 + 100*Math.random();
	var th = 2*Math.PI*Math.random();
	x.x = r * Math.cos(th);
	x.y = r * Math.sin(th);
	v.x =  0.5 * Math.sin(th);
	v.y = -0.5 * Math.cos(th);
	var idName = n.toString();
	planets[n] = new Planet(n,x,v);//一个新的星球诞生：初始设定
	universe.innerHTML += '<div class="planet" id="'+idName+'"></div>';//植入html，得让画手找到它吧！
	n++;
}

function frame(){
	var r2,a,dx,dv,planet;
	for(var i=0;i<n;i++){
		planet=planets[i];//一个个来
		if(planet.id==-1)continue; //死星不再运动：跳过
		r2=planet.x.r2();
		if(r2 < 10){
 			mes.innerHTML="警告！"+i+"号行星与中心天体碰撞！";
 			planet.x.x = 0;
 			planet.x.y = 0;
 			planets[i].id = -1;
			return;
		}
		a = planet.x.scale(-.4/r2);
		dv = a.scale(dt);
		planet.v.sum(dv);
		dx = planet.v.scale(dt);
		planet.x.sum(dx);//位置已更新
		reflash(planet);
	}
}

document.body.addEventListener("click",function(){
    addPlanet();
});